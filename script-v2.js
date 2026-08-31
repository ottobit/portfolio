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

    // The browser's default pick is often the flattest local voice it has
    // (especially on Linux/Chrome OS). Most platforms also ship at least one
    // noticeably better one — network-backed or explicitly "Natural" —
    // so prefer that when available instead of leaving it to chance.
    let availableVoices = [];
    function refreshVoices() {
        if (canSpeak) availableVoices = window.speechSynthesis.getVoices();
    }
    if (canSpeak) {
        refreshVoices();
        window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    }

    function pickVoice(bcp47) {
        const prefix = bcp47.split('-')[0];
        const candidates = availableVoices.filter(v => v.lang.toLowerCase().startsWith(prefix));
        if (!candidates.length) return null;
        // Prefer, in order: explicitly-marked high-quality voices, then
        // specific named voices platforms ship that sound noticeably less
        // robotic than their eSpeak-style default (macOS's Samantha/Alba,
        // Windows' newer neural names), then any non-local (network) voice,
        // then an exact-locale local voice, then whatever's left.
        const qualityRe = /natural|neural|online|premium|enhanced|google/i;
        const goodNamesRe = /samantha|alba|alice|federica|elsa|luca|aria|jenny|guy|sonia|libby/i;
        return (
            candidates.find(v => qualityRe.test(v.name)) ||
            candidates.find(v => goodNamesRe.test(v.name)) ||
            candidates.find(v => !v.localService) ||
            candidates.find(v => v.lang.toLowerCase() === bcp47.toLowerCase()) ||
            candidates[0]
        );
    }

    // Long flat utterances read more monotone than they need to — splitting
    // on sentence boundaries and queueing them with a short pause in
    // between mimics natural breathing/phrasing better than one run-on.
    function speakSentences(text, opts, onDone) {
        const sentences = text.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) || [text];
        let i = 0;
        function next() {
            if (i >= sentences.length) { onDone(); return; }
            const u = new SpeechSynthesisUtterance(sentences[i]);
            Object.assign(u, opts);
            i++;
            u.onend = () => window.setTimeout(next, 120);
            u.onerror = onDone;
            window.speechSynthesis.speak(u);
        }
        next();
    }

    const LINK_TEXT = {
        it: { repo: 'Codice', link: 'Vedi live', ref: 'Scopri di più', listen: 'Ascolta', stop: 'Ferma' },
        en: { repo: 'Code', link: 'Live demo', ref: 'Learn more', listen: 'Listen', stop: 'Stop' }
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

        // Optional repo/live-demo/reference links — only shown when a node
        // provides them, so lightweight entries (like most About/Social
        // nodes) stay text-only.
        if (detailLinks) {
            detailLinks.innerHTML = '';
            const links = [
                { url: el.dataset.repo, label: LINK_TEXT[lang].repo, icon: '↗' },
                { url: el.dataset.link, label: LINK_TEXT[lang].link, icon: '↗' },
                { url: el.dataset.ref, label: LINK_TEXT[lang].ref, icon: '↗' }
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
            const bcp47 = lang === 'en' ? 'en-US' : 'it-IT';
            const voice = pickVoice(bcp47);
            detailSpeak.classList.add('speaking');
            detailSpeakIcon.textContent = '⏹';
            detailSpeakLabel.textContent = LINK_TEXT[lang].stop;
            speakSentences(
                `${detailTitle.textContent}. ${detailText.textContent}`,
                { lang: bcp47, voice, rate: 0.95, pitch: 1 },
                stopSpeech
            );
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
        // Full 360° star: sub-nodes ring the hub on every side, like a real
        // star-topology diagram — but a perfectly even split (esp. at 4
        // nodes: N/E/S/W) reads as a rigid cross. A diagonal base angle plus
        // a small, deterministic per-node jitter (stable across re-renders,
        // not random each time) breaks that symmetry into something more
        // organic without ever overlapping — the relax pass below still
        // has the final say.
        const baseRadius = Math.min(170, Math.max(95, panelWidth * 0.3)) + Math.max(0, count - 3) * 16;
        const angleStep = count > 1 ? 360 / count : 0;
        const startAngle = -45; // diagonal, not straight up — avoids a N/E/S/W cross

        function seededUnit(seed) {
            let h = 0;
            for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
            return (h % 1000) / 1000; // deterministic, 0..1
        }

        const hubKey = hub.dataset.hub || '';
        const points = subs.map((sub, i) => {
            const angleJitter = (seededUnit(`${hubKey}-${i}-a`) - 0.5) * 2 * 20; // ±20°
            const radiusJitter = 0.85 + seededUnit(`${hubKey}-${i}-r`) * 0.35; // 85%–120%
            const angleDeg = count === 1 ? -90 : startAngle + angleStep * i + angleJitter;
            const angle = (angleDeg * Math.PI) / 180;
            const radius = baseRadius * radiusJitter;
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
