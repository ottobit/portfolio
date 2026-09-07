import { getLang } from './theme-lang.js?v=1';

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

    // Warp jump: triggered by #warp-trigger. Phase A (0 to
    // WARP_RESET_FRACTION of the duration) sends every node streaking
    // radially away from the panel's center — faster the further out it
    // already is, the same trick a starfield/hyperspace effect uses —
    // while the whole page zooms in. The screen never goes white here:
    // right at the zoom's peak the page cuts straight to navigating to a
    // random project, mid-flight, no phase B and no fade back to the
    // home graph first. The white flash instead happens as a fade-IN on
    // the destination page (markWarpArrival() below + the .warp-arrival
    // rule in styles.css), so the jump reads as landing somewhere new
    // rather than a round trip back home.
    const WARP_DURATION_MS = 9200;
    const WARP_RESET_FRACTION = 0.5;
    const WARP_ZOOM_MAX = 3;
    const WARP_ZOOM_START = 0.84;
    // Where the jump actually takes you — a real project page, not just a
    // visual flourish. evolution.html (the site's own timeline) stays out
    // of the pool on purpose: it sits under the same "Projects" hub but
    // isn't a project of its own the way these three are.
    const WARP_PROJECT_PAGES = ['projects/cerebro/', 'projects/dot-world/', 'projects/triple-triad/'];
    function pickWarpDestination() {
        return WARP_PROJECT_PAGES[Math.floor(Math.random() * WARP_PROJECT_PAGES.length)];
    }
    // One-shot signal for the destination page's own inline head script:
    // read once (then cleared) to show its arrival fade only when actually
    // reached via the jump — never on a direct visit or a reload.
    function markWarpArrival() {
        try { sessionStorage.setItem('warpArrival', '1'); } catch (e) {}
    }
    let warp = null; // { startTime, resetDone } | null
    const warpButton = document.getElementById('warp-trigger');
    // Scaled during the warp for a "flying through the whole page" feel —
    // everything except #warp-overlay lives inside it (see index.html),
    // so the entire page zooms while that full-viewport canvas stays a
    // stable, unscaled frame of reference for its own tunnel/particle math.
    const pageZoomLayer = document.getElementById('page-zoom-layer');
    const WARP_LABEL = { it: 'Salto a curvatura', en: 'Warp jump' };
    function updateWarpLabel() {
        if (warpButton) warpButton.setAttribute('aria-label', WARP_LABEL[getLang()]);
    }
    document.addEventListener('langchange', updateWarpLabel);
    updateWarpLabel();

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

    function renderNormalFrame() {
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
    }

    // Phase A of the warp: nodes fly radially outward from the panel's
    // center, drawn as streaks (a short line trailing back toward center)
    // rather than dots — length and speed both scale with how far a node
    // already is from center, and with `accel` (0→1 across the phase) for
    // the "building up to lightspeed" feel.
    function renderWarpOutboundFrame(accel) {
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDist = Math.hypot(width / 2, height / 2) || 1;

        nodes.forEach(node => {
            const dx = node.x - centerX;
            const dy = node.y - centerY;
            const dist = Math.hypot(dx, dy) || 0.001;
            const ux = dx / dist;
            const uy = dy / dist;
            const speed = (1 + (dist / maxDist) * 18) * accel;

            node.x += ux * speed;
            node.y += uy * speed;

            const streakLen = speed * 7;
            ctx.strokeStyle = `rgba(${accentColor}, ${0.5 + 0.4 * accel})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(node.x - ux * streakLen, node.y - uy * streakLen);
            ctx.lineTo(node.x, node.y);
            ctx.stroke();

            // Respawn once a node has flown past the visible edge instead of
            // leaving it to travel offscreen forever — with the phase now
            // longer, a single burst would thin out and leave the screen
            // empty well before the zoom kicks in. Scattered across most of
            // the radius (not clustered back at the origin like the initial
            // spawn) so the field reads as surrounding the viewer once it's
            // underway, instead of repeatedly bursting from a single point.
            const dist2 = Math.hypot(node.x - centerX, node.y - centerY);
            if (dist2 > maxDist * 1.15) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * maxDist * 0.7;
                node.x = centerX + Math.cos(angle) * r;
                node.y = centerY + Math.sin(angle) * r;
            }
        });
    }

    function step() {
        ctx.clearRect(0, 0, width, height);

        if (warp) {
            const p = Math.min(1, (performance.now() - warp.startTime) / WARP_DURATION_MS);

            if (p < WARP_RESET_FRACTION) {
                const op = p / WARP_RESET_FRACTION;
                const accel = op ** 2;
                renderWarpOutboundFrame(accel);
                // Zoom only kicks in once the asteroid/particle flyby is
                // mostly done, so the two beats read as sequential — first
                // the field streaks past, then the page itself lurches
                // forward — rather than zooming while the flyby is still
                // happening.
                const zoomP = op < WARP_ZOOM_START ? 0 : ((op - WARP_ZOOM_START) / (1 - WARP_ZOOM_START)) ** 2;
                if (pageZoomLayer) pageZoomLayer.style.transform = `scale(${1 + zoomP * WARP_ZOOM_MAX})`;
            } else {
                // The hidden cut: zoom already at its peak — the natural
                // instant to actually leave, instead of fading back to the
                // home graph first and only then jumping away a beat
                // later. The screen never goes white here anymore — that
                // flash now happens as a fade-IN on the destination page
                // instead (see markWarpArrival() + the .warp-arrival CSS
                // in styles.css), so Home just cuts straight to the jump
                // mid-flight. No need to reset pageZoomLayer's transform
                // or any other warp state first, since navigating away
                // makes it moot.
                markWarpArrival();
                window.location.href = pickWarpDestination();
                return;
            }
        } else {
            renderNormalFrame();
        }

        if (!reduceMotion) {
            animationId = requestAnimationFrame(step);
        }
    }

    function triggerWarp() {
        if (warp) return;
        if (reduceMotion) {
            markWarpArrival();
            window.location.href = pickWarpDestination();
            return;
        }
        if (warpButton) warpButton.classList.add('warping');
        // #page-zoom-layer scales up to 4x its normal size during the jump
        // (see WARP_ZOOM_MAX below) via a CSS transform — transforms don't
        // reflow layout, but most browsers still grow the document's
        // scrollable overflow to cover the visually-enlarged content unless
        // something clips it. That growth (and the scrollbar/viewport-width
        // change that comes with it) is what read as the screen itself
        // shifting mid-jump. Pin scrolling for the duration instead.
        document.documentElement.classList.add('warping');
        warp = { startTime: performance.now(), resetDone: false };
        // Lets the full-viewport pass (a separate module, below) mirror this
        // same timing so the whole page — not just this panel — joins in.
        // The origin point (this panel's own center, in viewport coordinates)
        // is what makes that pass visibly burst out FROM the canvas instead
        // of appearing everywhere on the page at once.
        const heroRect = heroVisual.getBoundingClientRect();
        const originX = heroRect.left + heroRect.width / 2;
        const originY = heroRect.top + heroRect.height / 2;
        // #page-zoom-layer can be taller than the viewport (it's the whole
        // page), so its own transform-origin needs page coordinates, not
        // just the viewport-relative ones the 'warpjump' event below uses.
        if (pageZoomLayer) {
            pageZoomLayer.style.transformOrigin = `${originX}px ${originY + window.scrollY}px`;
        }
        document.dispatchEvent(new CustomEvent('warpjump', {
            detail: {
                duration: WARP_DURATION_MS,
                resetFraction: WARP_RESET_FRACTION,
                originX,
                originY
            }
        }));
    }

    if (warpButton) warpButton.addEventListener('click', triggerWarp);

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

    // A back/forward-cache restore (reliable in Safari, common in Chrome
    // too) can bring this page back exactly as it was mid-jump — a frozen,
    // zoomed-in frame, .warping still set on the button, a stale rAF loop
    // that may or may not resume on its own — since none of that gets
    // reset until a jump actually completes. A persisted pageshow means
    // we're not really still mid-jump, so put everything back to a clean
    // idle state instead of leaving whatever the jump last drew on screen.
    window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        if (animationId) cancelAnimationFrame(animationId);
        warp = null;
        if (warpButton) warpButton.classList.remove('warping');
        document.documentElement.classList.remove('warping');
        if (pageZoomLayer) pageZoomLayer.style.transform = '';
        resize();
        createNodes();
        step();
    });

    resize();
    createNodes();
    step();
})();
