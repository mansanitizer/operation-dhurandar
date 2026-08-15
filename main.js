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
  eliminatedTargets: [], // Codenames of hostiles eliminated by this operative

  // Mission & AR State
  gameMode: 'CAMPAIGN', // 'CAMPAIGN' | 'ROGUE'
  rogueStreak: 0,
  arInitialized: false,
  missionTimerInterval: null,
  timeLeft: 4.0,
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

  // Manage Contextual Music Playback (Auth & Main Menu)
  if (!state.soundEnabled) {
    Sound.stopAllMusic();
    return;
  }

  if (screenKey === 'auth') {
    Sound.playLoginMusic();
  } else if (screenKey === 'menu') {
    Sound.playMenuMusic();
  } else {
    Sound.stopAllMusic();
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
  // Start Login Theme Music
  if (state.soundEnabled) {
    Sound.playLoginMusic();
  }

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
      if (state.soundEnabled) {
        playSound('beep', 900);
        if (state.currentScreen === 'auth') {
          Sound.playLoginMusic();
        } else if (state.currentScreen === 'menu') {
          Sound.playMenuMusic();
        }
      } else {
        Sound.stopAllMusic();
      }
    });
  }

  // 4. Screen 1: Auth Button & Enter Key Handling
  const btnLogin = document.getElementById('btn-login');
  const nameInput = document.getElementById('agent-name');
  const passInput = document.getElementById('agent-passcode');

  // Restore cached operative profile from localStorage if present
  try {
    const saved = localStorage.getItem('dhurandar_agent');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.name && nameInput) nameInput.value = parsed.name;
      if (parsed.name) {
        state.agentName = parsed.name;
        state.agentRank = parsed.rank || '2nd Lieutenant';
        state.agentScore = parsed.score || 0;
        state.agentSquadron = 'PARA SF';
        state.eliminatedTargets = parsed.eliminatedTargets || [];
      }
    }
  } catch (e) {}

  const doLogin = async () => {
    const nameVal = nameInput ? nameInput.value.trim() : '';
    const passVal = passInput ? passInput.value.trim() : '';
    const squadVal = 'PARA SF';

    state.agentName = nameVal ? nameVal.toUpperCase() : 'AGENT DHURANDAR';
    state.agentSquadron = 'PARA SF';

    playSound('beep', 1000);

    // Authenticate with Convex DB backend
    try {
      const authRes = await ConvexService.loginOrRegister(state.agentName, passVal, squadVal);
      if (authRes && authRes.agent) {
        state.agentName = authRes.agent.callsign || state.agentName;
        state.agentRank = authRes.agent.clearanceRank || '2nd Lieutenant';
        state.agentScore = authRes.agent.totalScore || 0;
        state.agentSquadron = authRes.agent.squadron || 'PARA SF';
        state.eliminatedTargets = authRes.agent.eliminatedTargets || state.eliminatedTargets || [];
      }
    } catch (err) {
      console.warn('[AUTH] Convex login fallback:', err);
    }

    try {
      localStorage.setItem('dhurandar_agent', JSON.stringify({
        name: state.agentName,
        rank: state.agentRank,
        score: state.agentScore,
        squadron: state.agentSquadron,
        eliminatedTargets: state.eliminatedTargets
      }));
    } catch (e) {}

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
    playSound('radioSquelch');
    playSound('beep', 850);
    loadDossierScreen();
  });

  document.getElementById('btn-back-to-hq-from-briefing')?.addEventListener('click', () => {
    playSound('beep', 700);
    loadMainMenuScreen();
  });

  document.getElementById('btn-start-mission')?.addEventListener('click', async () => {
    playSound('radioSquelch');
    playSound('beep', 1200);
    await start3DAR();
  });

  // 8. Camera Switch, Step Forward & Firing Trigger
  document.getElementById('btn-camera-toggle')?.addEventListener('click', async () => {
    playSound('beep', 1100);
    await arEngine.requestPermissions();
  });

  document.getElementById('btn-step-forward')?.addEventListener('click', () => {
    playSound('footstep');
    arEngine.advanceStep(0.75);
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
    pickRandomMemorial();
    if (state.gameMode === 'ROGUE') {
      state.rogueStreak = 0;
      start3DAR();
    } else {
      const remaining = getAvailableCampaignTargets();
      if (remaining.length > 0) {
        state.targetIndex = state.targetsList.findIndex(t => t.codename === remaining[0].codename);
        if (state.targetIndex === -1) state.targetIndex = 0;
      }
      loadBriefingScreen();
    }
  });

  document.getElementById('btn-replay')?.addEventListener('click', () => {
    playSound('beep', 800);
    pickRandomMemorial();
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

    // 1. Instant 0ms Optimistic UI Counter Update (No refresh needed!)
    if (curMem) {
      curMem.salutesCount = (curMem.salutesCount || 1947) + 1;
      const liveElem = document.getElementById('hero-salutes-count');
      if (liveElem) {
        liveElem.textContent = `🇮🇳 ${curMem.salutesCount.toLocaleString()} Salutes Recorded`;
      }
    }

    // Trigger Fullscreen Tricolour Delight Animation (Right to Left sweep)
    triggerSaluteDelight(curMem?.name);

    // 2. Persist Salute to Convex Cloud DB in background
    if (curMem) {
      try {
        const res = await ConvexService.recordSalute(curMem.id, state.agentName);
        if (res && res.salutesCount) {
          curMem.salutesCount = res.salutesCount;
          const liveElem = document.getElementById('hero-salutes-count');
          if (liveElem) {
            liveElem.textContent = `🇮🇳 ${res.salutesCount.toLocaleString()} Salutes Recorded`;
          }
        }
      } catch (err) {
        console.warn('[Salute] DB sync:', err);
      }
    }
  });
}

// Fullscreen Tricolour National Pride Wave & Confetti Animation
function triggerSaluteDelight(heroName) {
  const overlay = document.getElementById('salute-delight-overlay');
  const quoteElem = document.getElementById('delight-hero-tribute');
  if (quoteElem && heroName) {
    quoteElem.textContent = `“NATION SALUTES THE SUPREME SACRIFICE OF ${heroName.toUpperCase()}”`;
  }

  if (overlay) {
    overlay.classList.remove('active');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    launchSaluteConfetti();

    setTimeout(() => {
      overlay.classList.remove('active');
    }, 2300);
  }
}

function launchSaluteConfetti() {
  const canvas = document.getElementById('salute-confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff9933', '#ffffff', '#138808', '#ffd700', '#000080'];
  const particles = [];

  for (let i = 0; i < 75; i++) {
    particles.push({
      x: window.innerWidth * (0.3 + Math.random() * 0.7),
      y: window.innerHeight * (0.2 + Math.random() * 0.6),
      vx: (Math.random() - 0.75) * 8,
      vy: (Math.random() - 0.5) * 6,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02
    });
  }

  function renderConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeCount = 0;

    particles.forEach(p => {
      if (p.life > 0) {
        activeCount++;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (activeCount > 0) {
      requestAnimationFrame(renderConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  renderConfetti();
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

  // 3. Real-time Leaderboard sync
  ConvexService.subscribeToLeaderboard((agents) => {
    if (state.currentScreen === 'leaderboard' && agents) {
      renderLeaderboardRows(agents);
    }
  });
}

// Helper: Filter remaining un-eliminated hostiles for Campaign Mode
function getAvailableCampaignTargets() {
  return state.targetsList.filter(t => !state.eliminatedTargets.includes(t.codename));
}

// Helper: Pick a random braveheart memorial from the Hall of Heroes
function pickRandomMemorial() {
  if (!state.memorialsList || state.memorialsList.length === 0) return;
  if (state.memorialsList.length === 1) {
    state.memorialIndex = 0;
    return;
  }
  let newIdx;
  do {
    newIdx = Math.floor(Math.random() * state.memorialsList.length);
  } while (newIdx === state.memorialIndex && state.memorialsList.length > 1);
  state.memorialIndex = newIdx;
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
  const available = getAvailableCampaignTargets();
  const briefingAgent = document.getElementById('briefing-agent-callsign');
  if (briefingAgent) briefingAgent.textContent = state.agentName;

  const briefingText = document.getElementById('briefing-text');
  const openDossierBtn = document.getElementById('btn-open-dossier');
  const startMissionBtn = document.getElementById('btn-start-mission');

  if (available.length === 0) {
    // All terrorists in database have been eliminated by this user!
    if (briefingText) {
      briefingText.innerHTML = `
        <div style="color: var(--accent-gold); font-size: 15px; font-weight: 700; margin-bottom: 8px; text-shadow: 0 0 10px rgba(229,169,60,0.5);">
          🎖️ ALL SECTOR THREATS NEUTRALIZED // 100% PURGE
        </div>
        Outstanding operational valor, operative. You have eliminated all <b>${state.targetsList.length}</b> designated hostiles in the national database.
        <br><br>
        • Inspect your confirmed kills in the <b>Archives</b>.<br>
        • Deploy into <b>Go Rogue</b> killstreak mode for endless target combat simulation.
      `;
    }
    if (openDossierBtn) openDossierBtn.style.display = 'none';
    if (startMissionBtn) startMissionBtn.style.display = 'none';
  } else {
    // Select the first un-eliminated target
    state.targetIndex = state.targetsList.findIndex(t => t.codename === available[0].codename);
    if (state.targetIndex === -1) state.targetIndex = 0;

    const currentTarget = state.targetsList[state.targetIndex];
    if (briefingText) {
      const eliminatedCount = state.eliminatedTargets.length;
      const totalCount = state.targetsList.length;
      briefingText.innerHTML = `
        <div style="color: var(--accent-cyan); font-size: 11px; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px;">
          CAMPAIGN PROGRESS: ${eliminatedCount} / ${totalCount} PURGED (${totalCount - eliminatedCount} REMAINING)
        </div>
        Intel indicates high-value hostile <b>${currentTarget.codename}</b> (${currentTarget.name}) has breached the operational sector.
        <br><br>
        You have a 4-second operational window to confirm identity before they disappear.
      `;
    }
    if (openDossierBtn) openDossierBtn.style.display = 'block';
    if (startMissionBtn) startMissionBtn.style.display = 'block';
  }

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
    const isEliminated = state.eliminatedTargets.includes(target.codename);
    const card = document.createElement('div');
    card.className = `archive-card ${isEliminated ? 'eliminated' : ''}`;
    card.innerHTML = `
      <div style="position: relative; overflow: hidden; border-radius: 6px;">
        <img src="${target.faceImage}" alt="${target.codename}" style="${isEliminated ? 'filter: grayscale(0.85) contrast(1.2);' : ''}" />
        ${isEliminated ? '<div class="stamp-neutralized" style="top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-12deg); font-size: 13px; padding: 4px 8px; box-shadow: 0 0 15px rgba(255,51,75,0.8);">NEUTRALIZED</div>' : ''}
      </div>
      <div class="archive-card-body">
        <span class="archive-threat-tag" style="${isEliminated ? 'color: #00ff88; border-color: #00ff88;' : ''}">${isEliminated ? '● STATUS: NEUTRALIZED BY YOU' : target.threatLevel}</span>
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

function renderLeaderboardRows(agents) {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!agents || agents.length === 0) {
    tbody.innerHTML = `
      <tr style="background: rgba(229, 169, 60, 0.15);">
        <td class="rank-num">#01</td>
        <td class="table-callsign">${state.agentName} ⭐ <span style="font-size: 8px; color: var(--text-muted);">(${state.agentSquadron})</span></td>
        <td>${state.agentRank}</td>
        <td class="table-score">${state.agentScore.toLocaleString()} PTS</td>
        <td class="table-accuracy">100%</td>
      </tr>
    `;
    return;
  }

  agents.forEach((ag, idx) => {
    const isCurrentAgent = ag.callsign === state.agentName;
    const tr = document.createElement('tr');
    if (isCurrentAgent) tr.style.background = 'rgba(229, 169, 60, 0.15)';
    tr.innerHTML = `
      <td class="rank-num">#${ag.rankNumber || idx + 1}</td>
      <td class="table-callsign">${ag.callsign} ${isCurrentAgent ? '⭐' : ''} <span style="font-size: 8px; color: var(--text-muted);">(${ag.squadron || 'PARA SF'})</span></td>
      <td>${ag.clearanceRank}</td>
      <td class="table-score">${(ag.totalScore || 0).toLocaleString()} PTS</td>
      <td class="table-accuracy">${ag.accuracy || '100%'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadLeaderboardScreen() {
  const tbody = document.getElementById('leaderboard-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--accent-cyan); padding: 16px;">📡 FETCHING NATIONAL OPERATIVES TELEMETRY...</td></tr>';
  }

  showScreen('leaderboard');

  try {
    const agents = await ConvexService.getLeaderboard(25);
    renderLeaderboardRows(agents);
  } catch (err) {
    console.warn('[Leaderboard] fetch fallback:', err);
    renderLeaderboardRows([]);
  }
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
  state.timeLeft = 4.0;
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
      const currentRound = state.gameMode === 'ROGUE' ? (state.rogueStreak + 1) : ((state.targetIndex || 0) + 1);
      arEngine.spawnTarget(currentTarget.bodySprite, currentRound);

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
  state.timeLeft = 4.0;
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
      const currentRound = state.rogueStreak + 1;
      arEngine.spawnTarget(currentTarget.bodySprite, currentRound);

      playSound('radarPing', 1600);
      if (statusBadge) {
        statusBadge.textContent = `⚠️ HOSTILE SPOTTED: ${currentTarget.codename} — ENGAGE & FIRE!`;
        statusBadge.style.borderColor = '#ff334b';
        statusBadge.style.color = '#ff334b';
      }
    }
  }, spawnDelay);
}

function start4SecondWindow() {
  if (state.missionEnded) return;

  state.timerStarted = true;
  state.missionState = 'ENGAGED';
  state.timeLeft = 4.0;

  const timerElem = document.getElementById('mission-timer');
  if (timerElem) timerElem.style.color = '#ff334b';

  const statusBadge = document.getElementById('hud-status');
  if (statusBadge) {
    statusBadge.textContent = '🚨 TARGET IN SIGHT — 4s ENGAGEMENT WINDOW!';
    statusBadge.style.borderColor = '#ff334b';
    statusBadge.style.color = '#ff334b';
  }

  playSound('beep', 1200, 'sawtooth');

  const tickIntervalMs = 50;
  let lastSecondInt = 4;

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
      if (currentSec <= 3) {
        playSound('heartbeat', (4 - currentSec) * 0.5);
      }
      lastSecondInt = currentSec;
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.missionTimerInterval);
      if (!state.missionEnded) {
        triggerEvadedSequence('TIMEOUT');
      }
    }
  }, tickIntervalMs);
}

// Cinematic Evaded Sequence with animated banner & audio
function triggerEvadedSequence(reason = 'TIMEOUT') {
  if (state.missionEnded || state.outcomeProcessed) return;
  state.missionEnded = true;

  clearInterval(state.missionTimerInterval);
  if (state.spawnTimeout) clearTimeout(state.spawnTimeout);

  // 1. Play tactical evasion alarm sound
  playSound('beep', 250, 'sawtooth');

  // 2. Display Cinematic Evaded Overlay Banner
  const banner = document.getElementById('evade-banner-overlay');
  const bannerSub = document.getElementById('evade-banner-codename');
  const curTarget = state.targetsList[state.targetIndex] || {};
  if (bannerSub) {
    bannerSub.textContent = `${curTarget.codename || 'HOSTILE'} ESCAPED SECTOR`;
  }
  if (banner) banner.classList.add('active');

  const statusBadge = document.getElementById('hud-status');
  if (statusBadge) {
    statusBadge.textContent = '⚠️ TARGET EVADED // OPERATIONAL WINDOW CLOSED!';
    statusBadge.style.borderColor = '#ff9933';
    statusBadge.style.color = '#ff9933';
  }

  // 3. Cinematic 1.5s delay before debrief transition
  setTimeout(() => {
    if (banner) banner.classList.remove('active');
    handleMissionOutcome(false, reason);
  }, 1500);
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

  // Update live HP readout in HUD when target is actively spawned
  const hpElem = document.getElementById('hud-target-hp');
  if (hpElem && data.isSpawned) {
    const hitPips = '●'.repeat(hits) + '○'.repeat(Math.max(0, 5 - hits));
    hpElem.textContent = `${health}% [${hitPips}]`;
    hpElem.style.color = health > 40 ? '#00ff88' : '#ff334b';
  }

  const lockonIndicator = document.getElementById('lockon-indicator');
  const statusBadge = document.getElementById('hud-status');

  if (isInViewfinder && !state.timerStarted && state.currentScreen === 'mission') {
    start4SecondWindow();
  }

  if (isLocked) {
    if (lockonIndicator) lockonIndicator.classList.add('active');
    if (statusBadge) {
      statusBadge.textContent = `⚡ LOCKED [HITBOX: ${data.hitboxScale || 100}%] // TAP TO FIRE!`;
      statusBadge.style.borderColor = '#00ff88';
      statusBadge.style.color = '#00ff88';
    }
  } else {
    if (lockonIndicator) lockonIndicator.classList.remove('active');
    if (state.timerStarted && statusBadge) {
      statusBadge.textContent = `🚨 IN SIGHT [HITBOX: ${data.hitboxScale || 100}%] — ALIGN CROSSHAIR!`;
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
      const dirText = result.evasionDir ? ` [EVADING ${result.evasionDir}!]` : '';
      statusBadge.textContent = `💥 DIRECT HIT!${dirText} [${result.hits}/5]`;
      statusBadge.style.borderColor = '#ff9933';
      statusBadge.style.color = '#ff9933';
    }

    // Check if target is completely neutralized (5 hits)
    if (result.isEliminated) {
      // 1. Play Death Scream IMMEDIATELY (0ms)
      playSound('deathScream');

      // 2. Display Cinematic Elimination Banner
      const banner = document.getElementById('kill-banner-overlay');
      const bannerSub = document.getElementById('kill-banner-codename');
      const curTarget = state.targetsList[state.targetIndex] || {};
      if (bannerSub) {
        bannerSub.textContent = `${curTarget.codename || 'HOSTILE'} NEUTRALIZED`;
      }
      if (banner) banner.classList.add('active');

      if (hpElem) {
        hpElem.textContent = '0% [●●●●●] ELIMINATED';
        hpElem.style.color = '#ff334b';
      }

      clearInterval(state.missionTimerInterval);
      if (state.spawnTimeout) clearTimeout(state.spawnTimeout);

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

        // Advance to next terrorist in dataset and pick random memorial
        state.targetIndex = (state.targetIndex + 1) % state.targetsList.length;
        pickRandomMemorial();

        // Cinematic 1.2s delay before spawning next target
        setTimeout(() => {
          if (banner) banner.classList.remove('active');
          if (state.currentScreen === 'mission' && !state.missionEnded) {
            spawnNextRogueTarget();
          }
        }, 1200);
      } else {
        // --- CAMPAIGN SINGLE MISSION MODE ---
        state.missionEnded = true;

        if (statusBadge) {
          statusBadge.textContent = '☠️ HOSTILE NEUTRALIZED // MISSION ACCOMPLISHED';
          statusBadge.style.borderColor = '#00ff88';
          statusBadge.style.color = '#00ff88';
        }

        try {
          state.capturedEvidence = arEngine.captureEvidencePhoto();
        } catch (e) {
          state.capturedEvidence = null;
        }

        // Cinematic 1.5s delay before smooth transition to debrief screen
        setTimeout(() => {
          if (banner) banner.classList.remove('active');
          handleMissionOutcome(true, 'ELIMINATED');
        }, 1500);
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

  const killBanner = document.getElementById('kill-banner-overlay');
  if (killBanner) killBanner.classList.remove('active');
  const evadeBanner = document.getElementById('evade-banner-overlay');
  if (evadeBanner) evadeBanner.classList.remove('active');

  clearInterval(state.missionTimerInterval);
  if (state.spawnTimeout) clearTimeout(state.spawnTimeout);
  arEngine.stop();

  // Randomly select a braveheart memorial tribute for this mission debrief
  pickRandomMemorial();

  const currentTarget = state.targetsList[state.targetIndex] || {};
  const currentMemorial = state.memorialsList[state.memorialIndex] || {};

  const resultHeader = document.getElementById('result-header');
  const resultBadge = document.getElementById('result-badge');
  const resultTitle = document.getElementById('result-title');
  const resultSubtitle = document.getElementById('result-subtitle');
  const evidenceImg = document.getElementById('result-evidence-img');
  const stampNeutralized = document.getElementById('stamp-neutralized');

  if (evidenceImg) {
    evidenceImg.src = state.capturedEvidence || currentTarget.faceImage || '/assets/target1_mugshot.jpg';
  }

  if (stampNeutralized) {
    if (isSuccess || (state.gameMode === 'ROGUE' && state.rogueStreak > 0)) {
      stampNeutralized.textContent = 'NEUTRALIZED';
      stampNeutralized.style.display = 'block';
      stampNeutralized.style.borderColor = '#ff334b';
      stampNeutralized.style.color = '#ff334b';
    } else {
      stampNeutralized.textContent = 'EVADED';
      stampNeutralized.style.display = 'block';
      stampNeutralized.style.borderColor = '#ff9933';
      stampNeutralized.style.color = '#ff9933';
    }
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
    if (resultSubtitle) resultSubtitle.textContent = `Target ${currentTarget.codename || 'HOSTILE'} successfully neutralized in the operational sector.`;
    playSound('tributeChime');
  } else {
    if (resultHeader) resultHeader.className = 'result-header failed';
    if (resultBadge) resultBadge.textContent = 'MISSION COMPROMISED';
    if (resultTitle) resultTitle.textContent = reason === 'TIMEOUT' ? 'OPERATIONAL WINDOW EXPIRED' : 'TARGET ESCAPED';
    if (resultSubtitle) {
      resultSubtitle.textContent = reason === 'TIMEOUT'
        ? 'The operational window closed before neutralizing the hostile.'
        : 'Hostile evaded target acquisition before neutralization.';
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

  // Optimistically record eliminated target for this operative
  if (isSuccess && currentTarget && currentTarget.codename) {
    if (!state.eliminatedTargets.includes(currentTarget.codename)) {
      state.eliminatedTargets.push(currentTarget.codename);
    }
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
      if (outcomeData.eliminatedTargets) {
        state.eliminatedTargets = outcomeData.eliminatedTargets;
      }

      const scoreValElem = document.getElementById('result-score-val');
      const scoreBreakdownElem = document.getElementById('result-score-breakdown');
      const promoBadge = document.getElementById('result-rank-promo');

      if (isSuccess && scoreValElem) {
        scoreValElem.textContent = `+${outcomeData.scoreEarned.toLocaleString()} PTS`;
        if (scoreBreakdownElem) scoreBreakdownElem.textContent = `Base: 1,000 • Speed Bonus: +${outcomeData.timeBonus} • Time Left: ${state.timeLeft.toFixed(2)}s`;
      } else if (scoreValElem) {
        scoreValElem.textContent = `+0 PTS`;
        if (scoreBreakdownElem) {
          const reasonText = reason === 'TIMEOUT' ? 'Operational window closed' : 'Target engagement unfulfilled';
          scoreBreakdownElem.textContent = `Mission unfulfilled: ${reasonText}`;
        }
      }

      if (outcomeData.promoted && promoBadge) {
        promoBadge.style.display = 'block';
        promoBadge.textContent = `🎖️ PROMOTED TO ${outcomeData.clearanceRank.toUpperCase()}!`;
      } else if (promoBadge) {
        promoBadge.style.display = 'none';
      }

      try {
        localStorage.setItem('dhurandar_agent', JSON.stringify({
          name: state.agentName,
          rank: state.agentRank,
          score: state.agentScore,
          squadron: state.agentSquadron,
          eliminatedTargets: state.eliminatedTargets
        }));
      } catch (e) {}
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
