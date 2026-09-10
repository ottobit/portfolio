import { getLang } from './theme-lang.js?v=1';

// Hub/sub-node graph: nodes overlaid on the hero canvas, same layout at every
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

    // Dedicated sub-pages linked from the detail panel (projects/evolution/'s
    // timeline, projects/cerebro/'s diagram) — icon/label per target page,
    // keyed by the same href set in data-page.
    const PAGE_LINK_TEXT = {
        'projects/evolution/': { icon: '🕰️', it: 'Timeline', en: 'Timeline' },
        'projects/cerebro/': { icon: '🔗', it: 'Progetto', en: 'Project' },
        'projects/dot-world/': { icon: '🔗', it: 'Progetto', en: 'Project' },
        'projects/triple-triad/': { icon: '🔗', it: 'Progetto', en: 'Project' }
    };

    let currentEl = null;
    let triggerEl = null;

    function updateCloseLabel() {
        if (detailClose) detailClose.setAttribute('aria-label', LINK_TEXT[getLang()].closePanel);
    }

    function stopSpeech() {
        if (canSpeak) window.speechSynthesis.cancel();
        if (detailSpeak) {
            detailSpeak.classList.remove('speaking');
            detailSpeakIcon.textContent = '🔊';
            detailSpeakLabel.textContent = LINK_TEXT[getLang()].listen;
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
        const lang = getLang();
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
            const lang = getLang();
            const bcp47 = lang === 'en' ? 'en-US' : 'it-IT';
            const voice = pickVoice(bcp47);
            detailSpeak.classList.add('speaking');
            detailSpeakIcon.textContent = '⏹';
            detailSpeakLabel.textContent = LINK_TEXT[lang].stop;
            speakSentences(
                detailText.textContent,
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

    // --- Nodes overlaid directly on the hero canvas, same at every breakpoint ---
    const heroVisual = document.querySelector('.hero-visual');
    const overlay = document.getElementById('hub-overlay');
    const svg = document.getElementById('graph-lines');
    const networkCanvas = document.getElementById('network-canvas');
    const hubNodes = overlay ? Array.from(overlay.querySelectorAll('.hub-node')) : [];
    let openKey = null;

    function positionHubNodes() {
        hubNodes.forEach(hub => {
            hub.style.left = hub.dataset.x + '%';
            hub.style.top = hub.dataset.y + '%';
        });
    }

    function subNodesFor(key) {
        return overlay ? Array.from(overlay.querySelectorAll(`.sub-node[data-parent="${key}"]`)) : [];
    }

    function clearLines() {
        if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function positionSubNodes(hub, subs) {
        const panelWidth = heroVisual.clientWidth;
        const panelHeight = heroVisual.clientHeight;
        const hx = (parseFloat(hub.dataset.x) / 100) * panelWidth;
        const hy = (parseFloat(hub.dataset.y) / 100) * panelHeight;
        const count = subs.length;
        const gap = 16;

        // Chips are pills sized by their label, so measure them (they must
        // already be display:flex — opacity can still be 0) instead of
        // assuming a fixed width, or dense groups (e.g. Social's 4 links)
        // end up overlapping.
        // +20 accounts for the label being nudged below the sphere onto its
        // own underline (positionSubLabel) — extra footprint the box below
        // doesn't know about otherwise, letting a tight ring visually run
        // the nudged label/underline into a neighboring chip.
        const sizes = subs.map(sub => ({
            w: sub.offsetWidth || 120,
            h: (sub.offsetHeight || 32) + 20
        }));
        // Full 360° star: sub-nodes ring the hub on every side, like a real
        // star-topology diagram — a diagonal base angle (not straight up)
        // avoids a rigid N/E/S/W cross at 4 nodes without needing any
        // per-node jitter, which read as messy rather than organic and let
        // the hub→moon lines below cross each other.
        // A real mobile viewport (accounting for the browser's own address
        // bar — a plain {width,height} test context misses this and
        // silently overstates panelHeight) leaves this panel wide but
        // short: about 390×250 rather than square. A single circular
        // radius still has to fit inside the SMALLER of the two dimensions,
        // which wastes most of the generous width to avoid overshooting the
        // cramped height — every moon ends up on a small circle regardless
        // of which way it points. An ellipse — the same radius formula as
        // before, just evaluated separately per axis — lets a
        // mostly-sideways moon (like Gaming or Film Addicted) reach out
        // into that spare width while a mostly-vertical one (like Anime &
        // Manga) only reaches as far as the height actually allows, instead of
        // every direction being squeezed down to the tighter axis's limit.
        // Still one shared, identical rule for every moon — just two radii
        // instead of one, both driven by the panel's own real shape.
        const radiusX = Math.min(170, Math.max(95, panelWidth * 0.3)) + Math.max(0, count - 3) * 16;
        const radiusY = Math.min(170, Math.max(60, panelHeight * 0.42)) + Math.max(0, count - 3) * 8;
        const angleStep = count > 1 ? 360 / count : 0;
        const startAngle = -45; // diagonal, not straight up — avoids a N/E/S/W cross

        const points = subs.map((sub, i) => {
            // A couple of moons carry an explicit data-angle/data-radius-scale
            // override in the markup (a specific, requested placement tweak,
            // e.g. Gaming sitting closer and lower under About me) — every
            // other moon keeps the plain evenly-spaced formula untouched.
            const angleDeg = sub.dataset.angle !== undefined
                ? parseFloat(sub.dataset.angle)
                : (count === 1 ? -90 : startAngle + angleStep * i);
            const radiusScale = sub.dataset.radiusScale !== undefined ? parseFloat(sub.dataset.radiusScale) : 1;
            const angle = (angleDeg * Math.PI) / 180;
            return {
                sub,
                x: hx + radiusX * radiusScale * Math.cos(angle),
                y: hy + radiusY * radiusScale * Math.sin(angle),
                w: sizes[i].w,
                h: sizes[i].h
            };
        });

        // Other hubs' own chips never move, but a sub-node ring can still
        // reach far enough to sit on top of one on short mobile panels —
        // treat them (not the current hub, which the ring is meant to
        // radiate close to) as fixed obstacles in the relax pass below.
        // Active/hovered hub-nodes render 8% larger (`.hub-node.active`/
        // `:hover` scale transform) without changing offsetWidth/Height, so
        // pad the obstacle box to match what's actually painted — otherwise
        // the collision math clears a gap the scaled-up chip still overlaps.
        // 1.08 left a couple of small edge/corner touches on the
        // shortest mobile panels — a wider pad gives the relax pass a bit
        // more room to push clear where the panel has space to spare.
        // The current hub is included too now (it used to be excluded,
        // relying on the ring radius alone to clear its own label) — a
        // tight mobile ring could still land a sub-node's nudged-down label
        // right on top of the hub's own, unrelated to the ring math above.
        const hubObstacles = hubNodes
            .map(h => ({
                x: (parseFloat(h.dataset.x) / 100) * panelWidth,
                y: (parseFloat(h.dataset.y) / 100) * panelHeight,
                w: (h.offsetWidth || 90) * (h === hub ? 1 : 1.15),
                h: (h.offsetHeight || 36) * (h === hub ? 1 : 1.15)
            }));

        // Relax any remaining overlap (e.g. tight radius on small panels)
        // by nudging colliding pairs apart along their separation vector,
        // and pushing any point clear of another hub's chip. More passes
        // than the sub-vs-sub-only case needed, since a dense ring (e.g.
        // About's 6 sub-nodes) fighting a fixed hub obstacle on a short
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
                    // instead of a diagonal step. Two hub-nodes close enough
                    // together can each demand a full push on opposite Y
                    // sides, which would bounce a sub-node forever between
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

    // Nudges a sub-node's label down onto a small underline of its own — the
    // underline runs under the label text only (not the sphere) — and
    // returns both its ends (map-relative px) so drawLines() can attach the
    // hub→sub-node line to whichever one faces the hub.
    function positionSubLabel(sub) {
        const originX = parseFloat(sub.style.left) - sub.offsetWidth / 2;
        const originY = parseFloat(sub.style.top) - sub.offsetHeight / 2;
        const sphere = sub.querySelector('.node-sphere');
        const label = sub.querySelector('.node-label');

        const textY = originY + sphere.offsetTop + sphere.offsetHeight + 10;
        const lLeft = originX + label.offsetLeft;
        const lRight = lLeft + label.offsetWidth;
        const lBottom = originY + label.offsetTop + label.offsetHeight;
        label.style.transform = `translateY(${(textY - lBottom).toFixed(1)}px)`;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', lLeft.toFixed(1));
        line.setAttribute('y1', textY.toFixed(1));
        line.setAttribute('x2', lRight.toFixed(1));
        line.setAttribute('y2', textY.toFixed(1));
        line.setAttribute('class', 'underline');
        svg.appendChild(line);

        return { start: { x: lLeft, y: textY }, end: { x: lRight, y: textY } };
    }

    function drawLines(hub, hx, hy, subs) {
        clearLines();
        if (!svg) return;

        const hubOriginX = hx - hub.offsetWidth / 2;
        const hubOriginY = hy - hub.offsetHeight / 2;
        const hubSphere = hub.querySelector('.node-sphere');
        const sphereCenterX = hubOriginX + hubSphere.offsetLeft + hubSphere.offsetWidth / 2;
        const sphereCenterY = hubOriginY + hubSphere.offsetTop + hubSphere.offsetHeight / 2;
        const sphereRadius = hubSphere.offsetWidth / 2;

        subs.forEach((sub, i) => {
            const ends = positionSubLabel(sub);
            const anchor = sub.classList.contains('label-left') ? ends.end : ends.start;

            // Leave a small gap between the hub's own sphere and the line
            // departing it — clear of its hover/active glow — instead of
            // starting at the sphere's dead center.
            const dx = anchor.x - sphereCenterX;
            const dy = anchor.y - sphereCenterY;
            const dist = Math.hypot(dx, dy) || 1;
            const startGap = sphereRadius + 16;
            const startX = sphereCenterX + (dx / dist) * startGap;
            const startY = sphereCenterY + (dy / dist) * startGap;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', startX.toFixed(1));
            line.setAttribute('y1', startY.toFixed(1));
            line.setAttribute('x2', startX.toFixed(1));
            line.setAttribute('y2', startY.toFixed(1));
            svg.appendChild(line);

            if (reduceMotion) {
                line.setAttribute('x2', anchor.x.toFixed(1));
                line.setAttribute('y2', anchor.y.toFixed(1));
                return;
            }

            requestAnimationFrame(() => {
                line.style.transition = `x2 0.4s ease ${i * 0.06}s, y2 0.4s ease ${i * 0.06}s`;
                line.setAttribute('x2', anchor.x.toFixed(1));
                line.setAttribute('y2', anchor.y.toFixed(1));
            });
        });
    }

    function closeHub(hub) {
        hub.classList.remove('active');
        hub.setAttribute('aria-expanded', 'false');
        subNodesFor(hub.dataset.hub).forEach(s => s.classList.remove('visible', 'animate-in'));
        clearLines();
    }

    function openHub(key) {
        const hub = hubNodes.find(h => h.dataset.hub === key);
        if (!hub) return;
        const alreadyOpen = hub.classList.contains('active');

        hubNodes.forEach(h => {
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

        const subs = subNodesFor(key);
        subs.forEach(s => s.classList.add('visible'));
        const { hx, hy } = positionSubNodes(hub, subs);
        subs.forEach((s, i) => {
            window.setTimeout(() => s.classList.add('animate-in'), reduceMotion ? 0 : i * 70);
        });
        drawLines(hub, hx, hy, subs);
        if (networkCanvas) networkCanvas.classList.add('dimmed');
    }

    positionHubNodes();

    hubNodes.forEach(hub => {
        hub.addEventListener('click', () => openHub(hub.dataset.hub));
    });

    if (overlay) {
        overlay.querySelectorAll('.sub-node:not(.sub-link)').forEach(sub => {
            sub.addEventListener('click', () => openDetail(sub));
        });
    }

    window.addEventListener('resize', () => {
        if (!openKey) return;
        const hub = hubNodes.find(h => h.dataset.hub === openKey);
        const subs = subNodesFor(openKey);
        const { hx, hy } = positionSubNodes(hub, subs);
        drawLines(hub, hx, hy, subs);
    });

    // --- Nav links + hero CTA: open the right hub from anywhere on the page ---
    document.querySelectorAll('.nav-menu a[data-hub], .cta-buttons a[data-hub]').forEach(el => {
        el.addEventListener('click', () => openHub(el.dataset.hub));
    });

})();
