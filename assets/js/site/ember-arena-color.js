// Colour helpers shared by the arena's sprites and its UI chrome — pure
// functions with no game state, split out of ember-arena-game.js so that
// file is left with only the actual run loop.

// #abc -> #aabbcc — every caller of blendHex/isLight works in 6-digit hex, but a
// CSS custom property is free to be written as shorthand (the light theme's own
// --bg is exactly that: #fff), so both entry points expand through this first.
function expandHex3(hex) {
    const short = /^#([0-9a-f]{3})$/i.exec((hex || '').trim());
    return short ? `#${[...short[1]].map((c) => c + c).join('')}` : hex;
}

// Mixes a hex colour toward another by `amount` (0..1). Pure white and the shared
// near-black outline colour are the ones every sprite uses for eyes/pupils, so a
// caller skips those — a monster's gaze has to read the same at every tier.
export function blendHex(hex, target, amount) {
    const a = /^#([0-9a-f]{6})$/i.exec(expandHex3(hex));
    const b = /^#([0-9a-f]{6})$/i.exec(expandHex3(target));
    if (!a || !b) return hex;
    const mix = (x, y) => Math.round(x + (y - x) * amount);
    const toHex = (n) => n.toString(16).padStart(2, '0');
    const channel = (str, i) => parseInt(str.slice(i, i + 2), 16);
    return `#${toHex(mix(channel(a[1], 0), channel(b[1], 0)))}${toHex(mix(channel(a[1], 2), channel(b[1], 2)))}${toHex(mix(channel(a[1], 4), channel(b[1], 4)))}`;
}

// Two tiers a monster's palette can be tinted towards as the run climbs — see
// tintPalette(). Chosen far from every existing monster hue and from the fire/bolt
// colours in the main module, so a tinted monster never reads as "on fire" or "a
// projectile".
const TIER_TINT_TARGET = { 1: '#c0392b', 2: '#180a24' };
const TIER_TINT_AMOUNT = { 1: 0.4, 2: 0.42 };

// A monster's palette tinted for how far the run has climbed since it spawned —
// so a slime met at level 12 doesn't look like the one met at level 1, even though
// it is drawn from the very same sprite. Cached per (type, tier): the blend is pure
// colour math, no reason to redo it every frame a monster is on screen.
const tintCache = {};
export function tintPalette(palette, type, tier) {
    if (!tier) return palette;
    const key = type + ':' + tier;
    if (tintCache[key]) return tintCache[key];
    const target = TIER_TINT_TARGET[tier];
    const amount = TIER_TINT_AMOUNT[tier];
    const out = {};
    Object.keys(palette).forEach((k) => {
        const v = palette[k];
        out[k] = (v === '#ffffff' || v === '#1a1a1a') ? v : blendHex(v, target, amount);
    });
    tintCache[key] = out;
    return out;
}

// Rough perceived brightness of a CSS colour, enough to tell a light theme from a
// dark one without pulling in a colour library.
export function isLight(color) {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim());
    if (!hex) return false;
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export function themeColors() {
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

// A plain circle-overlap test — `Math.hypot(dx, dy) < rA + rB` — used by every
// hit-test in the arena (player vs heart, player vs bolt, explosion vs monster...).
export function circlesOverlap(ax, ay, ar, bx, by, br) {
    return Math.hypot(ax - bx, ay - by) < ar + br;
}

// Minimum distance from a point to a segment — for testing whether a monster
// (a circle) touches the electric arc between two arrows (a segment), not just
// another arrow (a circle) the way circlesOverlap does.
export function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    // Inlined clamp: clamp() itself is a local closure helper inside
    // ember-arena-game.js, not something this dependency-free geometry file
    // can import from it.
    const raw = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    const t = Math.max(0, Math.min(1, raw));
    const cx = x1 + dx * t, cy = y1 + dy * t;
    return Math.hypot(px - cx, py - cy);
}
