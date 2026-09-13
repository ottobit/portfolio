// localStorage read/write for the arena's persisted state (best level, full
// record, win flag, mute flag) — split out of ember-arena-game.js since none
// of this depends on a running game instance.

export const BEST_LEVEL_KEY = 'emberKeepBestLevel';
export const RECORD_KEY = 'emberKeepRecord';
export const WON_KEY = 'emberKeepWon';
export const MUTE_KEY = 'emberKeepMuted';

export function readFlag(key) {
    try {
        return localStorage.getItem(key) === '1';
    } catch (e) {
        return false;
    }
}
export function writeFlag(key, value) {
    try {
        localStorage.setItem(key, value ? '1' : '0');
    } catch (e) {}
}

export function readBestLevel() {
    try {
        return parseInt(localStorage.getItem(BEST_LEVEL_KEY), 10) || 1;
    } catch (e) {
        return 1;
    }
}
export function writeBestLevel(level) {
    try {
        localStorage.setItem(BEST_LEVEL_KEY, String(level));
    } catch (e) {}
}
// The record run's full detail — monsters killed, time, hits, and the final
// stats its upgrades added up to — kept alongside the plain bestLevel number
// so the fast "best" read in onStatsChange doesn't need to parse JSON every
// frame. `null` clears it (see resetRecord).
export function writeBestRecord(record) {
    try {
        if (record) localStorage.setItem(RECORD_KEY, JSON.stringify(record));
        else localStorage.removeItem(RECORD_KEY);
    } catch (e) {}
}
