// Web Audio API Procedural Sound FX Engine & BGM Controller for Operation Dhurandar

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// BGM State
const BGM_SOURCES = [
  'https://dhurandar-assets.pages.dev/audio/army_of_minotaur.mp3',
  './assets/audio/army_of_minotaur.mp3',
  './cdn-assets/audio/army_of_minotaur.mp3'
];

let bgmAudio = null;
let bgmCurrentSrcIndex = 0;
let bgmFadeInterval = null;
let isBgmPlaying = false;
const TARGET_BGM_VOLUME = 0.4;

function initBgmAudio() {
  if (bgmAudio) return bgmAudio;
  
  bgmAudio = new Audio();
  bgmAudio.loop = true;
  bgmAudio.volume = 0;
  bgmAudio.preload = 'auto';
  bgmAudio.src = BGM_SOURCES[bgmCurrentSrcIndex];

  bgmAudio.addEventListener('error', (e) => {
    console.warn(`BGM failed to load from ${BGM_SOURCES[bgmCurrentSrcIndex]}, trying fallback...`);
    if (bgmCurrentSrcIndex < BGM_SOURCES.length - 1) {
      bgmCurrentSrcIndex++;
      bgmAudio.src = BGM_SOURCES[bgmCurrentSrcIndex];
      if (isBgmPlaying) {
        bgmAudio.play().catch(err => console.warn('BGM fallback play error:', err));
      }
    }
  });

  return bgmAudio;
}

export const Sound = {
  // --- BACKGROUND MUSIC ENGINE (MAIN MENU ONLY) ---
  playMenuMusic() {
    try {
      const audio = initBgmAudio();
      isBgmPlaying = true;
      
      if (bgmFadeInterval) clearInterval(bgmFadeInterval);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Smooth fade in
          let vol = audio.volume;
          bgmFadeInterval = setInterval(() => {
            if (vol < TARGET_BGM_VOLUME) {
              vol = Math.min(TARGET_BGM_VOLUME, vol + 0.04);
              audio.volume = vol;
            } else {
              clearInterval(bgmFadeInterval);
              bgmFadeInterval = null;
            }
          }, 40);
        }).catch(err => {
          console.warn('Autoplay blocked or audio load error:', err);
        });
      }
    } catch (e) {
      console.warn('playMenuMusic error:', e);
    }
  },

  stopMenuMusic(immediate = false) {
    if (!bgmAudio) return;
    isBgmPlaying = false;
    
    if (bgmFadeInterval) clearInterval(bgmFadeInterval);

    if (immediate) {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
      bgmAudio.volume = 0;
      return;
    }

    // Smooth fade out
    let vol = bgmAudio.volume;
    bgmFadeInterval = setInterval(() => {
      if (vol > 0.02) {
        vol = Math.max(0, vol - 0.05);
        bgmAudio.volume = vol;
      } else {
        bgmAudio.volume = 0;
        bgmAudio.pause();
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
      }
    }, 30);
  },

  // Beep when typing or clicking buttons
  beep(freq = 800, duration = 0.05, type = 'sine') {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn(e);
    }
  },

  // Mechanical Camera Shutter click + flash
  shutter() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      // Click 1 (Mirror flip)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(320, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.04);

      // Click 2 (Curtain close)
      setTimeout(() => {
        if (!ctx) return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(180, ctx.currentTime);
        gain2.gain.setValueAtTime(0.4, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.08);
      }, 50);
    } catch (e) {
      console.warn(e);
    }
  },

  // Radar proximity alert
  radarPing(freq = 1200) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn(e);
    }
  },

  // Tactical Military Rifle Gunshot (Noise burst snap + sub-bass punch + echo tail)
  gunshot() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Supersonic Bullet Crack / White Noise Burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.15);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1400, now);
      noiseFilter.Q.setValueAtTime(1.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);

      // 2. Sub-Bass Powder Explosion Punch
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);

      oscGain.gain.setValueAtTime(0.9, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);

      // 3. Metallic Ejection Click
      setTimeout(() => {
        if (!ctx) return;
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(2400, ctx.currentTime);
        clickGain.gain.setValueAtTime(0.12, ctx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start();
        clickOsc.stop(ctx.currentTime + 0.025);
      }, 70);
    } catch (e) {
      console.warn(e);
    }
  },

  // Hit impact confirmation sound
  hitImpact() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn(e);
    }
  },

  // 5-second countdown urgency tick
  countdownTick(secondsLeft) {
    const pitch = 600 + (5 - secondsLeft) * 150;
    this.beep(pitch, 0.08, 'sawtooth');
  },

  // Solemn tribute chime
  tributeChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C - E - G - C
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 1.8);
        }, idx * 280);
      });
    } catch (e) {
      console.warn(e);
    }
  },

  // Hostile elimination death scream
  deathScream() {
    try {
      const screamSources = [
        '/audio/scream.mp3',
        '/audio/scream.wav',
        '/assets/audio/scream.mp3',
        './audio/scream.mp3',
        './audio/scream.wav'
      ];

      const audio = new Audio();
      audio.volume = 0.9;
      let currentIdx = 0;
      audio.src = screamSources[currentIdx];

      audio.addEventListener('error', () => {
        if (currentIdx < screamSources.length - 1) {
          currentIdx++;
          audio.src = screamSources[currentIdx];
          audio.play().catch(() => this.proceduralScream());
        } else {
          this.proceduralScream();
        }
      });

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          this.proceduralScream();
        });
      }
    } catch (e) {
      this.proceduralScream();
    }
  },

  proceduralScream() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(95, ctx.currentTime + 0.85);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.85);
    } catch (e) {}
  },

  // Tactical Commando Footstep (Low thud + boot scuff)
  footstep() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Low Thud Impact
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.09);
      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);

      // 2. Gravel / Boot Texture Rustle
      const bufferSize = Math.floor(ctx.sampleRate * 0.06);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
    } catch (e) {
      console.warn(e);
    }
  },

  // Cover Blocked Ricochet Ping / Deflection
  coverBlocked() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Metallic Ricochet Whine
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.22);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);

      // Heavy dull obstacle thud
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(160, now);
      thud.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      thudGain.gain.setValueAtTime(0.4, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.12);
    } catch (e) {
      console.warn(e);
    }
  },

  // Range Acquired / Breach Proximity Lock
  rangeAcquired() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [1046.50, 1318.51].forEach((freq, i) => { // C6, E6
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.2, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.12);
      });
    } catch (e) {
      console.warn(e);
    }
  }
};
