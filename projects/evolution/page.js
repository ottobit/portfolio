import '../../assets/js/site/theme-lang.js';
import { initDiagramPage } from '../../assets/js/shared/diagram-nav.js';

// Only the nav-menu half applies here (no diagram on this page — the
// diagram-zoom half no-ops safely when it finds no diagram elements).
initDiagramPage();

// Dynamic scroll reveal: each era pops/fades into place the first time it
// scrolls into view, and the vertical line fills in behind it — the
// timeline actively grows as you read down the page instead of sitting
// there fully drawn from the start.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const eras = document.querySelectorAll('.timeline-era');
const progressBar = document.getElementById('timeline-progress');
const timelineWrap = document.querySelector('.timeline-wrap');

if (reduceMotion) {
    eras.forEach((era) => era.classList.add('in-view'));
} else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    eras.forEach((era) => observer.observe(era));
} else {
    eras.forEach((era) => era.classList.add('in-view'));
}

if (progressBar && timelineWrap) {
    let ticking = false;
    function updateProgress() {
        ticking = false;
        const rect = timelineWrap.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const total = rect.height;
        if (total <= 0) return;
        const scrolled = viewportH * 0.6 - rect.top;
        const pct = Math.max(0, Math.min(1, scrolled / total));
        progressBar.style.height = (pct * 100) + '%';
    }
    function onScroll() {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(updateProgress);
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateProgress();
}
