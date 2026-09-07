
// Mascot: a small node that roams the whole page on its own (fixed to the
// viewport, not confined to the hero canvas), glances toward the cursor,
// gets excited on graph interaction, can be picked up and dragged around,
// and "pops" if you mash clicks on it — then recovers a moment later.
// Pure fun, no functional role — safe to fail silently if missing.
// Shared across every mascot instance (original + any split-off clones):
// one page-wide reduced-motion check, and the word-parting system, which
// touches shared DOM (.description p) and would corrupt itself if it ran
// once per mascot instead of once for the page.
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Moses effect: the bio text doesn't block a mascot — it parts around it
// as it passes, then closes back up. Each word is wrapped in its own span
// so it can be nudged sideways independently, purely via transform
// (content/layout untouched, nothing to ever "fix" back). Page-wide, not
// per-mascot: wrapping the same paragraph twice would nest spans inside
// spans and corrupt it.
const PART_TEXT_SELECTOR = '.description p';
const PART_INFLUENCE = 70; // px, horizontal reach of the effect
const PART_MAX_PUSH = 26; // px, shove on the word right next to the ball
export let wordRects = [];

function wrapWords(el) {
    const text = el.textContent;
    el.innerHTML = text.split(/(\s+)/).map(chunk =>
        /^\s+$/.test(chunk) || !chunk ? chunk : `<span class="word">${chunk}</span>`
    ).join('');
}

function refreshWordRects() {
    wordRects = [];
    if (reduceMotion) return;
    document.querySelectorAll(`${PART_TEXT_SELECTOR} .word`).forEach(w => {
        const r = w.getBoundingClientRect();
        wordRects.push({ el: w, top: r.top, bottom: r.bottom, centerX: (r.left + r.right) / 2, pushed: false });
    });
}

function initTextParting() {
    if (reduceMotion) return;
    document.querySelectorAll(PART_TEXT_SELECTOR).forEach(wrapWords);
    refreshWordRects();
}
initTextParting();
// The language toggle replaces each paragraph's textContent wholesale
// (see applyLangUI), which wipes the word-wrapping — redo it after.
document.addEventListener('langchange', initTextParting);

export function updateTextParting(cx, cy) {
    wordRects.forEach(w => {
        const inLine = cy >= w.top - 14 && cy <= w.bottom + 14;
        const dist = Math.abs(w.centerX - cx);
        if (!inLine || dist > PART_INFLUENCE) {
            if (w.pushed) {
                w.el.style.transform = '';
                w.pushed = false;
            }
            return;
        }
        const strength = 1 - dist / PART_INFLUENCE;
        const push = Math.sign(w.centerX - cx || 1) * strength * PART_MAX_PUSH;
        w.el.style.transform = `translateX(${push.toFixed(1)}px)`;
        w.pushed = true;
    });
}
