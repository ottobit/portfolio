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

        document.querySelectorAll('[data-it]').forEach(el => {
            if (!el.dataset.en) el.dataset.en = el.textContent;
            el.textContent = lang === 'it' ? el.dataset.it : el.dataset.en;
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

    const NAV_TOGGLE_TEXT = {
        it: { open: 'Apri menu', close: 'Chiudi menu' },
        en: { open: 'Open menu', close: 'Close menu' }
    };

    function updateToggleLabel() {
        const lang = siteState.getLang();
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

    function render() {
        const items = latestHistory.slice(0, getNewsHistoryLimit());
        list.innerHTML = '';
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
        section.hidden = items.length === 0;
        divider.hidden = items.length === 0;
    }

    document.addEventListener('dotnewshistory', (e) => {
        latestHistory = e.detail || [];
        render();
    });

    // Re-render on breakpoint crossing (e.g. rotating a tablet) so the
    // shown count matches the new limit without waiting for fresh news.
    window.matchMedia('(max-width: 768px)').addEventListener('change', render);
})();

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

// Hub/sub-node graph: dots overlaid on the hero canvas, same layout at every
// breakpoint (just larger tap targets on small screens), sharing one detail
// panel shown as a fixed overlay anchored to the bottom of the viewport (no
// scrolling needed).
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
    const detailPage = document.getElementById('detail-page');
    const detailPageIcon = document.getElementById('detail-page-icon');
    const detailPageLabel = document.getElementById('detail-page-label');
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
        const baseRate = opts.rate ?? 1;
        const basePitch = opts.pitch ?? 1;
        let i = 0;
        function next() {
            if (i >= sentences.length) { onDone(); return; }
            const u = new SpeechSynthesisUtterance(sentences[i]);
            Object.assign(u, opts);
            // A little per-sentence variation in rate/pitch/pause — a real
            // speaker never hits the exact same cadence twice in a row, and
            // that mechanical uniformity is usually the first giveaway that
            // a voice is synthetic.
            u.rate = baseRate + (Math.random() - 0.5) * 0.08;
            u.pitch = Math.min(2, Math.max(0, basePitch + (Math.random() - 0.5) * 0.1));
            i++;
            u.onend = () => window.setTimeout(next, 90 + Math.random() * 90);
            u.onerror = onDone;
            window.speechSynthesis.speak(u);
        }
        next();
    }

    const LINK_TEXT = {
        it: { repo: 'Codice', link: 'Vedi live', listen: 'Ascolta', stop: 'Ferma', closePanel: 'Chiudi dettaglio' },
        en: { repo: 'Code', link: 'Live demo', listen: 'Listen', stop: 'Stop', closePanel: 'Close detail' }
    };

    // Dedicated sub-pages linked from the detail panel (evolution.html's
    // timeline, cerebro.html's diagram) — icon/label per target page, keyed
    // by the same href set in data-page.
    const PAGE_LINK_TEXT = {
        'evolution.html': { icon: '🕰️', it: 'Timeline', en: 'Timeline' },
        'cerebro.html': { icon: '🔗', it: 'Progetto', en: 'Project' },
        'dot-world.html': { icon: '🔗', it: 'Progetto', en: 'Project' },
        'triple-triad.html': { icon: '🔗', it: 'Progetto', en: 'Project' }
    };

    let currentEl = null;
    let triggerEl = null;

    function updateCloseLabel() {
        if (detailClose) detailClose.setAttribute('aria-label', LINK_TEXT[siteState.getLang()].closePanel);
    }

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
        if (triggerEl) {
            triggerEl.focus();
            triggerEl = null;
        }
        window.setTimeout(() => {
            detailPanel.hidden = true;
            if (detailBackdrop) detailBackdrop.hidden = true;
        }, reduceMotion ? 0 : 300);
    }

    function renderDetail(el) {
        const lang = siteState.getLang();
        const title = (lang === 'it' && el.dataset.titleIt) || el.dataset.title || '';
        const text = (lang === 'it' && el.dataset.detailIt) || el.dataset.detail || '';

        // innerHTML for nodes that need more than a single emoji glyph (e.g.
        // "Dot World"'s globe + a little cluster of dot-colored circles) —
        // same static, developer-authored-only content as detailText below,
        // never user input. Falls back to plain text for every other node.
        if (el.dataset.iconHtml) {
            detailIcon.innerHTML = el.dataset.iconHtml;
        } else {
            detailIcon.textContent = el.dataset.icon || '';
        }
        detailTitle.textContent = title;
        // innerHTML, not textContent: a node's own text can carry a plain
        // inline <a> (e.g. "Questo sito" linking out to the Web Speech API
        // docs mid-sentence) instead of needing a separate pill/button for
        // it. The content is static, developer-authored markup in
        // index.html, never user input.
        detailText.innerHTML = text;

        // Optional repo/live-demo links — only shown when a node provides
        // them, so lightweight entries (like most About/Social nodes) stay
        // text-only. A plain reference link belongs inline in the text
        // itself (see above), not as a separate button here.
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
        if (detailPage) {
            const pageInfo = el.dataset.page && PAGE_LINK_TEXT[el.dataset.page];
            detailPage.hidden = !pageInfo;
            if (pageInfo) {
                detailPage.href = el.dataset.page;
                if (detailPageIcon) detailPageIcon.textContent = pageInfo.icon;
                if (detailPageLabel) detailPageLabel.textContent = pageInfo[lang];
            }
        }
        stopSpeech();
    }

    function openDetail(el) {
        currentEl = el;
        triggerEl = el;
        renderDetail(el);

        detailPanel.hidden = false;
        if (detailBackdrop) detailBackdrop.hidden = false;
        requestAnimationFrame(() => {
            detailPanel.classList.add('visible');
            if (detailBackdrop) detailBackdrop.classList.add('visible');
        });
        if (detailClose) detailClose.focus();
        document.dispatchEvent(new CustomEvent('graphinteraction'));
    }

    if (detailClose) detailClose.addEventListener('click', closeDetail);
    if (detailBackdrop) detailBackdrop.addEventListener('click', closeDetail);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (detailPanel.classList.contains('visible')) closeDetail();
    });

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
        updateCloseLabel();
    });
    updateCloseLabel();

    // --- Dots overlaid directly on the hero canvas, same at every breakpoint ---
    const heroVisual = document.querySelector('.hero-visual');
    const overlay = document.getElementById('hub-overlay');
    const svg = document.getElementById('graph-lines');
    const networkCanvas = document.getElementById('network-canvas');
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
        // Radius must respect BOTH panel dimensions: on mobile the panel is
        // full-width but short, so a width-only radius overshoots the real
        // vertical clearance and rings end up overlapping a neighboring hub.
        // On desktop panelHeight is always far larger than needed here, so
        // this reduces to the previous width-only behavior unchanged.
        const widthRadius = Math.min(170, Math.max(95, panelWidth * 0.3));
        const heightRadius = Math.max(60, panelHeight * 0.42);
        const capRadius = Math.min(widthRadius, heightRadius);
        // A dense hub (e.g. About's 6 sub-dots) needs a wider ring so its own
        // sub-dots don't collide with each other — but growing that ring at
        // the same rate when the panel is height-capped (mobile) just pushes
        // the ring into a neighboring hub instead. Grow it more gently in
        // that case and let the relax pass below (which now also pushes
        // clear of other hubs' chips) settle the rest.
        const growthPerExtra = capRadius === heightRadius ? 8 : 16;
        const baseRadius = capRadius + Math.max(0, count - 3) * growthPerExtra;
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

        // Other hubs' own chips never move, but a sub-dot ring can still
        // reach far enough to sit on top of one on short mobile panels —
        // treat them (not the current hub, which the ring is meant to
        // radiate close to) as fixed obstacles in the relax pass below.
        // Active/hovered hub-dots render 8% larger (`.hub-dot.active`/
        // `:hover` scale transform) without changing offsetWidth/Height, so
        // pad the obstacle box to match what's actually painted — otherwise
        // the collision math clears a gap the scaled-up chip still overlaps.
        // 1.08 left a couple of small edge/corner touches on the
        // shortest mobile panels — a wider pad gives the relax pass a bit
        // more room to push clear where the panel has space to spare.
        const hubObstacles = hubDots
            .filter(h => h !== hub)
            .map(h => ({
                x: (parseFloat(h.dataset.x) / 100) * panelWidth,
                y: (parseFloat(h.dataset.y) / 100) * panelHeight,
                w: (h.offsetWidth || 90) * 1.15,
                h: (h.offsetHeight || 36) * 1.15
            }));

        // Relax any remaining overlap (e.g. tight radius on small panels)
        // by nudging colliding pairs apart along their separation vector,
        // and pushing any point clear of another hub's chip. More passes
        // than the sub-vs-sub-only case needed, since a dense ring (e.g.
        // About's 6 sub-dots) fighting a fixed hub obstacle on a short
        // mobile panel takes longer to settle.
        for (let pass = 0; pass < 24; pass++) {
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

                const p = points[i];
                for (const ob of hubObstacles) {
                    const minDx = (p.w + ob.w) / 2 + gap;
                    const minDy = (p.h + ob.h) / 2 + gap / 2;
                    const dx = p.x - ob.x;
                    const dy = p.y - ob.y;
                    if (Math.abs(dx) >= minDx || Math.abs(dy) >= minDy) continue;
                    const overlapX = minDx - Math.abs(dx);
                    const overlapY = minDy - Math.abs(dy);
                    // Obstacle is fixed, so resolve along whichever axis
                    // needs the smaller nudge (minimum-translation push)
                    // instead of a diagonal step. Two hub-dots close enough
                    // together can each demand a full push on opposite Y
                    // sides, which would bounce a sub-dot forever between
                    // them — damping the step lets the passes above settle
                    // toward a resting point that minimizes overlap instead
                    // of oscillating between two full corrections.
                    if (overlapX < overlapY) {
                        p.x += (dx < 0 ? -1 : 1) * (overlapX * 0.5 + 0.5);
                    } else {
                        p.y += (dy < 0 ? -1 : 1) * (overlapY * 0.5 + 0.5);
                    }
                    moved = true;
                }
            }

            // Chips are fixed (no pan to reach ones past the edge), so clamp
            // each point within the panel at the end of every pass — not
            // just once at the very end — otherwise a push that resolves an
            // overlap by landing outside the panel gets pulled back by the
            // final clamp with no chance to re-relax, silently undoing the
            // fix on short mobile panels.
            for (const p of points) {
                const marginX = p.w / 2 + 10;
                const marginY = p.h / 2 + 10;
                p.x = Math.max(marginX, Math.min(panelWidth - marginX, p.x));
                p.y = Math.max(marginY, Math.min(panelHeight - marginY, p.y));
            }

            if (!moved) break;
        }

        points.forEach(p => {
            p.sub.style.left = p.x + 'px';
            p.sub.style.top = p.y + 'px';
            p.sub.classList.toggle('label-left', p.x < hx - 10);
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
        hub.setAttribute('aria-expanded', 'false');
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
            if (networkCanvas) networkCanvas.classList.remove('dimmed');
            return;
        }

        hub.classList.add('active');
        hub.setAttribute('aria-expanded', 'true');
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
        if (networkCanvas) networkCanvas.classList.add('dimmed');
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
// Shared across every mascot instance (original + any split-off clones):
// one page-wide reduced-motion check, and the word-parting system, which
// touches shared DOM (.description p) and would corrupt itself if it ran
// once per mascot instead of once for the page.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Moses effect: the bio text doesn't block a mascot — it parts around it
// as it passes, then closes back up. Each word is wrapped in its own span
// so it can be nudged sideways independently, purely via transform
// (content/layout untouched, nothing to ever "fix" back). Page-wide, not
// per-mascot: wrapping the same paragraph twice would nest spans inside
// spans and corrupt it.
const PART_TEXT_SELECTOR = '.description p';
const PART_INFLUENCE = 70; // px, horizontal reach of the effect
const PART_MAX_PUSH = 26; // px, shove on the word right next to the ball
let wordRects = [];

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

function updateTextParting(cx, cy) {
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

// A little animated node that gets excited on graph interaction, can be
// picked up and dragged around, and "pops" if you mash clicks on it —
// then recovers a moment later. Double-click/tap splits it into a second,
// fully independent one (up to MAX_MASCOTS total). Pure fun, no
// functional role — safe to fail silently if missing.
let mascotInstanceCount = 0;
const MAX_MASCOTS = 6;

// Registry of every currently-active mascot instance ("dot" and any of its
// split-off clones), so each one can notice when another gets close enough
// to merge back into it — the reverse of splitting.
const activeMascots = [];
// Page-wide: has any real user gesture happened yet? A mascot's very first
// automatic action (its own birth-at-load animation) fires before any
// visitor interaction, so it must not try to play a sound — the browser's
// autoplay policy would just log an "AudioContext was not allowed to
// start" warning for a sound that can't be heard anyway.
let hasUserGesture = false;
document.addEventListener('pointerdown', () => { hasUserGesture = true; }, { once: true, capture: true });
document.addEventListener('keydown', () => { hasUserGesture = true; }, { once: true, capture: true });

// When the page was last touched by an actual person, and who wants to know.
// dot uses it to fall asleep once it's been left alone (see the mascot
// controller): news arriving on its own doesn't count as company, only a
// real gesture does — otherwise it would be woken every 25 seconds by its
// own feed and never get to sleep at all.
let lastActivityAt = Date.now();
const wakeCallbacks = new Set();
['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(type => {
    document.addEventListener(type, () => {
        lastActivityAt = Date.now();
        wakeCallbacks.forEach(fn => fn());
    }, { passive: true, capture: true });
});
const MERGE_DISTANCE = 45; // px between centers
// A clone is born right next to the original and often gets thrown/hops
// straight back into merge range within moments — it would visibly hop
// once or twice, then quietly vanish, reading as "it doesn't hop" rather
// than "it just got reabsorbed". A short immunity window after birth lets
// it actually be seen bouncing around on its own first.
const MERGE_GRACE_MS = 2500;

// If mashing dot into a pop (registerHit() hitting POP_THRESHOLD) happens
// this many times within this rolling window, the next one escalates into
// a full rage instead of the usual quick pop — a longer fuse than the pop
// threshold itself, so it takes sustained pestering across several bursts,
// not just one.
let angerStreak = 0;
let angerStreakResetTimer = null;
const ANGER_STREAK_THRESHOLD = 3;
const ANGER_STREAK_WINDOW_MS = 20000;

// Shared by all the news-feed fetchers below: parses JSON, throws on a
// non-OK response, and — unlike a bare fetch() — actually gives up after a
// while instead of hanging forever if a request stalls.
const NEWS_FETCH_TIMEOUT_MS = 8000;
async function fetchJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
    } finally {
        window.clearTimeout(timer);
    }
}

// A lightweight, read-only feed of this project's own GitHub activity —
// shown occasionally in dot's speech bubble alongside its usual random
// one-liners. GitHub's public events API is CORS-open and needs no
// auth/key for public data (verified: Access-Control-Allow-Origin: *),
// so this stays a plain client-side fetch — no backend, matching the
// same constraint that ruled out Deepgram/an LLM chatbot earlier.
// Unauthenticated requests are capped at 60/hour per visitor IP; one
// fetch per page load is nowhere close.
const GITHUB_NEWS_REPO = 'ottobit/portfolio';
let githubNewsItems = [];
async function fetchGithubNews() {
    try {
        // The Events API (used previously) truncates PullRequestEvent's
        // pull_request object down to a handful of fields — no title, no
        // html_url, no merged flag — and often ships PushEvents with an
        // empty commits[] for API-driven pushes (like a merge done through
        // the GitHub API rather than a raw git push). Both meant this feed
        // silently found nothing to show despite the API itself responding
        // fine. The commit history is a much more reliable source: every
        // commit always carries its message and html_url.
        const commits = await fetchJson(`https://api.github.com/repos/${GITHUB_NEWS_REPO}/commits?per_page=20`);
        const items = [];
        const seenText = new Set();
        for (const c of commits) {
            const msg = ((c.commit && c.commit.message) || '').split('\n')[0].trim();
            // Skip merge commits ("Merge pull request #NN from ...") — the
            // feature branch's own commit right after it already carries
            // the real, human-written title.
            if (msg && !/^merge /i.test(msg) && !seenText.has(msg)) {
                seenText.add(msg);
                items.push({ text: msg, url: c.html_url, icon: '📰' });
            }
            if (items.length >= 8) break;
        }
        githubNewsItems = items;
    } catch (err) {
        // Offline, rate-limited, or blocked — dot's normal random lines
        // are a perfectly fine fallback for the visitor either way, but a
        // console warning still helps diagnose a real outage.
        console.warn('[dot] GitHub feed failed:', err);
    }
}

// AI theme: Hugging Face's public trending-models listing. Same
// no-backend constraint as GitHub above — verified CORS-open, no key
// needed for public data.
let aiNewsItems = [];
async function fetchAiNews() {
    try {
        // "trending" is a website-only sort (huggingface.co/models?sort=trending) —
        // the actual REST API rejects it with a 400, since `sort` there must be a
        // real ModelInfo property (downloads, likes, lastModified, ...) paired
        // with `direction=-1` for descending. Sorting by downloads surfaces
        // popular-but-often-old models (the same handful stay on top for
        // years) — lastModified favors what's actually being worked on right
        // now, a better fit for "recent news" than raw popularity.
        const models = await fetchJson('https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=8');
        aiNewsItems = models
            .filter(m => m.id)
            .map(m => ({ text: `updated on Hugging Face: ${m.id}`, url: `https://huggingface.co/${m.id}`, icon: '🤖' }));
    } catch (err) {
        // Same fallback as the GitHub feed — offline/blocked/CORS just
        // means this dot sticks to its usual random one-liners.
        console.warn('[dot] AI feed failed:', err);
    }
}

// World theme: Hacker News' public top-stories feed — real, live world/tech
// news refreshed continuously (previously Wikipedia's "on this day", which
// sounds like news but is the opposite: it always surfaces past-year
// anniversaries for today's date, never anything actually current). No key
// needed, CORS-open, backed by Firebase.
let worldNewsItems = [];
async function fetchWorldNews() {
    try {
        const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 8);
        const stories = await Promise.all(ids.map(id =>
            fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
        ));
        worldNewsItems = stories
            .filter(s => s && s.title)
            .map(s => ({
                text: s.title,
                // A self-post (Ask/Show HN) has no external url — fall back
                // to its own HN discussion page.
                url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
                icon: '🌍'
            }));
    } catch (err) {
        console.warn('[dot] world feed failed:', err);
    }
}

// Weather theme: Open-Meteo's public forecast API — no key, no signup,
// CORS-open. A handful of fixed cities around the world rather than the
// visitor's own location (no geolocation prompt needed for a mascot's
// speech bubble).
const WEATHER_CITIES = [
    { name: 'Rome', it: 'Roma', lat: 41.9028, lon: 12.4964 },
    { name: 'New York', it: 'New York', lat: 40.7128, lon: -74.006 },
    { name: 'Tokyo', it: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'London', it: 'Londra', lat: 51.5074, lon: -0.1278 },
    { name: 'Sydney', it: 'Sydney', lat: -33.8688, lon: 151.2093 }
];
let weatherNewsItems = [];
async function fetchWeatherNews() {
    try {
        const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'en';
        const results = await Promise.all(WEATHER_CITIES.map(async city => {
            try {
                const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m`);
                const temp = data.current && data.current.temperature_2m;
                if (temp === undefined) return null;
                const cityName = lang === 'it' ? city.it : city.name;
                const text = lang === 'it' ? `${Math.round(temp)}°C a ${cityName} in questo momento` : `${Math.round(temp)}°C in ${cityName} right now`;
                return { text, url: null, icon: '🌤️' };
            } catch (err) {
                console.warn(`[dot] weather feed: ${city.name} failed:`, err);
                return null;
            }
        }));
        weatherNewsItems = results.filter(Boolean);
    } catch (err) {
        console.warn('[dot] weather feed failed:', err);
    }
}

// Space theme: NASA's Astronomy Picture of the Day. Uses NASA's public
// DEMO_KEY — documented, rate-limited but usable without any signup of our
// own (https://api.nasa.gov). Only one item per day, that's fine: the pool
// below handles feeds of any length.
let spaceNewsItems = [];
async function fetchSpaceNews() {
    try {
        // The shared DEMO_KEY is rate-limited (30/hour, 50/day per IP) — a
        // failure here often just means someone on this network already
        // used it up for the day, not that the feed is broken.
        const data = await fetchJson('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        if (!data.title) return;
        spaceNewsItems = [{
            text: `NASA APOD: ${data.title}`,
            url: data.url || 'https://apod.nasa.gov/apod/astropix.html',
            icon: '🔭'
        }];
    } catch (err) {
        console.warn('[dot] space feed failed:', err);
    }
}

// Trending theme: Wikipedia's official pageviews-top API — what the world
// is actually reading right now, not "on this day in history". No key,
// CORS-open. Pageview data has a ~2 day processing lag, so "today" is never
// populated yet — go back 2 days to reliably land on a ready one.
let trendingNewsItems = [];
async function fetchTrendingNews() {
    try {
        const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'en';
        const wikiLang = lang === 'it' ? 'it' : 'en';
        const d = new Date();
        d.setDate(d.getDate() - 2);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const data = await fetchJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${wikiLang}.wikipedia/all-access/${yyyy}/${mm}/${dd}`);
        const articles = (data.items && data.items[0] && data.items[0].articles) || [];
        trendingNewsItems = articles
            .filter(a => a.article && !/^(Special:|Wikipedia:|Main_Page|Portale:|Speciale:|Pagina_principale)/.test(a.article))
            .slice(0, 8)
            .map(a => ({
                text: `trending on Wikipedia: ${a.article.replace(/_/g, ' ')}`,
                url: `https://${wikiLang}.wikipedia.org/wiki/${a.article}`,
                icon: '📈'
            }));
    } catch (err) {
        console.warn('[dot] trending feed failed:', err);
    }
}

// Music theme: Apple's public iTunes RSS feed of top songs. No key, no
// signup — the same feeds sites embed client-side (Access-Control-Allow-
// Origin: * on the /json variant).
let musicNewsItems = [];
async function fetchMusicNews() {
    try {
        const data = await fetchJson('https://itunes.apple.com/us/rss/topsongs/limit=8/json');
        const entries = (data.feed && data.feed.entry) || [];
        musicNewsItems = entries
            .filter(e => e['im:name'] && e['im:name'].label)
            .map(e => ({
                text: `top of the charts: ${e['im:artist'].label} — ${e['im:name'].label}`,
                url: (e.id && e.id.label) || null,
                icon: '🎵'
            }));
    } catch (err) {
        console.warn('[dot] music feed failed:', err);
    }
}

// Fashion theme: reddit.com/r/fashion's public top-of-the-day listing.
// Same no-key, CORS-open constraint as the other feeds — reddit's .json
// endpoints serve Access-Control-Allow-Origin: * for public read access.
let fashionNewsItems = [];
async function fetchFashionNews() {
    try {
        const data = await fetchJson('https://www.reddit.com/r/fashion/top.json?limit=8&t=day');
        const posts = (data.data && data.data.children) || [];
        fashionNewsItems = posts
            .filter(p => p.data && p.data.title)
            .map(p => ({ text: p.data.title, url: `https://www.reddit.com${p.data.permalink}`, icon: '👗' }));
    } catch (err) {
        console.warn('[dot] fashion feed failed:', err);
    }
}

// Cinema theme: reddit.com/r/movies' public top-of-the-day listing. Same
// source/shape as the fashion feed above, different subreddit.
let cinemaNewsItems = [];
async function fetchCinemaNews() {
    try {
        const data = await fetchJson('https://www.reddit.com/r/movies/top.json?limit=8&t=day');
        const posts = (data.data && data.data.children) || [];
        cinemaNewsItems = posts
            .filter(p => p.data && p.data.title)
            .map(p => ({ text: p.data.title, url: `https://www.reddit.com${p.data.permalink}`, icon: '🎬' }));
    } catch (err) {
        console.warn('[dot] cinema feed failed:', err);
    }
}

// Jobs theme: RemoteOK's public job-board API — real, live remote-tech job
// postings, no key, no signup. Fits this site's own subject matter (a
// developer's portfolio) better than a generic hiring-board feed would.
// The first array element is RemoteOK's own legal notice, not a job — it
// has no `position`/`company`, so the filter below drops it same as any
// malformed entry.
let jobsNewsItems = [];
async function fetchJobsNews() {
    try {
        const jobs = await fetchJson('https://remoteok.com/api');
        jobsNewsItems = jobs
            .filter(j => j.position && j.company && j.url)
            .slice(0, 8)
            .map(j => ({ text: `hiring remote: ${j.company} — ${j.position}`, url: j.url, icon: '💼' }));
    } catch (err) {
        console.warn('[dot] jobs feed failed:', err);
    }
}

// Italy jobs theme: Arbeitnow's public job-board API, filtered client-side
// to postings whose location mentions Italy — RemoteOK above has no
// country filter of its own (nearly every listing there is just "remote
// worldwide"), so a dedicated, geography-aware source was worth adding
// rather than filtering RemoteOK down to almost nothing. Same icon as the
// RemoteOK feed (💼) — both are "jobs", and the nav's job highlight keys
// off the icon, not the source. No key, no signup.
let italyJobsNewsItems = [];
async function fetchItalyJobsNews() {
    try {
        const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api');
        const jobs = (data && data.data) || [];
        italyJobsNewsItems = jobs
            .filter(j => j.title && j.company_name && j.url && /italy|italia/i.test(j.location || ''))
            .slice(0, 8)
            .map(j => ({ text: `hiring in Italy: ${j.company_name} — ${j.title}`, url: j.url, icon: '💼' }));
    } catch (err) {
        console.warn('[dot] Italy jobs feed failed:', err);
    }
}

// All feeds pooled together, not split one-per-dot — every dot pulls from
// the same combined pool, so nobody has to wait for "the right one" to see
// a specific source. Round-robin interleaved (not one feed's items
// exhausted before the next's) so consecutive reveals naturally rotate
// between sources.
function getAllNewsItems() {
    const lists = [githubNewsItems, aiNewsItems, worldNewsItems, weatherNewsItems, spaceNewsItems, trendingNewsItems, musicNewsItems, fashionNewsItems, cinemaNewsItems, jobsNewsItems, italyJobsNewsItems];
    const combined = [];
    const maxLen = lists.reduce((max, l) => Math.max(max, l.length), 0);
    for (let i = 0; i < maxLen; i++) {
        for (const list of lists) {
            if (list[i]) combined.push(list[i]);
        }
    }
    return combined;
}

// Truncated with an ellipsis in the nav (see .nav-news-list CSS), so the
// limit can afford to be breakpoint-aware: more vertical room on desktop
// than in a mobile dropdown. Same 768px line the rest of the site already
// treats as the mobile/desktop split (see .hero's max-width:768px rule).
const NEWS_HISTORY_LIMIT_DESKTOP = 6;
const NEWS_HISTORY_LIMIT_MOBILE = 4;
function getNewsHistoryLimit() {
    return window.matchMedia('(max-width: 768px)').matches ? NEWS_HISTORY_LIMIT_MOBILE : NEWS_HISTORY_LIMIT_DESKTOP;
}

let notifiedNewsHistory = [];

function recordNotifiedNews(item) {
    notifiedNewsHistory = [item, ...notifiedNewsHistory.filter(i => i.text !== item.text)].slice(0, NEWS_HISTORY_LIMIT_DESKTOP);
    document.dispatchEvent(new CustomEvent('dotnewshistory', { detail: notifiedNewsHistory }));
}

async function refetchAllNews() {
    await Promise.all([
        fetchGithubNews(),
        fetchAiNews(),
        fetchWorldNews(),
        fetchWeatherNews(),
        fetchSpaceNews(),
        fetchTrendingNews(),
        fetchMusicNews(),
        fetchFashionNews(),
        fetchCinemaNews(),
        fetchJobsNews(),
        fetchItalyJobsNews()
    ]);
}
// The initial population doesn't need to happen at parse time — dot's
// first news reveal is never before ~25s (see scheduleNews below), so a
// short delay here is invisible to a visitor but avoids firing a burst of
// requests to external APIs before the page has even finished settling.
window.setTimeout(refetchAllNews, 6000);
// Floor between click-triggered live refetches — mashing clicks shouldn't
// hammer a handful of rate-limited public APIs at once.
const NEWS_REFETCH_COOLDOWN_MS = 20000;
let lastNewsRefetchAt = 0;

// Where "dot" is born: the dot right after "ottobit." in the big hero
// heading (.name), not the small one in the sticky header logo. Falls back
// to the old hero-center spot if it isn't there for some reason, so a
// missing selector never leaves the mascot un-placeable.
function getLogoDotPos() {
    const nameDot = document.querySelector('.name .dot');
    if (nameDot) {
        const r = nameDot.getBoundingClientRect();
        if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
}

function checkMascotMerge(self) {
    if (self.removed || self.merging) return;
    const now = performance.now();
    if (now - self.bornAt < MERGE_GRACE_MS) return;
    for (const other of activeMascots) {
        if (other === self || other.removed || other.merging) continue;
        if (now - other.bornAt < MERGE_GRACE_MS) continue;
        const a = self.getPos();
        const b = other.getPos();
        if (Math.hypot(a.x - b.x, a.y - b.y) < MERGE_DISTANCE) {
            self.merging = true;
            other.merging = true;
            self.absorb(other);
            self.merging = false;
            return;
        }
    }
}

// Vivid, toy-like colors for split-off clones, chosen directly rather than
// derived by hue-rotating the dark brand teal (which only ever lands on
// muddy, desaturated tones). Tuned per theme so they read clearly against
// either background — deeper/saturated shades on light (white-ish)
// backgrounds, brighter/lighter shades on dark ones.
const BALL_COLORS_LIGHT = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
const BALL_COLORS_DARK = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#c084fc', '#f472b6'];

// Picks a color for a new clone, preferring one no other currently active
// mascot is already wearing — so simultaneous clones always read as
// visually distinct instead of occasionally landing on the same hue.
function pickBallColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const palette = isDark ? BALL_COLORS_DARK : BALL_COLORS_LIGHT;
    const used = new Set(activeMascots.map(h => h.getColor && h.getColor()).filter(Boolean));
    const free = palette.filter(c => !used.has(c));
    const pool = free.length ? free : palette;
    return pool[Math.floor(Math.random() * pool.length)];
}

// The color dot flashes when it's had enough — reuses each palette's own
// red rather than inventing a new one, so it stays consistent with the
// clone colors already in use.
function angryColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? BALL_COLORS_DARK[0] : BALL_COLORS_LIGHT[0];
}

function createMascotController(mascot, bubble, options = {}) {
    if (!mascot || !bubble) return;
    if (mascotInstanceCount >= MAX_MASCOTS) {
        mascot.remove();
        bubble.remove();
        return;
    }
    mascotInstanceCount++;

    const MARGIN = 20;
    const MASCOT_BASE_RADIUS = 19; // half of --mascot-base
    const POP_THRESHOLD = 6;
    const POP_WINDOW_MS = 2200;
    const BIRTH_DURATION_MS = 1100; // must match .mascot.recovering's animation-duration in styles.css
    let mascotColor = options.mascotColor || null;
    if (mascotColor) mascot.style.setProperty('--mascot-color', mascotColor);
    let instanceRemoved = false;

    const LINES = {
        it: ['Ciao! 👋'],
        en: ['Hi there! 👋']
    };
    const INTRO_LINE = { it: 'Ciao, sono dot! Prova a trascinarmi 👋', en: "Hi, I'm dot! Try dragging me 👋" };
    const NEWS_FETCH_FAILED = { it: 'non ci sono riuscito, riprova tra un po\'', en: "couldn't reach it, try again in a bit" };

    let pos = options.pos ? { x: options.pos.x, y: options.pos.y } : getLogoDotPos();
    let isDragging = false;
    let isThrown = false;
    // Bumped every time a physics loop (a hop or a throw) starts or gets
    // interrupted by a grab — each loop's step() captures its own value at
    // launch and bails the moment it no longer matches, so picking the
    // mascot up mid-flight cleanly cancels the stale loop instead of
    // leaving two of them fighting over the same position every frame.
    let flightToken = 0;
    let dragStart = null;
    let dragMoved = 0;
    let lastTapTime = 0;
    let moveHistory = [];
    let clickTimes = [];
    let isPopped = false;
    // Once a real drag+release lands dot somewhere, that spot is a deliberate
    // choice — the automatic idle wandering must never sweep it back into
    // the bottom-left zone afterwards. Reset only on rebirth (birthAtLogo),
    // so a fresh life starts wandering normally again.
    let userPlaced = false;
    let isFetchingNews = false;
    let isAsleep = false;        // left alone long enough to nod off
    let sleepCheckTimer = null;
    let isDizzy = false;
    let shakeReversalTimes = [];
    let lastShakeDxSign = 0;
    let currentInflateScale = 1;
    let inflateResetTimer = null;

    // This instance's entry in the shared registry — lets other mascots
    // find it for proximity merging, and lets this one absorb others.
    const selfHandle = {
        removed: false,
        merging: false,
        bornAt: performance.now(),
        getPos: () => pos,
        getColor: () => mascotColor,
        hasPendingNews: () => !!(newsBadge && !newsBadge.hidden),
        getNewsIndex: () => newsIndex,
        absorb(otherHandle) {
            if (otherHandle.removed) return;
            const combinedCount = Math.min(POP_THRESHOLD - 1, clickTimes.length + otherHandle.streak() + 1);
            // Whichever of the two happened to be moving is the one that
            // "wins" the merge (self) — often the plain default "dot", since
            // it's the one visitors instinctively drag around to gather up
            // its colored clones. Without this, every fusion would erase
            // color back to the site's default, no matter how many colorful
            // clones went into it. Keep a color if either side had one.
            const otherColor = otherHandle.getColor ? otherHandle.getColor() : null;
            if (!mascotColor && otherColor) {
                mascotColor = otherColor;
                mascot.style.setProperty('--mascot-color', mascotColor);
            }
            // The absorbed dot might have had a news badge lit — a story it
            // hadn't revealed yet. Without this it would just vanish with
            // the removed instance; carry it over to self instead, unless
            // self already has its own pending badge lit (never silently
            // drop that one to make room for the merged-in story).
            const otherHadNews = otherHandle.hasPendingNews && otherHandle.hasPendingNews();
            const otherNewsIndex = otherHadNews ? otherHandle.getNewsIndex() : null;
            otherHandle.remove();
            if (otherHadNews && !(newsBadge && !newsBadge.hidden)) {
                newsIndex = otherNewsIndex;
                if (newsBadge) newsBadge.hidden = false;
            }
            clickTimes = new Array(combinedCount).fill(Date.now());
            updateInflate(combinedCount);
            scheduleInflateReset();
            burstParticles({ count: 10, distance: 30, size: 6 });
            playRecoverSound();
            restartAnimation('excited', 400);
        },
        streak: () => clickTimes.length,
        // Caught in another instance's rage explosion — pops this one away
        // too, without going through the usual isPopped/streak gate (that's
        // the raging instance's own state, not this one's).
        rageBurst() {
            if (this.removed) return;
            burstParticles({ count: 14, distance: 90, size: 8 });
            burstShockwave();
            playPopSound();
            if (!reduceMotion) restartAnimation('popping');
            window.setTimeout(() => this.remove(), reduceMotion ? 0 : 260);
        },
        remove() {
            if (this.removed) return;
            this.removed = true;
            instanceRemoved = true;
            // Every popped/merged clone otherwise left its document-level
            // listeners (mousemove eye-tracking, graphinteraction) running
            // forever — dead weight that only grows the more a visitor
            // splits/merges dot, since nothing ever cleaned them up.
            document.removeEventListener('mousemove', onMouseMove);
            wakeCallbacks.delete(wakeUp);
            window.clearInterval(sleepCheckTimer);
            document.removeEventListener('graphinteraction', onGraphInteraction);
            window.removeEventListener('resize', onResize);
            // In case this instance never got its first real click/keydown
            // (its one-time audio-unlock listeners below are still pending)
            // — otherwise harmless no-ops.
            document.removeEventListener('pointerdown', getAudioCtx);
            document.removeEventListener('keydown', getAudioCtx);
            // Every clone that ever played a sound spun up its own
            // AudioContext — left open, each one is a real native resource
            // (an audio thread/graph) that a plain JS reference drop won't
            // reclaim, so a session with a lot of splitting/popping quietly
            // piled these up forever without this.
            if (audioCtx) {
                audioCtx.close().catch(() => {});
                audioCtx = null;
            }
            mascot.remove();
            bubble.remove();
            const idx = activeMascots.indexOf(this);
            if (idx >= 0) activeMascots.splice(idx, 1);
            mascotInstanceCount = Math.max(0, mascotInstanceCount - 1);
        }
    };
    activeMascots.push(selfHandle);

    // A little synthesized "creature" voice — no audio files, just Web
    // Audio oscillators/noise, so there's nothing to load or license. Silent
    // until the browser's autoplay policy is unlocked by a real user
    // gesture, then it just works.
    let audioCtx = null;
    function getAudioCtx() {
        // A removed instance's own {once: true} unlock listeners below can
        // still be sitting on `document` when this fires (the very next
        // pointerdown/keydown anywhere consumes them, whether or not this
        // instance is still around) — without this guard that spins up a
        // fresh AudioContext for a mascot that's already gone, which then
        // never gets closed since remove() already ran.
        if (instanceRemoved) return null;
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

    function playClickSound() {
        chirp({ freqStart: 320, freqEnd: 900, duration: 0.1, type: 'square', gain: 0.05 });
    }
    function playDropSound() {
        chirp({ freqStart: 320, freqEnd: 110, duration: 0.15, type: 'sine', gain: 0.04 });
    }
    function playPopSound() {
        // Layered for impact: a low thump for weight, the existing
        // crackle/sweep for texture, louder and a touch longer overall.
        chirp({ freqStart: 160, freqEnd: 40, duration: 0.18, type: 'sine', gain: 0.09 });
        staticBurst(0.28, 0.09);
        chirp({ freqStart: 1100, freqEnd: 60, duration: 0.35, type: 'sawtooth', gain: 0.07 });
    }
    function playRecoverSound() {
        chirp({ freqStart: 200, freqEnd: 950, duration: 0.25, type: 'square', gain: 0.05 });
    }
    // A low, building growl as dot puffs up red with rage — distinct from
    // the sharper playPopSound that follows once it actually blows.
    function playRageGrowlSound() {
        chirp({ freqStart: 90, freqEnd: 55, duration: 0.45, type: 'sawtooth', gain: 0.08 });
        staticBurst(0.4, 0.05);
    }
    // The rage blast itself — playPopSound's usual crackle/sweep plus an
    // extra deep boom underneath, for a bigger, angrier detonation.
    function playRageBoomSound() {
        playPopSound();
        chirp({ freqStart: 70, freqEnd: 20, duration: 0.4, type: 'sine', gain: 0.1 });
    }
    // A balloon actually being blown up: a squeaky, rising pitch (sawtooth
    // reads more "stretched rubber" than the plain square/sine used
    // elsewhere) held for the whole swell, then a soft low settling thud
    // right as it reaches full size — for dot's birth/rebirth at the logo.
    function playInflateSound(duration) {
        chirp({ freqStart: 180, freqEnd: 620, duration, type: 'sawtooth', gain: 0.045 });
        window.setTimeout(() => {
            chirp({ freqStart: 260, freqEnd: 140, duration: 0.12, type: 'sine', gain: 0.05 });
        }, duration * 1000 * 0.85);
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

    // MARGIN alone only keeps a normal-sized dot on screen — inflated by a
    // tap streak or puffed up huge by rage, its actual rendered radius can
    // well exceed that fixed 20px, so the safe zone has to shrink to match
    // whatever size dot currently is, not just its resting one.
    function safeMargin() {
        return Math.max(MARGIN, MASCOT_BASE_RADIUS * currentInflateScale + 2);
    }

    function clamp(x, y) {
        const m = safeMargin();
        return {
            x: Math.max(m, Math.min(window.innerWidth - m, x)),
            y: Math.max(m, Math.min(window.innerHeight - m, y))
        };
    }

    function place(x, y) {
        if (instanceRemoved) return;
        pos = clamp(x, y);
        mascot.style.left = pos.x + 'px';
        mascot.style.top = pos.y + 'px';
        if (wordRects.length) updateTextParting(pos.x, pos.y);
        checkMascotMerge(selfHandle);
    }

    function restartAnimation(className, autoRemoveMs) {
        if (reduceMotion) return;
        mascot.classList.remove(className);
        void mascot.offsetWidth; // force reflow so the animation can replay
        mascot.classList.add(className);
        if (autoRemoveMs) window.setTimeout(() => mascot.classList.remove(className), autoRemoveMs);
    }

    // Snaps straight to the logo dot and plays the same elastic "inflate
    // like a rubber ball" pop-in used first-load — used both for the very
    // first appearance and for coming back after popping as the last dot
    // standing. No flight/physics involved, on purpose: instant by design.
    function birthAtLogo() {
        // A rebirth is always the site's default color — a fresh start,
        // not a continuation of whatever hue this instance happened to
        // have (e.g. a colored clone that was the last one standing).
        if (mascotColor) {
            mascotColor = null;
            mascot.style.removeProperty('--mascot-color');
        }
        const logoPos = getLogoDotPos();
        userPlaced = false; // a fresh life wanders normally again
        place(logoPos.x, logoPos.y);
        restartAnimation('recovering', BIRTH_DURATION_MS);
        // Skip the sound if no real gesture has happened yet — the very
        // first automatic birth on page load can hit this before any
        // interaction; the visual animation still plays either way.
        if (hasUserGesture) playInflateSound(BIRTH_DURATION_MS / 1000);
    }

    function randomHop() {
        // Also holds still while a manually-triggered feed refetch is in
        // flight — wandering off mid-"…" would leave the eventual answer
        // (or the "couldn't reach it" fallback) popping up somewhere the
        // visitor isn't looking anymore.
        if (isDragging || isThrown || isPopped || isFetchingNews || instanceRemoved) return;
        if (isAsleep) return; // let it sleep
        stopRestBounce();

        // Before anyone has touched dot, idle wandering stays confined to a
        // bottom-left zone — still feels alive without scattering across the
        // whole page on first load. But once a visitor has thrown it
        // somewhere (userPlaced), that confinement would fight the very
        // thing they just did — instead it keeps hopping like a bouncy ball
        // in the neighborhood of wherever it currently is.
        const zoneW = Math.min(340, window.innerWidth * 0.4);
        const zoneH = Math.min(260, window.innerHeight * 0.35);
        const m = safeMargin();
        const floor = window.innerHeight - m;
        let zoneLeft, zoneRight;
        if (userPlaced) {
            const localRange = zoneW / 2;
            zoneLeft = Math.max(m, pos.x - localRange);
            zoneRight = Math.min(window.innerWidth - m, pos.x + localRange);
        } else {
            zoneLeft = m;
            zoneRight = m + zoneW;
        }

        if (reduceMotion) {
            place(
                zoneLeft + Math.random() * (zoneRight - zoneLeft),
                floor - Math.random() * zoneH
            );
            return;
        }

        // A real gravity arc within that zone — same physics as a throw —
        // instead of a teleport: dot leaps like an actual bouncing ball,
        // bounces off the zone's own walls a couple of times if it
        // overshoots, then settles into its resting bounce pose.
        const targetX = zoneLeft + Math.random() * (zoneRight - zoneLeft);
        const peakHeight = 30 + Math.random() * (zoneH * 0.5);
        const vy0 = -Math.sqrt(2 * GRAVITY * peakHeight);
        const airTime = Math.max(0.18, (-vy0 / GRAVITY) * 2);
        let vx = (targetX - pos.x) / airTime;
        let vy = vy0;

        isThrown = true;
        mascot.classList.add('thrown');
        let lastT = performance.now();
        const myFlight = ++flightToken;

        function step(now) {
            if (myFlight !== flightToken) return; // superseded by a grab
            const dt = Math.min(0.032, (now - lastT) / 1000);
            lastT = now;
            vy += GRAVITY * dt;
            vx *= Math.exp(-AIR_DRAG * dt);

            let nx = pos.x + vx * dt;
            let ny = pos.y + vy * dt;

            if (nx < zoneLeft) {
                nx = zoneLeft;
                vx = -vx * RESTITUTION;
                if (Math.abs(vx) > BOUNCE_SOUND_VEL) squashBounce(0.75, 1.3);
            } else if (nx > zoneRight) {
                nx = zoneRight;
                vx = -vx * RESTITUTION;
                if (Math.abs(vx) > BOUNCE_SOUND_VEL) squashBounce(0.75, 1.3);
            }

            let settled = false;
            if (ny >= floor) {
                ny = floor;
                if (Math.abs(vy) > REST_VEL) {
                    // The actual "thud" of hitting the ground — same
                    // squash/land cues a throw gets — is what was missing
                    // before: without it the arc read as a smooth glide
                    // instead of a real bounce.
                    if (Math.abs(vy) > BOUNCE_SOUND_VEL) {
                        // Visual thud only, no sound: this fires on its own
                        // during idle hopping (not a response to anything
                        // the visitor did), and a little bounce noise every
                        // few seconds reads as pestering rather than alive —
                        // misophonia-unfriendly in particular. Interaction
                        // sounds (click, throw, hit, pop...) are unaffected.
                        restartAnimation('dropped', 200);
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

            place(nx, ny);
            if (instanceRemoved || selfHandle.removed) return;

            if (!settled) {
                requestAnimationFrame(step);
            } else {
                mascot.classList.remove('thrown');
                isThrown = false;
                startRestBounce();
            }
        }
        requestAnimationFrame(step);
    }

    place(pos.x, pos.y);

    // The very first "dot" (not a split-off clone, which already gets its
    // own spring-away entrance) is born right on the logo dot, inflating
    // into view instead of just silently appearing already in the hero.
    if (!options.pos && !reduceMotion) {
        restartAnimation('recovering', BIRTH_DURATION_MS);
        if (hasUserGesture) playInflateSound(BIRTH_DURATION_MS / 1000);
    }

    function scheduleHop() {
        window.setTimeout(() => {
            if (instanceRemoved || selfHandle.removed) return;
            randomHop();
            scheduleHop();
        }, 4000 + Math.random() * 2000);
    }
    if (!reduceMotion) scheduleHop();

    // A one-time invitation to interact — only for the original "dot", not
    // for split-off clones (those are already the result of interacting).
    if (!options.pos) {
        window.setTimeout(() => {
            if (isDragging || isThrown || isPopped || instanceRemoved) return;
            const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'it';
            showBubble(INTRO_LINE[lang] || INTRO_LINE.it);
        }, 1800);
    }

    // Occasionally surfaces news from the shared pool (GitHub/AI/World, all
    // mixed together — no dot is dedicated to just one) in the bubble.
    // Longer display duration than a regular one-liner: a news item needs
    // more than a glance to read. A small badge appears on dot a few
    // seconds before the bubble shows itself, so a visitor who notices it
    // can click dot to reveal the news right away instead of waiting.
    const newsBadge = mascot.querySelector('.mascot-news-badge');
    let newsIndex = 0;

    function showNextNews() {
        const items = getAllNewsItems();
        if (!items.length) return;
        const item = items[newsIndex % items.length];
        showBubble(item.icon + ' ' + item.text, 4000, item.url);
        recordNotifiedNews(item);
        newsIndex++;
        if (newsBadge) newsBadge.hidden = true;
    }

    function scheduleNews() {
        window.setTimeout(() => {
            if (instanceRemoved || selfHandle.removed) return;
            if (!isDragging && !isThrown && !isPopped && !isAsleep && getAllNewsItems().length) {
                if (newsBadge) newsBadge.hidden = false;
                window.setTimeout(() => {
                    if (instanceRemoved || selfHandle.removed) return;
                    if (!isDragging && !isThrown && !isPopped && newsBadge && !newsBadge.hidden) {
                        showNextNews();
                    }
                }, 3000);
            }
            scheduleNews();
        }, 25000 + Math.random() * 15000);
    }
    scheduleNews();

    // Left alone long enough, dot goes to sleep: it stops wandering, closes
    // its eyes, breathes slowly and lets the odd "z" escape, and holds its
    // news back until someone is around to read it. Any real gesture
    // anywhere on the page wakes it with a stretch — sleeping through a
    // visitor's return would read as broken, not as sleepy.
    const SLEEP_AFTER_MS = 45000;
    const SLEEP_CHECK_MS = 2000;

    function fallAsleep() {
        // Never mid-throw, mid-drag, mid-explosion or mid-fetch: those all
        // end with dot doing something, and it should be awake for it.
        if (isAsleep || isDragging || isThrown || isPopped || isFetchingNews || instanceRemoved) return;
        isAsleep = true;
        stopRestBounce();
        mascot.classList.remove('waking');
        mascot.classList.add('sleeping');
    }

    function wakeUp() {
        if (!isAsleep) return;
        isAsleep = false;
        mascot.classList.remove('sleeping');
        restartAnimation('waking', 460);
    }

    if (!reduceMotion) {
        wakeCallbacks.add(wakeUp);
        sleepCheckTimer = window.setInterval(() => {
            if (instanceRemoved || selfHandle.removed) return;
            if (Date.now() - lastActivityAt >= SLEEP_AFTER_MS) fallAsleep();
        }, SLEEP_CHECK_MS);
    }

    // Eyes glance toward the cursor when it's nearby, anywhere on the page.
    // Named so remove() can actually unregister it — see the comment there.
    function onMouseMove(e) {
        if (isDragging || isThrown || isPopped || instanceRemoved) return;
        const rect = mascot.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 60));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / 60));
        mascot.querySelectorAll('.mascot-eye').forEach(eye => {
            eye.style.transform = `translate(${dx * 1.5}px, ${dy * 1.5}px)`;
        });
    }
    document.addEventListener('mousemove', onMouseMove);

    // Perks up whenever a hub or a detail panel opens elsewhere on the graph.
    function onGraphInteraction() {
        if (!isPopped) restartAnimation('excited', 500);
    }
    document.addEventListener('graphinteraction', onGraphInteraction);

    function burstParticles({ count = 8, distance = 40, size = 5 } = {}) {
        const rect = mascot.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('span');
            p.className = 'mascot-particle';
            // A little jitter on angle/distance so a big burst doesn't read
            // as a too-perfect ring — looks more like an actual shatter.
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const dist = distance * (0.75 + Math.random() * 0.5);
            p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            if (mascotColor) p.style.background = mascotColor;
            document.body.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
        }
    }

    // A single expanding, fading ring at the mascot's position — a
    // shockwave to make the pop read clearly even at a glance, not just
    // another handful of small particles among the others.
    function burstShockwave(big) {
        const rect = mascot.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const ring = document.createElement('span');
        ring.className = big ? 'mascot-shockwave big' : 'mascot-shockwave';
        ring.style.left = cx + 'px';
        ring.style.top = cy + 'px';
        if (big) {
            // A fixed scale factor would fall short on a large screen, or
            // when dot explodes near a corner instead of the middle —
            // always reach the farthest corner of the viewport instead,
            // wherever dot happens to be.
            const vw = window.innerWidth, vh = window.innerHeight;
            const maxDist = Math.max(
                Math.hypot(0 - cx, 0 - cy),
                Math.hypot(vw - cx, 0 - cy),
                Math.hypot(0 - cx, vh - cy),
                Math.hypot(vw - cx, vh - cy)
            );
            ring.style.setProperty('--shockwave-scale', (maxDist / 10).toFixed(1));
        }
        if (mascotColor) ring.style.borderColor = mascotColor;
        document.body.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove());
    }

    const POP_TIP_RADIUS = 220; // px, how far the pop's blast reaches
    const POP_TIP_MAX_DEG = 80; // topples close to flat, never fully

    // The pop's blast tips over whatever's standing nearby — unlike the
    // mid-throw collision spin (which always lands back upright, a whole
    // number of turns), this one falls over and holds for a beat before
    // self-righting, for a more physical "knocked over" read. Still purely
    // visual (the standalone `rotate` property, composes with each
    // element's own transform) — nothing in the DOM ever changes.
    function tipNearbyElements(cx, cy, radius = POP_TIP_RADIUS) {
        document.querySelectorAll(HITTABLE_SELECTOR).forEach(el => {
            // Leave alone whatever is still falling from a rage blast: its
            // resting angle and landing point were computed together, and a
            // tip landing on top of it moves the goalposts mid-flight.
            if (el.classList.contains('page-collapsed')) return;
            const rect = el.getBoundingClientRect();
            if (!rect.width && !rect.height) return;
            const ex = rect.left + rect.width / 2;
            const ey = rect.top + rect.height / 2;
            const dist = Math.hypot(ex - cx, ey - cy);
            if (dist > radius) return;
            const strength = 1 - dist / radius;
            const angle = (Math.sign(ex - cx) || 1) * (20 + strength * POP_TIP_MAX_DEG);
            el.style.setProperty('--tip-angle', angle.toFixed(1) + 'deg');
            el.classList.remove('page-tipped');
            void el.offsetWidth; // force reflow so the animation can replay
            el.classList.add('page-tipped');
            window.setTimeout(() => el.classList.remove('page-tipped'), 1150);
        });
    }

    // The rage blast doesn't only tip things over: it drops them. Gravity is
    // what turns a reaction into a consequence — before this, everything
    // rotated but stayed nailed to its spot, which read as "shoved" rather
    // than "knocked down".
    //
    // Everything lands on the same floor — the bottom of the screen —
    // wherever it started from. The panels in the way (.hero-visual and
    // .hero-text clip their overflow) would otherwise swallow whatever
    // falls past their edge, so they are opened for the duration of the
    // collapse and closed again straight after: for two seconds the page
    // has one floor and no walls but the window's own.
    //
    // Still purely visual, like the tip it extends: the standalone
    // `translate`/`rotate` properties compose with each element's own
    // `transform` (the graph nodes are positioned through it), and nothing
    // in the DOM moves — the page is never actually rearranged, so the
    // layout that comes back up is the one that went down.
    const COLLAPSE_WAVE_MS_PER_PX = 0.32; // the blast front travels outward
    const COLLAPSE_MAX_DELAY_MS = 320;    // ...but nothing waits longer than this
    const COLLAPSE_DURATION_MS = 2000;

    // Every ancestor between the element and the body that would clip what
    // falls out of it. They get opened while the collapse plays, otherwise
    // a chip leaving its panel is simply cut off mid-air at the edge.
    function clippingAncestors(el) {
        const found = [];
        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.overflow !== 'visible' || style.overflowY !== 'visible' || style.overflowX !== 'visible') {
                found.push(node);
            }
        }
        return found;
    }

    function collapseVisibleElements(cx, cy) {
        const targets = [];
        const opened = new Set();

        document.querySelectorAll(HITTABLE_SELECTOR).forEach(el => {
            const rect = el.getBoundingClientRect();
            if (!rect.width && !rect.height) return;
            // Off-screen elements are skipped: nobody would see them fall,
            // and animating them is pure cost.
            if (rect.bottom < 0 || rect.top > window.innerHeight) return;
            targets.push({ el, rect });
            clippingAncestors(el).forEach(node => opened.add(node));
        });
        if (!targets.length) return;

        // Open every panel that would otherwise cut off what leaves it, for
        // as long as the collapse lasts.
        opened.forEach(node => node.classList.add('page-collapse-open'));

        const floor = window.innerHeight;
        targets.forEach(({ el, rect }) => {
            const ex = rect.left + rect.width / 2;
            const ey = rect.top + rect.height / 2;
            const dir = Math.sign(ex - cx) || 1;
            // A resting tilt, jittered per element: one uniform angle looks
            // like a table collapsing, not like things falling over.
            const angle = dir * (58 + Math.random() * 38);
            const rad = angle * Math.PI / 180;
            const cos = Math.cos(rad), sin = Math.sin(rad);

            // Lying on its side, an element's footprint is no longer its
            // width and height: without this a wide element (the logo, a
            // chip) comes to rest half sunk through the floor.
            const halfWide = (Math.abs(rect.width * cos) + Math.abs(rect.height * sin)) / 2;
            const halfTall = (Math.abs(rect.width * sin) + Math.abs(rect.height * cos)) / 2;

            // And it doesn't necessarily turn on the spot. `rotate` is
            // applied *before* the element's own `transform`, around the
            // origin of its untransformed box — so anything positioned by a
            // transform (every graph node carries translate(-50%, -50%))
            // swings along an arc instead of pivoting in place. That offset
            // is exactly the rotation applied to its transform's own
            // translation, and it has to be predicted here or the node ends
            // up somewhere other than where the maths says it will.
            let arcX = 0, arcY = 0;
            const ownTransform = getComputedStyle(el).transform;
            if (ownTransform && ownTransform !== 'none') {
                const m = new DOMMatrixReadOnly(ownTransform);
                arcX = m.e * cos - m.f * sin - m.e;
                arcY = m.e * sin + m.f * cos - m.f;
            }
            const restX = ex + arcX;
            const restY = ey + arcY;

            // Everything ends up on the same floor, wherever it started.
            // Not clamped at zero on purpose: something already down there
            // has to rise a little as it tips, because lying down makes it
            // taller than standing did.
            const fall = floor - 2 - halfTall - restY;
            // Blown away from dot, but never off the screen's own edges.
            const drift = Math.min(
                Math.max(dir * (8 + Math.random() * 26), 2 + halfWide - restX),
                window.innerWidth - 2 - halfWide - restX
            );
            // Staggered by distance, so the collapse reads as a wave leaving
            // dot rather than every element giving way at the same instant.
            const delay = Math.min(Math.hypot(ex - cx, ey - cy) * COLLAPSE_WAVE_MS_PER_PX, COLLAPSE_MAX_DELAY_MS);

            el.style.setProperty('--fall-y', fall.toFixed(0) + 'px');
            el.style.setProperty('--fall-x', drift.toFixed(0) + 'px');
            el.style.setProperty('--fall-angle', angle.toFixed(1) + 'deg');
            el.style.setProperty('--fall-delay', delay.toFixed(0) + 'ms');
            el.style.setProperty('--fall-dur', (COLLAPSE_DURATION_MS + Math.random() * 260).toFixed(0) + 'ms');

            el.classList.remove('page-tipped', 'page-collapsed');
            void el.offsetWidth; // force reflow so the animation can replay
            el.classList.add('page-collapsed');
            el.addEventListener('animationend', () => el.classList.remove('page-collapsed'), { once: true });
            // Safety net for the cases where animationend never fires — the
            // element hidden mid-fall by a language switch, a resize, or a
            // second explosion restarting the animation underneath it.
            window.setTimeout(() => el.classList.remove('page-collapsed'), COLLAPSE_DURATION_MS + COLLAPSE_MAX_DELAY_MS + 400);
        });

        // Close the panels again once the last element is back on its feet.
        window.setTimeout(
            () => opened.forEach(node => node.classList.remove('page-collapse-open')),
            COLLAPSE_DURATION_MS + COLLAPSE_MAX_DELAY_MS + 400
        );
    }

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
        // Growing happens in place — dot doesn't move, it just puffs up
        // around its current center — so a spot that was safely on screen
        // at normal size can now have the bigger dot bulging past an edge.
        // Re-clamping (a no-op unless that just happened) nudges it back.
        place(pos.x, pos.y);
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
        stopRestBounce();
        clickTimes = [];
        resetInflate();
        bubble.hidden = true;
        if (reduceMotion) {
            window.setTimeout(() => { isPopped = false; }, 300);
            return;
        }
        const popRect = mascot.getBoundingClientRect();
        burstParticles({ count: 18, distance: 85, size: 8 });
        burstShockwave();
        tipNearbyElements(popRect.left + popRect.width / 2, popRect.top + popRect.height / 2);
        playPopSound();
        mascot.classList.remove('excited', 'hopping', 'dropped');
        restartAnimation('popping');
        window.setTimeout(() => {
            mascot.classList.remove('popping');
            // Definitive pop vs rebirth: with another dot still around, this
            // one is gone for good (also frees a slot for a future split).
            // Alone, it has to come back — there must always be at least
            // one — reborn on the logo dot instead of a random spot.
            if (activeMascots.length > 1) {
                selfHandle.remove();
                return;
            }
            birthAtLogo();
            isPopped = false;
        }, 380);
    }

    const RAGE_SCALE = 5;
    const RAGE_GROW_MS = 500;

    // The rare escalation past a plain pop: dot visibly swells up huge and
    // red for a beat, then unloads a page-wide blast that also pops every
    // other mascot on screen with it — then always comes back calm at the
    // logo afterwards, same as popping alone (never left angry/oversized).
    function rage() {
        if (isPopped) return;
        isPopped = true;
        stopRestBounce();
        clickTimes = [];
        resetInflate();
        bubble.hidden = true;
        if (reduceMotion) {
            window.setTimeout(() => { isPopped = false; }, 300);
            return;
        }
        mascot.classList.remove('excited', 'hopping', 'dropped');
        mascotColor = angryColor();
        mascot.style.setProperty('--mascot-color', mascotColor);
        currentInflateScale = RAGE_SCALE;
        mascot.style.setProperty('--mascot-scale', String(RAGE_SCALE));
        // Puffing up to 5x happens in place — re-clamp so growing near an
        // edge doesn't leave dot bulging off screen (same reasoning as
        // updateInflate()).
        place(pos.x, pos.y);
        restartAnimation('angry');
        playRageGrowlSound();
        window.setTimeout(() => {
            mascot.classList.remove('angry');
            const rect = mascot.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            burstParticles({ count: 40, distance: 260, size: 14 });
            burstShockwave(true);
            collapseVisibleElements(cx, cy);
            playRageBoomSound();
            activeMascots
                .filter(h => h !== selfHandle && !h.removed)
                .forEach(h => h.rageBurst());
            resetInflate(); // shrink back to scale 1 as it pops away, so the respawn starts clean
            restartAnimation('popping');
            window.setTimeout(() => {
                mascot.classList.remove('popping');
                birthAtLogo();
                isPopped = false;
            }, 380);
        }, RAGE_GROW_MS);
    }

    // A news item's bubble carries the URL of its source (a commit, a PR, a
    // model page, a Wikipedia article) — click it to open that instead of
    // just reading the headline. Wired once per instance; plain one-liners
    // (random lines, the loading/error states) pass no url and stay inert.
    let bubbleUrl = null;
    bubble.addEventListener('click', (e) => {
        if (!bubbleUrl) return;
        e.stopPropagation();
        window.open(bubbleUrl, '_blank', 'noopener,noreferrer');
    });

    function showBubble(text, duration = 1500, url = null) {
        bubble.textContent = text;
        bubble.style.left = pos.x + 'px';
        bubble.style.top = pos.y + 'px';
        bubble.style.setProperty('--bubble-nudge-x', '0px');
        bubble.style.setProperty('--bubble-nudge-y', '0px');
        bubble.hidden = false;
        bubbleUrl = url;
        bubble.classList.toggle('clickable', !!url);

        // Keep the bubble fully on-screen — near an edge (dot can idle-hop
        // into a corner, or just be dragged there) it would otherwise clip
        // half off the viewport. Measure after actual layout, then nudge
        // it back in with a small pixel correction on top of the usual
        // "float above dot" placement.
        const EDGE_MARGIN = 10;
        const rect = bubble.getBoundingClientRect();
        let nudgeX = 0, nudgeY = 0;
        if (rect.left < EDGE_MARGIN) nudgeX = EDGE_MARGIN - rect.left;
        else if (rect.right > window.innerWidth - EDGE_MARGIN) nudgeX = (window.innerWidth - EDGE_MARGIN) - rect.right;
        if (rect.top < EDGE_MARGIN) nudgeY = EDGE_MARGIN - rect.top;
        else if (rect.bottom > window.innerHeight - EDGE_MARGIN) nudgeY = (window.innerHeight - EDGE_MARGIN) - rect.bottom;
        if (nudgeX) bubble.style.setProperty('--bubble-nudge-x', nudgeX + 'px');
        if (nudgeY) bubble.style.setProperty('--bubble-nudge-y', nudgeY + 'px');

        window.clearTimeout(bubble._timer);
        bubble._timer = window.setTimeout(() => { bubble.hidden = true; }, duration);
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
            window.clearTimeout(angerStreakResetTimer);
            angerStreak++;
            angerStreakResetTimer = window.setTimeout(() => { angerStreak = 0; }, ANGER_STREAK_WINDOW_MS);
            if (angerStreak >= ANGER_STREAK_THRESHOLD) {
                angerStreak = 0;
                rage();
            } else {
                pop();
            }
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
        // The badge means dot already has something to say — a click
        // reveals it right away instead of the usual random one-liner.
        if (newsBadge && !newsBadge.hidden) {
            showNextNews();
            return;
        }
        // Otherwise a click asks dot to go check the feeds live, instead of
        // waiting for the next scheduled cycle — capped so mashing clicks
        // doesn't hammer the rate-limited public APIs at once. Falls
        // back to the usual random one-liner while on cooldown, so rapid
        // clicking still feels alive instead of doing nothing.
        const now = Date.now();
        if (now - lastNewsRefetchAt > NEWS_REFETCH_COOLDOWN_MS) {
            lastNewsRefetchAt = now;
            isFetchingNews = true;
            showBubble('🔄 …', 8000);
            refetchAllNews()
                .then(() => {
                    if (instanceRemoved) return;
                    const freshCount = getAllNewsItems().length;
                    if (freshCount) {
                        // Always resetting to 0 here meant every click showed
                        // the same first-source item (GitHub) and could never
                        // reach the others — a visitor clicking dot to check
                        // for news would never see weather/space/trending at
                        // all. A random pick surfaces the full mix instead.
                        newsIndex = Math.floor(Math.random() * freshCount);
                        showNextNews();
                    } else {
                        // fetchXNews() already swallows its own errors (offline,
                        // rate-limited, blocked) — an empty result here is the
                        // only signal we get, so surface it instead of leaving
                        // the "…" to just quietly expire with no explanation.
                        const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'it';
                        showBubble('🔄 ' + (NEWS_FETCH_FAILED[lang] || NEWS_FETCH_FAILED.it), 3000);
                    }
                })
                .finally(() => { isFetchingNews = false; });
            return;
        }
        // On cooldown, no new network call — but there's usually already a
        // full pool of cached items from the last fetch, so a click still
        // surfaces real content (a random pick, same as after a live
        // refetch) instead of falling back to a generic line every time.
        // Visitors clicking a few times in a row were seeing "Hi there!"
        // far more often than actual news because of this.
        const cachedCount = getAllNewsItems().length;
        if (cachedCount) {
            newsIndex = Math.floor(Math.random() * cachedCount);
            showNextNews();
            return;
        }
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

    // Idle "resting" pose: wherever dot lands — from an idle hop or a real
    // throw — it doesn't go dead still, it keeps doing a small bouncing-ball
    // wobble in place, like a real ball that never quite settles. Purely
    // decorative (a translateY offset, never touches pos.x/pos.y), and
    // self-terminates the moment something else takes over.
    const REST_BOUNCE_AMPLITUDE = 6; // px
    const REST_BOUNCE_PERIOD_MS = 850;
    let restBounceId = null;

    function stopRestBounce() {
        if (restBounceId !== null) {
            cancelAnimationFrame(restBounceId);
            restBounceId = null;
        }
        mascot.style.setProperty('--mascot-rest-bounce', '0px');
    }

    function startRestBounce() {
        if (reduceMotion) return;
        stopRestBounce();
        const start = performance.now();
        function step(now) {
            if (isDragging || isThrown || isPopped || instanceRemoved) {
                restBounceId = null;
                return;
            }
            const t = ((now - start) % REST_BOUNCE_PERIOD_MS) / REST_BOUNCE_PERIOD_MS;
            // |sin| traces a bouncing-ball cadence: quick landing, soft apex.
            const offset = -Math.abs(Math.sin(t * Math.PI)) * REST_BOUNCE_AMPLITUDE;
            mascot.style.setProperty('--mascot-rest-bounce', offset.toFixed(2) + 'px');
            restBounceId = requestAnimationFrame(step);
        }
        restBounceId = requestAnimationFrame(step);
    }

    // A dazed stagger: a decaying side-to-side sway (with a matching gentle
    // rotation) instead of a clean stop — played only when the mascot was
    // shaken around mid-drag, so it looks visibly woozy when set down.
    function wobbleSettle(baseX) {
        const start = performance.now();
        const DURATION = 900;
        const AMPLITUDE = 16;
        const FREQ = 13;
        const myFlight = flightToken; // grabbed mid-throw's step() already bumped this before calling us

        function step(now) {
            if (myFlight !== flightToken) return; // superseded by a grab
            const elapsed = now - start;
            if (elapsed >= DURATION) {
                mascot.style.left = baseX + 'px';
                mascot.style.setProperty('--mascot-rotate', '0deg');
                mascot.classList.remove('thrown');
                isThrown = false;
                userPlaced = true;
                startRestBounce();
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
        stopRestBounce();
        isThrown = true;
        mascot.classList.add('thrown');
        let lastT = performance.now();
        const myFlight = ++flightToken;

        // Snapshot hittable elements once per throw (layout doesn't change
        // mid-flight) instead of querying/measuring the DOM every frame.
        const hittableRects = reduceMotion ? [] : Array.from(document.querySelectorAll(HITTABLE_SELECTOR))
            .map(el => ({ el, rect: el.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0);

        function step(now) {
            if (myFlight !== flightToken) return; // superseded by a grab
            const dt = Math.min(0.032, (now - lastT) / 1000);
            lastT = now;
            vy += GRAVITY * dt;
            vx *= Math.exp(-AIR_DRAG * dt);

            let nx = pos.x + vx * dt;
            let ny = pos.y + vy * dt;
            const m = safeMargin();

            if (nx < m) {
                nx = m;
                vx = -vx * RESTITUTION;
                if (Math.abs(vx) > BOUNCE_SOUND_VEL) squashBounce(0.75, 1.3);
            } else if (nx > window.innerWidth - m) {
                nx = window.innerWidth - m;
                vx = -vx * RESTITUTION;
                if (Math.abs(vx) > BOUNCE_SOUND_VEL) squashBounce(0.75, 1.3);
            }

            if (ny < m) {
                ny = m;
                vy = -vy * RESTITUTION;
            }

            const floor = window.innerHeight - m;
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
            if (wordRects.length) updateTextParting(pos.x, pos.y);
            checkMascotMerge(selfHandle);
            if (selfHandle.removed) return;

            if (!settled) {
                requestAnimationFrame(step);
            } else if (dizzy) {
                wobbleSettle(pos.x);
            } else {
                mascot.classList.remove('thrown');
                isThrown = false;
                userPlaced = true;
                startRestBounce();
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
        if (isPopped) return;
        // Catching it mid-air: a hop or a throw can otherwise keep the
        // mascot bouncing — occasionally quite high — for a couple of
        // seconds with no way to grab it, which reads as "stuck"/"gone
        // wild" rather than as a mascot you can always reach out and pick
        // up. Bumping the token invalidates that flight's step() loop
        // (it checks the token and bails on its next frame) so the drag
        // that's about to start doesn't have to fight it for pos.x/pos.y.
        if (isThrown) {
            flightToken++;
            isThrown = false;
            mascot.classList.remove('thrown');
        }
        stopRestBounce();
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
            const prevX = pos.x, prevY = pos.y;
            place(dragStart.mascotX + dx, dragStart.mascotY + dy);

            const prevPoint = moveHistory[moveHistory.length - 1];
            const nowT = performance.now();
            const dt = Math.max(4, nowT - prevPoint.t); // ms, floored to dodge divide-by-near-0 spikes

            // Grip: squeezed rubber stretches along the direction it's
            // being yanked and squashes on the other axis, so holding and
            // swinging it around actually looks and feels like gripping
            // something soft — playdough, not a rigid icon. Normalized to
            // px moved per ~16ms (one frame at 60fps) instead of the raw
            // per-event delta — pointermove fires at wildly different rates
            // across browsers/devices, so the raw delta made this read as
            // barely-there on any setup that fires it often. Wide clamp
            // range and a strong multiplier on purpose: an ordinary drag
            // should already read as an obvious, cartoonish stretch, not
            // a subtle wobble.
            const frameScale = 16.67 / dt;
            const stepVx = (pos.x - prevX) * frameScale, stepVy = (pos.y - prevY) * frameScale;
            const sx = Math.max(0.45, Math.min(2.0, 1 + Math.abs(stepVx) * 0.09 - Math.abs(stepVy) * 0.05));
            const sy = Math.max(0.45, Math.min(2.0, 1 + Math.abs(stepVy) * 0.09 - Math.abs(stepVx) * 0.05));
            mascot.style.setProperty('--mascot-squash-x', sx.toFixed(3));
            mascot.style.setProperty('--mascot-squash-y', sy.toFixed(3));

            // Shake detection: rapid left-right direction reversals mid-drag
            // means the visitor is roughing the mascot up, not just moving
            // it — worth a dazed reaction of its own.
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

            moveHistory.push({ x: e.clientX, y: e.clientY, t: nowT });
            // Keep only the last ~100ms of movement — recent velocity is
            // what a real throw cares about, not the whole drag history.
            const cutoff = nowT - 100;
            while (moveHistory.length > 2 && moveHistory[0].t < cutoff) moveHistory.shift();
        }
    });

    function endDrag() {
        if (!dragStart) return;
        const wasDragging = isDragging;
        if (wasDragging) {
            mascot.classList.remove('dragging');
            mascot.style.setProperty('--mascot-squash-x', 1);
            mascot.style.setProperty('--mascot-squash-y', 1);
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
        if (!wasDragging) {
            registerClick();
            // Double-click/tap splits the mascot in two — tracked by hand
            // (two taps within a short window) instead of the native
            // 'dblclick' event, which touch browsers only synthesize
            // inconsistently once pointer capture and touch-action: none
            // are in the mix, effectively never firing on some mobile
            // browsers. This works identically for mouse and touch.
            const now = performance.now();
            if (!isPopped && now - lastTapTime < 350) {
                lastTapTime = 0;
                splitMascot();
            } else {
                lastTapTime = now;
            }
        }
    }

    mascot.addEventListener('pointerup', endDrag);
    mascot.addEventListener('pointercancel', endDrag);

    // Keyboard activation (Tab to the mascot, then Enter/Space) never fires
    // pointerdown/pointerup — only a native `click`. A real pointer tap
    // already triggers registerClick() via endDrag() above, and also fires
    // its own trailing `click` afterwards; detail === 0 is how the browser
    // marks a click that came from keyboard activation (or a programmatic
    // el.click()) rather than an actual pointer press, so this only ever
    // fires once per interaction.
    mascot.addEventListener('click', (e) => {
        if (e.detail === 0) registerClick();
    });

    function splitMascot() {
        if (isPopped || mascotInstanceCount >= MAX_MASCOTS) return;

        const clone = mascot.cloneNode(true);
        clone.removeAttribute('id');
        clone.classList.remove('dragging', 'thrown', 'excited', 'hopping', 'dropped', 'popping', 'recovering');
        clone.style.setProperty('--mascot-scale', 1);
        clone.style.setProperty('--mascot-squash-x', 1);
        clone.style.setProperty('--mascot-squash-y', 1);
        clone.style.setProperty('--mascot-rotate', '0deg');
        // A clone gets a proper rubber-ball color instead of a hue-rotated
        // shift of the dark brand teal (which only ever lands on muddy,
        // desaturated tones) — a fixed palette of vivid, toy-like colors.
        const cloneColor = pickBallColor();
        clone.style.setProperty('--mascot-color', cloneColor);

        const bubbleClone = bubble.cloneNode(true);
        bubbleClone.removeAttribute('id');
        bubbleClone.hidden = true;

        document.body.appendChild(bubbleClone);
        document.body.appendChild(clone);

        const angle = Math.random() * Math.PI * 2;
        // Well outside MERGE_DISTANCE, or the clone would immediately
        // re-merge into its parent the instant it's placed.
        const startX = pos.x + Math.cos(angle) * 80;
        const startY = pos.y + Math.sin(angle) * 80;
        clone.style.left = startX + 'px';
        clone.style.top = startY + 'px';

        burstParticles({ count: 10, distance: 35, size: 5 });
        playClickSound();

        createMascotController(clone, bubbleClone, {
            pos: { x: startX, y: startY },
            throwVelocity: { vx: Math.cos(angle) * 500, vy: Math.sin(angle) * 500 - 200 },
            mascotColor: cloneColor
        });
    }

    function onResize() {
        refreshWordRects();
        place(pos.x, pos.y);
    }
    window.addEventListener('resize', onResize);

    // A clone springs away from the split point instead of just appearing.
    if (options.throwVelocity && !reduceMotion) {
        throwMascot(options.throwVelocity.vx, options.throwVelocity.vy, false);
    }
}

createMascotController(document.getElementById('mascot'), document.getElementById('mascot-bubble'));
