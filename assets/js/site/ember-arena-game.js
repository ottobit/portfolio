// Data, sprites, upgrades, audio, storage and colour helpers used to all live
// in this one file — they're now split out (none of them need the closure
// below, which is the part that actually has to stay one piece: it shares
// mutable run state — player, monsters, bolts, tuning — across ~50 functions).
import {
    drawArenaIcon, HERO_PALETTE, HERO_FRAMES, MONSTER_TYPES, HEART_FRAME, HEART_PALETTE,
    TREASURE_FRAME, TREASURE_PALETTE, BIGCHEST_FRAME, BIGCHEST_PALETTE,
    COOKIE_PALETTE, MAY_PALETTE, DOG_FRAME, MAY_FRAME, paintSprite, pickMonsterType,
} from './ember-arena-sprites.js?v=10';
export { drawArenaIcon };
import { DEFAULT_STRINGS, UPGRADES, BIG_CHEST_REWARDS } from './ember-arena-upgrades.js?v=6';
import { getAudioCtx, chirp, noiseBurst } from './ember-arena-audio.js?v=1';
import {
    WON_KEY, MUTE_KEY, readFlag, writeFlag, readBestLevel, writeBestLevel, writeBestRecord,
} from './ember-arena-storage.js?v=1';
import { blendHex, tintPalette, themeColors, circlesOverlap, distToSegment } from './ember-arena-color.js?v=2';

// Kill the warlord that shows up here and the run is over — won, not just survived.
// Exported so the page can show the target ("7 / 15") without reaching into a game
// instance that does not exist yet while initEmberArena is still running.
export const FINAL_LEVEL = 15;
const FIRE_COLOR = '#e67e22';
const FIRE_GLOW = '#f9ca24';
// Enemy bolts are magenta on purpose: never the hero's own fire orange, so what
// hurts you is never confused with what you threw.
const BOLT_COLOR = '#9b59b6';
const BOLT_GLOW = '#e056fd';
const ICE_COLOR = '#74c0fc';
const ICE_GLOW = '#d0f0ff';
// The hero's own arrows: wood/bronze, already used elsewhere in the palette (the
// caster's staff) — never the enemy bolt's magenta or the fireball's orange, so
// what the player shoots never gets mistaken for what's shooting at them.
const ARROW_COLOR = '#8d6e63';
const ARROW_GLOW = '#d7ccc8';
const ARROW_SPEED = 420;
const ARROW_LIFE = 1.1;
const ARROW_COUNT = 10;   // arrows per shot, fanned out around the aim direction
const ARROW_SPREAD = 1.3; // total radians the fan spans — a wide, dramatic spray
// Electric white-violet, not used anywhere else in the palette (fire is orange,
// enemy bolts magenta, ice pale blue, arrows wood/bronze) — must read as
// "lightning", not as any of those.
const LIGHTNING_COLOR = '#ffffff';
const LIGHTNING_GLOW = '#7c4dff';
const COLOSSUS_BOLT_DUR = 0.9; // seconds, the whole strike-to-fade duration
const GIANT_GROW_SPEED = 9; // scale units/sec the Colossus grows at — reaches 4x in well under a second
const ARROW_ARC_DAMAGE = 10; // same as a direct arrow hit, for simplicity
// px beyond a monster's own radius before the arc finds it. Scaled up alongside
// ARROW_SPREAD above — a wider fan spaces adjacent arrows further apart, so the
// arc between them needs more reach to keep finding what stands between them.
const ARROW_ARC_RANGE = 26;
const ICE_ARC_PARALYZE_DUR = 0.6; // the ice bow's arc: no damage, briefly freezes instead
const SWORD_BOLT_SPEED = 300;
const SWORD_BOLT_LIFE = 1.2;
const SWORD_BOLT_INTERVAL = 0.9; // roughly one launch every couple of spins
const ICE_ULT_PARALYZE_DUR = 0.9; // the glacial-burst ultimate: longer, since it's on a long cooldown
const KNOCKBACK = 320;   // px/s shove a sword hit gives a monster
const KNOCK_DECAY = 6;   // how quickly that shove dies down
// The numbers in MONSTER_TYPES/triggerBossSlam/fireStarVolley are the level-1
// baseline; monsterDamageMul() (below, inside initEmberArena — it needs `level`)
// scales every monster-dealt hit up from there so the threat keeps pace with the
// player's own growth (maxHp, Forza, Furia) instead of falling behind it.
const MONSTER_DMG_LEVEL_STEP = 0.05; // +5% per level
const MONSTER_DMG_LEVEL_CAP = 1.6;   // never past 1.6x the base damage
// A landed bite snaps the monster a few px towards the player and back — makes
// the hit itself read as a lunge, not just the telegraph glow beforehand.
const BITE_LUNGE_DUR = 0.18; // seconds, out and back
const BITE_LUNGE_DIST = 8;   // px, peak offset at the midpoint of the lunge
const BITE_LEAP_LIFT = 6;    // px, extra vertical rise for 'leap'-style bites (slime)
// The telegraph can start this many px before actual contact — starting it only
// once fully touching left the glow buried under/behind the monster by the time
// it appeared, since the monster keeps closing that last stretch during the
// windup. A small head start makes it a warning you can actually react to.
const BITE_ENGAGE_MARGIN = 14;
// The imp hops instead of gliding: horizontal speed and vertical lift both follow
// the same sine cycle, so it visibly leaps forward and lands instead of sliding at
// a constant pace. Longer period + higher arc + a near-zero floor than the first
// pass — a proper frog-length leap-and-pause instead of a quick shuffle.
const IMP_HOP_PERIOD = 0.85; // seconds per hop
const IMP_HOP_HEIGHT = 11;   // px, peak lift mid-hop
const IMP_HOP_SPEED_FLOOR = 0.06;
// The sword's own size never changes with upgrades (only its colour does, see
// drawPlayer) — moved out a bit further from BLADE_START's old value of 11 so it
// reads as held out from the hand instead of hugging the hero's centre.
const BLADE_START = 14;
const BLADE_LEN = 17;
const BLADE_TIP = BLADE_START + BLADE_LEN + 2;

// How rare each familiar visit is, and what triggers it — tunable in one place
// instead of buried in update(). Cookie/May's own sprite data lives in
// ember-arena-sprites.js.
const FAMILIAR_MANY_MONSTERS = 6;     // both need at least this many non-boss monsters up
const FAMILIAR_CHECK_INTERVAL = 2;    // seconds between eligibility rolls
const FAMILIAR_CHANCE = 0.12;         // chance a visit actually starts on an eligible roll
const FAMILIAR_COOLDOWN = 25;         // minimum seconds between two visits
const FAMILIAR_ANNOUNCE_DURATION = 1.8; // seconds the arena freezes for the name banner

export function initEmberArena(canvas, opts) {
    const options = opts || {};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The logical world size. Almost always just a DPR-crispness concern (see
    // resize() below), but it does change shape outright when the phone is
    // rotated in/out of the landscape layout — see resize()'s reflow branch.
    let W = canvas.clientWidth;
    let H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const player = {
        x: W / 2,
        y: H / 2,
        r: 14,
        giantScale: 1,
        giantTargetScale: 1,
        giantTimer: 0,
        facing: { x: 1, y: 0 },
        maxHp: 100,
        hp: 100,
        invulnUntil: 0,
        paralyzedUntil: 0,
        meleeDamage: 18,
        fireDamage: 14,
        // Per-arrow damage. Electric arcs between adjacent arrows (see fireArrow())
        // now cover the gaps the fan itself misses, so even a lone target standing
        // between two arrows still takes real damage instead of dodging the volley.
        arrowDamage: 10,
        moving: false,
        walkT: 0,
        // One-shot permanent unlocks from the big chest — flags, not stacking
        // numbers, see BIG_CHEST_REWARDS in ember-arena-upgrades.js.
        bowIce: false,
        swordFire: false,
        ultimateIce: false,
    };
    const keys = { up: false, down: false, left: false, right: false };
    // Fixed analog stick in the bottom-left corner: always drawn, engaged by a
    // pointer landing near it, and it follows only that pointer afterwards.
    // Steering comes from outside now: the stick lives under the arena, in the page,
    // because drawn on the canvas it covered the very corner you get pushed into.
    // null means nobody is steering, and the keyboard takes over.
    let stick = null;
    // The sword has no cooldown: holding the action keeps the hero spinning like a
    // top, and a tap is just a spin that stops after its first full turn.
    const TAU = Math.PI * 2;
    const BASE_SPIN_DUR = 0.32; // seconds per full turn, before any Fury card
    const BASE_ULT_CD = 8;
    // Weaker and single-target, so it can't be the same 8s wait as the fireball —
    // but still a real cooldown, not the hold-and-spam it launched with (that made
    // the sword pointless: free ranged damage with no risk, no reason to get close).
    const BASE_BOW_CD = 2.2;
    // Everything a level-up card can move lives here, so a card is one line and the
    // run's numbers are never scattered as literals through the loop.
    const baseTuning = {
        spinDur: BASE_SPIN_DUR,
        ultCd: BASE_ULT_CD,
        bowCd: BASE_BOW_CD,
        meleeRange: 44,
        speed: 190,
        knockback: KNOCKBACK,
        // opts.heartChance exists for the tests, the same seam opts.startLevel already
        // provides: a drop this rare is otherwise only observable by playing for minutes.
        heartChance: typeof options.heartChance === 'number' ? options.heartChance : 0.13,
        // Same idea as heartChance, same base value as the old fixed TREASURE_CHANCE
        // constant it replaces — now tunable so Fortuna can raise it too.
        treasureChance: typeof options.treasureChance === 'number' ? options.treasureChance : 0.1,
    };
    let tuning = Object.assign({}, baseTuning);
    let strings = Object.assign({}, DEFAULT_STRINGS, options.strings || {});
    const ULT_DUR = 0.6;
    const startLevel = Math.max(1, options.startLevel || 1);

    let monsters = [];
    let explosions = [];
    let bolts = [];
    let arrows = []; // the hero's own bow shots — the mirror of bolts, but aimed at monsters
    let swordBolts = []; // periodic fireballs from the flaming-sword big-chest reward
    let swordBoltTimer = 0;
    let hearts = [];
    let treasures = [];
    let floaters = [];   // damage numbers drifting up
    let particles = [];  // what is left of a monster that just died
    let playerTrail = []; // recent hero positions, drawn as fading ghosts with Passo svelto
    let familiarVisit = null; // the one rare Cookie/May visit in progress, if any
    let familiarCheckTimer = 0;
    let familiarCooldown = 0; // seconds left before another visit can even be rolled
    let familiarAnnounce = null; // { kind, t } while the arrival banner freezes the arena
    let finalBossDeath = null; // { t, x, y, nextPulse } while the final boss's own defeat beat plays out
    let externalPause = false; // set by the page — e.g. the portrait rotate-prompt covering the arena
    let level = 1;
    let xp = 0;
    let xpToNext = 6;
    let monstersKilled = 0;
    let hitsGiven = 0;    // sword swings and fireball waves that actually landed on a monster
    let hitsReceived = 0; // contact, bolts and boss slams that actually landed on the hero
    let bestLevel = readBestLevel();
    let state = 'ready'; // ready | playing | choosing | over | won
    let elapsed = 0;
    let spawnTimer = 0;
    let spinning = false;   // the hero is turning right now
    let spinHeld = false;   // the action is held down
    let spinAngle = 0;      // radians turned since this spin started
    let spinHitTimer = 0;   // time left before the next damage tick
    let bowCooldown = 0;    // same idea as ultCooldown, just a shorter wait
    let ultCooldown = 0;
    let levelFlash = 0;
    let flashKind = '';   // 'level' | 'boss' | 'final' | 'reward'
    let flashLevel = 1;
    let flashRewardText = ''; // set alongside flashKind === 'reward'
    let screenFlash = 0;
    let hurtFlash = 0;
    let shake = 0;
    let colossusBoltT = 0; // visual duration of the Colossus lightning, 0 = nothing to draw
    let nextArrowVolley = 0; // id for the next bow shot, so its 10 arrows can find each other
    let taken = {};              // upgrade id -> how many times it was picked
    let pendingChoices = null;   // the three level-up cards waiting to be answered
    let hasWon = readFlag(WON_KEY);
    let muted = readFlag(MUTE_KEY);
    let lastTime = null;
    let rafId = null;

    function onStatsChange(hp, maxHp, lvl, x, xNext, best) {
        if (typeof options.onStatsChange === 'function') options.onStatsChange(hp, maxHp, lvl, x, xNext, best);
    }
    function onStateChange(s, stats) {
        if (typeof options.onStateChange === 'function') options.onStateChange(s, stats);
    }
    function onCooldownChange(ult, bow) {
        if (typeof options.onCooldownChange === 'function') options.onCooldownChange(ult, bow);
    }
    function onChoices(choices) {
        if (typeof options.onChoices === 'function') options.onChoices(choices);
    }
    // kind is 'cookie'/'may' when the arrival banner should show, or null to hide it.
    function onFamiliarAnnounce(kind) {
        if (typeof options.onFamiliarAnnounce === 'function') options.onFamiliarAnnounce(kind);
    }
    // One place decides whether a sound happens at all: muted, or not playing yet.
    function sfx(name) {
        if (muted || state === 'ready') return;
        if (name === 'swing') chirp({ from: 620, to: 300, duration: 0.07, type: 'triangle', gain: 0.025 });
        else if (name === 'hit') noiseBurst(0.07, 0.05, 1800);
        else if (name === 'kill') chirp({ from: 340, to: 90, duration: 0.16, type: 'square', gain: 0.035 });
        else if (name === 'hurt') chirp({ from: 180, to: 60, duration: 0.26, type: 'sawtooth', gain: 0.05 });
        else if (name === 'heart') { chirp({ from: 540, to: 800, duration: 0.1, type: 'sine', gain: 0.05 }); chirp({ from: 800, to: 1100, duration: 0.12, type: 'sine', gain: 0.04, delay: 0.09 }); }
        else if (name === 'level') { chirp({ from: 440, to: 660, duration: 0.12, gain: 0.04 }); chirp({ from: 660, to: 990, duration: 0.16, gain: 0.04, delay: 0.11 }); }
        else if (name === 'card') chirp({ from: 880, to: 1320, duration: 0.1, type: 'triangle', gain: 0.04 });
        else if (name === 'storm') { noiseBurst(0.5, 0.07, 900); chirp({ from: 220, to: 1200, duration: 0.45, type: 'sawtooth', gain: 0.03 }); }
        else if (name === 'boss') { chirp({ from: 120, to: 60, duration: 0.7, type: 'sawtooth', gain: 0.06 }); noiseBurst(0.5, 0.05, 400); }
        else if (name === 'win') {
            // A proper "we made it" fanfare instead of a quick four-note blip — this
            // is the payoff after a full run, it earns more than half a second: a
            // rising run up a C major triad into a held, layered final chord (three
            // notes stacked, two waveforms each for a fuller, brighter "brass" feel)
            // plus a soft noise swell under it for weight.
            const run = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
            run.forEach((f, i) => chirp({ from: f, to: f, duration: 0.16, type: 'triangle', gain: 0.05, delay: i * 0.1 }));
            const chordAt = run.length * 0.1;
            [1046.5, 1318.51, 1567.98].forEach((f) => { // C6 E6 G6, held
                chirp({ from: f, to: f, duration: 0.9, type: 'triangle', gain: 0.05, delay: chordAt });
                chirp({ from: f, to: f, duration: 0.9, type: 'square', gain: 0.02, delay: chordAt });
            });
            noiseBurst(0.3, 0.03, 3000, chordAt);
        }
        else if (name === 'over') {
            // A proper "you died" motif instead of a single downward blip — the sad
            // mirror of the 'win' fanfare above: a descending four-note fall into a
            // held low note, with a soft thud under it for weight.
            const fall = [392.0, 349.23, 293.66, 246.94]; // G4 F4 D4 B3
            fall.forEach((f, i) => chirp({ from: f, to: f * 0.94, duration: 0.2, type: 'sawtooth', gain: 0.045, delay: i * 0.15 }));
            const holdAt = fall.length * 0.15;
            chirp({ from: 196.0, to: 164.81, duration: 0.9, type: 'sawtooth', gain: 0.05, delay: holdAt }); // G3 -> E3, held
            noiseBurst(0.25, 0.03, 250, holdAt);
        }
        else if (name === 'starburst') { chirp({ from: 700, to: 1500, duration: 0.12, type: 'sawtooth', gain: 0.045 }); chirp({ from: 1500, to: 2200, duration: 0.1, type: 'sawtooth', gain: 0.03, delay: 0.08 }); }
        else if (name === 'slam') { noiseBurst(0.12, 0.06, 500); chirp({ from: 140, to: 50, duration: 0.22, type: 'sawtooth', gain: 0.05 }); }
        else if (name === 'bark') { chirp({ from: 380, to: 220, duration: 0.09, type: 'square', gain: 0.045 }); chirp({ from: 340, to: 180, duration: 0.08, type: 'square', gain: 0.035, delay: 0.12 }); }
        // A quick, cheap twang — the bow can fire several times a second while
        // held, so unlike every other sfx here this one stays a single short chirp.
        else if (name === 'arrow') chirp({ from: 900, to: 500, duration: 0.08, type: 'triangle', gain: 0.035 });
        // The Colossus card's own strike: a sharp crack, not a rolling rumble — it
        // lands once, on the spot, rather than building like the fireball's 'storm'.
        else if (name === 'thunder') { noiseBurst(0.15, 0.08, 2500); chirp({ from: 1600, to: 80, duration: 0.35, type: 'sawtooth', gain: 0.05 }); }
    }

    // --- Background music --------------------------------------------------
    // A procedural loop, same synthesis approach as the sfx above: nothing to load.
    // Scheduled with a lookahead (look a little into the future on every tick and
    // queue whatever falls due) rather than one setTimeout per note, which is the
    // standard way to keep Web Audio timing steady over a loop that runs for minutes.
    const MUSIC_BEAT = 60 / 100; // seconds per beat at 100 BPM
    const MUSIC_LOOKAHEAD = 0.12;
    const MUSIC_TICK_MS = 25;
    const MUSIC_BASS_NOTES = [73.42, 73.42, 87.31, 73.42]; // D2, D2, F2, D2
    const MUSIC_ARP_NOTES = [293.66, 349.23, 440.0, 349.23]; // D4, F4, A4, F4
    // While a regular boss is up: faster and a half-step down, so it reads as
    // tenser/grittier rather than a different song — same shape, louder and
    // quicker instead of a full theme change.
    const BOSS_MUSIC_BEAT = 60 / 132;
    const BOSS_BASS_NOTES = [69.30, 69.30, 82.41, 69.30]; // C#2, C#2, E2, C#2
    const BOSS_ARP_NOTES = [277.18, 329.63, 415.30, 329.63]; // C#4, E4, G#4, E4
    // The final boss gets a theme of its own instead of just a faster/transposed
    // copy of the regular boss riff: a different melody and bass line, and a
    // sawtooth lead instead of square/triangle for a dirtier, more menacing tone
    // that reads as "a different song" even before the melody registers.
    const FINAL_BOSS_MUSIC_BEAT = 60 / 144;
    const FINAL_BOSS_BASS_NOTES = [87.31, 87.31, 82.41, 92.50]; // F2, F2, E2, F#2 — chromatic crawl, more dissonant than the regular boss's diatonic riff
    const FINAL_BOSS_ARP_NOTES = [349.23, 415.30, 466.16, 415.30]; // F4, G#4, A#4, G#4
    let musicNextTime = 0;
    let musicBeatIndex = 0;
    let musicIntervalId = null;
    function scheduleMusicTick() {
        const ac = getAudioCtx();
        if (!ac) return;
        const final = finalBossAlive();
        const boss = final || bossAlive();
        const beat = final ? FINAL_BOSS_MUSIC_BEAT : boss ? BOSS_MUSIC_BEAT : MUSIC_BEAT;
        const bassNotes = final ? FINAL_BOSS_BASS_NOTES : boss ? BOSS_BASS_NOTES : MUSIC_BASS_NOTES;
        const arpNotes = final ? FINAL_BOSS_ARP_NOTES : boss ? BOSS_ARP_NOTES : MUSIC_ARP_NOTES;
        while (musicNextTime < ac.currentTime + MUSIC_LOOKAHEAD) {
            if (!muted) {
                const delay = musicNextTime - ac.currentTime;
                const bar = musicBeatIndex % bassNotes.length;
                chirp({ from: bassNotes[bar], to: bassNotes[bar], duration: beat * 0.85, type: final ? 'sawtooth' : 'triangle', gain: boss ? 0.04 : 0.032, delay });
                chirp({ from: arpNotes[bar], to: arpNotes[bar], duration: beat * 0.3, type: final ? 'sawtooth' : 'square', gain: boss ? 0.02 : 0.016, delay: delay + beat / 2 });
                if (bar % 2 === 1) noiseBurst(0.05, boss ? 0.016 : 0.01, final ? 1400 : 2600, delay + beat * 0.25);
            }
            musicNextTime += beat;
            musicBeatIndex++;
        }
    }
    // Starts on the first real run and just keeps going through every state
    // (choosing/over/won included) until muted or destroyed — a small arcade loop
    // does not need separate music per screen. Idempotent: a restart mid-run must
    // not stack a second scheduler.
    function startMusic() {
        if (musicIntervalId) return;
        const ac = getAudioCtx();
        if (!ac) return;
        musicNextTime = ac.currentTime + 0.05;
        musicBeatIndex = 0;
        scheduleMusicTick();
        musicIntervalId = setInterval(scheduleMusicTick, MUSIC_TICK_MS);
    }
    function stopMusic() {
        if (musicIntervalId) {
            clearInterval(musicIntervalId);
            musicIntervalId = null;
        }
    }

    function pushStats() {
        onStatsChange(Math.max(0, Math.ceil(player.hp)), player.maxHp, level, Math.floor(xp), xpToNext, bestLevel);
    }
    function pushCooldowns() {
        onCooldownChange(ultCooldown / tuning.ultCd, bowCooldown / tuning.bowCd);
    }
    pushStats();
    pushCooldowns();

    function bossAlive() {
        return monsters.some((m) => m.type === 'boss' || m.type === 'finalBoss');
    }
    function finalBossAlive() {
        return monsters.some((m) => m.type === 'finalBoss');
    }

    function reset() {
        player.x = W / 2;
        player.y = H / 2;
        player.facing = { x: 1, y: 0 };
        player.r = 14;
        player.giantScale = 1;
        player.giantTargetScale = 1;
        player.giantTimer = 0;
        player.maxHp = 100;
        player.hp = 100;
        player.invulnUntil = 0;
        player.paralyzedUntil = 0;
        player.meleeDamage = 18;
        player.fireDamage = 14;
        player.arrowDamage = 10;
        player.bowIce = false;
        player.swordFire = false;
        player.ultimateIce = false;
        monsters = [];
        explosions = [];
        bolts = [];
        arrows = [];
        swordBolts = [];
        swordBoltTimer = 0;
        hearts = [];
        treasures = [];
        floaters = [];
        particles = [];
        playerTrail = [];
        familiarVisit = null;
        familiarCheckTimer = 0;
        familiarCooldown = 0;
        if (familiarAnnounce) onFamiliarAnnounce(null);
        familiarAnnounce = null;
        finalBossDeath = null;
        tuning = Object.assign({}, baseTuning);
        taken = {};
        pendingChoices = null;
        level = 1;
        xp = 0;
        xpToNext = 6;
        monstersKilled = 0;
        hitsGiven = 0;
        hitsReceived = 0;
        elapsed = 0;
        spawnTimer = 0;
        spinning = false;
        spinHeld = false;
        spinAngle = 0;
        spinHitTimer = 0;
        bowCooldown = 0;
        ultCooldown = 0;
        levelFlash = 0;
        flashKind = '';
        flashRewardText = '';
        screenFlash = 0;
        hurtFlash = 0;
        shake = 0;
        colossusBoltT = 0;
        nextArrowVolley = 0;
        stick = null;
        // Levels skipped by opts.startLevel still hand out a card, so a test hero is
        // equipped roughly like one that actually played its way up here.
        for (let i = 1; i < startLevel; i++) {
            applyLevelUp(false);
            const pool = availableUpgrades();
            if (pool.length) grantUpgrade(pool[Math.floor(Math.random() * pool.length)].id);
        }
        pushStats();
        pushCooldowns();
    }

    function start() {
        reset();
        state = 'playing';
        startMusic();
        onStateChange(state);
    }

    // The arena is sized by the page and follows the window. Most of the time the
    // logical space stays W x H and only the backing store is rebuilt, so the
    // pixel art is redrawn sharp instead of being upscaled — but rotating the
    // phone in/out of the landscape layout genuinely changes the *shape*
    // available (see the landscape media query in styles.css), not just its
    // scale. When that happens, every live entity is reflowed proportionally
    // onto the new shape — so nobody near an edge gets stranded outside the new
    // bounds or bunched into a corner — and W/H themselves are updated to
    // match: the one and only place the logical world size changes after init.
    function resize() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const newW = canvas.clientWidth;
        const newH = canvas.clientHeight;
        const shapeChanged = !!(newW && newH) && Math.abs(newW / newH - W / H) > 0.02;
        if (shapeChanged) {
            const sx = newW / W;
            const sy = newH / H;
            const reflow = (o) => { o.x *= sx; o.y *= sy; };
            reflow(player);
            monsters.forEach(reflow);
            explosions.forEach(reflow);
            bolts.forEach(reflow);
            hearts.forEach(reflow);
            floaters.forEach(reflow);
            particles.forEach(reflow);
            W = newW;
            H = newH;
        }
        const scale = Math.min(Math.max((rect.width / W) * dpr, dpr), 4);
        const nextW = Math.round(W * scale);
        if (!shapeChanged && nextW === canvas.width) return;
        canvas.width = nextW;
        canvas.height = Math.round(H * scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function handleKeyDown(e) {
        // The arrow keys double as the browser's own scroll keys — without this,
        // steering the hero on desktop also scrolls the page out from under it.
        // Stolen during an active run AND while choosing an upgrade card (up/down
        // are how the deck could be browsed, and even when they aren't, a stray
        // arrow shouldn't yank the page out from under the overlay). Before a run
        // starts, or once it's over, the page should still scroll normally.
        if ((state === 'playing' || state === 'choosing') && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
        }
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
        if (e.key === ' ' || e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (state === 'playing') meleeAttack();
            else if (state !== 'choosing') start();
        }
        if (e.key === 'v' || e.key === 'V') {
            if (state === 'playing') ultimateAttack();
            else if (state !== 'choosing') start();
        }
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            if (state === 'playing') bowAttack();
            else if (state !== 'choosing') start();
        }
        if (e.key === 'Enter' && state !== 'playing') start();
    }
    function handleKeyUp(e) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
        if (e.key === ' ' || e.key === 'z' || e.key === 'Z') meleeRelease();
    }
    // Losing the window while the sword is held would leave the hero spinning forever.
    function handleBlur() {
        meleeRelease();
        keys.up = keys.down = keys.left = keys.right = false;
    }

    function handlePointerDown(e) {
        if (state !== 'playing') {
            // 'choosing' is a pause with the cards open: a tap must not throw the run away.
            if (state !== 'choosing') start();
            return;
        }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    canvas.addEventListener('pointerdown', handlePointerDown);

    function ultimateAttack() {
        if (elapsed < player.paralyzedUntil) return;
        if (ultCooldown > 0) return;
        ultCooldown = tuning.ultCd;
        screenFlash = 0.22;
        sfx('storm');
        if (!reducedMotion) shake = Math.max(shake, 5);
        explosions.push({
            x: player.x, y: player.y, r: 0,
            maxR: Math.hypot(W, H), life: ULT_DUR, dur: ULT_DUR,
            ult: true, ice: player.ultimateIce, hit: new Set(), seed: Math.random() * TAU,
        });
        // Sparks out of the blast, through the same particle burst the monsters die into —
        // icy blue/white once the glacial-burst reward is in, fire otherwise.
        burst(player.x, player.y, player.ultimateIce
            ? { a: ICE_COLOR, b: ICE_GLOW, c: '#ffffff' }
            : { a: FIRE_COLOR, b: FIRE_GLOW, c: '#fff3c4' }, reducedMotion ? 10 : 26);
    }
    // The Colossus card's reveal moment: a single instant strike, not a repeatable
    // weapon (the card is max: 1, so this fires at most once per run) — same real
    // damage as the fireball's own per-monster hit (see updateExplosions), landed
    // all at once instead of an expanding ring.
    function triggerColossusBolt() {
        colossusBoltT = COLOSSUS_BOLT_DUR;
        if (!reducedMotion) shake = Math.max(shake, 10);
        sfx('thunder');
        // The strike itself lands on the player — a burst there reads as the point
        // of impact the growth animation follows, not just damage on the monsters.
        burst(player.x, player.y, { a: LIGHTNING_COLOR, b: LIGHTNING_GLOW, c: '#e0d4ff' }, reducedMotion ? 6 : 16);
        for (let j = monsters.length - 1; j >= 0; j--) {
            const m = monsters[j];
            burst(m.x, m.y, { a: LIGHTNING_COLOR, b: LIGHTNING_GLOW, c: '#e0d4ff' }, reducedMotion ? 4 : 9);
            damageMonster(j, player.fireDamage * 3);
            hitsGiven++;
        }
    }
    // Press: start turning and land a hit at once. Hold: keep turning, one hit per
    // turn. Release: stop once the turn in progress completes, so a tap is one spin.
    function meleeAttack() {
        if (elapsed < player.paralyzedUntil) return;
        spinHeld = true;
        if (spinning) return;
        spinning = true;
        spinAngle = 0;
        spinHitTimer = tuning.spinDur;
        sfx('swing');
        meleeHit();
    }
    function meleeRelease() {
        spinHeld = false;
    }
    // The bow's targeting: whichever monster is currently closest, re-evaluated on
    // every shot — no lock-on, so it always tracks whatever just wandered closest
    // instead of chasing the first thing it happened to pick.
    function nearestMonster() {
        let best = null;
        let bestD = Infinity;
        for (const m of monsters) {
            const d = Math.hypot(m.x - player.x, m.y - player.y);
            if (d < bestD) {
                bestD = d;
                best = m;
            }
        }
        return best;
    }
    // Returns whether an arrow actually went out — nothing to aim at is not an
    // error, just nothing to do, and callers use this to know whether to start
    // the between-shots cooldown or try again next frame.
    function fireArrow() {
        const target = nearestMonster();
        if (!target) return false;
        const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
        // A fan, not a single shot: centered on the nearest monster, spread wide
        // enough to also catch whatever else is standing nearby. volley/slot let
        // the electric-arc pass below (in update()) find which arrows started out
        // adjacent in this exact shot, even once some of them have been spliced
        // out of `arrows` for landing a hit or expiring.
        const volley = nextArrowVolley++;
        for (let i = 0; i < ARROW_COUNT; i++) {
            const t = ARROW_COUNT > 1 ? i / (ARROW_COUNT - 1) - 0.5 : 0;
            const angle = baseAngle + t * ARROW_SPREAD;
            arrows.push({
                x: player.x, y: player.y,
                vx: Math.cos(angle) * ARROW_SPEED, vy: Math.sin(angle) * ARROW_SPEED,
                r: 4, life: ARROW_LIFE,
                volley, slot: i, arcHit: new Set(),
            });
        }
        sfx('arrow');
        return true;
    }
    // A tap, same shape as ultimateAttack(): fires once and starts a real cooldown
    // — no longer a hold-to-spam stream (see BASE_BOW_CD above for why).
    function bowAttack() {
        if (elapsed < player.paralyzedUntil) return;
        if (bowCooldown > 0) return;
        if (fireArrow()) bowCooldown = tuning.bowCd;
    }
    function meleeHit() {
        const range = tuning.meleeRange;
        // Spinta: how much harder a hit shoves, made visible as an impact burst
        // right where it lands — absent on a build that never took the card.
        const spintaT = clamp((tuning.knockback / KNOCKBACK - 1) / 0.8, 0, 1);
        for (let i = monsters.length - 1; i >= 0; i--) {
            const m = monsters[i];
            const dx = m.x - player.x;
            const dy = m.y - player.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < range + m.r) {
                // Shove it away from the hero: the spin buys room, it doesn't only deal damage.
                const push = tuning.knockback * (MONSTER_TYPES[m.type].knockMul || 1);
                m.kx += (dx / dist) * push;
                m.ky += (dy / dist) * push;
                if (spintaT > 0) burst(m.x, m.y, { a: '#95a5a6', b: '#dfe6e9', c: '#ffffff' }, reducedMotion ? 1 : Math.round(2 + spintaT * 4));
                damageMonster(i, player.meleeDamage);
                hitsGiven++;
            }
        }
    }
    function fireBolt(m, cfg) {
        const dx = player.x - m.x;
        const dy = player.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        bolts.push({
            x: m.x, y: m.y,
            vx: (dx / d) * cfg.speed, vy: (dy / d) * cfg.speed,
            r: 5, damage: cfg.damage * monsterDamageMul(), life: 5,
            ice: !!cfg.ice, paralyzeDuration: cfg.paralyzeDuration || 0,
            // A caster's bolt leans gently toward wherever the player has moved to
            // since it was fired, instead of committing to the spot they were
            // standing on at launch — the ice bolt stays a straight, dodgeable
            // read, since its paralysis is already the real threat.
            homing: !cfg.ice, angle0: Math.atan2(dy, dx), speed: cfg.speed,
        });
    }
    // The final boss's second attack: a whole ring of fire arrows launched together,
    // not aimed — the telegraph before this (drawn in drawMonsters) is the warning,
    // not the bolts themselves. fireArrow marks them so drawBolts and the player can
    // tell them apart from an ordinary caster's bolt on sight.
    function fireStarVolley(m, cfg) {
        for (let i = 0; i < cfg.count; i++) {
            const a = (i / cfg.count) * TAU;
            bolts.push({
                x: m.x, y: m.y,
                vx: Math.cos(a) * cfg.speed, vy: Math.sin(a) * cfg.speed,
                r: 5, damage: cfg.damage * monsterDamageMul(), life: 5, fireArrow: true,
            });
        }
        sfx('starburst');
        if (!reducedMotion) shake = Math.max(shake, 3);
    }
    // The regular boss's shockwave, right where its charge ends. Its own entry in
    // `explosions` (flagged `boss`, not `ult`) so it is handled and drawn as its own
    // thing — never the player's own fireball, which it must never be confused with.
    function triggerBossSlam(m) {
        // The final boss hits harder and wider than the regular one — the charge
        // that closes distance is the same move, but landing it should sting more.
        const final = m.type === 'finalBoss';
        explosions.push({ x: m.x, y: m.y, r: 0, maxR: final ? 140 : 110, life: 0.35, dur: 0.35, boss: true, damage: (final ? 26 : 18) * monsterDamageMul(), hit: false, seed: Math.random() * TAU });
        if (!reducedMotion) shake = Math.max(shake, final ? 10 : 8);
        sfx('slam');
    }
    function damageMonster(index, amount) {
        const m = monsters[index];
        m.hp -= amount;
        m.flash = 0.12;
        floaters.push({ x: m.x, y: m.y - m.r - 4, text: String(Math.round(amount)), life: 0.7, color: themeColors().ink });
        sfx('hit');
        if (m.hp <= 0) {
            const def = MONSTER_TYPES[m.type];
            burst(m.x, m.y, def.palette, m.type === 'boss' || m.type === 'finalBoss' ? 26 : 10);
            monsters.splice(index, 1);
            monstersKilled++;
            sfx('kill');
            if (m.type === 'finalBoss') {
                gainXp(m.xpValue);
                // win() (stats + the results overlay) doesn't fire until the death
                // sequence below actually finishes — see beginFinalBossDeath.
                beginFinalBossDeath(m.x, m.y);
                return;
            }
            if (Math.random() < tuning.heartChance) {
                hearts.push({ x: m.x, y: m.y, life: 9 });
            }
            // The level 5/10 boss always drops a big chest — a guaranteed milestone
            // reward, not a lucky roll. A regular kill only ever rolls for the small one.
            if (m.type === 'boss') {
                treasures.push({ x: m.x, y: m.y, life: 9, kind: 'big', size: m.r });
            } else if (Math.random() < tuning.treasureChance) {
                treasures.push({ x: m.x, y: m.y, life: 9, kind: 'small' });
            }
            gainXp(m.xpValue);
        }
    }
    // A monster that dies scatters its own colours instead of blinking out.
    function burst(x, y, palette, count) {
        const colors = Object.values(palette);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            const sp = 40 + Math.random() * 120;
            particles.push({
                x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0.35 + Math.random() * 0.35, dur: 0.7,
                size: 2 + Math.random() * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }
    }
    function updateFloaters(dt) {
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.life -= dt;
            f.y -= 26 * dt;
            if (f.life <= 0) floaters.splice(i, 1);
        }
    }
    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.life -= dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vx *= 0.94;
            pt.vy *= 0.94;
            if (pt.life <= 0) particles.splice(i, 1);
        }
    }
    // The final boss gets its own defeat beat instead of instantly cutting to the
    // results screen: a real pause — the arena freezes (see the finalBossDeath check
    // near the top of update(), same independent-of-`state` freeze pattern
    // familiarAnnounce already uses) for FINAL_BOSS_DEATH_DUR real seconds, three
    // staggered shockwaves beyond the burst() already fired, all playing out in
    // slow motion (SLOW_MOTION_FACTOR) for weight. `state` stays 'playing' for the
    // whole sequence — win() (which flips it to 'won' and reveals the results,
    // fading in) only fires once the sequence actually finishes, not before, so the
    // overlay never competes with the explosion for attention.
    const FINAL_BOSS_DEATH_DUR = 3; // real seconds the arena stays frozen
    const FINAL_BOSS_DEATH_PULSES = [0, 1.0, 2.0]; // real seconds into the sequence
    const SLOW_MOTION_FACTOR = 0.35; // how much slower particles/explosions move during it
    function spawnDeathPulse(x, y) {
        // No `ult`/`boss` flag: updateExplosions() already treats a bare explosion as
        // purely decorative — it expands and fades without touching monsters or player.
        explosions.push({ x, y, r: 0, maxR: 160 + Math.random() * 40, life: 0.5, dur: 0.5 });
        burst(x, y, { a: FIRE_COLOR, b: FIRE_GLOW, c: '#fff3c4' }, reducedMotion ? 6 : 20);
        if (!reducedMotion) shake = Math.max(shake, 8);
        sfx('starburst');
    }
    function beginFinalBossDeath(x, y) {
        // Cut the loop right at the kill, not three seconds later when win() finally
        // calls endRun() — otherwise the whole slow-motion death beat plays out with
        // the background track still looping under it.
        stopMusic();
        finalBossDeath = reducedMotion ? null : { t: 0, x, y, nextPulse: 0 };
        // Reduced motion: skip the slow-motion spectacle entirely and go straight to
        // the results, same as every other reducedMotion shortcut in this file.
        if (!finalBossDeath) win();
    }
    // Cookie/May: walk in from a random edge (same corner-picking idea as
    // spawnMonster, minus any chase logic), pause to bark, then leave the way they
    // came. Never fights, never takes or deals contact damage.
    function startFamiliarVisit(kind) {
        const edge = Math.floor(Math.random() * 4);
        const inset = 70;
        let fromX, fromY, restX, restY;
        if (edge === 0) { fromX = Math.random() * W; fromY = -20; restX = fromX; restY = inset; }
        else if (edge === 1) { fromX = W + 20; fromY = Math.random() * H; restX = W - inset; restY = fromY; }
        else if (edge === 2) { fromX = Math.random() * W; fromY = H + 20; restX = fromX; restY = H - inset; }
        else { fromX = -20; fromY = Math.random() * H; restX = inset; restY = fromY; }
        familiarVisit = { kind, phase: 'enter', t: 0, x: fromX, y: fromY, fromX, fromY, restX, restY, acted: false };
    }
    function updateFamiliarVisit(dt) {
        if (familiarCooldown > 0) familiarCooldown -= dt;
        if (!familiarVisit) {
            familiarCheckTimer -= dt;
            if (familiarCheckTimer <= 0) {
                familiarCheckTimer = FAMILIAR_CHECK_INTERVAL;
                if (familiarCooldown <= 0) {
                    const manyMonsters = monsters.filter((m) => m.type !== 'boss' && m.type !== 'finalBoss').length >= FAMILIAR_MANY_MONSTERS;
                    // Cookie and May share the same trigger; which one shows up is a coin flip.
                    if (manyMonsters && Math.random() < FAMILIAR_CHANCE) startFamiliarVisit(Math.random() < 0.5 ? 'cookie' : 'may');
                }
            }
            return;
        }
        const v = familiarVisit;
        v.t += dt;
        if (v.phase === 'enter') {
            const p = Math.min(1, v.t / 0.5);
            v.x = v.fromX + (v.restX - v.fromX) * p;
            v.y = v.fromY + (v.restY - v.fromY) * p;
            if (p >= 1) {
                v.phase = 'act';
                v.t = 0;
                // The banner freezes the arena for a beat before the effect lands — see
                // the familiarAnnounce gate at the top of update(). The bark itself
                // plays right here, not alongside the effect: Cookie's kill sweep and
                // May's level-up each throw a burst of their own same-pitched chirps a
                // moment later, which would otherwise bury the bark completely.
                sfx('bark');
                familiarAnnounce = { kind: v.kind, t: 0 };
                onFamiliarAnnounce(v.kind);
            }
        } else if (v.phase === 'act') {
            // Whatever the visit does lands once, partway through the pause — not the
            // instant it arrives, so the visit reads as an actual beat rather than a
            // switch flipped on entry.
            if (!v.acted && v.t >= 0.3) {
                v.acted = true;
                if (!reducedMotion) shake = Math.max(shake, 6);
                screenFlash = 0.18;
                if (v.kind === 'cookie') {
                    for (let i = monsters.length - 1; i >= 0; i--) {
                        const m = monsters[i];
                        if (m.type === 'boss' || m.type === 'finalBoss') continue;
                        damageMonster(i, m.hp);
                    }
                } else {
                    applyLevelUp(true);
                }
            }
            if (v.t >= 0.6) { v.phase = 'leave'; v.t = 0; }
        } else {
            const p = Math.min(1, v.t / 0.5);
            v.x = v.restX + (v.fromX - v.restX) * p;
            v.y = v.restY + (v.fromY - v.restY) * p;
            if (p >= 1) {
                familiarVisit = null;
                familiarCooldown = FAMILIAR_COOLDOWN;
            }
        }
    }
    // How much a monster-dealt hit is scaled up at the run's current level —
    // see MONSTER_DMG_LEVEL_STEP/CAP above.
    function monsterDamageMul() {
        return Math.min(MONSTER_DMG_LEVEL_CAP, 1 + (level - 1) * MONSTER_DMG_LEVEL_STEP);
    }
    function hurtPlayer(amount) {
        if (state !== 'playing') return false;
        if (elapsed < player.invulnUntil) return false;
        hitsReceived++;
        player.hp -= amount;
        player.invulnUntil = elapsed + 0.6;
        hurtFlash = 0.45;
        if (!reducedMotion) shake = Math.max(shake, 7);
        floaters.push({ x: player.x, y: player.y - player.r - 6, text: `-${Math.round(amount)}`, life: 0.8, color: '#ff6b6b' });
        sfx('hurt');
        if (player.hp <= 0) {
            player.hp = 0;
            gameOver();
            return true;
        }
        return false;
    }
    // A status effect, not damage: separate from hurtPlayer so contact hits, the boss
    // slam and the star volley never trigger it by accident. Interrupts an in-progress
    // sword spin — staying mid-swing while frozen would look wrong — and skips the
    // usual hurt sfx since the ice bolt's own damage already played one.
    function applyParalysis(duration) {
        if (state !== 'playing') return;
        player.paralyzedUntil = elapsed + duration;
        if (spinning) {
            spinning = false;
            spinHeld = false;
        }
        burst(player.x, player.y, { a: '#74c0fc', b: '#d0f0ff', c: '#a5d8ff' }, 10);
    }
    function availableUpgrades() {
        return UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
    }
    function grantUpgrade(id) {
        const up = UPGRADES.find((u) => u.id === id);
        if (!up) return false;
        up.apply({ player, tuning, pickIndex: taken[id] || 0 });
        taken[id] = (taken[id] || 0) + 1;
        // apply() has already set giantScale synchronously, so the Colossus is
        // already "on screen" for the whole bolt effect below.
        if (id === 'giant') triggerColossusBolt();
        return true;
    }
    function applyLevelUp(announce) {
        level++;
        xpToNext = Math.round(xpToNext * 1.35 + 2);
        // The level itself gives only survivability, and a modest amount: the monsters
        // scale every level, so a hero whose health never moved would be unkillable by
        // choice alone. Damage, reach and speed stay entirely in the cards' hands.
        player.maxHp += 12;
        player.hp = player.maxHp;
        if (!announce) return;
        const pool = availableUpgrades();
        if (pool.length) {
            // Three distinct cards, drawn without replacement.
            const bag = pool.slice();
            pendingChoices = [];
            while (pendingChoices.length < Math.min(3, bag.length)) {
                pendingChoices.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
            }
            state = 'choosing';
            sfx('level');
            pushStats();
            onChoices(pendingChoices.map((u) => ({ id: u.id, icon: u.icon, name: u.name, desc: u.desc })));
            onStateChange(state);
        } else {
            announceLevel();
        }
    }
    // Runs after the card is picked, or straight away when there is nothing left to pick.
    function announceLevel() {
        if (level === FINAL_LEVEL) {
            spawnMonster('finalBoss');
            flashKind = 'final';
            levelFlash = 2.2;
            sfx('boss');
        } else if (level % 5 === 0) {
            spawnMonster('boss');
            flashKind = 'boss';
            levelFlash = 1.8;
            sfx('boss');
        } else {
            flashKind = 'level';
            flashLevel = level;
            levelFlash = 1.2;
        }
    }
    function chooseUpgrade(id) {
        if (state !== 'choosing') return;
        if (pendingChoices && !pendingChoices.some((u) => u.id === id)) return;
        grantUpgrade(id);
        pendingChoices = null;
        state = 'playing';
        sfx('card');
        announceLevel();
        // Enough xp for another level came in while the cards were open.
        if (xp >= xpToNext) gainXp(0);
        pushStats();
        pushCooldowns();
        onStateChange(state);
    }

    function gainXp(amount) {
        xp += amount;
        while (xp >= xpToNext) {
            xp -= xpToNext;
            applyLevelUp(true);
            if (state === 'choosing') break;
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
        const maxHp = Math.round((20 + level * 9) * def.hpMul);
        const xpValue = type === 'boss' ? Math.round(xpToNext * 1.8) : 3 + level;
        // How far the run has climbed at the moment this one steps in, not its type:
        // the same slime looks tougher met at level 12 than at level 1. Boss sprites
        // are already their own thing and skip this (see drawMonsters).
        const tier = level >= 11 ? 2 : level >= 6 ? 1 : 0;
        monsters.push({
            x, y, r, speed, type, hp: maxHp, maxHp, xpValue, tier,
            flash: 0, phase: Math.random() * Math.PI * 2,
            chargeTimer: 3, charging: 0,
            kx: 0, ky: 0,
            paralyzedUntil: 0, // set by the ice bow's arc — see the arrow-arc block in update()
            // Stagger the first shot so a pair spawned together doesn't fire in lockstep.
            shootTimer: def.shoot ? 0.8 + Math.random() * def.shoot.interval : 0,
            starTimer: def.starAttack ? def.starAttack.interval : 0,
            // Staggered like shootTimer, so a pack spawned together doesn't bite in lockstep.
            biteTimer: def.bite ? Math.random() * def.bite.cooldown : 0,
            biteWindup: 0,
            biteLungeT: 0, biteLungeDx: 0, biteLungeDy: 0,
            spitTimer: def.spit ? 0.8 + Math.random() * def.spit.interval : 0,
            breathWindup: 0, // telegraph before the breath lands
            breathT: 0,      // how long the attached flame lingers after it lands
        });
    }

    function update(dt) {
        // The page covers the arena (the portrait rotate-prompt) and wants nothing to
        // progress while the player can't see or control it — a full freeze, ahead of
        // every other check below, since none of it matters if the screen is covered.
        if (externalPause) return;
        // The arrival banner freezes the arena the same way 'choosing' does below —
        // a real pause, independent of `state`, so it can't fight the run/menu logic
        // that already gates on `state !== 'choosing'` elsewhere.
        if (familiarAnnounce) {
            familiarAnnounce.t += dt;
            if (familiarAnnounce.t >= FAMILIAR_ANNOUNCE_DURATION) {
                familiarAnnounce = null;
                onFamiliarAnnounce(null);
            }
            return;
        }
        // The final boss's own defeat beat: `state` stays 'playing' through the whole
        // thing (win() only fires once it's over, see below) — it can't rely on that
        // to freeze the arena like 'choosing' does, so it returns early right here
        // instead, before any of the normal player/monster/spawn logic below runs.
        // The visuals (particles/explosions/floaters/shake) still get ticked, just
        // in slow motion, so the sequence actually plays out instead of the arena
        // going fully static for three seconds.
        if (finalBossDeath) {
            finalBossDeath.t += dt; // real time — gates duration and pulse timing
            const slowDt = dt * SLOW_MOTION_FACTOR;
            while (finalBossDeath.nextPulse < FINAL_BOSS_DEATH_PULSES.length
                && finalBossDeath.t >= FINAL_BOSS_DEATH_PULSES[finalBossDeath.nextPulse]) {
                spawnDeathPulse(finalBossDeath.x, finalBossDeath.y);
                finalBossDeath.nextPulse++;
            }
            updateParticles(slowDt);
            updateExplosions(slowDt);
            updateFloaters(slowDt);
            shake = Math.max(0, shake - dt * 26);
            if (finalBossDeath.t >= FINAL_BOSS_DEATH_DUR) {
                finalBossDeath = null;
                win();
            }
            return;
        }
        // 'choosing' freezes the arena: the cards are a real pause, not a soft one.
        if (state !== 'playing') return;
        elapsed += dt;
        const prevX = player.x;
        const prevY = player.y;

        let mvx = 0;
        let mvy = 0;
        if (stick) {
            mvx = stick.x;
            mvy = stick.y;
        } else {
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
        // Frozen by an ice bolt: input is read as normal above (so it resumes the
        // instant paralyzedUntil passes) but never turned into movement below.
        if ((mvx !== 0 || mvy !== 0) && elapsed >= player.paralyzedUntil) {
            const len = Math.hypot(mvx, mvy);
            player.facing = { x: mvx / len, y: mvy / len };
            player.x = clamp(player.x + mvx * tuning.speed * dt, player.r, W - player.r);
            player.y = clamp(player.y + mvy * tuning.speed * dt, player.r, H - player.r);
        }

        player.moving = player.x !== prevX || player.y !== prevY;
        if (player.moving) player.walkT += dt;

        // Passo svelto: a handful of fading ghost copies trailing the hero while
        // moving — only sampled once the card has actually been taken, so a
        // vanilla build never pays for an array it doesn't use.
        const passoT = clamp((tuning.speed - 190) / 30, 0, 1);
        if (passoT > 0 && player.moving) {
            const frame = Math.floor(player.walkT * 8) % 2;
            playerTrail.push({ x: player.x, y: player.y, frame, flip: player.facing.x < 0 });
            if (playerTrail.length > 5) playerTrail.shift();
        } else if (playerTrail.length) {
            playerTrail.shift();
        }

        if (spinning) {
            const turnedBefore = spinAngle;
            spinAngle += (TAU / tuning.spinDur) * dt;
            spinHitTimer -= dt;
            if (spinHitTimer <= 0) {
                meleeHit();
                spinHitTimer = tuning.spinDur;
            }
            if (!spinHeld && Math.floor(spinAngle / TAU) > Math.floor(turnedBefore / TAU)) {
                spinning = false;
                spinAngle = 0;
            }
            // Furia: sparks flung off the spinning blade, more often the more the
            // spin has been sped up — absent on a build that never took the card.
            const furiaT = clamp((1 - tuning.spinDur / BASE_SPIN_DUR) / 0.35, 0, 1);
            if (furiaT > 0 && Math.random() < furiaT * 0.3) {
                const tipAngle = Math.atan2(player.facing.y, player.facing.x) + spinAngle;
                const tipX = player.x + Math.cos(tipAngle) * BLADE_TIP;
                const tipY = player.y + Math.sin(tipAngle) * BLADE_TIP;
                burst(tipX, tipY, { a: '#dfe6e9', b: '#ffffff', c: '#b2bec3' }, reducedMotion ? 1 : 2);
            }
        }
        // The flaming sword: while spinning, launch an extra fireball at the nearest
        // monster every so often, on top of the normal melee damage.
        if (player.swordFire && spinning) {
            swordBoltTimer -= dt;
            if (swordBoltTimer <= 0) {
                const target = nearestMonster();
                if (target) {
                    const angle = Math.atan2(target.y - player.y, target.x - player.x);
                    swordBolts.push({
                        x: player.x, y: player.y,
                        vx: Math.cos(angle) * SWORD_BOLT_SPEED, vy: Math.sin(angle) * SWORD_BOLT_SPEED,
                        r: 6, life: SWORD_BOLT_LIFE,
                    });
                }
                swordBoltTimer = SWORD_BOLT_INTERVAL;
            }
        } else {
            swordBoltTimer = 0;
        }
        for (let i = swordBolts.length - 1; i >= 0; i--) {
            const sb = swordBolts[i];
            sb.x += sb.vx * dt;
            sb.y += sb.vy * dt;
            sb.life -= dt;
            if (sb.life <= 0) {
                swordBolts.splice(i, 1);
                continue;
            }
            let hit = false;
            for (let j = monsters.length - 1; j >= 0; j--) {
                const m = monsters[j];
                if (circlesOverlap(sb.x, sb.y, sb.r, m.x, m.y, m.r)) {
                    burst(m.x, m.y, { a: FIRE_COLOR, b: FIRE_GLOW, c: '#fff3c4' }, reducedMotion ? 3 : 6);
                    damageMonster(j, Math.round(player.meleeDamage * 0.5));
                    hitsGiven++;
                    hit = true;
                    break;
                }
            }
            if (hit) swordBolts.splice(i, 1);
        }

        // Fortuna: an occasional lucky sparkle, absent on a build that never
        // took the card — same burst() used everywhere else for particles.
        const fortunaT = clamp((tuning.heartChance - 0.13) / 0.15, 0, 1);
        if (fortunaT > 0 && Math.random() < fortunaT * 0.015) {
            const a = Math.random() * TAU;
            burst(player.x + Math.cos(a) * player.r, player.y + Math.sin(a) * player.r, { a: '#2ecc71', b: '#f1c40f', c: '#ffffff' }, reducedMotion ? 1 : 3);
        }
        ultCooldown = Math.max(0, ultCooldown - dt);
        bowCooldown = Math.max(0, bowCooldown - dt);
        levelFlash = Math.max(0, levelFlash - dt);
        screenFlash = Math.max(0, screenFlash - dt);
        hurtFlash = Math.max(0, hurtFlash - dt);
        colossusBoltT = Math.max(0, colossusBoltT - dt);
        shake = Math.max(0, shake - dt * 26);
        // The Colossus card's size/crush effect is a 5s burst, not a permanent change
        // — only the melee damage/range bonus it also grants sticks around after.
        if (player.giantTimer > 0) {
            player.giantTimer = Math.max(0, player.giantTimer - dt);
            if (player.giantTimer === 0) {
                player.giantScale = 1;
                player.giantTargetScale = 1;
                player.r = 14;
            }
        }
        // Grows into the Colossus instead of snapping to 4x the instant the card
        // is picked — the lightning strike (drawColossusBolt) lands first, then
        // the hero visibly swells into the size it's about to crush things at.
        if (player.giantScale < player.giantTargetScale) {
            player.giantScale = Math.min(player.giantTargetScale, player.giantScale + GIANT_GROW_SPEED * dt);
        }

        updateFloaters(dt);
        updateParticles(dt);
        for (let i = hearts.length - 1; i >= 0; i--) {
            const h = hearts[i];
            h.life -= dt;
            if (h.life <= 0) {
                hearts.splice(i, 1);
                continue;
            }
            if (circlesOverlap(h.x, h.y, 12, player.x, player.y, player.r)) {
                const healed = Math.round(player.maxHp * 0.25);
                player.hp = Math.min(player.maxHp, player.hp + healed);
                floaters.push({ x: player.x, y: player.y - player.r - 6, text: `+${healed}`, life: 0.9, color: '#2ecc71' });
                hearts.splice(i, 1);
                sfx('heart');
            }
        }

        for (let i = treasures.length - 1; i >= 0; i--) {
            const tr = treasures[i];
            tr.life -= dt;
            if (tr.life <= 0) {
                treasures.splice(i, 1);
                continue;
            }
            const pickupR = tr.kind === 'big' ? tr.size : 12;
            if (circlesOverlap(tr.x, tr.y, pickupR, player.x, player.y, player.r)) {
                treasures.splice(i, 1);
                if (tr.kind === 'big') {
                    const pool = BIG_CHEST_REWARDS.filter((r) => !r.owned({ player }));
                    // All three already unlocked — a rare late-run edge case. Re-grant
                    // one anyway rather than doing nothing: apply() is idempotent, and
                    // the player still gets a floater for the chest they just opened.
                    const rewards = pool.length ? pool : BIG_CHEST_REWARDS;
                    const reward = rewards[Math.floor(Math.random() * rewards.length)];
                    reward.apply({ player });
                    floaters.push({ x: player.x, y: player.y - player.r - 6, text: reward.icon, life: 1.6, color: '#7c4dff', size: 34 });
                    // The floater alone reads as "something happened" but not what —
                    // name it out loud too, same banner the level-up/boss text already
                    // uses, so it's unmistakable which weapon just changed.
                    flashKind = 'reward';
                    flashRewardText = reward.name[strings.lang === 'it' ? 'it' : 'en'];
                    levelFlash = 1.6;
                    pushStats();
                    sfx('card');
                    continue;
                }
                // Same pool a level-up card draws from — a small chest is just that
                // reward handed out early, not a separate currency to track.
                const pool = availableUpgrades();
                if (pool.length) {
                    const up = pool[Math.floor(Math.random() * pool.length)];
                    grantUpgrade(up.id);
                    // Bigger and a touch longer-lived than a damage/heal floater —
                    // a treasure's reward icon deserves to actually stand out.
                    floaters.push({ x: player.x, y: player.y - player.r - 6, text: up.icon, life: 1.3, color: '#1abc9c', size: 28 });
                    pushStats();
                    sfx('card');
                }
            }
        }

        updateFamiliarVisit(dt);

        const finalFight = monsters.some((m) => m.type === 'finalBoss');
        // A bigger arena has more room to roam in — without this, the same spawn
        // rate that feels right on a phone reads as sparse on a big desktop
        // screen. Scaled by area (not just width or height) since that's what
        // actually governs how crowded the arena feels; capped at 1.8x so a very
        // large desktop window speeds things up without spiraling into chaos,
        // and the interval's own 0.4s floor still caps how fast spawns can get
        // even at high level on a big screen.
        const areaScale = clamp((W * H) / (480 * 640), 1, 1.8);
        const spawnInterval = Math.max(0.4, Math.max(0.5, 1.6 - level * 0.08) / areaScale) * (finalFight ? 3.5 : bossAlive() ? 2 : 1);
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
            // The ice bow's arc briefly freezes a monster in place: no new attacks,
            // no advancing. Knockback, flash decay and an already-telegraphed bite
            // landing stay outside this check (see paralyzedUntil in the plan) — the
            // effect is short and only needs to cover "stops, stops attacking".
            const frozen = elapsed < (m.paralyzedUntil || 0);
            if (!frozen) {
                if (def.shoot) {
                    m.shootTimer -= dt;
                    if (dist < def.shoot.range && m.shootTimer <= 0) {
                        fireBolt(m, def.shoot);
                        m.shootTimer = def.shoot.interval;
                    }
                    // Inside its comfort zone it backs off instead of closing in.
                    if (dist < def.shoot.standoff) speedMul = -0.5;
                    else if (dist < def.shoot.range) speedMul = def.shoot.approach;
                }
                // Unlike def.shoot, this never touches speedMul — the imp keeps hopping
                // in and biting exactly as before, the breath is just a bonus jab it
                // lands along the way. Same telegraph-then-resolve shape as def.bite
                // below, just gated on range instead of touching, and it never leaves
                // the imp — no projectile, the flame is drawn attached in drawMonsters().
                if (def.spit) {
                    if (m.breathWindup > 0) {
                        m.breathWindup -= dt;
                        if (m.breathWindup <= 0) {
                            m.spitTimer = def.spit.interval;
                            // Whiffs if the player stepped out of range during the telegraph
                            // — same dodge rule as a bite.
                            if (dist < def.spit.range) {
                                m.breathT = def.spit.duration;
                                if (hurtPlayer(def.spit.damage * monsterDamageMul())) return;
                            }
                        }
                    } else if (m.breathT > 0) {
                        m.breathT -= dt;
                    } else {
                        m.spitTimer -= dt;
                        if (dist < def.spit.range && m.spitTimer <= 0) {
                            m.breathWindup = def.spit.telegraph;
                        }
                    }
                }
                if (m.type === 'imp') {
                    const hopPhase = ((elapsed + m.phase) % IMP_HOP_PERIOD) / IMP_HOP_PERIOD;
                    speedMul *= Math.max(IMP_HOP_SPEED_FLOOR, Math.sin(hopPhase * Math.PI));
                }
                // 'rush'-style biters (imp, bat) quicken their own steps for the telegraph
                // window instead of teleport-snapping at the last instant — the speed-up
                // itself is the tell that a bite is coming.
                if (def.bite && def.bite.style === 'rush' && m.biteWindup > 0) {
                    speedMul = def.bite.rushMul;
                }
                if (m.type === 'boss' || m.type === 'finalBoss') {
                    m.chargeTimer -= dt;
                    if (m.chargeTimer <= 0) {
                        m.charging = 0.5;
                        // The final boss recovers faster between charges — less breathing
                        // room than the regular boss gives.
                        m.chargeTimer = m.type === 'finalBoss' ? 2 : 3;
                        if (!reducedMotion) shake = Math.max(shake, 4);
                    }
                    if (m.charging > 0) {
                        m.charging -= dt;
                        speedMul = 3;
                        // The charge just ended this frame, so a shockwave lands where it
                        // stopped — no more standing still and trading hits once it's done
                        // closing the distance. Both bosses now get this, not just the
                        // regular one; triggerBossSlam scales it up for the final boss.
                        if (m.charging <= 0) triggerBossSlam(m);
                    }
                }
                if (def.starAttack) {
                    m.starTimer -= dt;
                    if (m.starTimer <= 0) {
                        fireStarVolley(m, def.starAttack);
                        m.starTimer = def.starAttack.interval;
                    }
                }
                m.x += (dx / dist) * m.speed * speedMul * dt;
                m.y += (dy / dist) * m.speed * speedMul * dt;
            }
            if (m.kx !== 0 || m.ky !== 0) {
                m.x += m.kx * dt;
                m.y += m.ky * dt;
                const decay = Math.exp(-KNOCK_DECAY * dt);
                m.kx *= decay;
                m.ky *= decay;
                if (Math.abs(m.kx) < 2 && Math.abs(m.ky) < 2) {
                    m.kx = 0;
                    m.ky = 0;
                }
                // Never shove one so far out that it takes seconds to walk back in.
                m.x = clamp(m.x, -m.r * 2, W + m.r * 2);
                m.y = clamp(m.y, -m.r * 2, H + m.r * 2);
            }
            m.flash = Math.max(0, m.flash - dt);
            m.biteLungeT = Math.max(0, m.biteLungeT - dt);
            const touching = dist < player.r + m.r;
            if (touching) {
                if (player.giantScale >= 4 && m.type !== 'boss' && m.type !== 'finalBoss') {
                    damageMonster(i, Math.max(m.hp, player.meleeDamage * 2));
                    if (!reducedMotion) shake = Math.max(shake, 3);
                    continue;
                }
                // While spinning the hero plows through contact like a whirlwind —
                // same idea as Diablo's Barbarian — but stays vulnerable to bolts
                // and other ranged attacks below, so the spin can't trivialize a
                // boss fight fought at range. A monster with its own bite (below)
                // no longer hurts on touch alone — only a landed bite does.
                if (!def.bite && !spinning && hurtPlayer((def.contactDamage || 10) * monsterDamageMul())) return;
            }
            if (def.bite) {
                if (m.biteWindup > 0) {
                    m.biteWindup -= dt;
                    if (m.biteWindup <= 0) {
                        m.biteTimer = def.bite.cooldown;
                        // Lands only if still touching once the telegraph runs out —
                        // stepping away during the windup makes it whiff (cooldown still
                        // applies, but no damage), same as a real dodge should.
                        if (touching && !spinning) {
                            // Only the 'leap' style (slime) gets the snap-towards-player
                            // draw offset — it's the hop itself, drawn in drawMonsters
                            // with an added vertical arc. 'rush' bites (imp, bat) already
                            // sold the approach via the speed-up above; snapping them too
                            // would double up on the same motion.
                            if (def.bite.style === 'leap') {
                                m.biteLungeT = BITE_LUNGE_DUR;
                                m.biteLungeDx = dx / dist;
                                m.biteLungeDy = dy / dist;
                            }
                            if (hurtPlayer(def.bite.damage * monsterDamageMul())) return;
                        }
                    }
                } else {
                    m.biteTimer -= dt;
                    // Engage range is a bit wider than the actual touch range used for
                    // landing/whiffing above — see BITE_ENGAGE_MARGIN.
                    if (dist < player.r + m.r + BITE_ENGAGE_MARGIN && m.biteTimer <= 0) {
                        m.biteWindup = def.bite.telegraph;
                        if (!reducedMotion) shake = Math.max(shake, 2);
                    }
                }
            }
        }

        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            if (b.homing) {
                const targetAngle = Math.atan2(player.y - b.y, player.x - b.x);
                const curAngle = Math.atan2(b.vy, b.vx);
                // Turn toward the player at a gentle, fixed rate (~63°/s)...
                let diff = ((targetAngle - curAngle + Math.PI) % TAU + TAU) % TAU - Math.PI;
                let newAngle = curAngle + clamp(diff, -1.1 * dt, 1.1 * dt);
                // ...and never let it bend more than ~34° off its original aim —
                // a stronger nudge toward where the player is now, but still not a
                // lock-on.
                let dev = ((newAngle - b.angle0 + Math.PI) % TAU + TAU) % TAU - Math.PI;
                newAngle = b.angle0 + clamp(dev, -0.6, 0.6);
                b.vx = Math.cos(newAngle) * b.speed;
                b.vy = Math.sin(newAngle) * b.speed;
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
                bolts.splice(i, 1);
                continue;
            }
            if (circlesOverlap(b.x, b.y, b.r, player.x, player.y, player.r)) {
                bolts.splice(i, 1);
                // Read before hurtPlayer: a hit blocked by the invuln window still
                // returns false, so this is the only way to tell "landed" from "no-op".
                const landed = elapsed >= player.invulnUntil;
                if (hurtPlayer(b.damage)) return;
                if (b.ice && landed) applyParalysis(b.paralyzeDuration);
            }
        }

        // The mirror of the bolts loop above — the hero's own arrows, checked
        // against monsters instead of the player.
        for (let i = arrows.length - 1; i >= 0; i--) {
            const a = arrows[i];
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.life -= dt;
            if (a.life <= 0 || a.x < -20 || a.x > W + 20 || a.y < -20 || a.y > H + 20) {
                arrows.splice(i, 1);
                continue;
            }
            for (let j = monsters.length - 1; j >= 0; j--) {
                const m = monsters[j];
                if (circlesOverlap(a.x, a.y, a.r, m.x, m.y, m.r)) {
                    damageMonster(j, player.arrowDamage);
                    hitsGiven++;
                    arrows.splice(i, 1);
                    break;
                }
            }
        }
        // Electricity between still-adjacent-slot arrows: a monster standing
        // between two arrows that missed it directly still takes a hit, once per
        // arc (arcHit lives on the lower-slot arrow of the pair) rather than every
        // frame it lingers in range.
        {
            const volleys = new Map();
            for (const a of arrows) {
                if (!volleys.has(a.volley)) volleys.set(a.volley, []);
                volleys.get(a.volley).push(a);
            }
            volleys.forEach((list) => {
                list.sort((p, q) => p.slot - q.slot);
                for (let k = 0; k < list.length - 1; k++) {
                    const a1 = list[k];
                    const a2 = list[k + 1];
                    if (a2.slot !== a1.slot + 1) continue;
                    for (let j = monsters.length - 1; j >= 0; j--) {
                        const m = monsters[j];
                        if (a1.arcHit.has(m)) continue;
                        if (distToSegment(m.x, m.y, a1.x, a1.y, a2.x, a2.y) < m.r + ARROW_ARC_RANGE) {
                            a1.arcHit.add(m);
                            if (player.bowIce) {
                                // The ice bow: the arc no longer hurts, it freezes.
                                m.paralyzedUntil = Math.max(m.paralyzedUntil || 0, elapsed + ICE_ARC_PARALYZE_DUR);
                                burst(m.x, m.y, { a: ICE_COLOR, b: ICE_GLOW, c: '#a5d8ff' }, reducedMotion ? 3 : 6);
                            } else {
                                burst(m.x, m.y, { a: LIGHTNING_COLOR, b: LIGHTNING_GLOW, c: '#e0d4ff' }, reducedMotion ? 3 : 6);
                                damageMonster(j, ARROW_ARC_DAMAGE);
                                hitsGiven++;
                            }
                        }
                    }
                }
            });
        }

        if (updateExplosions(dt)) return;

        pushStats();
        pushCooldowns();
    }
    // Returns true if this tick's explosions killed the player — update()'s normal
    // path stops right there (skips pushStats/pushCooldowns, same as before this was
    // pulled out of the loop below); the finalBossDeath branch above never sees true
    // since its own decorative pulses never carry `.boss`/`.ult`.
    function updateExplosions(dt) {
        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            ex.life -= dt;
            ex.r = ex.maxR * (1 - Math.max(0, ex.life) / ex.dur);
            if (ex.ult) {
                // The expanding ring hits each monster once as it sweeps past.
                for (let j = monsters.length - 1; j >= 0; j--) {
                    const m = monsters[j];
                    if (!ex.hit.has(m) && circlesOverlap(m.x, m.y, m.r, ex.x, ex.y, ex.r)) {
                        ex.hit.add(m);
                        burst(m.x, m.y, { a: FIRE_COLOR, b: FIRE_GLOW, c: '#fff3c4' }, reducedMotion ? 4 : 9);
                        damageMonster(j, player.fireDamage * 3);
                        hitsGiven++;
                        // Glacial burst: the ultimate also briefly freezes what it hits,
                        // on top of its usual damage — the name is on the effect, the
                        // explosion itself stays fire-coloured to read cleanly.
                        if (player.ultimateIce) {
                            m.paralyzedUntil = Math.max(m.paralyzedUntil || 0, elapsed + ICE_ULT_PARALYZE_DUR);
                        }
                    }
                }
                for (let j = bolts.length - 1; j >= 0; j--) {
                    if (Math.hypot(bolts[j].x - ex.x, bolts[j].y - ex.y) < ex.r) bolts.splice(j, 1);
                }
            } else if (ex.boss && !ex.hit && circlesOverlap(player.x, player.y, player.r, ex.x, ex.y, ex.r)) {
                ex.hit = true;
                if (hurtPlayer(ex.damage)) return true;
            }
            if (ex.life <= 0) explosions.splice(i, 1);
        }
        return false;
    }

    // What the upgrade cards actually added up to by the end of the run — same
    // shape whether the run ended in victory or defeat, and whether or not it
    // beat the record.
    function finalStats() {
        return {
            meleeDamage: player.meleeDamage, fireDamage: player.fireDamage, arrowDamage: player.arrowDamage, maxHp: player.maxHp,
            speed: tuning.speed, meleeRange: tuning.meleeRange, spinDur: tuning.spinDur,
            knockback: tuning.knockback, ultCd: tuning.ultCd, bowCd: tuning.bowCd, heartChance: tuning.heartChance,
            treasureChance: tuning.treasureChance,
        };
    }
    function endRun(won) {
        state = won ? 'won' : 'over';
        if (won) {
            hasWon = true;
            writeFlag(WON_KEY, true);
        }
        spinning = false;
        spinHeld = false;
        spinAngle = 0;
        const stats = finalStats();
        if (level >= bestLevel) {
            bestLevel = level;
            writeBestLevel(bestLevel);
            writeBestRecord({ level, monstersKilled, time: Math.round(elapsed), hitsGiven, hitsReceived, finalStats: stats });
        }
        // The looping background track has no reason to keep going once the run is
        // decided — it only muddied the win fanfare/death jingle underneath it.
        stopMusic();
        sfx(won ? 'win' : 'over');
        pushStats();
        onStateChange(state, {
            level, monstersKilled, best: bestLevel, time: Math.round(elapsed), won,
            hitsGiven, hitsReceived, finalStats: stats,
        });
    }
    function win() {
        endRun(true);
    }
    function gameOver() {
        endRun(false);
    }

    function drawSprite(rows, palette, cx, cy, cell, flipX, override) {
        paintSprite(ctx, rows, palette, cx, cy, cell, flipX, override);
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
        const giantScale = player.giantScale || 1;
        const cell = 3 * giantScale;
        const frame = player.moving ? Math.floor(player.walkT * 8) % 2 : 0;
        const bob = player.moving ? (frame === 0 ? 0 : -1.5 * giantScale) : 0;
        const flip = player.facing.x < 0;
        const palette = Object.assign({ P: colors.accent, T: colors.accent }, HERO_PALETTE);

        drawShadow(player.x, player.y + 18 * giantScale, 12 * giantScale);

        // Passo svelto: fading ghost copies behind the hero, sampled in update(dt)
        // only once the card is in — an empty trail here just draws nothing.
        for (let i = 0; i < playerTrail.length; i++) {
            const t = playerTrail[i];
            ctx.save();
            ctx.globalAlpha = ((i + 1) / (playerTrail.length + 1)) * 0.35;
            drawSprite(HERO_FRAMES[t.frame], palette, t.x, t.y, cell, t.flip);
            ctx.restore();
        }

        // Vigore: a soft rim in heart-red just behind the hero, a touch larger than
        // the sprite itself — grows with maxHp, absent on a build that never took
        // it. Drawn later, right alongside the hero sprite itself (see below), so
        // it turns together with it during a spin instead of sitting fixed while
        // the body underneath rotates away from it.
        const vigoreT = clamp((player.maxHp - 100) / 50, 0, 1);

        // Ricarica rapida: a little comet orbiting the hero, its pace (not its size)
        // picking up as the fireball's cooldown shrinks — absent on a build that
        // never took the card. Uses the theme's own accent colour (chosen to read
        // against both themes already) instead of a fixed pale tone that risked
        // washing out against a light background.
        const ricaricaT = clamp((BASE_ULT_CD - tuning.ultCd) / 4, 0, 1);
        if (ricaricaT > 0) {
            const orbitR = (player.r + 11) * giantScale;
            ctx.save();
            for (let i = 3; i >= 0; i--) {
                const orbitAngle = elapsed * (2 + ricaricaT * 4) - i * 0.35;
                ctx.globalAlpha = (1 - i / 4) * (0.55 + 0.25 * Math.sin(elapsed * 14));
                ctx.fillStyle = i === 0 ? colors.ink : colors.accent;
                ctx.beginPath();
                ctx.arc(player.x + Math.cos(orbitAngle) * orbitR, player.y + bob + Math.sin(orbitAngle) * orbitR, (i === 0 ? 3 : 2) * giantScale, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        }

        // Frozen by an ice bolt: a pulsing ring, same visual language as the boss's
        // star-volley telegraph, so "you're locked out of input" reads at a glance.
        if (elapsed < player.paralyzedUntil) {
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(elapsed * 18);
            ctx.fillStyle = ICE_GLOW;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.r * 1.6, 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        // The build a run picks stays visible on the hero, not just on the results
        // screen: how far Forza/Lama lunga/Braci have been taken above their base
        // value (18, 44, 14) reads directly off player.meleeDamage/fireDamage and
        // tuning.meleeRange — the very same numbers finalStats() reports — instead
        // of a separate "which card was picked" tally. The blade itself keeps its
        // original fixed size — only its colour shifts hotter, from either melee
        // card, never its length. Denominators are deliberately low (a couple of
        // picks reaches full heat, not all seven/four) so the shift reads on the
        // second or third level-up, not only once a run is nearly maxed out.
        const meleeT = Math.max(
            clamp((player.meleeDamage - 18) / 18, 0, 1),
            clamp((tuning.meleeRange - baseTuning.meleeRange) / 18, 0, 1),
        );
        let bladeColor = meleeT > 0 ? blendHex(colors.blade, FIRE_COLOR, meleeT) : colors.blade;
        // The edge outruns the body on purpose — a hotter, brighter rim reads as
        // "glowing" at a glance instead of just "slightly less grey".
        const edgeT = clamp(meleeT * 1.4, 0, 1);
        let bladeEdgeColor = edgeT > 0 ? blendHex(colors.bladeEdge, FIRE_GLOW, edgeT) : colors.bladeEdge;
        // Flaming sword reward: the blade itself burns, regardless of how much
        // melee investment meleeT tracks — two overlapping sine waves so the
        // flicker never settles into an obvious steady beat.
        if (player.swordFire) {
            const flicker = 0.5 + 0.3 * Math.sin(elapsed * 16) + 0.2 * Math.sin(elapsed * 27 + 1.4);
            bladeColor = blendHex(FIRE_COLOR, '#fff3c4', clamp(flicker, 0, 1));
            bladeEdgeColor = blendHex(FIRE_GLOW, '#ffffff', clamp(flicker * 1.2, 0, 1));
        }

        // A pulsing ember aura once at least one Braci card is in, same technique as
        // the ice-paralysis ring above — grows with fireDamage, absent on a build
        // that never took fire at all. Same low-denominator logic as meleeT above.
        const fireT = clamp((player.fireDamage - 14) / 14, 0, 1);
        if (fireT > 0) {
            ctx.save();
            ctx.globalAlpha = (0.3 + 0.18 * Math.sin(elapsed * 10)) * fireT;
            ctx.fillStyle = FIRE_GLOW;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, (player.r + 8 + fireT * 12) * giantScale, 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        // Sword: a full spin attack right after a melee press (hero and blade turn 360°
        // together, the blade leaving a circular trail); otherwise the sword rests along the
        // facing direction.
        const angle = Math.atan2(player.facing.y, player.facing.x);
        const swordAngle = spinning ? angle + spinAngle : angle + 0.35;
        if (spinning) {
            // A tail behind the blade: it grows over the first turn, then stays put, so
            // holding the action doesn't just paint a solid ring.
            const tail = Math.min(spinAngle, 1.8);
            ctx.save();
            ctx.strokeStyle = colors.inkSoft;
            ctx.lineWidth = 3 * giantScale;
            ctx.beginPath();
            ctx.arc(player.x, player.y + bob, BLADE_TIP * giantScale, swordAngle - tail, swordAngle);
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.translate(player.x, player.y + bob);
        ctx.rotate(swordAngle);
        ctx.scale(giantScale, giantScale);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(BLADE_START - 3, -4, 3, 8);
        ctx.fillStyle = bladeColor;
        ctx.fillRect(BLADE_START, -1.5, BLADE_LEN, 3);
        ctx.fillStyle = bladeEdgeColor;
        ctx.fillRect(BLADE_START, -1.5, BLADE_LEN, 1);
        ctx.restore();

        if (spinning) {
            // The hero sprite turns together with the blade — the Vigore rim drawn
            // in this same rotated context turns with it too, instead of the fixed
            // orientation it would have if drawn back where the rest of the world-
            // space traits live.
            ctx.save();
            ctx.translate(player.x, player.y + bob);
            ctx.rotate(spinAngle);
            if (vigoreT > 0) {
                ctx.save();
                ctx.globalAlpha = 0.3 + 0.25 * vigoreT;
                drawSprite(HERO_FRAMES[frame], palette, 0, 0, cell * 1.18, flip, HEART_PALETTE.H);
                ctx.restore();
            }
            drawSprite(HERO_FRAMES[frame], palette, 0, 0, cell, flip);
            ctx.restore();
            return;
        }
        if (vigoreT > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3 + 0.25 * vigoreT;
            drawSprite(HERO_FRAMES[frame], palette, player.x, player.y + bob, cell * 1.18, flip, HEART_PALETTE.H);
            ctx.restore();
        }
        drawSprite(HERO_FRAMES[frame], palette, player.x, player.y + bob, cell, flip);
    }

    function drawMonsters(colors) {
        monsters.forEach((m) => {
            const def = MONSTER_TYPES[m.type];
            const t = elapsed * 6 + m.phase;
            const override = m.flash > 0 ? colors.ink : null;
            let frame = 0;
            let sx = 1;
            let sy = 1;
            let dy = 0;
            if (m.type === 'slime') {
                sy = 1 + Math.sin(t) * 0.12;
                sx = 1 - Math.sin(t) * 0.08;
            } else if (m.type === 'imp') {
                // Same hopPhase formula as the speedMul in update() — the leap up and
                // the burst of horizontal speed stay in sync.
                const hopPhase = ((elapsed + m.phase) % IMP_HOP_PERIOD) / IMP_HOP_PERIOD;
                dy = -Math.abs(Math.sin(hopPhase * Math.PI)) * IMP_HOP_HEIGHT;
            } else if (m.type === 'bat') {
                frame = Math.floor(elapsed * 10 + m.phase) % 2;
                dy = Math.sin(t) * 3 - 4;
            } else if (m.type === 'sprungal') {
                // A new silhouette roughly every 1.2s, offset by its own spawn phase so a
                // pack of them never mutates in lockstep. Always thinner-and-taller than
                // its rest pose, on top of the frame swap, so it reads as filiform even
                // mid-mutation.
                frame = Math.floor(elapsed / 1.2 + m.phase) % def.frames.length;
                sx = 0.75 + Math.sin(t * 0.7) * 0.1;
                sy = 1.15 + Math.sin(t * 0.9 + 1) * 0.1;
            }
            // The lunge itself: a quick snap towards the player at the instant a bite
            // lands (set in update(), 'leap' style only), eased out-and-back so it
            // reads as a hop rather than a slide — 0 at both ends of biteLungeT,
            // peaking at the midpoint. The shadow stays on the ground (no lift) while
            // the sprite itself rises — same "airborne" cue as any platformer jump.
            let lungeX = 0;
            let lungeY = 0;
            let leapLift = 0;
            if (m.biteLungeT > 0) {
                const arc = Math.sin((1 - m.biteLungeT / BITE_LUNGE_DUR) * Math.PI);
                lungeX = m.biteLungeDx * arc * BITE_LUNGE_DIST;
                lungeY = m.biteLungeDy * arc * BITE_LUNGE_DIST;
                leapLift = arc * BITE_LEAP_LIFT;
            }
            if (m.type !== 'bat') drawShadow(m.x + lungeX, m.y + lungeY + m.r * 0.8, m.r * 0.9);
            // The telegraph before a bite lands: same idea as the star volley's warning
            // glow below, in the same red already used for the player's own damage
            // numbers — reads as a threat about to land, distinct from the white flash
            // that means "just got hit".
            if (def.bite && m.biteWindup > 0) {
                ctx.save();
                ctx.globalAlpha = 0.3 + 0.3 * Math.sin(elapsed * 24);
                ctx.fillStyle = '#ff6b6b';
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r * 1.35, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
            // The telegraph before the imp's breath lands: same pulsing-glow idea as
            // the bite above, fire-colored instead of red so the two warnings read as
            // different threats at a glance.
            if (def.spit && m.breathWindup > 0) {
                ctx.save();
                ctx.globalAlpha = 0.3 + 0.3 * Math.sin(elapsed * 24);
                ctx.fillStyle = FIRE_GLOW;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r * 1.3, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
            // The telegraph before the final boss's star volley: a pulsing glow so the
            // ring of arrows about to come out reads as a warning, not a surprise.
            if (def.starAttack && m.starTimer > 0 && m.starTimer <= def.starAttack.telegraph) {
                ctx.save();
                ctx.globalAlpha = 0.35 + 0.35 * Math.sin(elapsed * 18);
                ctx.fillStyle = FIRE_GLOW;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r * 1.6, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
            // Boss sprites are already their own unique look; the tier tint is only for
            // the four regular monster types, so it can't be mistaken for a boss cue.
            const palette = m.tier && !def.starAttack && m.type !== 'boss' ? tintPalette(def.palette, m.type, m.tier) : def.palette;
            ctx.save();
            ctx.translate(m.x + lungeX, m.y + dy + lungeY - leapLift);
            ctx.scale(sx, sy);
            drawSprite(def.frames[frame], palette, 0, 0, def.cell, m.x > player.x, override);
            ctx.restore();

            // The breath itself: never a projectile, just a handful of warm blobs drawn
            // fresh every frame along the line from the imp to wherever the player
            // currently is, clamped to its range — stays attached to the monster and
            // vanishes the instant breathT runs out, like a dragon's gout of flame
            // instead of something that was thrown.
            if (def.spit && m.breathT > 0) {
                const bdx = player.x - m.x;
                const bdy = player.y - m.y;
                const bd = Math.hypot(bdx, bdy) || 1;
                const len = Math.min(bd, def.spit.range);
                const steps = 5;
                ctx.save();
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    const jitter = Math.sin(elapsed * 30 + s * 2) * 2 * (1 - t);
                    const px = m.x + (bdx / bd) * len * t - (bdy / bd) * jitter;
                    const py = m.y + (bdy / bd) * len * t + (bdx / bd) * jitter;
                    const br = 6 * (1 - t * 0.6);
                    ctx.globalAlpha = 0.9 * (1 - t * 0.5);
                    ctx.fillStyle = FIRE_GLOW;
                    ctx.beginPath();
                    ctx.arc(px, py, br * 1.6, 0, TAU);
                    ctx.fill();
                    ctx.globalAlpha = 1 - t * 0.3;
                    ctx.fillStyle = FIRE_COLOR;
                    ctx.beginPath();
                    ctx.arc(px, py, br, 0, TAU);
                    ctx.fill();
                }
                ctx.restore();
            }

            // Named on screen: the shapeshifter because its look won't hold still long
            // enough to recognise otherwise, the bosses because they're the two fights
            // worth calling out by name. Everything else is common enough, and stays
            // recognisable enough by its fixed silhouette, that a label would just be
            // clutter — especially with a handful of them on screen at once. Sits above
            // where the health bar goes, whether or not one is showing, so the two
            // never collide. Bosses reuse the same string as their health bar up top
            // (bossBar/finalBossBar) instead of a name of their own.
            if (m.type === 'sprungal' || m.type === 'boss' || m.type === 'finalBoss') {
                const label = m.type === 'sprungal' ? 'Sprungal' : m.type === 'boss' ? strings.bossBar : strings.finalBossBar;
                ctx.save();
                ctx.font = '600 8px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = colors.inkSoft;
                ctx.fillText(label, m.x, m.y - m.r - 20);
                ctx.restore();
            }

            if (m.hp < m.maxHp && m.type !== 'boss') {
                const bw = 22;
                const bx = m.x - bw / 2;
                const by = m.y - m.r - 9;
                ctx.fillStyle = colors.inkFaint;
                ctx.fillRect(bx, by, bw, 4);
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), 4);
                ctx.strokeStyle = colors.inkSoft;
                ctx.lineWidth = 1;
                ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 5);
            }
        });
    }

    // Cookie/May are noticeably bigger than the monster sprites they share a technique
    // with — this is a guest appearance, not another thing trying to blend into the
    // swarm — and a little bounce while barking is the only animation either needs.
    const FAMILIAR_CELL = 4.2;
    function drawFamiliar(colors) {
        const v = familiarVisit;
        if (!v) return;
        const frame = v.kind === 'cookie' ? DOG_FRAME : MAY_FRAME;
        const palette = v.kind === 'cookie' ? COOKIE_PALETTE : MAY_PALETTE;
        const barking = v.phase === 'act' && v.t < 0.35;
        const bounce = barking ? Math.abs(Math.sin(v.t * 26)) * 4 : 0;
        const movingLeft = v.phase === 'leave' ? v.fromX < v.restX : v.restX < v.fromX;
        drawShadow(v.x, v.y + 16, 16);
        // While the arrival banner is up (update() has the arena frozen for it), a
        // pulsing halo behind the sprite is the "own visual effect" for the moment —
        // distinct from the sharp screenFlash the bark itself throws a beat later.
        if (familiarAnnounce && familiarAnnounce.kind === v.kind) {
            const pulse = 0.5 + 0.5 * Math.sin(familiarAnnounce.t * 4);
            ctx.save();
            ctx.globalAlpha = 0.25 + pulse * 0.25;
            ctx.fillStyle = palette.glow;
            ctx.beginPath();
            ctx.arc(v.x, v.y, 26 + pulse * 8, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        drawSprite(frame, palette, v.x, v.y - bounce, FAMILIAR_CELL, movingLeft);
    }

    function drawBolts() {
        bolts.forEach((b) => {
            // The final boss's star volley reads warm (fire), the sprungal's ice bolts
            // read cold (pale blue) — never the caster's magenta, so none of the three
            // gets mistaken for another mid-dodge.
            const color = b.ice ? ICE_COLOR : b.fireArrow ? FIRE_COLOR : BOLT_COLOR;
            const glow = b.ice ? ICE_GLOW : b.fireArrow ? FIRE_GLOW : BOLT_GLOW;
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(b.x - b.vx * 0.004, b.y - b.vy * 0.004, b.r * 0.5, 0, TAU);
            ctx.fill();
            ctx.restore();
        });
    }
    // A shaft + arrowhead oriented along the flight path, not a circle like the
    // enemy bolts above — it needs to read as "an arrow" at a glance, not just as
    // another dot flying across the arena.
    function drawArrows() {
        // The ice bow gets its own frosty shaft/tip instead of the default wood-and-bronze
        // arrow — so the arrows themselves read as icy, not just the arc between them.
        const shaftColor = player.bowIce ? ICE_COLOR : ARROW_COLOR;
        const tipColor = player.bowIce ? ICE_GLOW : ARROW_GLOW;
        arrows.forEach((a) => {
            const angle = Math.atan2(a.vy, a.vx);
            ctx.save();
            ctx.translate(a.x, a.y);
            // A soft halo around each ice arrow — brighter and colder than the shaft
            // itself, so a whole volley reads as icy at a glance, not just up close.
            if (player.bowIce) {
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, TAU);
                ctx.fillStyle = ICE_GLOW;
                ctx.globalAlpha = 0.4;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.rotate(angle);
            ctx.strokeStyle = shaftColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(3, 0);
            ctx.stroke();
            ctx.fillStyle = tipColor;
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(-1, -2.5);
            ctx.lineTo(-1, 2.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
    }
    // The flaming sword's periodic bonus fireballs — a filled circle with a soft
    // outer glow, same fire palette as the ultimate, no need for the arrows' own
    // rotated-sprite treatment since this is a simple travelling ball of fire.
    function drawSwordBolts() {
        swordBolts.forEach((sb) => {
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, sb.r * 1.8, 0, TAU);
            ctx.fillStyle = FIRE_GLOW;
            ctx.globalAlpha = 0.4;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, sb.r, 0, TAU);
            ctx.fillStyle = FIRE_COLOR;
            ctx.fill();
        });
    }
    // The electric arcs between adjacent arrows in a volley — same grouping as
    // the hit-test in update(), just for drawing: a short zigzag (the gap between
    // two arrows is small, unlike the Colossus bolt's screen-spanning jag) with
    // the same halo-then-core stroke used throughout the file.
    function drawArrowArcs() {
        const volleys = new Map();
        for (const a of arrows) {
            if (!volleys.has(a.volley)) volleys.set(a.volley, []);
            volleys.get(a.volley).push(a);
        }
        ctx.save();
        ctx.lineCap = 'round';
        volleys.forEach((list) => {
            list.sort((p, q) => p.slot - q.slot);
            for (let k = 0; k < list.length - 1; k++) {
                const a1 = list[k];
                const a2 = list[k + 1];
                if (a2.slot !== a1.slot + 1) continue;
                const segs = 3;
                const nx = -(a2.y - a1.y);
                const ny = a2.x - a1.x;
                const nlen = Math.hypot(nx, ny) || 1;
                ctx.beginPath();
                ctx.moveTo(a1.x, a1.y);
                for (let s = 1; s < segs; s++) {
                    const f = s / segs;
                    const mx = a1.x + (a2.x - a1.x) * f;
                    const my = a1.y + (a2.y - a1.y) * f;
                    const off = Math.sin(elapsed * 40 + a1.slot * 7 + s * 5) * 3;
                    ctx.lineTo(mx + (nx / nlen) * off, my + (ny / nlen) * off);
                }
                ctx.lineTo(a2.x, a2.y);
                ctx.strokeStyle = player.bowIce ? ICE_GLOW : LIGHTNING_GLOW;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.strokeStyle = player.bowIce ? ICE_COLOR : LIGHTNING_COLOR;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    // One glowing ring of fire, `progress` (0..1) of the way from the origin to the
    // arena's edge. Used twice per fireball, a beat apart, so the blast reads as two
    // waves chasing each other out to every corner — not just a bright spot at the
    // player's feet.
    function drawFireRing(cx, cy, maxR, progress, widthScale, alpha, ice) {
        if (progress <= 0) return;
        const r = progress * maxR;
        ctx.save();
        ctx.globalAlpha = alpha * (1 - progress * 0.15);
        const grad = ctx.createRadialGradient(cx, cy, Math.max(0, r - 22), cx, cy, r + 6);
        if (ice) {
            grad.addColorStop(0, 'rgba(116, 192, 252, 0)');
            grad.addColorStop(0.55, 'rgba(208, 240, 255, 0.55)');
            grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(1, 'rgba(116, 192, 252, 0)');
        } else {
            grad.addColorStop(0, 'rgba(230, 126, 34, 0)');
            grad.addColorStop(0.55, 'rgba(249, 202, 36, 0.55)');
            grad.addColorStop(0.85, 'rgba(255, 243, 196, 0.9)');
            grad.addColorStop(1, 'rgba(230, 126, 34, 0)');
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 14 * widthScale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }

    function drawExplosions(colors) {
        explosions.forEach((ex) => {
            const a = Math.max(0, ex.life / ex.dur);   // 1 at the blast, 0 when spent
            const seed = ex.seed || 0;
            if (ex.boss) {
                // The ogre's shockwave: a plain impact ring in the theme's ink, never
                // fire-coloured — it must never be mistaken for the player's own blast.
                ctx.save();
                ctx.globalAlpha = a * 0.8;
                ctx.strokeStyle = colors.ink;
                ctx.lineWidth = 3 * a + 1;
                ctx.beginPath();
                ctx.arc(ex.x, ex.y, ex.r, 0, TAU);
                ctx.stroke();
                ctx.restore();
                return;
            }
            // Two rings racing out to the arena's edge, tied to the very radius that
            // decides the actual hit — what you see is exactly what the blast reaches.
            const p1 = 1 - Math.max(0, ex.life) / ex.dur;
            const p2 = Math.max(0, p1 - 0.15);
            drawFireRing(ex.x, ex.y, ex.maxR, p1, 1, a, ex.ice);
            drawFireRing(ex.x, ex.y, ex.maxR, p2, 0.7, a, ex.ice);
            // A fireball, not a travelling hoop: it swells fast, then burns down. The
            // damage still sweeps the whole arena — you see it in the monsters popping
            // as the wave reaches them, which reads far better than a geometric circle.
            const br = 34 + (ex.maxR * 0.24 - 34) * (1 - a * a);
            ctx.save();

            const ball = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, br);
            if (ex.ice) {
                ball.addColorStop(0, `rgba(255, 255, 255, ${0.95 * a})`);
                ball.addColorStop(0.35, `rgba(208, 240, 255, ${0.85 * a})`);
                ball.addColorStop(0.75, `rgba(116, 192, 252, ${0.6 * a})`);
                ball.addColorStop(1, 'rgba(41, 128, 185, 0)');
            } else {
                ball.addColorStop(0, `rgba(255, 255, 245, ${0.95 * a})`);
                ball.addColorStop(0.35, `rgba(249, 202, 36, ${0.85 * a})`);
                ball.addColorStop(0.75, `rgba(230, 126, 34, ${0.6 * a})`);
                ball.addColorStop(1, 'rgba(192, 57, 43, 0)');
            }
            ctx.fillStyle = ball;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, br, 0, TAU);
            ctx.fill();

            // Billows filling the ball, at scattered angles and depths. A smooth
            // function here (a sine of the angle) leaves a visible three-lobed flower;
            // a hash does not, and fire has no symmetry.
            const lobes = reducedMotion ? 10 : 22;
            const hash = (n) => {
                const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
                return v - Math.floor(v);
            };
            for (let i = 0; i < lobes; i++) {
                const ang = (i / lobes) * TAU + hash(i) * 0.5 + (1 - a) * 0.6;
                const rr = br * (0.3 + 0.65 * hash(i + 40));
                const size = br * (0.16 + 0.16 * hash(i + 90));
                ctx.globalAlpha = a * 0.8;
                const pick = hash(i + 7);
                ctx.fillStyle = ex.ice
                    ? (pick > 0.72 ? '#ffffff' : pick > 0.4 ? ICE_GLOW : ICE_COLOR)
                    : (pick > 0.72 ? '#fff3c4' : pick > 0.4 ? FIRE_GLOW : FIRE_COLOR);
                ctx.beginPath();
                ctx.arc(ex.x + Math.cos(ang) * rr, ex.y + Math.sin(ang) * rr, size, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        });
    }
    // Two zigzag bolts, one from above and one from below the arena, converging on
    // the player — recomputed every frame (elapsed in the seed) for a live crackle
    // instead of a static shape, same halo-then-core stroke technique already used
    // in drawBolts()/drawArrows() but as a broken path instead of a circle.
    function drawColossusBolt() {
        const t = colossusBoltT / COLOSSUS_BOLT_DUR;
        const alpha = Math.min(1, t * 2.5); // full almost instantly, then fades with t
        const progress = 1 - t; // 0 -> 1, how far into the strike we are
        // A shockwave ring expanding out from the player at the moment of impact —
        // reads as the ground itself reacting to the strike, not just the bolt.
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress) * 0.7;
        ctx.strokeStyle = LIGHTNING_GLOW;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 20 + progress * 140, 0, TAU);
        ctx.stroke();
        ctx.restore();
        const segments = 8;
        const jag = 26; // max zigzag amplitude, px
        function boltPath(x1, y1, x2, y2, seed) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            for (let i = 1; i < segments; i++) {
                const f = i / segments;
                const px = x1 + (x2 - x1) * f;
                const py = y1 + (y2 - y1) * f;
                const off = Math.sin(elapsed * 37 + seed + i * 13.1) * 0.5 * jag;
                ctx.lineTo(px + off, py);
            }
            ctx.lineTo(x2, y2);
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        [
            [player.x, -20, 11],
            [player.x, H + 20, 47],
        ].forEach(([sx, sy, seed]) => {
            ctx.strokeStyle = LIGHTNING_GLOW;
            ctx.lineWidth = 9;
            boltPath(sx, sy, player.x, player.y, seed);
            ctx.stroke();
            ctx.strokeStyle = LIGHTNING_COLOR;
            ctx.lineWidth = 3;
            boltPath(sx, sy, player.x, player.y, seed);
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawLevelFlash(colors) {
        if (levelFlash <= 0) return;
        const isBoss = flashKind === 'boss' || flashKind === 'final';
        const isReward = flashKind === 'reward';
        const flashText = flashKind === 'final' ? strings.finalBoss
            : flashKind === 'boss' ? strings.boss
            : isReward ? flashRewardText
            : typeof strings.level === 'function' ? strings.level(flashLevel) : `Level ${flashLevel}!`;
        ctx.fillStyle = isBoss ? '#e74c3c' : isReward ? LIGHTNING_GLOW : colors.text;
        ctx.textAlign = 'center';
        ctx.font = `700 ${isBoss ? 28 : 20}px system-ui, sans-serif`;
        ctx.globalAlpha = Math.min(1, levelFlash);
        ctx.fillText(flashText, W / 2, H / 2 - 40);
        ctx.globalAlpha = 1;
    }

    function drawHearts() {
        hearts.forEach((h) => {
            // Blink out the last two seconds, so a heart never vanishes unannounced.
            if (h.life < 2 && Math.floor(h.life * 8) % 2 === 0) return;
            paintSprite(ctx, HEART_FRAME, HEART_PALETTE, h.x, h.y, 2.4);
        });
    }
    function drawTreasures() {
        treasures.forEach((tr) => {
            if (tr.life < 2 && Math.floor(tr.life * 8) % 2 === 0) return;
            // Pops in over its first quarter-second instead of just appearing — reads
            // as the chest dropping onto the ground rather than fading into being. A
            // chest doesn't spin like the old gem did; a small idle bob is enough to
            // mark it as interactive.
            const age = 9 - tr.life;
            const pop = Math.min(1, age / 0.25);
            const bob = Math.sin(elapsed * 3 + tr.x) * 1.5;
            ctx.save();
            ctx.translate(tr.x, tr.y + bob);
            ctx.scale(pop, pop);
            if (tr.kind === 'big') {
                // As big as the boss that dropped it: the frame's grid spans its
                // stored radius (the boss's own r at the moment it died), not a
                // fixed scale.
                const cell = (tr.size * 2) / BIGCHEST_FRAME[0].length;
                paintSprite(ctx, BIGCHEST_FRAME, BIGCHEST_PALETTE, 0, 0, cell);
            } else {
                paintSprite(ctx, TREASURE_FRAME, TREASURE_PALETTE, 0, 0, 2.4);
            }
            ctx.restore();
        });
    }
    function drawFloaters() {
        ctx.textAlign = 'center';
        floaters.forEach((f) => {
            // Most floaters (damage numbers, heals) share the default size — the
            // treasure's upgrade icon asks for a bigger one (see its own push()) so
            // it reads as a reward, not another number lost in the usual scroll.
            ctx.font = `700 ${f.size || 13}px system-ui, sans-serif`;
            ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        });
        ctx.globalAlpha = 1;
    }
    function drawParticles() {
        particles.forEach((pt) => {
            ctx.globalAlpha = Math.max(0, pt.life / pt.dur);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        });
        ctx.globalAlpha = 1;
    }
    function drawBossBar(colors) {
        const boss = monsters.find((m) => m.type === 'boss' || m.type === 'finalBoss');
        if (!boss) return;
        const isFinal = boss.type === 'finalBoss';
        const bw = Math.min(280, W - 40);
        const bx = (W - bw) / 2;
        const by = 12;
        ctx.fillStyle = colors.inkFaint;
        ctx.fillRect(bx, by, bw, 8);
        ctx.fillStyle = isFinal ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 8);
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(isFinal ? strings.finalBossBar : strings.bossBar, W / 2, by + 22);
    }

    // A flat single-colour floor reads as generic — this arena instead reads as a
    // fire-lit dungeon: a warm glow rising from the centre (the same ember orange
    // the fireball and bolts already use), a stone floor with a per-tile shade
    // variation, and a dark vignette toward the edges. Built once onto an offscreen
    // canvas and cached per (W, H, theme) rather than replayed every frame — a
    // gradient plus a grid of tile fills is not free, and none of it ever changes
    // between resizes, so paying for it 60 times a second would be wasted work;
    // draw() below just blits the cached bitmap.
    let bgCache = null;
    function buildArenaBackground(colors) {
        if (bgCache && bgCache.w === W && bgCache.h === H && bgCache.light === colors.light) {
            return bgCache.canvas;
        }
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const octx = off.getContext('2d');

        octx.fillStyle = colors.bg;
        octx.fillRect(0, 0, W, H);
        const glow = octx.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, Math.max(W, H) * 0.75);
        const warm = blendHex(colors.bg, FIRE_COLOR, colors.light ? 0.1 : 0.16);
        glow.addColorStop(0, warm);
        glow.addColorStop(1, colors.bg);
        octx.fillStyle = glow;
        octx.fillRect(0, 0, W, H);

        // Stone floor: a grid of tiles, each a touch lighter or darker than its
        // neighbours, with a thin gap between them standing in for mortar lines.
        // Each tile's corners are nudged by a small random jitter — a perfect grid
        // reads as mechanical/generated; the jitter reads as flagstones actually
        // laid by hand. Seeded (not Math.random()) so the pattern doesn't visibly
        // reshuffle if ever rebuilt at the same size — a plain LCG is plenty for a
        // shading dice roll, no need to pull in a real RNG for this.
        const TILE = 56;
        const JITTER = 3;
        let seed = 1337;
        const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        const jit = () => (rand() - 0.5) * JITTER * 2;
        const darkStone = blendHex(colors.bg, '#000000', 0.3);
        octx.save();
        octx.globalAlpha = colors.light ? 0.05 : 0.09;
        for (let y = 0; y < H; y += TILE) {
            for (let x = 0; x < W; x += TILE) {
                const roll = rand();
                octx.fillStyle = roll > 0.66 ? colors.ink : roll > 0.33 ? colors.bg : darkStone;
                octx.beginPath();
                octx.moveTo(x + 1 + jit(), y + 1 + jit());
                octx.lineTo(x + TILE - 1 + jit(), y + 1 + jit());
                octx.lineTo(x + TILE - 1 + jit(), y + TILE - 1 + jit());
                octx.lineTo(x + 1 + jit(), y + TILE - 1 + jit());
                octx.closePath();
                octx.fill();
            }
        }
        octx.restore();

        // Cracks: a handful of jagged lines wandering across a few tiles each —
        // the single detail that reads unmistakably as "old stone floor" rather
        // than just a tiled texture. Kept out of the middle of the arena (where
        // the player actually stands) so they stay set dressing, not something
        // fought on top of.
        const CRACK_COUNT = 5;
        octx.save();
        octx.strokeStyle = darkStone;
        octx.lineWidth = 1.5;
        octx.globalAlpha = colors.light ? 0.18 : 0.28;
        const midX0 = W * 0.3, midX1 = W * 0.7, midY0 = H * 0.3, midY1 = H * 0.7;
        for (let i = 0; i < CRACK_COUNT; i++) {
            let cx, cy;
            do {
                cx = rand() * W;
                cy = rand() * H;
            } while (cx > midX0 && cx < midX1 && cy > midY0 && cy < midY1);
            octx.beginPath();
            octx.moveTo(cx, cy);
            const segments = 3 + Math.floor(rand() * 3);
            let angle = rand() * Math.PI * 2;
            for (let s = 0; s < segments; s++) {
                angle += (rand() - 0.5) * 1.2;
                cx += Math.cos(angle) * TILE * 0.7;
                cy += Math.sin(angle) * TILE * 0.7;
                octx.lineTo(cx, cy);
            }
            octx.stroke();
        }
        octx.restore();

        // Cave rock creeping in from each corner — the detail that says "you're
        // in a monster's lair", not just "warm floor". Kept small (a fraction of
        // the shorter side) and low-opacity so the playable centre never loses
        // any contrast against monsters/bolts/HUD.
        const rockSpan = Math.min(W, H) * 0.14;
        octx.save();
        octx.fillStyle = colors.ink;
        octx.globalAlpha = colors.light ? 0.08 : 0.12;
        const corners = [
            { x: 0, y: 0, sx: 1, sy: 1 },
            { x: W, y: 0, sx: -1, sy: 1 },
            { x: W, y: H, sx: -1, sy: -1 },
            { x: 0, y: H, sx: 1, sy: -1 },
        ];
        for (const c of corners) {
            octx.beginPath();
            octx.moveTo(c.x, c.y);
            octx.lineTo(c.x + c.sx * rockSpan * 1.4, c.y);
            octx.lineTo(c.x + c.sx * rockSpan * 0.9, c.y + c.sy * rockSpan * 0.4);
            octx.lineTo(c.x + c.sx * rockSpan * 1.1, c.y + c.sy * rockSpan * 0.7);
            octx.lineTo(c.x + c.sx * rockSpan * 0.5, c.y + c.sy * rockSpan * 0.9);
            octx.lineTo(c.x, c.y + c.sy * rockSpan * 1.4);
            octx.closePath();
            octx.fill();
        }
        octx.restore();

        // Vignette: darkens toward the edges so the lit centre (where the action
        // happens) reads as a pool of torchlight rather than an evenly lit box.
        const vignette = octx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(1, colors.light ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.35)');
        octx.fillStyle = vignette;
        octx.fillRect(0, 0, W, H);

        bgCache = { w: W, h: H, light: colors.light, canvas: off };
        return off;
    }

    function draw() {
        const colors = themeColors();
        ctx.drawImage(buildArenaBackground(colors), 0, 0);
        // Everything inside the arena shakes together; the HUD drawn after does not.
        const shaking = shake > 0 && state === 'playing';
        const sx = shaking ? (Math.random() - 0.5) * shake : 0;
        const sy = shaking ? (Math.random() - 0.5) * shake : 0;
        ctx.save();
        ctx.translate(sx, sy);
        drawHearts();
        drawTreasures();
        drawMonsters(colors);
        drawFamiliar(colors);
        drawBolts();
        drawArrows();
        drawArrowArcs();
        drawSwordBolts();
        drawExplosions(colors);
        drawParticles();
        if (state !== 'over' && state !== 'won') drawPlayer(colors);
        if (colossusBoltT > 0) drawColossusBolt();
        drawFloaters();
        ctx.restore();
        if (screenFlash > 0) {
            ctx.fillStyle = `rgba(249, 202, 36, ${(screenFlash / 0.22) * 0.16})`;
            ctx.fillRect(0, 0, W, H);
        }
        if (hurtFlash > 0) {
            // A red rim rather than a full wash: it reads as "you took that" without
            // hiding the arena at the exact moment you need to see it.
            const a = (hurtFlash / 0.45) * 0.5;
            const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.62);
            grad.addColorStop(0, 'rgba(231, 76, 60, 0)');
            grad.addColorStop(1, `rgba(231, 76, 60, ${a})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }
        drawBossBar(colors);
        drawLevelFlash(colors);

        if (state === 'ready') {
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'center';
            ctx.font = '600 15px system-ui, sans-serif';
            ctx.fillText(strings.start, W / 2, H / 2);
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
            else if (state !== 'choosing') start();
        },
        meleeRelease,
        ultimateAttack() {
            if (state === 'playing') ultimateAttack();
            else if (state !== 'choosing') start();
        },
        bowAttack() {
            if (state === 'playing') bowAttack();
            else if (state !== 'choosing') start();
        },
        chooseUpgrade,
        resize,
        // The page's stick hands the direction over here: -1..1 per axis, or null on
        // release. Everything downstream (speed, facing, the walk cycle) is unchanged.
        setStick(x, y) {
            if (x === null || x === undefined) {
                stick = null;
                return;
            }
            const len = Math.hypot(x, y);
            if (len < 0.001) {
                stick = null;
                return;
            }
            const mag = Math.min(1, len);
            stick = { x: (x / len) * mag, y: (y / len) * mag };
        },
        setStrings(next) {
            strings = Object.assign({}, DEFAULT_STRINGS, next || {});
        },
        isMuted() {
            return muted;
        },
        setMuted(value) {
            muted = !!value;
            writeFlag(MUTE_KEY, muted);
            return muted;
        },
        hasWon() {
            return hasWon;
        },
        // A read-only snapshot for scripted testing/tooling (Playwright bots driving
        // the run with real perception instead of guessing screen coordinates) — not
        // called from the page itself. Cheap enough to leave in permanently: a few
        // reference copies, no behaviour change either way.
        //
        // frozenFor reports whether update() is about to no-op and, if so, for how
        // much more real time — familiarAnnounce (see below) holds the whole arena,
        // player included, for FAMILIAR_ANNOUNCE_DURATION seconds regardless of
        // `state`. A caller driving the run one short turn at a time (each turn only
        // unpauses for its own `ms`) can otherwise read several turns in a row as
        // "nothing responded", when the truth is a banner is mid-freeze and will let
        // go on its own — worth knowing before spending more turns on it.
        _debugState() {
            const frozenFor = familiarAnnounce
                ? Math.max(0, FAMILIAR_ANNOUNCE_DURATION - familiarAnnounce.t)
                : 0;
            return { player, monsters, treasures, hearts, elapsed, W, H, frozenFor };
        },
        // For the page to freeze the arena for a reason of its own (the portrait
        // rotate-prompt covering the canvas) — independent of `state`, same as
        // familiarAnnounce/finalBossDeath above; it just needs an external trigger
        // since the page, not the engine, knows when its own overlay is covering play.
        setPaused(value) {
            externalPause = !!value;
        },
        // The record only, not the separate "won at least once" star (WON_KEY) —
        // that's its own achievement, not part of the stat record.
        resetRecord() {
            bestLevel = 1;
            writeBestLevel(bestLevel);
            writeBestRecord(null);
            pushStats();
        },
        finalLevel: FINAL_LEVEL,
        destroy() {
            if (rafId) cancelAnimationFrame(rafId);
            stopMusic();
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            canvas.removeEventListener('pointerdown', handlePointerDown);
        },
    };
}
