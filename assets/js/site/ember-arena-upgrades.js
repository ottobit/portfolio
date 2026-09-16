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
    // 'it' or 'en' — which half of a BIG_CHEST_REWARDS entry's bilingual `name`
    // to read out loud when the big chest is opened. Everything else here is
    // pre-translated by the page; this one text lives in the reward data
    // itself instead, so it needs the language flag rather than a finished string.
    lang: 'en',
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
        id: 'strength', icon: '💪', max: 7, weapon: 'sword',
        name: { it: 'Forza', en: 'Strength' },
        desc: { it: 'La spada fa più male.', en: 'The sword hits harder.' },
        apply: (p) => {
            p.player.meleeDamage += pickStep([6, 5, 5, 4, 4, 3, 3], p.pickIndex);
        },
    },
    {
        id: 'blade', icon: '⚔️', max: 4, weapon: 'sword',
        name: { it: 'Lama lunga', en: 'Long blade' },
        desc: { it: 'Colpisci da più lontano.', en: 'Reach further out.' },
        apply: (p) => {
            p.tuning.meleeRange += pickStep([9, 7, 6, 5], p.pickIndex);
        },
    },
    {
        id: 'fury', icon: '🌀', max: 4, weapon: 'sword',
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
        id: 'shove', icon: '👊', max: 4, weapon: 'sword',
        name: { it: 'Spinta', en: 'Shove' },
        desc: { it: 'I mostri volano via più lontano.', en: 'Monsters fly further back.' },
        apply: (p) => {
            p.tuning.knockback *= pickStep([1.32, 1.26, 1.2, 1.16], p.pickIndex);
        },
    },
    {
        id: 'arrowpower', icon: '🏹', max: 6, weapon: 'bow',
        name: { it: 'Frecce pesanti', en: 'Heavy arrows' },
        desc: { it: 'Ogni freccia fa più danno.', en: 'Each arrow hits harder.' },
        apply: (p) => {
            p.player.arrowDamage += pickStep([4, 3, 3, 2, 2, 2], p.pickIndex);
        },
    },
    {
        id: 'quicknock', icon: '🎯', max: 4, weapon: 'bow',
        name: { it: 'Corda tesa', en: 'Quick nock' },
        desc: { it: "L'arco torna prima.", en: 'The bow comes back sooner.' },
        apply: (p) => {
            p.tuning.bowCd = Math.max(0.6, p.tuning.bowCd - pickStep([0.25, 0.2, 0.15, 0.1], p.pickIndex));
        },
    },
    {
        id: 'ember', icon: '🔥', max: 7, weapon: 'fire',
        name: { it: 'Braci', en: 'Embers' },
        desc: { it: 'La palla di fuoco brucia di più.', en: 'The fireball burns hotter.' },
        apply: (p) => {
            p.player.fireDamage += pickStep([5, 4, 4, 3, 3, 3, 2], p.pickIndex);
        },
    },
    {
        id: 'storm', icon: '⏱️', max: 4, weapon: 'fire',
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
        desc: { it: 'I mostri lasciano cuori e scrigni più spesso.', en: 'Monsters drop hearts and treasure chests more often.' },
        apply: (p) => {
            p.tuning.heartChance += pickStep([0.07, 0.06, 0.05, 0.04], p.pickIndex);
            // Smaller steps than hearts — a chest hands out a full upgrade card, so
            // even a maxed-out Fortuna should raise it by less in absolute terms.
            p.tuning.treasureChance += pickStep([0.03, 0.025, 0.02, 0.015], p.pickIndex);
        },
    },
    {
        id: 'giant', icon: '🗿', max: 1,
        name: { it: 'Colosso', en: 'Colossus' },
        desc: { it: 'Un fulmine ti colpisce e danneggia tutti i mostri in campo, poi per 5 secondi diventi 4× più grande e travolgi i mostri comuni. Il bonus a danno e portata resta per sempre.', en: 'A lightning bolt strikes you and damages every monster on screen, then for 5 seconds you grow 4× larger and crush regular monsters. The damage and reach bonus stays forever.' },
        apply: (p) => {
            // giantScale itself grows smoothly toward the target in update() —
            // see GIANT_GROW_SPEED in ember-arena-game.js — instead of snapping
            // straight to 4x the instant this card is picked.
            p.player.giantTargetScale = 4;
            p.player.r = 56;
            p.player.giantTimer = 5;
            p.player.meleeDamage = Math.round(p.player.meleeDamage * 1.35);
            p.tuning.meleeRange = Math.max(p.tuning.meleeRange, 100);
        },
    },
];

// The big chest's three exclusive rewards — permanent behaviour unlocks (not
// stacking numbers), granted at random with no choice on pickup. Kept out of
// UPGRADES on purpose: these must never show up in the level-up cards or the
// small chest, only in the big chest's own instant-grant logic.
export const BIG_CHEST_REWARDS = [
    {
        id: 'icebow', icon: '❄️',
        name: { it: 'Arco di ghiaccio', en: 'Ice bow' },
        desc: { it: "L'arco tra le frecce non danneggia più: paralizza per un istante i mostri che tocca.", en: 'The arc between arrows no longer damages: it briefly paralyzes any monster it touches.' },
        owned: (p) => p.player.bowIce,
        apply: (p) => { p.player.bowIce = true; },
    },
    {
        id: 'firesword', icon: '🔥',
        name: { it: 'Spada fiammeggiante', en: 'Flaming sword' },
        desc: { it: 'Ogni rotazione lancia anche una fiammata verso il mostro più vicino.', en: 'Every spin also launches a fireball at the nearest monster.' },
        owned: (p) => p.player.swordFire,
        apply: (p) => { p.player.swordFire = true; },
    },
    {
        id: 'iceburst', icon: '🥶',
        name: { it: 'Deflagrazione glaciale', en: 'Glacial burst' },
        desc: { it: 'La palla di fuoco paralizza per un istante ogni mostro che colpisce.', en: 'The fireball briefly paralyzes every monster it hits.' },
        owned: (p) => p.player.ultimateIce,
        apply: (p) => { p.player.ultimateIce = true; },
    },
];
