#!/usr/bin/env node
// A persistent bridge between a live Embergale run and whoever is driving it one
// decision at a time (a human via curl, a script, an LLM reasoning between calls).
// It keeps a single Playwright browser open across many separate HTTP requests
// instead of the usual launch-act-close-per-script pattern, so each call sees
// real game state and the effect of the previous call — the same shape as a
// person actually playing, just over HTTP instead of a keyboard.
//
// It exists because of assets/js/site/ember-arena-game.js's `_debugState()` and
// the page's `window.__EMBER_DEBUG_GAME__` (see news/ember-keep/index.html):
// this script is the thing that actually calls them, from outside the browser.
//
// Prerequisites:
//   npm install playwright && npx playwright install chromium
//   (or point PLAYWRIGHT_EXECUTABLE_PATH at an existing Chromium install)
//
// Usage:
//   1. Serve the site locally, e.g.: python3 -m http.server 8809
//   2. node tools/server-player.js
//   3. curl http://localhost:8811/state
//      curl -X POST http://localhost:8811/act -H 'Content-Type: application/json' \
//        -d '{"move": {"dx": 1, "dy": 0}, "bow": true, "ms": 500}'
//   4. curl -X POST http://localhost:8811/pause -d '{"on": true}'  # turn-by-turn mode
//   5. curl -X POST http://localhost:8811/stop   # flushes the recorded video and exits
//
// Four things about this bridge that are otherwise learned the hard way:
//
//   * The arena runs in real time and does not wait for the caller. Between two
//     requests the world keeps advancing, and the stick stays exactly where the
//     last /act left it — so a caller that spends thirty seconds deciding has a
//     character walking into a wall for thirty seconds, and takes most of its
//     damage there rather than in the fights it is actually steering. POST
//     /pause exists for callers that need to think between turns.
//   * The upgrade overlay is one place the game already stops by itself: while
//     /state reports `choosing: true` the world is frozen and nothing can land
//     a hit. It is not the only one — see frozenFor below.
//   * A random "familiar visit" (Cookie/May, when enough monsters are up) can
//     freeze the whole arena — player included, `choosing` stays false — for
//     FAMILIAR_ANNOUNCE_DURATION seconds of real game time, independent of
//     `state`. In turn-by-turn mode, where each /act only unpauses for its own
//     `ms`, that freeze is paid off a sliver at a time: several turns in a row
//     can read as "nothing responded" while it drains, and whatever move was
//     last sent stays armed and fires the instant it lets go — the thing to do
//     is send one turn with `ms` covering the reported `frozenFor` (in
//     milliseconds) rather than spend several short ones guessing why nothing
//     moved. /state's `frozenFor` reports the remaining freeze in seconds, 0
//     when nothing is holding the arena.
//   * After a death any attack silently restarts the run instead of doing
//     nothing: meleeAttack/bowAttack/ultimateAttack all fall through to start()
//     when the state isn't 'playing' (see the returned API in
//     assets/js/site/ember-arena-game.js). A caller that keeps swinging at a
//     corpse begins a fresh run with none of its upgrades and no announcement —
//     read `dead` from /state before sending the next action.
//
// Environment variables (all optional):
//   EMBER_GAME_URL              default http://localhost:8809/news/ember-keep/
//   EMBER_PLAY_SERVER_PORT      default 8811
//   EMBER_VIDEO_DIR             default ./tools/play-server-videos
//   EMBER_RECORD_VIDEO          default "1" — set to "0" to skip video recording
//   PLAYWRIGHT_EXECUTABLE_PATH  path to a Chromium binary, if not using
//                                Playwright's own downloaded browser
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const GAME_URL = process.env.EMBER_GAME_URL || 'http://localhost:8809/news/ember-keep/';
const PORT = Number(process.env.EMBER_PLAY_SERVER_PORT) || 8811;
const VIDEO_DIR = process.env.EMBER_VIDEO_DIR || path.join(__dirname, 'play-server-videos');
const RECORD_VIDEO = process.env.EMBER_RECORD_VIDEO !== '0';

let browser, context, page;
// Turn-by-turn mode, switched on by POST /pause: the arena stays frozen between
// requests so one /act is one discrete turn, instead of one command plus however
// long the caller takes to send the next one.
let stepMode = false;

// The engine already exposes setPaused() — the page uses it to freeze the arena
// behind the portrait rotate-prompt — so stepping needs no engine change.
async function setGamePaused(value) {
    await page.evaluate((v) => window.__EMBER_DEBUG_GAME__.setPaused(v), value);
}

async function boot() {
    const launchOpts = {};
    if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
    browser = await chromium.launch(launchOpts);

    // Landscape on purpose, for the recording: the arena and both control
    // clusters fit in one frame at this size, so the capture shows the whole
    // playfield without the page scrolling under it mid-run. (This is just a
    // wide desktop window — the phone's landscape deck is a different layout,
    // gated on max-height: 480px, and nothing here triggers it.)
    const contextOpts = { viewport: { width: 1280, height: 800 } };
    if (RECORD_VIDEO) contextOpts.recordVideo = { dir: VIDEO_DIR, size: { width: 1280, height: 800 } };
    context = await browser.newContext(contextOpts);

    page = await context.newPage();
    await page.goto(GAME_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.click('#ember-canvas');

    // The page smooth-scrolls itself onto the arena right after start
    // (focusArena() in news/ember-keep/index.html) — wait for that to settle so
    // every subsequent DOM query lands on the real, final layout.
    let lastY = -1, stableFor = 0;
    for (let i = 0; i < 60 && stableFor < 3; i++) {
        const y = await page.evaluate(() => window.scrollY);
        if (Math.abs(y - lastY) < 0.5) stableFor++; else stableFor = 0;
        lastY = y;
        await page.waitForTimeout(100);
    }
    await page.waitForTimeout(200);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => {
            try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
        });
    });
}

// A read-only snapshot via game._debugState() (see ember-arena-game.js), plus
// the bits of page/DOM state (cooldown classes, overlay visibility) that only
// the page itself tracks — everything one call needs to decide the next move.
async function getState() {
    return page.evaluate(() => {
        const game = window.__EMBER_DEBUG_GAME__;
        const s = game._debugState();
        const overlay = document.getElementById('ember-overlay');
        const upgradeOverlay = document.getElementById('ember-upgrade');
        const dead = !!(overlay && !overlay.hidden);
        const won = dead && !document.getElementById('ember-overlay-won').hidden;
        const choosing = !!(upgradeOverlay && !upgradeOverlay.hidden);
        const cards = choosing
            ? Array.from(document.querySelectorAll('#ember-upgrade-cards button')).map((b, i) => ({
                index: i, text: b.textContent.trim(),
            }))
            : [];
        return {
            player: { x: s.player.x, y: s.player.y, hp: s.player.hp, maxHp: s.player.maxHp },
            monsters: s.monsters.map((m) => ({
                x: Math.round(m.x), y: Math.round(m.y), type: m.type, hp: m.hp, maxHp: m.maxHp,
                dist: Math.round(Math.hypot(m.x - s.player.x, m.y - s.player.y)),
            })),
            hearts: s.hearts.map((h) => ({ x: Math.round(h.x), y: Math.round(h.y) })),
            treasures: s.treasures.map((t) => ({ x: Math.round(t.x), y: Math.round(t.y), kind: t.kind })),
            W: s.W, H: s.H,
            dead, won, choosing, cards,
            // Seconds of real game time left on a freeze that isn't `choosing` — see
            // the note on familiar visits at the top of this file. 0 when nothing is
            // holding the arena.
            frozenFor: s.frozenFor,
            bowCooling: document.getElementById('ember-bow-btn').classList.contains('is-cooling'),
            ultCooling: document.getElementById('ember-ult-btn').classList.contains('is-cooling'),
        };
    });
}

// One POST /act body is one "turn": an optional move direction held for `ms`
// milliseconds, plus any number of instant actions dispatched at the start of
// that hold. The game keeps running in real time regardless of how long the
// caller takes to decide the next call — so by default this only controls what
// happens *while connected*. POST /pause lifts that limit: in turn-by-turn mode
// the world is frozen between requests and one /act really is one turn.
async function applyAction(body) {
    // In turn-by-turn mode the world is frozen between requests: let it run for
    // exactly this turn, then freeze it again on the way out.
    if (stepMode) await setGamePaused(false);
    // Dispatched via element.click() in-page rather than Playwright's own
    // .click() — the page keeps scrolling itself during play (focusArena(),
    // the upgrade overlay opening), which makes Playwright's actionability
    // wait (visible/stable/unobstructed) time out for up to 30s and 500 the
    // whole turn. A direct DOM click has no such wait and just fires.
    if (body.restart) {
        await page.evaluate(() => document.getElementById('ember-restart')?.click());
    }
    if (body.chooseIndex !== undefined && body.chooseIndex !== null) {
        await page.evaluate((i) => {
            document.querySelectorAll('#ember-upgrade-cards button')[i]?.click();
        }, body.chooseIndex);
    }
    if (body.melee === true) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.meleeAttack());
    if (body.melee === false) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.meleeRelease());

    if (body.move) {
        const { dx, dy } = body.move;
        const len = Math.hypot(dx, dy) || 1;
        await page.evaluate(([x, y]) => window.__EMBER_DEBUG_GAME__.setStick(x, y), [dx / len, dy / len]);
    } else if (body.move === null) {
        await page.evaluate(() => window.__EMBER_DEBUG_GAME__.setStick(null));
    }
    if (body.bow) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.bowAttack());
    if (body.ult) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.ultimateAttack());

    await page.waitForTimeout(body.ms || 500);
    if (stepMode) await setGamePaused(true);
}

const server = http.createServer(async (req, res) => {
    try {
        if (req.method === 'GET' && req.url === '/state') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await getState()));
            return;
        }
        if (req.method === 'POST' && req.url === '/act') {
            await applyAction(await readBody(req));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await getState()));
            return;
        }
        if (req.method === 'POST' && req.url === '/pause') {
            // {"on": true} freezes the arena and makes every later /act a single
            // turn; {"on": false} hands the run back to real time.
            const body = await readBody(req);
            stepMode = body.on !== false;
            await setGamePaused(stepMode);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, stepMode, state: await getState() }));
            return;
        }
        if (req.method === 'POST' && req.url === '/stop') {
            const final = await getState();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, final }));
            await context.close(); // flushes the recorded video, if any, to VIDEO_DIR
            await browser.close();
            server.close();
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found — see the usage comment at the top of this file');
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(String((e && e.stack) || e));
    }
});

boot()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`server-player ready on :${PORT} (driving ${GAME_URL})`);
            if (RECORD_VIDEO) console.log(`recording to ${VIDEO_DIR}`);
        });
    })
    .catch((e) => {
        console.error('boot failed:', e);
        process.exit(1);
    });
