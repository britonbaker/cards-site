// ============================================
// 8-BIT MUSIC PLAYER
// ============================================

const musicPlayer = {
  audioContext: null,
  masterGain: null,
  outputGain: null,
  analyser: null,
  isPlaying: false,
  isMuted: false,
  intervalIds: [],
  activeOscillators: [],

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      // Create master gain, analyser, and output gain
      // Route: instruments -> masterGain -> analyser -> outputGain -> destination
      // This lets us mute at outputGain while keeping analyser active for visualizer
      this.masterGain = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      this.outputGain = this.audioContext.createGain();
      this.analyser.fftSize = 64;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.outputGain);
      this.outputGain.connect(this.audioContext.destination);
    }
  },

  setMuted(muted) {
    this.isMuted = muted;
    if (this.outputGain) {
      this.outputGain.gain.value = muted ? 0 : this.volume;
    }
  },

  volume: 1,
  
  setVolume(vol) {
    this.volume = vol;
    if (this.outputGain && !this.isMuted) {
      this.outputGain.gain.value = vol;
    }
  },

  // Play a single note
  playNote(freq, type, volume, duration, startTime) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.activeOscillators.push(osc);
  },

  // Play kick drum
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
  },

  // Play snare drum
  playSnare(startTime) {
    const ctx = this.audioContext;

    // Noise component
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
  },

  // Play hi-hat
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
    filter.frequency.value = 7000;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(startTime);
    noise.stop(startTime + (open ? 0.15 : 0.05));

    this.activeOscillators.push(noise);
  },

  // Play a string/violin-like sound with vibrato
  playString(freq, volume, duration, startTime) {
    const ctx = this.audioContext;

    // Main oscillator - sawtooth for rich harmonics
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
    filter.Q.value = 1;

    // Gain envelope
    const gain = ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // String-like envelope: slow attack, sustain, gentle release
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
  },

  // Cube Runner - Full band with drums
  playCubeRunner() {
    const ctx = this.audioContext;
    const tempo = 140;
    const beatDuration = 60 / tempo;
    const barDuration = beatDuration * 4;

    // Lead melody (16 steps per bar)
    const leadNotes = [
      392, 0, 523, 0, 392, 523, 659, 0,
      587, 0, 523, 0, 392, 0, 330, 0,
      392, 0, 523, 0, 659, 0, 784, 659,
      587, 523, 392, 0, 330, 0, 262, 0
    ];

    // Bass line (16 steps)
    const bassNotes = [
      131, 0, 131, 131, 165, 0, 165, 165,
      147, 0, 147, 147, 131, 0, 131, 0,
      131, 0, 131, 131, 165, 0, 165, 165,
      147, 0, 147, 147, 131, 131, 98, 0
    ];

    // Arpeggio (16 steps)
    const arpNotes = [
      262, 330, 392, 330, 262, 330, 392, 523,
      294, 349, 440, 349, 262, 330, 392, 330,
      262, 330, 392, 330, 330, 392, 523, 659,
      294, 349, 440, 349, 262, 330, 392, 262
    ];

    // Drum pattern (16 steps): K=kick, S=snare, H=hihat, O=open hihat
    const drums = ['K', 'H', 'H', 'H', 'S', 'H', 'K', 'H', 'K', 'H', 'H', 'H', 'S', 'H', 'O', 'H'];

    // String counter-melody (8 steps per 2 bars - longer sustained notes)
    const stringNotes = [
      784, 0, 659, 0, 587, 0, 523, 0,  // High G, E, D, C
      659, 0, 784, 0, 880, 0, 784, 0   // E, G, A, G
    ];

    let step = 0;
    const stepDuration = barDuration / 16;

    const playStep = () => {
      if (!this.isPlaying) return;

      const now = ctx.currentTime;
      const idx = step % 32; // Pattern is 2 bars
      const drumIdx = step % 16;

      // Lead
      if (leadNotes[idx] > 0) {
        this.playNote(leadNotes[idx], 'square', 0.08, stepDuration * 0.8, now);
      }

      // Bass
      if (bassNotes[idx] > 0) {
        this.playNote(bassNotes[idx], 'sawtooth', 0.12, stepDuration * 0.7, now);
      }

      // Arpeggio
      if (arpNotes[idx] > 0) {
        this.playNote(arpNotes[idx], 'triangle', 0.05, stepDuration * 0.5, now);
      }

      // Drums
      const drum = drums[drumIdx];
      if (drum === 'K') this.playKick(now);
      if (drum === 'S') this.playSnare(now);
      if (drum === 'H') this.playHiHat(now, false);
      if (drum === 'O') this.playHiHat(now, true);

      // Strings - play every 4 steps (quarter notes) for sustained feel
      if (step % 4 === 0) {
        const stringIdx = (step / 4) % stringNotes.length;
        if (stringNotes[stringIdx] > 0) {
          this.playString(stringNotes[stringIdx], 0.06, stepDuration * 3.5, now);
        }
      }

      step++;
    };

    playStep();
    this.intervalIds.push(setInterval(playStep, stepDuration * 1000));
  },

  // Ring World - Mysterious, spacey with long harmonies
  playRingWorld() {
    const ctx = this.audioContext;
    const chordDuration = 2.5; // Long sustained chords

    // Chord progressions (each chord is an array of frequencies)
    const chords = [
      [196, 247, 294],       // G minor
      [175, 220, 262],       // F major
      [165, 208, 247],       // E minor
      [147, 185, 220],       // D minor
      [165, 208, 247],       // E minor
      [175, 220, 262],       // F major
      [196, 247, 294],       // G minor
      [220, 277, 330],       // A minor
    ];

    // High melody notes - expanded with more movement
    const melodyNotes = [587, 659, 523, 587, 494, 440, 494, 523, 587, 784, 659, 587];

    // Counter melody - lower register, answers the main melody
    const counterMelody = [294, 330, 262, 294, 247, 220, 247, 262];

    // Shimmer notes - very high, sparse, ethereal
    const shimmerNotes = [1175, 1318, 1047, 1175, 988, 880, 988, 1047];

    let chordIndex = 0;
    let melodyIndex = 0;
    let counterIndex = 0;
    let shimmerIndex = 0;

    const playChord = () => {
      if (!this.isPlaying) return;
      const now = ctx.currentTime;
      const chord = chords[chordIndex];

      // Play each note in the chord with slight timing offsets for warmth
      chord.forEach((freq, i) => {
        // Low pad (triangle wave)
        this.playPad(freq, 'triangle', 0.06, chordDuration * 0.95, now + i * 0.02);
        // Higher octave pad (sine wave, quieter)
        this.playPad(freq * 2, 'sine', 0.025, chordDuration * 0.9, now + i * 0.03);
      });

      // Main melody - plays on most chords now
      if (chordIndex % 2 === 0 || chordIndex === 3 || chordIndex === 7) {
        this.playPad(melodyNotes[melodyIndex], 'sine', 0.04, chordDuration * 0.6, now + 0.3);
        melodyIndex = (melodyIndex + 1) % melodyNotes.length;
      }

      // Counter melody - plays on off-beats, lower and softer
      if (chordIndex % 2 === 1) {
        this.playPad(counterMelody[counterIndex], 'triangle', 0.03, chordDuration * 0.5, now + 0.8);
        counterIndex = (counterIndex + 1) % counterMelody.length;
      }

      // Shimmer - very quiet, high sparkle notes (every 3rd chord)
      if (chordIndex % 3 === 0) {
        this.playPad(shimmerNotes[shimmerIndex], 'sine', 0.015, chordDuration * 0.4, now + 1.2);
        shimmerIndex = (shimmerIndex + 1) % shimmerNotes.length;
      }

      chordIndex = (chordIndex + 1) % chords.length;
    };

    // Subtle percussion - soft kicks and hats
    let drumStep = 0;
    const playDrums = () => {
      if (!this.isPlaying) return;
      const now = ctx.currentTime;

      // Soft kick every 4 beats
      if (drumStep % 8 === 0) {
        this.playKick(now);
      }

      // Soft hi-hat pattern
      if (drumStep % 2 === 1) {
        this.playHiHat(now, drumStep % 8 === 7); // Open hat occasionally
      }

      drumStep++;
    };

    playChord();
    this.intervalIds.push(setInterval(playChord, chordDuration * 1000));
    // Drums - 8 hits per chord cycle
    this.intervalIds.push(setInterval(playDrums, (chordDuration / 8) * 1000));
  },

  // Play a pad sound with slow attack and release
  playPad(freq, type, volume, duration, startTime) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.masterGain);

    // Slow attack, sustain, slow release
    const attackTime = 0.3;
    const releaseTime = 0.5;

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + attackTime);
    gain.gain.setValueAtTime(volume, startTime + duration - releaseTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.activeOscillators.push(osc);
  },

  // Crystal Core - Energetic, intense
  playCrystalCore() {
    const ctx = this.audioContext;
    const tempo = 160;
    const stepDuration = (60 / tempo) / 2;

    const notes = [330, 392, 494, 392, 330, 294, 330, 392, 494, 587, 494, 392];
    let step = 0;

    const playStep = () => {
      if (!this.isPlaying) return;
      const now = ctx.currentTime;
      const noteIdx = step % notes.length;

      this.playNote(notes[noteIdx], 'sawtooth', 0.08, stepDuration * 0.7, now);

      // Add kick on every 4th step
      if (step % 4 === 0) this.playKick(now);
      // Add snare on every 8th step offset by 4
      if (step % 8 === 4) this.playSnare(now);
      // Hi-hat on every other step
      if (step % 2 === 1) this.playHiHat(now);

      step++;
    };

    playStep();
    this.intervalIds.push(setInterval(playStep, stepDuration * 1000));
  },

  play(gameIndex) {
    this.init();
    this.stop();
    this.isPlaying = true;

    switch (gameIndex) {
      case 0:
        this.playCubeRunner();
        break;
      case 1:
        this.playRingWorld();
        break;
      case 2:
        this.playCrystalCore();
        break;
      default:
        this.playCubeRunner();
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

// ============================================
// MUSIC VISUALIZER
// ============================================

const visualizerController = {
  animationId: null,
  bars: null,
  slotGlow: null,
  slotBarGradient: null,
  activeCard: null,

  start(cardIndex) {
    if (!musicPlayer.analyser) return;

    this.bars = document.querySelectorAll('.visualizer-bar');
    this.slotGlow = document.querySelector('.slot-glow');
    this.slotBarGradient = document.querySelector('.slot-bar-gradient');

    // Activate glow on the card
    this.activeCard = document.querySelector(`.card[data-index="${cardIndex}"]`);
    if (this.activeCard) {
      this.activeCard.classList.add('active-glow');
    }

    // Set glow color based on card
    if (this.slotGlow) {
      this.slotGlow.classList.remove('glow-green', 'glow-yellow', 'glow-red');
      const colorClass = ['glow-green', 'glow-yellow', 'glow-red'][cardIndex] || 'glow-green';
      this.slotGlow.classList.add(colorClass);
      this.slotGlow.classList.add('visible');
    }

    // Show gradient slot bar
    if (this.slotBarGradient) {
      this.slotBarGradient.classList.add('visible');
    }

    const analyser = musicPlayer.analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);

      // Map frequency bands to bars (pick specific frequencies for each bar)
      const bands = [2, 4, 6, 8, 10]; // Low to high frequency indices

      if (this.bars.length) {
        this.bars.forEach((bar, i) => {
          const value = dataArray[bands[i]] || 0;
          const scale = 0.3 + (value / 255) * 0.7; // Min 30%, max 100%
          bar.style.transform = `scaleY(${scale})`;
        });
      }

      // Animate slot glow based on bass frequencies (low end)
      if (this.slotGlow) {
        // Average of low frequencies for bass response
        const bassValue = (dataArray[1] + dataArray[2] + dataArray[3]) / 3;
        const glowOpacity = 0.5 + (bassValue / 255) * 0.5; // Opacity from 0.5 to 1.0
        this.slotGlow.style.setProperty('--glow-opacity', glowOpacity);
      }

      this.animationId = requestAnimationFrame(update);
    };

    update();
  },

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Reset bars to idle animation
    if (this.bars) {
      this.bars.forEach(bar => {
        bar.style.transform = '';
      });
    }

    // Hide and reset slot glow
    if (this.slotGlow) {
      this.slotGlow.classList.remove('visible');
      this.slotGlow.style.removeProperty('--glow-opacity');
    }

    // Hide gradient slot bar
    if (this.slotBarGradient) {
      this.slotBarGradient.classList.remove('visible');
    }

    // Remove glow from card
    if (this.activeCard) {
      this.activeCard.classList.remove('active-glow');
      this.activeCard = null;
    }
  }
};

// ============================================
// SOUND EFFECTS
// ============================================

const sfx = {
  audioContext: null,
  isMuted: false,

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  setMuted(muted) {
    this.isMuted = muted;
  },

  playSlotClick(volume = 1.0, pitch = 1.0) {
    if (this.isMuted) return;
    this.init();

    const ctx = this.audioContext;

    // Create a short noise burst + tone for satisfying click
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    // Quick attack, fast decay
    gainNode.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
    gainNode.gain.exponentialDecayTo = 0.01;
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    // Low thud oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(150 * pitch, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(50 * pitch, ctx.currentTime + 0.1);
    osc1.connect(gainNode);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.1);

    // Higher click oscillator - sharper and clickier
    const gainNode2 = ctx.createGain();
    gainNode2.connect(ctx.destination);
    gainNode2.gain.setValueAtTime(0.25 * volume, ctx.currentTime);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1200 * pitch, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(300 * pitch, ctx.currentTime + 0.03);
    osc2.connect(gainNode2);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.03);
  },

  // Subtle tick for anticipation/settle
  playSoftClick(volume = 1.0, pitch = 1.0) {
    if (this.isMuted) return;
    this.init();

    const ctx = this.audioContext;

    // Softer but clicky sound
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0.18 * volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.025);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900 * pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200 * pitch, ctx.currentTime + 0.025);
    osc.connect(gainNode);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.025);
  }
};

// ============================================
// RESPONSIVE HELPERS
// ============================================

function getResponsiveValues() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isLandscape = vw > vh && vh < 500;

  let cardHeight;

  if (isLandscape) {
    cardHeight = 180;
  } else if (vw <= 380) {
    cardHeight = 210;
  } else if (vw <= 600) {
    cardHeight = 240;
  } else if (vw <= 768) {
    cardHeight = 240;
  } else {
    cardHeight = 300;
  }

  // Calculate slot position - place it below center based on card height
  const slotOffset = cardHeight * 0.6;
  const slotTop = Math.min(vh / 2 + slotOffset, vh - 60);

  return { cardHeight, slotTop, isLandscape, vw, vh };
}

function updateSlotPosition() {
  const { slotTop } = getResponsiveValues();
  const slotContainer = document.querySelector('.slot-container');
  const slotVoid = document.querySelector('.slot-void');
  const speedLines = document.querySelector('.speed-lines');
  const slotGlow = document.querySelector('.slot-glow');

  if (!cardInserted) {
    slotContainer.style.top = slotTop + 'px';
    slotVoid.style.top = (slotTop + 8) + 'px';
    speedLines.style.top = slotTop + 'px';
  }

  // Position glow so shape aligns with slot (shape bottom is at y=69 in 119px viewBox)
  if (slotGlow) {
    slotGlow.style.top = (slotTop - 69) + 'px';
  }
}

// ============================================
// CARD SLOT ANIMATION
// ============================================

let cardInserted = false;

function insertCard(clickedCard) {
  if (cardInserted) return;

  const cards = document.querySelectorAll('.card');
  const slotContainer = document.querySelector('.slot-container');
  const slotBarEl = document.querySelector('.slot-bar');
  const clickedIndex = Number(clickedCard.dataset.index);

  // Update slot position BEFORE setting cardInserted (updateSlotPosition checks this flag)
  updateSlotPosition();

  // Now mark as inserted to prevent double-clicks
  cardInserted = true;

  // Clear any leftover GSAP properties and inline styles before capturing position
  gsap.set(clickedCard, { clearProps: 'all' });
  clickedCard.style.cssText = '';

  // Force browser reflow to ensure all layouts are recalculated
  void slotContainer.offsetHeight;
  void clickedCard.offsetHeight;

  // Get positions after reflow
  // Use offsetWidth/offsetHeight to get actual size without hover transform (scale)
  const slotRect = slotBarEl.getBoundingClientRect();
  const cardWidth = clickedCard.offsetWidth;
  const cardHeight = clickedCard.offsetHeight;
  const cardRect = clickedCard.getBoundingClientRect();

  // Calculate target positions - use viewport center for consistent centering
  const overlapAmount = 40;
  const viewportCenter = window.innerWidth / 2;
  const targetLeft = Math.round(viewportCenter - cardWidth / 2);
  const targetTop = slotRect.top - overlapAmount;

  const tl = gsap.timeline();

  // Get slot bar elements
  const slotBar = document.querySelector('.slot-bar');
  const slotBarGradient = document.querySelector('.slot-bar-gradient');

  // Start with slot collapsed (scaleY: 0)
  gsap.set([slotBar, slotBarGradient], { scaleY: 0 });
  gsap.set(slotContainer, { opacity: 1 });

  // Step 1: Grow the slot (simple, no overshoot)
  tl.to([slotBar, slotBarGradient], {
    scaleY: 1,
    duration: 0.3,
    ease: 'power2.out'
  }, 0);

  // Step 2: Slide other cards away (compare by data-index, not DOM order)
  cards.forEach((card) => {
    const cardIndex = Number(card.dataset.index);
    if (cardIndex !== clickedIndex) {
      const direction = cardIndex < clickedIndex ? -1 : 1;
      tl.to(card, {
        x: direction * (window.innerWidth / 2 + 200),
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in'
      }, 0.1);
    }
  });

  // Set up fixed positioning - capture current position first
  const startTop = cardRect.top;
  const startLeft = cardRect.left;

  // Create placeholder to maintain flex layout when card becomes fixed
  const placeholder = document.createElement('div');
  placeholder.className = 'card-placeholder';
  placeholder.style.width = cardWidth + 'px';
  placeholder.style.height = cardHeight + 'px';
  placeholder.style.flexShrink = '0';
  placeholder.style.visibility = 'hidden';
  clickedCard.parentNode.insertBefore(placeholder, clickedCard.nextSibling);

  clickedCard.classList.add('inserting');
  clickedCard.classList.add('selected');

  // Allow card to escape container clipping on mobile
  clickedCard.parentNode.classList.add('card-inserting');

  // Set initial fixed position
  clickedCard.style.top = startTop + 'px';
  clickedCard.style.left = startLeft + 'px';
  clickedCard.style.margin = '0';

  // STEP 1: Move card to center above the slot
  tl.to(clickedCard, {
    top: slotRect.top - cardHeight - 20,
    left: targetLeft,
    duration: 0.4,
    ease: 'power2.out'
  }, 0.3);

  // STEP 2: Drop straight down into the slot (starts after step 1 finishes)
  tl.to(clickedCard, {
    top: targetTop,
    duration: 0.45,
    ease: 'power2.in'
  }, 0.85);

  // Loud click and speed lines on impact
  const speedLines = document.querySelector('.speed-lines');
  tl.call(() => {
    speedLines.classList.add('active');
    sfx.playSlotClick();
  }, [], 1.28);

  // Overshoot down into slot (follow-through) - like SD card pushing past
  tl.to(clickedCard, {
    top: targetTop + 12,
    duration: 0.08,
    ease: 'power2.out'
  }, 1.3);

  // Soft click as it locks in
  tl.call(() => {
    sfx.playSoftClick();
  }, [], 1.55);

  // Hold at overshoot position, then settle back up into place
  tl.to(clickedCard, {
    top: targetTop,
    duration: 0.12,
    ease: 'power2.out'
  }, 1.55);

  // After slot animation, move card and slot up together
  // NOTE: Card stays in cardsContainer (DOM unchanged), just animated with fixed positioning
  const backButton = document.querySelector('.back-button');
  const gameContent = document.querySelector('.game-content');
  const visualizer = document.querySelector('.visualizer');
  const slotVoid = document.querySelector('.slot-void');

  const finalTop = 60;
  const cardFinalTop = finalTop - 40; // Same offset as targetTop relative to slot

  // Raise card above void before moving up
  tl.call(() => {
    clickedCard.classList.add('inserted');
  }, [], 1.72);

  // Animate card, slot, and void up together (no DOM moves!)
  tl.to(clickedCard, {
    top: cardFinalTop,
    duration: 0.5,
    ease: 'power2.out'
  }, 1.77);

  tl.to(slotContainer, {
    top: finalTop,
    duration: 0.5,
    ease: 'power2.out'
  }, 1.77);

  tl.to(slotVoid, {
    top: finalTop + 8,
    duration: 0.5,
    ease: 'power2.out'
  }, 1.77);

  // Move glow up with the slot
  const slotGlow = document.querySelector('.slot-glow');
  if (slotGlow) {
    tl.to(slotGlow, {
      top: finalTop - 69,
      duration: 0.5,
      ease: 'power2.out'
    }, 1.77);
  }

  // Move visualizer into the selected card (before showing)
  tl.call(() => {
    clickedCard.appendChild(visualizer);
  }, [], 1.77);

  // Show back button and game content, then start the game
  tl.call(() => {
    backButton.classList.add('visible');
    gameContent.classList.add('visible');
    // Initialize the game for this card (starts music)
    gameManager.init(clickedIndex);
    // Show visualizer after a brief delay so it appears when music starts
    setTimeout(() => {
      visualizer.classList.add('visible');
    }, 100);
  }, [], 2.27);
}

// Back button handler
let isGoingBack = false;

function goBack() {
  if (isGoingBack) return;
  isGoingBack = true;

  // Destroy the current game
  gameManager.destroy();

  const slotContainer = document.querySelector('.slot-container');
  const speedLines = document.querySelector('.speed-lines');
  const backButton = document.querySelector('.back-button');
  const gameContent = document.querySelector('.game-content');
  const visualizer = document.querySelector('.visualizer');
  const slotVoid = document.querySelector('.slot-void');
  const cards = document.querySelectorAll('.card');

  // Find the selected card (it has the 'selected' class)
  const selectedCard = document.querySelector('.card.selected');
  if (!selectedCard) {
    isGoingBack = false;
    return;
  }

  const selectedIndex = Number(selectedCard.dataset.index);

  // Disable CSS transitions on cards during GSAP animation to prevent conflicts
  cards.forEach(card => card.classList.add('no-transition'));

  // Get responsive values for original positions
  const { slotTop } = getResponsiveValues();
  const overlapAmount = 40;
  const originalSlotTop = slotTop;
  const originalCardTop = originalSlotTop - overlapAmount;

  const tl = gsap.timeline();

  // Step 1: Fade out back button, mute button, visualizer, and game content
  // Fade out back button, visualizer, and game content (mute button stays visible)
  tl.to([backButton, visualizer, gameContent], {
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      backButton.classList.remove('visible');
      visualizer.classList.remove('visible');
      gameContent.classList.remove('visible');
      // Move visualizer back to body for next time
      document.body.appendChild(visualizer);
    }
  }, 0);

  // Step 2: Move card, slot, and void back down to center
  tl.to(selectedCard, {
    top: originalCardTop,
    duration: 0.3,
    ease: 'power2.inOut'
  }, 0.15);

  tl.to(slotContainer, {
    top: originalSlotTop,
    duration: 0.3,
    ease: 'power2.inOut'
  }, 0.15);

  tl.to(slotVoid, {
    top: originalSlotTop + 8,
    duration: 0.3,
    ease: 'power2.inOut'
  }, 0.15);

  // Move glow back down and hide it
  const slotGlow = document.querySelector('.slot-glow');
  if (slotGlow) {
    tl.to(slotGlow, {
      top: originalSlotTop - 69,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
      onComplete: () => {
        slotGlow.classList.remove('visible');
        slotGlow.style.removeProperty('--glow-opacity');
        // Hide gradient slot bar
        const gradientBar = document.querySelector('.slot-bar-gradient');
        if (gradientBar) gradientBar.classList.remove('visible');
      }
    }, 0.15);
  }

  // Step 3: Anticipation - card pushes down before ejecting (like SD card)
  // Soft click as it pushes down (quieter and lower pitched for back action)
  tl.call(() => {
    sfx.playSoftClick(0.5, 0.8);
  }, [], 0.4);

  tl.to(selectedCard, {
    top: originalCardTop + 12,
    duration: 0.06,
    ease: 'power2.in'
  }, 0.4);

  // Hold at pushed position, then loud click as it ejects (quieter and lower pitched)
  tl.call(() => {
    sfx.playSlotClick(0.5, 0.8);
  }, [], 0.55);

  // Step 4: Card pops up out of slot (fully visible above slot)
  tl.to(selectedCard, {
    top: originalCardTop - 290,
    duration: 0.24,
    ease: 'power2.out'
  }, 0.55);

  // Step 5: Collapse slot (simple, no overshoot)
  const slotBar = document.querySelector('.slot-bar');
  const slotBarGradient = document.querySelector('.slot-bar-gradient');
  tl.to([slotBar, slotBarGradient], {
    scaleY: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      // Hide after collapse is complete
      gsap.set(slotContainer, { opacity: 0 });
    }
  }, 0.79);

  // Step 6: Move other cards to position while invisible (with blur)
  tl.call(() => {
    cards.forEach(card => {
      const idx = Number(card.dataset.index);
      if (idx !== selectedIndex) {
        // Add blur while repositioning
        gsap.set(card, { filter: 'blur(8px)' });
        // Move to position instantly (they're already invisible)
        gsap.set(card, { x: 0 });
      }
    });
  }, [], 0.7);

  // Step 7: Animate selected card back to its original position in the row
  tl.call(() => {
    // Remove placeholder before measuring so flex layout is correct
    const placeholder = document.querySelector('.card-placeholder');
    if (placeholder) placeholder.remove();

    // Create invisible clone to measure target position without affecting the real card
    const clone = selectedCard.cloneNode(true);
    clone.classList.remove('inserting', 'selected', 'inserted');
    clone.style.cssText = 'visibility: hidden; position: static; opacity: 1; transform: none;';
    selectedCard.parentNode.insertBefore(clone, selectedCard);

    // Measure where the clone lands in normal flow
    const targetRect = clone.getBoundingClientRect();

    // Remove the clone
    clone.remove();

    // Animate the real card to the target position
    gsap.to(selectedCard, {
      top: targetRect.top,
      left: targetRect.left,
      duration: 0.28,
      ease: 'power2.out',
      onComplete: () => {
        // Now fully reset to normal flow
        selectedCard.classList.remove('inserting', 'selected', 'inserted');
        selectedCard.parentNode.classList.remove('card-inserting');
        selectedCard.style.cssText = '';
        gsap.set(selectedCard, { clearProps: 'all' });
        gsap.set(selectedCard, { opacity: 1, y: 0 });
      }
    });
  }, [], 0.9);

  // Step 8: Fade in other cards (after selected card is in place)
  tl.call(() => {
    cards.forEach(card => {
      const idx = Number(card.dataset.index);
      if (idx !== selectedIndex) {
        gsap.to(card, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.22,
          ease: 'power2.out'
        });
      }
    });
  }, [], 1.18);

  // Step 9: Final cleanup (after fade-in completes)
  tl.call(() => {
    // Reset ALL cards to clean state
    cards.forEach(card => {
      card.classList.remove('inserting', 'selected', 'inserted');
      card.style.cssText = '';
      gsap.set(card, { clearProps: 'all' });
    });

    // Reset cards container
    const cardsContainer = document.querySelector('.cards-container');
    cardsContainer.classList.remove('card-inserting');

    // Remove placeholder
    const placeholder = document.querySelector('.card-placeholder');
    if (placeholder) placeholder.remove();

    // Reset slot container
    slotContainer.style.cssText = '';
    gsap.set(slotContainer, { clearProps: 'all' });
    gsap.set(slotContainer, { opacity: 0 });

    // Reset slot bar to collapsed position for next animation
    const slotBar = document.querySelector('.slot-bar');
    gsap.set(slotBar, { scaleY: 0 });

    // Reset void
    slotVoid.style.cssText = '';
    gsap.set(slotVoid, { clearProps: 'all' });

    // Reset speed lines
    speedLines.classList.remove('active');

    // Reset back button/game content/visualizer opacity for next time
    gsap.set([backButton, gameContent, visualizer], { clearProps: 'opacity' });

    // Re-enable CSS transitions on cards
    cards.forEach(card => card.classList.remove('no-transition'));

    // Allow new card insertion
    cardInserted = false;
    isGoingBack = false;
  }, [], 1.45);
}

// URL routing for games
const gameRoutes = {
  0: 'cube-runner',
  1: 'ring-world',
  2: 'crystal-core'
};

const routeToIndex = {
  'cube-runner': 0,
  'ring-world': 1,
  'crystal-core': 2
};

function getGameFromPath() {
  const path = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  return routeToIndex[path] ?? null;
}

function updateURL(gameIndex) {
  const slug = gameRoutes[gameIndex];
  if (slug) {
    history.pushState({ game: gameIndex }, '', '/' + slug);
  }
}

function clearURL() {
  history.pushState({ game: null }, '', '/');
}

// Add click listeners to cards after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  // Initialize slot position for current viewport
  updateSlotPosition();

  // Initialize slot bar to collapsed state for grow animation
  const slotBar = document.querySelector('.slot-bar');
  gsap.set(slotBar, { scaleY: 0 });

  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      // If this card is already selected, eject it
      if (card.classList.contains('selected')) {
        goBack();
        clearURL();
      } else {
        insertCard(card);
        // Update URL when card is inserted
        const cardIndex = Number(card.dataset.index);
        updateURL(cardIndex);
      }
    });
  });

  // Back button listener
  const backButton = document.querySelector('.back-button');
  backButton.addEventListener('click', (e) => {
    e.stopPropagation();
    goBack();
    clearURL();
  });

  // Mute button listener - show it immediately since SFX play on home page too
  const muteButton = document.querySelector('.mute-button');
  const muteToggle = document.querySelector('.mute-toggle');
  const volumeSlider = document.querySelector('.volume-slider');
  const visualizer = document.querySelector('.visualizer');
  let savedVolume = 100; // Remember volume before muting
  
  muteButton.classList.add('visible');
  
  // Handle mute toggle click
  muteToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isMuted = muteButton.classList.toggle('muted');
    musicPlayer.setMuted(isMuted);
    sfx.setMuted(isMuted);
    visualizer.classList.toggle('muted', isMuted);
    
    if (isMuted) {
      savedVolume = volumeSlider.value;
      volumeSlider.value = 0;
    } else {
      volumeSlider.value = savedVolume;
      musicPlayer.setVolume(savedVolume / 100);
    }
  });
  
  // Handle volume slider input
  volumeSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    const volume = e.target.value / 100;
    musicPlayer.setVolume(volume);
    
    // Update muted state based on volume
    if (volume === 0) {
      muteButton.classList.add('muted');
      visualizer.classList.add('muted');
      musicPlayer.setMuted(true);
      sfx.setMuted(true);
    } else {
      muteButton.classList.remove('muted');
      visualizer.classList.remove('muted');
      musicPlayer.setMuted(false);
      sfx.setMuted(false);
      savedVolume = e.target.value;
    }
  });
  
  // Prevent slider from triggering parent events
  volumeSlider.addEventListener('click', (e) => e.stopPropagation());

  // Handle browser back/forward buttons
  window.addEventListener('popstate', (e) => {
    const gameIndex = e.state?.game ?? getGameFromPath();
    if (gameIndex !== null && !cardInserted) {
      // Navigate to game
      const card = document.querySelector(`.card[data-index="${gameIndex}"]`);
      if (card) insertCard(card);
    } else if (gameIndex === null && cardInserted) {
      // Navigate back to home
      goBack();
    }
  });

  // Check URL on page load and auto-select card if needed
  const initialGame = getGameFromPath();
  if (initialGame !== null) {
    // Small delay to let the page initialize
    setTimeout(() => {
      const card = document.querySelector(`.card[data-index="${initialGame}"]`);
      if (card) insertCard(card);
    }, 100);
  }
});

// ============================================
// GAME MANAGER
// ============================================

const gameManager = {
  renderer: null,
  scene: null,
  camera: null,
  animationId: null,
  currentGame: null,

  init(gameIndex) {
    const gameCanvas = document.getElementById('game-canvas');
    const container = document.querySelector('.game-content');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create new renderer for game
    this.renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create scene and camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 10);

    // Load the game based on index
    this.loadGame(gameIndex);

    // Start render loop
    this.animate();

    // Start music for this game
    musicPlayer.play(gameIndex);
    visualizerController.start(gameIndex);
  },

  loadGame(gameIndex) {
    // Each card can load a different game
    // For now, create a simple placeholder for each
    switch (gameIndex) {
      case 0:
        this.createGame1();
        break;
      case 1:
        this.createGame2();
        break;
      case 2:
        this.createGame3();
        break;
      default:
        this.createGame1();
    }
  },

  // Placeholder games - replace with your actual game logic
  createGame1() {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xa8e6cf, wireframe: true });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    this.currentGame = { type: 'cube', object: cube };
  },

  createGame2() {
    const geometry = new THREE.TorusGeometry(1.5, 0.5, 16, 100);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd93d, wireframe: true });
    const torus = new THREE.Mesh(geometry, material);
    this.scene.add(torus);
    this.currentGame = { type: 'torus', object: torus };
  },

  createGame3() {
    const geometry = new THREE.IcosahedronGeometry(2, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xff6b6b, wireframe: true });
    const icosahedron = new THREE.Mesh(geometry, material);
    this.scene.add(icosahedron);
    this.currentGame = { type: 'icosahedron', object: icosahedron };
  },

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Rotate the current game object
    if (this.currentGame && this.currentGame.object) {
      this.currentGame.object.rotation.x += 0.01;
      this.currentGame.object.rotation.y += 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  },

  resize() {
    if (!this.renderer) return;
    const container = document.querySelector('.game-content');
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  },

  destroy() {
    // Stop music and visualizer
    musicPlayer.stop();
    visualizerController.stop();

    // Stop animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Dispose of game objects
    if (this.currentGame && this.currentGame.object) {
      this.currentGame.object.geometry.dispose();
      this.currentGame.object.material.dispose();
      this.scene.remove(this.currentGame.object);
      this.currentGame = null;
    }

    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
  }
};

// ============================================
// RESIZE & ORIENTATION
// ============================================

let resizeTimeout;
window.addEventListener('resize', () => {
  // Debounce resize events
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateSlotPosition();
    gameManager.resize();
  }, 100);
});

// Handle orientation change specifically (fires before resize on some devices)
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    updateSlotPosition();
    gameManager.resize();
  }, 150);
});
