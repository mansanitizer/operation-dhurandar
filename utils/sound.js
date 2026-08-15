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
const BGM_MENU_SOURCES = [
  'https://dhurandar-assets.pages.dev/audio/army_of_minotaur.mp3',
  './assets/audio/army_of_minotaur.mp3',
  './cdn-assets/audio/army_of_minotaur.mp3'
];

const BGM_LOGIN_SOURCES = [
  'https://dhurandar-assets.pages.dev/audio/login_theme.mp3',
  './assets/audio/login_theme.mp3',
  './cdn-assets/audio/login_theme.mp3'
];

let menuBgmAudio = null;
let menuBgmCurrentSrcIndex = 0;
let menuFadeInterval = null;

let loginBgmAudio = null;
let loginBgmCurrentSrcIndex = 0;
let loginFadeInterval = null;

let activeBgm = null; // 'login' | 'menu' | null
const TARGET_BGM_VOLUME = 0.45;
const TARGET_LOGIN_VOLUME = 0.38;

function initLoginBgmAudio() {
  if (loginBgmAudio) return loginBgmAudio;
  
  loginBgmAudio = new Audio();
  loginBgmAudio.loop = true;
  loginBgmAudio.volume = 0;
  loginBgmAudio.preload = 'auto';
  loginBgmAudio.src = BGM_LOGIN_SOURCES[loginBgmCurrentSrcIndex];

  loginBgmAudio.addEventListener('error', () => {
    console.warn(`Login BGM failed from ${BGM_LOGIN_SOURCES[loginBgmCurrentSrcIndex]}, falling back...`);
    if (loginBgmCurrentSrcIndex < BGM_LOGIN_SOURCES.length - 1) {
      loginBgmCurrentSrcIndex++;
      loginBgmAudio.src = BGM_LOGIN_SOURCES[loginBgmCurrentSrcIndex];
      if (activeBgm === 'login') {
        loginBgmAudio.play().catch(err => console.warn('Login BGM fallback play error:', err));
      }
    }
  });

  return loginBgmAudio;
}

function initMenuBgmAudio() {
  if (menuBgmAudio) return menuBgmAudio;
  
  menuBgmAudio = new Audio();
  menuBgmAudio.loop = true;
  menuBgmAudio.volume = 0;
  menuBgmAudio.preload = 'auto';
  menuBgmAudio.src = BGM_MENU_SOURCES[menuBgmCurrentSrcIndex];

  menuBgmAudio.addEventListener('error', () => {
    console.warn(`Menu BGM failed from ${BGM_MENU_SOURCES[menuBgmCurrentSrcIndex]}, falling back...`);
    if (menuBgmCurrentSrcIndex < BGM_MENU_SOURCES.length - 1) {
      menuBgmCurrentSrcIndex++;
      menuBgmAudio.src = BGM_MENU_SOURCES[menuBgmCurrentSrcIndex];
      if (activeBgm === 'menu') {
        menuBgmAudio.play().catch(err => console.warn('Menu BGM fallback play error:', err));
      }
    }
  });

  return menuBgmAudio;
}

// Global user interaction unblocker for autoplay restrictions
let hasUserInteracted = false;
function registerAutoplayUnlock() {
  if (hasUserInteracted) return;
  const unlocker = () => {
    hasUserInteracted = true;
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    
    if (activeBgm === 'login' && loginBgmAudio && loginBgmAudio.paused) {
      loginBgmAudio.play().catch(() => {});
    } else if (activeBgm === 'menu' && menuBgmAudio && menuBgmAudio.paused) {
      menuBgmAudio.play().catch(() => {});
    }
    
    window.removeEventListener('pointerdown', unlocker);
    window.removeEventListener('keydown', unlocker);
    window.removeEventListener('touchstart', unlocker);
  };
  window.addEventListener('pointerdown', unlocker);
  window.addEventListener('keydown', unlocker);
  window.addEventListener('touchstart', unlocker);
}

registerAutoplayUnlock();

export const Sound = {
  // --- LOGIN SCREEN BGM ---
  playLoginMusic() {
    try {
      this.stopMenuMusic(true);
      activeBgm = 'login';
      const audio = initLoginBgmAudio();
      
      if (loginFadeInterval) clearInterval(loginFadeInterval);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          let vol = audio.volume;
          loginFadeInterval = setInterval(() => {
            if (vol < TARGET_LOGIN_VOLUME) {
              vol = Math.min(TARGET_LOGIN_VOLUME, vol + 0.03);
              audio.volume = vol;
            } else {
              clearInterval(loginFadeInterval);
              loginFadeInterval = null;
            }
          }, 40);
        }).catch(err => {
          console.warn('Login BGM autoplay waiting for first user gesture:', err);
        });
      }
    } catch (e) {
      console.warn('playLoginMusic error:', e);
    }
  },

  stopLoginMusic(immediate = false) {
    if (!loginBgmAudio) return;
    if (activeBgm === 'login') activeBgm = null;
    
    if (loginFadeInterval) clearInterval(loginFadeInterval);

    if (immediate) {
      loginBgmAudio.pause();
      loginBgmAudio.currentTime = 0;
      loginBgmAudio.volume = 0;
      return;
    }

    let vol = loginBgmAudio.volume;
    loginFadeInterval = setInterval(() => {
      if (vol > 0.02) {
        vol = Math.max(0, vol - 0.05);
        loginBgmAudio.volume = vol;
      } else {
        loginBgmAudio.volume = 0;
        loginBgmAudio.pause();
        loginBgmAudio.currentTime = 0;
        clearInterval(loginFadeInterval);
        loginFadeInterval = null;
      }
    }, 30);
  },

  // --- MAIN MENU BGM ---
  playMenuMusic() {
    try {
      this.stopLoginMusic(true);
      activeBgm = 'menu';
      const audio = initMenuBgmAudio();
      
      if (menuFadeInterval) clearInterval(menuFadeInterval);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          let vol = audio.volume;
          menuFadeInterval = setInterval(() => {
            if (vol < TARGET_BGM_VOLUME) {
              vol = Math.min(TARGET_BGM_VOLUME, vol + 0.04);
              audio.volume = vol;
            } else {
              clearInterval(menuFadeInterval);
              menuFadeInterval = null;
            }
          }, 40);
        }).catch(err => {
          console.warn('Menu BGM autoplay waiting for user interaction:', err);
        });
      }
    } catch (e) {
      console.warn('playMenuMusic error:', e);
    }
  },

  stopMenuMusic(immediate = false) {
    if (!menuBgmAudio) return;
    if (activeBgm === 'menu') activeBgm = null;
    
    if (menuFadeInterval) clearInterval(menuFadeInterval);

    if (immediate) {
      menuBgmAudio.pause();
      menuBgmAudio.currentTime = 0;
      menuBgmAudio.volume = 0;
      return;
    }

    let vol = menuBgmAudio.volume;
    menuFadeInterval = setInterval(() => {
      if (vol > 0.02) {
        vol = Math.max(0, vol - 0.05);
        menuBgmAudio.volume = vol;
      } else {
        menuBgmAudio.volume = 0;
        menuBgmAudio.pause();
        menuBgmAudio.currentTime = 0;
        clearInterval(menuFadeInterval);
        menuFadeInterval = null;
      }
    }, 30);
  },

  stopAllMusic(immediate = false) {
    this.stopLoginMusic(immediate);
    this.stopMenuMusic(immediate);
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

  // Radar proximity alert with Spatial Audio Stereo Panning (-1.0 Left to +1.0 Right)
  radarPing(freq = 1200, pan = 0) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      let panner = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      }

      if (panner) {
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn(e);
    }
  },

  // Tactical Commando Footstep (Low thud + boot scuff with spatial pan)
  footstep(pan = 0) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      let panner = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
      }

      // 1. Low Thud Impact
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.09);
      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      
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

      const master = ctx.createGain();
      master.gain.setValueAtTime(1.0, now);

      osc.connect(oscGain);
      oscGain.connect(master);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);

      if (panner) {
        master.connect(panner);
        panner.connect(ctx.destination);
      } else {
        master.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 0.09);
      noise.start(now);
    } catch (e) {
      console.warn(e);
    }
  },

  // Adrenaline Heartbeat Pulse (Visceral Lub-Dub for high tension / low time)
  heartbeat(urgency = 1.0) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // First beat (Lub - 50Hz punch)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(55, now);
      osc1.frequency.exponentialRampToValueAtTime(25, now + 0.12);
      gain1.gain.setValueAtTime(0.45 * Math.min(1.5, urgency), now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Second beat (Dub - 40Hz punch after 120ms)
      setTimeout(() => {
        if (!ctx) return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(45, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.16);
        gain2.gain.setValueAtTime(0.35 * Math.min(1.5, urgency), ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.16);
      }, 120);
    } catch (e) {
      console.warn(e);
    }
  },

  // Tactical Radio Squelch Burst (Opening/closing secure comms channel)
  radioSquelch() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.08);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2.5, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    } catch (e) {}
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
  },

  // Solemn tribute chime & Patriotic harmonic resonance
  tributeChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.0);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 2.0);
        }, idx * 220);
      });
    } catch (e) {
      console.warn(e);
    }
  },

  // Hostile elimination death scream
  deathScream() {
    try {
      const screamSources = [
        './assets/audio/scream.mp3',
        './assets/audio/scream.wav',
        './assets/audio/scream_tactical.wav',
        './assets/audio/scream_dramatic.wav',
        'https://dhurandar-assets.pages.dev/audio/scream.mp3'
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
  }
};

