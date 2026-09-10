import { getLang } from './theme-lang.js?v=1';
import { getNewsHistoryLimit } from './news-feed.js?v=1';

// Smooth scroll for navigation
const navLinks = document.querySelectorAll('.nav-menu a');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// Hamburger menu: the navbar's links are now all reachable from the
// interactive graph too, so they collapse into a single dropdown.
(() => {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    const NAV_TOGGLE_TEXT = {
        it: { open: 'Apri menu', close: 'Chiudi menu' },
        en: { open: 'Open menu', close: 'Close menu' }
    };

    function updateToggleLabel() {
        const lang = getLang();
        const isOpen = menu.classList.contains('open');
        toggle.setAttribute('aria-label', isOpen ? NAV_TOGGLE_TEXT[lang].close : NAV_TOGGLE_TEXT[lang].open);
    }

    function closeMenu() {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        updateToggleLabel();
    }

    function toggleMenu() {
        const open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        updateToggleLabel();
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) closeMenu();
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== toggle) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    document.addEventListener('langchange', updateToggleLabel);
    updateToggleLabel();
})();

// Nav menu: accumulated history of the last news items the dots have
// actually notified, kept in sync via the 'dotnewshistory' event fired
// from recordNotifiedNews() whenever a mascot's news bubble is shown.
(() => {
    const section = document.getElementById('nav-news');
    const divider = document.getElementById('nav-news-divider');
    const list = document.getElementById('nav-news-list');
    if (!section || !divider || !list) return;

    let latestHistory = [];

    // dot's first news reveal is never before ~25-40s after page load
    // (see scheduleNews()/refetchAllNews() in news-feed.js) — until then
    // this section used to just be absent from the menu, with nothing
    // telling a visitor that news were coming at all. A placeholder line
    // keeps the section visible from the very first render instead.
    const NEWS_LOADING_TEXT = {
        it: 'dot sta ancora leggendo le notizie…',
        en: 'dot is still reading the news…'
    };

    function render() {
        const items = latestHistory.slice(0, getNewsHistoryLimit());
        list.innerHTML = '';
        if (items.length === 0) {
            const li = document.createElement('li');
            const placeholder = document.createElement('span');
            placeholder.className = 'nav-news-loading';
            placeholder.textContent = NEWS_LOADING_TEXT[getLang()];
            li.appendChild(placeholder);
            list.appendChild(li);
            section.hidden = false;
            divider.hidden = false;
            return;
        }
        items.forEach(item => {
            const li = document.createElement('li');
            const content = item.url ? document.createElement('a') : document.createElement('span');
            if (item.url) {
                content.href = item.url;
                content.target = '_blank';
                content.rel = 'noopener';
            }
            content.textContent = `${item.icon} ${item.text}`;
            if (item.icon === '💼') content.classList.add('nav-news-job');
            li.appendChild(content);
            list.appendChild(li);
        });
        section.hidden = false;
        divider.hidden = false;
    }

    document.addEventListener('dotnewshistory', (e) => {
        latestHistory = e.detail || [];
        render();
    });

    // Re-render on breakpoint crossing (e.g. rotating a tablet) so the
    // shown count matches the new limit without waiting for fresh news.
    window.matchMedia('(max-width: 768px)').addEventListener('change', render);
    // Re-translate the loading placeholder (or re-render real items, a
    // no-op content-wise) when the language toggle flips.
    document.addEventListener('langchange', render);

    render();
})();
