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
    // Never picked by the random spawn (weight 0): spawned explicitly every 5 levels.
    boss: {
        palette: { A: '#556b2f', a: '#2f3f1a', E: '#ffffff', p: '#c0392b', C: '#f1c40f', T: '#dfe6e9' },
        frames: [[
            '....C..C..C...',
            '....CCCCCC....',
            '...AAAAAAAA...',
            '..AAAAAAAAAA..',
            '..AEEAAAAEEA..',
            '..AppAAAAppA..',
            '..AAAAAAAAAA..',
            '..AAATAATAAA..',
            '.aAAAAAAAAAAa.',
            '.aAAAAAAAAAAa.',
            '..aAAAAAAAAa..',
            '...aAAAAAAa...',
            '...aa....aa...',
            '..aaa....aaa..',
        ]],
        cell: 3.6, r: 26, speedMul: 0.55, hpMul: 12, weight: 0, minLevel: Infinity, contactDamage: 25,
    },
};

function pickMonsterType(level) {
    const pool = Object.keys(MONSTER_TYPES).filter((k) => MONSTER_TYPES[k].weight > 0 && MONSTER_TYPES[k].minLevel <= level);
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
    // Fixed analog stick in the bottom-left corner: always drawn, engaged by a
    // pointer landing near it, and it follows only that pointer afterwards.
    let joystick = null;
    const JOY_RADIUS = 40;
    const JOY_DEAD = 8;
    const JOY_BASE = { x: 72, y: H - 72 };
    const JOY_GRAB = JOY_RADIUS * 2;
    const MELEE_CD = 0.4;
    const ULT_CD = 15;
    const ULT_DUR = 0.6;
    const startLevel = Math.max(1, options.startLevel || 1);

    let monsters = [];
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
    let ultCooldown = 0;
    let levelFlash = 0;
    let flashText = '';
    let screenFlash = 0;
    let lastTime = null;
    let rafId = null;

    function onStatsChange(hp, maxHp, lvl, x, xNext, best) {
        if (typeof options.onStatsChange === 'function') options.onStatsChange(hp, maxHp, lvl, x, xNext, best);
    }
    function onStateChange(s, stats) {
        if (typeof options.onStateChange === 'function') options.onStateChange(s, stats);
    }
    function onCooldownChange(melee, ult) {
        if (typeof options.onCooldownChange === 'function') options.onCooldownChange(melee, ult);
    }

    function pushStats() {
        onStatsChange(Math.max(0, Math.ceil(player.hp)), player.maxHp, level, Math.floor(xp), xpToNext, bestLevel);
    }
    function pushCooldowns() {
        onCooldownChange(meleeCooldown / MELEE_CD, ultCooldown / ULT_CD);
    }
    pushStats();
    pushCooldowns();

    function bossAlive() {
        return monsters.some((m) => m.type === 'boss');
    }

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
        explosions = [];
        level = 1;
        xp = 0;
        xpToNext = 6;
        monstersKilled = 0;
        elapsed = 0;
        spawnTimer = 0;
        meleeCooldown = 0;
        ultCooldown = 0;
        levelFlash = 0;
        screenFlash = 0;
        joystick = null;
        for (let i = 1; i < startLevel; i++) applyLevelUp(false);
        pushStats();
        pushCooldowns();
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
        if (e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V') {
            if (state === 'playing') ultimateAttack();
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
        if (joystick) return;
        const p = pointerPos(e);
        if (Math.hypot(p.x - JOY_BASE.x, p.y - JOY_BASE.y) > JOY_GRAB) return;
        joystick = { id: e.pointerId, ox: JOY_BASE.x, oy: JOY_BASE.y, x: p.x, y: p.y };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
    }
    function handlePointerMove(e) {
        if (!joystick || e.pointerId !== joystick.id) return;
        const p = pointerPos(e);
        joystick.x = p.x;
        joystick.y = p.y;
        e.preventDefault();
    }
    function handlePointerUp(e) {
        if (joystick && e.pointerId === joystick.id) joystick = null;
    }
    // Direction vector (-1..1 per axis, magnitude ≤ 1) from the stick, or null inside the dead zone.
    function joystickVector() {
        if (!joystick) return null;
        const dx = joystick.x - joystick.ox;
        const dy = joystick.y - joystick.oy;
        const len = Math.hypot(dx, dy);
        if (len < JOY_DEAD) return null;
        const mag = Math.min(1, len / JOY_RADIUS);
        return { x: (dx / len) * mag, y: (dy / len) * mag };
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    function ultimateAttack() {
        if (ultCooldown > 0) return;
        ultCooldown = ULT_CD;
        screenFlash = 0.25;
        explosions.push({
            x: player.x, y: player.y, r: 0,
            maxR: Math.hypot(W, H), life: ULT_DUR, dur: ULT_DUR,
            ult: true, hit: new Set(),
        });
    }
    function meleeAttack() {
        if (meleeCooldown > 0) return;
        meleeCooldown = MELEE_CD;
        const range = 44;
        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            if (Math.hypot(m.x - player.x, m.y - player.y) < range + m.r) {
                damageMonster(i, player.meleeDamage);
            }
        }
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
    function applyLevelUp(announce) {
        level++;
        xpToNext = Math.round(xpToNext * 1.35 + 2);
        player.maxHp += 20;
        player.hp = player.maxHp;
        player.meleeDamage += 4;
        player.fireDamage += 3;
        if (!announce) return;
        if (level % 5 === 0) {
            spawnMonster('boss');
            flashText = 'Boss!';
            levelFlash = 1.8;
        } else {
            flashText = `Livello ${level}!`;
            levelFlash = 1.2;
        }
    }
    function gainXp(amount) {
        xp += amount;
        while (xp >= xpToNext) {
            xp -= xpToNext;
            applyLevelUp(true);
        }
    }

    function spawnMonster(forcedType) {
        const edge = Math.floor(Math.random() * 4);
        const type = forcedType || pickMonsterType(level);
        const def = MONSTER_TYPES[type];
        const r = def.r;
        let x, y;
        if (edge === 0) { x = Math.random() * W; y = -r; }
        else if (edge === 1) { x = W + r; y = Math.random() * H; }
        else if (edge === 2) { x = Math.random() * W; y = H + r; }
        else { x = -r; y = Math.random() * H; }
        const speed = (40 + Math.random() * 20 + level * 3) * def.speedMul;
        const maxHp = Math.round((20 + level * 6) * def.hpMul);
        const xpValue = type === 'boss' ? Math.round(xpToNext * 1.8) : 3 + level;
        monsters.push({
            x, y, r, speed, type, hp: maxHp, maxHp, xpValue,
            flash: 0, phase: Math.random() * Math.PI * 2,
            chargeTimer: 3, charging: 0,
        });
    }

    function update(dt) {
        if (state !== 'playing') return;
        elapsed += dt;
        const prevX = player.x;
        const prevY = player.y;

        let mvx = 0;
        let mvy = 0;
        const joy = joystickVector();
        if (joy) {
            mvx = joy.x;
            mvy = joy.y;
        } else if (!joystick) {
            if (keys.left) mvx -= 1;
            if (keys.right) mvx += 1;
            if (keys.up) mvy -= 1;
            if (keys.down) mvy += 1;
            const len = Math.hypot(mvx, mvy);
            if (len > 0) {
                mvx /= len;
                mvy /= len;
            }
        }
        if (mvx !== 0 || mvy !== 0) {
            const len = Math.hypot(mvx, mvy);
            player.facing = { x: mvx / len, y: mvy / len };
            const speed = 190;
            player.x = clamp(player.x + mvx * speed * dt, player.r, W - player.r);
            player.y = clamp(player.y + mvy * speed * dt, player.r, H - player.r);
        }

        player.moving = player.x !== prevX || player.y !== prevY;
        if (player.moving) player.walkT += dt;

        meleeCooldown = Math.max(0, meleeCooldown - dt);
        ultCooldown = Math.max(0, ultCooldown - dt);
        levelFlash = Math.max(0, levelFlash - dt);
        screenFlash = Math.max(0, screenFlash - dt);

        const spawnInterval = Math.max(0.5, 1.6 - level * 0.08) * (bossAlive() ? 2 : 1);
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnMonster();
        }

        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            const def = MONSTER_TYPES[m.type];
            const dx = player.x - m.x;
            const dy = player.y - m.y;
            const dist = Math.hypot(dx, dy) || 1;
            let speedMul = 1;
            if (m.type === 'boss') {
                m.chargeTimer -= dt;
                if (m.chargeTimer <= 0) {
                    m.charging = 0.5;
                    m.chargeTimer = 3;
                }
                if (m.charging > 0) {
                    m.charging -= dt;
                    speedMul = 3;
                }
            }
            m.x += (dx / dist) * m.speed * speedMul * dt;
            m.y += (dy / dist) * m.speed * speedMul * dt;
            m.flash = Math.max(0, m.flash - dt);
            if (dist < player.r + m.r && elapsed >= player.invulnUntil) {
                player.hp -= def.contactDamage || 10;
                player.invulnUntil = elapsed + 0.6;
                if (player.hp <= 0) {
                    player.hp = 0;
                    gameOver();
                    return;
                }
            }
        }

        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            ex.life -= dt;
            ex.r = ex.maxR * (1 - Math.max(0, ex.life) / ex.dur);
            if (ex.ult) {
                // The expanding ring hits each monster once as it sweeps past.
                for (let j = monsters.length - 1; j >= 0; j--) {
                    const m = monsters[j];
                    if (!ex.hit.has(m) && Math.hypot(m.x - ex.x, m.y - ex.y) < ex.r + m.r) {
                        ex.hit.add(m);
                        damageMonster(j, player.fireDamage * 3);
                    }
                }
            }
            if (ex.life <= 0) explosions.splice(i, 1);
        }

        pushStats();
        pushCooldowns();
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

            if (m.hp < m.maxHp && m.type !== 'boss') {
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

    function drawExplosions() {
        explosions.forEach((ex) => {
            const a = Math.max(0, ex.life / ex.dur);
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
        ctx.fillStyle = flashText === 'Boss!' ? '#e74c3c' : colors.text;
        ctx.textAlign = 'center';
        ctx.font = `700 ${flashText === 'Boss!' ? 28 : 20}px system-ui, sans-serif`;
        ctx.globalAlpha = Math.min(1, levelFlash);
        ctx.fillText(flashText, W / 2, H / 2 - 40);
        ctx.globalAlpha = 1;
    }

    function drawBossBar(colors) {
        const boss = monsters.find((m) => m.type === 'boss');
        if (!boss) return;
        const bw = Math.min(280, W - 40);
        const bx = (W - bw) / 2;
        const by = 12;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(bx, by, bw, 8);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 8);
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText('Boss', W / 2, by + 22);
    }

    function drawJoystick() {
        // The knob mirrors whatever is steering: the finger, or the arrow keys.
        let v = joystickVector();
        if (!v && !joystick) {
            const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            const ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
            const len = Math.hypot(kx, ky);
            if (len > 0) v = { x: kx / len, y: ky / len };
        }
        const active = !!joystick;
        const kx = JOY_BASE.x + (v ? v.x * JOY_RADIUS : 0);
        const ky = JOY_BASE.y + (v ? v.y * JOY_RADIUS : 0);
        ctx.save();
        ctx.globalAlpha = active ? 0.45 : 0.22;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(JOY_BASE.x, JOY_BASE.y, JOY_RADIUS + 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = active ? 0.6 : 0.35;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(JOY_BASE.x, JOY_BASE.y, JOY_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = active || v ? 0.85 : 0.5;
        ctx.beginPath();
        ctx.arc(kx, ky, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function draw() {
        const colors = themeColors();
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, W, H);
        drawMonsters();
        drawExplosions();
        if (state !== 'over') drawPlayer(colors);
        if (screenFlash > 0) {
            ctx.fillStyle = `rgba(249, 202, 36, ${(screenFlash / 0.25) * 0.35})`;
            ctx.fillRect(0, 0, W, H);
        }
        drawBossBar(colors);
        drawJoystick();
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
        ultimateAttack() {
            if (state === 'playing') ultimateAttack();
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
