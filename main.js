import { targets } from './data/targets.js';
import { memorials } from './data/memorials.js';
import { Sound } from './utils/sound.js';
import { arEngine } from './utils/arEngine.js';

// --- GAME STATE ---
const state = {
  currentScreen: 'screen-auth',
  agentName: 'AGENT DHURANDAR',
  targetIndex: 0,
  memorialIndex: 0,
  soundEnabled: true,
  
  // Mission & AR State
  arInitialized: false,
  missionTimerInterval: null,
  timeLeft: 5.0,
  isTargetLocked: false,
  capturedEvidence: null
};

// --- DOM ELEMENTS ---
const screens = {
  auth: document.getElementById('screen-auth'),
  menu: document.getElementById('screen-menu'),
  briefing: document.getElementById('screen-briefing'),
  dossier: document.getElementById('screen-dossier'),
  mission: document.getElementById('screen-mission'),
  result: document.getElementById('screen-result'),
  archives: document.getElementById('screen-archives'),
  heroes: document.getElementById('screen-heroes')
};

// --- SOUND WRAPPER ---
function playSound(action, ...args) {
  if (state.soundEnabled && Sound[action]) {
    Sound[action](...args);
  }
}

// --- SCREEN NAVIGATION ---
function showScreen(screenKey) {
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });
  if (screens[screenKey]) {
    screens[screenKey].classList.add('active');
    state.currentScreen = screenKey;
  }
}

// --- PRELOAD ASSETS ---
function preloadGameAssets() {
  targets.forEach(t => {
    const img1 = new Image();
    img1.src = t.bodySprite;
    const img2 = new Image();
    img2.src = t.faceImage;
  });
  memorials.forEach(m => {
    const img = new Image();
    img.src = m.image;
  });
}

// --- INITIALIZE APPLICATION ---
function init() {
  preloadGameAssets();

  // 1. Audio Toggle
  const btnSound = document.getElementById('btn-sound-toggle');
  btnSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
    if (state.soundEnabled) playSound('beep', 900);
  });

  // 2. Screen 1: Auth Button & Enter Key Handling
  const btnLogin = document.getElementById('btn-login');
  const nameInput = document.getElementById('agent-name');
  const passInput = document.getElementById('agent-passcode');

  const doLogin = () => {
    const nameVal = nameInput ? nameInput.value.trim() : '';
    if (nameVal) {
      state.agentName = nameVal.toUpperCase();
    } else {
      state.agentName = 'AGENT DHURANDAR';
    }
    playSound('beep', 1000);
    loadMainMenuScreen();
  };

  if (btnLogin) {
    btnLogin.addEventListener('click', doLogin);
    btnLogin.addEventListener('touchend', (e) => {
      e.preventDefault();
      doLogin();
    });
  }

  [nameInput, passInput].forEach(input => {
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doLogin();
        }
      });
    }
  });

  // 3. Screen 2: Main Menu Navigation
  document.getElementById('btn-menu-campaign').addEventListener('click', () => {
    playSound('beep', 850);
    loadBriefingScreen();
  });

  document.getElementById('btn-menu-archives').addEventListener('click', () => {
    playSound('beep', 800);
    loadArchivesScreen();
  });

  document.getElementById('btn-menu-heroes').addEventListener('click', () => {
    playSound('tributeChime');
    loadHeroesScreen();
  });

  document.getElementById('btn-menu-logout').addEventListener('click', () => {
    playSound('beep', 500);
    showScreen('auth');
  });

  // 4. Back Buttons
  document.getElementById('btn-back-from-archives').addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-back-from-heroes').addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-back-to-menu-from-dossier').addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-result-menu').addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-abort-mission').addEventListener('click', () => {
    playSound('beep', 500);
    clearInterval(state.missionTimerInterval);
    arEngine.stop();
    showScreen('menu');
  });

  // 5. Briefing & Dossier
  document.getElementById('btn-open-dossier').addEventListener('click', () => {
    playSound('beep', 850);
    loadDossierScreen();
  });

  document.getElementById('btn-start-mission').addEventListener('click', async () => {
    playSound('beep', 1200);
    await start3DAR();
  });

  // 6. Camera Switch & Shutter
  document.getElementById('btn-camera-toggle').addEventListener('click', async () => {
    playSound('beep', 1100);
    await arEngine.requestPermissions();
  });

  document.getElementById('btn-shutter').addEventListener('click', handleShutterCapture);

  // 7. Result Screen Loops
  document.getElementById('btn-next-mission').addEventListener('click', () => {
    playSound('beep', 800);
    state.targetIndex = (state.targetIndex + 1) % targets.length;
    state.memorialIndex = (state.memorialIndex + 1) % memorials.length;
    loadBriefingScreen();
  });

  document.getElementById('btn-replay').addEventListener('click', () => {
    playSound('beep', 800);
    loadDossierScreen();
  });

  document.getElementById('btn-salute').addEventListener('click', () => {
    playSound('tributeChime');
    const saluteBtn = document.getElementById('btn-salute');
    const saluteText = document.getElementById('salute-text');
    saluteText.textContent = 'SALUTED WITH HIGHEST HONORS 🇮🇳';
    saluteBtn.style.background = 'rgba(255, 153, 51, 0.3)';
    saluteBtn.style.borderColor = '#00ff88';
  });
}

// --- SCREEN LOADERS ---
function loadMainMenuScreen() {
  document.getElementById('menu-agent-name').textContent = state.agentName;
  showScreen('menu');
}

function loadBriefingScreen() {
  document.getElementById('briefing-agent-callsign').textContent = state.agentName;
  showScreen('briefing');
}

function loadDossierScreen() {
  const currentTarget = targets[state.targetIndex];
  
  document.getElementById('dossier-face').src = currentTarget.faceImage;
  document.getElementById('dossier-body').src = currentTarget.bodySprite;
  document.getElementById('dossier-codename').textContent = currentTarget.codename;
  document.getElementById('dossier-name').textContent = currentTarget.name;
  document.getElementById('dossier-threat').textContent = currentTarget.threatLevel;
  document.getElementById('dossier-location').textContent = currentTarget.lastSeen;
  document.getElementById('dossier-desc').textContent = currentTarget.description;
  document.getElementById('dossier-marks').textContent = currentTarget.identifyingMarks;

  showScreen('dossier');
}

function loadArchivesScreen() {
  const container = document.getElementById('archives-list');
  container.innerHTML = '';

  targets.forEach((target) => {
    const card = document.createElement('div');
    card.className = 'archive-card';
    card.innerHTML = `
      <img src="${target.faceImage}" alt="${target.codename}" />
      <div class="archive-card-body">
        <span class="archive-threat-tag">${target.threatLevel}</span>
        <h3>${target.codename} (${target.name})</h3>
        <p class="archive-desc"><b>Role:</b> ${target.role}</p>
        <p class="archive-desc"><b>Last Seen:</b> ${target.lastSeen}</p>
      </div>
    `;
    container.appendChild(card);
  });

  showScreen('archives');
}

function loadHeroesScreen() {
  const container = document.getElementById('heroes-list');
  container.innerHTML = '';

  memorials.forEach((hero) => {
    const card = document.createElement('div');
    card.className = 'hero-gallery-card';
    card.innerHTML = `
      <img src="${hero.image}" alt="${hero.name}" />
      <div class="hero-gallery-body">
        <span class="archive-threat-tag" style="color: var(--accent-gold);">${hero.decoration}</span>
        <h3>${hero.name}</h3>
        <p class="hero-gallery-desc"><b>Unit:</b> ${hero.unit}</p>
        <p class="hero-gallery-desc"><b>Action:</b> ${hero.operation}</p>
        <p class="hero-gallery-desc" style="font-style: italic; color: #fff;">${hero.quote}</p>
      </div>
    `;
    container.appendChild(card);
  });

  showScreen('heroes');
}

// --- 3D AR MISSION INITIALIZATION ---
async function start3DAR() {
  showScreen('mission');

  const viewport = document.getElementById('spatial-viewport');
  const videoElem = document.getElementById('camera-feed');

  // Request Permissions (Camera & iOS DeviceOrientation)
  await arEngine.requestPermissions();

  // Initialize Canvas AR layer if not done
  if (!state.arInitialized) {
    arEngine.init(viewport, videoElem, handleARTelemetry);
    state.arInitialized = true;
  }

  // Reset Mission & Hunting State
  state.missionState = 'HUNTING';
  state.timerStarted = false;
  state.timeLeft = 5.0;
  arEngine.isSpawned = false;
  if (state.missionTimerInterval) clearInterval(state.missionTimerInterval);
  if (state.spawnTimeout) clearTimeout(state.spawnTimeout);

  // Set HUD to Hunting Mode
  const timerElem = document.getElementById('mission-timer');
  timerElem.textContent = 'STANDBY (HUNTING)';
  timerElem.style.color = '#00f2fe';

  const statusBadge = document.getElementById('hud-status');
  statusBadge.textContent = '🔍 HUNTING MODE: MOVE & SWEEP 360° ENVIRONMENT...';
  statusBadge.style.borderColor = 'rgba(0, 242, 254, 0.4)';
  statusBadge.style.color = '#00f2fe';

  // Periodic ambient radar sweep pulse during hunting
  playSound('radarPing', 900);

  // Dynamic Spawning Trigger: Hostile appears after 3.5 to 7.0 seconds of hunting
  const huntDelay = 3500 + Math.random() * 3500;
  state.spawnTimeout = setTimeout(() => {
    if (state.currentScreen === 'mission' && !state.timerStarted) {
      state.missionState = 'NEARBY';
      
      // Spawn target in 3D physical room space (offset from player view)
      const currentTarget = targets[state.targetIndex];
      arEngine.spawnTarget(currentTarget.bodySprite);

      // Proximity Alert Audio & Visuals
      playSound('radarPing', 1500);
      statusBadge.textContent = '⚠️ PROXIMITY ALERT: HOSTILE IN SECTOR — LOCATE NOW!';
      statusBadge.style.borderColor = '#ff9933';
      statusBadge.style.color = '#ff9933';
    }
  }, huntDelay);
}

function start5SecondWindow() {
  state.timerStarted = true;
  state.missionState = 'ENGAGED';
  state.timeLeft = 5.0;

  const timerElem = document.getElementById('mission-timer');
  timerElem.style.color = '#ff334b';

  const statusBadge = document.getElementById('hud-status');
  statusBadge.textContent = '🚨 TARGET IN SIGHT — 5s ENGAGEMENT WINDOW!';
  statusBadge.style.borderColor = '#ff334b';
  statusBadge.style.color = '#ff334b';

  playSound('beep', 1200, 'sawtooth');

  const tickIntervalMs = 50;
  let lastSecondInt = 5;

  state.missionTimerInterval = setInterval(() => {
    state.timeLeft = Math.max(0, state.timeLeft - (tickIntervalMs / 1000));
    timerElem.textContent = state.timeLeft.toFixed(2) + 's';

    const currentSec = Math.ceil(state.timeLeft);
    if (currentSec !== lastSecondInt && currentSec > 0) {
      playSound('countdownTick', currentSec);
      lastSecondInt = currentSec;
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.missionTimerInterval);
      handleMissionOutcome(false, 'TIMEOUT');
    }
  }, tickIntervalMs);
}

// Telemetry Callback from AR Engine
function handleARTelemetry(data) {
  const { isInViewfinder, isLocked, distance, azimuth, directionHint } = data;
  state.isTargetLocked = isLocked;

  // Real-time Direction Pointer & Range
  const radarAzimuth = document.getElementById('radar-azimuth');
  radarAzimuth.textContent = directionHint || `${azimuth}°`;
  if (directionHint && directionHint.includes('TURN')) {
    radarAzimuth.style.color = '#ff9933';
  } else {
    radarAzimuth.style.color = '#00ff88';
  }

  document.getElementById('radar-distance').textContent = distance > 0 ? `RANGE: ${distance}m` : 'RANGE: SCANNING';

  const lockonIndicator = document.getElementById('lockon-indicator');
  const statusBadge = document.getElementById('hud-status');

  // Trigger 5-Second Window when target FIRST enters Viewfinder
  if (isInViewfinder && !state.timerStarted && state.currentScreen === 'mission') {
    start5SecondWindow();
  }

  if (isLocked) {
    lockonIndicator.classList.add('active');
    statusBadge.textContent = '⚡ TARGET LOCKED IN CROSSHAIRS!';
    statusBadge.style.borderColor = '#00ff88';
    statusBadge.style.color = '#00ff88';
  } else {
    lockonIndicator.classList.remove('active');
    if (state.timerStarted) {
      statusBadge.textContent = '🚨 TARGET IN SIGHT — ALIGN CROSSHAIRS!';
      statusBadge.style.borderColor = '#ff334b';
      statusBadge.style.color = '#ff334b';
    }
  }
}

// Shutter Snapshot Capture
function handleShutterCapture() {
  if (state.timeLeft <= 0) return;

  playSound('shutter');

  // Flash Effect
  const flash = document.getElementById('shutter-flash');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 350);

  clearInterval(state.missionTimerInterval);

  // Capture Photo Snapshot
  state.capturedEvidence = arEngine.captureEvidencePhoto();

  // Evaluate Lockon
  if (state.isTargetLocked) {
    handleMissionOutcome(true, 'CAPTURED');
  } else {
    handleMissionOutcome(false, 'OFF_TARGET');
  }
}

// --- MISSION DEBRIEF & IN MEMORIAM ---
function handleMissionOutcome(isSuccess, reason) {
  const currentTarget = targets[state.targetIndex];
  const currentMemorial = memorials[state.memorialIndex];

  const resultHeader = document.getElementById('result-header');
  const resultBadge = document.getElementById('result-badge');
  const resultTitle = document.getElementById('result-title');
  const resultSubtitle = document.getElementById('result-subtitle');
  const evidenceImg = document.getElementById('result-evidence-img');

  // Set Evidence Photo
  evidenceImg.src = state.capturedEvidence || currentTarget.faceImage;

  if (isSuccess) {
    resultHeader.className = 'result-header success';
    resultBadge.textContent = 'MISSION ACCOMPLISHED // THREAT NEUTRALIZED';
    resultTitle.textContent = 'GOOD JOB AGENT — NEVER FORGET';
    resultSubtitle.textContent = `Target ${currentTarget.codename} successfully identified and documented in 3D AR space within the operational window.`;
    playSound('tributeChime');
  } else {
    resultHeader.className = 'result-header failed';
    resultBadge.textContent = 'MISSION COMPROMISED';
    resultTitle.textContent = reason === 'TIMEOUT' ? 'OPERATIONAL WINDOW EXPIRED' : 'TARGET MISSED';
    resultSubtitle.textContent = reason === 'TIMEOUT'
      ? 'The 5-second operational window closed before target confirmation.'
      : 'Photo captured off-target. Crosshairs were not aligned in 3D space.';
    playSound('beep', 300, 'sawtooth');
  }

  // Populate In Memoriam Memorial Hero Card
  document.getElementById('hero-image').src = currentMemorial.image;
  document.getElementById('hero-name').textContent = currentMemorial.name;
  document.getElementById('hero-unit').textContent = `${currentMemorial.rank} • ${currentMemorial.unit}`;
  document.getElementById('hero-op').textContent = `${currentMemorial.operation} (${currentMemorial.dateOfMartyrdom})`;
  document.getElementById('hero-decoration').textContent = currentMemorial.decoration.toUpperCase();
  document.getElementById('hero-quote').textContent = currentMemorial.quote;
  document.getElementById('hero-writeup').textContent = currentMemorial.writeUp;

  // Reset salute button
  const saluteBtn = document.getElementById('btn-salute');
  const saluteText = document.getElementById('salute-text');
  saluteText.textContent = 'PAY RESPECTS & SALUTE';
  saluteBtn.style.background = 'rgba(255, 255, 255, 0.06)';
  saluteBtn.style.borderColor = 'rgba(255, 153, 51, 0.6)';

  showScreen('result');
}

// Execute init immediately if DOM is already ready, or on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
