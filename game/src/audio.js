// Sound, all synthesised with WebAudio — no audio files, no network. SFX are short
// oscillator/noise bursts; the music is a quiet ambient loop (a low drone plus a slow
// pentatonic arpeggio) scheduled a little ahead of time. The AudioContext is created lazily
// on the first user gesture, and M toggles the master gain.

const MUSIC_NOTES = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const MUSIC_PATTERN = [0, 2, 4, 3, 5, 4, 2, 6, 4, 1, 3, 5];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let drone = null;
  let muted = false;

  function ensure() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (ctx === null || muted) return;
    const t0 = ctx.currentTime + (delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, delay) {
    if (ctx === null || muted) return;
    const t0 = ctx.currentTime + (delay ?? 0);
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  function startMusic() {
    if (ctx === null || musicTimer !== null) return;
    // A low drone underneath everything.
    drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = 55;
    droneGain.gain.value = 0.05;
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    // One soft pluck every 0.45 s, walking the pattern, with a fifth above every 4th step.
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = MUSIC_NOTES[MUSIC_PATTERN[musicStep % MUSIC_PATTERN.length]];
      tone(note, 1.4, 'sine', 0.07);
      if (musicStep % 4 === 3) tone(note * 1.5, 1.2, 'triangle', 0.04);
      musicStep += 1;
    }, 450);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
    if (drone !== null) {
      try { drone.stop(); } catch { /* already stopped */ }
      drone = null;
    }
  }

  return {
    get muted() { return muted; },
    ensure,
    startMusic,
    stopMusic,
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() { tone(880, 0.07, 'square', 0.05, 440); },
    hit() { noise(0.08, 0.08); },
    kill() { tone(220, 0.18, 'sawtooth', 0.08, 55); noise(0.15, 0.1); },
    gem() { tone(1320, 0.09, 'sine', 0.06, 1760); },
    levelup() {
      tone(523.25, 0.12, 'triangle', 0.1);
      tone(659.25, 0.12, 'triangle', 0.1, undefined, 0.09);
      tone(783.99, 0.22, 'triangle', 0.1, undefined, 0.18);
    },
    hurt() { tone(140, 0.25, 'sawtooth', 0.14, 60); noise(0.12, 0.12); },
    boss() { tone(98, 0.5, 'sawtooth', 0.12, 65); tone(147, 0.5, 'sawtooth', 0.08, 98, 0.1); },
    win() {
      for (let i = 0; i < 5; i += 1) tone(523.25 * (1 + i * 0.125), 0.3, 'triangle', 0.09, undefined, i * 0.12);
    },
    lose() {
      tone(330, 0.4, 'sawtooth', 0.1, 110);
      tone(220, 0.6, 'sawtooth', 0.1, 55, 0.3);
    },
    click() { tone(660, 0.05, 'sine', 0.06); },
  };
}
