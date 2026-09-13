// Data, sprites, upgrades, audio, storage and colour helpers used to all live
// in this one file — they're now split out (none of them need the closure
// below, which is the part that actually has to stay one piece: it shares
// mutable run state — player, monsters, bolts, tuning — across ~50 functions).
import {
    drawArenaIcon, HERO_PALETTE, HERO_FRAMES, MONSTER_TYPES, HEART_FRAME, HEART_PALETTE,
    COOKIE_PALETTE, MAY_PALETTE, DOG_FRAME, MAY_FRAME, paintSprite, pickMonsterType,
} from './ember-arena-sprites.js?v=1';
export { drawArenaIcon };
import { DEFAULT_STRINGS, UPGRADES } from './ember-arena-upgrades.js?v=1';
import { getAudioCtx, chirp, noiseBurst } from './ember-arena-audio.js?v=1';
import {
    WON_KEY, MUTE_KEY, readFlag, writeFlag, readBestLevel, writeBestLevel, writeBestRecord,
} from './ember-arena-storage.js?v=1';
import { blendHex, tintPalette, themeColors, circlesOverlap } from './ember-arena-color.js?v=1';

// Kill the warlord that shows up here and the run is over — won, not just survived.
// Exported so the page can show the target ("7 / 15") without reaching into a game
// instance that does not exist yet while initEmberArena is still running.
export const FINAL_LEVEL = 15;
const FIRE_COLOR = '#e67e22';
const FIRE_GLOW = '#f9ca24';
// Enemy bolts are magenta on purpose: never the hero's own fire orange, so what
// hurts you is never confused with what you threw.
const BOLT_COLOR = '#9b59b6';
const BOLT_GLOW = '#e056fd';
const ICE_COLOR = '#74c0fc';
const ICE_GLOW = '#d0f0ff';
const KNOCKBACK = 320;   // px/s shove a sword hit gives a monster
const KNOCK_DECAY = 6;   // how quickly that shove dies down
// The sword's own size never changes with upgrades (only its colour does, see
// drawPlayer) — moved out a bit further from BLADE_START's old value of 11 so it
// reads as held out from the hand instead of hugging the hero's centre.
const BLADE_START = 14;
const BLADE_LEN = 17;
const BLADE_TIP = BLADE_START + BLADE_LEN + 2;

// How rare each familiar visit is, and what triggers it — tunable in one place
// instead of buried in update(). Cookie/May's own sprite data lives in
// ember-arena-sprites.js.
const FAMILIAR_MANY_MONSTERS = 6;     // both need at least this many non-boss monsters up
const FAMILIAR_CHECK_INTERVAL = 2;    // seconds between eligibility rolls
const FAMILIAR_CHANCE = 0.12;         // chance a visit actually starts on an eligible roll
const FAMILIAR_COOLDOWN = 25;         // minimum seconds between two visits
const FAMILIAR_ANNOUNCE_DURATION = 1.8; // seconds the arena freezes for the name banner

export function initEmberArena(canvas, opts) {
    const options = opts || {};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The logical world size. Almost always just a DPR-crispness concern (see
    // resize() below), but it does change shape outright when the phone is
    // rotated in/out of the landscape layout — see resize()'s reflow branch.
    let W = canvas.clientWidth;
    let H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const player = {
        x: W / 2,
        y: H / 2,
        r: 14,
        giantScale: 1,
        giantTimer: 0,
        facing: { x: 1, y: 0 },
        maxHp: 100,
        hp: 100,
        invulnUntil: 0,
        paralyzedUntil: 0,
        meleeDamage: 18,
        fireDamage: 14,
        moving: false,
        walkT: 0,
    };
    const keys = { up: false, down: false, left: false, right: false };
    // Fixed analog stick in the bottom-left corner: always drawn, engaged by a
    // pointer landing near it, and it follows only that pointer afterwards.
    // Steering comes from outside now: the stick lives under the arena, in the page,
    // because drawn on the canvas it covered the very corner you get pushed into.
    // null means nobody is steering, and the keyboard takes over.
    let stick = null;
    // The sword has no cooldown: holding the action keeps the hero spinning like a
    // top, and a tap is just a spin that stops after its first full turn.
    const TAU = Math.PI * 2;
    const BASE_SPIN_DUR = 0.22; // seconds per full turn, before any Fury card
    const BASE_ULT_CD = 8;
    // Everything a level-up card can move lives here, so a card is one line and the
    // run's numbers are never scattered as literals through the loop.
    const baseTuning = {
        spinDur: BASE_SPIN_DUR,
        ultCd: BASE_ULT_CD,
        meleeRange: 44,
        speed: 190,
        knockback: KNOCKBACK,
        // opts.heartChance exists for the tests, the same seam opts.startLevel already
        // provides: a drop this rare is otherwise only observable by playing for minutes.
        heartChance: typeof options.heartChance === 'number' ? options.heartChance : 0.13,
    };
    let tuning = Object.assign({}, baseTuning);
    let strings = Object.assign({}, DEFAULT_STRINGS, options.strings || {});
    const ULT_DUR = 0.6;
    const startLevel = Math.max(1, options.startLevel || 1);

    let monsters = [];
    let explosions = [];
    let bolts = [];
    let hearts = [];
    let floaters = [];   // damage numbers drifting up
    let particles = [];  // what is left of a monster that just died
    let familiarVisit = null; // the one rare Cookie/May visit in progress, if any
    let familiarCheckTimer = 0;
    let familiarCooldown = 0; // seconds left before another visit can even be rolled
    let familiarAnnounce = null; // { kind, t } while the arrival banner freezes the arena
    let level = 1;
    let xp = 0;
    let xpToNext = 6;
    let monstersKilled = 0;
    let hitsGiven = 0;    // sword swings and fireball waves that actually landed on a monster
    let hitsReceived = 0; // contact, bolts and boss slams that actually landed on the hero
    let bestLevel = readBestLevel();
    let state = 'ready'; // ready | playing | choosing | over | won
    let elapsed = 0;
    let spawnTimer = 0;
    let spinning = false;   // the hero is turning right now
    let spinHeld = false;   // the action is held down
    let spinAngle = 0;      // radians turned since this spin started
    let spinHitTimer = 0;   // time left before the next damage tick
    let ultCooldown = 0;
    let levelFlash = 0;
    let flashKind = '';   // 'level' | 'boss' | 'final'
    let flashLevel = 1;
    let screenFlash = 0;
    let hurtFlash = 0;
    let shake = 0;
    let taken = {};              // upgrade id -> how many times it was picked
    let pendingChoices = null;   // the three cards waiting to be answered
    let hasWon = readFlag(WON_KEY);
    let muted = readFlag(MUTE_KEY);
    let lastTime = null;
    let rafId = null;

    function onStatsChange(hp, maxHp, lvl, x, xNext, best) {
        if (typeof options.onStatsChange === 'function') options.onStatsChange(hp, maxHp, lvl, x, xNext, best);
    }
    function onStateChange(s, stats) {
        if (typeof options.onStateChange === 'function') options.onStateChange(s, stats);
    }
    function onCooldownChange(ult) {
        if (typeof options.onCooldownChange === 'function') options.onCooldownChange(ult);
    }
    function onChoices(choices) {
        if (typeof options.onChoices === 'function') options.onChoices(choices);
    }
    // kind is 'cookie'/'may' when the arrival banner should show, or null to hide it.
    function onFamiliarAnnounce(kind) {
        if (typeof options.onFamiliarAnnounce === 'function') options.onFamiliarAnnounce(kind);
    }
    // One place decides whether a sound happens at all: muted, or not playing yet.
    function sfx(name) {
        if (muted || state === 'ready') return;
        if (name === 'swing') chirp({ from: 620, to: 300, duration: 0.07, type: 'triangle', gain: 0.025 });
        else if (name === 'hit') noiseBurst(0.07, 0.05, 1800);
        else if (name === 'kill') chirp({ from: 340, to: 90, duration: 0.16, type: 'square', gain: 0.035 });
        else if (name === 'hurt') chirp({ from: 180, to: 60, duration: 0.26, type: 'sawtooth', gain: 0.05 });
        else if (name === 'heart') { chirp({ from: 540, to: 800, duration: 0.1, type: 'sine', gain: 0.05 }); chirp({ from: 800, to: 1100, duration: 0.12, type: 'sine', gain: 0.04, delay: 0.09 }); }
        else if (name === 'level') { chirp({ from: 440, to: 660, duration: 0.12, gain: 0.04 }); chirp({ from: 660, to: 990, duration: 0.16, gain: 0.04, delay: 0.11 }); }
        else if (name === 'card') chirp({ from: 880, to: 1320, duration: 0.1, type: 'triangle', gain: 0.04 });
        else if (name === 'storm') { noiseBurst(0.5, 0.07, 900); chirp({ from: 220, to: 1200, duration: 0.45, type: 'sawtooth', gain: 0.03 }); }
        else if (name === 'boss') { chirp({ from: 120, to: 60, duration: 0.7, type: 'sawtooth', gain: 0.06 }); noiseBurst(0.5, 0.05, 400); }
        else if (name === 'win') [0, 0.13, 0.26, 0.42].forEach((d, i) => chirp({ from: [523, 659, 784, 1046][i], to: [523, 659, 784, 1046][i], duration: 0.22, type: 'triangle', gain: 0.05, delay: d }));
        else if (name === 'over') chirp({ from: 300, to: 70, duration: 0.7, type: 'sawtooth', gain: 0.05 });
        else if (name === 'starburst') { chirp({ from: 700, to: 1500, duration: 0.12, type: 'sawtooth', gain: 0.045 }); chirp({ from: 1500, to: 2200, duration: 0.1, type: 'sawtooth', gain: 0.03, delay: 0.08 }); }
        else if (name === 'slam') { noiseBurst(0.12, 0.06, 500); chirp({ from: 140, to: 50, duration: 0.22, type: 'sawtooth', gain: 0.05 }); }
        else if (name === 'bark') { chirp({ from: 380, to: 220, duration: 0.09, type: 'square', gain: 0.045 }); chirp({ from: 340, to: 180, duration: 0.08, type: 'square', gain: 0.035, delay: 0.12 }); }
    }

    // --- Background music --------------------------------------------------
    // A procedural loop, same synthesis approach as the sfx above: nothing to load.
    // Scheduled with a lookahead (look a little into the future on every tick and
    // queue whatever falls due) rather than one setTimeout per note, which is the
    // standard way to keep Web Audio timing steady over a loop that runs for minutes.
    const MUSIC_BEAT = 60 / 100; // seconds per beat at 100 BPM
    const MUSIC_LOOKAHEAD = 0.12;
    const MUSIC_TICK_MS = 25;
    const MUSIC_BASS_NOTES = [73.42, 73.42, 87.31, 73.42]; // D2, D2, F2, D2
    const MUSIC_ARP_NOTES = [293.66, 349.23, 440.0, 349.23]; // D4, F4, A4, F4
    // While a boss (regular or final) is up: faster and a half-step down, so it
    // reads as tenser/grittier rather than a different song — same shape, louder
    // and quicker instead of a full theme change.
    const BOSS_MUSIC_BEAT = 60 / 132;
    const BOSS_BASS_NOTES = [69.30, 69.30, 82.41, 69.30]; // C#2, C#2, E2, C#2
    const BOSS_ARP_NOTES = [277.18, 329.63, 415.30, 329.63]; // C#4, E4, G#4, E4
    let musicNextTime = 0;
    let musicBeatIndex = 0;
    let musicIntervalId = null;
    function scheduleMusicTick() {
        const ac = getAudioCtx();
        if (!ac) return;
        const boss = bossAlive();
        const beat = boss ? BOSS_MUSIC_BEAT : MUSIC_BEAT;
        const bassNotes = boss ? BOSS_BASS_NOTES : MUSIC_BASS_NOTES;
        const arpNotes = boss ? BOSS_ARP_NOTES : MUSIC_ARP_NOTES;
        while (musicNextTime < ac.currentTime + MUSIC_LOOKAHEAD) {
            if (!muted) {
                const delay = musicNextTime - ac.currentTime;
                const bar = musicBeatIndex % bassNotes.length;
                chirp({ from: bassNotes[bar], to: bassNotes[bar], duration: beat * 0.85, type: 'triangle', gain: boss ? 0.04 : 0.032, delay });
                chirp({ from: arpNotes[bar], to: arpNotes[bar], duration: beat * 0.3, type: 'square', gain: boss ? 0.02 : 0.016, delay: delay + beat / 2 });
                if (bar % 2 === 1) noiseBurst(0.05, boss ? 0.016 : 0.01, 2600, delay + beat * 0.25);
            }
            musicNextTime += beat;
            musicBeatIndex++;
        }
    }
    // Starts on the first real run and just keeps going through every state
    // (choosing/over/won included) until muted or destroyed — a small arcade loop
    // does not need separate music per screen. Idempotent: a restart mid-run must
    // not stack a second scheduler.
    function startMusic() {
        if (musicIntervalId) return;
        const ac = getAudioCtx();
        if (!ac) return;
        musicNextTime = ac.currentTime + 0.05;
        musicBeatIndex = 0;
        scheduleMusicTick();
        musicIntervalId = setInterval(scheduleMusicTick, MUSIC_TICK_MS);
    }
    function stopMusic() {
        if (musicIntervalId) {
            clearInterval(musicIntervalId);
            musicIntervalId = null;
        }
    }

    function pushStats() {
        onStatsChange(Math.max(0, Math.ceil(player.hp)), player.maxHp, level, Math.floor(xp), xpToNext, bestLevel);
    }
    function pushCooldowns() {
        onCooldownChange(ultCooldown / tuning.ultCd);
    }
    pushStats();
    pushCooldowns();

    function bossAlive() {
        return monsters.some((m) => m.type === 'boss' || m.type === 'finalBoss');
    }

    function reset() {
        player.x = W / 2;
        player.y = H / 2;
        player.facing = { x: 1, y: 0 };
        player.r = 14;
        player.giantScale = 1;
        player.giantTimer = 0;
        player.maxHp = 100;
        player.hp = 100;
        player.invulnUntil = 0;
        player.paralyzedUntil = 0;
        player.meleeDamage = 18;
        player.fireDamage = 14;
        monsters = [];
        explosions = [];
        bolts = [];
        hearts = [];
        floaters = [];
        particles = [];
        familiarVisit = null;
        familiarCheckTimer = 0;
        familiarCooldown = 0;
        if (familiarAnnounce) onFamiliarAnnounce(null);
        familiarAnnounce = null;
        tuning = Object.assign({}, baseTuning);
        taken = {};
        pendingChoices = null;
        level = 1;
        xp = 0;
        xpToNext = 6;
        monstersKilled = 0;
        hitsGiven = 0;
        hitsReceived = 0;
        elapsed = 0;
        spawnTimer = 0;
        spinning = false;
        spinHeld = false;
        spinAngle = 0;
        spinHitTimer = 0;
        ultCooldown = 0;
        levelFlash = 0;
        flashKind = '';
        screenFlash = 0;
        hurtFlash = 0;
        shake = 0;
        stick = null;
        // Levels skipped by opts.startLevel still hand out a card, so a test hero is
        // equipped roughly like one that actually played its way up here.
        for (let i = 1; i < startLevel; i++) {
            applyLevelUp(false);
            const pool = availableUpgrades();
            if (pool.length) grantUpgrade(pool[Math.floor(Math.random() * pool.length)].id);
        }
        pushStats();
        pushCooldowns();
    }

    function start() {
        reset();
        state = 'playing';
        startMusic();
        onStateChange(state);
    }

    // The arena is sized by the page and follows the window. Most of the time the
    // logical space stays W x H and only the backing store is rebuilt, so the
    // pixel art is redrawn sharp instead of being upscaled — but rotating the
    // phone in/out of the landscape layout genuinely changes the *shape*
    // available (see the landscape media query in styles.css), not just its
    // scale. When that happens, every live entity is reflowed proportionally
    // onto the new shape — so nobody near an edge gets stranded outside the new
    // bounds or bunched into a corner — and W/H themselves are updated to
    // match: the one and only place the logical world size changes after init.
    function resize() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const newW = canvas.clientWidth;
        const newH = canvas.clientHeight;
        const shapeChanged = !!(newW && newH) && Math.abs(newW / newH - W / H) > 0.02;
        if (shapeChanged) {
            const sx = newW / W;
            const sy = newH / H;
            const reflow = (o) => { o.x *= sx; o.y *= sy; };
            reflow(player);
            monsters.forEach(reflow);
            explosions.forEach(reflow);
            bolts.forEach(reflow);
            hearts.forEach(reflow);
            floaters.forEach(reflow);
            particles.forEach(reflow);
            W = newW;
            H = newH;
        }
        const scale = Math.min(Math.max((rect.width / W) * dpr, dpr), 4);
        const nextW = Math.round(W * scale);
        if (!shapeChanged && nextW === canvas.width) return;
        canvas.width = nextW;
        canvas.height = Math.round(H * scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function handleKeyDown(e) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
        if (e.key === ' ' || e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (state === 'playing') meleeAttack();
            else if (state !== 'choosing') start();
        }
        if (e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V') {
            if (state === 'playing') ultimateAttack();
            else if (state !== 'choosing') start();
        }
        if (e.key === 'Enter' && state !== 'playing') start();
    }
    function handleKeyUp(e) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
        if (e.key === ' ' || e.key === 'z' || e.key === 'Z') meleeRelease();
    }
    // Losing the window while the action is held would leave the hero spinning forever.
    function handleBlur() {
        meleeRelease();
        keys.up = keys.down = keys.left = keys.right = false;
    }

    function handlePointerDown(e) {
        if (state !== 'playing') {
            // 'choosing' is a pause with the cards open: a tap must not throw the run away.
            if (state !== 'choosing') start();
            return;
        }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    canvas.addEventListener('pointerdown', handlePointerDown);

    function ultimateAttack() {
        if (elapsed < player.paralyzedUntil) return;
        if (ultCooldown > 0) return;
        ultCooldown = tuning.ultCd;
        screenFlash = 0.22;
        sfx('storm');
        if (!reducedMotion) shake = Math.max(shake, 5);
        explosions.push({
            x: player.x, y: player.y, r: 0,
            maxR: Math.hypot(W, H), life: ULT_DUR, dur: ULT_DUR,
            ult: true, hit: new Set(), seed: Math.random() * TAU,
        });
        // Sparks out of the blast, through the same particle burst the monsters die into.
        burst(player.x, player.y, { a: FIRE_COLOR, b: FIRE_GLOW, c: '#fff3c4' }, reducedMotion ? 10 : 26);
    }
    // Press: start turning and land a hit at once. Hold: keep turning, one hit per
    // turn. Release: stop once the turn in progress completes, so a tap is one spin.
    function meleeAttack() {
        if (elapsed < player.paralyzedUntil) return;
        spinHeld = true;
        if (spinning) return;
        spinning = true;
        spinAngle = 0;
        spinHitTimer = tuning.spinDur;
        sfx('swing');
        meleeHit();
    }
    function meleeRelease() {
        spinHeld = false;
    }
    function meleeHit() {
        const range = tuning.meleeRange;
        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            const dx = m.x - player.x;
            const dy = m.y - player.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < range + m.r) {
                // Shove it away from the hero: the spin buys room, it doesn't only deal damage.
                const push = tuning.knockback * (MONSTER_TYPES[m.type].knockMul || 1);
                m.kx += (dx / dist) * push;
                m.ky += (dy / dist) * push;
                damageMonster(i, player.meleeDamage);
                hitsGiven++;
            }
        }
    }
    function fireBolt(m, cfg) {
        const dx = player.x - m.x;
        const dy = player.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        bolts.push({
            x: m.x, y: m.y,
            vx: (dx / d) * cfg.speed, vy: (dy / d) * cfg.speed,
            r: 5, damage: cfg.damage, life: 5,
            ice: !!cfg.ice, paralyzeDuration: cfg.paralyzeDuration || 0,
        });
    }
    // The final boss's second attack: a whole ring of fire arrows launched together,
    // not aimed — the telegraph before this (drawn in drawMonsters) is the warning,
    // not the bolts themselves. fireArrow marks them so drawBolts and the player can
    // tell them apart from an ordinary caster's bolt on sight.
    function fireStarVolley(m, cfg) {
        for (let i = 0; i < cfg.count; i++) {
            const a = (i / cfg.count) * TAU;
            bolts.push({
                x: m.x, y: m.y,
                vx: Math.cos(a) * cfg.speed, vy: Math.sin(a) * cfg.speed,
                r: 5, damage: cfg.damage, life: 5, fireArrow: true,
            });
        }
        sfx('starburst');
        if (!reducedMotion) shake = Math.max(shake, 3);
    }
    // The regular boss's shockwave, right where its charge ends. Its own entry in
    // `explosions` (flagged `boss`, not `ult`) so it is handled and drawn as its own
    // thing — never the player's own fireball, which it must never be confused with.
    function triggerBossSlam(m) {
        // The final boss hits harder and wider than the regular one — the charge
        // that closes distance is the same move, but landing it should sting more.
        const final = m.type === 'finalBoss';
        explosions.push({ x: m.x, y: m.y, r: 0, maxR: final ? 140 : 110, life: 0.35, dur: 0.35, boss: true, damage: final ? 26 : 18, hit: false, seed: Math.random() * TAU });
        if (!reducedMotion) shake = Math.max(shake, final ? 10 : 8);
        sfx('slam');
    }
    function damageMonster(index, amount) {
        const m = monsters[index];
        m.hp -= amount;
        m.flash = 0.12;
        floaters.push({ x: m.x, y: m.y - m.r - 4, text: String(Math.round(amount)), life: 0.7, color: themeColors().ink });
        sfx('hit');
        if (m.hp <= 0) {
            const def = MONSTER_TYPES[m.type];
            burst(m.x, m.y, def.palette, m.type === 'boss' || m.type === 'finalBoss' ? 26 : 10);
            monsters.splice(index, 1);
            monstersKilled++;
            sfx('kill');
            if (m.type === 'finalBoss') {
                gainXp(m.xpValue);
                win();
                return;
            }
            if (Math.random() < tuning.heartChance) {
                hearts.push({ x: m.x, y: m.y, life: 9 });
            }
            gainXp(m.xpValue);
        }
    }
    // A monster that dies scatters its own colours instead of blinking out.
    function burst(x, y, palette, count) {
        const colors = Object.values(palette);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 120;
            particles.push({
                x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.35 + Math.random() * 0.35, dur: 0.7,
                size: 2 + Math.random() * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }
    }
    // Cookie/May: walk in from a random edge (same corner-picking idea as
    // spawnMonster, minus any chase logic), pause to bark, then leave the way they
    // came. Never fights, never takes or deals contact damage.
    function startFamiliarVisit(kind) {
        const edge = Math.floor(Math.random() * 4);
        const inset = 70;
        let fromX, fromY, restX, restY;
        if (edge === 0) { fromX = Math.random() * W; fromY = -20; restX = fromX; restY = inset; }
        else if (edge === 1) { fromX = W + 20; fromY = Math.random() * H; restX = W - inset; restY = fromY; }
        else if (edge === 2) { fromX = Math.random() * W; fromY = H + 20; restX = fromX; restY = H - inset; }
        else { fromX = -20; fromY = Math.random() * H; restX = inset; restY = fromY; }
        familiarVisit = { kind, phase: 'enter', t: 0, x: fromX, y: fromY, fromX, fromY, restX, restY, acted: false };
    }
    function updateFamiliarVisit(dt) {
        if (familiarCooldown > 0) familiarCooldown -= dt;
        if (!familiarVisit) {
            familiarCheckTimer -= dt;
            if (familiarCheckTimer <= 0) {
                familiarCheckTimer = FAMILIAR_CHECK_INTERVAL;
                if (familiarCooldown <= 0) {
                    const manyMonsters = monsters.filter((m) => m.type !== 'boss' && m.type !== 'finalBoss').length >= FAMILIAR_MANY_MONSTERS;
                    // Cookie and May share the same trigger; which one shows up is a coin flip.
                    if (manyMonsters && Math.random() < FAMILIAR_CHANCE) startFamiliarVisit(Math.random() < 0.5 ? 'cookie' : 'may');
                }
            }
            return;
        }
        const v = familiarVisit;
        v.t += dt;
        if (v.phase === 'enter') {
            const p = Math.min(1, v.t / 0.5);
            v.x = v.fromX + (v.restX - v.fromX) * p;
            v.y = v.fromY + (v.restY - v.fromY) * p;
            if (p >= 1) {
                v.phase = 'act';
                v.t = 0;
                // The banner freezes the arena for a beat before the effect lands — see
                // the familiarAnnounce gate at the top of update(). The bark itself
                // plays right here, not alongside the effect: Cookie's kill sweep and
                // May's level-up each throw a burst of their own same-pitched chirps a
                // moment later, which would otherwise bury the bark completely.
                sfx('bark');
                familiarAnnounce = { kind: v.kind, t: 0 };
                onFamiliarAnnounce(v.kind);
            }
        } else if (v.phase === 'act') {
            // Whatever the visit does lands once, partway through the pause — not the
            // instant it arrives, so the visit reads as an actual beat rather than a
            // switch flipped on entry.
            if (!v.acted && v.t >= 0.3) {
                v.acted = true;
                if (!reducedMotion) shake = Math.max(shake, 6);
                screenFlash = 0.18;
                if (v.kind === 'cookie') {
                    for (let i = monsters.length - 1; i >= 0; i--) {
                        const m = monsters[i];
                        if (m.type === 'boss' || m.type === 'finalBoss') continue;
                        damageMonster(i, m.hp);
                    }
                } else {
                    applyLevelUp(true);
                }
            }
            if (v.t >= 0.6) { v.phase = 'leave'; v.t = 0; }
        } else {
            const p = Math.min(1, v.t / 0.5);
            v.x = v.restX + (v.fromX - v.restX) * p;
            v.y = v.restY + (v.fromY - v.restY) * p;
            if (p >= 1) {
                familiarVisit = null;
                familiarCooldown = FAMILIAR_COOLDOWN;
            }
        }
    }
    function hurtPlayer(amount) {
        if (state !== 'playing') return false;
        if (elapsed < player.invulnUntil) return false;
        hitsReceived++;
        player.hp -= amount;
        player.invulnUntil = elapsed + 0.6;
        hurtFlash = 0.45;
        if (!reducedMotion) shake = Math.max(shake, 7);
        floaters.push({ x: player.x, y: player.y - player.r - 6, text: `-${Math.round(amount)}`, life: 0.8, color: '#ff6b6b' });
        sfx('hurt');
        if (player.hp <= 0) {
            player.hp = 0;
            gameOver();
            return true;
        }
        return false;
    }
    // A status effect, not damage: separate from hurtPlayer so contact hits, the boss
    // slam and the star volley never trigger it by accident. Interrupts an in-progress
    // sword spin — staying mid-swing while frozen would look wrong — and skips the
    // usual hurt sfx since the ice bolt's own damage already played one.
    function applyParalysis(duration) {
        if (state !== 'playing') return;
        player.paralyzedUntil = elapsed + duration;
        if (spinning) {
            spinning = false;
            spinHeld = false;
        }
        burst(player.x, player.y, { a: '#74c0fc', b: '#d0f0ff', c: '#a5d8ff' }, 10);
    }
    function availableUpgrades() {
        return UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
    }
    function grantUpgrade(id) {
        const up = UPGRADES.find((u) => u.id === id);
        if (!up) return false;
        up.apply({ player, tuning, pickIndex: taken[id] || 0 });
        taken[id] = (taken[id] || 0) + 1;
        return true;
    }
    function applyLevelUp(announce) {
        level++;
        xpToNext = Math.round(xpToNext * 1.35 + 2);
        // The level itself gives only survivability, and a modest amount: the monsters
        // scale every level, so a hero whose health never moved would be unkillable by
        // choice alone. Damage, reach and speed stay entirely in the cards' hands.
        player.maxHp += 12;
        player.hp = player.maxHp;
        if (!announce) return;
        const pool = availableUpgrades();
        if (pool.length) {
            // Three distinct cards, drawn without replacement.
            const bag = pool.slice();
            pendingChoices = [];
            while (pendingChoices.length < Math.min(3, bag.length)) {
                pendingChoices.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
            }
            state = 'choosing';
            sfx('level');
            pushStats();
            onChoices(pendingChoices.map((u) => ({ id: u.id, icon: u.icon, name: u.name, desc: u.desc })));
            onStateChange(state);
        } else {
            announceLevel();
        }
    }
    // Runs after the card is picked, or straight away when there is nothing left to pick.
    function announceLevel() {
        if (level === FINAL_LEVEL) {
            spawnMonster('finalBoss');
            flashKind = 'final';
            levelFlash = 2.2;
            sfx('boss');
        } else if (level % 5 === 0) {
            spawnMonster('boss');
            flashKind = 'boss';
            levelFlash = 1.8;
            sfx('boss');
        } else {
            flashKind = 'level';
            flashLevel = level;
            levelFlash = 1.2;
        }
    }
    function chooseUpgrade(id) {
        if (state !== 'choosing') return;
        if (pendingChoices && !pendingChoices.some((u) => u.id === id)) return;
        grantUpgrade(id);
        pendingChoices = null;
        state = 'playing';
        sfx('card');
        announceLevel();
        // Enough xp for another level came in while the cards were open.
        if (xp >= xpToNext) gainXp(0);
        pushStats();
        pushCooldowns();
        onStateChange(state);
    }

    function gainXp(amount) {
        xp += amount;
        while (xp >= xpToNext) {
            xp -= xpToNext;
            applyLevelUp(true);
            if (state === 'choosing') break;
        }
    }

    function spawnMonster(forcedType) {
        const edge = Math.floor(Math.random() * 4);
        const type = forcedType || pickMonsterType(level);
        const def = MONSTER_TYPES[type];
        const r = def.r;
        let x, y;
        if (edge === 0) { x = Math.random() * W; y = -r; }
        else if (edge === 1) { x = W + r; y = Math.random() * H; }
        else if (edge === 2) { x = Math.random() * W; y = H + r; }
        else { x = -r; y = Math.random() * H; }
        const speed = (40 + Math.random() * 20 + level * 3) * def.speedMul;
        const maxHp = Math.round((20 + level * 6) * def.hpMul);
        const xpValue = type === 'boss' ? Math.round(xpToNext * 1.8) : 3 + level;
        // How far the run has climbed at the moment this one steps in, not its type:
        // the same slime looks tougher met at level 12 than at level 1. Boss sprites
        // are already their own thing and skip this (see drawMonsters).
        const tier = level >= 11 ? 2 : level >= 6 ? 1 : 0;
        monsters.push({
            x, y, r, speed, type, hp: maxHp, maxHp, xpValue, tier,
            flash: 0, phase: Math.random() * Math.PI * 2,
            chargeTimer: 3, charging: 0,
            kx: 0, ky: 0,
            // Stagger the first shot so a pair spawned together doesn't fire in lockstep.
            shootTimer: def.shoot ? 0.8 + Math.random() * def.shoot.interval : 0,
            starTimer: def.starAttack ? def.starAttack.interval : 0,
        });
    }

    function update(dt) {
        // The arrival banner freezes the arena the same way 'choosing' does below —
        // a real pause, independent of `state`, so it can't fight the run/menu logic
        // that already gates on `state !== 'choosing'` elsewhere.
        if (familiarAnnounce) {
            familiarAnnounce.t += dt;
            if (familiarAnnounce.t >= FAMILIAR_ANNOUNCE_DURATION) {
                familiarAnnounce = null;
                onFamiliarAnnounce(null);
            }
            return;
        }
        // 'choosing' freezes the arena: the cards are a real pause, not a soft one.
        if (state !== 'playing') return;
        elapsed += dt;
        const prevX = player.x;
        const prevY = player.y;

        let mvx = 0;
        let mvy = 0;
        if (stick) {
            mvx = stick.x;
            mvy = stick.y;
        } else {
            if (keys.left) mvx -= 1;
            if (keys.right) mvx += 1;
            if (keys.up) mvy -= 1;
            if (keys.down) mvy += 1;
            const len = Math.hypot(mvx, mvy);
            if (len > 0) {
                mvx /= len;
                mvy /= len;
            }
        }
        // Frozen by an ice bolt: input is read as normal above (so it resumes the
        // instant paralyzedUntil passes) but never turned into movement below.
        if ((mvx !== 0 || mvy !== 0) && elapsed >= player.paralyzedUntil) {
            const len = Math.hypot(mvx, mvy);
            player.facing = { x: mvx / len, y: mvy / len };
            player.x = clamp(player.x + mvx * tuning.speed * dt, player.r, W - player.r);
            player.y = clamp(player.y + mvy * tuning.speed * dt, player.r, H - player.r);
        }

        player.moving = player.x !== prevX || player.y !== prevY;
        if (player.moving) player.walkT += dt;

        if (spinning) {
            const turnedBefore = spinAngle;
            spinAngle += (TAU / tuning.spinDur) * dt;
            spinHitTimer -= dt;
            if (spinHitTimer <= 0) {
                meleeHit();
                spinHitTimer = tuning.spinDur;
            }
            if (!spinHeld && Math.floor(spinAngle / TAU) > Math.floor(turnedBefore / TAU)) {
                spinning = false;
                spinAngle = 0;
            }
        }
        ultCooldown = Math.max(0, ultCooldown - dt);
        levelFlash = Math.max(0, levelFlash - dt);
        screenFlash = Math.max(0, screenFlash - dt);
        hurtFlash = Math.max(0, hurtFlash - dt);
        shake = Math.max(0, shake - dt * 26);
        // The Colossus card's size/crush effect is a 5s burst, not a permanent change
        // — only the melee damage/range bonus it also grants sticks around after.
        if (player.giantTimer > 0) {
            player.giantTimer = Math.max(0, player.giantTimer - dt);
            if (player.giantTimer === 0) {
                player.giantScale = 1;
                player.r = 14;
            }
        }

        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.life -= dt;
            f.y -= 26 * dt;
            if (f.life <= 0) floaters.splice(i, 1);
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.life -= dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.94;
            pt.vy *= 0.94;
            if (pt.life <= 0) particles.splice(i, 1);
        }
        for (let i = hearts.length - 1; i >= 0; i--) {
            const h = hearts[i];
            h.life -= dt;
            if (h.life <= 0) {
                hearts.splice(i, 1);
                continue;
            }
            if (circlesOverlap(h.x, h.y, 12, player.x, player.y, player.r)) {
                const healed = Math.round(player.maxHp * 0.25);
                player.hp = Math.min(player.maxHp, player.hp + healed);
                floaters.push({ x: player.x, y: player.y - player.r - 6, text: `+${healed}`, life: 0.9, color: '#2ecc71' });
                hearts.splice(i, 1);
                sfx('heart');
            }
        }

        updateFamiliarVisit(dt);

        const finalFight = monsters.some((m) => m.type === 'finalBoss');
        const spawnInterval = Math.max(0.5, 1.6 - level * 0.08) * (finalFight ? 3.5 : bossAlive() ? 2 : 1);
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnMonster();
        }

        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            const def = MONSTER_TYPES[m.type];
            const dx = player.x - m.x;
            const dy = player.y - m.y;
            const dist = Math.hypot(dx, dy) || 1;
            let speedMul = 1;
            if (def.shoot) {
                m.shootTimer -= dt;
                if (dist < def.shoot.range && m.shootTimer <= 0) {
                    fireBolt(m, def.shoot);
                    m.shootTimer = def.shoot.interval;
                }
                // Inside its comfort zone it backs off instead of closing in.
                if (dist < def.shoot.standoff) speedMul = -0.5;
                else if (dist < def.shoot.range) speedMul = def.shoot.approach;
            }
            if (m.type === 'boss' || m.type === 'finalBoss') {
                m.chargeTimer -= dt;
                if (m.chargeTimer <= 0) {
                    m.charging = 0.5;
                    // The final boss recovers faster between charges — less breathing
                    // room than the regular boss gives.
                    m.chargeTimer = m.type === 'finalBoss' ? 2 : 3;
                    if (!reducedMotion) shake = Math.max(shake, 4);
                }
                if (m.charging > 0) {
                    m.charging -= dt;
                    speedMul = 3;
                    // The charge just ended this frame, so a shockwave lands where it
                    // stopped — no more standing still and trading hits once it's done
                    // closing the distance. Both bosses now get this, not just the
                    // regular one; triggerBossSlam scales it up for the final boss.
                    if (m.charging <= 0) triggerBossSlam(m);
                }
            }
            if (def.starAttack) {
                m.starTimer -= dt;
                if (m.starTimer <= 0) {
                    fireStarVolley(m, def.starAttack);
                    m.starTimer = def.starAttack.interval;
                }
            }
            m.x += (dx / dist) * m.speed * speedMul * dt;
            m.y += (dy / dist) * m.speed * speedMul * dt;
            if (m.kx !== 0 || m.ky !== 0) {
                m.x += m.kx * dt;
                m.y += m.ky * dt;
                const decay = Math.exp(-KNOCK_DECAY * dt);
                m.kx *= decay;
                m.ky *= decay;
                if (Math.abs(m.kx) < 2 && Math.abs(m.ky) < 2) {
                    m.kx = 0;
                    m.ky = 0;
                }
                // Never shove one so far out that it takes seconds to walk back in.
                m.x = clamp(m.x, -m.r * 2, W + m.r * 2);
                m.y = clamp(m.y, -m.r * 2, H + m.r * 2);
            }
            m.flash = Math.max(0, m.flash - dt);
            if (dist < player.r + m.r) {
                if (player.giantScale >= 4 && m.type !== 'boss' && m.type !== 'finalBoss') {
                    damageMonster(i, Math.max(m.hp, player.meleeDamage * 2));
                    if (!reducedMotion) shake = Math.max(shake, 3);
                    continue;
                }
                if (hurtPlayer(def.contactDamage || 10)) return;
            }
        }

        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
                bolts.splice(i, 1);
                continue;
            }
            if (circlesOverlap(b.x, b.y, b.r, player.x, player.y, player.r)) {
                bolts.splice(i, 1);
                // Read before hurtPlayer: a hit blocked by the invuln window still
                // returns false, so this is the only way to tell "landed" from "no-op".
                const landed = elapsed >= player.invulnUntil;
                if (hurtPlayer(b.damage)) return;
                if (b.ice && landed) applyParalysis(b.paralyzeDuration);
            }
        }

        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            ex.life -= dt;
            ex.r = ex.maxR * (1 - Math.max(0, ex.life) / ex.dur);
            if (ex.ult) {
                // The expanding ring hits each monster once as it sweeps past.
                for (let j = monsters.length - 1; j >= 0; j--) {
                    const m = monsters[j];
                    if (!ex.hit.has(m) && circlesOverlap(m.x, m.y, m.r, ex.x, ex.y, ex.r)) {
                        ex.hit.add(m);
                        burst(m.x, m.y, { a: FIRE_COLOR, b: FIRE_GLOW, c: '#fff3c4' }, reducedMotion ? 4 : 9);
                        damageMonster(j, player.fireDamage * 3);
                        hitsGiven++;
                    }
                }
                for (let j = bolts.length - 1; j >= 0; j--) {
                    if (Math.hypot(bolts[j].x - ex.x, bolts[j].y - ex.y) < ex.r) bolts.splice(j, 1);
                }
            } else if (ex.boss && !ex.hit && circlesOverlap(player.x, player.y, player.r, ex.x, ex.y, ex.r)) {
                ex.hit = true;
                if (hurtPlayer(ex.damage)) return;
            }
            if (ex.life <= 0) explosions.splice(i, 1);
        }

        pushStats();
        pushCooldowns();
    }

    // What the upgrade cards actually added up to by the end of the run — same
    // shape whether the run ended in victory or defeat, and whether or not it
    // beat the record.
    function finalStats() {
        return {
            meleeDamage: player.meleeDamage, fireDamage: player.fireDamage, maxHp: player.maxHp,
            speed: tuning.speed, meleeRange: tuning.meleeRange, spinDur: tuning.spinDur,
            knockback: tuning.knockback, ultCd: tuning.ultCd, heartChance: tuning.heartChance,
        };
    }
    function endRun(won) {
        state = won ? 'won' : 'over';
        if (won) {
            hasWon = true;
            writeFlag(WON_KEY, true);
        }
        spinning = false;
        spinHeld = false;
        spinAngle = 0;
        const stats = finalStats();
        if (level >= bestLevel) {
            bestLevel = level;
            writeBestLevel(bestLevel);
            writeBestRecord({ level, monstersKilled, time: Math.round(elapsed), hitsGiven, hitsReceived, finalStats: stats });
        }
        sfx(won ? 'win' : 'over');
        pushStats();
        onStateChange(state, {
            level, monstersKilled, best: bestLevel, time: Math.round(elapsed), won,
            hitsGiven, hitsReceived, finalStats: stats,
        });
    }
    function win() {
        endRun(true);
    }
    function gameOver() {
        endRun(false);
    }

    function drawSprite(rows, palette, cx, cy, cell, flipX, override) {
        paintSprite(ctx, rows, palette, cx, cy, cell, flipX, override);
    }

    function drawShadow(cx, cy, rx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, rx * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlayer(colors) {
        // Blink while invulnerable instead of drawing a box around the hero.
        if (elapsed < player.invulnUntil && Math.floor(elapsed * 20) % 2 === 0) return;
        const giantScale = player.giantScale || 1;
        const cell = 3 * giantScale;
        const frame = player.moving ? Math.floor(player.walkT * 8) % 2 : 0;
        const bob = player.moving ? (frame === 0 ? 0 : -1.5 * giantScale) : 0;
        const flip = player.facing.x < 0;
        const palette = Object.assign({ P: colors.accent, T: colors.accent }, HERO_PALETTE);

        drawShadow(player.x, player.y + 18 * giantScale, 12 * giantScale);

        // Frozen by an ice bolt: a pulsing ring, same visual language as the boss's
        // star-volley telegraph, so "you're locked out of input" reads at a glance.
        if (elapsed < player.paralyzedUntil) {
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(elapsed * 18);
            ctx.fillStyle = ICE_GLOW;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.r * 1.6, 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        // The build a run picks stays visible on the hero, not just on the results
        // screen: how far Forza/Lama lunga/Braci have been taken above their base
        // value (18, 44, 14) reads directly off player.meleeDamage/fireDamage and
        // tuning.meleeRange — the very same numbers finalStats() reports — instead
        // of a separate "which card was picked" tally. The blade itself keeps its
        // original fixed size — only its colour shifts hotter, from either melee
        // card, never its length.
        const meleeT = Math.max(
            clamp((player.meleeDamage - 18) / 40, 0, 1),
            clamp((tuning.meleeRange - baseTuning.meleeRange) / 40, 0, 1),
        );
        const bladeColor = meleeT > 0 ? blendHex(colors.blade, FIRE_COLOR, meleeT) : colors.blade;
        const bladeEdgeColor = meleeT > 0 ? blendHex(colors.bladeEdge, FIRE_GLOW, meleeT) : colors.bladeEdge;

        // A pulsing ember aura once at least one Braci card is in, same technique as
        // the ice-paralysis ring above — grows with fireDamage, absent on a build
        // that never took fire at all.
        const fireT = clamp((player.fireDamage - 14) / 30, 0, 1);
        if (fireT > 0) {
            ctx.save();
            ctx.globalAlpha = (0.18 + 0.12 * Math.sin(elapsed * 10)) * fireT;
            ctx.fillStyle = FIRE_GLOW;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, (player.r + 6 + fireT * 6) * giantScale, 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        // Sword: a full spin attack right after a melee press (hero and blade turn 360°
        // together, the blade leaving a circular trail); otherwise the sword rests along the
        // facing direction.
        const angle = Math.atan2(player.facing.y, player.facing.x);
        const swordAngle = spinning ? angle + spinAngle : angle + 0.35;
        if (spinning) {
            // A tail behind the blade: it grows over the first turn, then stays put, so
            // holding the action doesn't just paint a solid ring.
            const tail = Math.min(spinAngle, 1.8);
            ctx.save();
            ctx.strokeStyle = colors.inkSoft;
            ctx.lineWidth = 3 * giantScale;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, BLADE_TIP * giantScale, swordAngle - tail, swordAngle);
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.translate(player.x, player.y + bob);
        ctx.rotate(swordAngle);
        ctx.scale(giantScale, giantScale);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(BLADE_START - 3, -4, 3, 8);
        ctx.fillStyle = bladeColor;
        ctx.fillRect(BLADE_START, -1.5, BLADE_LEN, 3);
        ctx.fillStyle = bladeEdgeColor;
        ctx.fillRect(BLADE_START, -1.5, BLADE_LEN, 1);
        ctx.restore();

        if (spinning) {
            // The hero sprite turns together with the blade.
            ctx.save();
            ctx.translate(player.x, player.y + bob);
            ctx.rotate(spinAngle);
            drawSprite(HERO_FRAMES[frame], palette, 0, 0, cell, flip);
            ctx.restore();
            return;
        }
        drawSprite(HERO_FRAMES[frame], palette, player.x, player.y + bob, cell, flip);
    }

    function drawMonsters(colors) {
        monsters.forEach((m) => {
            const def = MONSTER_TYPES[m.type];
            const t = elapsed * 6 + m.phase;
            const override = m.flash > 0 ? colors.ink : null;
            let frame = 0;
            let sx = 1;
            let sy = 1;
            let dy = 0;
            if (m.type === 'slime') {
                sy = 1 + Math.sin(t) * 0.12;
                sx = 1 - Math.sin(t) * 0.08;
            } else if (m.type === 'imp') {
                dy = Math.sin(t * 1.3) * 2;
            } else if (m.type === 'bat') {
                frame = Math.floor(elapsed * 10 + m.phase) % 2;
                dy = Math.sin(t) * 3 - 4;
            } else if (m.type === 'sprungal') {
                // A new silhouette roughly every 1.2s, offset by its own spawn phase so a
                // pack of them never mutates in lockstep. Always thinner-and-taller than
                // its rest pose, on top of the frame swap, so it reads as filiform even
                // mid-mutation.
                frame = Math.floor(elapsed / 1.2 + m.phase) % def.frames.length;
                sx = 0.75 + Math.sin(t * 0.7) * 0.1;
                sy = 1.15 + Math.sin(t * 0.9 + 1) * 0.1;
            }
            if (m.type !== 'bat') drawShadow(m.x, m.y + m.r * 0.8, m.r * 0.9);
            // The telegraph before the final boss's star volley: a pulsing glow so the
            // ring of arrows about to come out reads as a warning, not a surprise.
            if (def.starAttack && m.starTimer > 0 && m.starTimer <= def.starAttack.telegraph) {
                ctx.save();
                ctx.globalAlpha = 0.35 + 0.35 * Math.sin(elapsed * 18);
                ctx.fillStyle = FIRE_GLOW;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r * 1.6, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
            // Boss sprites are already their own unique look; the tier tint is only for
            // the four regular monster types, so it can't be mistaken for a boss cue.
            const palette = m.tier && !def.starAttack && m.type !== 'boss' ? tintPalette(def.palette, m.type, m.tier) : def.palette;
            ctx.save();
            ctx.translate(m.x, m.y + dy);
            ctx.scale(sx, sy);
            drawSprite(def.frames[frame], palette, 0, 0, def.cell, m.x > player.x, override);
            ctx.restore();

            // Named on screen: the shapeshifter because its look won't hold still long
            // enough to recognise otherwise, the bosses because they're the two fights
            // worth calling out by name. Everything else is common enough, and stays
            // recognisable enough by its fixed silhouette, that a label would just be
            // clutter — especially with a handful of them on screen at once. Sits above
            // where the health bar goes, whether or not one is showing, so the two
            // never collide. Bosses reuse the same string as their health bar up top
            // (bossBar/finalBossBar) instead of a name of their own.
            if (m.type === 'sprungal' || m.type === 'boss' || m.type === 'finalBoss') {
                const label = m.type === 'sprungal' ? 'Sprungal' : m.type === 'boss' ? strings.bossBar : strings.finalBossBar;
                ctx.save();
                ctx.font = '600 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = colors.inkSoft;
                ctx.fillText(label, m.x, m.y - m.r - 20);
                ctx.restore();
            }

            if (m.hp < m.maxHp && m.type !== 'boss') {
                const bw = 22;
                const bx = m.x - bw / 2;
                const by = m.y - m.r - 9;
                ctx.fillStyle = colors.inkFaint;
                ctx.fillRect(bx, by, bw, 4);
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), 4);
                ctx.strokeStyle = colors.inkSoft;
                ctx.lineWidth = 1;
                ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 5);
            }
        });
    }

    // Cookie/May are noticeably bigger than the monster sprites they share a technique
    // with — this is a guest appearance, not another thing trying to blend into the
    // swarm — and a little bounce while barking is the only animation either needs.
    const FAMILIAR_CELL = 4.2;
    function drawFamiliar(colors) {
        const v = familiarVisit;
        if (!v) return;
        const frame = v.kind === 'cookie' ? DOG_FRAME : MAY_FRAME;
        const palette = v.kind === 'cookie' ? COOKIE_PALETTE : MAY_PALETTE;
        const barking = v.phase === 'act' && v.t < 0.35;
        const bounce = barking ? Math.abs(Math.sin(v.t * 26)) * 4 : 0;
        const movingLeft = v.phase === 'leave' ? v.fromX < v.restX : v.restX < v.fromX;
        drawShadow(v.x, v.y + 16, 16);
        // While the arrival banner is up (update() has the arena frozen for it), a
        // pulsing halo behind the sprite is the "own visual effect" for the moment —
        // distinct from the sharp screenFlash the bark itself throws a beat later.
        if (familiarAnnounce && familiarAnnounce.kind === v.kind) {
            const pulse = 0.5 + 0.5 * Math.sin(familiarAnnounce.t * 4);
            ctx.save();
            ctx.globalAlpha = 0.25 + pulse * 0.25;
            ctx.fillStyle = palette.glow;
            ctx.beginPath();
            ctx.arc(v.x, v.y, 26 + pulse * 8, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        drawSprite(frame, palette, v.x, v.y - bounce, FAMILIAR_CELL, movingLeft);
    }

    function drawBolts() {
        bolts.forEach((b) => {
            // The final boss's star volley reads warm (fire), the sprungal's ice bolts
            // read cold (pale blue) — never the caster's magenta, so none of the three
            // gets mistaken for another mid-dodge.
            const color = b.ice ? ICE_COLOR : b.fireArrow ? FIRE_COLOR : BOLT_COLOR;
            const glow = b.ice ? ICE_GLOW : b.fireArrow ? FIRE_GLOW : BOLT_GLOW;
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(b.x - b.vx * 0.004, b.y - b.vy * 0.004, b.r * 0.5, 0, TAU);
            ctx.fill();
            ctx.restore();
        });
    }

    // One glowing ring of fire, `progress` (0..1) of the way from the origin to the
    // arena's edge. Used twice per fireball, a beat apart, so the blast reads as two
    // waves chasing each other out to every corner — not just a bright spot at the
    // player's feet.
    function drawFireRing(cx, cy, maxR, progress, widthScale, alpha) {
        if (progress <= 0) return;
        const r = progress * maxR;
        ctx.save();
        ctx.globalAlpha = alpha * (1 - progress * 0.15);
        const grad = ctx.createRadialGradient(cx, cy, Math.max(0, r - 22), cx, cy, r + 6);
        grad.addColorStop(0, 'rgba(230, 126, 34, 0)');
        grad.addColorStop(0.55, 'rgba(249, 202, 36, 0.55)');
        grad.addColorStop(0.85, 'rgba(255, 243, 196, 0.9)');
        grad.addColorStop(1, 'rgba(230, 126, 34, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 14 * widthScale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }

    function drawExplosions(colors) {
        explosions.forEach((ex) => {
            const a = Math.max(0, ex.life / ex.dur);   // 1 at the blast, 0 when spent
            const seed = ex.seed || 0;
            if (ex.boss) {
                // The ogre's shockwave: a plain impact ring in the theme's ink, never
                // fire-coloured — it must never be mistaken for the player's own blast.
                ctx.save();
                ctx.globalAlpha = a * 0.8;
                ctx.strokeStyle = colors.ink;
                ctx.lineWidth = 3 * a + 1;
                ctx.beginPath();
                ctx.arc(ex.x, ex.y, ex.r, 0, TAU);
                ctx.stroke();
                ctx.restore();
                return;
            }
            // Two rings racing out to the arena's edge, tied to the very radius that
            // decides the actual hit — what you see is exactly what the blast reaches.
            const p1 = 1 - Math.max(0, ex.life) / ex.dur;
            const p2 = Math.max(0, p1 - 0.15);
            drawFireRing(ex.x, ex.y, ex.maxR, p1, 1, a);
            drawFireRing(ex.x, ex.y, ex.maxR, p2, 0.7, a);
            // A fireball, not a travelling hoop: it swells fast, then burns down. The
            // damage still sweeps the whole arena — you see it in the monsters popping
            // as the wave reaches them, which reads far better than a geometric circle.
            const br = 34 + (ex.maxR * 0.24 - 34) * (1 - a * a);
            ctx.save();

            const ball = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, br);
            ball.addColorStop(0, `rgba(255, 255, 245, ${0.95 * a})`);
            ball.addColorStop(0.35, `rgba(249, 202, 36, ${0.85 * a})`);
            ball.addColorStop(0.75, `rgba(230, 126, 34, ${0.6 * a})`);
            ball.addColorStop(1, 'rgba(192, 57, 43, 0)');
            ctx.fillStyle = ball;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, br, 0, TAU);
            ctx.fill();

            // Billows filling the ball, at scattered angles and depths. A smooth
            // function here (a sine of the angle) leaves a visible three-lobed flower;
            // a hash does not, and fire has no symmetry.
            const lobes = reducedMotion ? 10 : 22;
            const hash = (n) => {
                const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
                return v - Math.floor(v);
            };
            for (let i = 0; i < lobes; i++) {
                const ang = (i / lobes) * TAU + hash(i) * 0.5 + (1 - a) * 0.6;
                const rr = br * (0.3 + 0.65 * hash(i + 40));
                const size = br * (0.16 + 0.16 * hash(i + 90));
                ctx.globalAlpha = a * 0.8;
                const pick = hash(i + 7);
                ctx.fillStyle = pick > 0.72 ? '#fff3c4' : pick > 0.4 ? FIRE_GLOW : FIRE_COLOR;
                ctx.beginPath();
                ctx.arc(ex.x + Math.cos(ang) * rr, ex.y + Math.sin(ang) * rr, size, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    function drawLevelFlash(colors) {
        if (levelFlash <= 0) return;
        const isBoss = flashKind === 'boss' || flashKind === 'final';
        const flashText = flashKind === 'final' ? strings.finalBoss
            : flashKind === 'boss' ? strings.boss
            : typeof strings.level === 'function' ? strings.level(flashLevel) : `Level ${flashLevel}!`;
        ctx.fillStyle = isBoss ? '#e74c3c' : colors.text;
        ctx.textAlign = 'center';
        ctx.font = `700 ${isBoss ? 28 : 20}px system-ui, sans-serif`;
        ctx.globalAlpha = Math.min(1, levelFlash);
        ctx.fillText(flashText, W / 2, H / 2 - 40);
        ctx.globalAlpha = 1;
    }

    function drawHearts() {
        hearts.forEach((h) => {
            // Blink out the last two seconds, so a heart never vanishes unannounced.
            if (h.life < 2 && Math.floor(h.life * 8) % 2 === 0) return;
            paintSprite(ctx, HEART_FRAME, HEART_PALETTE, h.x, h.y, 2.4);
        });
    }
    function drawFloaters() {
        ctx.textAlign = 'center';
        ctx.font = '700 13px system-ui, sans-serif';
        floaters.forEach((f) => {
            ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        });
        ctx.globalAlpha = 1;
    }
    function drawParticles() {
        particles.forEach((pt) => {
            ctx.globalAlpha = Math.max(0, pt.life / pt.dur);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        });
        ctx.globalAlpha = 1;
    }
    function drawBossBar(colors) {
        const boss = monsters.find((m) => m.type === 'boss' || m.type === 'finalBoss');
        if (!boss) return;
        const isFinal = boss.type === 'finalBoss';
        const bw = Math.min(280, W - 40);
        const bx = (W - bw) / 2;
        const by = 12;
        ctx.fillStyle = colors.inkFaint;
        ctx.fillRect(bx, by, bw, 8);
        ctx.fillStyle = isFinal ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 8);
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(isFinal ? strings.finalBossBar : strings.bossBar, W / 2, by + 22);
    }

    function draw() {
        const colors = themeColors();
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, W, H);
        // Everything inside the arena shakes together; the HUD drawn after does not.
        const shaking = shake > 0 && state === 'playing';
        const sx = shaking ? (Math.random() - 0.5) * shake : 0;
        const sy = shaking ? (Math.random() - 0.5) * shake : 0;
        ctx.save();
        ctx.translate(sx, sy);
        drawHearts();
        drawMonsters(colors);
        drawFamiliar(colors);
        drawBolts();
        drawExplosions(colors);
        drawParticles();
        if (state !== 'over' && state !== 'won') drawPlayer(colors);
        drawFloaters();
        ctx.restore();
        if (screenFlash > 0) {
            ctx.fillStyle = `rgba(249, 202, 36, ${(screenFlash / 0.22) * 0.16})`;
            ctx.fillRect(0, 0, W, H);
        }
        if (hurtFlash > 0) {
            // A red rim rather than a full wash: it reads as "you took that" without
            // hiding the arena at the exact moment you need to see it.
            const a = (hurtFlash / 0.45) * 0.5;
            const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.62);
            grad.addColorStop(0, 'rgba(231, 76, 60, 0)');
            grad.addColorStop(1, `rgba(231, 76, 60, ${a})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }
        drawBossBar(colors);
        drawLevelFlash(colors);

        if (state === 'ready') {
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'center';
            ctx.font = '600 15px system-ui, sans-serif';
            ctx.fillText(strings.start, W / 2, H / 2);
        }
    }

    function loop(time) {
        if (lastTime === null) lastTime = time;
        const dt = reducedMotion ? 1 / 30 : Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;
        update(dt);
        draw();
        rafId = requestAnimationFrame(loop);
    }

    draw();
    rafId = requestAnimationFrame(loop);

    return {
        start,
        meleeAttack() {
            if (state === 'playing') meleeAttack();
            else if (state !== 'choosing') start();
        },
        meleeRelease,
        ultimateAttack() {
            if (state === 'playing') ultimateAttack();
            else if (state !== 'choosing') start();
        },
        chooseUpgrade,
        resize,
        // The page's stick hands the direction over here: -1..1 per axis, or null on
        // release. Everything downstream (speed, facing, the walk cycle) is unchanged.
        setStick(x, y) {
            if (x === null || x === undefined) {
                stick = null;
                return;
            }
            const len = Math.hypot(x, y);
            if (len < 0.001) {
                stick = null;
                return;
            }
            const mag = Math.min(1, len);
            stick = { x: (x / len) * mag, y: (y / len) * mag };
        },
        setStrings(next) {
            strings = Object.assign({}, DEFAULT_STRINGS, next || {});
        },
        isMuted() {
            return muted;
        },
        setMuted(value) {
            muted = !!value;
            writeFlag(MUTE_KEY, muted);
            return muted;
        },
        hasWon() {
            return hasWon;
        },
        // The record only, not the separate "won at least once" star (WON_KEY) —
        // that's its own achievement, not part of the stat record.
        resetRecord() {
            bestLevel = 1;
            writeBestLevel(bestLevel);
            writeBestRecord(null);
            pushStats();
        },
        finalLevel: FINAL_LEVEL,
        destroy() {
            if (rafId) cancelAnimationFrame(rafId);
            stopMusic();
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            canvas.removeEventListener('pointerdown', handlePointerDown);
        },
    };
}
