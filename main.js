import { ConvexService } from './utils/convexClient.js';
import { targets as fallbackTargets } from './data/targets.js';
import { memorials as fallbackMemorials } from './data/memorials.js';
import { Sound } from './utils/sound.js';
import { arEngine } from './utils/arEngine.js';

// --- GAME STATE ---
const state = {
  currentScreen: 'screen-auth',
  agentName: 'AGENT DHURANDAR',
  agentRank: '2nd Lieutenant',
  agentScore: 0,
  agentSquadron: 'PARA SF',
  targetIndex: 0,
  memorialIndex: 0,
  soundEnabled: true,
  
  // Datasets (Loaded from Convex DB with local fallbacks)
  targetsList: fallbackTargets,
  memorialsList: fallbackMemorials,

  // Mission & AR State
  gameMode: 'CAMPAIGN', // 'CAMPAIGN' | 'ROGUE'
  rogueStreak: 0,
  arInitialized: false,
  missionTimerInterval: null,
  timeLeft: 5.0,
  isTargetLocked: false,
  capturedEvidence: null,
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
  heroes: document.getElementById('screen-heroes'),
  leaderboard: document.getElementById('screen-leaderboard'),
};

// --- SOUND WRAPPER ---
function playSound(action, ...args) {
  if (state.soundEnabled && Sound[action]) {
    Sound[action](...args);
  }
}

// --- SCREEN NAVIGATION ---
function showScreen(screenKey) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  const target = document.getElementById(`screen-${screenKey}`) || screens[screenKey];
  if (target) {
    target.classList.add('active');
    state.currentScreen = screenKey;
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
  }
}

// --- PRELOAD ASSETS ---
function preloadGameAssets() {
  state.targetsList.forEach(t => {
    if (t.bodySprite) {
      const img1 = new Image();
      img1.src = t.bodySprite;
    }
    if (t.faceImage) {
      const img2 = new Image();
      img2.src = t.faceImage;
    }
  });
  state.memorialsList.forEach(m => {
    if (m.image) {
      const img = new Image();
      img.src = m.image;
    }
  });
}

// --- INITIALIZE APPLICATION & CONVEX SYNC ---
async function init() {
  // 1. Fetch initial targets & memorials from Convex DB
  try {
    const dbTargets = await ConvexService.getTargets();
    if (dbTargets && dbTargets.length > 0) state.targetsList = dbTargets;

    const dbMemorials = await ConvexService.getMemorials();
    if (dbMemorials && dbMemorials.length > 0) state.memorialsList = dbMemorials;
  } catch (e) {
    console.warn("Initial Convex DB fetch fallback:", e);
  }

  preloadGameAssets();

  // 2. Setup Real-time Subscriptions (Ops Feed & Memorials)
  setupConvexSubscriptions();

  // 3. Audio Toggle
  const btnSound = document.getElementById('btn-sound-toggle');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
      if (state.soundEnabled) playSound('beep', 900);
    });
  }

  // 4. Screen 1: Auth Button & Enter Key Handling
  const btnLogin = document.getElementById('btn-login');
  const nameInput = document.getElementById('agent-name');
  const passInput = document.getElementById('agent-passcode');
  const squadronInput = document.getElementById('agent-squadron');

  const doLogin = async () => {
    const nameVal = nameInput ? nameInput.value.trim() : '';
    const passVal = passInput ? passInput.value.trim() : '';
    const squadVal = squadronInput ? squadronInput.value : 'PARA SF';

    state.agentName = nameVal ? nameVal.toUpperCase() : 'AGENT DHURANDAR';
    state.agentSquadron = squadVal;

    playSound('beep', 1000);

    // Authenticate with Convex DB
    const authRes = await ConvexService.loginOrRegister(state.agentName, passVal, squadVal);
    if (authRes && authRes.agent) {
      state.agentRank = authRes.agent.clearanceRank || '2nd Lieutenant';
      state.agentScore = authRes.agent.totalScore || 0;
      state.agentSquadron = authRes.agent.squadron || squadVal;
    }

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

  // 5. Screen 2: Main Menu Navigation
  document.getElementById('btn-menu-campaign')?.addEventListener('click', () => {
    playSound('beep', 850);
    state.gameMode = 'CAMPAIGN';
    loadBriefingScreen();
  });

  document.getElementById('btn-menu-rogue')?.addEventListener('click', async () => {
    playSound('beep', 1200, 'sawtooth');
    state.gameMode = 'ROGUE';
    state.rogueStreak = 0;
    await start3DAR();
  });

  document.getElementById('btn-menu-archives')?.addEventListener('click', () => {
    playSound('beep', 800);
    loadArchivesScreen();
  });

  document.getElementById('btn-menu-heroes')?.addEventListener('click', () => {
    playSound('tributeChime');
    loadHeroesScreen();
  });

  document.getElementById('btn-menu-leaderboard')?.addEventListener('click', () => {
    playSound('beep', 950);
    loadLeaderboardScreen();
  });

  document.getElementById('btn-menu-logout')?.addEventListener('click', () => {
    playSound('beep', 500);
    showScreen('auth');
  });

  // 6. Back Buttons
  document.getElementById('btn-back-from-archives')?.addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-back-from-heroes')?.addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-back-from-leaderboard')?.addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-back-to-menu-from-dossier')?.addEventListener('click', () => {
    playSound('beep', 700);
    showScreen('menu');
  });

  document.getElementById('btn-result-menu')?.addEventListener('click', () => {
    playSound('beep', 700);
    loadMainMenuScreen();
  });

  document.getElementById('btn-abort-mission')?.addEventListener('click', () => {
    playSound('beep', 500);
    clearInterval(state.missionTimerInterval);
    arEngine.stop();
    showScreen('menu');
  });

  // 7. Briefing & Dossier
  document.getElementById('btn-open-dossier')?.addEventListener('click', () => {
    playSound('beep', 850);
    loadDossierScreen();
  });

  document.getElementById('btn-start-mission')?.addEventListener('click', async () => {
    playSound('beep', 1200);
    await start3DAR();
  });

  // 8. Camera Switch & Firing Trigger
  document.getElementById('btn-camera-toggle')?.addEventListener('click', async () => {
    playSound('beep', 1100);
    await arEngine.requestPermissions();
  });

  const btnFire = document.getElementById('btn-fire');
  if (btnFire) {
    btnFire.addEventListener('click', handleGunshotFire);
    btnFire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleGunshotFire();
    });
  }

  // Also allow tapping on the 3D viewport to fire
  document.getElementById('spatial-viewport')?.addEventListener('pointerdown', (e) => {
    // Only fire if clicking outside controls
    if (!e.target.closest('.hud-controls') && state.currentScreen === 'mission') {
      handleGunshotFire();
    }
  });

  // 9. Result Screen Loops & Salute
  document.getElementById('btn-next-mission')?.addEventListener('click', () => {
    playSound('beep', 800);
    state.targetIndex = (state.targetIndex + 1) % state.targetsList.length;
    state.memorialIndex = (state.memorialIndex + 1) % state.memorialsList.length;
    if (state.gameMode === 'ROGUE') {
      state.rogueStreak = 0;
      start3DAR();
    } else {
      loadBriefingScreen();
    }
  });

  document.getElementById('btn-replay')?.addEventListener('click', () => {
    playSound('beep', 800);
    if (state.gameMode === 'ROGUE') {
      state.rogueStreak = 0;
      start3DAR();
    } else {
      loadDossierScreen();
    }
  });

  document.getElementById('btn-salute')?.addEventListener('click', async () => {
    playSound('tributeChime');
    const saluteBtn = document.getElementById('btn-salute');
    const saluteText = document.getElementById('salute-text');
    const curMem = state.memorialsList[state.memorialIndex];

    saluteText.textContent = 'SALUTED WITH HIGHEST HONORS 🇮🇳';
    if (saluteBtn) {
      saluteBtn.style.background = 'rgba(255, 153, 51, 0.3)';
      saluteBtn.style.borderColor = '#00ff88';
    }

    if (curMem) {
      const res = await ConvexService.recordSalute(curMem.id, state.agentName);
      if (res && res.salutesCount) {
        curMem.salutesCount = res.salutesCount;
        const liveElem = document.getElementById('hero-salutes-count');
        if (liveElem) liveElem.textContent = `🇮🇳 ${res.salutesCount.toLocaleString()} Salutes Recorded`;
      }
    }
  });
}

// --- CONVEX REAL-TIME SUBSCRIPTIONS ---
function setupConvexSubscriptions() {
  // 1. Live Ops Ticker
  ConvexService.subscribeToFeed((events) => {
    if (events && events.length > 0) {
      const latest = events[0];
      const tickerElem = document.getElementById('ticker-text');
      if (tickerElem) {
        tickerElem.textContent = `${latest.headline} — ${latest.detail}`;
      }
    }
  });

  // 2. Real-time Memorials Tribute sync
  ConvexService.subscribeToMemorials((memorials) => {
    if (memorials && memorials.length > 0) {
      state.memorialsList = memorials;
      const curMem = memorials[state.memorialIndex];
      if (curMem) {
        const liveElem = document.getElementById('hero-salutes-count');
        if (liveElem) liveElem.textContent = `🇮🇳 ${(curMem.salutesCount || 1947).toLocaleString()} Salutes Recorded`;
      }
    }
  });
}

// --- SCREEN LOADERS ---
function loadMainMenuScreen() {
  document.getElementById('menu-agent-name').textContent = state.agentName;
  document.getElementById('menu-agent-rank').textContent = state.agentRank.toUpperCase();
  document.getElementById('menu-agent-score').textContent = `🏆 ${state.agentScore.toLocaleString()} PTS`;
  document.getElementById('menu-agent-squadron').textContent = state.agentSquadron;
  showScreen('menu');
}

function loadBriefingScreen() {
  document.getElementById('briefing-agent-callsign').textContent = state.agentName;
  showScreen('briefing');
}

function loadDossierScreen() {
  const currentTarget = state.targetsList[state.targetIndex];
  if (!currentTarget) return;
  
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
  if (!container) return;
  container.innerHTML = '';

  state.targetsList.forEach((target) => {
    const card = document.createElement('div');
    card.className = 'archive-card';
    card.innerHTML = `
      <img src="${target.faceImage}" alt="${target.codename}" />
      <div class="archive-card-body">
        <span class="archive-threat-tag">${target.threatLevel}</span>
        <h3>${target.codename} (${target.name})</h3>
        <p class="archive-desc"><b>Role:</b> ${target.role}</p>
        <p class="archive-desc"><b>Last Seen:</b> ${target.lastSeen}</p>
        ${target.gazetteRef ? `<p class="archive-desc" style="color: var(--accent-gold);"><b>UAPA Ref:</b> ${target.gazetteRef}</p>` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  showScreen('archives');
}

function loadHeroesScreen() {
  const container = document.getElementById('heroes-list');
  if (!container) return;
  container.innerHTML = '';

  state.memorialsList.forEach((hero) => {
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
        <span class="hero-salutes-live">🇮🇳 ${(hero.salutesCount || 0).toLocaleString()} National Salutes</span>
      </div>
    `;
    container.appendChild(card);
  });

  showScreen('heroes');
}

async function loadLeaderboardScreen() {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--accent-cyan); padding: 16px;">FETCHING SATELLITE TELEMETRY...</td></tr>';

  showScreen('leaderboard');

  const agents = await ConvexService.getLeaderboard(25);
  tbody.innerHTML = '';

  if (!agents || agents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="rank-num">01</td>
        <td class="table-callsign">${state.agentName}</td>
        <td>${state.agentRank}</td>
        <td class="table-score">${state.agentScore} PTS</td>
        <td class="table-accuracy">100%</td>
      </tr>
    `;
    return;
  }

  agents.forEach((ag) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-num">#${ag.rankNumber}</td>
      <td class="table-callsign">${ag.callsign} <span style="font-size: 8px; color: var(--text-muted);">(${ag.squadron || 'PARA SF'})</span></td>
      <td>${ag.clearanceRank}</td>
      <td class="table-score">${ag.totalScore.toLocaleString()} PTS</td>
      <td class="table-accuracy">${ag.accuracy}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- 3D AR MISSION INITIALIZATION ---
async function start3DAR() {
  showScreen('mission');

  const viewport = document.getElementById('spatial-viewport');
  const videoElem = document.getElementById('camera-feed');

  await arEngine.requestPermissions();

  // Cleanly start/restart AR engine and purge previous targets
  arEngine.start(viewport, videoElem, handleARTelemetry);
  state.arInitialized = true;

  // Reset Mission & Hunting State
  state.missionState = 'HUNTING';
  state.timerStarted = false;
  state.missionEnded = false;
  state.outcomeProcessed = false;
  state.timeLeft = 5.0;
  if (state.missionTimerInterval) clearInterval(state.missionTimerInterval);
  if (state.spawnTimeout) clearTimeout(state.spawnTimeout);

  // Set HUD to Hunting Mode
  const streakBadge = document.getElementById('hud-streak-badge');
  const streakCount = document.getElementById('hud-streak-count');
  if (state.gameMode === 'ROGUE') {
    if (streakBadge) streakBadge.style.display = 'flex';
    if (streakCount) streakCount.textContent = `🔥 ${state.rogueStreak}`;
  } else {
    if (streakBadge) streakBadge.style.display = 'none';
  }

  const timerElem = document.getElementById('mission-timer');
  if (timerElem) {
    timerElem.textContent = 'STANDBY (HUNTING)';
    timerElem.style.color = '#00f2fe';
  }

  const hpElem = document.getElementById('hud-target-hp');
  if (hpElem) {
    hpElem.textContent = '100% [○○○○○]';
    hpElem.style.color = '#00ff88';
  }

  const statusBadge = document.getElementById('hud-status');
  if (statusBadge) {
    statusBadge.textContent = '🔍 HUNTING MODE: MOVE & SWEEP 360° ENVIRONMENT...';
    statusBadge.style.borderColor = 'rgba(0, 242, 254, 0.4)';
    statusBadge.style.color = '#00f2fe';
  }

  playSound('radarPing', 900);

  // Dynamic Spawning Trigger: Hostile appears after hunting period
  const huntDelay = state.gameMode === 'ROGUE' ? (1200 + Math.random() * 1500) : (3500 + Math.random() * 3500);
  state.spawnTimeout = setTimeout(() => {
    if (state.currentScreen === 'mission' && !state.timerStarted && !state.missionEnded) {
      state.missionState = 'NEARBY';
      
      const currentTarget = state.targetsList[state.targetIndex];
      arEngine.spawnTarget(currentTarget.bodySprite);

      playSound('radarPing', 1500);
      if (statusBadge) {
        statusBadge.textContent = `⚠️ PROXIMITY ALERT: ${currentTarget.codename} IN SECTOR — LOCATE NOW!`;
        statusBadge.style.borderColor = '#ff9933';
        statusBadge.style.color = '#ff9933';
      }
    }
  }, huntDelay);
}

// Spawns the next hostile in Go Rogue Endless Mode without ending the round
function spawnNextRogueTarget() {
  if (state.currentScreen !== 'mission' || state.missionEnded) return;

  state.timerStarted = false;
  state.timeLeft = 5.0;
  arEngine.isSpawned = false;

  const timerElem = document.getElementById('mission-timer');
  if (timerElem) {
    timerElem.textContent = 'STANDBY (HUNTING)';
    timerElem.style.color = '#00f2fe';
  }

  const hpElem = document.getElementById('hud-target-hp');
  if (hpElem) {
    hpElem.textContent = '100% [○○○○○]';
    hpElem.style.color = '#00ff88';
  }

  const statusBadge = document.getElementById('hud-status');
  if (statusBadge) {
    statusBadge.textContent = `⚡ NEXT TARGET INCOMING (HOSTILE #${state.rogueStreak + 1}) — SWEEP HORIZON!`;
    statusBadge.style.borderColor = '#ff9933';
    statusBadge.style.color = '#ff9933';
  }

  playSound('radarPing', 1200);

  // Fast spawn in Rogue mode (1.0s to 2.0s)
  const spawnDelay = 1000 + Math.random() * 1200;
  state.spawnTimeout = setTimeout(() => {
    if (state.currentScreen === 'mission' && !state.missionEnded) {
      state.missionState = 'NEARBY';
      const currentTarget = state.targetsList[state.targetIndex];
      arEngine.spawnTarget(currentTarget.bodySprite);

      playSound('radarPing', 1600);
      if (statusBadge) {
        statusBadge.textContent = `⚠️ HOSTILE SPOTTED: ${currentTarget.codename} — ENGAGE & FIRE!`;
        statusBadge.style.borderColor = '#ff334b';
        statusBadge.style.color = '#ff334b';
      }
    }
  }, spawnDelay);
}

function start5SecondWindow() {
  if (state.missionEnded) return;

  state.timerStarted = true;
  state.missionState = 'ENGAGED';
  state.timeLeft = 5.0;

  const timerElem = document.getElementById('mission-timer');
  if (timerElem) timerElem.style.color = '#ff334b';

  const statusBadge = document.getElementById('hud-status');
  if (statusBadge) {
    statusBadge.textContent = '🚨 TARGET IN SIGHT — 5s ENGAGEMENT WINDOW!';
    statusBadge.style.borderColor = '#ff334b';
    statusBadge.style.color = '#ff334b';
  }

  playSound('beep', 1200, 'sawtooth');

  const tickIntervalMs = 50;
  let lastSecondInt = 5;

  state.missionTimerInterval = setInterval(() => {
    if (state.missionEnded) {
      clearInterval(state.missionTimerInterval);
      return;
    }

    state.timeLeft = Math.max(0, state.timeLeft - (tickIntervalMs / 1000));
    if (timerElem) timerElem.textContent = state.timeLeft.toFixed(2) + 's';

    const currentSec = Math.ceil(state.timeLeft);
    if (currentSec !== lastSecondInt && currentSec > 0) {
      playSound('countdownTick', currentSec);
      lastSecondInt = currentSec;
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.missionTimerInterval);
      if (!state.missionEnded) {
        handleMissionOutcome(false, 'TIMEOUT');
      }
    }
  }, tickIntervalMs);
}

// Telemetry Callback from AR Engine
function handleARTelemetry(data) {
  if (state.missionEnded || state.currentScreen !== 'mission') return;

  const { isInViewfinder, isLocked, distance, azimuth, directionHint, health = 100, hits = 0 } = data;
  state.isTargetLocked = isLocked;

  const radarAzimuth = document.getElementById('radar-azimuth');
  if (radarAzimuth) {
    radarAzimuth.textContent = directionHint || `${azimuth}°`;
    radarAzimuth.style.color = (directionHint && directionHint.includes('TURN')) ? '#ff9933' : '#00ff88';
  }

  const radarDist = document.getElementById('radar-distance');
  if (radarDist) {
    radarDist.textContent = distance > 0 ? `RANGE: ${distance}m` : 'RANGE: SCANNING';
  }

  // Update live HP readout in HUD
  const hpElem = document.getElementById('hud-target-hp');
  if (hpElem) {
    const hitPips = '●'.repeat(hits) + '○'.repeat(Math.max(0, 5 - hits));
    hpElem.textContent = `${health}% [${hitPips}]`;
    hpElem.style.color = health > 40 ? '#00ff88' : '#ff334b';
  }

  const lockonIndicator = document.getElementById('lockon-indicator');
  const statusBadge = document.getElementById('hud-status');

  if (isInViewfinder && !state.timerStarted && state.currentScreen === 'mission') {
    start5SecondWindow();
  }

  if (isLocked) {
    if (lockonIndicator) lockonIndicator.classList.add('active');
    if (statusBadge) {
      statusBadge.textContent = '⚡ LOCKED ON HOSTILE // TAP TO FIRE!';
      statusBadge.style.borderColor = '#00ff88';
      statusBadge.style.color = '#00ff88';
    }
  } else {
    if (lockonIndicator) lockonIndicator.classList.remove('active');
    if (state.timerStarted && statusBadge) {
      statusBadge.textContent = '🚨 TARGET IN SIGHT — ALIGN & SHOOT!';
      statusBadge.style.borderColor = '#ff334b';
      statusBadge.style.color = '#ff334b';
    }
  }
}

// Gunshot Firing Trigger (Tap repeatedly to eliminate target)
function handleGunshotFire() {
  if (state.currentScreen !== 'mission' || state.missionEnded) return;
  if (state.timeLeft <= 0 && state.timerStarted) return;

  // 1. Play Tactical Gunshot Sound
  playSound('gunshot');

  // 2. Gunshot Muzzle Flash & Screen Recoil Shake
  const viewport = document.getElementById('spatial-viewport');
  if (viewport) {
    viewport.classList.remove('screen-recoil');
    void viewport.offsetWidth; // Trigger reflow
    viewport.classList.add('screen-recoil');
  }

  const flash = document.getElementById('shutter-flash');
  if (flash) {
    flash.classList.add('flash');
    setTimeout(() => flash.classList.remove('flash'), 120);
  }

  // 3. Register Shot in AR Engine
  const result = arEngine.shoot();

  const statusBadge = document.getElementById('hud-status');
  const hpElem = document.getElementById('hud-target-hp');

  if (result.hit) {
    // Bullet impact sound confirmation
    playSound('hitImpact');

    if (hpElem) {
      const hitPips = '●'.repeat(result.hits) + '○'.repeat(Math.max(0, 5 - result.hits));
      hpElem.textContent = `${result.remainingHp}% [${hitPips}]`;
      hpElem.style.color = result.remainingHp > 40 ? '#00ff88' : '#ff334b';
    }

    if (statusBadge) {
      statusBadge.textContent = `💥 DIRECT HIT! [${result.hits}/5 SHOTS LANDED]`;
      statusBadge.style.borderColor = '#ff9933';
      statusBadge.style.color = '#ff9933';
    }

    // Check if target is completely neutralized (5 hits)
    if (result.isEliminated) {
      if (state.gameMode === 'ROGUE') {
        // --- GO ROGUE CONTINUOUS MODE ---
        state.rogueStreak++;

        const streakCount = document.getElementById('hud-streak-count');
        if (streakCount) streakCount.textContent = `🔥 ${state.rogueStreak}`;

        if (statusBadge) {
          statusBadge.textContent = `☠️ HOSTILE ELIMINATED! STREAK: 🔥 ${state.rogueStreak}`;
          statusBadge.style.borderColor = '#00ff88';
          statusBadge.style.color = '#00ff88';
        }

        if (hpElem) {
          hpElem.textContent = '0% [●●●●●] ELIMINATED';
          hpElem.style.color = '#ff334b';
        }

        playSound('tributeChime');
        clearInterval(state.missionTimerInterval);
        if (state.spawnTimeout) clearTimeout(state.spawnTimeout);

        // Advance to next terrorist in dataset
        state.targetIndex = (state.targetIndex + 1) % state.targetsList.length;
        state.memorialIndex = (state.memorialIndex + 1) % state.memorialsList.length;

        // Spawn next target continuously after 800ms
        setTimeout(() => {
          if (state.currentScreen === 'mission' && !state.missionEnded) {
            spawnNextRogueTarget();
          }
        }, 800);
      } else {
        // --- CAMPAIGN SINGLE MISSION MODE ---
        state.missionEnded = true;

        if (statusBadge) {
          statusBadge.textContent = '☠️ HOSTILE NEUTRALIZED // MISSION ACCOMPLISHED';
          statusBadge.style.borderColor = '#00ff88';
          statusBadge.style.color = '#00ff88';
        }

        if (hpElem) {
          hpElem.textContent = '0% [●●●●●] ELIMINATED';
          hpElem.style.color = '#ff334b';
        }

        clearInterval(state.missionTimerInterval);
        if (state.spawnTimeout) clearTimeout(state.spawnTimeout);

        try {
          state.capturedEvidence = arEngine.captureEvidencePhoto();
        } catch (e) {
          state.capturedEvidence = null;
        }

        handleMissionOutcome(true, 'ELIMINATED');
      }
    }
  } else {
    // Shot missed
    if (statusBadge) {
      statusBadge.textContent = '⚠️ SHOT MISSED! ALIGN CROSSHAIR WITH HOSTILE';
      statusBadge.style.borderColor = '#ff334b';
      statusBadge.style.color = '#ff334b';
    }
  }
}

// --- MISSION DEBRIEF & CONVEX SCORING SYNC ---
async function handleMissionOutcome(isSuccess, reason) {
  if (state.outcomeProcessed) return;
  state.outcomeProcessed = true;
  state.missionEnded = true;

  clearInterval(state.missionTimerInterval);
  if (state.spawnTimeout) clearTimeout(state.spawnTimeout);
  arEngine.stop();

  const currentTarget = state.targetsList[state.targetIndex] || {};
  const currentMemorial = state.memorialsList[state.memorialIndex] || {};

  const resultHeader = document.getElementById('result-header');
  const resultBadge = document.getElementById('result-badge');
  const resultTitle = document.getElementById('result-title');
  const resultSubtitle = document.getElementById('result-subtitle');
  const evidenceImg = document.getElementById('result-evidence-img');

  if (evidenceImg) {
    evidenceImg.src = state.capturedEvidence || currentTarget.faceImage || '/assets/target1_mugshot.jpg';
  }

  if (state.gameMode === 'ROGUE') {
    if (resultHeader) resultHeader.className = state.rogueStreak > 0 ? 'result-header success' : 'result-header failed';
    if (resultBadge) resultBadge.textContent = '🔥 ROGUE RUN TERMINATED';
    if (resultTitle) resultTitle.textContent = `KILLSTREAK: 🔥 ${state.rogueStreak} HOSTILES ELIMINATED`;
    if (resultSubtitle) {
      resultSubtitle.textContent = state.rogueStreak > 0
        ? `Operative eliminated ${state.rogueStreak} hostile targets in continuous combat before time expired.`
        : 'Engagement window expired before first elimination.';
    }
    if (state.rogueStreak > 0) playSound('tributeChime');
    else playSound('beep', 300, 'sawtooth');
  } else if (isSuccess) {
    if (resultHeader) resultHeader.className = 'result-header success';
    if (resultBadge) resultBadge.textContent = 'MISSION ACCOMPLISHED // THREAT NEUTRALIZED';
    if (resultTitle) resultTitle.textContent = 'GOOD JOB AGENT — NEVER FORGET';
    if (resultSubtitle) resultSubtitle.textContent = `Target ${currentTarget.codename || 'HOSTILE'} successfully neutralized in 3D AR space.`;
    playSound('tributeChime');
  } else {
    if (resultHeader) resultHeader.className = 'result-header failed';
    if (resultBadge) resultBadge.textContent = 'MISSION COMPROMISED';
    if (resultTitle) resultTitle.textContent = reason === 'TIMEOUT' ? 'OPERATIONAL WINDOW EXPIRED' : 'TARGET ESCAPED';
    if (resultSubtitle) {
      resultSubtitle.textContent = reason === 'TIMEOUT'
        ? 'The operational window closed before neutralizing the hostile.'
        : 'Crosshairs were not aligned in 3D space.';
    }
    playSound('beep', 300, 'sawtooth');
  }

  // Populate In Memoriam Memorial Hero Card
  if (currentMemorial) {
    const hImg = document.getElementById('hero-image');
    if (hImg) hImg.src = currentMemorial.image || '/assets/hero_memorial.jpg';
    const hName = document.getElementById('hero-name');
    if (hName) hName.textContent = currentMemorial.name || 'Indian Armed Forces Hero';
    const hUnit = document.getElementById('hero-unit');
    if (hUnit) hUnit.textContent = `${currentMemorial.rank || 'Martyr'} • ${currentMemorial.unit || 'Special Forces'}`;
    const hOp = document.getElementById('hero-op');
    if (hOp) hOp.textContent = `${currentMemorial.operation || 'Line of Duty'} (${currentMemorial.dateOfMartyrdom || ''})`;
    const hDec = document.getElementById('hero-decoration');
    if (hDec) hDec.textContent = (currentMemorial.decoration || 'Gallantry Award').toUpperCase();
    const hQuote = document.getElementById('hero-quote');
    if (hQuote) hQuote.textContent = currentMemorial.quote || '“I will either come back after hoisting the Tricolour, or I will come back wrapped in it.”';
    const hWriteup = document.getElementById('hero-writeup');
    if (hWriteup) hWriteup.textContent = currentMemorial.writeUp || '';
    const hSalutes = document.getElementById('hero-salutes-count');
    if (hSalutes) hSalutes.textContent = `🇮🇳 ${(currentMemorial.salutesCount || 1947).toLocaleString()} Salutes Recorded`;
  }

  // Reset salute button
  const saluteBtn = document.getElementById('btn-salute');
  const saluteText = document.getElementById('salute-text');
  if (saluteText) saluteText.textContent = 'PAY RESPECTS & SALUTE';
  if (saluteBtn) {
    saluteBtn.style.background = 'rgba(255, 255, 255, 0.06)';
    saluteBtn.style.borderColor = 'rgba(255, 153, 51, 0.6)';
  }

  // IMMEDIATELY switch to Result Screen!
  showScreen('result');

  // Asynchronously record score in Convex DB in background without blocking UI
  try {
    const outcomeData = await ConvexService.recordMissionOutcome({
      agentCallsign: state.agentName,
      targetCodename: currentTarget.codename || 'HOSTILE',
      outcome: isSuccess ? 'SUCCESS' : 'FAILED',
      reason,
      timeRemaining: isSuccess ? state.timeLeft : 0,
      evidencePhoto: null, // Avoid giant base64 payload over network
    });

    if (outcomeData) {
      state.agentScore = outcomeData.totalScore || state.agentScore;
      state.agentRank = outcomeData.clearanceRank || state.agentRank;

      const scoreValElem = document.getElementById('result-score-val');
      const scoreBreakdownElem = document.getElementById('result-score-breakdown');
      const promoBadge = document.getElementById('result-rank-promo');

      if (isSuccess && scoreValElem) {
        scoreValElem.textContent = `+${outcomeData.scoreEarned.toLocaleString()} PTS`;
        if (scoreBreakdownElem) scoreBreakdownElem.textContent = `Base: 1,000 • Speed Bonus: +${outcomeData.timeBonus} • Time Left: ${state.timeLeft.toFixed(2)}s`;
      } else if (scoreValElem) {
        scoreValElem.textContent = `+0 PTS`;
        if (scoreBreakdownElem) scoreBreakdownElem.textContent = `Mission unfulfilled: ${reason}`;
      }

      if (outcomeData.promoted && promoBadge) {
        promoBadge.style.display = 'block';
        promoBadge.textContent = `🎖️ PROMOTED TO ${outcomeData.clearanceRank.toUpperCase()}!`;
      } else if (promoBadge) {
        promoBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('[Convex] Outcome record error:', err);
  }
}

// Execute init immediately if DOM is already ready, or on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
