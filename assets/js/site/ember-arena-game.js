const BEST_LEVEL_KEY = 'emberKeepBestLevel';
const MONSTER_COLOR = '#c0392b';
const FIRE_COLOR = '#e67e22';

function readBestLevel() {
    try {
        return parseInt(localStorage.getItem(BEST_LEVEL_KEY), 10) || 1;
    } catch (e) {
        return 1;
    }
}
function writeBestLevel(level) {
    try {
        localStorage.setItem(BEST_LEVEL_KEY, String(level));
    } catch (e) {}
}

function themeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        bg: style.getPropertyValue('--bg').trim() || '#101014',
        text: style.getPropertyValue('--text').trim() || '#f2f2f5',
        textMuted: style.getPropertyValue('--text-muted').trim() || '#a3a3ad',
        accent: style.getPropertyValue('--accent').trim() || '#0d9488',
    };
}

export function initEmberArena(canvas, opts) {
    const options = opts || {};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const player = {
        x: W / 2,
        y: H / 2,
        r: 14,
        facing: { x: 1, y: 0 },
        maxHp: 100,
        hp: 100,
        invulnUntil: 0,
        meleeDamage: 18,
        fireDamage: 14,
    };
    const keys = { up: false, down: false, left: false, right: false };
    let dragging = false;

    let monsters = [];
    let fireballs = [];
    let explosions = [];
    let level = 1;
    let xp = 0;
    let xpToNext = 6;
    let monstersKilled = 0;
    let bestLevel = readBestLevel();
    let state = 'ready'; // ready | playing | over
    let elapsed = 0;
    let spawnTimer = 0;
    let meleeCooldown = 0;
    let fireCooldown = 0;
    let levelFlash = 0;
    let lastTime = null;
    let rafId = null;

    function onStatsChange(hp, maxHp, lvl, x, xNext, best) {
        if (typeof options.onStatsChange === 'function') options.onStatsChange(hp, maxHp, lvl, x, xNext, best);
    }
    function onStateChange(s, stats) {
        if (typeof options.onStateChange === 'function') options.onStateChange(s, stats);
    }

    function pushStats() {
        onStatsChange(Math.max(0, Math.ceil(player.hp)), player.maxHp, level, Math.floor(xp), xpToNext, bestLevel);
    }
    pushStats();

    function reset() {
        player.x = W / 2;
        player.y = H / 2;
        player.facing = { x: 1, y: 0 };
        player.maxHp = 100;
        player.hp = 100;
        player.invulnUntil = 0;
        player.meleeDamage = 18;
        player.fireDamage = 14;
        monsters = [];
        fireballs = [];
        explosions = [];
        level = 1;
        xp = 0;
        xpToNext = 6;
        monstersKilled = 0;
        elapsed = 0;
        spawnTimer = 0;
        meleeCooldown = 0;
        fireCooldown = 0;
        levelFlash = 0;
        pushStats();
    }

    function start() {
        reset();
        state = 'playing';
        onStateChange(state);
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function handleKeyDown(e) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
        if (e.key === ' ' || e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (state === 'playing') meleeAttack();
            else start();
        }
        if (e.key === 'x' || e.key === 'X') {
            if (state === 'playing') fireballAttack();
            else start();
        }
        if (e.key === 'Enter' && state !== 'playing') start();
    }
    function handleKeyUp(e) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    }

    function pointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (W / rect.width),
            y: (clientY - rect.top) * (H / rect.height),
        };
    }
    function handlePointerDown(e) {
        if (state !== 'playing') {
            start();
            return;
        }
        dragging = true;
        movePlayerToward(pointerPos(e));
    }
    function handlePointerMove(e) {
        if (!dragging) return;
        movePlayerToward(pointerPos(e));
    }
    function handlePointerUp() {
        dragging = false;
    }
    function movePlayerToward(pos) {
        const dx = pos.x - player.x;
        const dy = pos.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) player.facing = { x: dx / dist, y: dy / dist };
        player.x = clamp(pos.x, player.r, W - player.r);
        player.y = clamp(pos.y, player.r, H - player.r);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    function meleeAttack() {
        if (meleeCooldown > 0) return;
        meleeCooldown = 0.4;
        const range = 44;
        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            if (Math.hypot(m.x - player.x, m.y - player.y) < range + m.r) {
                damageMonster(i, player.meleeDamage);
            }
        }
    }
    function fireballAttack() {
        if (fireCooldown > 0) return;
        fireCooldown = 2;
        fireballs.push({
            x: player.x,
            y: player.y,
            vx: player.facing.x * 260,
            vy: player.facing.y * 260,
            traveled: 0,
            maxRange: 260,
        });
    }
    function damageMonster(index, amount) {
        const m = monsters[index];
        m.hp -= amount;
        if (m.hp <= 0) {
            monsters.splice(index, 1);
            monstersKilled++;
            gainXp(m.xpValue);
        }
    }
    function gainXp(amount) {
        xp += amount;
        while (xp >= xpToNext) {
            xp -= xpToNext;
            level++;
            xpToNext = Math.round(xpToNext * 1.35 + 2);
            player.maxHp += 20;
            player.hp = player.maxHp;
            player.meleeDamage += 4;
            player.fireDamage += 3;
            levelFlash = 1.2;
        }
    }

    function spawnMonster() {
        const edge = Math.floor(Math.random() * 4);
        const r = 12 + Math.random() * 6;
        let x, y;
        if (edge === 0) { x = Math.random() * W; y = -r; }
        else if (edge === 1) { x = W + r; y = Math.random() * H; }
        else if (edge === 2) { x = Math.random() * W; y = H + r; }
        else { x = -r; y = Math.random() * H; }
        const speed = 40 + Math.random() * 20 + level * 3;
        const maxHp = 20 + level * 6;
        monsters.push({ x, y, r, speed, hp: maxHp, maxHp, xpValue: 3 + level });
    }

    function update(dt) {
        if (state !== 'playing') return;
        elapsed += dt;

        let mvx = 0;
        let mvy = 0;
        if (!dragging) {
            if (keys.left) mvx -= 1;
            if (keys.right) mvx += 1;
            if (keys.up) mvy -= 1;
            if (keys.down) mvy += 1;
            if (mvx !== 0 || mvy !== 0) {
                const len = Math.hypot(mvx, mvy);
                mvx /= len;
                mvy /= len;
                player.facing = { x: mvx, y: mvy };
                const speed = 190;
                player.x = clamp(player.x + mvx * speed * dt, player.r, W - player.r);
                player.y = clamp(player.y + mvy * speed * dt, player.r, H - player.r);
            }
        }

        meleeCooldown = Math.max(0, meleeCooldown - dt);
        fireCooldown = Math.max(0, fireCooldown - dt);
        levelFlash = Math.max(0, levelFlash - dt);

        const spawnInterval = Math.max(0.5, 1.6 - level * 0.08);
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnMonster();
        }

        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            const dx = player.x - m.x;
            const dy = player.y - m.y;
            const dist = Math.hypot(dx, dy) || 1;
            m.x += (dx / dist) * m.speed * dt;
            m.y += (dy / dist) * m.speed * dt;
            if (dist < player.r + m.r && elapsed >= player.invulnUntil) {
                player.hp -= 10;
                player.invulnUntil = elapsed + 0.6;
                if (player.hp <= 0) {
                    player.hp = 0;
                    gameOver();
                    return;
                }
            }
        }

        for (let i = fireballs.length - 1; i >= 0; i--) {
            const f = fireballs[i];
            const step = Math.hypot(f.vx * dt, f.vy * dt);
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.traveled += step;
            let hit = false;
            for (let j = monsters.length - 1; j >= 0; j--) {
                if (Math.hypot(monsters[j].x - f.x, monsters[j].y - f.y) < monsters[j].r + 8) {
                    hit = true;
                    break;
                }
            }
            if (hit || f.traveled >= f.maxRange || f.x < 0 || f.x > W || f.y < 0 || f.y > H) {
                explosions.push({ x: f.x, y: f.y, r: 0, maxR: 55, life: 0.35 });
                for (let j = monsters.length - 1; j >= 0; j--) {
                    if (Math.hypot(monsters[j].x - f.x, monsters[j].y - f.y) < 55) {
                        damageMonster(j, player.fireDamage);
                    }
                }
                fireballs.splice(i, 1);
            }
        }

        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            ex.life -= dt;
            ex.r = ex.maxR * (1 - Math.max(0, ex.life) / 0.35);
            if (ex.life <= 0) explosions.splice(i, 1);
        }

        pushStats();
    }

    function gameOver() {
        state = 'over';
        if (level >= bestLevel) {
            bestLevel = level;
            writeBestLevel(bestLevel);
        }
        pushStats();
        onStateChange(state, { level, monstersKilled, best: bestLevel });
    }

    function drawPlayer(colors) {
        ctx.fillStyle = colors.accent;
        ctx.fillRect(player.x - player.r, player.y - player.r, player.r * 2, player.r * 2);
        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.arc(player.x + player.facing.x * 6, player.y + player.facing.y * 6, 3, 0, Math.PI * 2);
        ctx.fill();
        if (elapsed < player.invulnUntil) {
            ctx.strokeStyle = colors.text;
            ctx.lineWidth = 2;
            ctx.strokeRect(player.x - player.r - 3, player.y - player.r - 3, player.r * 2 + 6, player.r * 2 + 6);
        }
    }
    function drawMonsters() {
        monsters.forEach((m) => {
            ctx.fillStyle = MONSTER_COLOR;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    function drawFireballs() {
        ctx.fillStyle = FIRE_COLOR;
        fireballs.forEach((f) => {
            ctx.beginPath();
            ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
        explosions.forEach((ex) => {
            ctx.strokeStyle = FIRE_COLOR;
            ctx.globalAlpha = Math.max(0, ex.life / 0.35);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        });
    }
    function drawLevelFlash(colors) {
        if (levelFlash <= 0) return;
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.globalAlpha = Math.min(1, levelFlash);
        ctx.fillText(`Livello ${level}!`, W / 2, H / 2 - 40);
        ctx.globalAlpha = 1;
    }

    function draw() {
        const colors = themeColors();
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, W, H);
        drawMonsters();
        drawFireballs();
        if (state !== 'over') drawPlayer(colors);
        drawLevelFlash(colors);

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
        meleeAttack() {
            if (state === 'playing') meleeAttack();
            else start();
        },
        fireballAttack() {
            if (state === 'playing') fireballAttack();
            else start();
        },
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
