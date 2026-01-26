---
name: procedural-music
description: Generate procedural music using the Web Audio API. Use when asked to create synthesized music, 8-bit audio, game music, or sound effects without external audio files.
---

# Procedural Music Generator

Generate real-time synthesized music using the Web Audio API. All sounds are created mathematically - no audio files needed.

## Core Architecture

Always structure the music player as an object with these components:

```javascript
const musicPlayer = {
  audioContext: null,
  masterGain: null,
  analyser: null,        // Optional: for visualizers
  isPlaying: false,
  intervalIds: [],       // Track step sequencer intervals
  activeOscillators: [], // Track nodes for cleanup

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  },

  stop() {
    this.isPlaying = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    this.activeOscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    this.activeOscillators = [];
  }
};
```

## Note Frequencies Reference

Common frequencies (Hz) for musical notes:

| Note | Freq | Note | Freq | Note | Freq |
|------|------|------|------|------|------|
| C3   | 131  | C4   | 262  | C5   | 523  |
| D3   | 147  | D4   | 294  | D5   | 587  |
| E3   | 165  | E4   | 330  | E5   | 659  |
| F3   | 175  | F4   | 349  | F5   | 698  |
| G3   | 196  | G4   | 392  | G5   | 784  |
| A3   | 220  | A4   | 440  | A5   | 880  |
| B3   | 247  | B4   | 494  | B5   | 988  |

Use `0` in note arrays to indicate rests/silence.

## Instrument Functions

### Basic Note (Lead/Melody/Bass)

```javascript
playNote(freq, type, volume, duration, startTime) {
  const ctx = this.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type; // 'square', 'sawtooth', 'triangle', 'sine'
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(this.masterGain);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);

  osc.start(startTime);
  osc.stop(startTime + duration);
  this.activeOscillators.push(osc);
}
```

**Waveform guide:**
- `square` - Chiptune/8-bit lead, punchy
- `sawtooth` - Rich harmonics, good for bass and synth leads
- `triangle` - Softer, good for arpeggios and pads
- `sine` - Pure tone, good for sub-bass and soft melodies

### Kick Drum

```javascript
playKick(startTime) {
  const ctx = this.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, startTime);
  osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.1);

  gain.gain.setValueAtTime(0.4, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

  osc.connect(gain);
  gain.connect(this.masterGain);
  osc.start(startTime);
  osc.stop(startTime + 0.15);
  this.activeOscillators.push(osc);
}
```

### Snare Drum

Two components: noise (the "snap") + tone (the body):

```javascript
playSnare(startTime) {
  const ctx = this.audioContext;

  // Noise component (white noise through highpass filter)
  const bufferSize = ctx.sampleRate * 0.1;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.15, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(this.masterGain);
  noise.start(startTime);
  noise.stop(startTime + 0.1);

  // Tone component
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, startTime);
  osc.frequency.exponentialRampToValueAtTime(50, startTime + 0.05);
  oscGain.gain.setValueAtTime(0.15, startTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
  osc.connect(oscGain);
  oscGain.connect(this.masterGain);
  osc.start(startTime);
  osc.stop(startTime + 0.08);

  this.activeOscillators.push(noise, osc);
}
```

### Hi-Hat (Closed and Open)

```javascript
playHiHat(startTime, open = false) {
  const ctx = this.audioContext;
  const bufferSize = ctx.sampleRate * (open ? 0.15 : 0.05);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(open ? 0.08 : 0.06, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + (open ? 0.15 : 0.05));

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000; // High frequency = metallic sound

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(this.masterGain);
  noise.start(startTime);
  noise.stop(startTime + (open ? 0.15 : 0.05));

  this.activeOscillators.push(noise);
}
```

### Pad (Ambient/Atmospheric)

Slow attack and release for smooth sustained sounds:

```javascript
playPad(freq, type, volume, duration, startTime) {
  const ctx = this.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(this.masterGain);

  const attackTime = 0.3;
  const releaseTime = 0.5;

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + attackTime);
  gain.gain.setValueAtTime(volume, startTime + duration - releaseTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
  this.activeOscillators.push(osc);
}
```

### String (with Vibrato)

```javascript
playString(freq, volume, duration, startTime) {
  const ctx = this.audioContext;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  // Vibrato LFO
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();
  vibrato.type = 'sine';
  vibrato.frequency.value = 5; // 5Hz vibrato rate
  vibratoGain.gain.value = freq * 0.02; // 2% pitch variation
  vibrato.connect(vibratoGain);
  vibratoGain.connect(osc.frequency);

  // Lowpass filter for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;

  const gain = ctx.createGain();
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(this.masterGain);

  const attackTime = 0.15;
  const releaseTime = 0.2;

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + attackTime);
  gain.gain.setValueAtTime(volume, startTime + duration - releaseTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  vibrato.start(startTime);
  vibrato.stop(startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);

  this.activeOscillators.push(osc, vibrato);
}
```

## Step Sequencer Pattern

Use `setInterval` to step through note arrays:

```javascript
playTrack() {
  const ctx = this.audioContext;
  const tempo = 140; // BPM
  const beatDuration = 60 / tempo;
  const stepDuration = beatDuration / 4; // 16th notes

  // Note arrays (0 = rest)
  const melody = [392, 0, 523, 0, 392, 523, 659, 0];
  const bass = [131, 0, 131, 131, 165, 0, 165, 165];
  const drums = ['K', 'H', 'H', 'H', 'S', 'H', 'K', 'H'];
  // K=kick, S=snare, H=hihat, O=open hihat

  let step = 0;

  const playStep = () => {
    if (!this.isPlaying) return;

    const now = ctx.currentTime;
    const idx = step % melody.length;

    // Play melody
    if (melody[idx] > 0) {
      this.playNote(melody[idx], 'square', 0.08, stepDuration * 0.8, now);
    }

    // Play bass
    if (bass[idx] > 0) {
      this.playNote(bass[idx], 'sawtooth', 0.12, stepDuration * 0.7, now);
    }

    // Play drums
    const drum = drums[idx];
    if (drum === 'K') this.playKick(now);
    if (drum === 'S') this.playSnare(now);
    if (drum === 'H') this.playHiHat(now, false);
    if (drum === 'O') this.playHiHat(now, true);

    step++;
  };

  playStep();
  this.intervalIds.push(setInterval(playStep, stepDuration * 1000));
}
```

## Genre Presets

### Upbeat/Arcade (140 BPM)
- Lead: square wave, short notes
- Bass: sawtooth, staccato
- Drums: standard rock pattern (K-H-H-H-S-H-K-H)
- Add arpeggios with triangle waves

### Ambient/Mysterious (slow, no fixed BPM)
- Use `playPad()` for long sustained chords
- Layer multiple frequencies for richness
- Use chord progressions: minor chords work well
- Occasional melody notes with sine waves

### Intense/Action (160+ BPM)
- Fast tempo, 8th or 16th note leads
- Heavy kick on every beat
- Sawtooth leads for energy
- Dense hi-hat patterns

## Volume Guidelines

Keep volumes balanced to prevent clipping:
- Lead melody: 0.06-0.10
- Bass: 0.10-0.15
- Kick: 0.3-0.4
- Snare: 0.15
- Hi-hat: 0.05-0.08
- Pads: 0.03-0.06
- Strings: 0.05-0.08

## Tips

1. Always call `init()` before playing
2. Always call `stop()` before starting a new track
3. Use `exponentialRampToValueAtTime` for natural-sounding envelopes (never ramp to 0, use 0.001)
4. Track all oscillators in `activeOscillators` for proper cleanup
5. Use the `webkitAudioContext` fallback for Safari compatibility
6. For visualizers, expose the `analyser` node and use `getByteFrequencyData()`
