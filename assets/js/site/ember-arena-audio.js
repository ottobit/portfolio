// Synthesised sound effects for the arena — same approach as mascot.js: no
// files to load, and the AudioContext is only created once something
// actually asks for a sound (can't happen before the player presses start).
// Split out of ember-arena-game.js since none of this depends on a running
// game instance.

let audioCtx = null;
export function getAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// iOS Safari only treats a tap as having unlocked the audio session on the
// gesture's *completion* event (touchend/click/keydown) — a context created
// or resumed from pointerdown alone, which is what the arena's own "tap to
// start" hooks into, can end up stuck silent on iPhone even while its own
// .state reports "running". Re-touching the (already-created, idempotent)
// context from one of these events, once, is the standard unlock workaround.
// Harmless everywhere else: on desktop/Android this just calls resume() on
// an already-running context.
['touchend', 'mousedown', 'click', 'keydown'].forEach((type) => {
    window.addEventListener(type, () => getAudioCtx(), { capture: true, once: true });
});

export function chirp({ from, to, duration, type = 'square', gain = 0.05, delay = 0 }) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
    vol.gain.setValueAtTime(gain, t0);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
}

export function noiseBurst(duration, gain, filterFreq, delay = 0) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const vol = ctx.createGain();
    vol.gain.value = gain;
    src.connect(filter).connect(vol).connect(ctx.destination);
    src.start(ctx.currentTime + delay);
}
