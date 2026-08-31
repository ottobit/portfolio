// Theme (light/dark) and language (it/en) toggles, both persisted in
// localStorage. Exposed on window so other IIFEs below (detail panel,
// speech) can read the current language without re-reading storage.
const siteState = (() => {
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

    let lang = localStorage.getItem('lang') || 'it';
    let theme = localStorage.getItem('theme'); // 'light' | 'dark' | null (system)

    function applyThemeUI() {
        const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (theme) root.setAttribute('data-theme', theme);
        else root.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
        if (themeLabel) themeLabel.textContent = isDark ? THEME_TEXT[lang].toLight : THEME_TEXT[lang].toDark;
        if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
    }

    function applyLangUI() {
        root.lang = lang;
        if (langLabel) langLabel.textContent = lang === 'it' ? 'English' : 'Italiano';
        if (langToggle) langToggle.setAttribute('aria-pressed', String(lang === 'en'));

        document.querySelectorAll('[data-en]').forEach(el => {
            if (!el.dataset.it) el.dataset.it = el.textContent;
            el.textContent = lang === 'en' ? el.dataset.en : el.dataset.it;
        });

        document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
            theme = isDark ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
            applyThemeUI();
        });
    }

    if (langToggle) {
        langToggle.addEventListener('click', () => {
            lang = lang === 'it' ? 'en' : 'it';
            localStorage.setItem('lang', lang);
            applyLangUI();
            applyThemeUI(); // theme button label is language-dependent too
        });
    }

    applyThemeUI();
    applyLangUI();

    return { getLang: () => lang };
})();

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

    function closeMenu() {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu() {
        const open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
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
})();

// Update active nav link on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const scrollPosition = window.scrollY + 100;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            navLinks.forEach(link => link.classList.remove('active'));
            if (navLink) {
                navLink.classList.add('active');
            }
        }
    });
});

// Animated node network in the hero
(() => {
    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const heroVisual = canvas.closest('.hero-visual');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.matchMedia('(max-width: 600px)').matches;

    const accentColor = '91, 61, 245';
    const nodeCount = isSmallScreen ? 28 : 60;
    const linkDistance = isSmallScreen ? 110 : 150;
    const nodeSpeed = 0.25;

    let width, height, dpr;
    let nodes = [];
    let mouse = { x: null, y: null };
    let animationId = null;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        width = heroVisual.clientWidth;
        height = heroVisual.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createNodes() {
        nodes = Array.from({ length: nodeCount }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * nodeSpeed,
            vy: (Math.random() - 0.5) * nodeSpeed,
            r: 1.5 + Math.random() * 1.5
        }));
    }

    function step() {
        ctx.clearRect(0, 0, width, height);

        nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;

            if (node.x < 0 || node.x > width) node.vx *= -1;
            if (node.y < 0 || node.y > height) node.vy *= -1;

            if (mouse.x !== null) {
                const dx = node.x - mouse.x;
                const dy = node.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 90) {
                    const force = (90 - dist) / 90;
                    node.x += (dx / dist) * force * 1.2;
                    node.y += (dy / dist) * force * 1.2;
                }
            }
        });

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < linkDistance) {
                    const opacity = 1 - dist / linkDistance;
                    ctx.strokeStyle = `rgba(${accentColor}, ${opacity * 0.35})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        nodes.forEach(node => {
            ctx.fillStyle = `rgba(${accentColor}, 0.55)`;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.fill();
        });

        if (!reduceMotion) {
            animationId = requestAnimationFrame(step);
        }
    }

    heroVisual.addEventListener('mousemove', (e) => {
        const rect = heroVisual.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    heroVisual.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('resize', () => {
        resize();
        createNodes();
        if (reduceMotion) step();
    });

    resize();
    createNodes();
    step();
})();

// Hub/sub-node graph: dots overlaid on the hero canvas (desktop) and a
// compact accordion fallback (mobile), sharing one detail panel shown as a
// fixed overlay anchored to the bottom of the viewport (no scrolling needed).
(() => {
    const detailPanel = document.getElementById('detail-panel');
    if (!detailPanel) return;

    const detailBackdrop = document.getElementById('detail-backdrop');
    const detailIcon = document.getElementById('detail-icon');
    const detailTitle = document.getElementById('detail-title');
    const detailText = document.getElementById('detail-text');
    const detailLinks = document.getElementById('detail-links');
    const detailClose = document.getElementById('detail-close');
    const detailSpeak = document.getElementById('detail-speak');
    const detailSpeakIcon = document.getElementById('detail-speak-icon');
    const detailSpeakLabel = document.getElementById('detail-speak-label');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canSpeak = 'speechSynthesis' in window;

    const LINK_TEXT = {
        it: { repo: 'Codice', link: 'Vedi live', listen: 'Ascolta', stop: 'Ferma' },
        en: { repo: 'Code', link: 'Live demo', listen: 'Listen', stop: 'Stop' }
    };

    let currentEl = null;

    function stopSpeech() {
        if (canSpeak) window.speechSynthesis.cancel();
        if (detailSpeak) {
            detailSpeak.classList.remove('speaking');
            detailSpeakIcon.textContent = '🔊';
            detailSpeakLabel.textContent = LINK_TEXT[siteState.getLang()].listen;
        }
    }

    function closeDetail() {
        detailPanel.classList.remove('visible');
        if (detailBackdrop) detailBackdrop.classList.remove('visible');
        stopSpeech();
        currentEl = null;
        window.setTimeout(() => {
            detailPanel.hidden = true;
            if (detailBackdrop) detailBackdrop.hidden = true;
        }, reduceMotion ? 0 : 300);
    }

    function renderDetail(el) {
        const lang = siteState.getLang();
        const title = (lang === 'en' && el.dataset.titleEn) || el.dataset.title || '';
        const text = (lang === 'en' && el.dataset.detailEn) || el.dataset.detail || '';

        detailIcon.textContent = el.dataset.icon || '';
        detailTitle.textContent = title;
        detailText.textContent = text;

        // Optional repo/live-demo links — only shown when a node provides them,
        // so lightweight entries (like most About/Social nodes) stay text-only.
        if (detailLinks) {
            detailLinks.innerHTML = '';
            const links = [
                { url: el.dataset.repo, label: LINK_TEXT[lang].repo, icon: '↗' },
                { url: el.dataset.link, label: LINK_TEXT[lang].link, icon: '↗' }
            ].filter(l => l.url);

            links.forEach(({ url, label, icon }) => {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = 'detail-link';
                a.textContent = `${label} ${icon}`;
                detailLinks.appendChild(a);
            });
            detailLinks.hidden = links.length === 0;
        }

        if (detailSpeak) detailSpeak.hidden = !canSpeak;
        stopSpeech();
    }

    function openDetail(el) {
        currentEl = el;
        renderDetail(el);

        detailPanel.hidden = false;
        if (detailBackdrop) detailBackdrop.hidden = false;
        requestAnimationFrame(() => {
            detailPanel.classList.add('visible');
            if (detailBackdrop) detailBackdrop.classList.add('visible');
        });
    }

    if (detailClose) detailClose.addEventListener('click', closeDetail);
    if (detailBackdrop) detailBackdrop.addEventListener('click', closeDetail);

    if (detailSpeak && canSpeak) {
        detailSpeak.addEventListener('click', () => {
            if (window.speechSynthesis.speaking) {
                stopSpeech();
                return;
            }
            const lang = siteState.getLang();
            const utterance = new SpeechSynthesisUtterance(`${detailTitle.textContent}. ${detailText.textContent}`);
            utterance.lang = lang === 'en' ? 'en-US' : 'it-IT';
            utterance.onend = stopSpeech;
            utterance.onerror = stopSpeech;
            detailSpeak.classList.add('speaking');
            detailSpeakIcon.textContent = '⏹';
            detailSpeakLabel.textContent = LINK_TEXT[lang].stop;
            window.speechSynthesis.speak(utterance);
        });
    }

    // Re-render the open panel (and stop any speech mid-sentence) when the
    // language toggle flips, so the shown text and the "read aloud" match.
    document.addEventListener('langchange', () => {
        if (currentEl && !detailPanel.hidden) renderDetail(currentEl);
    });

    // --- Dots overlaid directly on the hero canvas, same at every breakpoint ---
    const heroVisual = document.querySelector('.hero-visual');
    const overlay = document.getElementById('hub-overlay');
    const svg = document.getElementById('graph-lines');
    const hubDots = overlay ? Array.from(overlay.querySelectorAll('.hub-dot')) : [];
    let openKey = null;

    function positionHubDots() {
        hubDots.forEach(hub => {
            hub.style.left = hub.dataset.x + '%';
            hub.style.top = hub.dataset.y + '%';
        });
    }

    function subDotsFor(key) {
        return overlay ? Array.from(overlay.querySelectorAll(`.sub-dot[data-parent="${key}"]`)) : [];
    }

    function clearLines() {
        if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function positionSubDots(hub, subs) {
        const panelWidth = heroVisual.clientWidth;
        const panelHeight = heroVisual.clientHeight;
        const hx = (parseFloat(hub.dataset.x) / 100) * panelWidth;
        const hy = (parseFloat(hub.dataset.y) / 100) * panelHeight;
        const count = subs.length;
        const gap = 14;

        // Chips are pills sized by their label, so measure them (they must
        // already be display:flex — opacity can still be 0) instead of
        // assuming a fixed width, or dense groups (e.g. Social's 4 links)
        // end up overlapping.
        const sizes = subs.map(sub => ({
            w: sub.offsetWidth || 120,
            h: sub.offsetHeight || 32
        }));
        const avgSpacing = sizes.reduce((sum, s) => sum + s.w, 0) / count + gap;

        const radius = Math.min(170, Math.max(95, panelWidth * 0.3)) + Math.max(0, count - 3) * 16;
        let angleStep = count > 1
            ? (2 * Math.asin(Math.min(1, avgSpacing / (2 * radius))) * 180) / Math.PI
            : 0;
        angleStep = Math.max(26, Math.min(70, angleStep));
        const spread = Math.min(190, angleStep * (count - 1));
        const startAngle = 90 - spread / 2;

        const points = subs.map((sub, i) => {
            const angleDeg = count === 1 ? 90 : startAngle + (spread / (count - 1)) * i;
            const angle = (angleDeg * Math.PI) / 180;
            return {
                sub,
                x: hx + radius * Math.cos(angle),
                y: hy + radius * Math.sin(angle),
                w: sizes[i].w,
                h: sizes[i].h
            };
        });

        // Relax any remaining overlap (e.g. tight radius on small panels)
        // by nudging colliding pairs apart along their separation vector.
        for (let pass = 0; pass < 6; pass++) {
            let moved = false;
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const a = points[i];
                    const b = points[j];
                    const minDx = (a.w + b.w) / 2 + gap;
                    const minDy = (a.h + b.h) / 2 + gap / 2;
                    let dx = b.x - a.x;
                    let dy = b.y - a.y;
                    if (Math.abs(dx) >= minDx || Math.abs(dy) >= minDy) continue;
                    if (dx === 0 && dy === 0) dx = 0.01;
                    const overlapX = minDx - Math.abs(dx);
                    const overlapY = minDy - Math.abs(dy);
                    const push = Math.min(overlapX, overlapY) / 2 + 0.5;
                    const len = Math.hypot(dx, dy) || 1;
                    const nx = (dx / len) * push;
                    const ny = (dy / len) * push;
                    a.x -= nx; a.y -= ny;
                    b.x += nx; b.y += ny;
                    moved = true;
                }
            }
            if (!moved) break;
        }

        // Chips are fixed (no pan to reach ones past the edge), so clamp
        // their center within the panel, leaving room for their own width.
        points.forEach(p => {
            const marginX = p.w / 2 + 10;
            const marginY = p.h / 2 + 10;
            const x = Math.max(marginX, Math.min(panelWidth - marginX, p.x));
            const y = Math.max(marginY, Math.min(panelHeight - marginY, p.y));
            p.sub.style.left = x + 'px';
            p.sub.style.top = y + 'px';
            p.sub.classList.toggle('label-left', x < hx - 10);
        });

        return { hx, hy };
    }

    function drawLines(hx, hy, subs) {
        clearLines();
        if (!svg) return;

        subs.forEach((sub, i) => {
            const nx = parseFloat(sub.style.left);
            const ny = parseFloat(sub.style.top);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', hx);
            line.setAttribute('y1', hy);
            line.setAttribute('x2', hx);
            line.setAttribute('y2', hy);
            svg.appendChild(line);

            if (reduceMotion) {
                line.setAttribute('x2', nx);
                line.setAttribute('y2', ny);
                return;
            }

            requestAnimationFrame(() => {
                line.style.transition = `x2 0.4s ease ${i * 0.06}s, y2 0.4s ease ${i * 0.06}s`;
                line.setAttribute('x2', nx);
                line.setAttribute('y2', ny);
            });
        });
    }

    function closeHub(hub) {
        hub.classList.remove('active');
        subDotsFor(hub.dataset.hub).forEach(s => s.classList.remove('visible', 'animate-in'));
        clearLines();
    }

    function openHub(key) {
        const hub = hubDots.find(h => h.dataset.hub === key);
        if (!hub) return;
        const alreadyOpen = hub.classList.contains('active');

        hubDots.forEach(h => {
            if (h !== hub) closeHub(h);
        });

        if (alreadyOpen) {
            closeHub(hub);
            closeDetail();
            openKey = null;
            return;
        }

        hub.classList.add('active');
        openKey = key;
        closeDetail();

        const subs = subDotsFor(key);
        subs.forEach(s => s.classList.add('visible'));
        const { hx, hy } = positionSubDots(hub, subs);
        subs.forEach((s, i) => {
            window.setTimeout(() => s.classList.add('animate-in'), reduceMotion ? 0 : i * 70);
        });
        drawLines(hx, hy, subs);
    }

    positionHubDots();

    hubDots.forEach(hub => {
        hub.addEventListener('click', () => openHub(hub.dataset.hub));
    });

    if (overlay) {
        overlay.querySelectorAll('.sub-dot:not(.sub-link)').forEach(sub => {
            sub.addEventListener('click', () => openDetail(sub));
        });
    }

    window.addEventListener('resize', () => {
        if (!openKey) return;
        const hub = hubDots.find(h => h.dataset.hub === openKey);
        const subs = subDotsFor(openKey);
        const { hx, hy } = positionSubDots(hub, subs);
        drawLines(hx, hy, subs);
    });

    // --- Nav links + hero CTA: open the right hub from anywhere on the page ---
    document.querySelectorAll('.nav-menu a[data-hub], .cta-buttons a[data-hub]').forEach(el => {
        el.addEventListener('click', () => openHub(el.dataset.hub));
    });
})();
