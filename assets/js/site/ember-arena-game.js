const BEST_LEVEL_KEY = 'emberKeepBestLevel';
const FIRE_COLOR = '#e67e22';
const FIRE_GLOW = '#f9ca24';

// Pixel-art sprites drawn with fillRect on a small grid — same technique as
// the Triple Triad icon, so no external image assets. '.' is transparent.
const HERO_PALETTE = {
    H: '#2c3e50', S: '#f1c27d', E: '#1a1a1a', B: '#5d4037',
    L: '#34495e', O: '#2c3e50', D: '#8d6e63', M: '#bdc3c7',
};
const HERO_FRAMES = [
    [
        '...PHHH...',
        '..HHHHHH..',
        '..HSSSSH..',
        '..HSESES..',
        '...SSSS...',
        '.DTTTTTT..',
        'DMTTTTTTS.',
        'DMTTTTTT..',
        '.DBBBBBB..',
        '..LL.LL...',
        '..LL.LL...',
        '.OOO.OOO..',
    ],
    [
        '...PHHH...',
        '..HHHHHH..',
        '..HSSSSH..',
        '..HSESES..',
        '...SSSS...',
        '.DTTTTTT..',
        'DMTTTTTTS.',
        'DMTTTTTT..',
        '.DBBBBBB..',
        '..LL..LL..',
        '.LL....LL.',
        'OOO....OOO',
    ],
];

const MONSTER_TYPES = {
    slime: {
        palette: { A: '#2ecc71', a: '#27ae60', E: '#ffffff', p: '#1a1a1a', M: '#1a1a1a' },
        frames: [[
            '...AAAA...',
            '..AAAAAA..',
            '.AAEAAEAA.',
            '.AApAApAA.',
            'AAAAAAAAAA',
            'AAAAMMAAAA',
            'aAAAAAAAAa',
            '.aaaaaaaa.',
        ]],
        cell: 2.6, r: 13, speedMul: 1, hpMul: 1, weight: 5, minLevel: 1,
    },
    imp: {
        palette: { A: '#c0392b', a: '#7b241c', E: '#ffffff', p: '#1a1a1a', M: '#f1c40f' },
        frames: [[
            '.a......a.',
            '..a....a..',
            '..AAAAAA..',
            '.AAEAAEAA.',
            '.AApAApAA.',
            '.AAAMMAAA.',
            '..AAAAAA..',
            '...AAAA...',
            '..A....A..',
            '.a......a.',
        ]],
        cell: 2.6, r: 12, speedMul: 1.15, hpMul: 0.85, weight: 3, minLevel: 1,
    },
    bat: {
        palette: { A: '#8e44ad', a: '#5b2c6f', E: '#ffffff', p: '#e74c3c' },
        frames: [
            [
                'a..........a',
                'aa...AA...aa',
                '.aa.AAAA.aa.',
                '..aaAEEAaa..',
                '....AppA....',
                '....AAAA....',
                '....A..A....',
            ],
            [
                '............',
                '.....AA.....',
                '....AAAA....',
                'aaaaAEEAaaaa',
                '.aaaAppAaaa.',
                '....AAAA....',
                '....A..A....',
            ],
        ],
        cell: 2.4, r: 11, speedMul: 1.5, hpMul: 0.6, weight: 2, minLevel: 2,
    },
};

function pickMonsterType(level) {
    const pool = Object.keys(MONSTER_TYPES).filter((k) => MONSTER_TYPES[k].minLevel <= level);
    const total = pool.reduce((s, k) => s + MONSTER_TYPES[k].weight, 0);
    let roll = Math.random() * total;
    for (const k of pool) {
        roll -= MONSTER_TYPES[k].weight;
        if (roll <= 0) return k;
    }
    return pool[0];
}

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
        moving: false,
        walkT: 0,
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
        m.flash = 0.12;
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
        const type = pickMonsterType(level);
        const def = MONSTER_TYPES[type];
        const r = def.r;
        let x, y;
        if (edge === 0) { x = Math.random() * W; y = -r; }
        else if (edge === 1) { x = W + r; y = Math.random() * H; }
        else if (edge === 2) { x = Math.random() * W; y = H + r; }
        else { x = -r; y = Math.random() * H; }
        const speed = (40 + Math.random() * 20 + level * 3) * def.speedMul;
        const maxHp = Math.round((20 + level * 6) * def.hpMul);
        monsters.push({
            x, y, r, speed, type, hp: maxHp, maxHp, xpValue: 3 + level,
            flash: 0, phase: Math.random() * Math.PI * 2,
        });
    }

    function update(dt) {
        if (state !== 'playing') return;
        elapsed += dt;
        const prevX = player.x;
        const prevY = player.y;

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

        player.moving = player.x !== prevX || player.y !== prevY;
        if (player.moving) player.walkT += dt;

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
            m.flash = Math.max(0, m.flash - dt);
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

    function drawSprite(rows, palette, cx, cy, cell, flipX, override) {
        const w = rows[0].length * cell;
        const h = rows.length * cell;
        ctx.save();
        ctx.translate(cx, cy);
        if (flipX) ctx.scale(-1, 1);
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const ch = rows[r][c];
                if (ch === '.') continue;
                ctx.fillStyle = override || palette[ch];
                // +0.3 overlap hides hairline seams between cells at fractional scales.
                ctx.fillRect(-w / 2 + c * cell, -h / 2 + r * cell, cell + 0.3, cell + 0.3);
            }
        }
        ctx.restore();
    }

    function drawShadow(cx, cy, rx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, rx * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlayer(colors) {
        // Blink while invulnerable instead of drawing a box around the hero.
        if (elapsed < player.invulnUntil && Math.floor(elapsed * 20) % 2 === 0) return;
        const cell = 3;
        const frame = player.moving ? Math.floor(player.walkT * 8) % 2 : 0;
        const bob = player.moving ? (frame === 0 ? 0 : -1.5) : 0;
        const flip = player.facing.x < 0;
        const palette = Object.assign({ P: colors.accent, T: colors.accent }, HERO_PALETTE);

        drawShadow(player.x, player.y + 18, 12);

        // Sword: swings through an arc right after a melee attack, otherwise rests along the facing direction.
        const angle = Math.atan2(player.facing.y, player.facing.x);
        const swinging = meleeCooldown > 0.28;
        const swingT = swinging ? (0.4 - meleeCooldown) / 0.12 : 1;
        const swingOffset = swinging ? (-0.9 + swingT * 1.8) : 0.35;
        ctx.save();
        ctx.translate(player.x, player.y + bob);
        ctx.rotate(angle + swingOffset);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(8, -4, 3, 8);
        ctx.fillStyle = '#dfe6e9';
        ctx.fillRect(11, -1.5, 17, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(11, -1.5, 17, 1);
        ctx.restore();
        if (swinging) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, 30, angle - 0.9, angle - 0.9 + swingT * 1.8);
            ctx.stroke();
            ctx.restore();
        }

        drawSprite(HERO_FRAMES[frame], palette, player.x, player.y + bob, cell, flip);
    }

    function drawMonsters() {
        monsters.forEach((m) => {
            const def = MONSTER_TYPES[m.type];
            const t = elapsed * 6 + m.phase;
            const override = m.flash > 0 ? '#ffffff' : null;
            let frame = 0;
            let sx = 1;
            let sy = 1;
            let dy = 0;
            if (m.type === 'slime') {
                sy = 1 + Math.sin(t) * 0.12;
                sx = 1 - Math.sin(t) * 0.08;
            } else if (m.type === 'imp') {
                dy = Math.sin(t * 1.3) * 2;
            } else if (m.type === 'bat') {
                frame = Math.floor(elapsed * 10 + m.phase) % 2;
                dy = Math.sin(t) * 3 - 4;
            }
            if (m.type !== 'bat') drawShadow(m.x, m.y + m.r * 0.8, m.r * 0.9);
            ctx.save();
            ctx.translate(m.x, m.y + dy);
            ctx.scale(sx, sy);
            drawSprite(def.frames[frame], def.palette, 0, 0, def.cell, m.x > player.x, override);
            ctx.restore();

            if (m.hp < m.maxHp) {
                const bw = 22;
                const bx = m.x - bw / 2;
                const by = m.y - m.r - 9;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.fillRect(bx, by, bw, 4);
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), 4);
            }
        });
    }

    function drawFireballs() {
        fireballs.forEach((f) => {
            const flicker = 1 + Math.sin(elapsed * 40) * 0.15;
            ctx.fillStyle = 'rgba(249, 202, 36, 0.35)';
            ctx.beginPath();
            ctx.arc(f.x, f.y, 11 * flicker, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = FIRE_COLOR;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 6 * flicker, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = FIRE_GLOW;
            ctx.beginPath();
            ctx.arc(f.x - f.vx * 0.01, f.y - f.vy * 0.01, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        explosions.forEach((ex) => {
            const a = Math.max(0, ex.life / 0.35);
            ctx.globalAlpha = a * 0.35;
            ctx.fillStyle = FIRE_GLOW;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = a;
            ctx.strokeStyle = FIRE_COLOR;
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
