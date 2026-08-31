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

    const accentColor = '17, 94, 89';
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
        document.dispatchEvent(new CustomEvent('graphinteraction'));
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
        document.dispatchEvent(new CustomEvent('graphinteraction'));

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

// Mascot: a small node that roams the whole page on its own (fixed to the
// viewport, not confined to the hero canvas), glances toward the cursor,
// gets excited on graph interaction, can be picked up and dragged around,
// and "pops" if you mash clicks on it — then recovers a moment later.
// Pure fun, no functional role — safe to fail silently if missing.
(() => {
    const mascot = document.getElementById('mascot');
    const bubble = document.getElementById('mascot-bubble');
    if (!mascot || !bubble) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MARGIN = 20;
    const POP_THRESHOLD = 6;
    const POP_WINDOW_MS = 2200;

    const LINES = {
        it: ['Ciao! 👋', 'Continua a esplorare!', 'Prova a cliccare un nodo!', '✨', 'Ehi, piano!', 'Ahia!'],
        en: ['Hi there! 👋', 'Keep exploring!', 'Try clicking a node!', '✨', 'Hey, easy!', 'Ouch!']
    };

    let pos = { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
    let isDragging = false;
    let isThrown = false;
    let dragStart = null;
    let dragMoved = 0;
    let moveHistory = [];
    let clickTimes = [];
    let isPopped = false;
    let isDizzy = false;
    let shakeReversalTimes = [];
    let lastShakeDxSign = 0;
    let currentInflateScale = 1;

    // A little synthesized "creature" voice — no audio files, just Web
    // Audio oscillators/noise, so there's nothing to load or license. Silent
    // until the browser's autoplay policy is unlocked by a real user
    // gesture, then it just works.
    let audioCtx = null;
    function getAudioCtx() {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // The mascot's own scheduled hops fire off a timer, not a click — if
    // that's the very first thing to happen on the page, it creates the
    // AudioContext before any real gesture has unlocked it, and it's stuck
    // suspended (silent) until the *next* thing that happens to be a real
    // click resumes it. Rather than depend on which control the visitor
    // happens to press first, unlock it explicitly on the first real
    // interaction anywhere on the page.
    document.addEventListener('pointerdown', getAudioCtx, { once: true });
    document.addEventListener('keydown', getAudioCtx, { once: true });

    function chirp({ freqStart, freqEnd, duration, type, gain }) {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), ctx.currentTime + duration);
        gainNode.gain.setValueAtTime(gain, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gainNode).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    function staticBurst(duration, gain) {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(gain, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        noise.connect(filter).connect(gainNode).connect(ctx.destination);
        noise.start();
    }

    function playHopSound() {
        chirp({ freqStart: 500 + Math.random() * 120, freqEnd: 720 + Math.random() * 150, duration: 0.08, type: 'square', gain: 0.03 });
    }
    function playClickSound() {
        chirp({ freqStart: 320, freqEnd: 900, duration: 0.1, type: 'square', gain: 0.05 });
    }
    function playDropSound() {
        chirp({ freqStart: 320, freqEnd: 110, duration: 0.15, type: 'sine', gain: 0.04 });
    }
    function playPopSound() {
        staticBurst(0.22, 0.06);
        chirp({ freqStart: 900, freqEnd: 70, duration: 0.3, type: 'sawtooth', gain: 0.05 });
    }
    function playRecoverSound() {
        chirp({ freqStart: 200, freqEnd: 950, duration: 0.25, type: 'square', gain: 0.05 });
    }
    // A short, punchy knock — for when the mascot collides with a page
    // element mid-throw (distinct from the softer floor/wall bounce sound).
    function playHitSound() {
        chirp({ freqStart: 700, freqEnd: 180, duration: 0.09, type: 'triangle', gain: 0.05 });
    }
    // A brittle crack layered on top of the knock — noise burst plus a
    // sharp downward sweep, for the "breaking apart" feel on impact.
    function playCrackSound() {
        staticBurst(0.12, 0.05);
        chirp({ freqStart: 1400, freqEnd: 90, duration: 0.12, type: 'sawtooth', gain: 0.04 });
    }
    // A woozy, wavering tone (vibrato via an LFO on the oscillator's own
    // frequency) for when the mascot gets shaken around too much — sounds
    // dazed rather than hurt (that's playPopSound's job).
    function playDizzySound() {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const duration = 0.5;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, ctx.currentTime);
        lfo.frequency.setValueAtTime(9, ctx.currentTime);
        lfoGain.gain.setValueAtTime(90, ctx.currentTime);
        lfo.connect(lfoGain).connect(osc.frequency);
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gainNode).connect(ctx.destination);
        lfo.start();
        osc.start();
        lfo.stop(ctx.currentTime + duration);
        osc.stop(ctx.currentTime + duration);
    }

    function clamp(x, y) {
        return {
            x: Math.max(MARGIN, Math.min(window.innerWidth - MARGIN, x)),
            y: Math.max(MARGIN, Math.min(window.innerHeight - MARGIN, y))
        };
    }

    function place(x, y) {
        pos = clamp(x, y);
        mascot.style.left = pos.x + 'px';
        mascot.style.top = pos.y + 'px';
    }

    function restartAnimation(className, autoRemoveMs) {
        if (reduceMotion) return;
        mascot.classList.remove(className);
        void mascot.offsetWidth; // force reflow so the animation can replay
        mascot.classList.add(className);
        if (autoRemoveMs) window.setTimeout(() => mascot.classList.remove(className), autoRemoveMs);
    }

    function randomHop() {
        if (isDragging || isThrown || isPopped) return;
        place(MARGIN + Math.random() * (window.innerWidth - MARGIN * 2), MARGIN + Math.random() * (window.innerHeight - MARGIN * 2));
        restartAnimation('hopping', 600);
        playHopSound();
    }

    place(pos.x, pos.y);

    function scheduleHop() {
        window.setTimeout(() => {
            randomHop();
            scheduleHop();
        }, 4000 + Math.random() * 2000);
    }
    if (!reduceMotion) scheduleHop();

    // Eyes glance toward the cursor when it's nearby, anywhere on the page.
    document.addEventListener('mousemove', (e) => {
        if (isDragging || isThrown || isPopped) return;
        const rect = mascot.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 60));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / 60));
        mascot.querySelectorAll('.mascot-eye').forEach(eye => {
            eye.style.transform = `translate(${dx * 1.5}px, ${dy * 1.5}px)`;
        });
    });

    // Perks up whenever a hub or a detail panel opens elsewhere on the graph.
    document.addEventListener('graphinteraction', () => {
        if (!isPopped) restartAnimation('excited', 500);
    });

    function burstParticles() {
        const rect = mascot.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('span');
            p.className = 'mascot-particle';
            const angle = (i / 8) * Math.PI * 2;
            p.style.setProperty('--px', Math.cos(angle) * 40 + 'px');
            p.style.setProperty('--py', Math.sin(angle) * 40 + 'px');
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            document.body.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
        }
    }

    let inflateResetTimer = null;

    // Grows the mascot a little more with each click in the current streak,
    // so it visibly "puffs up" as it approaches the pop threshold — and
    // since dragging doesn't reset the streak, it can be picked up and
    // dragged around while still inflated.
    function updateInflate(count) {
        // A fixed, generous jump per tap (not a fraction of the streak) so
        // the growth is obvious immediately, not just once you're a few
        // clicks in.
        currentInflateScale = 1 + count * 0.4;
        mascot.style.setProperty('--mascot-scale', currentInflateScale.toFixed(3));
    }

    function resetInflate() {
        window.clearTimeout(inflateResetTimer);
        inflateResetTimer = null;
        currentInflateScale = 1;
        mascot.style.setProperty('--mascot-scale', 1);
    }

    function scheduleInflateReset() {
        window.clearTimeout(inflateResetTimer);
        inflateResetTimer = window.setTimeout(resetInflate, POP_WINDOW_MS);
    }

    function pop() {
        if (isPopped) return;
        isPopped = true;
        clickTimes = [];
        resetInflate();
        bubble.hidden = true;
        if (reduceMotion) {
            window.setTimeout(() => { isPopped = false; }, 300);
            return;
        }
        burstParticles();
        playPopSound();
        mascot.classList.remove('excited', 'hopping', 'dropped');
        restartAnimation('popping');
        window.setTimeout(() => {
            mascot.classList.remove('popping');
            place(MARGIN + Math.random() * (window.innerWidth - MARGIN * 2), MARGIN + Math.random() * (window.innerHeight - MARGIN * 2));
            restartAnimation('recovering', 500);
            playRecoverSound();
            isPopped = false;
        }, 380);
    }

    function showBubble(text) {
        bubble.textContent = text;
        bubble.style.left = pos.x + 'px';
        bubble.style.top = pos.y + 'px';
        bubble.hidden = false;
        window.clearTimeout(bubble._timer);
        bubble._timer = window.setTimeout(() => { bubble.hidden = true; }, 1500);
    }

    // Shared streak counter behind the pop threshold — a click and a
    // page-hit collision both count as one "hit" toward the same 6, so
    // getting knocked around during a throw wears the mascot down just
    // like mashing it with clicks does. Returns true if this hit popped it
    // (caller should skip its own hit-specific reaction in that case).
    function registerHit() {
        const now = Date.now();
        clickTimes.push(now);
        clickTimes = clickTimes.filter(t => now - t < POP_WINDOW_MS);
        if (clickTimes.length >= POP_THRESHOLD) {
            pop();
            return true;
        }
        updateInflate(clickTimes.length);
        scheduleInflateReset();
        return false;
    }

    function registerClick() {
        if (registerHit()) return;
        restartAnimation('excited', 500);
        playClickSound();
        const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'it';
        const lines = LINES[lang] || LINES.it;
        showBubble(lines[Math.floor(Math.random() * lines.length)]);
    }

    // Throw physics: once let go after a real drag, the mascot keeps the
    // velocity it had at release and falls/bounces like a thrown ball —
    // gravity, air drag, wall/floor bounces with energy loss and friction,
    // until it settles. Skipped under reduced motion (just lands where
    // dropped).
    const GRAVITY = 2200; // px/s^2
    const AIR_DRAG = 0.7; // exponential horizontal decay constant, per second
    const RESTITUTION = 0.58; // energy kept per bounce
    const FRICTION = 0.8; // extra horizontal damping per floor bounce
    const REST_VEL = 55; // px/s below which a bounce is considered settled
    const BOUNCE_SOUND_VEL = 150; // px/s impact speed worth a sound/squash

    function squashBounce(scaleX, scaleY) {
        mascot.style.setProperty('--mascot-squash-x', scaleX);
        mascot.style.setProperty('--mascot-squash-y', scaleY);
        window.setTimeout(() => {
            mascot.style.setProperty('--mascot-squash-x', 1);
            mascot.style.setProperty('--mascot-squash-y', 1);
        }, 90);
    }

    // A dazed stagger: a decaying side-to-side sway (with a matching gentle
    // rotation) instead of a clean stop — played only when the mascot was
    // shaken around mid-drag, so it looks visibly woozy when set down.
    function wobbleSettle(baseX) {
        const start = performance.now();
        const DURATION = 900;
        const AMPLITUDE = 16;
        const FREQ = 13;

        function step(now) {
            const elapsed = now - start;
            if (elapsed >= DURATION) {
                mascot.style.left = baseX + 'px';
                mascot.style.setProperty('--mascot-rotate', '0deg');
                mascot.classList.remove('thrown');
                isThrown = false;
                return;
            }
            const t = elapsed / 1000;
            const decay = 1 - elapsed / DURATION;
            const sway = Math.sin(t * FREQ) * AMPLITUDE * decay;
            mascot.style.left = (baseX + sway) + 'px';
            mascot.style.setProperty('--mascot-rotate', (sway * 0.6).toFixed(2) + 'deg');
            requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    // Page-hit reactions: while airborne mid-throw, the mascot can collide
    // with pills/buttons/links elsewhere on the page. It's a pure visual
    // knock — the element spins a whole number of turns (always landing
    // back at its original orientation) and the mascot bounces off it —
    // nothing is ever removed or altered in the DOM, so the site stays
    // fully usable during and after.
    const HITTABLE_SELECTOR = '.role, .btn, .logo, .nav-menu a, .footer a, .hub-dot, .sub-dot';
    const MASCOT_BASE_RADIUS = 19; // half of --mascot-base
    const HIT_COOLDOWN_MS = 500;
    const HIT_RESTITUTION = 0.4; // weaker than a wall — the element isn't rigid
    const hitCooldowns = new Map();

    function nearestPointDelta(cx, cy, rect) {
        const nx = Math.max(rect.left, Math.min(cx, rect.right));
        const ny = Math.max(rect.top, Math.min(cy, rect.bottom));
        return { dx: cx - nx, dy: cy - ny };
    }

    function spinElement(el, vx) {
        const now = performance.now();
        const last = hitCooldowns.get(el) || 0;
        if (now - last < HIT_COOLDOWN_MS) return false;
        hitCooldowns.set(el, now);

        const speed = Math.hypot(vx, 400);
        const turns = Math.max(1, Math.min(3, Math.round(1 + speed / 900)));
        const deg = (vx >= 0 ? 1 : -1) * turns * 360;
        el.style.setProperty('--impact-turns', deg + 'deg');
        el.classList.remove('page-hit');
        void el.offsetWidth; // force reflow so the animation can replay
        el.classList.add('page-hit');
        window.setTimeout(() => el.classList.remove('page-hit'), 600);
        return true;
    }

    function checkPageHits(hittableRects, cx, cy, vx, vy) {
        const r = MASCOT_BASE_RADIUS * currentInflateScale;
        for (const { el, rect } of hittableRects) {
            const { dx, dy } = nearestPointDelta(cx, cy, rect);
            if (dx * dx + dy * dy > r * r) continue;
            if (!spinElement(el, vx)) continue;

            // Bounce off whichever axis the impact mostly came from.
            if (Math.abs(dx) >= Math.abs(dy)) {
                vx = -vx * HIT_RESTITUTION;
            } else {
                vy = -vy * HIT_RESTITUTION;
            }

            if (registerHit()) {
                return { vx, vy, popped: true };
            }
            squashBounce(1.2, 0.85);
            playHitSound();
            playCrackSound();
            burstParticles();
            break; // one hit per frame is plenty — avoids double-counting overlaps
        }
        return { vx, vy, popped: false };
    }

    function throwMascot(vx, vy, dizzy) {
        isThrown = true;
        mascot.classList.add('thrown');
        let lastT = performance.now();

        // Snapshot hittable elements once per throw (layout doesn't change
        // mid-flight) instead of querying/measuring the DOM every frame.
        const hittableRects = reduceMotion ? [] : Array.from(document.querySelectorAll(HITTABLE_SELECTOR))
            .map(el => ({ el, rect: el.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0);

        function step(now) {
            const dt = Math.min(0.032, (now - lastT) / 1000);
            lastT = now;
            vy += GRAVITY * dt;
            vx *= Math.exp(-AIR_DRAG * dt);

            let nx = pos.x + vx * dt;
            let ny = pos.y + vy * dt;

            if (nx < MARGIN) {
                nx = MARGIN;
                vx = -vx * RESTITUTION;
                if (Math.abs(vx) > BOUNCE_SOUND_VEL) squashBounce(0.75, 1.3);
            } else if (nx > window.innerWidth - MARGIN) {
                nx = window.innerWidth - MARGIN;
                vx = -vx * RESTITUTION;
                if (Math.abs(vx) > BOUNCE_SOUND_VEL) squashBounce(0.75, 1.3);
            }

            if (ny < MARGIN) {
                ny = MARGIN;
                vy = -vy * RESTITUTION;
            }

            const floor = window.innerHeight - MARGIN;
            let settled = false;
            if (ny >= floor) {
                ny = floor;
                if (Math.abs(vy) > REST_VEL) {
                    if (Math.abs(vy) > BOUNCE_SOUND_VEL) {
                        restartAnimation('dropped', 200);
                        playDropSound();
                        squashBounce(1.32, 0.7);
                    }
                    vy = -vy * RESTITUTION;
                    vx *= FRICTION;
                } else {
                    vy = 0;
                    vx *= FRICTION;
                    settled = Math.abs(vx) < 12;
                }
            }

            if (hittableRects.length) {
                const hit = checkPageHits(hittableRects, nx, ny, vx, vy);
                vx = hit.vx;
                vy = hit.vy;
                if (hit.popped) {
                    // The streak just crossed the pop threshold — pop()
                    // takes over positioning/animation on its own timers,
                    // so the physics loop stops here instead of fighting it.
                    mascot.classList.remove('thrown');
                    isThrown = false;
                    return;
                }
            }

            pos.x = nx;
            pos.y = ny;
            mascot.style.left = pos.x + 'px';
            mascot.style.top = pos.y + 'px';

            if (!settled) {
                requestAnimationFrame(step);
            } else if (dizzy) {
                wobbleSettle(pos.x);
            } else {
                mascot.classList.remove('thrown');
                isThrown = false;
            }
        }

        requestAnimationFrame(step);
    }

    // Pick up, drag anywhere on the page, and drop — vs. a plain click,
    // distinguished by how far the pointer actually moved.
    const SHAKE_WINDOW_MS = 650;
    const SHAKE_REVERSALS = 4; // direction flips within the window to count as "shaking it"
    const SHAKE_MIN_DELTA = 10; // px per step, filters out jitter

    mascot.addEventListener('pointerdown', (e) => {
        if (isPopped || isThrown) return;
        dragStart = { x: e.clientX, y: e.clientY, mascotX: pos.x, mascotY: pos.y };
        dragMoved = 0;
        moveHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        isDizzy = false;
        shakeReversalTimes = [];
        lastShakeDxSign = 0;
        mascot.setPointerCapture(e.pointerId);
    });

    mascot.addEventListener('pointermove', (e) => {
        if (!dragStart) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        dragMoved = Math.max(dragMoved, Math.hypot(dx, dy));
        if (dragMoved > 5) {
            if (!isDragging) {
                isDragging = true;
                mascot.classList.add('dragging');
            }
            place(dragStart.mascotX + dx, dragStart.mascotY + dy);

            // Shake detection: rapid left-right direction reversals mid-drag
            // means the visitor is roughing the mascot up, not just moving
            // it — worth a dazed reaction of its own.
            const prevPoint = moveHistory[moveHistory.length - 1];
            const stepDx = e.clientX - prevPoint.x;
            if (Math.abs(stepDx) > SHAKE_MIN_DELTA) {
                const sign = stepDx > 0 ? 1 : -1;
                if (lastShakeDxSign !== 0 && sign !== lastShakeDxSign) {
                    const now = performance.now();
                    shakeReversalTimes.push(now);
                    shakeReversalTimes = shakeReversalTimes.filter(t => now - t < SHAKE_WINDOW_MS);
                    if (!isDizzy && shakeReversalTimes.length >= SHAKE_REVERSALS) {
                        isDizzy = true;
                        playDizzySound();
                    }
                }
                lastShakeDxSign = sign;
            }

            moveHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
            // Keep only the last ~100ms of movement — recent velocity is
            // what a real throw cares about, not the whole drag history.
            const cutoff = performance.now() - 100;
            while (moveHistory.length > 2 && moveHistory[0].t < cutoff) moveHistory.shift();
        }
    });

    function endDrag() {
        if (!dragStart) return;
        const wasDragging = isDragging;
        if (wasDragging) {
            mascot.classList.remove('dragging');
            if (reduceMotion) {
                restartAnimation('dropped', 400);
                playDropSound();
            } else {
                let vx = 0, vy = 0;
                if (moveHistory.length >= 2) {
                    const first = moveHistory[0];
                    const last = moveHistory[moveHistory.length - 1];
                    const dt = (last.t - first.t) / 1000;
                    if (dt > 0) {
                        vx = (last.x - first.x) / dt;
                        vy = (last.y - first.y) / dt;
                    }
                }
                const MAX_VEL = 2600;
                const speed = Math.hypot(vx, vy);
                if (speed > MAX_VEL) {
                    vx = (vx / speed) * MAX_VEL;
                    vy = (vy / speed) * MAX_VEL;
                }
                throwMascot(vx, vy, isDizzy);
            }
        }
        isDragging = false;
        dragStart = null;
        moveHistory = [];
        if (!wasDragging) registerClick();
    }

    mascot.addEventListener('pointerup', endDrag);
    mascot.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', () => place(pos.x, pos.y));
})();
