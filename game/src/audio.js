// Synthesised sound only — no audio files, no network. A WebAudio
// engine hum whose pitch follows the throttle, wind noise that grows
// with speed, a two-note chime for each ring, a soft thud on touchdown.
// Created lazily on the first user gesture (browsers demand that).
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      // Wind: looped white noise through a band-pass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function update(throttle, speed, onGround) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(48 + throttle * 95, t, 0.1);
    engineGain.gain.setTargetAtTime(onGround ? 0.015 + throttle * 0.03 : 0.03 + throttle * 0.05, t, 0.15);
    const wind = Math.max(0, (speed - 20) / 90) * (onGround ? 0.3 : 1);
    windGain.gain.setTargetAtTime(wind * 0.10, t, 0.2);
    windFilter.frequency.setTargetAtTime(400 + speed * 9, t, 0.2);
  }

  function blip(freq, when, dur, vol, type = 'sine') {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + when);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + when);
    o.stop(ctx.currentTime + when + dur + 0.05);
  }

  return {
    resume,
    update,
    ring() { blip(880, 0, 0.35, 0.16); blip(1318, 0.09, 0.5, 0.14); },
    land() { blip(140, 0, 0.25, 0.2, 'triangle'); },
    crash() { blip(70, 0, 0.6, 0.25, 'sawtooth'); },
    click() { blip(660, 0, 0.08, 0.08); },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        engineGain.gain.value = 0;
        windGain.gain.value = 0;
      }
      return muted;
    },
    get isMuted() { return muted; },
  };
}
