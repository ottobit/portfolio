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
//   4. curl -X POST http://localhost:8811/act -H 'Content-Type: application/json' \
//        -d '{"steps": [{"move": {"dx": 1, "dy": 0}, "ms": 400}, {"melee": true, "ms": 600}]}'
//   5. curl -X POST http://localhost:8811/pause -d '{"on": true}'  # turn-by-turn mode
//   6. curl -X POST http://localhost:8811/stop   # flushes the recorded video and exits
//
// Five things about this bridge that are otherwise learned the hard way:
//
//   * The arena runs in real time and does not wait for the caller — a caller
//     that spends thirty seconds deciding has a character exposed for thirty
//     seconds, and takes most of its damage there rather than in the fights it
//     is actually steering. Two things soften that in real-time mode (see POST
//     /pause below for the alternative: freeze the arena between turns
//     entirely). First, the stick is released automatically at the end of
//     every step (see runStep) — the old behaviour left it exactly where the
//     last /act set it, so a caller that took a while to decide the next move
//     had a character walking in a stale direction for however long that
//     took, which is how a run ended face-first in a wall. A step that ends
//     now leaves the character stationary — still defended by an active melee
//     spin, since that's left alone — instead of still walking. Second,
//     `steps` lets one call chain several moves/attacks with their own `ms`
//     each, so one round of reasoning buys several seconds of real play
//     instead of one *up until the first sign of real trouble* — see the next
//     point — cutting the number of exposed gaps between calls.
//   * A `steps` batch stops itself the moment things go badly wrong, instead
//     of finishing a plan that has already failed: applyAction checks the HP
//     it reads after every step against ABORT_HP_DROP_FRACTION and
//     ABORT_HP_FLOOR_FRACTION (near the top of the file) and breaks out early
//     on a death or a bad enough drop, same as a reflex has to be faster than
//     the reasoning loop that queued the batch in the first place — this is
//     how a run ended mobbed to 0 HP mid-batch, three steps queued at full
//     health with no check in between. /act's response reports
//     `stepsRun`/`stepsRequested`/`abortedReason` alongside the usual state,
//     so the caller knows immediately whether and why a batch was cut short.
//     The coverage stops at step boundaries, not mid-step: a single step (or
//     one long `ms` inside an array) is still unprotected for its own
//     duration — there's no polling inside a step's wait.
//   * The upgrade overlay is one place the game already stops by itself: while
//     /state reports `choosing: true` the world is frozen and nothing can land
//     a hit. It is not the only one — see frozenFor below.
//   * A random "familiar visit" (Cookie/May, when enough monsters are up) can
//     freeze the whole arena — player included, `choosing` stays false — for
//     FAMILIAR_ANNOUNCE_DURATION seconds of real game time, independent of
//     `state`. In turn-by-turn mode, where each /act only unpauses for its own
//     `ms`, that freeze is paid off a sliver at a time: several turns in a row
//     can read as "nothing responded" while it drains — send one turn with
//     `ms` covering the reported `frozenFor` (in milliseconds) rather than
//     spend several short ones guessing why nothing moved. (The stale-move
//     risk this used to carry — a direction sent before the freeze firing the
//     instant it let go — is what the per-step stick release above already
//     covers.) /state's `frozenFor` reports the remaining freeze in seconds,
//     0 when nothing is holding the arena.
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

// Cheaper than getState(): just the two numbers applyAction's abort check
// needs, skipping the DOM queries (overlay, monsters, cooldowns) that
// getState() also does. Called after every step in a batch, so it has to
// stay light.
async function readHp() {
    return page.evaluate(() => {
        const p = window.__EMBER_DEBUG_GAME__._debugState().player;
        return { hp: p.hp, maxHp: p.maxHp };
    });
}

// A batch that goes on regardless of what just happened is how a run ended
// mobbed to 0 HP mid-sequence: three steps queued at 148/148, six monsters
// closed in during the first one, and the other two ran anyway before the
// caller could see it and react. These are the same kind of reflex as the
// automatic stick release above — code, not judgement, because anything
// that has to wait on another reasoning turn is already too slow to be a
// reflex. Checked at each step's boundary, not mid-step: a single step with
// a large `ms` is still uncovered for its whole duration (see the usage
// note at the top of this file).
const ABORT_HP_DROP_FRACTION = 0.3;  // lost 30%+ of max HP within this one batch
const ABORT_HP_FLOOR_FRACTION = 0.2; // down to 20% or less of max HP, however it got there

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

// One step is one atomic instruction: an optional move direction held for
// `ms` milliseconds, plus any number of instant actions dispatched at the
// start of that hold.
async function runStep(step) {
    // Dispatched via element.click() in-page rather than Playwright's own
    // .click() — the page keeps scrolling itself during play (focusArena(),
    // the upgrade overlay opening), which makes Playwright's actionability
    // wait (visible/stable/unobstructed) time out for up to 30s and 500 the
    // whole turn. A direct DOM click has no such wait and just fires.
    if (step.restart) {
        await page.evaluate(() => document.getElementById('ember-restart')?.click());
    }
    if (step.chooseIndex !== undefined && step.chooseIndex !== null) {
        await page.evaluate((i) => {
            document.querySelectorAll('#ember-upgrade-cards button')[i]?.click();
        }, step.chooseIndex);
    }
    if (step.melee === true) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.meleeAttack());
    if (step.melee === false) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.meleeRelease());

    if (step.move) {
        const { dx, dy } = step.move;
        const len = Math.hypot(dx, dy) || 1;
        await page.evaluate(([x, y]) => window.__EMBER_DEBUG_GAME__.setStick(x, y), [dx / len, dy / len]);
    }
    if (step.bow) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.bowAttack());
    if (step.ult) await page.evaluate(() => window.__EMBER_DEBUG_GAME__.ultimateAttack());

    await page.waitForTimeout(step.ms || 500);

    // Released unconditionally, not just on an explicit {"move": null} — in
    // real-time mode nothing else catches a stale direction between calls, so
    // a step that ends leaves the character stationary by default rather
    // than still walking wherever it was last pointed (see the usage note at
    // the top of this file). Melee is left alone: an active spin keeps
    // defending through the gap instead of dropping too.
    await page.evaluate(() => window.__EMBER_DEBUG_GAME__.setStick(null));
}

// One POST /act body is either a single step, or {"steps": [...]} — a
// sequence of steps run back to back without an extra round trip per step,
// so one call can cover several seconds of real play instead of one, up
// until the first sign of real trouble (see ABORT_HP_DROP_FRACTION above).
// In turn-by-turn mode the whole sequence runs inside a single
// unpause/pause bracket.
async function applyAction(body) {
    if (stepMode) await setGamePaused(false);
    const steps = Array.isArray(body.steps) ? body.steps : [body];
    const { hp: hpAtStart, maxHp } = await readHp();
    let stepsRun = 0;
    let abortedReason = null;
    for (const step of steps) {
        await runStep(step);
        stepsRun++;
        const { hp } = await readHp();
        if (hp <= 0) { abortedReason = 'dead'; break; }
        if (maxHp > 0 && (hpAtStart - hp) / maxHp >= ABORT_HP_DROP_FRACTION) {
            abortedReason = 'hp_drop';
            break;
        }
        if (maxHp > 0 && hp / maxHp <= ABORT_HP_FLOOR_FRACTION) {
            abortedReason = 'hp_floor';
            break;
        }
    }
    if (stepMode) await setGamePaused(true);
    return { stepsRun, stepsRequested: steps.length, abortedReason };
}

const server = http.createServer(async (req, res) => {
    try {
        if (req.method === 'GET' && req.url === '/state') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await getState()));
            return;
        }
        if (req.method === 'POST' && req.url === '/act') {
            const result = await applyAction(await readBody(req));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ...(await getState()), ...result }));
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
