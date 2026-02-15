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

  // Play a single note (with optional slide to target frequency)
  playNote(freq, type, volume, duration, startTime, slideToFreq = null) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    // If sliding, ramp frequency to target over the note duration
    if (slideToFreq && slideToFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, startTime + duration * 0.8);
    }
    
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

  // Signal Drift — warm electronic pulse, tape-warble arpeggios
  playSignalDrift() {
    const ctx = this.audioContext;
    const bpm = 88;
    const step16 = 60 / bpm / 4;

    // Pentatonic arp in Eb minor — hypnotic loop
    const arp = [311, 370, 415, 466, 554, 466, 415, 370,
                 311, 370, 415, 554, 622, 554, 466, 415];

    // Deep sub bass roots
    const bass = [78, 78, 78, 78, 93, 93, 93, 93, 69, 69, 69, 69, 78, 78, 78, 78];

    // High texture pings — sparse
    const pings = [0,0,0,1109,0,0,831,0,0,0,1109,0,0,740,0,0];

    let step = 0;

    const playStep = () => {
      if (!this.isPlaying) return;
      const now = ctx.currentTime;
      const idx = step % 16;

      // Arp — filtered triangle, slight detune for tape warmth
      const arpFreq = arp[idx];
      const wobble = 1 + Math.sin(now * 0.7) * 0.003;
      this.playNote(arpFreq * wobble, 'triangle', 0.045, step16 * 1.8, now);
      // Ghost echo (quieter, delayed)
      this.playNote(arpFreq * 1.002, 'sine', 0.015, step16 * 2.5, now + step16 * 0.75);

      // Sub bass every 4 steps
      if (idx % 4 === 0) {
        const bassIdx = Math.floor(step / 4) % bass.length;
        this.playPad(bass[bassIdx], 'sine', 0.07, step16 * 7, now);
      }

      // High pings
      const ping = pings[idx];
      if (ping > 0) {
        this.playNote(ping, 'sine', 0.02, step16 * 3, now + 0.02);
      }

      // Soft kick every 4 steps
      if (idx % 4 === 0) {
        this.playKick(now);
      }

      // Closed hat on offbeats with swing
      if (idx % 2 === 1) {
        this.playHiHat(now + (idx % 4 === 3 ? step16 * 0.12 : 0), false);
      }

      // Ghost snare
      if (idx === 4 || idx === 12) {
        this.playSnare(now);
      }

      step++;
    };

    playStep();
    this.intervalIds.push(setInterval(playStep, step16 * 1000));
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
    const tempo = pianoRoll.tempo || 160;
    const stepDuration = (60 / tempo) / 2;

    // Use piano roll notes if available (allows live editing)
    const getNote = (idx) => {
      if (pianoRoll.notes && pianoRoll.notes.length > 0) {
        return pianoRoll.notes[idx % pianoRoll.notes.length];
      }
      // Fallback
      const defaultNotes = [330, 392, 494, 392, 330, 294, 330, 392, 494, 587, 494, 392];
      return defaultNotes[idx % defaultNotes.length];
    };
    
    let step = 0;
    const numSteps = pianoRoll.notes?.length || 12;

    const playStep = () => {
      if (!this.isPlaying) return;
      const now = ctx.currentTime;
      const noteIdx = step % numSteps;
      const freq = getNote(noteIdx);

      // Update piano roll playhead and visualizer
      if (pianoRoll.visible) {
        pianoRoll.updatePlayhead(noteIdx);
        // Pulse visualizer on beats
        const drumType = pianoRoll.drums?.[noteIdx] || '';
        const bassFreq = pianoRoll.bass?.[noteIdx] || 0;
        
        // Trigger all visualizer effects
        pianoRollVisualizer.onStep(freq, drumType, bassFreq);
        
        if (drumType || freq > 0 || bassFreq > 0) {
          pianoRollVisualizer.beatPulse(drumType === 'K', bassFreq > 0);
        }
      }

      // Only play note if frequency > 0 (0 = rest) and not muted
      if (freq > 0 && !pianoRoll.melodyMuted) {
        // Check if this note has a slide - bend to next note's frequency
        const hasSlide = pianoRoll.slides?.[noteIdx];
        let slideTarget = null;
        if (hasSlide) {
          // Find next non-zero note frequency
          const nextIdx = (noteIdx + 1) % numSteps;
          const nextFreq = getNote(nextIdx);
          if (nextFreq > 0) {
            slideTarget = nextFreq;
          }
        }
        const melodyWave = pianoRoll.melodyInstrument || 'sawtooth';
        this.playNote(freq, melodyWave, 0.08, stepDuration * 0.7, now, slideTarget);
      }

      // Play drums from pianoRoll.drums array (if not muted)
      if (!pianoRoll.drumsMuted) {
        const drum = pianoRoll.drums?.[noteIdx] || '';
        if (drum === 'K') this.playKick(now);
        if (drum === 'S') this.playSnare(now);
        if (drum === 'H') this.playHiHat(now);
      }
      
      // Play bass from pianoRoll.bass array (if not muted)
      if (!pianoRoll.bassMuted) {
        const bassFreq = pianoRoll.bass?.[noteIdx] || 0;
        if (bassFreq > 0) {
          const bassWave = pianoRoll.bassInstrument || 'triangle';
          this.playNote(bassFreq, bassWave, 0.12, stepDuration * 0.8, now);
        }
      }

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
        this.playSignalDrift();
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
    // Pause shader backgrounds while game is playing
    if (typeof ShaderCards !== 'undefined') ShaderCards.pause();
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
    // Resume shader backgrounds
    if (typeof ShaderCards !== 'undefined') ShaderCards.resume();
  }, [], 1.45);
}

// URL routing for games
const gameRoutes = {
  0: 'cube-runner',
  1: 'signal-drift',
  2: 'crystal-core'
};

const routeToIndex = {
  'cube-runner': 0,
  'signal-drift': 1,
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
  // Initialize piano roll
  pianoRoll.init();
  
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
      volumeSlider.style.setProperty('--volume', 0);
    } else {
      volumeSlider.value = savedVolume;
      volumeSlider.style.setProperty('--volume', savedVolume);
      musicPlayer.setVolume(savedVolume / 100);
    }
  });
  
  // Handle volume slider input
  volumeSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    const volume = e.target.value / 100;
    musicPlayer.setVolume(volume);
    
    // Update slider fill
    volumeSlider.style.setProperty('--volume', e.target.value);
    
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

  // Mobile: tap to expand volume slider, auto-collapse after delay
  let collapseTimeout = null;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  
  function collapseVolumeSlider() {
    muteButton.classList.remove('expanded');
  }
  
  function resetCollapseTimer() {
    if (collapseTimeout) clearTimeout(collapseTimeout);
    collapseTimeout = setTimeout(collapseVolumeSlider, 3000);
  }
  
  if (isMobile) {
    muteButton.addEventListener('click', (e) => {
      // Only expand if clicking the container (not the toggle or slider)
      if (e.target === muteButton) {
        muteButton.classList.add('expanded');
        resetCollapseTimer();
      }
    });
    
    // Keep open while sliding
    volumeSlider.addEventListener('input', () => {
      resetCollapseTimer();
    });
    
    volumeSlider.addEventListener('touchstart', () => {
      if (collapseTimeout) clearTimeout(collapseTimeout);
    });
    
    volumeSlider.addEventListener('touchend', () => {
      resetCollapseTimer();
    });
    
    // Also expand when tapping the mute toggle
    muteToggle.addEventListener('click', () => {
      if (!muteButton.classList.contains('expanded')) {
        muteButton.classList.add('expanded');
      }
      resetCollapseTimer();
    });
  }

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
// PIANO ROLL 3D VISUALIZER
// ============================================

const pianoRollVisualizer = {
  renderer: null,
  scene: null,
  camera: null,
  mesh: null,
  particles: null,
  rings: [],
  freqBars: [],
  orbitTrail: null,
  trailPositions: [],
  animationId: null,
  targetScale: 1,
  currentScale: 1,
  targetRotationSpeed: 0.01,
  glowIntensity: 0,
  hue: 0,
  targetHue: 0,
  barHeights: [], // frequency bars (initialized in createFreqBars)
  shapeIndex: 0,
  morphProgress: 0,
  shapes: ['icosahedron', 'octahedron', 'dodecahedron', 'torus', 'torusKnot'],
  lastShapeChange: 0,
  isTransitioning: false,
  transitionPhase: 0, // 0=idle, 1=shrinking, 2=swapping, 3=growing
  transitionSpeed: 0.08,
  
  init() {
    const canvas = document.getElementById('piano-roll-canvas');
    if (!canvas || this.renderer) return;
    
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    
    // Scene
    this.scene = new THREE.Scene();
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5);
    
    // Main shape (starts as icosahedron, morphs to others)
    const geometry = new THREE.IcosahedronGeometry(1.2, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff6b6b, 
      wireframe: true,
      transparent: true,
      opacity: 0.9
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
    this.lastShapeChange = Date.now();
    
    // Particle system for note hits
    this.createParticles();
    
    // Frequency bars (EQ visualizer)
    this.createFreqBars();
    
    // Orbit trail
    this.createOrbitTrail();
    
    // Start animation
    this.animate();
  },
  
  createFreqBars() {
    const barCount = 64; // Even more bars for ultra-wide
    const barWidth = 0.18;
    const spacing = 0.19;
    const startX = -((barCount - 1) * spacing) / 2;
    
    for (let i = 0; i < barCount; i++) {
      const geometry = new THREE.PlaneGeometry(barWidth, 0.01);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      const bar = new THREE.Mesh(geometry, material);
      bar.position.set(startX + i * spacing, -2.0, -1.5); // Behind the shape
      bar.rotation.x = -0.2; // Slight tilt for depth
      this.scene.add(bar);
      this.freqBars.push(bar);
    }
    this.barHeights = new Array(barCount).fill(0);
  },
  
  createOrbitTrail() {
    const trailLength = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(trailLength * 3);
    
    for (let i = 0; i < trailLength; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      this.trailPositions.push({ x: 0, y: 0, z: 0 });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.6
    });
    
    this.orbitTrail = new THREE.Line(geometry, material);
    this.scene.add(this.orbitTrail);
  },
  
  createParticles() {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      velocities.push({ x: 0, y: 0, z: 0, life: 0 });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xff6b6b,
      size: 0.08,
      transparent: true,
      opacity: 0.8
    });
    
    this.particles = new THREE.Points(geometry, material);
    this.particles.velocities = velocities;
    this.particles.nextIdx = 0;
    this.scene.add(this.particles);
  },
  
  emitParticles(count = 5, color = 0xff6b6b) {
    if (!this.particles) return;
    const positions = this.particles.geometry.attributes.position.array;
    const velocities = this.particles.velocities;
    
    for (let i = 0; i < count; i++) {
      const idx = this.particles.nextIdx;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.03;
      
      positions[idx * 3] = 0;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = 0;
      
      velocities[idx] = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        z: (Math.random() - 0.5) * speed,
        life: 1
      };
      
      this.particles.nextIdx = (idx + 1) % velocities.length;
    }
    this.particles.material.color.setHex(color);
    this.particles.geometry.attributes.position.needsUpdate = true;
  },
  
  addRing() {
    const geometry = new THREE.RingGeometry(1.3, 1.35, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.scale.set(0.1, 0.1, 0.1);
    ring.userData = { expanding: true };
    this.scene.add(ring);
    this.rings.push(ring);
  },
  
  morphToNextShape() {
    if (!this.mesh || this.isTransitioning) return;
    
    // Start transition animation
    this.isTransitioning = true;
    this.transitionPhase = 1; // Start shrinking
    this.lastShapeChange = Date.now();
  },
  
  getGeometryForShape(shapeName) {
    switch (shapeName) {
      case 'icosahedron':
        return new THREE.IcosahedronGeometry(1.2, 1);
      case 'octahedron':
        return new THREE.OctahedronGeometry(1.3, 0);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(1.1, 0);
      case 'torus':
        return new THREE.TorusGeometry(0.9, 0.4, 8, 16);
      case 'torusKnot':
        return new THREE.TorusKnotGeometry(0.7, 0.25, 64, 8);
      default:
        return new THREE.IcosahedronGeometry(1.2, 1);
    }
  },
  
  updateTransition() {
    if (!this.isTransitioning) return;
    
    const speed = this.transitionSpeed;
    
    if (this.transitionPhase === 1) {
      // Shrinking phase - scale down and spin fast
      this.morphProgress += speed;
      this.mesh.scale.setScalar(Math.max(0.01, 1 - this.morphProgress));
      this.mesh.rotation.y += 0.15; // Fast spin
      this.mesh.rotation.x += 0.1;
      
      if (this.morphProgress >= 1) {
        // Swap geometry at smallest point
        this.transitionPhase = 2;
        this.morphProgress = 0;
        
        // Change to next shape
        this.shapeIndex = (this.shapeIndex + 1) % this.shapes.length;
        const shapeName = this.shapes[this.shapeIndex];
        this.mesh.geometry.dispose();
        this.mesh.geometry = this.getGeometryForShape(shapeName);
        
        // Burst effect
        this.emitParticles(15);
        this.addRing();
      }
    } else if (this.transitionPhase === 2) {
      // Growing phase - scale back up
      this.morphProgress += speed;
      this.mesh.scale.setScalar(Math.min(1, this.morphProgress));
      this.mesh.rotation.y += 0.08; // Slower spin as it grows
      this.mesh.rotation.x += 0.05;
      
      if (this.morphProgress >= 1) {
        // Transition complete
        this.transitionPhase = 0;
        this.morphProgress = 0;
        this.isTransitioning = false;
        this.mesh.scale.setScalar(1);
      }
    }
  },
  
  animate() {
    if (!this.renderer) return;
    
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Only apply normal scale/rotation when not transitioning
    if (!this.isTransitioning) {
      // Smooth scale transitions
      this.currentScale += (this.targetScale - this.currentScale) * 0.1;
      this.mesh.scale.setScalar(this.currentScale);
      
      // Rotation
      this.mesh.rotation.x += this.targetRotationSpeed;
      this.mesh.rotation.y += this.targetRotationSpeed * 0.7;
    }
    
    // Smooth color shift
    this.hue += (this.targetHue - this.hue) * 0.1;
    const meshColor = new THREE.Color().setHSL(this.hue, 0.7, 0.6);
    
    // Handle shape transition animation
    this.updateTransition();
    
    // Morph shape every 8 seconds (only if not currently transitioning)
    if (!this.isTransitioning && Date.now() - this.lastShapeChange > 8000) {
      this.morphToNextShape();
    }
    this.mesh.material.color.copy(meshColor);
    
    // Glow decay
    this.glowIntensity *= 0.95;
    this.mesh.material.opacity = 0.7 + this.glowIntensity * 0.3;
    
    // Animate particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const velocities = this.particles.velocities;
      for (let i = 0; i < velocities.length; i++) {
        if (velocities[i].life > 0) {
          positions[i * 3] += velocities[i].x;
          positions[i * 3 + 1] += velocities[i].y;
          positions[i * 3 + 2] += velocities[i].z;
          velocities[i].life -= 0.02;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.material.opacity = 0.6;
    }
    
    // Animate expanding rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.scale.x += 0.03;
      ring.scale.y += 0.03;
      ring.material.opacity -= 0.02;
      if (ring.material.opacity <= 0) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    
    // Animate frequency bars (decay toward 0) - match mesh color
    for (let i = 0; i < this.freqBars.length; i++) {
      this.barHeights[i] *= 0.92; // Decay
      const bar = this.freqBars[i];
      const height = Math.max(0.01, this.barHeights[i]);
      bar.scale.y = height * 150;
      bar.position.y = -2.2 + height * 0.75;
      bar.material.color.copy(meshColor);
      bar.material.opacity = 0.3 + height * 0.4;
    }
    
    // Particles match mesh color
    if (this.particles) {
      this.particles.material.color.copy(meshColor);
    }
    
    // Update orbit trail
    if (this.orbitTrail && this.mesh) {
      // Add current mesh position to trail
      const vertex = this.mesh.geometry.attributes.position.array;
      const worldPos = new THREE.Vector3(vertex[0], vertex[1], vertex[2]);
      worldPos.applyMatrix4(this.mesh.matrixWorld);
      
      // Shift trail positions
      this.trailPositions.unshift({ 
        x: Math.sin(Date.now() * 0.002) * 1.5,
        y: Math.cos(Date.now() * 0.0015) * 0.8,
        z: Math.sin(Date.now() * 0.001) * 0.5
      });
      this.trailPositions.pop();
      
      // Update trail geometry
      const positions = this.orbitTrail.geometry.attributes.position.array;
      for (let i = 0; i < this.trailPositions.length; i++) {
        positions[i * 3] = this.trailPositions[i].x;
        positions[i * 3 + 1] = this.trailPositions[i].y;
        positions[i * 3 + 2] = this.trailPositions[i].z;
      }
      this.orbitTrail.geometry.attributes.position.needsUpdate = true;
      this.orbitTrail.material.color.copy(meshColor);
    }
    
    this.renderer.render(this.scene, this.camera);
  },
  
  // Called when a note is played
  pulse(intensity = 0.3, color = 0xff6b6b) {
    this.targetScale = 1 + intensity;
    this.glowIntensity = 1;
    this.emitParticles(3, color);
    setTimeout(() => {
      this.targetScale = 1;
    }, 100);
  },
  
  // Called when editing (adding/removing notes)
  react(freq) {
    // Higher notes = faster rotation, lower = slower
    const normalizedFreq = Math.min(1, Math.max(0, (freq - 200) / 600));
    this.targetRotationSpeed = 0.005 + normalizedFreq * 0.02;
    
    // Color shift based on frequency
    this.targetHue = normalizedFreq * 0.15; // Red to orange-yellow range
    
    // Trigger frequency bar
    const barIdx = Math.floor(normalizedFreq * 7);
    this.triggerBar(barIdx, 0.8);
    
    this.pulse(0.2);
    this.addRing();
  },
  
  // Trigger a frequency bar
  triggerBar(index, intensity = 1) {
    if (index >= 0 && index < this.barHeights.length) {
      this.barHeights[index] = Math.min(1.5, this.barHeights[index] + intensity);
    }
  },
  
  // Called on each playback step with note info
  onStep(melodyFreq, drumType, bassFreq) {
    const barCount = this.freqBars.length;
    
    // Color shift based on melody
    if (melodyFreq > 0) {
      const normalizedFreq = Math.min(1, Math.max(0, (melodyFreq - 200) / 600));
      this.targetHue = normalizedFreq * 0.15;
      // Map melody to mid-high freq bars (spread across multiple)
      const centerBar = Math.floor(barCount * 0.5 + normalizedFreq * barCount * 0.4);
      for (let i = -2; i <= 2; i++) {
        this.triggerBar(centerBar + i, 0.7 - Math.abs(i) * 0.15);
      }
    }
    
    // Drums hit lower bars (spread wide for kick)
    if (drumType === 'K') {
      for (let i = 0; i < barCount; i++) {
        const dist = Math.abs(i - barCount/2) / (barCount/2);
        this.triggerBar(i, 1.0 * (1 - dist * 0.5));
      }
    } else if (drumType === 'S') {
      for (let i = Math.floor(barCount * 0.2); i < Math.floor(barCount * 0.8); i++) {
        this.triggerBar(i, 0.6);
      }
    } else if (drumType === 'H') {
      for (let i = Math.floor(barCount * 0.6); i < barCount; i++) {
        this.triggerBar(i, 0.4);
      }
    }
    
    // Bass hits low-mid bars
    if (bassFreq > 0) {
      for (let i = 0; i < Math.floor(barCount * 0.4); i++) {
        this.triggerBar(i, 0.5);
      }
    }
  },
  
  // Beat pulse (called on each step)
  beatPulse(isDrum, hasBass = false) {
    if (isDrum) {
      this.pulse(0.2, 0xff6b6b); // Red for kick
      this.addRing();
    } else if (hasBass) {
      this.pulse(0.12, 0xa855f7); // Purple for bass
    } else {
      this.pulse(0.08, 0x60a5fa); // Blue for melody
    }
  },
  
  resize() {
    if (!this.renderer) return;
    const canvas = document.getElementById('piano-roll-canvas');
    const container = canvas?.parentElement;
    if (!container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  },
  
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.scene.remove(this.particles);
      this.particles = null;
    }
    for (const ring of this.rings) {
      ring.geometry.dispose();
      ring.material.dispose();
      this.scene.remove(ring);
    }
    this.rings = [];
    for (const bar of this.freqBars) {
      bar.geometry.dispose();
      bar.material.dispose();
      this.scene.remove(bar);
    }
    this.freqBars = [];
    this.barHeights = [];
    if (this.orbitTrail) {
      this.orbitTrail.geometry.dispose();
      this.orbitTrail.material.dispose();
      this.scene.remove(this.orbitTrail);
      this.orbitTrail = null;
    }
    this.trailPositions = [];
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
  }
};

// ============================================
// PIANO ROLL / MIDI EDITOR (Crystal Core only)
// ============================================

const pianoRoll = {
  visible: false,
  notes: [], // Melody notes (frequencies)
  drums: [], // Drum pattern: 'K'=kick, 'S'=snare, 'H'=hihat, 'O'=open hat, ''=rest
  gridEl: null,
  cells: [],
  drumCells: [],
  playheadStep: 0,
  isDragging: false,
  dragMode: null, // 'add' or 'remove'
  dragTrack: null, // 'melody' or 'drums'
  tempo: 160, // BPM
  melodyMuted: false,
  drumsMuted: false,
  bassMuted: false,
  slides: [], // Array of booleans - true = slide/bend to next note
  bass: [], // Bass notes (frequencies like melody)
  
  // C major scale frequencies (for highlighting)
  scaleNotes: new Set([262, 294, 330, 349, 392, 440, 494, 523, 587, 659]),
  
  // Note names for display (maps frequencies to names)
  freqToNote: {
    262: 'C4', 294: 'D4', 330: 'E4', 349: 'F4', 392: 'G4', 440: 'A4', 494: 'B4',
    523: 'C5', 587: 'D5', 659: 'E5', 698: 'F5', 784: 'G5', 880: 'A5', 988: 'B5'
  },
  
  // All possible notes in the piano roll (low to high)
  allNotes: [
    { freq: 262, name: 'C4', inScale: true },
    { freq: 294, name: 'D4', inScale: true },
    { freq: 330, name: 'E4', inScale: true },
    { freq: 349, name: 'F4', inScale: true },
    { freq: 392, name: 'G4', inScale: true },
    { freq: 440, name: 'A4', inScale: true },
    { freq: 494, name: 'B4', inScale: true },
    { freq: 523, name: 'C5', inScale: true },
    { freq: 587, name: 'D5', inScale: true },
    { freq: 659, name: 'E5', inScale: true }
  ],
  
  // Drum sounds
  drumTypes: [
    { id: 'K', name: 'Kick', color: '#ff6b6b' },
    { id: 'S', name: 'Snare', color: '#fbbf24' },
    { id: 'H', name: 'Hat', color: '#60a5fa' }
  ],
  
  // Bass notes (C3-G3 range - one octave below melody)
  bassNotes: [
    { note: 'G3', freq: 196 },
    { note: 'F3', freq: 175 },
    { note: 'E3', freq: 165 },
    { note: 'D3', freq: 147 },
    { note: 'C3', freq: 131 }
  ],
  
  // Instrument options
  instruments: [
    { id: 'sawtooth', name: 'Saw', icon: '◢' },
    { id: 'square', name: 'Square', icon: '◻' },
    { id: 'triangle', name: 'Tri', icon: '△' },
    { id: 'sine', name: 'Sine', icon: '∿' }
  ],
  melodyInstrument: 'sawtooth',
  bassInstrument: 'triangle',

  init() {
    this.gridEl = document.getElementById('piano-roll-grid');
    const pianoRollEl = document.getElementById('piano-roll');
    const closeBtn = pianoRollEl.querySelector('.piano-roll-close');
    
    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    
    // Play/Pause button
    const playPauseBtn = document.getElementById('piano-roll-play');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlayback();
      });
    }
    
    // Tempo slider
    const tempoSlider = document.getElementById('piano-roll-tempo');
    const tempoDisplay = document.getElementById('piano-roll-tempo-val');
    if (tempoSlider) {
      tempoSlider.addEventListener('input', (e) => {
        this.tempo = parseInt(e.target.value);
        if (tempoDisplay) tempoDisplay.textContent = this.tempo;
        // Restart playback with new tempo if playing
        if (musicPlayer.isPlaying) {
          musicPlayer.stop();
          musicPlayer.play(2); // Crystal Core
        }
      });
    }
    
    // Clear button
    const clearBtn = document.getElementById('piano-roll-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearPattern();
      });
    }
    
    // Random button
    const randomBtn = document.getElementById('piano-roll-random');
    if (randomBtn) {
      randomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.randomPattern();
      });
    }
    
    // Pattern length controls
    const growBtn = document.getElementById('piano-roll-grow');
    const shrinkBtn = document.getElementById('piano-roll-shrink');
    if (growBtn) {
      growBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeLength(4);
      });
    }
    if (shrinkBtn) {
      shrinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeLength(-4);
      });
    }
    
    // Reset button
    const resetBtn = document.getElementById('piano-roll-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetPattern();
      });
    }
    
    // Copy button
    const copyBtn = document.getElementById('piano-roll-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyPattern();
      });
    }
    
    // Drag end listeners (on document to catch mouseup outside grid)
    document.addEventListener('mouseup', () => this.endDrag());
    document.addEventListener('mouseleave', () => this.endDrag());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayback();
      }
    });
    
    // Click on game canvas toggles piano roll (only for Crystal Core)
    const gameCanvas = document.getElementById('game-canvas');
    gameCanvas.addEventListener('click', (e) => {
      if (gameManager.currentGameIndex === 2) { // Crystal Core
        e.stopPropagation();
        this.toggle();
      }
    });
    
    // Track mute toggles
    const muteMelody = document.getElementById('mute-melody');
    const muteDrums = document.getElementById('mute-drums');
    if (muteMelody) {
      muteMelody.addEventListener('change', (e) => {
        this.melodyMuted = !e.target.checked;
      });
    }
    if (muteDrums) {
      muteDrums.addEventListener('change', (e) => {
        this.drumsMuted = !e.target.checked;
      });
    }
    const muteBass = document.getElementById('mute-bass');
    if (muteBass) {
      muteBass.addEventListener('change', (e) => {
        this.bassMuted = !e.target.checked;
      });
    }
    
    // Instrument selectors
    this.loadInstruments();
    const melodyInst = document.getElementById('melody-instrument');
    const bassInst = document.getElementById('bass-instrument');
    if (melodyInst) {
      melodyInst.value = this.melodyInstrument;
      melodyInst.addEventListener('change', (e) => {
        this.melodyInstrument = e.target.value;
        this.saveInstruments();
      });
    }
    if (bassInst) {
      bassInst.value = this.bassInstrument;
      bassInst.addEventListener('change', (e) => {
        this.bassInstrument = e.target.value;
        this.saveInstruments();
      });
    }
  },
  
  togglePlayback() {
    const btn = document.getElementById('piano-roll-play');
    if (musicPlayer.isPlaying) {
      musicPlayer.stop();
      visualizerController.stop();
      if (btn) btn.innerHTML = '▶';
    } else {
      musicPlayer.play(2);
      visualizerController.start(2);
      if (btn) btn.innerHTML = '⏸';
    }
  },
  
  clearPattern() {
    for (let i = 0; i < this.notes.length; i++) {
      this.notes[i] = 0;
      this.drums[i] = '';
      this.slides[i] = false;
      this.bass[i] = 0;
    }
    this.savePattern();
    this.renderGrid();
  },
  
  randomPattern() {
    const scale = [262, 294, 330, 392, 440, 523, 587, 659]; // C major pentatonic-ish
    const bassScale = [131, 147, 165, 175, 196]; // C3-G3
    
    for (let i = 0; i < this.notes.length; i++) {
      // Melody: 70% chance of a note, 30% chance of rest
      if (Math.random() < 0.7) {
        this.notes[i] = scale[Math.floor(Math.random() * scale.length)];
      } else {
        this.notes[i] = 0;
      }
      this.slides[i] = false; // No random slides - user adds them manually
      
      // Drums: kick on beats, snare on 2 and 4, hats elsewhere
      if (i % 4 === 0) {
        this.drums[i] = 'K'; // Kick on downbeats
      } else if (i % 4 === 2) {
        this.drums[i] = Math.random() < 0.7 ? 'S' : 'H'; // Snare or hat on 3
      } else {
        this.drums[i] = Math.random() < 0.5 ? 'H' : ''; // Hat or rest
      }
      
      // Bass: notes on beats mostly
      if (i % 4 === 0) {
        this.bass[i] = bassScale[Math.floor(Math.random() * bassScale.length)];
      } else if (Math.random() < 0.2) {
        this.bass[i] = bassScale[Math.floor(Math.random() * bassScale.length)];
      } else {
        this.bass[i] = 0;
      }
    }
    this.savePattern();
    this.renderGrid();
  },
  
  changeLength(delta) {
    const newLen = Math.max(4, Math.min(32, this.notes.length + delta));
    if (newLen === this.notes.length) return;
    
    if (newLen > this.notes.length) {
      // Extend: add rests
      while (this.notes.length < newLen) {
        this.notes.push(0);
        this.drums.push('');
        this.slides.push(false);
        this.bass.push(0);
      }
    } else {
      // Shrink
      this.notes.length = newLen;
      this.drums.length = newLen;
      this.slides.length = newLen;
      this.bass.length = newLen;
    }
    
    // Update display
    const lengthVal = document.getElementById('piano-roll-length-val');
    if (lengthVal) lengthVal.textContent = newLen;
    
    this.savePattern();
    this.renderGrid();
  },
  
  startDrag(cell, step, freq) {
    this.isDragging = true;
    const wasActive = cell.classList.contains('active');
    this.dragMode = wasActive ? 'remove' : 'add';
    this.applyDrag(cell, step, freq);
  },
  
  continueDrag(cell, step, freq) {
    if (!this.isDragging) return;
    this.applyDrag(cell, step, freq);
  },
  
  applyDrag(cell, step, freq) {
    if (this.dragMode === 'add') {
      // Clear other notes in this column first
      this.cells.forEach(c => {
        if (parseInt(c.dataset.step) === step) {
          c.classList.remove('active');
        }
      });
      cell.classList.add('active');
      this.notes[step] = freq;
      // Play preview with selected instrument
      if (musicPlayer.audioContext) {
        musicPlayer.init();
        const melodyWave = this.melodyInstrument || 'sawtooth';
        musicPlayer.playNote(freq, melodyWave, 0.06, 0.1, musicPlayer.audioContext.currentTime);
      }
      // React visualizer
      pianoRollVisualizer.react(freq);
    } else {
      cell.classList.remove('active');
      if (this.notes[step] === freq) {
        this.notes[step] = 0;
      }
      pianoRollVisualizer.pulse(0.1);
    }
    this.savePattern();
  },
  
  endDrag() {
    this.isDragging = false;
    this.dragMode = null;
  },
  
  previewNote(freq) {
    if (musicPlayer.audioContext) {
      musicPlayer.init();
      musicPlayer.playNote(freq, 'sawtooth', 0.03, 0.08, musicPlayer.audioContext.currentTime);
    }
  },

  show() {
    if (this.visible) return;
    this.visible = true;
    
    // Get Crystal Core's notes, drums, slides, and bass
    this.notes = this.getCrystalCoreNotes();
    this.drums = this.getCrystalCoreDrums();
    this.slides = this.getCrystalCoreSlides();
    this.bass = this.getCrystalCoreBass();
    
    // Ensure arrays match notes length
    while (this.drums.length < this.notes.length) this.drums.push('');
    while (this.slides.length < this.notes.length) this.slides.push(false);
    while (this.bass.length < this.notes.length) this.bass.push(0);
    this.drums.length = this.notes.length;
    this.slides.length = this.notes.length;
    this.bass.length = this.notes.length;
    
    // Sync length display
    const lengthVal = document.getElementById('piano-roll-length-val');
    if (lengthVal) lengthVal.textContent = this.notes.length;
    
    // Sync tempo display
    const tempoSlider = document.getElementById('piano-roll-tempo');
    const tempoVal = document.getElementById('piano-roll-tempo-val');
    if (tempoSlider) tempoSlider.value = this.tempo;
    if (tempoVal) tempoVal.textContent = this.tempo;
    
    // Sync play button state
    const playBtn = document.getElementById('piano-roll-play');
    if (playBtn) playBtn.innerHTML = musicPlayer.isPlaying ? '⏸' : '▶';
    
    // Render the grid
    this.renderGrid();
    
    document.getElementById('piano-roll').classList.add('visible');
    
    // Initialize 3D visualizer
    setTimeout(() => {
      pianoRollVisualizer.init();
    }, 50);
  },

  hide() {
    this.visible = false;
    document.getElementById('piano-roll').classList.remove('visible');
    pianoRollVisualizer.destroy();
  },

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  getCrystalCoreNotes() {
    // Try to load from localStorage first
    const saved = localStorage.getItem('crystalCorePattern');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return parsed;
        }
      } catch (e) {}
    }
    // Default pattern
    return [330, 392, 494, 392, 330, 294, 330, 392, 494, 587, 494, 392];
  },
  
  getCrystalCoreDrums() {
    // Try to load from localStorage
    const saved = localStorage.getItem('crystalCoreDrums');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return parsed;
        }
      } catch (e) {}
    }
    // Default drum pattern (matches Crystal Core): K on 1,5,9, S on 5, H on off-beats
    return ['K', 'H', '', 'H', 'K', 'H', '', 'H', 'K', 'H', '', 'H'];
  },
  
  getCrystalCoreSlides() {
    const saved = localStorage.getItem('crystalCoreSlides');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return new Array(12).fill(false);
  },
  
  getCrystalCoreBass() {
    const saved = localStorage.getItem('crystalCoreBass');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    // Default bass pattern - root notes on beats (C3, D3)
    return [131, 0, 0, 0, 147, 0, 0, 0, 131, 0, 0, 0];
  },
  
  loadInstruments() {
    this.melodyInstrument = localStorage.getItem('crystalCoreMelodyInst') || 'sawtooth';
    this.bassInstrument = localStorage.getItem('crystalCoreBassInst') || 'triangle';
  },
  
  saveInstruments() {
    localStorage.setItem('crystalCoreMelodyInst', this.melodyInstrument);
    localStorage.setItem('crystalCoreBassInst', this.bassInstrument);
  },
  
  savePattern() {
    localStorage.setItem('crystalCorePattern', JSON.stringify(this.notes));
    localStorage.setItem('crystalCoreDrums', JSON.stringify(this.drums));
    localStorage.setItem('crystalCoreSlides', JSON.stringify(this.slides));
    localStorage.setItem('crystalCoreBass', JSON.stringify(this.bass));
  },
  
  resetPattern() {
    localStorage.removeItem('crystalCorePattern');
    localStorage.removeItem('crystalCoreDrums');
    localStorage.removeItem('crystalCoreSlides');
    localStorage.removeItem('crystalCoreBass');
    this.notes = [330, 392, 494, 392, 330, 294, 330, 392, 494, 587, 494, 392];
    this.drums = ['K', 'H', '', 'H', 'K', 'H', '', 'H', 'K', 'H', '', 'H'];
    this.slides = new Array(12).fill(false);
    this.bass = [131, 0, 0, 0, 147, 0, 0, 0, 131, 0, 0, 0]; // C3, D3
    const lengthVal = document.getElementById('piano-roll-length-val');
    if (lengthVal) lengthVal.textContent = this.notes.length;
    this.renderGrid();
  },
  
  copyPattern() {
    const patternStr = JSON.stringify(this.notes);
    navigator.clipboard.writeText(patternStr).then(() => {
      // Visual feedback
      const btn = document.getElementById('piano-roll-copy');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.style.color = '#4ade80';
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.style.color = '';
        }, 1000);
      }
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  },

  renderGrid() {
    const numSteps = this.notes.length;
    const rows = this.allNotes.slice().reverse(); // High notes at top
    
    // Set grid columns: 1 for piano key label + numSteps for note cells
    this.gridEl.style.gridTemplateColumns = `36px repeat(${numSteps}, 1fr)`;
    this.gridEl.innerHTML = '';
    this.cells = [];
    this.drumCells = [];
    
    // Step numbers header row
    const headerSpacer = document.createElement('div');
    headerSpacer.className = 'piano-key header-spacer';
    this.gridEl.appendChild(headerSpacer);
    
    for (let step = 0; step < numSteps; step++) {
      const stepNum = document.createElement('div');
      stepNum.className = 'step-number' + (step % 4 === 0 ? ' beat-start' : '');
      stepNum.textContent = step + 1;
      this.gridEl.appendChild(stepNum);
    }
    
    // === MELODY SECTION ===
    rows.forEach((noteInfo, rowIdx) => {
      // Piano key label (clickable to preview)
      const keyEl = document.createElement('div');
      keyEl.className = 'piano-key' + (noteInfo.name.includes('#') ? ' sharp' : '');
      // Color code by octave
      if (noteInfo.name.includes('4')) {
        keyEl.classList.add('octave-4');
      } else if (noteInfo.name.includes('5')) {
        keyEl.classList.add('octave-5');
      }
      keyEl.textContent = noteInfo.name;
      keyEl.style.cursor = 'pointer';
      keyEl.addEventListener('click', () => {
        this.previewNote(noteInfo.freq);
      });
      this.gridEl.appendChild(keyEl);
      
      // Note cells for each step
      for (let step = 0; step < numSteps; step++) {
        const cell = document.createElement('div');
        cell.className = 'note-cell';
        if (step % 4 === 0) cell.classList.add('beat-start');
        
        // Scale highlighting: dim notes not in scale
        if (!this.scaleNotes.has(noteInfo.freq)) {
          cell.classList.add('out-of-scale');
        }
        
        // Octave color coding
        if (noteInfo.name.includes('4')) {
          cell.classList.add('octave-4');
        } else if (noteInfo.name.includes('5')) {
          cell.classList.add('octave-5');
        }
        
        // Check if this cell is active (matches the note at this step)
        const isActive = this.notes[step] === noteInfo.freq;
        if (isActive) {
          cell.classList.add('active');
          // Add slide indicator if this note slides
          if (this.slides[step]) {
            cell.classList.add('slide');
          }
        }
        
        // Store reference
        cell.dataset.row = rowIdx;
        cell.dataset.step = step;
        cell.dataset.freq = noteInfo.freq;
        cell.dataset.track = 'melody';
        
        // Drag to paint (shift+click = toggle slide)
        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (e.shiftKey && cell.classList.contains('active')) {
            // Toggle slide on this note
            this.toggleSlide(step);
            cell.classList.toggle('slide', this.slides[step]);
            return;
          }
          
          this.dragTrack = 'melody';
          this.startDrag(cell, step, noteInfo.freq);
        });
        cell.addEventListener('mouseenter', (e) => {
          if (this.dragTrack === 'melody') {
            this.continueDrag(cell, step, noteInfo.freq);
          }
        });
        // Touch support
        cell.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.dragTrack = 'melody';
          this.startDrag(cell, step, noteInfo.freq);
        }, { passive: false });
        
        // Hover preview (only if not already active)
        cell.addEventListener('mouseenter', () => {
          if (!cell.classList.contains('active') && !this.isDragging) {
            this.previewNote(noteInfo.freq);
          }
        });
        
        this.gridEl.appendChild(cell);
        this.cells.push(cell);
      }
    });
    
    // === DRUM SECTION DIVIDER ===
    const dividerLabel = document.createElement('div');
    dividerLabel.className = 'track-divider';
    dividerLabel.textContent = 'DRUMS';
    this.gridEl.appendChild(dividerLabel);
    
    for (let step = 0; step < numSteps; step++) {
      const dividerCell = document.createElement('div');
      dividerCell.className = 'track-divider-cell';
      this.gridEl.appendChild(dividerCell);
    }
    
    // === DRUM TRACKS ===
    this.drumTypes.forEach((drumType) => {
      // Drum label
      const drumLabel = document.createElement('div');
      drumLabel.className = 'piano-key drum-key';
      drumLabel.textContent = drumType.name;
      drumLabel.style.cursor = 'pointer';
      drumLabel.addEventListener('click', () => {
        this.previewDrum(drumType.id);
      });
      this.gridEl.appendChild(drumLabel);
      
      // Drum cells for each step
      for (let step = 0; step < numSteps; step++) {
        const cell = document.createElement('div');
        cell.className = 'drum-cell';
        if (step % 4 === 0) cell.classList.add('beat-start');
        
        // Check if this drum is active at this step
        const isActive = this.drums[step] === drumType.id;
        if (isActive) {
          cell.classList.add('active');
          cell.style.setProperty('--drum-color', drumType.color);
        }
        
        // Store reference
        cell.dataset.step = step;
        cell.dataset.drumType = drumType.id;
        cell.dataset.track = 'drums';
        
        // Click to toggle drum
        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleDrum(cell, step, drumType.id);
        });
        
        this.gridEl.appendChild(cell);
        this.drumCells.push(cell);
      }
    });
    
    // === BASS SECTION DIVIDER ===
    const bassDividerLabel = document.createElement('div');
    bassDividerLabel.className = 'track-divider';
    bassDividerLabel.textContent = 'BASS';
    this.gridEl.appendChild(bassDividerLabel);
    
    for (let step = 0; step < numSteps; step++) {
      const dividerCell = document.createElement('div');
      dividerCell.className = 'track-divider-cell';
      this.gridEl.appendChild(dividerCell);
    }
    
    // === BASS TRACKS ===
    this.bassCells = [];
    this.bassNotes.forEach((noteInfo, rowIdx) => {
      // Bass label
      const bassLabel = document.createElement('div');
      bassLabel.className = 'piano-key bass-key';
      bassLabel.textContent = noteInfo.note;
      bassLabel.style.cursor = 'pointer';
      bassLabel.addEventListener('click', () => {
        this.previewBass(noteInfo.freq);
      });
      this.gridEl.appendChild(bassLabel);
      
      // Bass cells for each step
      for (let step = 0; step < numSteps; step++) {
        const cell = document.createElement('div');
        cell.className = 'bass-cell';
        if (step % 4 === 0) cell.classList.add('beat-start');
        
        // Check if this bass note is active at this step
        const isActive = this.bass[step] === noteInfo.freq;
        if (isActive) {
          cell.classList.add('active');
        }
        
        // Store reference
        cell.dataset.step = step;
        cell.dataset.freq = noteInfo.freq;
        cell.dataset.track = 'bass';
        
        // Click to toggle bass
        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleBass(cell, step, noteInfo.freq);
        });
        
        this.gridEl.appendChild(cell);
        this.bassCells.push(cell);
      }
    });
  },
  
  toggleBass(cell, step, freq) {
    const wasActive = this.bass[step] === freq;
    
    // Clear this column in bass cells
    this.bassCells.forEach(c => {
      if (parseInt(c.dataset.step) === step) {
        c.classList.remove('active');
      }
    });
    
    if (wasActive) {
      this.bass[step] = 0;
      pianoRollVisualizer.pulse(0.1);
    } else {
      this.bass[step] = freq;
      cell.classList.add('active');
      this.previewBass(freq);
      pianoRollVisualizer.pulse(0.25);
    }
    this.savePattern();
  },
  
  previewBass(freq) {
    if (!musicPlayer.audioContext) {
      musicPlayer.init();
    }
    const now = musicPlayer.audioContext.currentTime;
    const bassWave = this.bassInstrument || 'triangle';
    musicPlayer.playNote(freq, bassWave, 0.12, 0.2, now);
  },
  
  toggleDrum(cell, step, drumType) {
    const wasActive = this.drums[step] === drumType;
    
    // Clear this column in drum cells
    this.drumCells.forEach(c => {
      if (parseInt(c.dataset.step) === step) {
        c.classList.remove('active');
        c.style.removeProperty('--drum-color');
      }
    });
    
    if (wasActive) {
      this.drums[step] = '';
      pianoRollVisualizer.pulse(0.1);
    } else {
      this.drums[step] = drumType;
      cell.classList.add('active');
      const color = this.drumTypes.find(d => d.id === drumType)?.color || '#ff6b6b';
      cell.style.setProperty('--drum-color', color);
      // Preview sound
      this.previewDrum(drumType);
      // React visualizer
      pianoRollVisualizer.pulse(drumType === 'K' ? 0.3 : 0.15);
    }
    this.savePattern();
  },
  
  previewDrum(drumType) {
    if (!musicPlayer.audioContext) {
      musicPlayer.init();
    }
    const now = musicPlayer.audioContext.currentTime;
    if (drumType === 'K') musicPlayer.playKick(now);
    if (drumType === 'S') musicPlayer.playSnare(now);
    if (drumType === 'H') musicPlayer.playHiHat(now);
  },
  
  toggleSlide(step) {
    // Only allow slide if there's a next note to bend to
    const nextStep = (step + 1) % this.notes.length;
    const nextNote = this.notes[nextStep];
    if (nextNote > 0 && this.notes[step] > 0) {
      this.slides[step] = !this.slides[step];
      this.savePattern();
    }
  },

  toggleCell(cell, step, freq) {
    const wasActive = cell.classList.contains('active');
    
    // Clear any other active cell in this column
    this.cells.forEach(c => {
      if (parseInt(c.dataset.step) === step) {
        c.classList.remove('active');
      }
    });
    
    if (wasActive) {
      // Turn off - set to 0 (rest)
      this.notes[step] = 0;
    } else {
      // Turn on
      cell.classList.add('active');
      this.notes[step] = freq;
      
      // Play preview sound
      if (musicPlayer.audioContext) {
        musicPlayer.init();
        musicPlayer.playNote(freq, 'sawtooth', 0.08, 0.15, musicPlayer.audioContext.currentTime);
      }
    }
  },

  updatePlayhead(step) {
    // Remove old playheads
    this.cells.forEach(c => c.classList.remove('playhead'));
    this.drumCells.forEach(c => c.classList.remove('playhead'));
    if (this.bassCells) this.bassCells.forEach(c => c.classList.remove('playhead'));
    
    // Add new playheads
    this.cells.forEach(c => {
      if (parseInt(c.dataset.step) === step) c.classList.add('playhead');
    });
    this.drumCells.forEach(c => {
      if (parseInt(c.dataset.step) === step) c.classList.add('playhead');
    });
    if (this.bassCells) {
      this.bassCells.forEach(c => {
        if (parseInt(c.dataset.step) === step) c.classList.add('playhead');
      });
    }
    
    this.playheadStep = step;
  }
};

// ============================================
// GAME MANAGER
// ============================================

const gameManager = {
  renderer: null,
  scene: null,
  camera: null,
  animationId: null,
  currentGame: null,
  currentGameIndex: null,

  init(gameIndex) {
    this.currentGameIndex = gameIndex;
    const gameCanvas = document.getElementById('game-canvas');
    const container = document.querySelector('.game-content');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create new renderer for game
    this.renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create scene and camera
    this.scene = new THREE.Scene();
    // No background - transparent so ASCII shader shows through

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 10);

    // Load the game based on index
    this.loadGame(gameIndex);

    // Signal Drift: render 3D to offscreen, isometric cube shader is the main view
    if (gameIndex === 0 || gameIndex === 1 || gameIndex === 2) {
      gameCanvas.style.display = 'none';
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
      this.offscreenRenderer = new THREE.WebGLRenderer({ canvas: this.offscreenCanvas, antialias: true });
      const clearColors = { 0: 0x89CFF0, 1: 0x0d1a1f, 2: 0x1a0510 };
      this.offscreenRenderer.setClearColor(clearColors[gameIndex], 1);
      this.offscreenRenderer.setSize(width, height);
      this.offscreenRenderer.setPixelRatio(1);
    }

    // Start render loop
    this.animate();

    // Start music for this game
    musicPlayer.play(gameIndex);
    visualizerController.start(gameIndex);

    // Start ASCII shader background (or main view for Signal Drift)
    // Wait for fonts to load before building atlas
    document.fonts.ready.then(() => this.startBgShader(gameIndex));
  },

  bgShaderRAF: null,
  bgShaderGL: null,

  startBgShader(gameIndex) {
    const bgCanvas = document.getElementById('game-bg-shader');
    if (!bgCanvas) return;
    bgCanvas.style.display = 'block';
    const container = document.querySelector('.game-content');
    const w = container.clientWidth, h = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    bgCanvas.width = w * dpr; bgCanvas.height = h * dpr;

    const gl = bgCanvas.getContext('webgl', { alpha: false });
    if (!gl) return;
    this.bgShaderGL = gl;

    // Build font atlas — luminance chars + edge-aware chars
    // First 10: luminance ramp (sparse → dense)
    // Next 8: edge directions (|, -, /, \, +, ), (, _)
    const chars = ' .:-=+*#%@|\\/-)(_.';
    const COLS=10, cellW=32, cellH=32, ROWS=Math.ceil(chars.length/COLS);
    const aW=COLS*cellW, aH=ROWS*cellH;
    const ac=document.createElement('canvas'); ac.width=aW; ac.height=aH;
    const ax=ac.getContext('2d');
    ax.fillStyle='#000'; ax.fillRect(0,0,aW,aH);
    ax.fillStyle='#fff'; ax.font='bold 28px GeistPixelSquare, monospace'; ax.textAlign='center'; ax.textBaseline='middle';
    for(let i=0;i<chars.length;i++){
      const c=i%COLS, r=Math.floor(i/COLS);
      ax.fillText(chars[i], c*cellW+cellW/2, r*cellH+cellH/2);
    }

    function mkS(tp,src){const s=gl.createShader(tp);gl.shaderSource(s,src);gl.compileShader(s);return s;}
    const vs=`attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}`;

    // Signal Drift & Cube Runner: ASCII shader that samples the 3D render as texture
    // Signal Drift: isometric cube shader (matches card) sampling 3D torus
    if (gameIndex === 1 && this.offscreenCanvas) {
      const fs=`
precision mediump float;
varying vec2 v;
uniform float t;
uniform vec2 mouse;
uniform vec2 res;
uniform sampler2D src;

vec3 isoBox(vec2 p, float sz, float angle, vec3 cTop, vec3 cLeft, vec3 cRight) {
  float c=cos(angle), s=sin(angle);
  p=mat2(c,-s,s,c)*p;
  float top=step(abs(p.x)+abs(p.y-sz*0.3),sz*0.5);
  float left=step(abs(p.x+sz*0.25),sz*0.25)*step(abs(p.y+sz*0.1),sz*0.35)*step(-p.x,0.0);
  float right=step(abs(p.x-sz*0.25),sz*0.25)*step(abs(p.y+sz*0.1),sz*0.35)*step(p.x,0.0);
  vec3 col=vec3(0.0);
  col=mix(col,cRight,right);
  col=mix(col,cLeft,left);
  col=mix(col,cTop,top);
  return col;
}

void main(){
  vec2 uv=v;
  float aspect=res.x/res.y;
  uv.x*=aspect;

  float gridSize=0.04;
  vec2 cell=floor(uv/gridSize);
  vec2 local=fract(uv/gridSize)-0.5;

  float hash=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
  float phase=hash*6.28+t*0.8;
  float angle=sin(phase)*0.4;

  // Mouse push
  vec2 cellCenter=(cell+0.5)*gridSize;
  vec2 mp=vec2(mouse.x*aspect,mouse.y);
  float md=length(cellCenter-mp);
  float push=smoothstep(0.3,0.0,md)*1.2;
  angle+=push*sin(t*3.0+hash*10.0);

  // Base colors — pink/purple/teal
  vec3 pink=vec3(0.9,0.25,0.5);
  vec3 purple=vec3(0.45,0.2,0.7);
  vec3 teal=vec3(0.38,0.34,0.62);

  float ci=mod(cell.x+cell.y,3.0);
  vec3 cTop=ci<1.0?pink:ci<2.0?purple:teal;
  vec3 cLeft=cTop*0.5;
  vec3 cRight=cTop*0.7;

  float sz=0.35+sin(phase)*0.05;
  vec3 box=isoBox(local,sz,angle,cTop,cLeft,cRight);

  float bg=0.04;
  vec3 color=max(box,vec3(bg));
  gl_FragColor=vec4(color,1.0);
}`;
      const prog=gl.createProgram();
      gl.attachShader(prog,mkS(gl.VERTEX_SHADER,vs));
      gl.attachShader(prog,mkS(gl.FRAGMENT_SHADER,fs));
      gl.linkProgram(prog);gl.useProgram(prog);
      const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const ap=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(ap);
      gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);

      // Scene texture
      const sceneTex=gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,sceneTex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

      gl.uniform1i(gl.getUniformLocation(prog,'src'),0);
      const uT=gl.getUniformLocation(prog,'t');
      const uMouse=gl.getUniformLocation(prog,'mouse');
      const uRes=gl.getUniformLocation(prog,'res');

      let bmx=0.5,bmy=0.5;
      container.addEventListener('mousemove',function(e){
        const r=bgCanvas.getBoundingClientRect();
        bmx=(e.clientX-r.left)/r.width;
        bmy=1.0-(e.clientY-r.top)/r.height;
      });

      gl.viewport(0,0,bgCanvas.width,bgCanvas.height);
      const self=this;
      function bgLoop(time){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,sceneTex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,self.offscreenCanvas);
        gl.uniform1f(uT,time*0.001);
        gl.uniform2f(uMouse,bmx,bmy);
        gl.uniform2f(uRes,bgCanvas.width,bgCanvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        self.bgShaderRAF=requestAnimationFrame(bgLoop);
      }
      this.bgShaderRAF=requestAnimationFrame(bgLoop);
      return;
    }

    // Cube Runner: ASCII character shader on cube, white bg
    if (gameIndex === 0 && this.offscreenCanvas) {
      const rows=80;
      const aspect=bgCanvas.width/bgCanvas.height;
      const cols=Math.round(rows*aspect);

      const lumChars = 10; // first 10 chars are luminance ramp
      const fs=`
precision mediump float;
varying vec2 v;
uniform sampler2D src;
uniform sampler2D atlas;
uniform float charCount,atlasCols,atlW,atlH,cW,cH;
uniform vec2 mouse;
uniform vec2 srcRes;

float getLum(vec2 uv) {
  vec4 s = texture2D(src, uv);
  return dot(s.rgb, vec3(0.299, 0.587, 0.114));
}

// Sample atlas character
float sampleChar(float ci, vec2 sub) {
  ci = clamp(ci, 0.0, charCount - 1.0);
  float col2 = mod(ci, atlasCols);
  float row = floor(ci / atlasCols);
  vec2 auv = vec2((col2 + sub.x) * cW / atlW, (row + (1.0 - sub.y)) * cH / atlH);
  return texture2D(atlas, auv).r;
}

void main(){
  vec2 grid = vec2(${cols.toFixed(1)}, ${rows.toFixed(1)});
  vec2 cell = floor(v * grid);
  vec2 sub = fract(v * grid);
  vec2 sampleUV = vec2((cell.x + 0.5) / grid.x, 1.0 - (cell.y + 0.5) / grid.y);
  vec4 scene = texture2D(src, sampleUV);
  float lum = dot(scene.rgb, vec3(0.299, 0.587, 0.114));

  // Blue bg where scene is background
  vec3 bgBlue = vec3(0.537, 0.812, 0.941);
  float distToBg = length(scene.rgb - bgBlue);
  if(distToBg < 0.05) { gl_FragColor = vec4(bgBlue, 1.0); return; }

  // Sobel edge detection
  vec2 px = vec2(1.0 / grid.x, 1.0 / grid.y);
  float tl = getLum(sampleUV + vec2(-px.x, px.y));
  float tc = getLum(sampleUV + vec2(0.0, px.y));
  float tr = getLum(sampleUV + vec2(px.x, px.y));
  float ml = getLum(sampleUV + vec2(-px.x, 0.0));
  float mr = getLum(sampleUV + vec2(px.x, 0.0));
  float bl = getLum(sampleUV + vec2(-px.x, -px.y));
  float bc = getLum(sampleUV + vec2(0.0, -px.y));
  float br = getLum(sampleUV + vec2(px.x, -px.y));

  float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
  float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
  float edgeMag = length(vec2(gx, gy));

  // Choose character
  float ci;
  float edgeThreshold = 0.15;

  if (edgeMag > edgeThreshold) {
    // Shape-aware: pick edge character based on gradient angle
    float angle = atan(gy, gx); // -PI to PI
    // Gradient is perpendicular to edge, so edge direction = angle + PI/2
    // Map edge direction to characters:
    // | (index 10): vertical edge (gradient horizontal, angle ~0 or ~PI)
    // - (index 13): horizontal edge (gradient vertical, angle ~PI/2)  
    // \\ (index 11): diagonal edge
    // / (index 12): other diagonal
    float a = mod(angle + 3.14159, 3.14159); // 0 to PI
    float sector = a / 3.14159 * 8.0; // 0 to 8

    // 8 sectors: map to edge chars
    // 0,8: horizontal gradient → vertical edge |
    // 1,7: ~ → / 
    // 2,6: ~ → - 
    // 3,5: ~ → backslash
    // 4: vertical gradient → horizontal edge -
    if (sector < 1.0 || sector >= 7.0) ci = 10.0;       // |
    else if (sector < 2.0 || (sector >= 6.0 && sector < 7.0)) ci = 12.0; // /
    else if (sector < 3.0 || (sector >= 5.0 && sector < 6.0)) ci = 13.0; // -
    else if (sector < 5.0) ci = 11.0;                     // backslash
    else ci = 10.0;                                        // |

    // Modulate edge char brightness with edge magnitude
    float a2 = sampleChar(ci, sub);
    float intensity = smoothstep(edgeThreshold, 0.6, edgeMag);
    vec3 color = mix(bgBlue, vec3(1.0), a2 * intensity);
    gl_FragColor = vec4(color, 1.0);
    return;
  }

  // Luminance-based for non-edge areas (first 10 chars)
  ci = floor(lum * ${(lumChars - 1).toFixed(1)});
  ci = clamp(ci, 0.0, ${(lumChars - 1).toFixed(1)});

  float a = sampleChar(ci, sub);

  // Grab point interaction
  vec2 cellCenter = (cell + 0.5) / grid;
  vec2 mp = vec2(mouse.x, 1.0 - mouse.y);
  float md = length(cellCenter - mp);
  float near = step(md, 0.04);
  float sqSize = 0.1 + lum * 0.4;
  float sq = step(abs(sub.x - 0.5), sqSize * 0.5) * step(abs(sub.y - 0.5), sqSize * 0.5);
  float shape = mix(a, sq, near);

  vec3 color = mix(bgBlue, vec3(1.0), shape);
  gl_FragColor = vec4(color, 1.0);
}`;
      const prog=gl.createProgram();
      gl.attachShader(prog,mkS(gl.VERTEX_SHADER,vs));
      gl.attachShader(prog,mkS(gl.FRAGMENT_SHADER,fs));
      gl.linkProgram(prog);gl.useProgram(prog);
      const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const ap=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(ap);
      gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);

      // Uniforms for font atlas
      gl.uniform1f(gl.getUniformLocation(prog,'charCount'),chars.length);
      gl.uniform1f(gl.getUniformLocation(prog,'atlasCols'),COLS);
      gl.uniform1f(gl.getUniformLocation(prog,'atlW'),aW);
      gl.uniform1f(gl.getUniformLocation(prog,'atlH'),aH);
      gl.uniform1f(gl.getUniformLocation(prog,'cW'),cellW);
      gl.uniform1f(gl.getUniformLocation(prog,'cH'),cellH);

      // Atlas texture (unit 1)
      const atlasTex=gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,atlasTex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ac);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

      // Scene texture (unit 0)
      const sceneTex=gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,sceneTex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);

      gl.uniform1i(gl.getUniformLocation(prog,'src'),0);
      gl.uniform1i(gl.getUniformLocation(prog,'atlas'),1);
      const uMouse0=gl.getUniformLocation(prog,'mouse');

      // Grab screen pos is updated by _cubeSpinUpdate from 3D projection

      gl.viewport(0,0,bgCanvas.width,bgCanvas.height);
      const self=this;
      function bgLoop(){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,sceneTex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,self.offscreenCanvas);
        const gp = self._grabScreenPos || {x:-1,y:-1};
        gl.uniform2f(uMouse0, gp.x, 1.0 - gp.y);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        self.bgShaderRAF=requestAnimationFrame(bgLoop);
      }
      this.bgShaderRAF=requestAnimationFrame(bgLoop);
      return;
    }

    // Crystal Core: red ASCII shader sampling 3D icosahedron
    if (gameIndex === 2 && this.offscreenCanvas) {
      const fs=`
precision mediump float;
varying vec2 v;
uniform float t;
uniform vec2 mouse;
uniform sampler2D src;
void main(){
  vec2 cell=vec2(60.0,80.0);
  vec2 cuv=floor(v*cell)/cell;
  vec2 suv=fract(v*cell);

  // Sample 3D scene
  vec2 sampleUV=vec2(cuv.x, 1.0-cuv.y);
  vec4 scene=texture2D(src, sampleUV);
  float lum=dot(scene.rgb, vec3(0.299,0.587,0.114));

  // Background detection
  vec3 bgCol=vec3(0.102,0.02,0.063);
  float distToBg=length(scene.rgb-bgCol);
  bool isCube=distToBg>0.08;

  // Noise for background pattern
  float hash=fract(sin(dot(cuv*500.0,vec2(127.1,311.7)))*43758.5453);
  float n=fract(sin(dot(cuv*200.0+t*0.3,vec2(12.9898,78.233)))*43758.5453);

  // Mouse ripple
  vec2 mp=vec2(mouse.x,1.0-mouse.y);
  float d=length(cuv-mp);
  float ripple=sin(d*20.0-t*3.0)*exp(-d*3.0)*0.3;

  // Character rendering
  float cw=0.7, ch=0.8;
  float inChar=step(abs(suv.x-0.5),cw*0.5)*step(abs(suv.y-0.5),ch*0.5);
  float ci=floor((isCube?lum:n)*8.0);
  float idx=mod(ci,8.0);
  float pattern=0.0;
  if(idx<1.0) pattern=step(0.45,length(suv-0.5));
  else if(idx<2.0) pattern=step(0.4,abs(suv.x-0.5))+step(0.4,abs(suv.y-0.5));
  else if(idx<3.0) pattern=step(0.6,suv.x+suv.y);
  else if(idx<4.0) pattern=step(0.35,abs(suv.y-0.5));
  else if(idx<5.0) pattern=1.0-step(0.3,length(suv-0.5));
  else if(idx<6.0) pattern=step(0.4,abs(suv.x-0.5));
  else if(idx<7.0) pattern=step(0.3,max(abs(suv.x-0.5),abs(suv.y-0.5)));
  else pattern=step(0.35,abs(suv.x-suv.y));

  float bright=isCube ? lum*1.2+0.3 : n*0.4+0.1;
  float mask=inChar*pattern*bright;

  // Colors — brighter on the 3D shape
  vec3 col1=vec3(0.85,0.1,0.3);
  vec3 col2=vec3(0.6,0.05,0.5);
  vec3 col3=vec3(1.0,0.3,0.5);
  float blend=isCube?lum:n;
  vec3 color=mix(col2,col1,blend);
  color=mix(color,col3,ripple+0.2);

  vec3 final_color=color*mask;
  final_color+=color*0.03;
  gl_FragColor=vec4(final_color,1.0);
}`;
      const prog=gl.createProgram();
      gl.attachShader(prog,mkS(gl.VERTEX_SHADER,vs));
      gl.attachShader(prog,mkS(gl.FRAGMENT_SHADER,fs));
      gl.linkProgram(prog);gl.useProgram(prog);
      const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const ap=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(ap);
      gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);

      const sceneTex=gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,sceneTex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(prog,'src'),0);

      const uT=gl.getUniformLocation(prog,'t');
      const uMouse=gl.getUniformLocation(prog,'mouse');
      let bmx=0.5,bmy=0.5;
      container.addEventListener('mousemove',function(e){
        const r=bgCanvas.getBoundingClientRect();
        bmx=(e.clientX-r.left)/r.width;
        bmy=1.0-(e.clientY-r.top)/r.height;
      });

      gl.viewport(0,0,bgCanvas.width,bgCanvas.height);
      const self=this;
      function bgLoop(time){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,sceneTex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,self.offscreenCanvas);
        gl.uniform1f(uT,time*0.001);
        gl.uniform2f(uMouse,bmx,bmy);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        self.bgShaderRAF=requestAnimationFrame(bgLoop);
      }
      this.bgShaderRAF=requestAnimationFrame(bgLoop);
      return;
    }

    // Default: procedural noise shader for other games
    const colors = [
      [0.1, 0.15, 0.1],
      [0.05, 0.1, 0.12],
      [0.12, 0.05, 0.08],
    ];
    const col = colors[gameIndex] || colors[0];

    const fs=`
precision mediump float;
varying vec2 v;
uniform float t;
uniform vec2 res;
uniform vec3 baseCol;
uniform float charCount,atlasCols,atlasW,atlasH,cellW,cellH;
uniform sampler2D atlas;
uniform vec2 mouse;
void main(){
  vec2 grid=vec2(res.x/(cellW*0.6), res.y/(cellH*0.6));
  vec2 cell=floor(v*grid);
  vec2 sub=fract(v*grid);
  float wave=sin(cell.x*0.3+cell.y*0.2+t*0.5)*0.5+0.5;
  float drift=sin(t*0.3+cell.y*0.1)*0.3;
  float ci=mod(floor((wave+drift)*charCount),charCount);
  vec2 cellCenter=(cell+0.5)/grid;
  vec2 mpos=vec2(mouse.x,1.0-mouse.y);
  float md=length(cellCenter-mpos);
  float near=smoothstep(0.15,0.0,md);
  ci=mod(ci+near*15.0*sin(t*10.0+cell.x*13.0+cell.y*29.0),charCount);
  float col2=mod(ci,atlasCols);
  float row=floor(ci/atlasCols);
  vec2 auv=vec2((col2+sub.x)*cellW/atlasW,(row+sub.y)*cellH/atlasH);
  float a=texture2D(atlas,auv).r;
  float brightness=wave*0.4+0.1;
  vec3 color=baseCol*a*brightness*2.0;
  gl_FragColor=vec4(color,1.0);
}`;

    const prog=gl.createProgram();
    gl.attachShader(prog,mkS(gl.VERTEX_SHADER,vs));
    gl.attachShader(prog,mkS(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(prog);gl.useProgram(prog);
    const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const ap=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);

    gl.uniform1f(gl.getUniformLocation(prog,'charCount'),chars.length);
    gl.uniform1f(gl.getUniformLocation(prog,'atlasCols'),COLS);
    gl.uniform1f(gl.getUniformLocation(prog,'atlasW'),aW);
    gl.uniform1f(gl.getUniformLocation(prog,'atlasH'),aH);
    gl.uniform1f(gl.getUniformLocation(prog,'cellW'),cellW);
    gl.uniform1f(gl.getUniformLocation(prog,'cellH'),cellH);
    gl.uniform3f(gl.getUniformLocation(prog,'baseCol'),col[0],col[1],col[2]);
    gl.uniform2f(gl.getUniformLocation(prog,'res'),bgCanvas.width,bgCanvas.height);

    const atlasTex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,atlasTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ac);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

    const uT=gl.getUniformLocation(prog,'t');
    const uMouse=gl.getUniformLocation(prog,'mouse');
    let bmx=0.5,bmy=0.5;
    container.addEventListener('mousemove',function(e){
      const r=bgCanvas.getBoundingClientRect();
      bmx=(e.clientX-r.left)/r.width;
      bmy=(e.clientY-r.top)/r.height;
    });

    gl.viewport(0,0,bgCanvas.width,bgCanvas.height);
    const self=this;
    function bgLoop(time){
      gl.uniform1f(uT,time*0.001);
      gl.uniform2f(uMouse,bmx,bmy);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      self.bgShaderRAF=requestAnimationFrame(bgLoop);
    }
    this.bgShaderRAF=requestAnimationFrame(bgLoop);
  },

  stopBgShader() {
    if (this.bgShaderRAF) { cancelAnimationFrame(this.bgShaderRAF); this.bgShaderRAF = null; }
    const bgCanvas = document.getElementById('game-bg-shader');
    if (bgCanvas) bgCanvas.style.display = 'none';
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
        // Auto-open piano roll for Crystal Core
        pianoRoll.show();
        break;
      default:
        this.createGame1();
    }
  },

  // Placeholder games - replace with your actual game logic
  createGame1() {
    const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    this.currentGame = { type: 'cube', object: cube };
    this.camera.position.set(0, 0, 6);

    // Drag to spin with 3D grab point tracking
    let dragging = false, prevX = 0, prevY = 0;
    let velX = 0.005, velY = 0.005;
    const container = document.querySelector('.game-content');
    const raycaster = new THREE.Raycaster();
    const mouse2 = new THREE.Vector2();
    this._grabPoint = null; // 3D point on cube (in cube local space)
    this._grabScreenPos = { x: -1, y: -1 }; // projected screen pos

    const self = this;
    container.addEventListener('mousedown', (e) => {
      dragging = true; prevX = e.clientX; prevY = e.clientY;
      velX = 0; velY = 0;
      // Raycast to find grab point on cube
      const r = container.getBoundingClientRect();
      mouse2.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(mouse2, self.camera);
      const hits = raycaster.intersectObject(cube);
      if (hits.length > 0) {
        self._grabPoint = cube.worldToLocal(hits[0].point.clone());
        self._grabNormal = hits[0].face.normal.clone(); // local space normal
      } else {
        self._grabPoint = null;
        self._grabNormal = null;
        self._grabScreenPos = { x: -1, y: -1 };
      }
    });
    container.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      cube.rotation.y += dx * 0.01;
      cube.rotation.x += dy * 0.01;
      velX = dy * 0.01; velY = dx * 0.01;
      prevX = e.clientX; prevY = e.clientY;
    });
    container.addEventListener('mouseup', () => { dragging = false; self._grabPoint = null; self._grabNormal = null; self._grabScreenPos = {x:-1,y:-1}; });
    container.addEventListener('mouseleave', () => { dragging = false; self._grabPoint = null; self._grabNormal = null; self._grabScreenPos = {x:-1,y:-1}; });
    // Touch support
    container.addEventListener('touchstart', (e) => {
      dragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
      velX = 0; velY = 0;
    });
    container.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - prevX, dy = e.touches[0].clientY - prevY;
      cube.rotation.y += dx * 0.01;
      cube.rotation.x += dy * 0.01;
      velX = dy * 0.01; velY = dx * 0.01;
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
    });
    container.addEventListener('touchend', () => { dragging = false; self._grabPoint = null; self._grabNormal = null; self._grabScreenPos = {x:-1,y:-1}; });
    this._cubeSpinUpdate = () => {
      if (!dragging) {
        cube.rotation.x += velX;
        cube.rotation.y += velY;
        velX *= 0.98; velY *= 0.98;
        if (Math.abs(velX) < 0.001 && Math.abs(velY) < 0.001) {
          velX = 0.003; velY = 0.005;
        }
      }
      // Project grab point to screen space (only if face is visible)
      if (self._grabPoint && self._grabNormal) {
        // Transform normal to world space
        const wn = self._grabNormal.clone().applyMatrix3(
          new THREE.Matrix3().getNormalMatrix(cube.matrixWorld)
        ).normalize();
        // Camera direction (camera looks down -Z in its local space)
        const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(self.camera.quaternion);
        // If normal faces away from camera, hide grab
        if (wn.dot(camDir) > -0.05) {
          self._grabScreenPos = { x: -1, y: -1 };
        } else {
          const wp = self._grabPoint.clone();
          cube.localToWorld(wp);
          wp.project(self.camera);
          self._grabScreenPos = {
            x: (wp.x * 0.5 + 0.5),
            y: (wp.y * 0.5 + 0.5)
          };
        }
      }
    };
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
      if (this._cubeSpinUpdate) {
        this._cubeSpinUpdate();
      } else {
        this.currentGame.object.rotation.x += 0.01;
        this.currentGame.object.rotation.y += 0.01;
      }
    }

    // Signal Drift & Cube Runner: render to offscreen canvas (shader reads it as texture)
    if ((this.currentGameIndex === 0 || this.currentGameIndex === 1 || this.currentGameIndex === 2) && this.offscreenRenderer) {
      this.offscreenRenderer.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
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
    // Hide piano roll if open
    pianoRoll.hide();
    
    // Stop music and visualizer
    musicPlayer.stop();
    visualizerController.stop();

    // Stop bg shader
    this.stopBgShader();

    // Clean up offscreen renderer
    if (this.offscreenRenderer) {
      this.offscreenRenderer.dispose();
      this.offscreenRenderer = null;
      this.offscreenCanvas = null;
    }
    // Restore game canvas visibility
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) gameCanvas.style.display = '';

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
      this._cubeSpinUpdate = null;
    }

    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.currentGameIndex = null;
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
    pianoRollVisualizer.resize();
  }, 100);
});

// Handle orientation change specifically (fires before resize on some devices)
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    updateSlotPosition();
    gameManager.resize();
    pianoRollVisualizer.resize();
  }, 150);
});
