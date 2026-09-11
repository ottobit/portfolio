const HIGH_SCORE_KEY = 'dotDodgeHighScore';

function readHighScore() {
    try {
        return parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
    } catch (e) {
        return 0;
    }
}

function writeHighScore(score) {
    try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
    } catch (e) {}
}

function themeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        bg: style.getPropertyValue('--bg').trim() || '#101014',
        surface: style.getPropertyValue('--surface').trim() || '#1a1a22',
        text: style.getPropertyValue('--text').trim() || '#f2f2f5',
        textMuted: style.getPropertyValue('--text-muted').trim() || '#a3a3ad',
        accent: style.getPropertyValue('--accent').trim() || '#0d9488',
    };
}

export function initDotDodge(canvas, opts) {
    const options = opts || {};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const dot = { x: W / 2, y: H - 46, r: 16 };
    const keys = { left: false, right: false };
    let dragging = false;

    let asteroids = [];
    let stars = [];
    let state = 'ready'; // ready | playing | over
    let score = 0;
    let highScore = readHighScore();
    let elapsed = 0;
    let spawnTimer = 0;
    let starTimer = 0;
    let lastTime = null;
    let rafId = null;

    onScoreChange(0, highScore);

    function onScoreChange(s, h) {
        if (typeof options.onScoreChange === 'function') options.onScoreChange(s, h);
    }
    function onStateChange(s) {
        if (typeof options.onStateChange === 'function') options.onStateChange(s);
    }

    function reset() {
        dot.x = W / 2;
        asteroids = [];
        stars = [];
        score = 0;
        elapsed = 0;
        spawnTimer = 0;
        starTimer = 0;
        onScoreChange(0, highScore);
    }

    function start() {
        reset();
        state = 'playing';
        onStateChange(state);
    }

    function clampDotX(x) {
        return Math.max(dot.r, Math.min(W - dot.r, x));
    }

    function handleKeyDown(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
        if ((e.key === ' ' || e.key === 'Enter') && state !== 'playing') {
            e.preventDefault();
            start();
        }
    }
    function handleKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    }

    function pointerX(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return (clientX - rect.left) * (W / rect.width);
    }
    function handlePointerDown(e) {
        if (state !== 'playing') {
            start();
            return;
        }
        dragging = true;
        dot.x = clampDotX(pointerX(e));
    }
    function handlePointerMove(e) {
        if (!dragging) return;
        dot.x = clampDotX(pointerX(e));
    }
    function handlePointerUp() {
        dragging = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    function spawnAsteroid() {
        const r = 10 + Math.random() * 14;
        asteroids.push({ x: r + Math.random() * (W - r * 2), y: -r, r, vy: 0 });
    }
    function spawnStar() {
        const r = 9;
        stars.push({ x: r + Math.random() * (W - r * 2), y: -r, r, vy: 0 });
    }

    function circlesHit(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.hypot(dx, dy) < a.r + b.r;
    }

    function update(dt) {
        if (state !== 'playing') return;

        const moveSpeed = 320;
        if (!dragging) {
            if (keys.left) dot.x -= moveSpeed * dt;
            if (keys.right) dot.x += moveSpeed * dt;
            dot.x = clampDotX(dot.x);
        }

        elapsed += dt;
        score += dt * 10;

        const fallSpeed = 90 + Math.min(elapsed * 6, 220);
        const spawnInterval = Math.max(0.45, 1.1 - elapsed * 0.02);

        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnAsteroid();
        }
        starTimer += dt;
        if (starTimer >= 3.2) {
            starTimer = 0;
            if (Math.random() < 0.7) spawnStar();
        }

        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            a.y += fallSpeed * dt;
            if (a.y - a.r > H) {
                asteroids.splice(i, 1);
                continue;
            }
            if (circlesHit(a, dot)) {
                gameOver();
                return;
            }
        }
        for (let i = stars.length - 1; i >= 0; i--) {
            const s = stars[i];
            s.y += fallSpeed * 0.85 * dt;
            if (s.y - s.r > H) {
                stars.splice(i, 1);
                continue;
            }
            if (circlesHit(s, dot)) {
                stars.splice(i, 1);
                score += 50;
            }
        }

        onScoreChange(Math.floor(score), highScore);
    }

    function gameOver() {
        state = 'over';
        const finalScore = Math.floor(score);
        if (finalScore > highScore) {
            highScore = finalScore;
            writeHighScore(highScore);
        }
        onScoreChange(finalScore, highScore);
        onStateChange(state, finalScore, highScore);
    }

    function drawBackground(colors) {
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, W, H);
    }

    function drawDot(colors) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();
        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.arc(dot.x - 5, dot.y - 3, 2.4, 0, Math.PI * 2);
        ctx.arc(dot.x + 5, dot.y - 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawAsteroids(colors) {
        ctx.fillStyle = colors.textMuted;
        asteroids.forEach((a) => {
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawStars(colors) {
        ctx.fillStyle = colors.accent;
        stars.forEach((s) => {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const angle2 = angle + Math.PI / 5;
                ctx.lineTo(Math.cos(angle) * s.r, Math.sin(angle) * s.r);
                ctx.lineTo(Math.cos(angle2) * s.r * 0.45, Math.sin(angle2) * s.r * 0.45);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
    }

    function draw() {
        const colors = themeColors();
        drawBackground(colors);
        drawStars(colors);
        drawAsteroids(colors);
        if (state !== 'over') drawDot(colors);

        if (state === 'ready') {
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'center';
            ctx.font = '600 15px system-ui, sans-serif';
            ctx.fillText(options.startLabel || 'Tap or press Space to start', W / 2, H / 2);
        }
    }

    function loop(time) {
        if (lastTime === null) lastTime = time;
        const dt = reducedMotion ? 1 / 30 : Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;
        update(dt);
        draw();
        rafId = requestAnimationFrame(loop);
    }

    draw();
    rafId = requestAnimationFrame(loop);

    return {
        start,
        destroy() {
            if (rafId) cancelAnimationFrame(rafId);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        },
    };
}
