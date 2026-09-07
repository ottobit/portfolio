// Shared by the three project pages with an inline diagram (cerebro,
// dot-world, triple-triad): the hamburger nav-menu toggle and the
// tap-to-zoom overlay for the diagram image. Both used to be duplicated,
// nearly verbatim, inside each page's own inline bootstrap script.
import { getLang } from '../site/theme-lang.js';

const NAV_TOGGLE_TEXT = {
    it: { open: 'Apri menu', close: 'Chiudi menu' },
    en: { open: 'Open menu', close: 'Close menu' }
};

function initNavMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (!navToggle || !navMenu) return;

    function updateToggleLabel() {
        const isOpen = navMenu.classList.contains('open');
        const text = NAV_TOGGLE_TEXT[getLang()];
        navToggle.setAttribute('aria-label', isOpen ? text.close : text.open);
    }
    function closeMenu() {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        updateToggleLabel();
    }
    navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = navMenu.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(open));
        updateToggleLabel();
    });
    navMenu.addEventListener('click', (e) => {
        if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && e.target !== navToggle) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });
    document.addEventListener('langchange', updateToggleLabel);
    updateToggleLabel();
}

// The inline diagram always fits the screen width (see .diagram-page img),
// so on a phone its baked-in SVG text is too small to read — this opens
// the same image full-screen instead, where the browser's native
// pinch-zoom/pan takes over (the SVG stays crisp at any zoom level).
function initDiagramZoom() {
    const diagramImg = document.querySelector('.diagram-page img');
    const diagramTrigger = document.getElementById('diagram-trigger');
    const zoomOverlay = document.getElementById('diagram-zoom-overlay');
    const zoomImg = document.getElementById('diagram-zoom-img');
    const zoomClose = document.getElementById('diagram-zoom-close');
    if (!diagramTrigger || !diagramImg || !zoomOverlay || !zoomImg) return;

    diagramTrigger.addEventListener('click', () => {
        zoomImg.src = diagramImg.src;
        zoomImg.alt = diagramTrigger.getAttribute('aria-label');
        zoomOverlay.hidden = false;
    });
    function closeZoom() {
        zoomOverlay.hidden = true;
    }
    zoomImg.addEventListener('click', closeZoom);
    if (zoomClose) zoomClose.addEventListener('click', closeZoom);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !zoomOverlay.hidden) closeZoom();
    });
}

export function initDiagramPage() {
    initNavMenu();
    initDiagramZoom();
}
