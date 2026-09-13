from pathlib import Path

path = Path('assets/js/site/ember-arena-game.js')
s = path.read_text()

replacements = [
    ("""    {
        id: 'luck', icon: '🍀', max: 4,
        name: { it: 'Fortuna', en: 'Fortune' },
        desc: { it: 'I mostri lasciano cuori più spesso.', en: 'Monsters drop hearts more often.' },
        apply: (p) => {
            const steps = [0.07, 0.06, 0.05, 0.04];
            p.tuning.heartChance += steps[Math.min(p.pickIndex, steps.length - 1)];
        },
    },
];""", """    {
        id: 'luck', icon: '🍀', max: 4,
        name: { it: 'Fortuna', en: 'Fortune' },
        desc: { it: 'I mostri lasciano cuori più spesso.', en: 'Monsters drop hearts more often.' },
        apply: (p) => {
            const steps = [0.07, 0.06, 0.05, 0.04];
            p.tuning.heartChance += steps[Math.min(p.pickIndex, steps.length - 1)];
        },
    },
    {
        id: 'giant', icon: '🗿', max: 1,
        name: { it: 'Colosso', en: 'Colossus' },
        desc: { it: 'Diventi 4× più grande e travolgi i mostri comuni.', en: 'Grow 4× larger and crush regular monsters.' },
        apply: (p) => {
            p.player.giantScale = 4;
            p.player.r = 56;
            p.player.meleeDamage = Math.round(p.player.meleeDamage * 1.35);
            p.tuning.meleeRange = Math.max(p.tuning.meleeRange, 100);
        },
    },
];"""),
    ("""        r: 14,
        facing: { x: 1, y: 0 },""", """        r: 14,
        giantScale: 1,
        facing: { x: 1, y: 0 },"""),
    ("""        player.facing = { x: 1, y: 0 };
        player.maxHp = 100;""", """        player.facing = { x: 1, y: 0 };
        player.r = 14;
        player.giantScale = 1;
        player.maxHp = 100;"""),
    ("""            m.flash = Math.max(0, m.flash - dt);
            if (dist < player.r + m.r && hurtPlayer(def.contactDamage || 10)) return;
        }""", """            m.flash = Math.max(0, m.flash - dt);
            if (dist < player.r + m.r) {
                if (player.giantScale >= 4 && m.type !== 'boss' && m.type !== 'finalBoss') {
                    damageMonster(i, Math.max(m.hp, player.meleeDamage * 2));
                    if (!reducedMotion) shake = Math.max(shake, 3);
                    continue;
                }
                if (hurtPlayer(def.contactDamage || 10)) return;
            }
        }"""),
    ("""        const cell = 3;
        const frame = player.moving ? Math.floor(player.walkT * 8) % 2 : 0;
        const bob = player.moving ? (frame === 0 ? 0 : -1.5) : 0;""", """        const giantScale = player.giantScale || 1;
        const cell = 3 * giantScale;
        const frame = player.moving ? Math.floor(player.walkT * 8) % 2 : 0;
        const bob = player.moving ? (frame === 0 ? 0 : -1.5 * giantScale) : 0;"""),
    ("""        drawShadow(player.x, player.y + 18, 12);""", """        drawShadow(player.x, player.y + 18 * giantScale, 12 * giantScale);"""),
    ("""            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, 30, swordAngle - tail, swordAngle);""", """            ctx.lineWidth = 3 * giantScale;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, 30 * giantScale, swordAngle - tail, swordAngle);"""),
    ("""        ctx.fillStyle = '#5d4037';
        ctx.fillRect(8, -4, 3, 8);
        ctx.fillStyle = colors.blade;
        ctx.fillRect(11, -1.5, 17, 3);
        ctx.fillStyle = colors.bladeEdge;
        ctx.fillRect(11, -1.5, 17, 1);""", """        ctx.scale(giantScale, giantScale);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(8, -4, 3, 8);
        ctx.fillStyle = colors.blade;
        ctx.fillRect(11, -1.5, 17, 3);
        ctx.fillStyle = colors.bladeEdge;
        ctx.fillRect(11, -1.5, 17, 1);"""),
]

for old, new in replacements:
    if old not in s:
        raise SystemExit('Patch anchor not found: ' + old.splitlines()[0])
    s = s.replace(old, new, 1)

path.write_text(s)
