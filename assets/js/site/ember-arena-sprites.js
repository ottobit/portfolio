// Pixel-art sprite data and the two functions that paint it — split out of
// ember-arena-game.js since none of this depends on a running game instance.
// Sprites are drawn with fillRect on a small grid — same technique as the
// Triple Triad icon, so no external image assets. '.' is transparent.

import { themeColors } from './ember-arena-color.js?v=1';

export const HEART_PALETTE = { h: '#e74c3c', H: '#ff7675' };
export const HEART_FRAME = [
    '.hh...hh.',
    'hhhhhhhhh',
    'hHhhhhhhh',
    'hhhhhhhhh',
    '.hhhhhhh.',
    '..hhhhh..',
    '...hhh...',
    '....h....',
];

// A small chest instead of a gem — reads at a glance as "loot", and sits on
// the ground rather than spinning in place (see the pop-in + bob in
// drawTreasures() instead of a spin). Warm wood + gold trim, not used
// anywhere else in the palette (red heals, green is the slime family, the
// arrow's own wood/bronze — ARROW_COLOR — is close but never appears
// alongside this).
export const TREASURE_PALETTE = { c: '#6d4c2c', C: '#a9702f', g: '#f1c40f' };
export const TREASURE_FRAME = [
    '.ccccccc.',
    'cCCCCCCCc',
    'cCgggggCc',
    'ccccccccc',
    'cCCCCCCCc',
    'cCC.g.CCc',
    '.ccccccc.',
];

// Cookie and May: two rare familiars, not monsters — no hp, no combat, never picked
// by the random spawn table. Same sprite technique as everything else (paintSprite),
// same shape shared between them so the pair reads as two dogs, differentiated by
// colour and by scale (see FAMILIAR_SCALE in the main module) rather than a second
// hand-drawn shape.
// 'glow' isn't a sprite pixel — paintSprite never draws it — it's the colour of the
// pulsing halo behind the sprite while the arrival banner is up (see drawFamiliar).
export const COOKIE_PALETTE = { A: '#d9a066', a: '#a9743f', E: '#2c1608', n: '#1a1a1a', glow: '#f5a623' };
export const MAY_PALETTE = { A: '#ede2cc', a: '#c9b896', B: '#7a4a24', E: '#2c1608', n: '#1a1a1a', glow: '#f0d878' };
// Side profile, facing right (drawFamiliar flips it when the visit is heading left).
// Reworked from reference photos of the two real dogs: the original had a pointed,
// upright ear, but both actually have a floppy, drooping one. It sits at the BACK of
// the skull (poking out left of the head silhouette, cols 5-6) rather than beside the
// eye, so it reads as its own flap instead of blending into cheek shading — 2 cells
// wide where it meets the skull, tapering to a single trailing column as it droops.
export const DOG_FRAME = [
    '.......AAA..',
    '.....aaAAAA.',
    '.....aaAAEA.',
    '......aAAAAn',
    '......aAAAA.',
    '.a....AAAAA.',
    '.aaAAAAAAAA.',
    'aAAAAAAAAAAa',
    '.AA.....AA..',
    '.aa.....aa..',
];
// May's own frame swaps some body cells for the patch colour B — same silhouette,
// different coat: a saddle patch across the back, so the marking reads as one
// deliberate shape instead of scattered spots.
export const MAY_FRAME = [
    '.......AAA..',
    '.....aaAAAA.',
    '.....aaAAEA.',
    '......aAAAAn',
    '......aAAAA.',
    '.a....AAAAA.',
    '.aaAABBBBBA.',
    'aAABBBBBBBAa',
    '.AA.....AA..',
    '.aa.....aa..',
];

export const HERO_PALETTE = {
    H: '#2c3e50', S: '#f1c27d', E: '#1a1a1a', B: '#5d4037',
    L: '#34495e', O: '#2c3e50', D: '#8d6e63', M: '#bdc3c7',
};
export const HERO_FRAMES = [
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

export const MONSTER_TYPES = {
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
        // A real move instead of continuous passive contact damage: it winds up
        // (telegraph) before actually biting, on a cooldown — dodgeable by
        // stepping away, not a tick you just eat by touching it. Style 'leap':
        // it hops the short distance to you instead of closing in on foot —
        // fits the squish-bounce it already does at rest.
        bite: { cooldown: 1.5, telegraph: 0.35, damage: 12, style: 'leap' },
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
        // More aggressive than the slime (faster, lower hp) — bites more often too.
        // Style 'rush': quickens its own steps to close the last stretch instead
        // of hopping, so the acceleration itself reads as "about to bite".
        bite: { cooldown: 1.1, telegraph: 0.3, damage: 14, style: 'rush', rushMul: 2.2 },
        // A ranged jab on top of the bite, not instead of it — it keeps hopping in
        // and biting up close as before, but now also breathes fire while it closes
        // the distance. Never a projectile: telegraph, then a single hit if the
        // player is still in range, drawn as a short jet attached to the imp's own
        // position (see drawMonsters) instead of something thrown — like a dragon's
        // breath, not a dart. Damage lands once per use (secondary to the bite),
        // so only standing in range during the telegraph risks it.
        spit: { interval: 2.2, telegraph: 0.25, duration: 0.5, range: 120, damage: 12 },
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
        // Fast and erratic — the shortest cooldown of the three biters, but the
        // weakest bite (it's the fast/fragile swarm type, not a bruiser). Same
        // 'rush' style as the imp — it's already the fastest thing on screen, so
        // a burst of extra speed reads naturally as a dive-bomb before the bite.
        bite: { cooldown: 1.0, telegraph: 0.25, damage: 10, style: 'rush', rushMul: 2.0 },
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
    // A mutating shapeshifter: three unrelated silhouettes it cycles between (picked
    // per-instance in drawMonsters, keyed off its spawn-time phase so a pack of them
    // doesn't mutate in lockstep) instead of one fixed look. Its name is drawn above
    // it in drawMonsters too — the only monster with a floating label, since nothing
    // else needs to be called out as "this one keeps changing".
    sprungal: {
        palette: { A: '#b39ddb', a: '#5e4b8b', E: '#ffffff', p: '#2c1e4a' },
        frames: [
            [
                '...AA...',
                '...AA...',
                '..AEEA..',
                '..AppA..',
                '...AA...',
                '...AA...',
                '...AA...',
                '..a..a..',
                '..a..a..',
                '.a....a.',
                'a......a',
            ],
            [
                '..AA....',
                '..AA....',
                '.AEEA...',
                '.AppA...',
                '..AA....',
                '..AAa...',
                '...Aa...',
                '...Aaa..',
                '..a...a.',
                '.a.....a',
            ],
            [
                '....AA.....',
                '....AA.....',
                '...AEEA....',
                '...AppA....',
                '....AA.....',
                '.a..AA..a..',
                '..a.AA.a...',
                '...a..a....',
                '..a....a...',
            ],
        ],
        cell: 2.4, r: 10, speedMul: 1.2, hpMul: 0.7, weight: 2, minLevel: 4, knockMul: 1.25,
        // Low damage on purpose: the paralysis is the actual threat, not the hit itself.
        shoot: { interval: 2.2, speed: 140, damage: 6, range: 380, standoff: 150, approach: 0.5, ice: true, paralyzeDuration: 1 },
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
        cell: 3.4, r: 32, speedMul: 0.5, hpMul: 13, weight: 0, minLevel: Infinity, contactDamage: 32, knockMul: 0.07,
        // A second attack on top of the charge it already shares with the regular boss:
        // a ring of fire arrows launched all at once, telegraphed so it stays dodgeable.
        // Tighter interval and a couple more arrows than before — the telegraph stays
        // the same 0.5s, so it's still readable, just less time to breathe between rings.
        starAttack: { interval: 3.0, telegraph: 0.5, count: 14, speed: 190, damage: 10 },
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
export function paintSprite(ctx, rows, palette, cx, cy, cell, flipX, override) {
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
    const treasure = key === 'treasure';
    const cookie = key === 'cookie';
    const may = key === 'may';
    const def = hero || heart || treasure || cookie || may ? null : MONSTER_TYPES[key];
    if (!hero && !heart && !treasure && !cookie && !may && !def) return;
    const rows = hero ? HERO_FRAMES[0] : heart ? HEART_FRAME : treasure ? TREASURE_FRAME : cookie || may ? (cookie ? DOG_FRAME : MAY_FRAME) : def.frames[0];
    const palette = hero
        ? Object.assign({ P: themeColors().accent, T: themeColors().accent }, HERO_PALETTE)
        : heart ? HEART_PALETTE : treasure ? TREASURE_PALETTE : cookie ? COOKIE_PALETTE : may ? MAY_PALETTE : def.palette;
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

export function pickMonsterType(level) {
    const pool = Object.keys(MONSTER_TYPES).filter((k) => MONSTER_TYPES[k].weight > 0 && MONSTER_TYPES[k].minLevel <= level);
    const total = pool.reduce((s, k) => s + MONSTER_TYPES[k].weight, 0);
    let roll = Math.random() * total;
    for (const k of pool) {
        roll -= MONSTER_TYPES[k].weight;
        if (roll <= 0) return k;
    }
    return pool[0];
}
