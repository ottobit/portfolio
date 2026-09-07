// Shared theme (light/dark) + language (it/en) engine — one implementation
// used by index.html and every project page, replacing what used to be
// script.js's own copy plus a near-duplicate inline bootstrap repeated in
// each project page. Persisted in localStorage under the same keys
// everywhere, so toggling on any page stays in sync with the rest.
//
// Exposes getLang() for other modules that need the current language
// without re-reading storage (detail panel, speech, news feed fallback).
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-toggle-icon');
const themeLabel = document.getElementById('theme-toggle-label');
const langToggle = document.getElementById('lang-toggle');
const langLabel = document.getElementById('lang-toggle-label');

const THEME_TEXT = {
    it: { toDark: 'Tema scuro', toLight: 'Tema chiaro' },
    en: { toDark: 'Dark theme', toLight: 'Light theme' }
};

// Light theme and English are the default experience regardless of the
// visitor's system settings — dark/Italian stay one click away, but a
// first-time visit never auto-switches based on OS preference.
let lang = localStorage.getItem('lang') || 'en';
let theme = localStorage.getItem('theme') || 'light'; // 'light' | 'dark'

function applyThemeUI() {
    const isDark = theme === 'dark';
    root.setAttribute('data-theme', theme);
    if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
    if (themeLabel) themeLabel.textContent = isDark ? THEME_TEXT[lang].toLight : THEME_TEXT[lang].toDark;
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
}

// Swapped via innerHTML, not textContent: some pages embed inline links
// inside their data-it copy (e.g. the project links inside evolution's
// timeline text) — textContent would strip and cache them stripped. Safe
// here since this content is always our own authored copy, never user input.
function applyLangUI() {
    root.lang = lang;
    if (langLabel) langLabel.textContent = lang === 'it' ? 'English' : 'Italiano';
    if (langToggle) langToggle.setAttribute('aria-pressed', String(lang === 'en'));

    document.querySelectorAll('[data-it]').forEach(el => {
        if (!el.dataset.en) el.dataset.en = el.innerHTML;
        el.innerHTML = lang === 'it' ? el.dataset.it : el.dataset.en;
    });

    // Any element carrying data-aria-label-it (diagram triggers, reference
    // marks, ...) gets its aria-label translated the same way.
    document.querySelectorAll('[data-aria-label-it]').forEach(el => {
        if (!el.dataset.ariaLabelEn) el.dataset.ariaLabelEn = el.getAttribute('aria-label');
        el.setAttribute('aria-label', lang === 'it' ? el.dataset.ariaLabelIt : el.dataset.ariaLabelEn);
    });

    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        applyThemeUI();
    });
}

if (langToggle) {
    langToggle.addEventListener('click', () => {
        lang = lang === 'en' ? 'it' : 'en';
        localStorage.setItem('lang', lang);
        applyLangUI();
        applyThemeUI(); // theme button label is language-dependent too
    });
}

applyThemeUI();
applyLangUI();

export function getLang() {
    return lang;
}
