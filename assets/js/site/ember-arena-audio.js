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
