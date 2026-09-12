const BEST_LEVEL_KEY = 'emberKeepBestLevel';
const WON_KEY = 'emberKeepWon';
const MUTE_KEY = 'emberKeepMuted';
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
const KNOCKBACK = 320;   // px/s shove a sword hit gives a monster
const KNOCK_DECAY = 6;   // how quickly that shove dies down
const HEART_PALETTE = { h: '#e74c3c', H: '#ff7675' };
const HEART_FRAME = [
    '.hh...hh.',
    'hhhhhhhhh',
    'hHhhhhhhh',
    'hhhhhhhhh',
    '.hhhhhhh.',
    '..hhhhh..',
    '...hhh...',
    '....h....',
];

// Pixel-art sprites drawn with fillRect on a small grid — same technique as
// the Triple Triad icon, so no external image assets. '.' is transparent.
const HERO_PALETTE = {
    H: '#2c3e50', S: '#f1c27d', E: '#1a1a1a', B: '#5d4037',
    L: '#34495e', O: '#2c3e50', D: '#8d6e63', M: '#bdc3c7',
};
const HERO_FRAMES = [
    [
        '...PHHH...',
        '..HHHHHH..',
        '..HSSSSH..',
        '..HSESES..',
        '...SSSS...',
        '.DTTTTTT..',
        'DMTTTTTTS.',
        'DMTTTTTT..',
        '.DBBBBBB..',
        '..LL.LL...',
        '..LL.LL...',
        '.OOO.OOO..',
    ],
    [
        '...PHHH...',
        '..HHHHHH..',
        '..HSSSSH..',
        '..HSESES..',
        '...SSSS...',
        '.DTTTTTT..',
        'DMTTTTTTS.',
        'DMTTTTTT..',
        '.DBBBBBB..',
        '..LL..LL..',
        '.LL....LL.',
        'OOO....OOO',
    ],
];

const MONSTER_TYPES = {
    slime: {
        palette: { A: '#2ecc71', a: '#27ae60', E: '#ffffff', p: '#1a1a1a', M: '#1a1a1a' },
        frames: [[
            '...AAAA...',
            '..AAAAAA..',
            '.AAEAAEAA.',
            '.AApAApAA.',
            'AAAAAAAAAA',
            'AAAAMMAAAA',
            'aAAAAAAAAa',
            '.aaaaaaaa.',
        ]],
        cell: 2.6, r: 13, speedMul: 1, hpMul: 1, weight: 5, minLevel: 1, knockMul: 1,
    },
    imp: {
        palette: { A: '#c0392b', a: '#7b241c', E: '#ffffff', p: '#1a1a1a', M: '#f1c40f' },
        frames: [[
            '.a......a.',
            '..a....a..',
            '..AAAAAA..',
            '.AAEAAEAA.',
            '.AApAApAA.',
            '.AAAMMAAA.',
            '..AAAAAA..',
            '...AAAA...',
            '..A....A..',
            '.a......a.',
        ]],
        cell: 2.6, r: 12, speedMul: 1.15, hpMul: 0.85, weight: 3, minLevel: 1, knockMul: 1.1,
    },
    bat: {
        palette: { A: '#8e44ad', a: '#5b2c6f', E: '#ffffff', p: '#e74c3c' },
        frames: [
            [
                'a..........a',
                'aa...AA...aa',
                '.aa.AAAA.aa.',
                '..aaAEEAaa..',
                '....AppA....',
                '....AAAA....',
                '....A..A....',
            ],
            [
                '............',
                '.....AA.....',
                '....AAAA....',
                'aaaaAEEAaaaa',
                '.aaaAppAaaa.',
                '....AAAA....',
                '....A..A....',
            ],
        ],
        cell: 2.4, r: 11, speedMul: 1.5, hpMul: 0.6, weight: 2, minLevel: 2, knockMul: 1.35,
    },
    // Keeps its distance and throws bolts, so standing still stops being an option.
    caster: {
        // Eyes and staff orb use the dimmer purple: the bright BOLT_GLOW belongs to a
        // bolt in flight alone, so what is travelling towards you always reads brightest.
        palette: { C: '#2980b9', c: '#1b4f72', A: '#0b1a2a', p: '#9b59b6', S: '#8d6e63', O: '#9b59b6' },
        frames: [[
            '...cCCc...',
            '..cCCCCc.O',
            '..cAAAAc.S',
            '..cApApc.S',
            '..cCCCCc.S',
            '.cCCCCCCcS',
            '.cCCCCCCcS',
            '.cCCCCCCc.',
            '..cCCCCc..',
            '...c..c...',
        ]],
        cell: 2.6, r: 12, speedMul: 0.85, hpMul: 0.8, weight: 3, minLevel: 3, knockMul: 1.2,
        // range covers most of the arena: a shooter that has to walk into view first just
        // loiters at the edge instead of putting the player under pressure.
        shoot: { interval: 1.8, speed: 165, damage: 12, range: 420, standoff: 170, approach: 0.6 },
    },
    // Neither boss is ever picked by the random spawn (weight 0): both are summoned
    // explicitly, the ogre every 5 levels and the warlord once, at FINAL_LEVEL.
    finalBoss: {
        palette: { A: '#7b241c', a: '#4a1410', E: '#ffffff', p: '#f1c40f', C: '#f1c40f', T: '#dfe6e9', K: '#2c3e50' },
        frames: [[
            '..C..C....C..C..',
            '..CCCCCCCCCCCC..',
            '...AAAAAAAAAA...',
            '..AAAAAAAAAAAA..',
            '..AAEEAAAAEEAA..',
            '..AAppAAAAppAA..',
            '..AAAAAAAAAAAA..',
            '..AAATTTTTTAAA..',
            '.aAAAAAAAAAAAAa.',
            'aAAAAAAAAAAAAAAa',
            'aAAAAKKKKKKAAAAa',
            'aAAAAKKKKKKAAAAa',
            '.aAAAAAAAAAAAAa.',
            '..aAAAAAAAAAAa..',
            '...aa......aa...',
            '..aaa......aaa..',
        ]],
        cell: 3.4, r: 32, speedMul: 0.5, hpMul: 19, weight: 0, minLevel: Infinity, contactDamage: 32, knockMul: 0.07,
    },
    boss: {
        palette: { A: '#556b2f', a: '#2f3f1a', E: '#ffffff', p: '#c0392b', C: '#f1c40f', T: '#dfe6e9' },
        frames: [[
            '....C..C..C...',
            '....CCCCCC....',
            '...AAAAAAAA...',
            '..AAAAAAAAAA..',
            '..AEEAAAAEEA..',
            '..AppAAAAppA..',
            '..AAAAAAAAAA..',
            '..AAATAATAAA..',
            '.aAAAAAAAAAAa.',
            '.aAAAAAAAAAAa.',
            '..aAAAAAAAAa..',
            '...aAAAAAAa...',
            '...aa....aa...',
            '..aaa....aaa..',
        ]],
        cell: 3.6, r: 26, speedMul: 0.55, hpMul: 12, weight: 0, minLevel: Infinity, contactDamage: 25, knockMul: 0.12,
    },
};

// Paints one sprite grid. Module level so the arena and the legend under it draw the
// very same art instead of keeping two copies that drift apart.
function paintSprite(ctx, rows, palette, cx, cy, cell, flipX, override) {
    const w = rows[0].length * cell;
    const h = rows.length * cell;
    ctx.save();
    ctx.translate(cx, cy);
    if (flipX) ctx.scale(-1, 1);
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            const ch = rows[r][c];
            if (ch === '.') continue;
            ctx.fillStyle = override || palette[ch];
            // +0.3 overlap hides hairline seams between cells at fractional scales.
            ctx.fillRect(-w / 2 + c * cell, -h / 2 + r * cell, cell + 0.3, cell + 0.3);
        }
    }
    ctx.restore();
}

// Draws one arena sprite into a small standalone canvas, for the legend on the page.
// key is 'hero' or any MONSTER_TYPES key.
export function drawArenaIcon(canvas, key, size = 44) {
    const hero = key === 'hero';
    const heart = key === 'heart';
    const def = hero || heart ? null : MONSTER_TYPES[key];
    if (!hero && !heart && !def) return;
    const rows = hero ? HERO_FRAMES[0] : heart ? HEART_FRAME : def.frames[0];
    const palette = hero
        ? Object.assign({ P: themeColors().accent, T: themeColors().accent }, HERO_PALETTE)
        : heart ? HEART_PALETTE : def.palette;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Fit the grid in the box with a little air around it.
    const cell = Math.min(size / rows[0].length, size / rows.length) * 0.88;
    paintSprite(ctx, rows, palette, size / 2, size / 2, cell);
}

// Level-up cards. Every point of growth comes from one of these, so two runs are
// never the same. `apply` mutates the run's player and tuning in place.
// Text the arena draws on itself. English defaults; the page hands over its own
// translations and re-sends them when the visitor switches language, so the canvas
// never ends up speaking a different language than the page around it.
const DEFAULT_STRINGS = {
    start: 'Tap or press Space to start',
    level: (n) => `Level ${n}!`,
    boss: 'Boss!',
    finalBoss: 'Final boss!',
    bossBar: 'Boss',
    finalBossBar: 'Final boss',
};

const UPGRADES = [
    {
        id: 'strength', icon: '💪', max: 5,
        name: { it: 'Forza', en: 'Strength' },
        desc: { it: 'La spada fa più male.', en: 'The sword hits harder.' },
        apply: (p) => { p.player.meleeDamage += 7; },
    },
    {
        id: 'blade', icon: '⚔️', max: 3,
        name: { it: 'Lama lunga', en: 'Long blade' },
        desc: { it: 'Colpisci da più lontano.', en: 'Reach further out.' },
        apply: (p) => { p.tuning.meleeRange += 11; },
    },
    {
        id: 'fury', icon: '🌀', max: 3,
        name: { it: 'Furia', en: 'Fury' },
        desc: { it: 'Giri più in fretta, colpisci più spesso.', en: 'Spin faster, hit more often.' },
        apply: (p) => { p.tuning.spinDur *= 0.82; },
    },
    {
        id: 'shove', icon: '👊', max: 3,
        name: { it: 'Spinta', en: 'Shove' },
        desc: { it: 'I mostri volano via più lontano.', en: 'Monsters fly further back.' },
        apply: (p) => { p.tuning.knockback *= 1.4; },
    },
    {
        id: 'ember', icon: '🔥', max: 5,
        name: { it: 'Braci', en: 'Embers' },
        desc: { it: 'La tempesta di fuoco brucia di più.', en: 'The firestorm burns hotter.' },
        apply: (p) => { p.player.fireDamage += 6; },
    },
    {
        id: 'storm', icon: '⏱️', max: 3,
        name: { it: 'Tempesta rapida', en: 'Quick storm' },
        desc: { it: 'Ricarica la tempesta prima.', en: 'The firestorm comes back sooner.' },
        apply: (p) => { p.tuning.ultCd = Math.max(3, p.tuning.ultCd - 1.6); },
    },
    {
        id: 'vigor', icon: '❤️', max: 5,
        name: { it: 'Vigore', en: 'Vigour' },
        desc: { it: 'Più vita massima, e te la dà subito.', en: 'More max health, granted at once.' },
        apply: (p) => { p.player.maxHp += 30; p.player.hp = Math.min(p.player.maxHp, p.player.hp + 30); },
    },
    {
        id: 'boots', icon: '👢', max: 3,
        name: { it: 'Passo svelto', en: 'Swift boots' },
        desc: { it: 'Ti muovi più veloce: schivi meglio.', en: 'Move faster, dodge better.' },
        apply: (p) => { p.tuning.speed += 20; },
    },
    {
        id: 'luck', icon: '🍀', max: 3,
        name: { it: 'Fortuna', en: 'Fortune' },
        desc: { it: 'I mostri lasciano cuori più spesso.', en: 'Monsters drop hearts more often.' },
        apply: (p) => { p.tuning.heartChance += 0.09; },
    },
];

function readFlag(key) {
    try {
        return localStorage.getItem(key) === '1';
    } catch (e) {
        return false;
    }
}
function writeFlag(key, value) {
    try {
        localStorage.setItem(key, value ? '1' : '0');
    } catch (e) {}
}

// Sound is synthesised, same approach as mascot.js: no files to load, and the
// AudioContext is only created once something actually asks for a sound — which
// can't happen before the player presses start.
let audioCtx = null;
function getAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function chirp({ from, to, duration, type = 'square', gain = 0.05, delay = 0 }) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
    vol.gain.setValueAtTime(gain, t0);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
}
function noiseBurst(duration, gain, filterFreq) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const vol = ctx.createGain();
    vol.gain.value = gain;
    src.connect(filter).connect(vol).connect(ctx.destination);
    src.start();
}

function pickMonsterType(level) {
    const pool = Object.keys(MONSTER_TYPES).filter((k) => MONSTER_TYPES[k].weight > 0 && MONSTER_TYPES[k].minLevel <= level);
    const total = pool.reduce((s, k) => s + MONSTER_TYPES[k].weight, 0);
    let roll = Math.random() * total;
    for (const k of pool) {
        roll -= MONSTER_TYPES[k].weight;
        if (roll <= 0) return k;
    }
    return pool[0];
}

function readBestLevel() {
    try {
        return parseInt(localStorage.getItem(BEST_LEVEL_KEY), 10) || 1;
    } catch (e) {
        return 1;
    }
}
function writeBestLevel(level) {
    try {
        localStorage.setItem(BEST_LEVEL_KEY, String(level));
    } catch (e) {}
}

// Rough perceived brightness of a CSS colour, enough to tell a light theme from a
// dark one without pulling in a colour library.
function isLight(color) {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim());
    if (!hex) return false;
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}
function themeColors() {
    const style = getComputedStyle(document.documentElement);
    const bg = style.getPropertyValue('--bg').trim() || '#101014';
    const light = isLight(bg);
    return {
        bg,
        light,
        text: style.getPropertyValue('--text').trim() || '#f2f2f5',
        textMuted: style.getPropertyValue('--text-muted').trim() || '#a3a3ad',
        accent: style.getPropertyValue('--accent').trim() || '#0d9488',
        // Ink is whatever stands out against the arena floor: everything that used to
        // be hardcoded white now asks for this instead.
        ink: light ? '#1a1a1a' : '#ffffff',
        inkSoft: light ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.55)',
        inkFaint: light ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)',
        blade: light ? '#5f6b76' : '#dfe6e9',
        bladeEdge: light ? '#2f3a44' : '#ffffff',
    };
}

export function initEmberArena(canvas, opts) {
    const options = opts || {};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const player = {
        x: W / 2,
        y: H / 2,
        r: 14,
        facing: { x: 1, y: 0 },
        maxHp: 100,
        hp: 100,
        invulnUntil: 0,
        meleeDamage: 18,
        fireDamage: 14,
        moving: false,
        walkT: 0,
    };
    const keys = { up: false, down: false, left: false, right: false };
    // Fixed analog stick in the bottom-left corner: always drawn, engaged by a
    // pointer landing near it, and it follows only that pointer afterwards.
    let joystick = null;
    const JOY_RADIUS = 40;
    const JOY_DEAD = 8;
    const JOY_BASE = { x: 72, y: H - 72 };
    const JOY_GRAB = JOY_RADIUS * 2;
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
    let level = 1;
    let xp = 0;
    let xpToNext = 6;
    let monstersKilled = 0;
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
        player.maxHp = 100;
        player.hp = 100;
        player.invulnUntil = 0;
        player.meleeDamage = 18;
        player.fireDamage = 14;
        monsters = [];
        explosions = [];
        bolts = [];
        hearts = [];
        floaters = [];
        particles = [];
        tuning = Object.assign({}, baseTuning);
        taken = {};
        pendingChoices = null;
        level = 1;
        xp = 0;
        xpToNext = 6;
        monstersKilled = 0;
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
        joystick = null;
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
        onStateChange(state);
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

    function pointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (W / rect.width),
            y: (clientY - rect.top) * (H / rect.height),
        };
    }
    function handlePointerDown(e) {
        if (state !== 'playing') {
            // 'choosing' is a pause with the cards open: a tap must not throw the run away.
            if (state !== 'choosing') start();
            return;
        }
        if (joystick) return;
        const p = pointerPos(e);
        if (Math.hypot(p.x - JOY_BASE.x, p.y - JOY_BASE.y) > JOY_GRAB) return;
        joystick = { id: e.pointerId, ox: JOY_BASE.x, oy: JOY_BASE.y, x: p.x, y: p.y };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
    }
    function handlePointerMove(e) {
        if (!joystick || e.pointerId !== joystick.id) return;
        const p = pointerPos(e);
        joystick.x = p.x;
        joystick.y = p.y;
        e.preventDefault();
    }
    function handlePointerUp(e) {
        if (joystick && e.pointerId === joystick.id) joystick = null;
    }
    // Direction vector (-1..1 per axis, magnitude ≤ 1) from the stick, or null inside the dead zone.
    function joystickVector() {
        if (!joystick) return null;
        const dx = joystick.x - joystick.ox;
        const dy = joystick.y - joystick.oy;
        const len = Math.hypot(dx, dy);
        if (len < JOY_DEAD) return null;
        const mag = Math.min(1, len / JOY_RADIUS);
        return { x: (dx / len) * mag, y: (dy / len) * mag };
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    function ultimateAttack() {
        if (ultCooldown > 0) return;
        ultCooldown = tuning.ultCd;
        screenFlash = 0.25;
        sfx('storm');
        if (!reducedMotion) shake = Math.max(shake, 5);
        explosions.push({
            x: player.x, y: player.y, r: 0,
            maxR: Math.hypot(W, H), life: ULT_DUR, dur: ULT_DUR,
            ult: true, hit: new Set(),
        });
    }
    // Press: start turning and land a hit at once. Hold: keep turning, one hit per
    // turn. Release: stop once the turn in progress completes, so a tap is one spin.
    function meleeAttack() {
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
        });
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
    function hurtPlayer(amount) {
        if (state !== 'playing') return false;
        if (elapsed < player.invulnUntil) return false;
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
    function availableUpgrades() {
        return UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
    }
    function grantUpgrade(id) {
        const up = UPGRADES.find((u) => u.id === id);
        if (!up) return false;
        up.apply({ player, tuning });
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
        monsters.push({
            x, y, r, speed, type, hp: maxHp, maxHp, xpValue,
            flash: 0, phase: Math.random() * Math.PI * 2,
            chargeTimer: 3, charging: 0,
            kx: 0, ky: 0,
            // Stagger the first shot so a pair spawned together doesn't fire in lockstep.
            shootTimer: def.shoot ? 0.8 + Math.random() * def.shoot.interval : 0,
        });
    }

    function update(dt) {
        // 'choosing' freezes the arena: the cards are a real pause, not a soft one.
        if (state !== 'playing') return;
        elapsed += dt;
        const prevX = player.x;
        const prevY = player.y;

        let mvx = 0;
        let mvy = 0;
        const joy = joystickVector();
        if (joy) {
            mvx = joy.x;
            mvy = joy.y;
        } else if (!joystick) {
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
        if (mvx !== 0 || mvy !== 0) {
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
            if (Math.hypot(h.x - player.x, h.y - player.y) < player.r + 12) {
                const healed = Math.round(player.maxHp * 0.25);
                player.hp = Math.min(player.maxHp, player.hp + healed);
                floaters.push({ x: player.x, y: player.y - player.r - 6, text: `+${healed}`, life: 0.9, color: '#2ecc71' });
                hearts.splice(i, 1);
                sfx('heart');
            }
        }

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
                    m.chargeTimer = 3;
                    if (!reducedMotion) shake = Math.max(shake, 4);
                }
                if (m.charging > 0) {
                    m.charging -= dt;
                    speedMul = 3;
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
            if (dist < player.r + m.r && hurtPlayer(def.contactDamage || 10)) return;
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
            if (Math.hypot(b.x - player.x, b.y - player.y) < player.r + b.r) {
                bolts.splice(i, 1);
                if (hurtPlayer(b.damage)) return;
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
                    if (!ex.hit.has(m) && Math.hypot(m.x - ex.x, m.y - ex.y) < ex.r + m.r) {
                        ex.hit.add(m);
                        damageMonster(j, player.fireDamage * 3);
                    }
                }
                for (let j = bolts.length - 1; j >= 0; j--) {
                    if (Math.hypot(bolts[j].x - ex.x, bolts[j].y - ex.y) < ex.r) bolts.splice(j, 1);
                }
            }
            if (ex.life <= 0) explosions.splice(i, 1);
        }

        pushStats();
        pushCooldowns();
    }

    function win() {
        state = 'won';
        hasWon = true;
        writeFlag(WON_KEY, true);
        if (level >= bestLevel) {
            bestLevel = level;
            writeBestLevel(bestLevel);
        }
        spinning = false;
        spinHeld = false;
        sfx('win');
        pushStats();
        onStateChange(state, { level, monstersKilled, best: bestLevel, time: Math.round(elapsed), won: true });
    }
    function gameOver() {
        state = 'over';
        spinning = false;
        spinHeld = false;
        spinAngle = 0;
        if (level >= bestLevel) {
            bestLevel = level;
            writeBestLevel(bestLevel);
        }
        sfx('over');
        pushStats();
        onStateChange(state, { level, monstersKilled, best: bestLevel, time: Math.round(elapsed), won: false });
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
        const cell = 3;
        const frame = player.moving ? Math.floor(player.walkT * 8) % 2 : 0;
        const bob = player.moving ? (frame === 0 ? 0 : -1.5) : 0;
        const flip = player.facing.x < 0;
        const palette = Object.assign({ P: colors.accent, T: colors.accent }, HERO_PALETTE);

        drawShadow(player.x, player.y + 18, 12);

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
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, 30, swordAngle - tail, swordAngle);
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.translate(player.x, player.y + bob);
        ctx.rotate(swordAngle);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(8, -4, 3, 8);
        ctx.fillStyle = colors.blade;
        ctx.fillRect(11, -1.5, 17, 3);
        ctx.fillStyle = colors.bladeEdge;
        ctx.fillRect(11, -1.5, 17, 1);
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
            }
            if (m.type !== 'bat') drawShadow(m.x, m.y + m.r * 0.8, m.r * 0.9);
            ctx.save();
            ctx.translate(m.x, m.y + dy);
            ctx.scale(sx, sy);
            drawSprite(def.frames[frame], def.palette, 0, 0, def.cell, m.x > player.x, override);
            ctx.restore();

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

    function drawBolts() {
        bolts.forEach((b) => {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = BOLT_GLOW;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = BOLT_COLOR;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = BOLT_GLOW;
            ctx.beginPath();
            ctx.arc(b.x - b.vx * 0.004, b.y - b.vy * 0.004, b.r * 0.5, 0, TAU);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawExplosions() {
        explosions.forEach((ex) => {
            const a = Math.max(0, ex.life / ex.dur);
            ctx.globalAlpha = a * 0.35;
            ctx.fillStyle = FIRE_GLOW;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = a;
            ctx.strokeStyle = FIRE_COLOR;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
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

    function drawJoystick() {
        // The knob mirrors whatever is steering: the finger, or the arrow keys.
        let v = joystickVector();
        if (!v && !joystick) {
            const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            const ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
            const len = Math.hypot(kx, ky);
            if (len > 0) v = { x: kx / len, y: ky / len };
        }
        const active = !!joystick;
        const kx = JOY_BASE.x + (v ? v.x * JOY_RADIUS : 0);
        const ky = JOY_BASE.y + (v ? v.y * JOY_RADIUS : 0);
        ctx.save();
        const jc = themeColors();
        ctx.globalAlpha = active ? 0.45 : 0.22;
        ctx.fillStyle = jc.ink;
        ctx.beginPath();
        ctx.arc(JOY_BASE.x, JOY_BASE.y, JOY_RADIUS + 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = active ? 0.6 : 0.35;
        ctx.strokeStyle = jc.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(JOY_BASE.x, JOY_BASE.y, JOY_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = active || v ? 0.85 : 0.5;
        ctx.beginPath();
        ctx.arc(kx, ky, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
        drawBolts();
        drawExplosions();
        drawParticles();
        if (state !== 'over' && state !== 'won') drawPlayer(colors);
        drawFloaters();
        ctx.restore();
        if (screenFlash > 0) {
            ctx.fillStyle = `rgba(249, 202, 36, ${(screenFlash / 0.25) * 0.35})`;
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
        drawJoystick();
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
        finalLevel: FINAL_LEVEL,
        destroy() {
            if (rafId) cancelAnimationFrame(rafId);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        },
    };
}
