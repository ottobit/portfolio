// Level-up cards and the on-canvas strings the arena draws on itself — split
// out of ember-arena-game.js since none of this depends on a running game
// instance. `apply` mutates the run's player and tuning in place.

// English defaults; the page hands over its own translations and re-sends
// them when the visitor switches language, so the canvas never ends up
// speaking a different language than the page around it.
export const DEFAULT_STRINGS = {
    start: 'Tap or press Space to start',
    level: (n) => `Level ${n}!`,
    boss: 'Boss!',
    finalBoss: 'Final boss!',
    bossBar: 'Boss',
    finalBossBar: 'Final boss',
    cookieAnnounce: 'Cookie has appeared!',
    mayAnnounce: 'May has appeared!',
};

// Every card but the Colossus grants a shrinking increment as it's picked
// again — a table of steps indexed by how many copies were already taken
// (p.pickIndex), clamped to the last (smallest) step once the table runs out.
export function pickStep(steps, pickIndex) {
    return steps[Math.min(pickIndex, steps.length - 1)];
}

// Each card's apply() reads p.pickIndex — how many copies were already taken,
// before this one — to look up its step in a table of shrinking increments. The
// ceiling itself moved out too (a higher max): the same rough total power, reached
// over more level-ups instead of a handful of picks that used to trivialise a run.
export const UPGRADES = [
    {
        id: 'strength', icon: '💪', max: 7,
        name: { it: 'Forza', en: 'Strength' },
        desc: { it: 'La spada fa più male.', en: 'The sword hits harder.' },
        apply: (p) => {
            p.player.meleeDamage += pickStep([6, 5, 5, 4, 4, 3, 3], p.pickIndex);
        },
    },
    {
        id: 'blade', icon: '⚔️', max: 4,
        name: { it: 'Lama lunga', en: 'Long blade' },
        desc: { it: 'Colpisci da più lontano.', en: 'Reach further out.' },
        apply: (p) => {
            p.tuning.meleeRange += pickStep([9, 7, 6, 5], p.pickIndex);
        },
    },
    {
        id: 'fury', icon: '🌀', max: 4,
        name: { it: 'Furia', en: 'Fury' },
        desc: { it: 'Giri più in fretta, colpisci più spesso.', en: 'Spin faster, hit more often.' },
        apply: (p) => {
            const mult = pickStep([0.85, 0.88, 0.90, 0.92], p.pickIndex);
            // A floor on how short a turn can get, so this can never stack into a
            // near-zero spin duration alongside other cards.
            p.tuning.spinDur = Math.max(0.1, p.tuning.spinDur * mult);
        },
    },
    {
        id: 'shove', icon: '👊', max: 4,
        name: { it: 'Spinta', en: 'Shove' },
        desc: { it: 'I mostri volano via più lontano.', en: 'Monsters fly further back.' },
        apply: (p) => {
            p.tuning.knockback *= pickStep([1.32, 1.26, 1.2, 1.16], p.pickIndex);
        },
    },
    {
        id: 'ember', icon: '🔥', max: 7,
        name: { it: 'Braci', en: 'Embers' },
        desc: { it: 'La palla di fuoco brucia di più.', en: 'The fireball burns hotter.' },
        apply: (p) => {
            p.player.fireDamage += pickStep([5, 4, 4, 3, 3, 3, 2], p.pickIndex);
        },
    },
    {
        id: 'storm', icon: '⏱️', max: 4,
        name: { it: 'Ricarica rapida', en: 'Quick reload' },
        desc: { it: 'La palla di fuoco torna prima.', en: 'The fireball comes back sooner.' },
        apply: (p) => {
            p.tuning.ultCd = Math.max(3, p.tuning.ultCd - pickStep([1.3, 1.1, 0.9, 0.7], p.pickIndex));
        },
    },
    {
        id: 'vigor', icon: '❤️', max: 7,
        name: { it: 'Vigore', en: 'Vigour' },
        desc: { it: 'Più vita massima, e te la dà subito.', en: 'More max health, granted at once.' },
        apply: (p) => {
            const amt = pickStep([22, 18, 15, 13, 11, 9, 7], p.pickIndex);
            p.player.maxHp += amt;
            p.player.hp = Math.min(p.player.maxHp, p.player.hp + amt);
        },
    },
    {
        id: 'boots', icon: '👢', max: 4,
        name: { it: 'Passo svelto', en: 'Swift boots' },
        desc: { it: 'Ti muovi più veloce: schivi meglio.', en: 'Move faster, dodge better.' },
        apply: (p) => {
            p.tuning.speed += pickStep([16, 13, 11, 9], p.pickIndex);
        },
    },
    {
        id: 'luck', icon: '🍀', max: 4,
        name: { it: 'Fortuna', en: 'Fortune' },
        desc: { it: 'I mostri lasciano cuori più spesso.', en: 'Monsters drop hearts more often.' },
        apply: (p) => {
            p.tuning.heartChance += pickStep([0.07, 0.06, 0.05, 0.04], p.pickIndex);
        },
    },
    {
        id: 'giant', icon: '🗿', max: 1,
        name: { it: 'Colosso', en: 'Colossus' },
        desc: { it: 'Per 5 secondi diventi 4× più grande e travolgi i mostri comuni. Il bonus a danno e portata resta per sempre.', en: 'For 5 seconds, grow 4× larger and crush regular monsters. The damage and reach bonus stays forever.' },
        apply: (p) => {
            p.player.giantScale = 4;
            p.player.r = 56;
            p.player.giantTimer = 5;
            p.player.meleeDamage = Math.round(p.player.meleeDamage * 1.35);
            p.tuning.meleeRange = Math.max(p.tuning.meleeRange, 100);
        },
    },
];
