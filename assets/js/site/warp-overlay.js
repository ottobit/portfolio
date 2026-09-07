// Warp jump, full-viewport pass: the hero canvas above plays out the same
// jump confined to its own panel — this mirrors it (same timing, via the
// 'warpjump' event it dispatches) across the entire page on a dedicated
// full-screen canvas, so the whole screen joins the effect rather than just
// the hero graph. Skips entirely under prefers-reduced-motion, same as the
// hero canvas's own animated path.
(() => {
    const canvas = document.getElementById('warp-overlay');
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    const accentColor = '17, 94, 89';
    const pointCount = 110;
    const asteroidCount = 10;

    let width, height, dpr;
    let points = [];
    let asteroids = [];
    let animationId = null;
    let originX = 0;
    let originY = 0;
    let maxDist = 1;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Every point starts in a tight cluster around the origin (the hero
    // canvas's own center) rather than scattered across the page — that's
    // what makes the burst visibly start AT the canvas and grow outward to
    // fill the screen, instead of appearing everywhere at once.
    function seedPoints() {
        points = Array.from({ length: pointCount }, () => {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 40;
            return { x: originX + Math.cos(angle) * r, y: originY + Math.sin(angle) * r };
        });
        const corners = [[0, 0], [width, 0], [0, height], [width, height]];
        maxDist = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - originX, cy - originY))) || 1;
    }

    // A handful of tumbling rocks mixed in with the streaking points — same
    // cluster-near-origin start and outward flight as the points, but drawn
    // as filled, irregular, rotating polygons instead of thin streak lines.
    // The "arriving from a distance" read comes from drawAsteroid() scaling
    // them up as accel grows (tiny/distant at first, full size once they're
    // close), not from where they spawn.
    function makeAsteroidShape(size) {
        const vertexCount = 7 + Math.floor(Math.random() * 3);
        return Array.from({ length: vertexCount }, (_, i) => ({
            angle: (i / vertexCount) * Math.PI * 2,
            r: size * (0.65 + Math.random() * 0.35)
        }));
    }

    function seedAsteroids() {
        asteroids = Array.from({ length: asteroidCount }, () => {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 40;
            const size = 9 + Math.random() * 10;
            return {
                x: originX + Math.cos(angle) * r,
                y: originY + Math.sin(angle) * r,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.12,
                shape: makeAsteroidShape(size)
            };
        });
    }

    function drawAsteroid(a, accel) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);
        // Tiny at the start, full size by the time accel nears 1 — the
        // asteroid reads as approaching from far away rather than popping
        // into existence at whatever size it happened to be given.
        const scale = 0.12 + 0.88 * accel;
        ctx.scale(scale, scale);
        ctx.beginPath();
        a.shape.forEach((v, i) => {
            const vx = Math.cos(v.angle) * v.r;
            const vy = Math.sin(v.angle) * v.r;
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
        });
        ctx.closePath();
        ctx.fillStyle = `rgba(71, 85, 105, ${0.55 + 0.35 * accel})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(30, 41, 59, ${0.6 + 0.3 * accel})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    // A handful of concentric rings, staggered so they're always at
    // different stages of expanding from the origin to the screen edge —
    // gives the burst a sense of flying through a tunnel/corridor instead
    // of just a flash growing outward.
    const ringCount = 10;
    let rings = [];

    function seedRings() {
        rings = Array.from({ length: ringCount }, (_, i) => ({ birth: i / ringCount }));
    }

    function drawTunnelRings(op) {
        const maxRadius = maxDist * 1.15;
        rings.forEach(ring => {
            const life = Math.max(0, (op - ring.birth) / (1 - ring.birth));
            if (life <= 0 || life >= 1) return;
            const radius = life * maxRadius;
            const alpha = Math.sin(life * Math.PI) * op * 0.5;
            if (alpha <= 0.01) return;
            ctx.strokeStyle = `rgba(${accentColor}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.5 + life * 2.5;
            ctx.beginPath();
            ctx.arc(originX, originY, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    // Same outward-streak math as the hero canvas's renderWarpOutboundFrame,
    // radiating from the canvas's own center instead of the viewport's.
    // `op` is the raw (non-eased) outbound-phase progress, 0→1 — needed
    // linear for evenly staggering the tunnel rings, unlike the eased
    // `accel` the points/asteroids below still use.
    function renderOutbound(op) {
        const accel = op * op;
        ctx.clearRect(0, 0, width, height);
        drawTunnelRings(op);

        points.forEach(p => {
            const dx = p.x - originX;
            const dy = p.y - originY;
            const dist = Math.hypot(dx, dy) || 0.001;
            const ux = dx / dist;
            const uy = dy / dist;
            const speed = (1 + (dist / maxDist) * 26) * accel;

            p.x += ux * speed;
            p.y += uy * speed;

            const streakLen = speed * 8;
            ctx.strokeStyle = `rgba(${accentColor}, ${0.4 + 0.4 * accel})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x - ux * streakLen, p.y - uy * streakLen);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            // Same respawn-when-offscreen as the hero canvas's own nodes —
            // keeps a steady stream flowing past instead of one burst that
            // thins out over the (now longer) phase. Scattered across most
            // of the radius, not clustered back at the origin, so the field
            // reads as surrounding the viewer instead of repeatedly
            // bursting from a single point.
            if (Math.hypot(p.x - originX, p.y - originY) > maxDist * 1.15) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * maxDist * 0.7;
                p.x = originX + Math.cos(angle) * r;
                p.y = originY + Math.sin(angle) * r;
            }
        });

        asteroids.forEach(a => {
            const dx = a.x - originX;
            const dy = a.y - originY;
            const dist = Math.hypot(dx, dy) || 0.001;
            const ux = dx / dist;
            const uy = dy / dist;
            const speed = (1 + (dist / maxDist) * 22) * accel;

            a.x += ux * speed;
            a.y += uy * speed;
            a.rotation += a.rotationSpeed;

            drawAsteroid(a, accel);

            // Respawned with a fresh shape/rotation too, not just position —
            // otherwise the same rock reappearing with its old silhouette
            // would read as teleporting rather than as a new asteroid
            // arriving. Scattered across most of the radius, not clustered
            // at the origin, so the field surrounds the viewer instead of
            // repeatedly bursting from a single point.
            if (Math.hypot(a.x - originX, a.y - originY) > maxDist * 1.15) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * maxDist * 0.7;
                const size = 9 + Math.random() * 10;
                a.x = originX + Math.cos(angle) * r;
                a.y = originY + Math.sin(angle) * r;
                a.rotation = Math.random() * Math.PI * 2;
                a.rotationSpeed = (Math.random() - 0.5) * 0.12;
                a.shape = makeAsteroidShape(size);
            }
        });
    }

    let startTime = 0;
    let duration = 0;
    let resetFraction = 0.5;

    function loop() {
        const p = Math.min(1, (performance.now() - startTime) / duration);

        if (p < resetFraction) {
            renderOutbound(p / resetFraction);
        } else {
            // Nothing left to draw but the fading flash — the burst of
            // points has already served its purpose and needs no further
            // updates, unlike the hero canvas which keeps its own field
            // alive afterward for its normal drifting animation.
            ctx.clearRect(0, 0, width, height);
            const fadeP = (p - resetFraction) / (1 - resetFraction);
            const alpha = 1 - fadeP;
            if (alpha > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fillRect(0, 0, width, height);
            }
        }

        if (p < 1) {
            animationId = requestAnimationFrame(loop);
        } else {
            ctx.clearRect(0, 0, width, height);
            animationId = null;
        }
    }

    document.addEventListener('warpjump', (e) => {
        resize();
        originX = (e.detail && e.detail.originX) ?? width / 2;
        originY = (e.detail && e.detail.originY) ?? height / 2;
        seedPoints();
        seedAsteroids();
        seedRings();
        startTime = performance.now();
        duration = (e.detail && e.detail.duration) || 5500;
        resetFraction = (e.detail && e.detail.resetFraction) || 0.5;
        if (animationId) cancelAnimationFrame(animationId);
        loop();
    });

    // Same bfcache-restore concern as the hero canvas's own reset above —
    // this canvas could come back mid-burst, still drawing tunnel rings or
    // a leftover flash. Clear it and drop any stale loop rather than
    // leaving that on screen.
    window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        ctx.clearRect(0, 0, width, height);
    });
})();
