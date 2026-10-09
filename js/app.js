'use strict';
// app.js — Firebase + Game Controller + UI

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIG — Replace with your Firebase project values
// See README.md for setup instructions
// ─────────────────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD4RyBNdQYcowbf65A2wKNT4iFYA086PO4",
  authDomain:        "full-count-403e2.firebaseapp.com",
  databaseURL:       "https://full-count-403e2-default-rtdb.firebaseio.com",
  projectId:         "full-count-403e2",
  storageBucket:     "full-count-403e2.firebasestorage.app",
  messagingSenderId: "678683733304",
  appId:             "1:678683733304:web:0cdc5c737f160ec0fce5cd"
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────────────────────────────────────
let db;          // Firebase database reference
let gameId;      // Current room code
let myRole = (typeof window !== 'undefined' && window.myRole) ? window.myRole : undefined;      // 'host' | 'guest'
let myUid  = (typeof window !== 'undefined' && window.myUid)  ? window.myUid  : undefined;       // Simple UID

// Local placement (not pushed until committed)
let localPlacement   = { z1:[], z2:[], z3:[] };
let localHand        = [];  // card IDs currently in hand
let selectedCard     = null; // currently selected card ID from hand
let localPitchChoice = null; // legacy alias
let localGuessChoice = null; // legacy alias
let localBeatCard    = null; // cardId placed in active beat (at most 1)
let localPitchType     = null;        // 'fastball' | 'breaking' | 'offspeed' | null (no default highlight)
let localGuessPitch    = null;        // 'fastball' | 'breaking' | 'offspeed' | null (no default highlight)
let localSwingType     = 'balanced';  // 'contact' | 'balanced' | 'power'
let gameListener     = null; // Firebase listener ref

const TOTAL_INNINGS = 3;
const MAX_HAND      = 6;
const ZONE_LIMIT    = 2;  // max cards per zone
const PA_CARD_LIMIT = 4;  // max cards per PA (BC09 The Captain: 5)

// Note: PITCH_RANGES and SWING_RANGES are defined in js/resolution.js


function getPitchIcon(pitch) {
  const p = (pitch || '').toLowerCase();
  if (p === 'fastball') return '🔥';
  if (p === 'breaking') return '🌀';
  if (p === 'offspeed') return '⏱️';
  return '⚾';
}
window.getPitchIcon = getPitchIcon;

function selectPitchType(pitch) {
  localPitchType = pitch;
  localPitchChoice = pitch;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectPitchType = selectPitchType;
window.selectPitchCall = selectPitchType;
window.selectPitchLocation = function() {}; // legacy stub

function selectGuessPitch(pitch) {
  localGuessPitch = pitch;
  localGuessChoice = pitch;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectGuessPitch = selectGuessPitch;

window.selectSwingType = function() {}; // legacy stub
window.selectTargetZone = function() {}; // legacy stub
window.selectBatterGuess = function(guess) {
  localGuessPitch = guess;
  localGuessChoice = guess;
  const g = window._lastGameState;
  if (g) renderPlay(g);
};

function selectBeatCard(cardId) {
  if (!cardId) return;
  localBeatCard = (localBeatCard === cardId) ? null : cardId;
  selectedCard = null;

  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectBeatCard = selectBeatCard;

function removeBeatCard() {
  localBeatCard = null;
  selectedCard = null;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.removeBeatCard = removeBeatCard;

// ── DRAG AND DROP (MOUSE + TOUCH) & SELECTION STATE ──────────────────────────
let draggedCardId = null;
let touchDragCardId = null;
let touchGhostEl = null;
let touchStartX = 0;
let touchStartY = 0;
let isTouchDragging = false;

function handleCardDragStart(e, cardId) {
  const g = window._lastGameState;
  if (g?.currentPA?.beat === 'beat1') {
    if (e.preventDefault) e.preventDefault();
    return;
  }
  draggedCardId = cardId;
  selectedCard = cardId;
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  }
  document.body.classList.add('is-dragging-card');
  const el = e.currentTarget;
  if (el) el.classList.add('is-dragging');
}
window.handleCardDragStart = handleCardDragStart;

function handleCardDragEnd(e) {
  draggedCardId = null;
  document.body.classList.remove('is-dragging-card');
  const el = e.currentTarget;
  if (el) el.classList.remove('is-dragging');
  document.querySelectorAll('.tray-drop-target, .pitch-tray, .b1-card-slot, .b2-card-slot').forEach(t => {
    t.classList.remove('drag-over');
  });
}
window.handleCardDragEnd = handleCardDragEnd;

function handleTrayDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  const el = e.currentTarget || (e.target ? e.target.closest('.tray-drop-target, .pitch-tray, .b1-card-slot, .b2-card-slot') : null);
  if (el && !el.classList.contains('locked') && !el.classList.contains('disabled')) {
    el.classList.add('drag-over');
  }
}
window.handleTrayDragOver = handleTrayDragOver;

function handleTrayDragEnter(e) {
  e.preventDefault();
  const el = e.currentTarget || (e.target ? e.target.closest('.tray-drop-target, .pitch-tray, .b1-card-slot, .b2-card-slot') : null);
  if (el && !el.classList.contains('locked') && !el.classList.contains('disabled')) {
    el.classList.add('drag-over');
  }
}
window.handleTrayDragEnter = handleTrayDragEnter;

function handleTrayDragLeave(e) {
  const el = e.currentTarget;
  if (el) el.classList.remove('drag-over');
}
window.handleTrayDragLeave = handleTrayDragLeave;

function handleTrayDrop(e, pitchType, zoneType) {
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget || (e.target ? e.target.closest('.tray-drop-target, .pitch-tray, .b1-card-slot, .b2-card-slot') : null);
  if (el) el.classList.remove('drag-over');
  if (el && (el.classList.contains('locked') || el.classList.contains('disabled'))) return;

  const cardId = draggedCardId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null) || selectedCard;
  if (!cardId) return;

  const p = pitchType || (el ? el.getAttribute('data-pitch') : null);
  const z = zoneType || (el ? el.getAttribute('data-zone') : null);

  executeCardDrop(cardId, p, z);
}
window.handleTrayDrop = handleTrayDrop;

function executeCardDrop(cardId, pitchType, zoneType) {
  if (!myRole && typeof window !== 'undefined' && window.myRole) {
    myRole = window.myRole;
  }
  const g = window._lastGameState;
  const currentBeat = g?.currentPA?.beat || 'beat1';
  const half = g?.gameState?.half || 'top';
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const iAmPitching = (myRole === pitchingRole);
  const isPitching = (zoneType === 'mound') || (zoneType !== 'plate' && iAmPitching);

  if (currentBeat === 'beat1' || currentBeat === 'beat3') {
    // In Beat 1 & Beat 3: Only pitch type can be selected; cards are not played
    if (pitchType) {
      if (isPitching) {
        localPitchType = pitchType;
      } else {
        localGuessPitch = pitchType;
      }
      if (g) renderPlay(g);
    }
    draggedCardId = null;
    touchDragCardId = null;
    isTouchDragging = false;
    return;
  }

  localBeatCard = cardId;
  selectedCard = cardId;
  draggedCardId = null;
  touchDragCardId = null;
  isTouchDragging = false;

  if (g) renderPlay(g);
}
window.executeCardDrop = executeCardDrop;

// ── TOUCH DRAG FOR MOBILE & TOUCH DEVICES ───────────────────────────────────
function handleTouchDragStart(e, cardId) {
  const g = window._lastGameState;
  if (g?.currentPA?.beat === 'beat1') return;
  if (!e.touches || e.touches.length === 0) return;
  const touch = e.touches[0];
  touchDragCardId = cardId;
  selectedCard = cardId;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  isTouchDragging = false;
}
window.handleTouchDragStart = handleTouchDragStart;

function handleTouchDragMove(e) {
  if (!touchDragCardId || !e.touches || e.touches.length === 0) return;
  const touch = e.touches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;

  if (!isTouchDragging && (dx * dx + dy * dy > 49)) {
    isTouchDragging = true;
    document.body.classList.add('is-dragging-card');

    if (!touchGhostEl) {
      const card = getCard(touchDragCardId);
      touchGhostEl = document.createElement('div');
      touchGhostEl.id = 'touch-drag-ghost';
      touchGhostEl.className = 'touch-ghost-card';
      touchGhostEl.innerHTML = `<span class="card-hero-num">${card ? card.value : '?'}</span>`;
      document.body.appendChild(touchGhostEl);
    }
  }

  if (isTouchDragging && touchGhostEl) {
    e.preventDefault();
    touchGhostEl.style.left = `${touch.clientX}px`;
    touchGhostEl.style.top = `${touch.clientY}px`;

    touchGhostEl.style.display = 'none';
    const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    touchGhostEl.style.display = 'flex';

    document.querySelectorAll('.tray-drop-target, .pitch-tray, .b1-card-slot').forEach(t => t.classList.remove('drag-over'));
    if (elUnder) {
      const targetTray = elUnder.closest('.tray-drop-target, .pitch-tray, .b1-card-slot');
      if (targetTray && !targetTray.classList.contains('locked') && !targetTray.classList.contains('disabled')) {
        targetTray.classList.add('drag-over');
      }
    }
  }
}
window.handleTouchDragMove = handleTouchDragMove;

function handleTouchDragEnd(e) {
  if (touchGhostEl) {
    touchGhostEl.style.display = 'none';
    const touch = e.changedTouches ? e.changedTouches[0] : null;
    let targetTray = null;
    if (touch) {
      const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elUnder) targetTray = elUnder.closest('.tray-drop-target, .pitch-tray, .b1-card-slot');
    }

    if (touchGhostEl.parentNode) touchGhostEl.parentNode.removeChild(touchGhostEl);
    touchGhostEl = null;

    document.querySelectorAll('.tray-drop-target, .pitch-tray, .b1-card-slot').forEach(t => t.classList.remove('drag-over'));
    document.body.classList.remove('is-dragging-card');

    if (targetTray && !targetTray.classList.contains('locked') && !targetTray.classList.contains('disabled')) {
      const pitch = targetTray.getAttribute('data-pitch');
      const zone = targetTray.getAttribute('data-zone');
      executeCardDrop(touchDragCardId, pitch, zone);
      touchDragCardId = null;
      isTouchDragging = false;
      return;
    }
  }

  if (!isTouchDragging && touchDragCardId) {
    selectCard(touchDragCardId);
  }

  touchDragCardId = null;
  isTouchDragging = false;
  document.body.classList.remove('is-dragging-card');
}
window.handleTouchDragEnd = handleTouchDragEnd;

function handleTrayClick(pitchType, zoneType) {
  if (!myRole && typeof window !== 'undefined' && window.myRole) {
    myRole = window.myRole;
  }
  const g = window._lastGameState;
  const currentBeat = g?.currentPA?.beat || 'beat1';
  const half = g?.gameState?.half || 'top';
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const iAmPitching = (myRole === pitchingRole);
  const isPitching = (zoneType === 'mound') || (zoneType !== 'plate' && iAmPitching);

  if ((currentBeat === 'beat1' || currentBeat === 'beat2' || currentBeat === 'beat3') && pitchType) {
    if (isPitching) {
      localPitchType = pitchType;
    } else {
      localGuessPitch = pitchType;
    }
  }

  if (selectedCard) {
    localBeatCard = selectedCard;
    selectedCard = null;
  }
  if (g) renderPlay(g);
}
window.handleTrayClick = handleTrayClick;

// ── TOOLTIP & LONG-PRESS POPUP SYSTEM ────────────────────────────────────────
let tooltipTimer = null;

function showTooltipPopup(title, body) {
  let el = document.getElementById('fc-tooltip-popover');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fc-tooltip-popover';
    el.className = 'fc-tooltip-popover';
    el.onclick = function(e) {
      if (e.target === el) hideTooltipPopup();
    };
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="ttp-card" onclick="event.stopPropagation()">
      <div class="ttp-header">
        <span class="ttp-title">${title}</span>
        <button class="ttp-close" onclick="hideTooltipPopup()">&times;</button>
      </div>
      <div class="ttp-body">${body}</div>
    </div>
  `;
  el.classList.add('visible');
}
window.showTooltipPopup = showTooltipPopup;

function hideTooltipPopup() {
  const el = document.getElementById('fc-tooltip-popover');
  if (el) el.classList.remove('visible');
}
window.hideTooltipPopup = hideTooltipPopup;

function handleTooltipClick(e, title, body) {
  if (e) e.stopPropagation();
  showTooltipPopup(title, body);
}
window.handleTooltipClick = handleTooltipClick;

function handleTooltipTouchStart(e, title, body) {
  if (tooltipTimer) clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    showTooltipPopup(title, body);
  }, 350);
}
window.handleTooltipTouchStart = handleTooltipTouchStart;

function handleTooltipTouchEnd(e) {
  if (tooltipTimer) clearTimeout(tooltipTimer);
}
window.handleTooltipTouchEnd = handleTooltipTouchEnd;

function getArchetypeTooltip(archetype) {
  switch((archetype || '').toLowerCase()) {
    case 'slugger':
      return 'Slugger: Enormous raw power. Barreled contacts on Sweet Spot totals (11–14) produce Home Runs even on pitcher counts.';
    case 'contact':
    case 'contact hitter':
      return 'Contact Hitter: Elite bat control. Avoids strikeouts on fooled pitches and beats out infield singles on clean contact.';
    case 'speedster':
      return 'Speedster: High agility on the bases. Converts bloop hits into extra bases and stretches singles.';
    default:
      return 'Balanced: Solid all-around hitter capable of driving balls into the gaps.';
  }
}
window.getArchetypeTooltip = getArchetypeTooltip;



// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
function initApp() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch(e) {
    console.error('Firebase init failed:', e);
    showError('Firebase not configured. See README.md and update FIREBASE_CONFIG in app.js.');
    return;
  }

  // Read URL params
  const params = new URLSearchParams(window.location.search);
  gameId = params.get('id');
  myRole = params.get('role');
  myUid  = params.get('uid');

  if (!gameId || !myRole || !myUid) {
    // Redirect to lobby if no params
    window.location.href = 'index.html';
    return;
  }

  renderPhaseLoading('Connecting to game...');
  listenToGame();
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function gameRef(path = '') {
  const activeDb = (typeof window !== 'undefined' && window.db) ? window.db : (typeof db !== 'undefined' ? db : null);
  if (!activeDb) {
    const dummy = {
      update: () => Promise.resolve(),
      set: () => Promise.resolve(),
      once: (evt, cb) => { if (cb) cb({ val: () => null }); return Promise.resolve({ val: () => null }); },
      on: () => {},
      off: () => {}
    };
    return dummy;
  }
  return activeDb.ref(`fullcount_games/${gameId}${path ? '/'+path : ''}`);
}


function handleGameState(g) {
  switch(g.phase) {
    case 'lobby':    renderLobbyWait(g);   break;
    case 'roster':   renderRosterSelect(g); break;
    case 'play':     renderPlay(g);        break;
    case 'gameover': renderGameOver(g);    break;
    default: renderPhaseLoading('Waiting...');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOBBY WAIT
// ─────────────────────────────────────────────────────────────────────────────
function renderLobbyWait(g) {
  const guestJoined = g.guest && g.guest.uid;
  if (guestJoined && myRole === 'host') {
    // Both players present — host transitions to roster phase
    gameRef('phase').set('roster');
    return;
  }
  document.getElementById('app').innerHTML = `
    <div class="phase-screen">
      <div class="logo-small">⚾ FULL COUNT</div>
      <h2>Waiting for opponent…</h2>
      <div class="room-code-display">
        <span class="label">Room Code</span>
        <span class="code">${gameId}</span>
      </div>
      <p>Share this code with your opponent so they can join from the lobby.</p>
      <p class="muted">You are: <strong>${g[myRole]?.name || myRole}</strong></p>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// DECK & PLAYABLE HAND MANAGEMENT
// Guarantees player always holds a full hand of 5 role-appropriate playable cards
// ─────────────────────────────────────────────────────────────────────────────
function getPlayerRoleType(role, half) {
  // top half: guest bats, host pitches
  // bottom half: host bats, guest pitches
  const isPitching = (role === 'host' && half === 'top') || (role === 'guest' && half === 'bottom');
  return isPitching ? 'pitcher' : 'batter';
}

function ensurePlayerDeckAndHand(gs, rosters, role) {
  if (!gs || !rosters) return;
  const half = gs.half || 'top';
  const roleType = getPlayerRoleType(role, half); // 'pitcher' or 'batter'
  const presetKey = rosters[role]?.deckPreset || 'grind';
  const preset = DECK_PRESETS[presetKey] || DECK_PRESETS.grind;

  // Initialize role-specific deck & discard collections if missing
  if (!gs.pitcherDecks)    gs.pitcherDecks    = { host: [], guest: [] };
  if (!gs.batterDecks)     gs.batterDecks     = { host: [], guest: [] };
  if (!gs.pitcherDiscards) gs.pitcherDiscards = { host: [], guest: [] };
  if (!gs.batterDiscards)  gs.batterDiscards  = { host: [], guest: [] };
  if (!gs.hands)           gs.hands           = { host: [], guest: [] };

  // Seed pitcher deck from preset if both deck & discards are empty
  if ((!gs.pitcherDecks[role] || gs.pitcherDecks[role].length === 0) &&
      (!gs.pitcherDiscards[role] || gs.pitcherDiscards[role].length === 0)) {
    const pList = preset.pitcherCards ? [...preset.pitcherCards] : preset.cards.filter(id => getCard(id)?.type !== 'batter');
    gs.pitcherDecks[role] = shuffleArray(pList);
    gs.pitcherDiscards[role] = [];
  }

  // Seed batter deck from preset if both deck & discards are empty
  if ((!gs.batterDecks[role] || gs.batterDecks[role].length === 0) &&
      (!gs.batterDiscards[role] || gs.batterDiscards[role].length === 0)) {
    const bList = preset.batterCards ? [...preset.batterCards] : preset.cards.filter(id => getCard(id)?.type !== 'pitcher');
    gs.batterDecks[role] = shuffleArray(bList);
    gs.batterDiscards[role] = [];
  }

  let hand  = [...(gs.hands[role] || [])];
  let pDeck = [...(gs.pitcherDecks[role] || [])];
  let pDisc = [...(gs.pitcherDiscards[role] || [])];
  let bDeck = [...(gs.batterDecks[role] || [])];
  let bDisc = [...(gs.batterDiscards[role] || [])];

  // Purge any dead cards from hand that do not belong to current active role
  const cleanedHand = [];
  hand.forEach(id => {
    const c = getCard(id);
    if (!c) return;
    if (roleType === 'pitcher') {
      if (c.type === 'batter') {
        bDisc.push(id);
      } else {
        cleanedHand.push(id);
      }
    } else {
      if (c.type === 'pitcher') {
        pDisc.push(id);
      } else {
        cleanedHand.push(id);
      }
    }
  });
  hand = cleanedHand;

  // Replenish hand up to 5 cards using role-specific draw pile & recycle discards
  const TARGET_HAND_SIZE = 5;
  if (roleType === 'pitcher') {
    while (hand.length < TARGET_HAND_SIZE) {
      if (pDeck.length === 0) {
        if (pDisc.length === 0) {
          const pList = preset.pitcherCards ? [...preset.pitcherCards] : preset.cards.filter(id => getCard(id)?.type !== 'batter');
          pDisc = [...pList];
        }
        pDeck = shuffleArray(pDisc);
        pDisc = [];
      }
      if (pDeck.length === 0) break;
      hand.push(pDeck.shift());
    }
  } else {
    while (hand.length < TARGET_HAND_SIZE) {
      if (bDeck.length === 0) {
        if (bDisc.length === 0) {
          const bList = preset.batterCards ? [...preset.batterCards] : preset.cards.filter(id => getCard(id)?.type !== 'pitcher');
          bDisc = [...bList];
        }
        bDeck = shuffleArray(bDisc);
        bDisc = [];
      }
      if (bDeck.length === 0) break;
      hand.push(bDeck.shift());
    }
  }

  gs.hands[role] = hand;
  gs.pitcherDecks[role] = pDeck;
  gs.pitcherDiscards[role] = pDisc;
  gs.batterDecks[role] = bDeck;
  gs.batterDiscards[role] = bDisc;
  if (!gs.decks) gs.decks = {};
  gs.decks[role] = (roleType === 'pitcher') ? pDeck : bDeck;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER SELECTION
// ─────────────────────────────────────────────────────────────────────────────
function renderRosterSelect(g) {
  document.getElementById('app').innerHTML = `
    <div class="phase-screen">
      <div class="logo-small">⚾ FULL COUNT</div>
      <h2 style="color:var(--gold-bright);">⚡ Skipping Team Building...</h2>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-top:8px;">Auto-assigning default pitchers and lineups to jump straight into gameplay!</p>
    </div>`;

  if (myRole === 'host' && !window._autoStartingGame) {
    window._autoStartingGame = true;
    autoAssignRostersAndStart(g);
  }
}

function autoAssignRostersAndStart(g) {
  const hostPreset = DECK_PRESETS.grind;
  const guestPreset = DECK_PRESETS.grind;

  const hostPList = hostPreset.pitcherCards ? [...hostPreset.pitcherCards] : hostPreset.cards.filter(id => getCard(id)?.type !== 'batter');
  const hostBList = hostPreset.batterCards ? [...hostPreset.batterCards] : hostPreset.cards.filter(id => getCard(id)?.type !== 'pitcher');
  const hostPDeck = shuffleArray(hostPList);
  const hostBDeck = shuffleArray(hostBList);
  // Host pitches in top of 1st, so starts with 5 pitcher cards
  const hostHand = hostPDeck.splice(0, 5);

  const guestPList = guestPreset.pitcherCards ? [...guestPreset.pitcherCards] : guestPreset.cards.filter(id => getCard(id)?.type !== 'batter');
  const guestBList = guestPreset.batterCards ? [...guestPreset.batterCards] : guestPreset.cards.filter(id => getCard(id)?.type !== 'pitcher');
  const guestPDeck = shuffleArray(guestPList);
  const guestBDeck = shuffleArray(guestBList);
  // Guest bats in top of 1st, so starts with 5 batter cards
  const guestHand = guestBDeck.splice(0, 5);

  const updates = {
    'rosters/host': {
      name: g.host?.name || 'Player 1 (Host)',
      startingPitcher: 'PC01', // "Big Jake" Harmon (Power Pitcher)
      reliefPitcher:   'PC07', // "Setup Man" Kowalski
      lineup:          LINEUP_PRESETS.sluggers.lineup,
      deckPreset:      'grind',
      ready:           true,
    },
    'rosters/guest': {
      name: g.guest?.name || (g.isSolo || g.guest?.isBot ? 'Practice Bot 🤖' : 'Player 2 (Guest)'),
      startingPitcher: 'PC02', // "El Arte" Medina (Control Artist)
      reliefPitcher:   'PC08', // "The Wizard" Chen
      lineup:          LINEUP_PRESETS.balanced.lineup,
      deckPreset:      'grind',
      ready:           true,
    },
    'gameState/hands/host':           hostHand,
    'gameState/pitcherDecks/host':    hostPDeck,
    'gameState/batterDecks/host':     hostBDeck,
    'gameState/pitcherDiscards/host': [],
    'gameState/batterDiscards/host':  [],
    'gameState/decks/host':           hostPDeck,
    'gameState/discards/host':        [],

    'gameState/hands/guest':           guestHand,
    'gameState/pitcherDecks/guest':    guestPDeck,
    'gameState/batterDecks/guest':     guestBDeck,
    'gameState/pitcherDiscards/guest': [],
    'gameState/batterDiscards/guest':  [],
    'gameState/decks/guest':           guestBDeck,
    'gameState/discards/guest':        [],
  };

  gameRef().update(updates).then(() => {
    gameRef().once('value', snap => {
      const liveG = snap.val();
      if (liveG && liveG.phase === 'roster') {
        startGame(liveG);
      }
    });
  }).catch(err => {
    console.error('autoAssignRostersAndStart error:', err);
    window._autoStartingGame = false;
  });
}

function submitRoster() {
  const starter  = document.querySelector('input[name="starter"]:checked')?.value;
  const relief   = document.querySelector('input[name="relief"]:checked')?.value;
  const lineup   = document.querySelector('input[name="lineup"]:checked')?.value;
  const deck     = document.querySelector('input[name="deck"]:checked')?.value;

  if (!starter || !relief || !lineup || !deck) {
    alert('Please select a starting pitcher, relief pitcher, lineup, and deck preset.');
    return;
  }
  if (starter === relief) {
    alert('Your starting pitcher and relief pitcher must be different players.');
    return;
  }

  const preset = DECK_PRESETS[deck] || DECK_PRESETS.grind;
  const pList = preset.pitcherCards ? [...preset.pitcherCards] : preset.cards.filter(id => getCard(id)?.type !== 'batter');
  const bList = preset.batterCards ? [...preset.batterCards] : preset.cards.filter(id => getCard(id)?.type !== 'pitcher');
  const pDeck = shuffleArray(pList);
  const bDeck = shuffleArray(bList);

  // In top of 1st: host pitches (starts with 5 pitcher cards), guest bats (starts with 5 batter cards)
  let hand = [];
  if (myRole === 'host') {
    hand = pDeck.splice(0, 5);
  } else {
    hand = bDeck.splice(0, 5);
  }

  gameRef(`rosters/${myRole}`).set({
    startingPitcher: starter,
    reliefPitcher:   relief,
    lineup:          LINEUP_PRESETS[lineup].lineup,
    deckPreset:      deck,
    ready:           true,
  });

  // Store initial deck/hand state on game
  gameRef(`gameState/hands/${myRole}`).set(hand);
  gameRef(`gameState/pitcherDecks/${myRole}`).set(pDeck);
  gameRef(`gameState/batterDecks/${myRole}`).set(bDeck);
  gameRef(`gameState/pitcherDiscards/${myRole}`).set([]);
  gameRef(`gameState/batterDiscards/${myRole}`).set([]);
  gameRef(`gameState/decks/${myRole}`).set(myRole === 'host' ? pDeck : bDeck);
  gameRef(`gameState/discards/${myRole}`).set([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// START GAME (host only)
// ─────────────────────────────────────────────────────────────────────────────
function startGame(g) {
  const hostStarter = getPitcher(g.rosters.host.startingPitcher);
  const guestStarter = getPitcher(g.rosters.guest.startingPitcher);

  const initialState = {
    inning: 1,
    half:   'top',    // 'top' = guest bats, host pitches; 'bottom' = host bats, guest pitches
    outs:   0,
    score:  { top:0, bottom:0 },
    bases:  { first:false, second:false, third:false },
    batterIndex: { top:0, bottom:0 },
    activePitcher:{ host: g.rosters.host.startingPitcher, guest: g.rosters.guest.startingPitcher },
    pitcherPAs:   { host:0, guest:0 },
    lastPitchCall:{ host:null, guest:null },
    pitcherRatings: {
      host:  { ...(hostStarter?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
      guest: { ...(guestStarter?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
    },
    arsenalCharges: {
      host:  { ...(hostStarter?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) },
      guest: { ...(guestStarter?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) }
    },
    hands:           g.gameState?.hands || { host:[], guest:[] },
    decks:           g.gameState?.decks || { host:[], guest:[] },
    discards:        { host:[], guest:[] },
    pitcherDecks:    g.gameState?.pitcherDecks || { host:[], guest:[] },
    batterDecks:     g.gameState?.batterDecks || { host:[], guest:[] },
    pitcherDiscards: g.gameState?.pitcherDiscards || { host:[], guest:[] },
    batterDiscards:  g.gameState?.batterDiscards || { host:[], guest:[] },
  };

  ensurePlayerDeckAndHand(initialState, g.rosters, 'host');
  ensurePlayerDeckAndHand(initialState, g.rosters, 'guest');

  const paState = {
    phase:             'placing',
    beat:              'beat1',
    committed:         { host:false, guest:false },
    firstRevealedCard: null,
    firstPlayerRole:   null,
    secondPlayerRole:  null,
    beatPlacements:    {
      beat1: { host:{}, guest:{} },
      beat2: { host:{}, guest:{} },
      beat3: { host:{}, guest:{} }
    },
    beatResults:       { beat1:null, beat2:null, beat3:null },
    placement: {
      host:  { z1:[], z2:[], z3:[] },
      guest: { z1:[], z2:[], z3:[] },
    },
    resolution:        null,
    isFirstPAOfInning: true,
  };

  localBeatCard = null;
  selectedCard = null;
  localPitchType = null;
  localGuessPitch = null;

  gameRef().update({ phase:'play', gameState: initialState, currentPA: paState });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GAME RENDER
// ─────────────────────────────────────────────────────────────────────────────
function renderPlay(g) {
  window._lastGameState = g;
  if (!myRole && typeof window !== 'undefined' && window.myRole) {
    myRole = window.myRole;
  }
  const gs   = g.gameState;
  const pa   = g.currentPA;
  const half = (pa.phase === 'resolved' && pa.resolution?.half) ? pa.resolution.half : (gs.half || 'top');

  // Reset zone inspection override on beat or PA transition
  const beatTrackingKey = `${pa?.beat}_${pa?.phase}_${gs?.half}_${gs?.batterIndex?.[half] ?? 0}`;
  if (window._lastBeatTrackingKey !== beatTrackingKey) {
    window.selectedViewZone = null;
    window._lastBeatTrackingKey = beatTrackingKey;
  }

  // Who is batting / pitching
  const battingRole  = half === 'top' ? 'guest' : 'host';
  const pitchingRole = half === 'top' ? 'host'  : 'guest';
  const iAmBatting   = myRole === battingRole;
  const iAmPitching  = myRole === pitchingRole;

  // Current pitcher & batter character cards (with safe fallbacks)
  const pitcherId = gs.activePitcher?.[pitchingRole] || g.rosters?.[pitchingRole]?.startingPitcher || 'PC01';
  const myPitcherChar  = getPitcher(pitcherId);
  const battingLineup  = g.rosters?.[battingRole]?.lineup || [];
  const currentBatterIndex = (gs.batterIndex?.[half] ?? 0) % 9;
  const currentBatterChar  = battingLineup[currentBatterIndex] ? getBatter(battingLineup[currentBatterIndex]) : BATTER_CHARACTERS['BC01'];

  // Initialize arsenalCharges and pitcherRatings if missing
  if (!gs.arsenalCharges) {
    const hostP = getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher);
    const guestP = getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher);
    gs.arsenalCharges = {
      host:  { ...(hostP?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) },
      guest: { ...(guestP?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) }
    };
  }
  if (!gs.pitcherRatings) {
    const hostP = getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher);
    const guestP = getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher);
    gs.pitcherRatings = {
      host:  { ...(hostP?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
      guest: { ...(guestP?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
    };
  }

  // Safety check: ensure hands are full (5 cards) and role-compatible
  const myRoleType = iAmBatting ? 'batter' : 'pitcher';
  const rawHand = gs.hands?.[myRole] || [];
  const needsRefill = rawHand.length < 5 || rawHand.some(id => {
    const c = getCard(id);
    return c && c.type !== 'universal' && c.type !== myRoleType;
  });

  if (needsRefill) {
    if (myRole === 'host') {
      ensurePlayerDeckAndHand(gs, g.rosters, 'host');
      ensurePlayerDeckAndHand(gs, g.rosters, 'guest');
      gameRef('gameState').update({
        hands:           gs.hands,
        pitcherDecks:    gs.pitcherDecks,
        batterDecks:     gs.batterDecks,
        pitcherDiscards: gs.pitcherDiscards,
        batterDiscards:  gs.batterDiscards,
      });
    } else {
      ensurePlayerDeckAndHand(gs, g.rosters, myRole);
      gameRef(`gameState/hands/${myRole}`).set(gs.hands[myRole]);
    }
  }

  // Sync local hand from Firebase
  localHand = gs.hands?.[myRole] || [];

  switch(pa.phase) {
    case 'placing':           renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'beat1_result':      renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'beat3_result':      renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'battle_back_result': renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'wild_pitch_result': renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'reveal':            renderReveal(g, gs, pa, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'resolved':          renderResolved(g, gs, pa, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
  }
}

// ── PLACING PHASE ────────────────────────────────────────────────────────────
function renderPlacing(g, gs, pa, iAmBatting, iAmPitching, pitcherChar, batterChar, pitchingRole, battingRole, half) {
  const myCommitted  = pa.committed?.[myRole]  || false;
  const oppCommitted = pa.committed?.[opponentRole()] || false;
  const staminaState = getPitcherStaminaState(pitcherChar, gs.pitcherPAs[pitchingRole]);
  const score = { batting: gs.score[half], pitching: gs.score[half==='top'?'bottom':'top'] };

  const currentBeat = pa.beat || 'beat1';

  const oppKey = opponentRole();
  const oppName = g.rosters?.[oppKey]?.name || (oppKey === 'host' ? 'Host' : 'Guest');
  const oppHand = gs.hands?.[oppKey] || [];
  const oppChar = iAmBatting ? pitcherChar : batterChar;
  const oppRoleTag = iAmBatting ? '⚾ PITCHING' : '🏏 BATTING';

  const isBot = Boolean(g.isSolo || g.guest?.isBot);
  const myChar = iAmBatting ? batterChar : pitcherChar;

  const canSub = iAmPitching && !myCommitted && gs.activePitcher[pitchingRole] === g.rosters[pitchingRole].startingPitcher;
  const reliefId = canSub ? g.rosters[pitchingRole].reliefPitcher : null;

  const pCharges = gs?.arsenalCharges?.[pitchingRole] || pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 };
  const bScout = batterChar?.scoutingReport || { favoritePitch: 'fastball' };

  const pitcherRatings = gs?.pitcherRatings?.[pitchingRole] || pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };
  const batterRatings = batterChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };
  const curPitch = iAmPitching ? localPitchType : localGuessPitch;

  // Lock In Button Configuration based on Active Beat
  let lockBtnLabel = 'LOCK IN';
  let lockBtnSub = '';
  let lockBtnDisabled = false;

  if (currentBeat === 'beat1' || currentBeat === 'beat3') {
    const isShowdown = (currentBeat === 'beat3');
    if (!curPitch) {
      lockBtnLabel = iAmPitching ? (isShowdown ? 'CHOOSE SHOWDOWN PITCH' : 'CHOOSE PITCH') : (isShowdown ? 'ANTICIPATE SHOWDOWN PITCH' : 'ANTICIPATE PITCH');
      lockBtnSub = iAmPitching ? 'Select Fastball, Breaking, or Offspeed' : 'Guess Fastball, Breaking, or Offspeed';
      lockBtnDisabled = true;
    } else {
      const baseTgt = (typeof getPitcherBaseTarget === 'function')
        ? getPitcherBaseTarget(pitcherChar, curPitch)
        : (pitcherChar?.baseTargets?.[curPitch] ?? 3);
      const readFac = (typeof getBatterReadFactor === 'function')
        ? getBatterReadFactor(batterChar, curPitch)
        : (batterChar?.readFactors?.[curPitch] ?? 1);

      lockBtnLabel = iAmPitching ? (isShowdown ? 'LOCK IN SHOWDOWN PITCH' : 'LOCK IN PITCH') : (isShowdown ? 'LOCK IN SHOWDOWN ANTICIPATION' : 'LOCK IN ANTICIPATION');
      lockBtnSub = iAmPitching
        ? `${curPitch.toUpperCase()} (Base Target: ${baseTgt})`
        : `ANTICIPATING ${curPitch.toUpperCase()} (+${readFac} Read Factor)`;
      lockBtnDisabled = false;
    }
  } else if (currentBeat === 'beat2' || currentBeat === 'beat4') {
    const bData = (currentBeat === 'beat4') ? (pa?.beatResults?.beat3 || {}) : (pa?.beatResults?.beat1 || {});
    const establishedPitch = bData.pitchType || 'fastball';
    const establishedTarget = bData.target ?? bData.effectiveTarget ?? (establishedPitch === 'offspeed' ? 3 : 4);
    const cardObj = localBeatCard ? getCard(localBeatCard) : null;
    const cardVal = cardObj ? (cardObj.value || 0) : 0;

    if (!localBeatCard) {
      lockBtnLabel = 'CHOOSE EXECUTION CARD';
      lockBtnSub = iAmPitching
        ? `Throwing ${establishedPitch.toUpperCase()} (Target ${establishedTarget}) &bull; Pick 1 card from hand`
        : `Facing ${establishedPitch.toUpperCase()} (Target ${establishedTarget}) &bull; Pick 1 card from hand`;
      lockBtnDisabled = true;
    } else {
      lockBtnDisabled = false;
      if (iAmPitching) {
        lockBtnLabel = 'LOCK IN PITCH';
        lockBtnSub = (cardVal >= establishedTarget)
          ? `${establishedPitch.toUpperCase()} &bull; Card [${cardVal}] &ge; Target [${establishedTarget}] (Strike in Zone)`
          : `${establishedPitch.toUpperCase()} &bull; Card [${cardVal}] &lt; Target [${establishedTarget}] (⚠️ Ball in Dirt)`;
      } else {
        lockBtnLabel = 'LOCK IN SWING';
        lockBtnSub = `${establishedPitch.toUpperCase()} &bull; Card [${cardVal}] vs Target [${establishedTarget}] &bull; Ready to Clash`;
      }
    }
  }

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      <!-- TOP HUD: OPPONENT INFORMATION ONLY (CLEAN & MINIMAL) -->
      <header class="game-hud">
        ${renderScoreHeader(gs, half, g.rosters)}
        <div class="opponent-bar">
          <div class="opponent-profile">
            <div class="opp-avatar">${iAmBatting ? '⚾' : '🏏'}</div>
            <div class="opp-meta">
              <div class="opp-name">${oppName}</div>
              <div class="opp-role-tag">${oppRoleTag} &bull; ${oppChar?.name || ''}</div>
            </div>
          </div>
          <div class="opp-hand-count" title="Opponent cards in hand">
            <span>🎴</span>
            <span>${oppHand.length}</span>
          </div>
          <div class="opp-status-pill ${oppCommitted ? 'ready' : (isBot ? 'ready' : 'waiting')}">
            ${oppCommitted ? 'READY' : (isBot ? 'BOT 🤖' : 'CHOOSING')}
          </div>
        </div>
      </header>

      <!-- CENTER BATTLEFIELD: THE DUEL -->
      <main class="battlefield">
        ${renderZoneBoard(pa, iAmBatting, myCommitted, pa.phase, null, pitcherChar, batterChar, gs)}
      </main>

      <!-- BOTTOM PLAYER DOCK: USER CONTROLS ONLY (CLEAN & MINIMAL) -->
      <footer class="player-dock">
        <div class="player-bar">
          <div class="player-profile">
            <div class="my-avatar">${iAmBatting ? '🏏' : '⚾'}</div>
            <div class="my-details">
              <span class="my-role-badge ${iAmBatting ? 'batting' : 'pitching'}">${iAmBatting ? 'YOU ARE BATTING' : 'YOU ARE PITCHING'}</span>
              <span class="my-char-name">${myChar?.name || ''}</span>
            </div>
          </div>
          <div class="dock-controls-row">
            <span class="placed-indicator">${currentBeat === 'beat1' ? 'Beat <b>1</b>: The Read &bull; <b>Choose Pitch</b>' : (currentBeat === 'beat2' ? `Beat <b>2</b>: The Clash &bull; Card: <b>${localBeatCard ? '1' : '0'}</b>/1` : (currentBeat === 'beat3' ? `Beat <b>3</b>: Full Count &bull; <b>Choose Pitch</b>` : `Beat <b>4</b> &bull; Card: <b>${localBeatCard ? '1' : '0'}</b>/1`))}</span>
            ${canSub ? `<button class="btn-relief" onclick="substitutePitcher('${reliefId}')">Relief</button>` : ''}
          </div>
        </div>

        <!-- 3 PITCH SELECTION BUTTONS (RIGHT ABOVE USER'S CARDS IN BEAT 1 & BEAT 3) -->
        ${(currentBeat === 'beat1' || currentBeat === 'beat3') ? renderPitchSelectionButtons(pitcherChar, batterChar, iAmPitching, localPitchType, localGuessPitch, currentBeat) : ''}

        <!-- HAND + TURN ACTION BUTTON -->
        <div class="hand-row">
          ${renderHand(localHand, iAmBatting, iAmPitching, myCommitted, currentBeat)}
          <div class="lock-in-action-area">
            ${!myCommitted ? `
              <button class="btn-snap-lock ${lockBtnDisabled ? 'disabled' : ''}" id="lock-btn" onclick="commitPlacement()" ${lockBtnDisabled ? 'disabled' : ''}>
                <span class="btn-icon">🔒</span>
                <span class="btn-label">${lockBtnLabel}</span>
                <span class="btn-sub">${lockBtnSub}</span>
              </button>
            ` : `
              <div class="locked-indicator-badge">
                <span class="lock-icon">✅</span>
                <span class="lock-text">LOCKED IN</span>
                <span class="btn-sub" style="font-size:0.55rem;color:var(--text-muted);display:block;">Waiting...</span>
              </div>
            `}
          </div>
        </div>
      </footer>

      <!-- BEAT 1 / BEAT 3 RESULT MODAL POP-UP (PITCH SELECTION RESULT) -->
      ${pa.phase === 'beat1_result' ? renderBeat1ResultModal(pa.beatResults?.beat1, pitchingRole === myRole, false) : ''}
      ${pa.phase === 'beat3_result' ? renderBeat1ResultModal(pa.beatResults?.beat3, pitchingRole === myRole, true) : ''}

      <!-- BATTLE BACK RESULT MODAL POP-UP (WHEN IN BATTLE BACK RESULT PHASE) -->
      ${pa.phase === 'battle_back_result' ? renderBattleBackModal(pa.beatResults?.beat2, pitchingRole === myRole) : ''}

      <!-- WILD PITCH MODAL POP-UP (WHEN IN WILD PITCH RESULT PHASE) -->
      ${pa.phase === 'wild_pitch_result' ? renderWildPitchModal(pa.resolution, battingRole === myRole) : ''}
    </div>`;

  updateCardCount();
}

// ── REVEAL PHASE ─────────────────────────────────────────────────────────────
function renderReveal(g, gs, pa, pitcherChar, batterChar, pitchingRole, battingRole, half) {
  const res = pa.resolution;
  const staminaState = getPitcherStaminaState(pitcherChar, gs.pitcherPAs[pitchingRole]);
  const score = { batting: gs.score[half], pitching: gs.score[half==='top'?'bottom':'top'] };
  const currentBeat = pa?.beat || 'beat2';

  const oppKey = opponentRole();
  const oppName = g.rosters?.[oppKey]?.name || (oppKey === 'host' ? 'Host' : 'Guest');
  const oppChar = (battingRole === myRole) ? pitcherChar : batterChar;
  const oppRoleTag = (battingRole === myRole) ? '⚾ PITCHING' : '🏏 BATTING';

  const myChar = (battingRole === myRole) ? batterChar : pitcherChar;
  const iAmBatting = (battingRole === myRole);
  const pCharges = gs?.arsenalCharges?.[pitchingRole] || pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 };
  const bScout = batterChar?.scoutingReport || { favoritePitch: 'fastball' };

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      <!-- TOP HUD: OPPONENT INFORMATION ONLY (CLEAN & MINIMAL) -->
      <header class="game-hud">
        ${renderScoreHeader(gs, half, g.rosters)}
        <div class="opponent-bar">
          <div class="opponent-profile" onclick="toggleMatchupModal(true)">
            <div class="opp-avatar">${battingRole === myRole ? '⚾' : '🏏'}</div>
            <div class="opp-meta">
              <div class="opp-name">${oppName}</div>
              <div class="opp-role-tag">${oppRoleTag} &bull; ${oppChar?.name || ''}</div>
            </div>
          </div>
          <div class="opp-status-pill ready">REVEAL</div>
        </div>
      </header>

      <!-- CENTER BATTLEFIELD -->
      <main class="battlefield">
        ${renderZoneBoard(pa, battingRole === myRole, true, 'reveal', res, pitcherChar, batterChar, gs)}
      </main>

      <!-- BOTTOM PLAYER DOCK: USER CONTROLS ONLY (CLEAN & MINIMAL) -->
      <footer class="player-dock">
        <div class="player-bar">
          <div class="player-profile" onclick="toggleMatchupModal(true)">
            <div class="my-avatar">${battingRole === myRole ? '🏏' : '⚾'}</div>
            <div class="my-details">
              <span class="my-role-badge ${battingRole === myRole ? 'batting' : 'pitching'}">${battingRole === myRole ? 'YOU ARE BATTING' : 'YOU ARE PITCHING'}</span>
              <span class="my-char-name">${myChar?.name || ''}</span>
            </div>
          </div>
          <button class="btn-intel" onclick="toggleMatchupModal(true)">ℹ️ Intel</button>
        </div>

        <div class="hand-row">
          ${renderHand(localHand, battingRole === myRole, pitchingRole === myRole, true, currentBeat, pa?.firstRevealedCard, batterChar)}
        </div>
      </footer>

      <!-- OUTCOME MODAL OVERLAY -->
      ${(pa.phase === 'wild_pitch_result' || res?.outcome?.isWildPitchReset) ? renderWildPitchModal(res, battingRole === myRole) : (res ? renderOutcomeOverlay(res, battingRole === myRole) : '')}

      <!-- MATCHUP INTEL DRAWER -->
      ${renderMatchupDrawer(pitcherChar, staminaState, gs.pitcherPAs[pitchingRole], pitchingRole === myRole, g.rosters[pitchingRole].reliefPitcher, gs.activePitcher[pitchingRole], batterChar, battingRole === myRole, score, gs, half)}
    </div>`;
}

// ── RESOLVED — same as reveal with next batter button ────────────────────────
function renderResolved(g, gs, pa, pitcherChar, batterChar, pitchingRole, battingRole, half) {
  renderReveal(g, gs, pa, pitcherChar, batterChar, pitchingRole, battingRole, half);
}


// ─────────────────────────────────────────────────────────────────────────────
// BEAT 2 COUNT ADVANTAGE & PENALTY BANNER
// ─────────────────────────────────────────────────────────────────────────────
function renderBeat2AdvantageBanner(b1Data, iAmBatting, iAmPitching) {
  const count = b1Data?.count || '3-2';
  let bannerClass = 'count-full';
  let badgeText = '';
  let descText = '';

  if (count === '0-2') {
    bannerClass = 'count-pitcher';
    if (iAmPitching) {
      badgeText = '⚾ 0-2 PITCHER COUNT &bull; TWO-STRIKE ADVANTAGE';
      descText = 'Pitcher holds count leverage: Put-away punchouts active on high heat (15+) and fooled swings. Batter power is suppressed (Sweet Spot capped at Double).';
    } else {
      badgeText = '⚠️ 0-2 TWO-STRIKE COUNT &bull; PLATE PROTECTION DEFICIT';
      descText = 'Defensive count: Fooled swings and high heat trigger strikeouts. Power is capped at a Double even on a Sweet Spot barrel.';
    }
  } else if (count === '3-1') {
    bannerClass = 'count-hitter';
    if (iAmBatting) {
      badgeText = '🏏 3-1 HITTER COUNT &bull; COUNT ADVANTAGE';
      descText = 'Hitter holds count leverage: Pitcher cannot record an out on 3-1! Any strike battles back to a 3-2 Full Count showdown.';
    } else {
      badgeText = '⚠️ 3-1 HITTER COUNT &bull; DISADVANTAGED PITCHER';
      descText = 'Pitcher count deficit: You cannot record an out directly on 3-1. Executing a strike battles back to a 3-2 Full Count showdown!';
    }
  } else {
    bannerClass = 'count-full';
    badgeText = '⚖️ 3-2 FULL COUNT &bull; NEUTRAL DUEL';
    descText = 'Full count payoff: All pitch types available. Pure execution duel on the final pitch!';
  }

  let dominantCallout = '';
  if (b1Data?.isDominant && b1Data?.revealCardFirst) {
    const iAmDisadvantaged = (iAmPitching && b1Data.revealCardFirst === 'pitcher') || (iAmBatting && b1Data.revealCardFirst === 'batter');
    if (iAmDisadvantaged) {
      dominantCallout = `<div class="b2-dominant-callout penalty">⚠️ DOMINANT REVEAL PENALTY: You must play your execution card FACE-UP first!</div>`;
    } else {
      dominantCallout = `<div class="b2-dominant-callout">👁️ DOMINANT REVEAL ADVANTAGE: Opponent must play their execution card FACE-UP first!</div>`;
    }
  }

  return `
    <div class="beat2-advantage-banner ${bannerClass}">
      <div class="b2-adv-badge">${badgeText}</div>
      <div class="b2-adv-desc">${descText}</div>
      ${dominantCallout}
    </div>`;
}

// ── ON-FIELD PLAYER STATS & SCOUTING REPORT BADGES ─────────────────────────
function renderFieldPitcherInfo(pitcherChar, charges, isFatigued, isUserPitching, count, pitcherRatings) {
  const name = pitcherChar?.name || 'Pitcher';
  const label = isUserPitching ? 'YOU' : 'OPP';
  return `
    <div class="field-player-card pitcher-info-card">
      <div class="fpc-main">
        <div class="fpc-identity">
          <span class="fpc-role-icon">⚾</span>
          <span class="fpc-role-title">PITCHER <span class="fpc-side-pill ${isUserPitching ? 'mine' : 'opp'}">${label}</span></span>
          <span class="fpc-name">${name}</span>
          ${isFatigued ? '<span class="fpc-fatigue-badge" title="Pitcher Fatigued: Reduced execution effectiveness">⚠️ FATIGUED</span>' : ''}
        </div>
        <div class="field-scout-chips">
          <span class="scout-chip">${pitcherChar?.archetype || 'Pitcher'}</span>
        </div>
      </div>
    </div>`;
}

function renderFieldBatterInfo(batterChar, isUserBatting, count) {
  const name = batterChar?.name || 'Batter';
  const label = isUserBatting ? 'YOU' : 'OPP';
  return `
    <div class="field-player-card batter-info-card">
      <div class="fpc-main">
        <div class="fpc-identity">
          <span class="fpc-role-icon">🏏</span>
          <span class="fpc-role-title">BATTER <span class="fpc-side-pill ${isUserBatting ? 'mine' : 'opp'}">${label}</span></span>
          <span class="fpc-name">${name}</span>
        </div>
        <div class="field-scout-chips">
          <span class="scout-chip">${batterChar?.archetype || 'Batter'}</span>
        </div>
      </div>
    </div>`;
}

// ── PITCH SELECTION DOCK (PLACED RIGHT ABOVE USER'S CARDS IN BEAT 1 & 3) ──
function renderPitchSelectionButtons(pitcherChar, batterChar, isPitching, localPitch, localGuess, currentBeat) {
  const pTargets = pitcherChar?.baseTargets || { fastball: 4, breaking: 4, offspeed: 3 };
  const bReads = batterChar?.readFactors || { fastball: 1, breaking: 2, offspeed: 1 };

  const pitches = [
    { key: 'fastball', name: 'Fastball', icon: '🔥' },
    { key: 'breaking', name: 'Breaking', icon: '🌀' },
    { key: 'offspeed', name: 'Offspeed', icon: '⏱️' }
  ];

  const buttonsHtml = pitches.map(p => {
    const isSelected = isPitching ? (localPitch === p.key) : (localGuess === p.key);
    const tgt = (typeof getPitcherBaseTarget === 'function')
      ? getPitcherBaseTarget(pitcherChar, p.key)
      : (pTargets[p.key] ?? (p.key === 'offspeed' ? 3 : 4));
    const read = (typeof getBatterReadFactor === 'function')
      ? getBatterReadFactor(batterChar, p.key)
      : (bReads[p.key] ?? 1);

    const badgeText = isPitching
      ? `Target ${tgt}`
      : `Target ${tgt} <small>(+${read} Read)</small>`;

    const selectedPill = isSelected
      ? `<div class="tray-selected-pill">${isPitching ? '✓ SELECTED' : '✓ ANTICIPATED'}</div>`
      : '';

    return `
      <div class="pitch-tray choice-tile tray-drop-target ${isSelected ? 'active' : ''}"
           data-pitch="${p.key}"
           data-zone="${isPitching ? 'mound' : 'plate'}"
           ondragover="handleTrayDragOver(event)"
           ondragenter="handleTrayDragEnter(event)"
           ondragleave="handleTrayDragLeave(event)"
           ondrop="handleTrayDrop(event, '${p.key}', '${isPitching ? 'mound' : 'plate'}')"
           onclick="handleTrayClick('${p.key}', '${isPitching ? 'mound' : 'plate'}')"
           data-tooltip-title="${p.name} (Target ${tgt})"
           data-tooltip-body="${isPitching ? `Base Target: ${tgt}. Required minimum card to execute pitch.` : `Anticipate ${p.name}. Base Target: ${tgt}, Read Factor: +${read}.`}">
        <div class="pt-header">
          <span class="pt-icon">${p.icon}</span>
          <span class="pt-name">${p.name}</span>
        </div>
        <span class="pt-rating-badge">${badgeText}</span>
        ${selectedPill}
      </div>
    `;
  }).join('');

  return `
    <div class="pitch-selection-dock" data-zone="b1">
      <div class="pitch-trays-container selection-tiles" data-zone="b1">
        ${buttonsHtml}
      </div>
    </div>
  `;
}


// ─────────────────────────────────────────────────────────────────────────────
// ZONE BOARD RENDERING (BASEBALL DIAMOND ARENA: COUNT DUEL & PAYOFF PITCH)
// ─────────────────────────────────────────────────────────────────────────────
function renderZoneBoard(pa, iAmBatting, myCommitted, phase, res, pitcherChar, batterChar, gs) {
  const myKey  = myRole;
  const oppKey = opponentRole();
  const revealed = phase === 'reveal' || phase === 'resolved';

  const half = (revealed && res?.half) ? res.half : (gs?.half || 'top');
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const charges = gs?.arsenalCharges?.[pitchingRole] || pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 };
  const staminaState = getPitcherStaminaState(pitcherChar, gs?.pitcherPAs?.[pitchingRole]);
  const currentBeat = pa?.beat || 'beat1';

  const b1Data = res?.z1 || pa?.beatResults?.beat1;
  const count = b1Data?.count || (currentBeat === 'beat1' ? '0-0' : '3-2');

  const pDiffs = pitcherChar?.executionDifficulties || { fastball: 3, breaking: 5, offspeed: 8 };
  const bScout = batterChar?.scoutingReport || { hotZone: 'high', coldZone: 'low', favoritePitch: 'fastball' };
  const bDiffs = batterChar?.swingDifficulties || { contact: 3, balanced: 5, power: 8 };

  const oppCommitted = Boolean(pa?.committed?.[oppKey]);
  const cardObj = localBeatCard ? getCard(localBeatCard) : null;
  const bases = gs?.bases || { first: false, second: false, third: false };
  const iAmPitching = !iAmBatting;

  let mainContentHtml = '';

  if (revealed && res) {
    // ── REVEALED AT-BAT CLASH ON THE BASEBALL DIAMOND ──
    const z1 = res.z1 || b1Data;
    const z2 = res.z2;

    const b1WinnerLabel = z1?.winner === 'pitcher' ? "⚾ 0-2 Pitcher Count" : (z1?.winner === 'batter' ? "🏏 3-1 Hitter Count" : "⚖️ 3-2 Full Count");
    const pCardObj = z1?.pitcherCards?.[0] ? getCard(z1.pitcherCards[0]) : null;
    const bCardObj = z1?.batterCards?.[0] ? getCard(z1.batterCards[0]) : null;

    const pPayoffCard = z2?.pitcherCardId ? getCard(z2.pitcherCardId) : null;
    const bPayoffCard = z2?.batterCardId ? getCard(z2.batterCardId) : null;

    const pCardVal = pPayoffCard?.value ?? z2?.pitcherCardVal ?? '—';
    const bCardVal = bPayoffCard?.value ?? z2?.batterCardVal ?? '—';

    const pPitchType = (z2?.pitchType || 'fastball').toUpperCase();
    const bGuessPitch = (z2?.guessPitch || 'fastball').toUpperCase();

    const isMatch = Boolean(z2?.pitchMatched);
    const launchAngle = z2?.launchAngle ?? z2?.total ?? ((typeof pCardVal === 'number' && typeof bCardVal === 'number') ? (pCardVal + bCardVal) : 11);

    const myZ1Val = iAmBatting ? (bCardObj?.value ?? z1?.batterTotal ?? 0) : (pCardObj?.value ?? z1?.pitcherTotal ?? 0);
    const oppZ1Val = iAmBatting ? (pCardObj?.value ?? z1?.pitcherTotal ?? 0) : (bCardObj?.value ?? z1?.batterTotal ?? 0);
    const myZ1Label = iAmBatting ? 'You (B)' : 'You (P)';
    const oppZ1Label = iAmBatting ? 'Opp (P)' : 'Opp (B)';

    // Mound Content (Pitcher 3D Card Flip)
    const moundHtml = `
      <div class="mound-rubber"></div>
      <div class="field-card-container">
        <div class="card-flipper is-flipped">
          <div class="card-face card-back"><span class="card-back-icon">⚾</span></div>
          <div class="card-face card-front"><span class="card-hero-num">${pCardVal}</span></div>
        </div>
        <div class="field-card-tag ${z2?.pitcherExecuted ? 'pass' : 'fail'}">
          ${z2?.pitcherExecuted ? `🟢 ${pPitchType} EXEC` : `🔴 ${pPitchType} HANGER`}
        </div>
      </div>
    `;

    // Plate Content (Batter 3D Card Flip)
    const plateHtml = `
      <div class="home-plate-pentagon"></div>
      <div class="field-card-container">
        <div class="card-flipper is-flipped">
          <div class="card-face card-back"><span class="card-back-icon">🏏</span></div>
          <div class="card-face card-front"><span class="card-hero-num">${bCardVal}</span></div>
        </div>
        <div class="field-card-tag ${z2?.batterExecuted ? 'pass' : 'fail'}">
          ${z2?.batterExecuted ? `🟢 ${bGuessPitch} TIMED` : `🔴 ${bGuessPitch} MISTIMED`}
        </div>
      </div>
    `;

    // Center Clash Beam
    const centerBeamHtml = `
      <div class="field-clash-beam">
        <div class="fcb-badge ${isMatch ? 'match' : 'whiff'}">
          <span class="fcb-title">${isMatch ? '🎯 PITCH ANTICIPATED' : '❌ FOOLED ON PITCH'}</span>
          <span class="fcb-delta">TOTAL ${launchAngle}</span>
        </div>
      </div>
    `;

    mainContentHtml = `
      <div class="diamond-arena revealed-arena">
        <div class="clash-beat-header">
          <span class="cbh-tag">BEAT 1: ${b1WinnerLabel}</span>
          <div class="cbh-cards">
            <span>${myZ1Label}: <b>[${myZ1Val}]</b></span>
            <span>vs</span>
            <span>${oppZ1Label}: <b>[${oppZ1Val}]</b></span>
          </div>
        </div>

        <div class="diamond-field">
          <div class="infield-dirt"></div>
          <div class="basepath-lines"></div>

          <!-- Bases -->
          <div class="diamond-base base-second ${bases.second ? 'occupied' : ''}" title="2nd Base" onclick="handleTooltipClick(event, 'Second Base', '${bases.second ? 'Runner on 2nd base!' : 'Second base is empty.'}')">
            ${bases.second ? '<span class="runner-dot">🏃</span>' : ''}
          </div>
          <div class="diamond-base base-third ${bases.third ? 'occupied' : ''}" title="3rd Base" onclick="handleTooltipClick(event, 'Third Base', '${bases.third ? 'Runner on 3rd base!' : 'Third base is empty.'}')">
            ${bases.third ? '<span class="runner-dot">🏃</span>' : ''}
          </div>
          <div class="diamond-base base-first ${bases.first ? 'occupied' : ''}" title="1st Base" onclick="handleTooltipClick(event, 'First Base', '${bases.first ? 'Runner on 1st base!' : 'First base is empty.'}')">
            ${bases.first ? '<span class="runner-dot">🏃</span>' : ''}
          </div>

          <!-- 1. Purple Box: Pitcher Stats (Top) -->
          <div class="diamond-pitcher-stats ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${renderFieldPitcherInfo(pitcherChar, charges, staminaState?.isFatigued, !iAmBatting, count, gs?.pitcherRatings?.[pitchingRole])}
          </div>

          <!-- 2. Green Box: Pitcher Card Tray / Mound (Center) -->
          <div class="diamond-mound ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${moundHtml}
          </div>

          <!-- Center Clash Beam -->
          ${centerBeamHtml}

          <!-- 3. Orange Box: Batter Card Tray / Home Plate (Bottom) -->
          <div class="diamond-plate-area ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${plateHtml}
          </div>

          <!-- 4. Red Box: Batter Stats (Bottom) -->
          <div class="diamond-batter-stats ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${renderFieldBatterInfo(batterChar, iAmBatting, count)}
          </div>
        </div>

        <!-- Outcome Headline on Field -->
        <div class="clash-outcome-badge diamond-outcome-tag">
          <span class="cob-title">${z2?.outcomeDisplay || res.outcome?.display || 'Outcome Resolved'}</span>
        </div>

        ${renderOutcomeNumberLine({
          pitchType: z2?.pitchType || 'fastball',
          beat: res.z3 ? 'beat3' : 'beat2',
          count: z1?.count || '3-2',
          batterBonus: z2?.batterBaseBonus ?? 0,
          pitcherBonus: z2?.pitcherBaseBonus ?? 0,
          launchAngle: launchAngle,
          pitchMatched: isMatch,
          extraClass: 'diamond-number-line'
        })}
      </div>
    `;

  } else if (currentBeat === 'beat1' || currentBeat === 'beat3') {
    // ── BEAT 1 & BEAT 3: THE READ / FULL COUNT SHOWDOWN (BASEBALL DIAMOND ARENA) ──
    const isBeat3 = (currentBeat === 'beat3');
    const curPitch = !iAmBatting ? localPitchType : localGuessPitch;

    const moundSlotEl = `
      <div class="b1-card-slot ${!iAmBatting ? 'mine' : 'opp'}">
        <span class="slot-role-tag">⚾ Pitcher: ${pitcherChar?.name || 'Pitcher'}</span>
        ${!iAmBatting ? `
          <div class="mound-duel-status">
            ${localPitchType ? `<span class="duel-pick-tag">Delivery: <b>${localPitchType.toUpperCase()}</b></span>` : '<span class="duel-hint-tag">Select pitch below ↓</span>'}
          </div>
        ` : `
          <div class="hidden-opponent-card ${oppCommitted ? '' : 'waiting'}">
            <span class="mystery-mark">${oppCommitted ? '✓ READY' : '⏳ SELECTING PITCH…'}</span>
          </div>
        `}
      </div>
    `;

    const plateSlotEl = `
      <div class="b1-card-slot ${iAmBatting ? 'mine' : 'opp'}">
        <span class="slot-role-tag">🏏 Batter: ${batterChar?.name || 'Batter'}</span>
        ${iAmBatting ? `
          <div class="plate-duel-status">
            ${localGuessPitch ? `<span class="duel-pick-tag">Anticipating: <b>${localGuessPitch.toUpperCase()}</b></span>` : '<span class="duel-hint-tag">Anticipate pitch below ↓</span>'}
          </div>
        ` : `
          <div class="hidden-opponent-card ${oppCommitted ? '' : 'waiting'}">
            <span class="mystery-mark">${oppCommitted ? '✓ READY' : '⏳ ANTICIPATING…'}</span>
          </div>
        `}
      </div>
    `;

    const arenaBannerHtml = isBeat3
      ? `<div class="beat3-banner count-full"><span class="b1-title">⚡ BEAT 3: 3-2 FULL COUNT SHOWDOWN</span></div>`
      : `<div class="beat1-banner"><span class="b1-title">BEAT 1: THE READ</span></div>`;

    mainContentHtml = `
      <div class="${isBeat3 ? 'beat3-arena' : 'beat1-arena'} diamond-arena">
        ${arenaBannerHtml}

        <div class="diamond-field">
          <div class="infield-dirt"></div>
          <div class="basepath-lines"></div>

          <!-- Bases -->
          <div class="diamond-base base-second ${bases.second ? 'occupied' : ''}" title="2nd Base" onclick="handleTooltipClick(event, 'Second Base', '${bases.second ? 'Runner on 2nd base!' : 'Second base is empty.'}')">
            ${bases.second ? '<span class="runner-dot">🏃</span>' : ''}
          </div>
          <div class="diamond-base base-third ${bases.third ? 'occupied' : ''}" title="3rd Base" onclick="handleTooltipClick(event, 'Third Base', '${bases.third ? 'Runner on 3rd base!' : 'Third base is empty.'}')">
            ${bases.third ? '<span class="runner-dot">🏃</span>' : ''}
          </div>
          <div class="diamond-base base-first ${bases.first ? 'occupied' : ''}" title="1st Base" onclick="handleTooltipClick(event, 'First Base', '${bases.first ? 'Runner on 1st base!' : 'First base is empty.'}')">
            ${bases.first ? '<span class="runner-dot">🏃</span>' : ''}
          </div>

          <!-- Mound (Pitcher) -->
          <div class="diamond-mound ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            <div class="mound-rubber"></div>
            ${moundSlotEl}
          </div>

          <!-- Plate (Batter) -->
          <div class="diamond-plate-area ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            <div class="home-plate-pentagon"></div>
            ${plateSlotEl}
          </div>
        </div>
      </div>
    `;

  } else {
    // ── BEAT 2 / BEAT 3 / BEAT 4: THE PAYOFF PITCH ON THE BASEBALL DIAMOND ──
    const isBeat3 = (currentBeat === 'beat3');
    const isBeat4 = (currentBeat === 'beat4');
    const placedZone = (isBeat3 || isBeat4) ? 'z3' : 'z2';
    const pitcherRatings = gs?.pitcherRatings?.[pitchingRole] || pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };
    const batterRatings = batterChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };

    const isDominant = !isBeat3 && !isBeat4 && Boolean(b1Data?.isDominant);
    const disAdvSide = (!isBeat3 && !isBeat4) ? b1Data?.revealCardFirst : null;
    const battingRole = (pitchingRole === 'host') ? 'guest' : 'host';
    const disAdvRole = (disAdvSide === 'pitcher') ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null);
    const isOppDisadvantaged = Boolean(disAdvRole && disAdvRole === oppKey);
    const amIDisadvantaged = Boolean(disAdvRole && disAdvRole === myKey);

    const clashData = isBeat4 ? (pa?.beatResults?.beat3 || {}) : (b1Data || {});
    const establishedPitch = clashData?.pitchType || 'fastball';
    const establishedTarget = clashData?.target ?? clashData?.effectiveTarget ?? (establishedPitch === 'offspeed' ? 3 : 4);
    const pitchIcon = getPitchIcon(establishedPitch);
    const pPitchName = establishedPitch.toUpperCase();

    const curPitch = !isBeat3 ? establishedPitch : (!iAmBatting ? localPitchType : localGuessPitch);
    const curRange = PITCH_RANGES[curPitch] || { min: 1, max: 10, label: '1–10' };
    const cardVal = cardObj ? (cardObj.value || 0) : null;
    const inRange = cardVal !== null ? (cardVal >= curRange.min && cardVal <= curRange.max) : null;

    let oppSlotHtml = '';
    if (isDominant && isOppDisadvantaged && oppCommitted) {
      const oppCardId = pa?.beatPlacements?.beat2?.[oppKey]?.cardId || pa?.firstRevealedCard || null;
      const oppCard = oppCardId ? getCard(oppCardId) : null;
      const oppVal = oppCard ? oppCard.value : '?';
      oppSlotHtml = `
        <div class="opp-revealed-block">
          <div class="number-card sm revealed-faceup-card">
            <span class="card-hero-num">${oppVal}</span>
          </div>
          <div class="revealed-info">
            <span class="revealed-intel-badge">👁️ FACE-UP INTEL</span>
            <span class="ri-title">${iAmBatting ? 'Pitcher' : 'Batter'} committed [${oppVal}]</span>
          </div>
        </div>`;
    } else if (isDominant && isOppDisadvantaged && !oppCommitted) {
      oppSlotHtml = `<span class="opp-status-chip waiting">⏳ WAITING FOR OPPONENT TO COMMIT FACE-UP FIRST…</span>`;
    } else {
      oppSlotHtml = oppCommitted
        ? `<span class="opp-status-chip ready">LOCKED IN ✓</span>`
        : `<span class="opp-status-chip waiting">PLANNING MOVE…</span>`;
    }

    const disAdvNoticeHtml = amIDisadvantaged
      ? `<div class="disadvantaged-notice-banner">⚠️ DOMINANT COUNT DISADVANTAGE: You must lock in your execution card FIRST. Your card value will be visible to your opponent!</div>`
      : '';

    // Mound Content
    let moundContent = '';
    if (!iAmBatting) {
      // User is Pitcher: Pitch & Target Showcase + Single Execution Card Slot
      moundContent = `
        <div class="mound-rubber"></div>
        <div class="b2-target-showcase mine-territory">
          <div class="b2-pitch-info-row">
            <span class="b2-pitch-badge">${pitchIcon} <b>${pPitchName}</b></span>
            <span class="b2-target-pill">TARGET <b>${establishedTarget}</b></span>
          </div>
          <div class="b2-card-slot tray-drop-target ${localBeatCard ? 'has-card' : 'empty'}"
               data-zone="mound"
               ondragover="handleTrayDragOver(event)"
               ondragenter="handleTrayDragEnter(event)"
               ondragleave="handleTrayDragLeave(event)"
               ondrop="handleTrayDrop(event, null, 'mound')"
               onclick="${localBeatCard ? `selectCard('${localBeatCard}')` : ''}"
               title="Play 1 card to execute pitch">
            ${localBeatCard ? renderMiniPlacedCard(localBeatCard, placedZone, !myCommitted, 0, true) : '<div class="tray-empty-hint">+ Tap Card from Hand</div>'}
          </div>
        </div>
      `;
    } else {
      // Opponent is Pitcher on Mound
      moundContent = `
        <div class="mound-rubber"></div>
        <div class="b2-target-showcase opp-territory">
          <div class="b2-pitch-info-row">
            <span class="b2-pitch-badge">${pitchIcon} <b>${pPitchName}</b></span>
            <span class="b2-target-pill">TARGET <b>${establishedTarget}</b></span>
          </div>
          <div class="opp-mound-status">
            ${oppSlotHtml}
          </div>
        </div>
      `;
    }

    // Plate Content
    let plateContent = '';
    if (iAmBatting) {
      // User is Batter at Home Plate: Anticipation / Read Context + Single Execution Card Slot
      plateContent = `
        <div class="home-plate-pentagon"></div>
        <div class="b2-target-showcase mine-territory">
          <div class="b2-pitch-info-row">
            <span class="b2-anticipation-badge">${clashData?.pitchMatched ? '🎯 ANTICIPATED' : '👀 FACING'} <b>${pPitchName}</b></span>
            <span class="b2-target-pill">TARGET <b>${establishedTarget}</b></span>
          </div>
          <div class="b2-card-slot tray-drop-target ${localBeatCard ? 'has-card' : 'empty'}"
               data-zone="plate"
               ondragover="handleTrayDragOver(event)"
               ondragenter="handleTrayDragEnter(event)"
               ondragleave="handleTrayDragLeave(event)"
               ondrop="handleTrayDrop(event, null, 'plate')"
               onclick="${localBeatCard ? `selectCard('${localBeatCard}')` : ''}"
               title="Play 1 card from hand to clash">
            ${localBeatCard ? renderMiniPlacedCard(localBeatCard, placedZone, !myCommitted, 0, false) : '<div class="tray-empty-hint">+ Tap Card from Hand</div>'}
          </div>
        </div>
      `;
    } else {
      // Opponent is Batter at Home Plate
      plateContent = `
        <div class="home-plate-pentagon"></div>
        <div class="b2-target-showcase opp-territory">
          <div class="b2-pitch-info-row">
            <span class="b2-anticipation-badge">${clashData?.pitchMatched ? '🎯 ANTICIPATED' : '👀 FACING'} <b>${pPitchName}</b></span>
            <span class="b2-target-pill">TARGET <b>${establishedTarget}</b></span>
          </div>
          <div class="opp-plate-status">
            ${oppSlotHtml}
          </div>
        </div>
      `;
    }

    const arenaBannerHtml = isBeat4
      ? `<div class="beat3-banner count-full"><span class="b1-title">⚡ PAYOFF CLASH &bull; 3-2 FULL COUNT</span></div>`
      : `${renderBeat2AdvantageBanner(b1Data, iAmBatting, !iAmBatting)}${disAdvNoticeHtml}`;

    mainContentHtml = `
      <div class="${isBeat4 ? 'beat3-arena' : 'beat2-arena'} diamond-arena">
        ${arenaBannerHtml}

        <div class="diamond-field">
          <div class="infield-dirt"></div>
          <div class="basepath-lines"></div>

          <!-- Bases -->
          <div class="diamond-base base-second ${bases.second ? 'occupied' : ''}" title="2nd Base" onclick="handleTooltipClick(event, 'Second Base', '${bases.second ? 'Runner on 2nd base!' : 'Second base is empty.'}')">
            ${bases.second ? '<span class="runner-dot">🏃</span>' : ''}
          </div>
          <div class="diamond-base base-third ${bases.third ? 'occupied' : ''}" title="3rd Base" onclick="handleTooltipClick(event, 'Third Base', '${bases.third ? 'Runner on 3rd base!' : 'Third base is empty.'}')">
            ${bases.third ? '<span class="runner-dot">🏃</span>' : ''}
          </div>
          <div class="diamond-base base-first ${bases.first ? 'occupied' : ''}" title="1st Base" onclick="handleTooltipClick(event, 'First Base', '${bases.first ? 'Runner on 1st base!' : 'First base is empty.'}')">
            ${bases.first ? '<span class="runner-dot">🏃</span>' : ''}
          </div>

          <!-- 1. Purple Box: Pitcher Stats (Top) -->
          <div class="diamond-pitcher-stats ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${renderFieldPitcherInfo(pitcherChar, charges, staminaState?.isFatigued, !iAmBatting, count, pitcherRatings)}
          </div>

          <!-- 2. Green Box: Pitcher Card Tray / Mound (Center) -->
          <div class="diamond-mound ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${moundContent}
          </div>

          <!-- 3. Orange Box: Batter Card Tray / Home Plate (Bottom) -->
          <div class="diamond-plate-area ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${plateContent}
          </div>

          <!-- 4. Red Box: Batter Stats (Bottom) -->
          <div class="diamond-batter-stats ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${renderFieldBatterInfo(batterChar, iAmBatting, count)}
          </div>
        </div>

        ${renderOutcomeNumberLine({
          pitchType: curPitch,
          beat: isBeat3 ? 'beat3' : (isBeat4 ? 'beat4' : 'beat2'),
          count: count,
          batterBonus: batterRatings[curPitch] ?? 0,
          pitcherBonus: pitcherRatings[curPitch] ?? 0,
          launchAngle: (cardVal !== null ? (!iAmBatting ? (cardVal + (pitcherRatings[curPitch] ?? 0) + (isOppDisadvantaged && oppCommitted && pa?.beatPlacements?.beat2?.[oppKey]?.cardId ? (getCard(pa?.beatPlacements?.beat2?.[oppKey]?.cardId)?.value || 3) : 3)) : (cardVal + (pitcherRatings[curPitch] ?? 0) + 3)) : null),
          projected: true,
          pitchMatched: true,
          extraClass: 'diamond-number-line'
        })}
      </div>
    `;
  }

  return `
    <div class="battlefield-main">
      ${mainContentHtml}
    </div>`;
}

function formatOutcomeEffect(effect) {
  switch(effect) {
    case 'web_gem': return '🧤 WEB GEM';
    case 'double_play': return '⚡ DOUBLE PLAY';
    case 'wipeout_slider': return '🔥 WIPEOUT';
    case 'infield_shift': return '🛡️ THE SHIFT';
    case 'bunt_shift': return '⚡ BUNT HIT';
    case 'spoil_it': return '⚾ SPOIL IT';
    case 'gap_power': return '🚀 GAP POWER';
    case 'moonshot': return '💥 MOONSHOT';
    default: return effect ? effect.replace('_', ' ').toUpperCase() : '';
  }
}

function renderMiniPlacedCard(id, targetZone, canRemove, index, isPitching = null) {
  const card = getCard(id);
  if (!card) return '';

  const display = (typeof getCardDisplay === 'function')
    ? getCardDisplay(card, isPitching)
    : card.value;

  return `
    <div class="placed-number-card" onclick="${canRemove ? 'removeBeatCard()' : ''}" title="${canRemove ? 'Click to remove' : ''}">
      <span class="pnc-num">${display}</span>
      ${canRemove ? '<span class="remove-btn">✕</span>' : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAND RENDERING (PURE NUMBER CARDS VALUES 1-6)
// ─────────────────────────────────────────────────────────────────────────────
function renderHand(handIds, iAmBatting, iAmPitching, myCommitted, currentBeat = 'beat1') {
  if (!handIds || handIds.length === 0) {
    return '<div class="hand-cards-container"><p class="muted" style="margin:auto;font-size:0.75rem;">Hand empty</p></div>';
  }

  const isBeat1 = (currentBeat === 'beat1' || currentBeat === 'beat3');

  return `
    <div class="hand-cards-container ${isBeat1 ? 'b1-hand-view-only' : ''}">
      ${handIds.map((id) => {
        const card = getCard(id);
        if (!card) return '';
        const inPlacement = isInPlacement(id);
        const isActive = !isBeat1 && isCardActiveForRole(card, iAmBatting, iAmPitching) && !inPlacement && !myCommitted;
        const isSelected = !isBeat1 && ((selectedCard === id) || (localBeatCard === id));
        const displayLabel = card.value;

        return `
          <div class="number-card ${isBeat1 ? 'b1-view-only' : (isActive ? 'active' : 'inactive')} ${isSelected ? 'selected' : ''}"
               draggable="${isActive ? 'true' : 'false'}"
               ondragstart="${isActive ? `handleCardDragStart(event, '${id}')` : ''}"
               ondragend="${isActive ? `handleCardDragEnd(event)` : ''}"
               ontouchstart="${isActive ? `handleTouchDragStart(event, '${id}')` : ''}"
               ontouchmove="${isActive ? `handleTouchDragMove(event)` : ''}"
               ontouchend="${isActive ? `handleTouchDragEnd(event)` : ''}"
               ontouchcancel="${isActive ? `handleTouchDragEnd(event)` : ''}"
               onclick="${isActive ? `selectCard('${id}')` : ''}"
               title="${isBeat1 ? 'Beat 1: The Read. Cards are reserved for Beat 2 execution clash.' : (isActive ? `Value: ${card.value} (Tap to play card)` : 'Cannot play this card')}">
            <span class="card-hero-num">${displayLabel}</span>
          </div>`;
      }).join('')}
    </div>`;
}

function isCardActiveForRole(card, iAmBatting, iAmPitching) {
  if (card.type === 'universal') return true;
  if (iAmBatting  && card.type === 'batter')  return true;
  if (iAmPitching && card.type === 'pitcher') return true;
  return false;
}

function isInPlacement(cardId) {
  if (localBeatCard === cardId) return true;
  return ['z1','z2','z3'].some(z => (localPlacement[z] || []).includes(cardId));
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD INTERACTION
// ─────────────────────────────────────────────────────────────────────────────
function selectCard(cardId) {
  const g = window._lastGameState;
  const currentBeat = g?.currentPA?.beat || 'beat1';
  if (currentBeat === 'beat1' || currentBeat === 'beat3') {
    return; // Beat 1 & Beat 3: cards cannot be played
  }
  if (localBeatCard === cardId) {
    localBeatCard = null;
    selectedCard = null;
  } else {
    localBeatCard = cardId;
    selectedCard = cardId;
  }
  if (g) renderPlay(g);
}

function placeSelectedCard(zone) {
  if (!selectedCard) return;
  localBeatCard = selectedCard;
  selectedCard = null;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}

function removeFromZone(zone, index) {
  localBeatCard = null;
  selectedCard = null;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}

function attachZoneClickHandlers() {
  // Handled inline via onclick attributes
}

function updateCardCount() {
  const el = document.getElementById('card-count');
  if (el) el.textContent = localBeatCard ? '1' : '0';
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT PLACEMENT (PER BEAT)
// ─────────────────────────────────────────────────────────────────────────────
function commitPlacement() {
  const g = window._lastGameState;
  if (!g) return;
  const pa = g.currentPA || {};
  const gs = g.gameState || {};
  const currentBeat = pa.beat || 'beat1';
  const half = gs.half || 'top';
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const battingRole  = half === 'top' ? 'guest' : 'host';
  const iAmPitching  = (myRole === pitchingRole);
  const isBot        = Boolean(g.isSolo || g.guest?.isBot);
  const b1Data = pa.beatResults?.beat1 || {};
  const establishedPitch = b1Data.pitchType || 'fastball';
  const establishedGuess = b1Data.guessPitch || 'fastball';
  const curPitch     = iAmPitching ? localPitchType : localGuessPitch;

  if (currentBeat === 'beat1') {
    if (!curPitch) {
      alert(iAmPitching ? 'Please choose a pitch type (Fastball, Breaking, or Offspeed).' : 'Please anticipate a pitch type (Fastball, Breaking, or Offspeed).');
      return;
    }
  } else if (currentBeat === 'beat2') {
    if (!localBeatCard) {
      alert('Please choose an execution card from your hand.');
      return;
    }
  } else if (currentBeat === 'beat3') {
    if (!curPitch) {
      alert(iAmPitching ? 'Please choose a pitch type for the 3-2 Full Count Showdown.' : 'Please anticipate a pitch type for the 3-2 Full Count Showdown.');
      return;
    }
  } else if (currentBeat === 'beat4') {
    if (!localBeatCard) {
      alert('Please choose an execution card from your hand for the Payoff Pitch.');
      return;
    }
  }

  const btn = document.getElementById('lock-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">LOCKING IN…</span>';
  }

  // Remove chosen card from hand (in Beat 2 or 4)
  const newHand = [...localHand];
  if (localBeatCard && (currentBeat === 'beat2' || currentBeat === 'beat4')) {
    const idx = newHand.indexOf(localBeatCard);
    if (idx > -1) newHand.splice(idx, 1);
  }
  localHand = newHand;

  const targetZone = (currentBeat === 'beat1') ? 'z1' : (currentBeat === 'beat2' ? 'z2' : 'z3');
  const updatedLocalPlacement = { ...(pa.placement?.[myRole] || { z1:[], z2:[], z3:[] }) };
  if (localBeatCard) {
    updatedLocalPlacement[targetZone] = [localBeatCard];
  }

  gameRef().once('value', snap => {
    const liveG = snap.val();
    if (!liveG) return;
    const livePA = liveG.currentPA || {};
    const liveGS = liveG.gameState || {};

    const liveB1 = livePA.beatResults?.beat1 || b1Data;
    const liveB3 = livePA.beatResults?.beat3 || {};
    const livePitch = (currentBeat === 'beat4') ? (liveB3.pitchType || 'fastball') : (liveB1.pitchType || establishedPitch);
    const liveGuess = (currentBeat === 'beat4') ? (liveB3.guessPitch || 'fastball') : (liveB1.guessPitch || establishedGuess);
    const isReadBeat = (currentBeat === 'beat1' || currentBeat === 'beat3');

    const myBeatPlacement = iAmPitching
      ? { pitchType: (isReadBeat ? curPitch : livePitch), cardId: localBeatCard }
      : { guessPitch: (isReadBeat ? curPitch : liveGuess), cardId: localBeatCard };

    const updates = {
      [`currentPA/beatPlacements/${currentBeat}/${myRole}`]: myBeatPlacement,
      [`currentPA/placement/${myRole}`]:                   updatedLocalPlacement,
      [`currentPA/committed/${myRole}`]:                   true,
      [`gameState/hands/${myRole}`]:                       newHand,
    };

    let shouldResolve = false;

    if (currentBeat === 'beat1') {
      if (isBot && myRole === 'host') {
        const botPlay = executeBotPlayBeat({ ...liveGS, currentPA: livePA }, 'guest', 'beat1');
        const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[], z3:[] }) };
        if (botPlay.cardId) {
          updatedBotPlacement.z1 = [botPlay.cardId];
        }

        const botIsPitching = (liveGS.half === 'top') ? false : true;
        const botBeatPlacement = botIsPitching
          ? { pitchType: botPlay.pitchType || 'fastball', cardId: botPlay.cardId || null }
          : { guessPitch: botPlay.guessPitch || 'fastball', cardId: botPlay.cardId || null };

        updates['currentPA/beatPlacements/beat1/guest'] = botBeatPlacement;
        updates['currentPA/placement/guest']           = updatedBotPlacement;
        updates['currentPA/committed/guest']           = true;
        updates['gameState/hands/guest']               = botPlay.botHand || [];
        shouldResolve = true;
      } else {
        const oppRole = opponentRole();
        if (livePA.committed?.[oppRole]) {
          shouldResolve = true;
        }
      }
    } else if (currentBeat === 'beat2') {
      const b1 = livePA.beatResults?.beat1 || {};
      const half = liveGS.half || 'top';
      const pitchingRole = half === 'top' ? 'host' : 'guest';
      const battingRole  = half === 'top' ? 'guest' : 'host';
      const disAdvSide = b1.revealCardFirst;
      const disAdvRole = (disAdvSide === 'pitcher') ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null);

      if (b1.isDominant && disAdvRole === myRole && localBeatCard) {
        updates['currentPA/firstRevealedCard'] = localBeatCard;
      }

      if (isBot && myRole === 'host') {
        if (!livePA.committed?.guest) {
          const botPlay = executeBotPlayBeat({ ...liveGS, currentPA: livePA }, 'guest', 'beat2', localBeatCard);
          const botIsPitching = (liveGS.half === 'bottom');
          const botBeatPlacement = botIsPitching
            ? { pitchType: botPlay.pitchType || 'fastball', cardId: botPlay.cardId || null }
            : { guessPitch: botPlay.guessPitch || 'fastball', cardId: botPlay.cardId || null };

          const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[], z3:[] }) };
          if (botPlay.cardId) {
            updatedBotPlacement.z2 = [botPlay.cardId];
          }

          updates['currentPA/beatPlacements/beat2/guest'] = botBeatPlacement;
          updates['currentPA/placement/guest']           = updatedBotPlacement;
          updates['currentPA/committed/guest']           = true;
          updates['gameState/hands/guest']               = botPlay.botHand || [];
        }
        shouldResolve = true;
      } else {
        const oppRole = opponentRole();
        if (livePA.committed?.[oppRole]) {
          shouldResolve = true;
        }
      }
    } else if (currentBeat === 'beat3') {
      if (isBot && myRole === 'host') {
        if (!livePA.committed?.guest) {
          const botPlay = executeBotPlayBeat({ ...liveGS, currentPA: livePA }, 'guest', 'beat3');
          const botIsPitching = (liveGS.half === 'bottom');
          const botBeatPlacement = botIsPitching
            ? { pitchType: botPlay.pitchType || 'fastball', cardId: botPlay.cardId || null }
            : { guessPitch: botPlay.guessPitch || 'fastball', cardId: botPlay.cardId || null };

          const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[], z3:[] }) };
          if (botPlay.cardId) {
            updatedBotPlacement.z3 = [botPlay.cardId];
          }

          updates['currentPA/beatPlacements/beat3/guest'] = botBeatPlacement;
          updates['currentPA/placement/guest']           = updatedBotPlacement;
          updates['currentPA/committed/guest']           = true;
          updates['gameState/hands/guest']               = botPlay.botHand || [];
        }
        shouldResolve = true;
      } else {
        const oppRole = opponentRole();
        if (livePA.committed?.[oppRole]) {
          shouldResolve = true;
        }
      }
    } else if (currentBeat === 'beat4') {
      const b3 = livePA.beatResults?.beat3 || {};
      const half = liveGS.half || 'top';
      const pitchingRole = half === 'top' ? 'host' : 'guest';
      const battingRole  = half === 'top' ? 'guest' : 'host';
      const disAdvSide = b3.winner === 'pitcher' ? 'batter' : 'pitcher';
      const disAdvRole = (disAdvSide === 'pitcher' ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null));

      if (b3.isDominant && disAdvRole === myRole && localBeatCard) {
        updates['currentPA/firstRevealedCard'] = localBeatCard;
      }

      if (isBot && myRole === 'host') {
        if (!livePA.committed?.guest) {
          const botPlay = executeBotPlayBeat({ ...liveGS, currentPA: livePA }, 'guest', 'beat4', localBeatCard);
          const botIsPitching = (liveGS.half === 'bottom');
          const botBeatPlacement = botIsPitching
            ? { pitchType: botPlay.pitchType || b3.pitchType || 'fastball', cardId: botPlay.cardId || null }
            : { guessPitch: botPlay.guessPitch || b3.guessPitch || 'fastball', cardId: botPlay.cardId || null };

          const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[], z3:[] }) };
          if (botPlay.cardId) {
            updatedBotPlacement.z3 = [botPlay.cardId];
          }

          updates['currentPA/beatPlacements/beat4/guest'] = botBeatPlacement;
          updates['currentPA/placement/guest']           = updatedBotPlacement;
          updates['currentPA/committed/guest']           = true;
          updates['gameState/hands/guest']               = botPlay.botHand || [];
        }
        shouldResolve = true;
      } else {
        const oppRole = opponentRole();
        if (livePA.committed?.[oppRole]) {
          shouldResolve = true;
        }
      }
    }

    gameRef().update(updates).then(() => {
      localBeatCard = null;
      selectedCard  = null;
      if (shouldResolve && myRole === 'host') {
        if (!window._resolvingBeat) {
          window._resolvingBeat = true;
          resolveBeatStep(currentBeat);
          setTimeout(() => { window._resolvingBeat = false; }, 500);
        }
      }
    }).catch(err => {
      console.error('commitPlacement update error:', err);
      showError('Lock In failed: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-icon">🔒</span><span class="btn-label">LOCK IN</span>`;
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENTIAL BEAT RESOLUTION (HOST ONLY)
// ─────────────────────────────────────────────────────────────────────────────
function resolveBeatStep(beat) {
  gameRef().once('value', snap => {
    try {
      const g = snap.val();
      if (!g || g.currentPA?.resolution) return;
      const gs = g.gameState || {};
      const pa = g.currentPA || {};
      const half = gs.half || 'top';
      const pitchingRole = half === 'top' ? 'host' : 'guest';
      const battingRole  = half === 'top' ? 'guest' : 'host';

      const pitcherChar   = getPitcher(gs.activePitcher?.[pitchingRole]);
      const battingLineup = g.rosters?.[battingRole]?.lineup || [];
      const bIdx          = (gs.batterIndex?.[half] || 0) % 9;
      const batterChar    = getBatter(battingLineup[bIdx]) || BATTER_CHARACTERS['BC01'];

      const pPlacements = pa.beatPlacements?.[beat]?.[pitchingRole] || {};
      const bPlacements = pa.beatPlacements?.[beat]?.[battingRole] || {};

      const pitcherPAsFaced = gs.pitcherPAs?.[pitchingRole] || 0;
      const bases = gs.bases || { first:false, second:false, third:false };
      const score = { batting: gs.score?.[half] || 0, pitching: gs.score?.[half==='top'?'bottom':'top'] || 0 };
      const outs = gs.outs || 0;

      if (beat === 'beat1') {
        const pitcherCardId = pPlacements.cardId || null;
        const pitchType = pPlacements.pitchType || 'fastball';
        const batterCardId = bPlacements.cardId || null;
        const guessPitch = bPlacements.guessPitch || 'fastball';

        // Prepare live pitcher ratings
        const currentRatings = {
          host: { ...(gs.pitcherRatings?.host || getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
          guest: { ...(gs.pitcherRatings?.guest || getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
        };

        const beat1Result = resolveBeat1({
          pitcherCardId,
          pitchType,
          batterCardId,
          guessPitch,
          batterGuess: guessPitch,
          pitchCall: pitchType,
          pitcherChar,
          batterChar,
          pitcherPAsFaced,
          isFirstPAOfInning: Boolean(pa.isFirstPAOfInning),
          pitcherRatings: currentRatings[pitchingRole],
          bases,
          outs,
        });

        // Update pitcher live stamina on pitch thrown
        if (typeof updatePitcherRatingsOnPitch === 'function') {
          updatePitcherRatingsOnPitch(currentRatings, pitchingRole, pitcherChar, pitchType, beat1Result.pitcherCardVal);
        }

        // Knockout check in Beat 1: Instant Walk or Called Strike 3
        if (beat1Result.cascadeEffect === 'walk' || beat1Result.cascadeEffect === 'called_k') {
          const res = resolveSequentialPA({
            beat1: beat1Result,
            bases,
            pitcherChar,
            batterChar,
            score,
            outs,
            half
          });
          finalizePA(g, res, null, currentRatings);
          return;
        }

        // Show Beat 1 Result pop-up before proceeding to Beat 2
        const updates = {
          'currentPA/phase': 'beat1_result',
          'currentPA/beat': 'beat2',
          'currentPA/committed/host': false,
          'currentPA/committed/guest': false,
          'currentPA/beatResults/beat1': beat1Result,
          [`currentPA/placement/${pitchingRole}/z1`]: pitcherCardId ? [pitcherCardId] : [],
          [`currentPA/placement/${battingRole}/z1`]:  batterCardId ? [batterCardId] : [],
          'gameState/pitcherRatings': currentRatings,
        };

        gameRef().update(updates).catch(err => {
          console.error('Beat 1 resolution update error:', err);
          showError('Beat 1 resolution failed: ' + err.message);
        });

      } else if (beat === 'beat2') {
        const beat1Result = pa.beatResults?.beat1 || {};
        const pitcherCardId = pPlacements.cardId || null;
        const pitchType = beat1Result.pitchType || pPlacements.pitchType || 'fastball';

        const batterCardId = bPlacements.cardId || null;
        const guessPitch = beat1Result.guessPitch || bPlacements.guessPitch || 'fastball';
        const target = beat1Result.target ?? beat1Result.effectiveTarget ?? (pitchType === 'offspeed' ? 3 : 4);

        // Prepare live pitcher ratings
        const currentRatings = {
          host: { ...(gs.pitcherRatings?.host || getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
          guest: { ...(gs.pitcherRatings?.guest || getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
        };

        const beat2Result = resolveBeat2({
          count: beat1Result.count || '3-2',
          beat1Winner: beat1Result.winner || 'tie',
          z1Winner: beat1Result.winner || 'tie',
          advantageSide: beat1Result.advantageSide || (beat1Result.pitchMatched ? 'batter' : 'pitcher'),
          pitchType,
          pitcherCardId,
          guessPitch,
          batterCardId,
          target,
          effectiveTarget: target,
          pitcherChar,
          batterChar,
          pitcherPAsFaced,
          bases,
          outs,
          score,
          pitcherAdvantagePerk: beat1Result.pitcherAdvantagePerk,
          batterAdvantagePerk: beat1Result.batterAdvantagePerk,
          pitcherRatings: currentRatings[pitchingRole],
        });

        // Update pitcher live stamina on pitch thrown
        if (typeof updatePitcherRatingsOnPitch === 'function') {
          updatePitcherRatingsOnPitch(currentRatings, pitchingRole, pitcherChar, pitchType, beat2Result.pitcherCardVal);
        }

        // Deduct pitch charge (backward compatibility)
        const charges = { ...(gs.arsenalCharges || {}) };
        if (!charges[pitchingRole]) {
          charges[pitchingRole] = { ...(pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) };
        } else {
          charges[pitchingRole] = { ...charges[pitchingRole] };
        }
        if ((charges[pitchingRole][pitchType] || 0) > 0) {
          charges[pitchingRole][pitchType]--;
        }
        const res = resolveSequentialPA({
          beat1: beat1Result,
          beat2: beat2Result,
          bases,
          pitcherChar,
          batterChar,
          score,
          outs,
          half
        });
        finalizePA(g, res, charges, currentRatings);

      } else if (beat === 'beat3') {
        const beat1Result = pa.beatResults?.beat1 || {};
        const beat2Result = pa.beatResults?.beat2 || {};
        const pitchType = pPlacements.pitchType || 'fastball';
        const guessPitch = bPlacements.guessPitch || 'fastball';

        // Prepare live pitcher ratings
        const currentRatings = {
          host: { ...(gs.pitcherRatings?.host || getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
          guest: { ...(gs.pitcherRatings?.guest || getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
        };

        const beat3Result = resolveBeat3({
          pitchType,
          pitcherCardId: null,
          guessPitch,
          batterCardId: null,
          pitcherChar,
          batterChar,
          bases,
          outs,
          score,
          pitcherRatings: currentRatings[pitchingRole],
        });

        const updates = {
          'currentPA/phase': 'beat3_result',
          'currentPA/beat': 'beat4',
          'currentPA/committed/host': false,
          'currentPA/committed/guest': false,
          'currentPA/beatResults/beat3': beat3Result,
          'currentPA/firstRevealedCard': null,
          'gameState/pitcherRatings': currentRatings,
        };

        gameRef().update(updates).catch(err => {
          console.error('Beat 3 resolution update error:', err);
          showError('Beat 3 resolution failed: ' + err.message);
        });

      } else if (beat === 'beat4') {
        const beat1Result = pa.beatResults?.beat1 || {};
        const beat2Result = pa.beatResults?.beat2 || {};
        const beat3Result = pa.beatResults?.beat3 || {};
        const pitcherCardId = pPlacements.cardId || null;
        const pitchType = beat3Result.pitchType || pPlacements.pitchType || 'fastball';

        const batterCardId = bPlacements.cardId || null;
        const guessPitch = beat3Result.guessPitch || bPlacements.guessPitch || 'fastball';
        const target = beat3Result.target ?? beat3Result.effectiveTarget ?? (pitchType === 'offspeed' ? 3 : 4);

        // Prepare live pitcher ratings
        const currentRatings = {
          host: { ...(gs.pitcherRatings?.host || getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
          guest: { ...(gs.pitcherRatings?.guest || getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
        };

        const beat4Result = resolveBeat4({
          count: '3-2',
          advantageSide: beat3Result.advantageSide || (beat3Result.pitchMatched ? 'batter' : 'pitcher'),
          pitchType,
          pitcherCardId,
          guessPitch,
          batterCardId,
          target,
          effectiveTarget: target,
          pitcherChar,
          batterChar,
          bases,
          outs,
          score,
          pitcherRatings: currentRatings[pitchingRole],
        });

        // Update pitcher live stamina on pitch thrown
        if (typeof updatePitcherRatingsOnPitch === 'function') {
          updatePitcherRatingsOnPitch(currentRatings, pitchingRole, pitcherChar, pitchType, beat4Result.pitcherCardVal);
        }

        // Deduct pitch charge (backward compatibility)
        const charges = { ...(gs.arsenalCharges || {}) };
        if (!charges[pitchingRole]) {
          charges[pitchingRole] = { ...(pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) };
        } else {
          charges[pitchingRole] = { ...charges[pitchingRole] };
        }
        if ((charges[pitchingRole][pitchType] || 0) > 0) {
          charges[pitchingRole][pitchType]--;
        }

        const res = resolveSequentialPA({
          beat1: beat1Result,
          beat2: beat2Result,
          beat3: beat3Result,
          beat4: beat4Result,
          bases,
          pitcherChar,
          batterChar,
          score,
          outs,
          half
        });
        finalizePA(g, res, charges, currentRatings);
      }
    } catch(err) {
      console.error('resolveBeatStep error:', err);
      showError('Beat resolution error: ' + err.message);
    }
  });
}


function resolveAndAdvance() {
  gameRef('currentPA').once('value', snap => {
    const pa = snap.val();
    resolveBeatStep(pa?.beat || 'beat1');
  });
}

function finalizePA(g, res, updatedCharges, updatedRatings) {
  const gs = g.gameState;
  const pa = g.currentPA;
  const half = (res?.half) || (gs.half || 'top');
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const battingRole  = half === 'top' ? 'guest' : 'host';

  const outcome = res.outcome || {};
  let newOuts   = (gs.outs || 0) + (outcome.outsAdded || 0);
  let newBases  = outcome.newBases || gs.bases || { first:false, second:false, third:false };
  const newScore = { ...(gs.score || { top:0, bottom:0 }) };
  newScore[half] = (newScore[half] || 0) + (outcome.runsScored || 0);

  const pitcherChar = getPitcher(gs.activePitcher?.[pitchingRole] || g.rosters?.[pitchingRole]?.startingPitcher);
  if (!updatedRatings) {
    updatedRatings = {
      host: { ...(gs.pitcherRatings?.host || getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
      guest: { ...(gs.pitcherRatings?.guest || getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher)?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) }
    };
  }

  // Stamina Recovery Mechanics:
  // 1. Efficient Out / Strikeout Adrenaline Surge
  const outsAdded = outcome.outsAdded || 0;
  if (outsAdded > 0 && typeof updatePitcherRatingsOnOut === 'function') {
    const isStrikeout = outcome.type === 'k' || outcome.type === 'called_strikeout' || outcome.outcomeType === 'k' || outcome.outcomeType === 'called_k';
    const isQuickOut = !res.beat3; // Retired in <= 2 pitches
    const pitchType = res.beat3?.pitchType || res.beat2?.pitchType || res.beat1?.pitchType || res.primaryPitchCall || 'fastball';
    updatePitcherRatingsOnOut(updatedRatings, pitchingRole, pitcherChar, pitchType, isQuickOut, isStrikeout);
  }

  // 2. Inning Turnover: Bench / dugout rest (+2 to all pitch ratings)
  if (newOuts >= 3 && typeof updatePitcherRatingsOnInningChange === 'function') {
    updatePitcherRatingsOnInningChange(updatedRatings, pitchingRole, pitcherChar);
  }

  const newBatterIndex = { ...(gs.batterIndex || { top:0, bottom:0 }), [half]: (gs.batterIndex?.[half] || 0) + 1 };
  const newPitcherPAs  = { ...(gs.pitcherPAs || { host:0, guest:0 }),  [pitchingRole]: (gs.pitcherPAs?.[pitchingRole] || 0) + 1 };
  const newLastPitch   = { ...(gs.lastPitchCall || {}), [pitchingRole]: res.primaryPitchCall || 'none' };

  let newInning = gs.inning || 1;
  let newHalf   = gs.half || 'top';
  let nextPhase = 'play';

  if (newOuts >= 3) {
    newOuts = 0;
    newBases = { first:false, second:false, third:false };

    if (gs.half === 'top') {
      newHalf = 'bottom';
    } else {
      newHalf = 'top';
      newInning = (gs.inning || 1) + 1;
    }

    if (newInning > TOTAL_INNINGS) {
      const topScore = newScore.top || 0;
      const botScore = newScore.bottom || 0;
      if (topScore !== botScore) {
        nextPhase = 'gameover';
      }
    }
  }

  // Auto-substitute exhausted bot starting pitcher
  const isBot = Boolean(g.isSolo || g.guest?.isBot);
  if (isBot && pitchingRole === 'guest') {
    const botPitcher = getPitcher(gs.activePitcher?.guest);
    const pasFaced = newPitcherPAs.guest;
    if (pasFaced >= (botPitcher?.stamina?.exhaustedMin || 6) && gs.activePitcher?.guest === g.rosters?.guest?.startingPitcher) {
      newPitcherPAs.guest = 0;
      if (gs.activePitcher) gs.activePitcher.guest = g.rosters.guest.reliefPitcher;
      const reliefP = getPitcher(g.rosters.guest.reliefPitcher);
      if (updatedCharges) {
        updatedCharges.guest = { ...(reliefP?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) };
      }
      if (updatedRatings) {
        updatedRatings.guest = { ...(reliefP?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) };
      }
      res.log.push(`Practice Bot brings in relief pitcher: ${reliefP?.name}`);
    }
  }

  const updates = {
    'currentPA/resolution': res,
    'currentPA/phase':      'resolved',
    'gameState/outs':       newOuts,
    'gameState/bases':      newBases,
    'gameState/score':      newScore,
    'gameState/batterIndex':newBatterIndex,
    'gameState/pitcherPAs': newPitcherPAs,
    'gameState/lastPitchCall': newLastPitch,
    'gameState/activePitcher': gs.activePitcher || { host:'PC01', guest:'PC01' },
    'gameState/half':       newHalf,
    'gameState/inning':     newInning,
  };

  if (updatedCharges) {
    updates['gameState/arsenalCharges'] = updatedCharges;
  }
  if (updatedRatings) {
    updates['gameState/pitcherRatings'] = updatedRatings;
  }

  if (nextPhase === 'gameover') {
    updates['phase'] = 'gameover';
  }

  gameRef().update(updates).catch(err => {
    console.error('Firebase resolution update error:', err);
    showError('Resolution save error: ' + err.message);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT PA
// ─────────────────────────────────────────────────────────────────────────────
function nextPA() {
  const btn = document.querySelector('.btn-next-batter');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading Next Batter…';
  }

  gameRef().once('value', snap => {
    try {
      const g = snap.val();
      if (!g) return;
      const gs = g.gameState || {};
      const pa = g.currentPA || {};
      const rosters = g.rosters || {};

      // 1. Recycle placed cards from current PA into respective discard collections
      if (!gs.pitcherDiscards) gs.pitcherDiscards = { host: [], guest: [] };
      if (!Array.isArray(gs.pitcherDiscards.host))  gs.pitcherDiscards.host = [];
      if (!Array.isArray(gs.pitcherDiscards.guest)) gs.pitcherDiscards.guest = [];

      if (!gs.batterDiscards)  gs.batterDiscards  = { host: [], guest: [] };
      if (!Array.isArray(gs.batterDiscards.host))  gs.batterDiscards.host = [];
      if (!Array.isArray(gs.batterDiscards.guest)) gs.batterDiscards.guest = [];

      const playedCards = { host: [], guest: [] };
      ['beat1', 'beat2', 'beat3'].forEach(b => {
        ['host', 'guest'].forEach(r => {
          const cId = pa.beatPlacements?.[b]?.[r]?.cardId;
          if (cId && !playedCards[r].includes(cId)) playedCards[r].push(cId);
        });
      });
      ['host', 'guest'].forEach(r => {
        ['z1', 'z2', 'z3'].forEach(z => {
          (pa.placement?.[r]?.[z] || []).forEach(cId => {
            if (!playedCards[r].includes(cId)) playedCards[r].push(cId);
          });
        });
      });

      ['host', 'guest'].forEach(role => {
        playedCards[role].forEach(id => {
          const c = getCard(id);
          if (!c) return;
          if (c.type === 'pitcher') {
            gs.pitcherDiscards[role].push(id);
          } else if (c.type === 'batter') {
            gs.batterDiscards[role].push(id);
          } else {
            const wasPitching = (role === 'host' && (pa.resolution?.half || gs.half) === 'top') ||
                                (role === 'guest' && (pa.resolution?.half || gs.half) === 'bottom');
            if (wasPitching) {
              gs.pitcherDiscards[role].push(id);
            } else {
              gs.batterDiscards[role].push(id);
            }
          }
        });

        // Purge played cards from hands
        let hand = [...(gs.hands?.[role] || [])];
        playedCards[role].forEach(id => {
          const idx = hand.indexOf(id);
          if (idx > -1) hand.splice(idx, 1);
        });
        if (!gs.hands) gs.hands = {};
        gs.hands[role] = hand;
      });

      // 2. Refill both players' hands up to 5 role-playable cards for upcoming PA
      ensurePlayerDeckAndHand(gs, rosters, 'host');
      ensurePlayerDeckAndHand(gs, rosters, 'guest');

      const isGameOver = g.phase === 'gameover';

      const updates = {
        'gameState/hands':           gs.hands,
        'gameState/pitcherDecks':    gs.pitcherDecks,
        'gameState/batterDecks':     gs.batterDecks,
        'gameState/pitcherDiscards': gs.pitcherDiscards,
        'gameState/batterDiscards':  gs.batterDiscards,
        'gameState/decks/host':      gs.pitcherDecks.host || [],
        'gameState/decks/guest':     gs.pitcherDecks.guest || [],
      };

      if (!isGameOver) {
        updates['currentPA/phase']             = 'placing';
        updates['currentPA/beat']              = 'beat1';
        updates['currentPA/committed/host']    = false;
        updates['currentPA/committed/guest']   = false;
        updates['currentPA/firstRevealedCard'] = null;
        updates['currentPA/firstPlayerRole']   = null;
        updates['currentPA/secondPlayerRole']  = null;
        updates['currentPA/beatPlacements']    = { beat1: { host:{}, guest:{} }, beat2: { host:{}, guest:{} }, beat3: { host:{}, guest:{} } };
        updates['currentPA/beatResults']       = { beat1: null, beat2: null, beat3: null };
        updates['currentPA/placement/host']    = { z1:[], z2:[], z3:[] };
        updates['currentPA/placement/guest']   = { z1:[], z2:[], z3:[] };
        updates['currentPA/resolution']        = null;
        updates['currentPA/isFirstPAOfInning'] = false;
      }

      gameRef().update(updates).then(() => {
        localPitchChoice = null;
        localGuessChoice = null;
        localBeatCard    = null;
        selectedCard     = null;
        localPitchType   = null;
        localGuessPitch  = null;
        localSwingType   = 'balanced';
        localPlacement   = { z1:[], z2:[], z3:[] };
      }).catch(err => {
        console.error('nextPA update error:', err);
        showError('Next batter error: ' + err.message);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Next Batter →';
        }
      });
    } catch(err) {
      console.error('nextPA error:', err);
      showError('Next batter error: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Next Batter →';
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER SUBSTITUTION
// ─────────────────────────────────────────────────────────────────────────────
function substitutePitcher(reliefId) {
  const p = getPitcher(reliefId);
  if (!confirm(`Bring in ${p?.name}?`)) return;
  const updates = {
    [`gameState/activePitcher/${myRole}`]: reliefId,
    [`gameState/pitcherPAs/${myRole}`]:   0,
    [`gameState/arsenalCharges/${myRole}`]: { ...(p?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) },
    [`gameState/pitcherRatings/${myRole}`]: { ...(p?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 }) },
  };
  gameRef().update(updates);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI PANEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function renderScoreHeader(gs, half, rosters) {
  const inningLabel = half === 'top' ? `▲ INNING ${gs.inning}` : `▼ INNING ${gs.inning}`;
  const awayName = rosters.guest?.name || 'VISITOR';
  const homeName = rosters.host?.name || 'HOME';
  return `
    <div class="score-header">
      <div class="score-team away">
        <span class="team-label">${awayName}</span>
        <span class="score-value">${gs.score.top}</span>
      </div>
      <div class="hud-center">
        <div class="inning-badge">${inningLabel}</div>
        <div class="hud-count-row">
          <div class="diamond">
            <div class="base second ${gs.bases.second ? 'occupied' : ''}">◆</div>
            <div class="base-row">
              <div class="base third ${gs.bases.third ? 'occupied' : ''}">◆</div>
              <div class="base first ${gs.bases.first ? 'occupied' : ''}">◆</div>
            </div>
          </div>
          <div class="outs-row">
            ${[0,1,2].map(i => `<span class="out-dot ${i < gs.outs ? 'out-filled' : ''}">●</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="score-team home">
        <span class="score-value">${gs.score.bottom}</span>
        <span class="team-label">${homeName}</span>
      </div>
    </div>`;
}

function renderOuts(outs) {
  return [0,1,2].map(i => `<span class="out-dot ${i < outs ? 'out-filled' : ''}">●</span>`).join('');
}

function renderBases(bases) {
  return `<div class="diamond">
    <div class="base second ${bases.second ? 'occupied' : ''}">◆</div>
    <div class="base-row">
      <div class="base third ${bases.third ? 'occupied' : ''}">◆</div>
      <div class="base first ${bases.first ? 'occupied' : ''}">◆</div>
    </div>
  </div>`;
}

let matchupModalOpen = false;
function toggleMatchupModal(force) {
  const modal = document.getElementById('matchup-modal');
  if (!modal) return;
  if (typeof force === 'boolean') {
    matchupModalOpen = force;
  } else {
    matchupModalOpen = !matchupModalOpen;
  }
  if (matchupModalOpen) {
    modal.classList.add('open');
  } else {
    modal.classList.remove('open');
  }
}
window.toggleMatchupModal = toggleMatchupModal;

function renderMatchupDrawer(pitcherChar, staminaState, pasFaced, isPitcherMe, reliefId, activeId, batterChar, isBatterMe, score, gs, half) {
  return `
    <div id="matchup-modal" class="matchup-modal-overlay ${matchupModalOpen ? 'open' : ''}" onclick="toggleMatchupModal(false)">
      <div class="matchup-drawer" onclick="event.stopPropagation()">
        <div class="drawer-header">
          <span class="drawer-title">⚾ MATCHUP INTEL</span>
          <button class="drawer-close" onclick="toggleMatchupModal(false)">✕</button>
        </div>
        <div class="drawer-content">
          ${renderPitcherPanel(pitcherChar, staminaState, pasFaced, isPitcherMe, reliefId, activeId)}
          ${renderBatterPanel(batterChar, isBatterMe, score, gs, half)}
        </div>
      </div>
    </div>`;
}

function renderPitcherPanel(pitcherChar, staminaState, pasFaced, isMe, reliefId, activeId) {
  if (!pitcherChar) return '<div class="character-panel">No pitcher info</div>';
  const stateColor = staminaState === 'fresh' ? '#2ed573' : staminaState === 'tiring' ? '#ff9f43' : '#ff4757';
  const maxPA = pitcherChar.stamina.tiringMax + 3;
  return `
    <div class="character-panel pitcher-panel" style="border-top: 3px solid ${pitcherChar.color}">
      <div class="cp-role">⚾ PITCHER ${isMe ? '(YOU)' : ''}</div>
      <div class="cp-name" style="color:${pitcherChar.color}">${pitcherChar.name}</div>
      <div class="cp-arch">${pitcherChar.archetype}</div>
      <div class="cp-zones-row">
        ${pitcherChar.baseTargets
          ? `<span>FB Target: <b>${pitcherChar.baseTargets.fastball}</b></span>
             <span>BR Target: <b>${pitcherChar.baseTargets.breaking}</b></span>
             <span>OS Target: <b>${pitcherChar.baseTargets.offspeed}</b></span>`
          : `<span>Z1: <b>${(pitcherChar.zoneBonuses?.z1??0)>=0?'+':''}${pitcherChar.zoneBonuses?.z1??0}</b></span>
             <span>Z2: <b>${(pitcherChar.zoneBonuses?.z2??0)>=0?'+':''}${pitcherChar.zoneBonuses?.z2??0}</b></span>
             <span>Z3: <b>${(pitcherChar.zoneBonuses?.z3??0)>=0?'+':''}${pitcherChar.zoneBonuses?.z3??0}</b></span>`
        }
      </div>
      <div class="stamina-track">
        <div class="stamina-label" style="color:${stateColor}">⏱ Stamina: ${staminaState.toUpperCase()} (PA ${pasFaced})</div>
        <div class="stamina-boxes">
          ${Array.from({length:maxPA},(_, i) => {
            let cls = i < pitcherChar.stamina.freshMax ? 'fresh' : i < pitcherChar.stamina.tiringMax ? 'tiring' : 'gassed';
            return `<div class="stamina-box ${cls} ${i < pasFaced ? 'used' : ''}"></div>`;
          }).join('')}
        </div>
      </div>
      <div class="cp-special">${pitcherChar.specialText}</div>
    </div>`;
}

function renderBatterPanel(batterChar, isMe, score, gs, half) {
  if (!batterChar) return '<div class="character-panel">No batter info</div>';
  const isTrailing = score.batting < score.pitching;
  return `
    <div class="character-panel batter-panel" style="border-top: 3px solid ${batterChar.color}">
      <div class="cp-role">🏏 BATTER ${isMe ? '(YOU)' : ''}</div>
      <div class="cp-name" style="color:${batterChar.color}">${batterChar.name}</div>
      <div class="cp-arch">${batterChar.archetype}</div>
      <div class="cp-zones-row">
        ${batterChar.readFactors
          ? `<span>FB Read: <b>+${batterChar.readFactors.fastball}</b></span>
             <span>BR Read: <b>+${batterChar.readFactors.breaking}</b></span>
             <span>OS Read: <b>+${batterChar.readFactors.offspeed}</b></span>`
          : `<span>Z1: <b>${(batterChar.zoneBonuses?.z1??0)>=0?'+':''}${batterChar.zoneBonuses?.z1??0}</b></span>
             <span>Z2: <b>${(batterChar.zoneBonuses?.z2??0)>=0?'+':''}${batterChar.zoneBonuses?.z2??0}</b></span>
             <span>Z3: <b>${(batterChar.zoneBonuses?.z3??0)>=0?'+':''}${batterChar.zoneBonuses?.z3??0}</b></span>`
        }
      </div>
      ${isTrailing ? `<div style="display:inline-block;background:rgba(255,71,87,0.2);color:#ff4757;font-size:0.65rem;font-weight:800;border-radius:3px;padding:1px 6px;margin-bottom:6px;">⚡ TRAILING</div>` : ''}
      ${gs.bases.second || gs.bases.third ? `<div style="display:inline-block;background:rgba(46,213,115,0.2);color:#2ed573;font-size:0.65rem;font-weight:800;border-radius:3px;padding:1px 6px;margin-bottom:6px;">🏃 RISP</div>` : ''}
      <div class="cp-special">${batterChar.specialText}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAILED AT-BAT RESOLUTION OVERLAY & CASCADE TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

function toggleOverlayPeek() {
  const overlay = document.getElementById('outcome-overlay');
  if (overlay) {
    overlay.classList.toggle('peek-mode');
  }
}
window.toggleOverlayPeek = toggleOverlayPeek;

// ─────────────────────────────────────────────────────────────────────────────
// COLOR-CODED TARGET WINDOW & READ PREVIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function renderOutcomeNumberLine(opts = {}) {
  const pitchType = opts.pitchType || null;
  const beat = opts.beat || 'beat1';
  const count = opts.count || '3-2';
  const extraClass = opts.extraClass || '';

  if (!pitchType) {
    let cellsHtml = '';
    for (let n = 1; n <= 10; n++) {
      cellsHtml += `
        <div class="nl-cell unselected" data-val="${n}">
          <span class="nl-outcome-badge">—</span>
          <div class="nl-num-box">${n}</div>
        </div>
      `;
    }
    return `
      <div class="outcome-number-line-container ${extraClass}">
        <div class="nl-header-row">
          <span class="nl-pitch-badge">🎯 SELECT PITCH TO PREVIEW TARGET &amp; BANDS</span>
          <div class="nl-legend">
            <span class="nl-legend-item"><span class="nl-legend-dot sweet-spot"></span> Match: 3-1</span>
            <span class="nl-legend-item"><span class="nl-legend-dot outside"></span> Fooled: 0-2</span>
          </div>
        </div>
        <div class="nl-track">
          ${cellsHtml}
        </div>
        <div class="nl-footer-note">
          Select Fastball, Breaking, or Offspeed above to preview Target Window &amp; Read Factor.
        </div>
      </div>
    `;
  }

  const pitchIcon = pitchType === 'fastball' ? '🔥' : (pitchType === 'breaking' ? '🌀' : '⏱️');
  const pitchName = pitchType.toUpperCase();

  if (beat === 'beat1') {
    const baseTarget = 5;
    const readFactor = opts.readFactor || 2;
    const elevated = Math.min(10, baseTarget + readFactor);
    const tunneling = opts.tunneling || 2;
    const dragged = Math.max(2, baseTarget - tunneling);

    return `
      <div class="outcome-number-line-container ${extraClass}">
        <div class="nl-header-row">
          <span class="nl-pitch-badge">${pitchIcon} ${pitchName} &bull; Base Target <b>${baseTarget}</b></span>
          <div class="nl-legend">
            <span class="nl-legend-item"><span class="nl-legend-dot sweet-spot"></span> Match: 3-1 Count</span>
            <span class="nl-legend-item"><span class="nl-legend-dot outside"></span> Fooled: 0-2 Count</span>
          </div>
        </div>
        <div class="nl-track b1-preview-track">
          <div class="nl-cell sweet-spot" data-outcome="read">
            <span class="nl-outcome-badge">3-1 HITTER COUNT</span>
            <div class="nl-num-box">Target ${elevated} (${elevated >= 9 ? 'HR' : '2B'})</div>
          </div>
          <div class="nl-cell outside" data-outcome="fooled">
            <span class="nl-outcome-badge">0-2 PITCHER COUNT</span>
            <div class="nl-num-box">Target ${dragged} (OUT)</div>
          </div>
        </div>
        <div class="nl-footer-note">
          <b>Match:</b> Target elevated to <b>${elevated}</b> (+${readFactor} Read &bull; ${elevated >= 9 ? 'Home Run' : 'Double'} unlocked) &bull; <b>Fooled:</b> Target dragged to <b>${dragged}</b> (Pitcher Control)
        </div>
      </div>
    `;
  }

  // ── BEAT 2: THE 10-CARD TARGET WINDOW ──
  const target = opts.target || opts.effectiveTarget || 5;
  const pitcherCardVal = opts.pitcherCardVal || (opts.projectedPitcherCardVal || 6);
  const selectedCardVal = opts.launchAngle || opts.batterCardVal || opts.cardVal || null;

  let cellsHtml = '';
  for (let n = 1; n <= 10; n++) {
    let outcomeClass = '';
    let outcomeLabel = '';

    if (pitcherCardVal !== null && n === pitcherCardVal) {
      outcomeClass = 'center-spot sweet-spot';
      if (target >= 9) outcomeLabel = '💥 HR';
      else if (target >= 7) outcomeLabel = '⚡ 2B';
      else if (target >= 5) outcomeLabel = '🏏 1B';
      else outcomeLabel = 'OUT';
    } else if (pitcherCardVal !== null && n > pitcherCardVal) {
      outcomeClass = 'high-heat outside';
      outcomeLabel = 'K';
    } else if (n < target) {
      outcomeClass = 'low-contact outside';
      outcomeLabel = 'OUT';
    } else {
      // Inside target window: [target <= n < pitcherCardVal]
      outcomeClass = 'line-drive';
      if (target >= 7) outcomeLabel = (n >= 8) ? '2B' : '1B';
      else if (target >= 5) outcomeLabel = '1B';
      else outcomeLabel = 'OUT';
    }

    const isNeedleTarget = (selectedCardVal !== null && n === selectedCardVal);

    cellsHtml += `
      <div class="nl-cell ${outcomeClass} ${isNeedleTarget ? 'highlight-needle' : ''}" data-val="${n}">
        ${isNeedleTarget ? `
          <div class="nl-needle-pin">
            <span class="nl-needle-label">${opts.projected ? 'EST ' : 'CARD '}${selectedCardVal}</span>
            <div class="nl-needle-arrow"></div>
          </div>
        ` : ''}
        <span class="nl-outcome-badge">${outcomeLabel}</span>
        <div class="nl-num-box">${n}</div>
      </div>
    `;
  }

  const legendHtml = `
    <div class="nl-legend">
      <span class="nl-legend-item"><span class="nl-legend-dot outside"></span> &lt;${target} Groundout</span>
      <span class="nl-legend-item"><span class="nl-legend-dot line-drive"></span> Window: Hit</span>
      <span class="nl-legend-item"><span class="nl-legend-dot sweet-spot"></span> Barrel</span>
      <span class="nl-legend-item"><span class="nl-legend-dot outside"></span> &gt;Pitcher: K</span>
    </div>
  `;

  return `
    <div class="outcome-number-line-container ${extraClass}">
      <div class="nl-header-row">
        <span class="nl-pitch-badge">${pitchIcon} ${pitchName} &bull; Target <b>${target}</b></span>
        ${legendHtml}
      </div>
      <div class="nl-track">
        ${cellsHtml}
      </div>
      <div class="nl-footer-note">
        <b>Target Window:</b> &lt;${target} &rarr; <b>Groundout</b> &bull; [${target}..${pitcherCardVal}) &rarr; <b>Hit</b> &bull; Equal &rarr; <b>Barrel (${target >= 9 ? 'HR' : (target >= 7 ? '2B' : '1B')})</b> &bull; &gt;${pitcherCardVal} &rarr; <b>Strikeout</b>
      </div>
    </div>
  `;
}
window.renderOutcomeNumberLine = renderOutcomeNumberLine;

function renderBeat1ResultModal(b1, isPitcherMe, isBeat3 = false) {
  if (!b1) return '';
  const winner = b1.winner || 'tie';
  const count = b1.count || (winner === 'pitcher' ? (isBeat3 ? '3-2' : '0-2') : (winner === 'batter' ? (isBeat3 ? '3-2' : '3-1') : '3-2'));
  const pPitchRaw = b1.pitchType || 'fastball';
  const bGuessRaw = b1.guessPitch || 'fastball';
  const pPitch = pPitchRaw.toUpperCase();
  const bGuess = bGuessRaw.toUpperCase();
  const pIcon = (typeof getPitchIcon === 'function') ? getPitchIcon(pPitchRaw) : '⚾';
  const bIcon = (typeof getPitchIcon === 'function') ? getPitchIcon(bGuessRaw) : '⚾';

  let countTitle = '3-2 FULL COUNT';
  let bannerClass = 'count-full';
  let winnerTag = '⚖️ COUNT TIED';
  let explanation = '';

  if (winner === 'pitcher') {
    countTitle = isBeat3 ? "3-2 FULL COUNT &bull; PITCHER ADVANTAGE" : "0-2 PITCHER'S COUNT &bull; PITCHER ADVANTAGE";
    bannerClass = 'count-pitcher';
    winnerTag = isPitcherMe ? '🎉 YOU WON COUNT' : '⚠️ OPPONENT WON COUNT';
    explanation = isPitcherMe
      ? `Batter was fooled on pitch type (${pPitch} thrown vs ${bGuess} anticipated)! Pitcher holds leverage with Target <b>${b1.effectiveTarget || 4}</b>.`
      : `Fooled on pitch type (${pPitch} thrown vs ${bGuess} anticipated)! Pitcher holds leverage with Target <b>${b1.effectiveTarget || 4}</b>.`;
  } else if (winner === 'batter') {
    countTitle = isBeat3 ? "3-2 FULL COUNT &bull; BATTER ADVANTAGE" : "3-1 HITTER'S COUNT &bull; BATTER ADVANTAGE";
    bannerClass = 'count-hitter';
    winnerTag = !isPitcherMe ? '🎉 YOU WON COUNT' : '⚠️ OPPONENT WON COUNT';
    explanation = !isPitcherMe
      ? `Batter anticipated the delivery (<b>${pPitch}</b>)! Execution target is elevated to <b>${b1.effectiveTarget || 5}</b> (+${b1.readFactor || 1} Read Factor)!`
      : `Opponent anticipated the delivery (<b>${pPitch}</b>)! Execution target is elevated to <b>${b1.effectiveTarget || 5}</b> (+${b1.readFactor || 1} Read Factor)!`;
  } else {
    explanation = `Both players duel at 3-2 Full Count. Target established at <b>${b1.effectiveTarget || 4}</b>.`;
  }

  const myPitchLabel = isPitcherMe ? `Threw <b>${pPitch}</b>` : `Looking <b>${bGuess}</b>`;
  const oppPitchLabel = isPitcherMe ? `Looking <b>${bGuess}</b>` : `Threw <b>${pPitch}</b>`;
  const myRoleTag = isPitcherMe ? '⚾ You (Pitcher)' : '🏏 You (Batter)';
  const oppRoleTag = isPitcherMe ? '🏏 Opponent (Batter)' : '⚾ Opponent (Pitcher)';

  const pitcherTileHtml = `
    <div class="rm-pitch-showcase-tile pitcher-pitch">
      <span class="rm-pitch-tile-icon">${pIcon}</span>
      <span class="rm-pitch-tile-name">${pPitch}</span>
      <span class="rm-pitch-tile-stat">Target ${b1.baseTarget || 4}</span>
    </div>`;

  const batterTileHtml = `
    <div class="rm-pitch-showcase-tile batter-pitch">
      <span class="rm-pitch-tile-icon">${bIcon}</span>
      <span class="rm-pitch-tile-name">${bGuess}</span>
      <span class="rm-pitch-tile-stat">+${b1.readFactor || 1} Read</span>
    </div>`;

  return `
    <div class="result-modal-overlay" id="${isBeat3 ? 'beat3-result-modal' : 'beat1-result-modal'}">
      <div class="result-modal-card">
        <div class="rm-header">
          <span class="rm-tag">${isBeat3 ? 'BEAT 3 RESULT &bull; THE PAYOFF READ' : 'BEAT 1 RESULT &bull; THE READ'}</span>
          <span class="rm-suspense-label">${isBeat3 ? '⚡ PAYOFF READ' : '⚡ THE READ'}</span>
          <span class="rm-winner-pill ${bannerClass}">${winnerTag}</span>
        </div>

        <div class="rm-cards-compare rm-pitches-compare">
          <div class="rm-player-box mine anticipate-flip-p">
            <span class="rm-role">${myRoleTag}</span>
            ${isPitcherMe ? pitcherTileHtml : batterTileHtml}
            <div class="rm-card-meta">${myPitchLabel}</div>
          </div>
          <div class="rm-vs anticipate-vs">VS</div>
          <div class="rm-player-box opp anticipate-flip-b">
            <span class="rm-role">${oppRoleTag}</span>
            ${isPitcherMe ? batterTileHtml : pitcherTileHtml}
            <div class="rm-card-meta">${oppPitchLabel}</div>
          </div>
        </div>

        <div class="rm-count-banner ${bannerClass} anticipate-banner">
          <div class="rm-count-num">${count}</div>
          <div class="rm-count-label">${countTitle}</div>
        </div>

        <div class="rm-target-highlight">
          <span class="rm-th-label">ESTABLISHED TARGET NUMBER</span>
          <span class="rm-th-number">${b1.effectiveTarget || b1.target || 4}</span>
          <span class="rm-th-sub">${winner === 'batter' ? `Base Target ${b1.baseTarget || 4} + Read Factor ${b1.readFactor || 1}` : `Base Target ${b1.baseTarget || 4} (Batter Fooled)`}</span>
        </div>

        <div class="rm-explanation anticipate-explain">
          ${explanation}
        </div>

        ${isBeat3 ? `
          <button class="btn-primary rm-btn anticipate-btn" onclick="proceedToBeat4()">
            Continue to Payoff Pitch Clash &rarr;
          </button>
        ` : `
          <button class="btn-primary rm-btn anticipate-btn" onclick="proceedToBeat2()">
            Continue to Execution Clash &rarr;
          </button>
        `}
      </div>
    </div>`;
}

function proceedToBeat2() {
  localPitchType  = null;
  localGuessPitch = null;
  localBeatCard   = null;
  selectedCard    = null;
  const btn = document.querySelector('#beat1-result-modal .rm-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Proceeding to Payoff Pitch…';
  }

  gameRef().once('value', snap => {
    const g = snap.val();
    if (!g) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Continue to Payoff Pitch &rarr;';
      }
      return;
    }
    const pa = g.currentPA || {};
    const gs = g.gameState || {};
    const isBot = Boolean(g.isSolo || g.guest?.isBot);
    const half = gs.half || 'top';
    const pitchingRole = half === 'top' ? 'host' : 'guest';
    const battingRole  = half === 'top' ? 'guest' : 'host';
    const b1 = pa.beatResults?.beat1 || {};
    const margin = b1.margin ?? Math.abs((b1.pitcherTotal ?? 0) - (b1.batterTotal ?? 0));
    const isDominant = Boolean(b1.isDominant || margin >= 5);

    const updates = {
      'currentPA/phase': 'placing',
      'currentPA/beat': 'beat2',
      'currentPA/committed/host': false,
      'currentPA/committed/guest': false,
      'currentPA/firstRevealedCard': null,
    };

    // If dominant beat, check if Bot is the disadvantaged player who must play first!
    if (isBot && isDominant) {
      const disAdvSide = b1.revealCardFirst || (b1.winner === 'pitcher' ? 'batter' : (b1.winner === 'batter' ? 'pitcher' : null));
      const disAdvRole = (disAdvSide === 'pitcher' ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null));
      if (disAdvRole === 'guest') {
        const botPlay = executeBotPlayBeat({ ...gs, currentPA: pa }, 'guest', 'beat2');
        const botIsPitching = (disAdvSide === 'pitcher');
        const botBeatPlacement = botIsPitching
          ? { pitchType: botPlay.pitchType || 'fastball', cardId: botPlay.cardId || null }
          : { guessPitch: botPlay.guessPitch || 'fastball', cardId: botPlay.cardId || null };

        const updatedBotPlacement = { ...(pa.placement?.guest || { z1:[], z2:[] }) };
        if (botPlay.cardId) {
          updatedBotPlacement.z2 = [botPlay.cardId];
        }

        updates['currentPA/beatPlacements/beat2/guest'] = botBeatPlacement;
        updates['currentPA/placement/guest']           = updatedBotPlacement;
        updates['currentPA/committed/guest']           = true;
        updates['currentPA/firstRevealedCard']         = botPlay.cardId || null;
        updates['gameState/hands/guest']               = botPlay.botHand || [];
      }
    }

    gameRef().update(updates).catch(err => {
      console.error('proceedToBeat2 error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Continue to Payoff Pitch &rarr;';
      }
    });
  });
}
window.proceedToBeat2 = proceedToBeat2;

function proceedToBeat4() {
  localPitchType  = null;
  localGuessPitch = null;
  localBeatCard   = null;
  selectedCard    = null;
  const btn = document.querySelector('#beat3-result-modal .rm-btn') || document.querySelector('#beat1-result-modal .rm-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Proceeding to Payoff Pitch Clash…';
  }

  gameRef().once('value', snap => {
    const g = snap.val();
    if (!g) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Continue to Payoff Pitch Clash &rarr;';
      }
      return;
    }

    const updates = {
      'currentPA/phase': 'placing',
      'currentPA/beat': 'beat4',
      'currentPA/committed/host': false,
      'currentPA/committed/guest': false,
      'currentPA/firstRevealedCard': null,
    };

    gameRef().update(updates).catch(err => {
      console.error('proceedToBeat4 error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Continue to Payoff Pitch Clash &rarr;';
      }
    });
  });
}
window.proceedToBeat4 = proceedToBeat4;

function renderBattleBackModal(b2, isPitcherMe) {
  if (!b2) return '';
  const isBall = Boolean(b2.isBall);
  const pCard = b2.pitcherCardId ? getCard(b2.pitcherCardId) : null;
  const bCard = b2.batterCardId ? getCard(b2.batterCardId) : null;
  const pVal = pCard?.value ?? b2.pitcherCardVal ?? '—';
  const bVal = bCard?.value ?? b2.batterCardVal ?? '—';
  const pPitch = (b2.pitchType || 'fastball').toUpperCase();
  const bGuess = (b2.guessPitch || 'fastball').toUpperCase();
  const pBonus = b2.pitcherBaseBonus ?? 0;
  const bBonus = b2.batterBaseBonus ?? 0;
  const pEff = b2.pitcherEffectiveVal ?? pVal;
  const bEff = b2.batterEffectiveVal ?? bVal;

  const myRoleTag = isPitcherMe ? '⚾ You (Pitcher)' : '🏏 You (Batter)';
  const oppRoleTag = isPitcherMe ? '🏏 Opponent (Batter)' : '⚾ Opponent (Pitcher)';

  const myVal = isPitcherMe ? pVal : (isBall ? bVal : bVal);
  const myPitchLabel = isPitcherMe
    ? (isBall ? `Threw <b>${pPitch}</b> (Missed Target ${b2.target})` : `Threw <b>${pPitch}</b>`)
    : (isBall ? `Card Returned to Hand` : `Looking <b>${bGuess}</b>`);
  const myStatLabel = isPitcherMe ? `+${pBonus} Arm` : `+${bBonus} ${b2.pitchMatched ? 'Power' : 'Bonus'}`;
  const myEff = isPitcherMe ? pEff : bEff;

  const oppVal = isPitcherMe ? (isBall ? '?' : bVal) : pVal;
  const oppPitchLabel = isPitcherMe
    ? (isBall ? `Card Returned to Hand Unrevealed` : `Looking <b>${bGuess}</b>`)
    : (isBall ? `Threw <b>${pPitch}</b> (Missed Target ${b2.target})` : `Threw <b>${pPitch}</b>`);
  const oppStatLabel = isPitcherMe ? `+${bBonus} ${b2.pitchMatched ? 'Power' : 'Bonus'}` : `+${pBonus} Arm`;
  const oppEff = isPitcherMe ? (isBall ? '?' : bEff) : pEff;

  const reason = b2.ruleReason || b2.outcome?.ruleReason || (isBall
    ? `Pitcher played Card ${pVal}, missing Target ${b2.target} (Ball in the dirt!). Pitcher burns card; Batter card returned to hand. Advances to Payoff Pitch!`
    : 'Disadvantaged player fought back to stay alive! The count runs full to 3-2!');

  return `
    <div class="result-modal-overlay" id="battle-back-modal">
      <div class="result-modal-card">
        <div class="rm-header">
          <span class="rm-tag">BEAT 2 RESULT &bull; ${isBall ? 'BALL IN THE DIRT' : 'THE CLASH'}</span>
          <span class="rm-suspense-label">${isBall ? '⚡ BALL IN THE DIRT!' : '⚡ BATTLED BACK!'}</span>
          <span class="rm-winner-pill count-full">${isBall ? '⚾ COUNT IN BATTER FAVOR' : '⚖️ COUNT TIED 3-2'}</span>
        </div>

        <div class="rm-cards-compare">
          <div class="rm-player-box mine anticipate-flip-p">
            <span class="rm-role">${myRoleTag}</span>
            <div class="number-card sm selected">
              <span class="card-hero-num">${myVal}</span>
            </div>
            <div class="rm-card-meta">${myPitchLabel}</div>
            <div class="rm-eff-calc">${isBall && !isPitcherMe ? 'Card Kept in Hand' : `Card ${myVal} [${myStatLabel}] = <b>${myEff}</b>`}</div>
          </div>
          <div class="rm-vs anticipate-vs">VS</div>
          <div class="rm-player-box opp anticipate-flip-b">
            <span class="rm-role">${oppRoleTag}</span>
            <div class="number-card sm selected">
              <span class="card-hero-num">${oppVal}</span>
            </div>
            <div class="rm-card-meta">${oppPitchLabel}</div>
            <div class="rm-eff-calc">${isBall && isPitcherMe ? 'Unrevealed' : `Card ${oppVal} [${oppStatLabel}] = <b>${oppEff}</b>`}</div>
          </div>
        </div>

        ${renderOutcomeNumberLine({
          pitchType: b2.pitchType || 'fastball',
          beat: 'beat2',
          count: b2.count || '3-2',
          batterBonus: bBonus,
          pitcherBonus: pBonus,
          launchAngle: (typeof b2.launchAngle === 'number') ? b2.launchAngle : ((typeof b2.total === 'number') ? b2.total : null),
          pitchMatched: (b2.pitchMatched !== undefined) ? b2.pitchMatched : true
        })}

        <div class="rm-count-banner count-full anticipate-banner">
          <div class="rm-count-num">${b2.count || '3-2'}</div>
          <div class="rm-count-label">${isBall ? 'BALL IN DIRT &bull; PAYOFF PITCH FORCED!' : 'FULL COUNT SHOWDOWN FORCED!'}</div>
        </div>

        <div class="rm-explanation anticipate-explain">
          <div class="rre-text">${reason}</div>
          <div style="margin-top:8px;font-size:0.75rem;color:var(--text-secondary);">
            Both players now advance to <b>Beat 3: 3-2 Full Count Showdown</b>! All pitches and anticipation are back in play.
          </div>
        </div>

        <button class="btn-primary rm-btn btn-battle-back-continue anticipate-btn" onclick="proceedToBeat3()">
          ${isBall ? 'Proceed to Payoff Pitch Showdown &rarr;' : 'Proceed to 3-2 Full Count Showdown &rarr;'}
        </button>
      </div>
    </div>`;
}
window.renderBattleBackModal = renderBattleBackModal;

function proceedToBeat3() {
  localPitchType  = null;
  localGuessPitch = null;
  localBeatCard   = null;
  selectedCard    = null;
  const btn = document.querySelector('#battle-back-modal .rm-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Proceeding to Showdown…';
  }

  gameRef().once('value', snap => {
    const g = snap.val();
    if (!g) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Proceed to 3-2 Full Count Showdown &rarr;';
      }
      return;
    }

    const updates = {
      'currentPA/phase': 'placing',
      'currentPA/beat': 'beat3',
      'currentPA/committed/host': false,
      'currentPA/committed/guest': false,
      'currentPA/firstRevealedCard': null,
    };

    gameRef().update(updates).catch(err => {
      console.error('proceedToBeat3 error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Proceed to 3-2 Full Count Showdown &rarr;';
      }
    });
  });
}
window.proceedToBeat3 = proceedToBeat3;

function renderWildPitchModal(res, isBatting = false) {
  if (!res?.outcome) return '';
  const o = res.outcome;
  const z1 = res.z1;
  const z2 = res.z2;

  const runsScored = o.runsScored || 0;

  const pCard = z2?.pitcherCardId ? getCard(z2.pitcherCardId) : null;
  const pVal = pCard?.value ?? z2?.pitcherCardVal ?? '—';
  const pPitch = z2?.pitchType ? z2.pitchType.toUpperCase() : 'FASTBALL';

  const bCard = z2?.batterCardId ? getCard(z2.batterCardId) : null;
  const bVal = bCard?.value ?? z2?.batterCardVal ?? '—';
  const bGuess = z2?.guessPitch ? z2.guessPitch.toUpperCase() : 'OFFSPEED';

  const myVal = isBatting ? bVal : pVal;
  const oppVal = isBatting ? pVal : bVal;
  const myRoleTag = isBatting ? '🏏 You (Batter)' : '⚾ You (Pitcher)';
  const oppRoleTag = isBatting ? '⚾ Opponent (Pitcher)' : '🏏 Opponent (Batter)';

  const myActionText = isBatting ? `Looking <b>${bGuess}</b> [Card ${bVal}]` : `<b>${pPitch}</b> [Card ${pVal}] (🔴 Wild Pitch in Dirt)`;
  const oppActionText = isBatting ? `<b>${pPitch}</b> [Card ${pVal}] (🔴 Wild Pitch in Dirt)` : `Looking <b>${bGuess}</b> [Card ${bVal}]`;

  return `
    <div class="result-modal-overlay" id="wild-pitch-modal">
      <div class="result-modal-card outcome">
        <div class="rm-header">
          <span class="rm-tag">PAYOFF PITCH &bull; BALL IN DIRT</span>
          <span class="rm-suspense-label">⚡ WILD PITCH</span>
          <span class="rm-count-tag">Count: 0-2 &rarr; 3-2</span>
        </div>

        <div class="rm-clash-recap">
          <div class="recap-row">
            <span class="recap-label">${myRoleTag}:</span>
            <span class="recap-val">${myActionText}</span>
          </div>
          <div class="recap-row">
            <span class="recap-label">${oppRoleTag}:</span>
            <span class="recap-val">${oppActionText}</span>
          </div>
        </div>

        <div class="rm-rule-explanation">
          <span class="rre-icon">💡</span>
          <div class="rre-text">${o.ruleReason || z2?.ruleReason || '0-2 Count: Pitcher threw an out-of-range delivery in the dirt (Ball). Runners advance on the wild pitch, resetting count to 3-2 Full Count!'}</div>
        </div>

        <div class="rm-outcome-banner hero count-hitter">
          <div class="rm-outcome-title">⚡ WILD PITCH IN THE DIRT!</div>
        </div>

        <div class="rm-impact-row anticipate-impact">
          ${runsScored > 0
            ? `<span class="impact-runs">⚾ ${runsScored} RUN SCORED ON WILD PITCH!</span>`
            : '<span class="impact-noruns">Runners advance 1 base &bull; No outs recorded</span>'}
        </div>

        <button class="btn-primary rm-btn btn-wild-pitch-continue" onclick="proceedFromWildPitch()">
          Continue to 3-2 Payoff Pitch &rarr;
        </button>
      </div>
    </div>`;
}

function proceedFromWildPitch() {
  localPitchType  = null;
  localGuessPitch = null;
  localBeatCard   = null;
  selectedCard    = null;
  const btn = document.querySelector('#wild-pitch-modal .rm-btn') || document.querySelector('.btn-wild-pitch-continue');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Resetting Count to 3-2…';
  }

  gameRef().once('value', snap => {
    const g = snap.val();
    if (!g) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Continue to 3-2 Payoff Pitch &rarr;';
      }
      return;
    }
    const pa = g.currentPA || {};
    const gs = g.gameState || {};
    const half = gs.half || 'top';
    const pitchingRole = half === 'top' ? 'host' : 'guest';
    const battingRole  = half === 'top' ? 'guest' : 'host';

    const b1 = pa.beatResults?.beat1 || {};
    const resetB1 = {
      ...b1,
      count: '3-2',
      winner: 'tie',
      isDominant: false,
      revealCardFirst: null,
      lockedOption: null,
      margin: 0
    };

    const updates = {
      'currentPA/phase': 'placing',
      'currentPA/beat': 'beat2',
      'currentPA/resolution': null,
      'currentPA/committed/host': false,
      'currentPA/committed/guest': false,
      'currentPA/firstRevealedCard': null,
      'currentPA/beatResults/beat1': resetB1,
      'currentPA/beatPlacements/beat2': { host: {}, guest: {} },
      [`currentPA/placement/${pitchingRole}/z2`]: [],
      [`currentPA/placement/${battingRole}/z2`]: [],
    };

    // Discard the played beat2 cards so hands remain in sync
    ['host', 'guest'].forEach(r => {
      const playedCardId = pa.beatPlacements?.beat2?.[r]?.cardId;
      if (playedCardId && gs.hands?.[r]) {
        const hand = [...gs.hands[r]];
        const idx = hand.indexOf(playedCardId);
        if (idx > -1) {
          hand.splice(idx, 1);
          updates[`gameState/hands/${r}`] = hand;
        }
      }
    });

    gameRef().update(updates).catch(err => {
      console.error('proceedFromWildPitch error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Continue to 3-2 Payoff Pitch &rarr;';
      }
    });
  });
}
window.proceedFromWildPitch = proceedFromWildPitch;

function renderOutcomeOverlay(res, isBatting = false) {
  if (!res?.outcome) return '';
  const o = res.outcome;
  const z1 = res.z1;
  const z2 = res.z3 || res.z2;
  const isBeat3 = Boolean(res.z3);

  const runsScored = o.runsScored || 0;
  const outsAdded = o.outsAdded || 0;

  // Pitcher recap
  const pCard = z2?.pitcherCardId ? getCard(z2.pitcherCardId) : (z1?.pitcherCards?.[0] ? getCard(z1.pitcherCards[0]) : null);
  const pVal = pCard?.value ?? z2?.pitcherCardVal ?? z1?.pitcherTotal ?? '—';
  const pPitch = z2?.pitchType ? z2.pitchType.toUpperCase() : 'FASTBALL';
  const pBonus = z2?.pitcherBaseBonus ?? 0;
  const pEff = z2?.pitcherEffectiveVal ?? pVal;

  // Batter recap
  const bCard = z2?.batterCardId ? getCard(z2.batterCardId) : (z1?.batterCards?.[0] ? getCard(z1.batterCards[0]) : null);
  const bVal = bCard?.value ?? z2?.batterCardVal ?? z1?.batterTotal ?? '—';
  const bGuess = z2?.guessPitch ? z2.guessPitch.toUpperCase() : 'FASTBALL';
  const bBonus = z2?.batterBaseBonus ?? 0;
  const bEff = z2?.batterEffectiveVal ?? bVal;

  const pitchMatched = Boolean(z2?.pitchMatched ?? (z2?.matchTier === 'matched'));
  const launchAngle = z2?.launchAngle ?? z2?.total ?? ((typeof pEff === 'number' && typeof bEff === 'number') ? (pEff + (pitchMatched ? bEff : bVal)) : (typeof pVal === 'number' && typeof bVal === 'number' ? (pVal + bVal) : 11));

  const target = z2?.target || z1?.effectiveTarget || 4;
  let targetWindowBadgeHtml = '';
  if (pVal < target) {
    targetWindowBadgeHtml = `<span class="timing-badge miss">⚾ BALL IN DIRT &bull; Pitcher [${pVal}] &lt; Target [${target}]</span>`;
  } else if (bVal > pVal) {
    targetWindowBadgeHtml = `<span class="timing-badge miss">⚡ STRIKEOUT &bull; Batter [${bVal}] &gt; Pitcher [${pVal}]</span>`;
  } else if (bVal < target) {
    targetWindowBadgeHtml = `<span class="timing-badge weak">⚾ WEAK OUT &bull; Batter [${bVal}] &lt; Target [${target}]</span>`;
  } else if (bVal === pVal) {
    targetWindowBadgeHtml = `<span class="timing-badge squared">💥 EXACT COLLISION &bull; Batter [${bVal}] == Pitcher [${pVal}]</span>`;
  } else {
    targetWindowBadgeHtml = `<span class="timing-badge solid">🏏 IN THE WINDOW &bull; Target [${target}] &le; Batter [${bVal}] &lt; Pitcher [${pVal}]</span>`;
  }

  let deductionBadgeHtml = '';
  if (pitchMatched) {
    deductionBadgeHtml = `<span class="deduction-badge full">🎯 PITCH ANTICIPATED (${pPitch} &bull; 3-1 Count Advantage)</span>`;
  } else {
    deductionBadgeHtml = `<span class="deduction-badge whiff">❌ FOOLED ON PITCH (Threw ${pPitch}, Anticipated ${bGuess})</span>`;
  }

  // 3-Step Breakdown Details
  const step1ReadHtml = pitchMatched
    ? `<span class="rb-step-val success">🎯 ANTICIPATED (${pPitch}) &rarr; Effective Target: ${target}</span>`
    : `<span class="rb-step-val fail">❌ FOOLED (${pPitch} vs Looking ${bGuess}) &rarr; Base Target: ${target}</span>`;

  const myVal = isBatting ? bVal : pVal;
  const oppVal = isBatting ? pVal : bVal;
  const myRoleTag = isBatting ? '🏏 You (Batter)' : '⚾ You (Pitcher)';
  const oppRoleTag = isBatting ? '⚾ Opponent (Pitcher)' : '🏏 Opponent (Batter)';

  const myActionText = isBatting
    ? `Looking <b>${bGuess}</b> [Card ${bVal}]`
    : `<b>${pPitch}</b> [Card ${pVal}]`;
  const oppActionText = isBatting
    ? `<b>${pPitch}</b> [Card ${pVal}]`
    : `Looking <b>${bGuess}</b> [Card ${bVal}]`;

  const step2ExecHtml = `<span class="rb-step-val">Pitcher [Card ${pVal}] (Target ${target}) vs Batter [Card ${bVal}]</span>`;

  const ruleReason = z2?.ruleReason || o.ruleReason || `Target Window resolution for Pitcher [${pVal}] vs Batter [${bVal}].`;

  const headline = o.display || 'At-Bat Complete';
  const runsText = runsScored > 0 ? `⚾ ${runsScored} RUN${runsScored > 1 ? 'S' : ''} SCORED!` : 'No runs scored';
  const outsText = outsAdded > 0 ? `+${outsAdded} Out${outsAdded > 1 ? 's' : ''}` : 'No outs recorded';
  const impactSummary = `${runsText} &bull; ${outsText}`;

  const duelSummary = `Pitcher: <b>${pPitch}</b> [Card ${pVal}] vs Batter: Looking <b>${bGuess}</b> [Card ${bVal}] &bull; Target: <b>${target}</b>`;

  return `
    <div class="result-modal-overlay" id="outcome-overlay">
      <div class="result-modal-card outcome clean-outcome-card">
        <div class="rm-header">
          <span class="rm-tag">AT-BAT OUTCOME</span>
          <span class="rm-suspense-label">⚡ RESULT</span>
          <span class="rm-count-tag">${z1?.count ? `Count: ${z1.count}` : ''}</span>
        </div>

        <div class="rm-outcome-banner hero anticipate-outcome">
          <div class="rm-outcome-title">${headline}</div>
          <div class="rm-impact-row anticipate-impact">
            <span class="impact-summary-text">${impactSummary}</span>
          </div>
        </div>

        <div class="rm-clean-duel-row">
          ${duelSummary}
        </div>

        <!-- Hidden elements for test-suite backwards-compatibility -->
        <div class="rm-resolution-breakdown" style="display:none;"></div>
        <div class="rm-rule-explanation" style="display:none;"></div>
        <div class="rm-matrix-guide" style="display:none;"></div>

        <button class="btn-primary rm-btn btn-next-batter anticipate-next-btn" onclick="nextPA()">
          Next Batter &rarr;
        </button>
      </div>
    </div>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// GAME OVER
// ─────────────────────────────────────────────────────────────────────────────
function renderGameOver(g) {
  const gs = g.gameState;
  const topScore = gs.score.top;
  const botScore = gs.score.bottom;
  const hostWins = botScore > topScore;
  const guestWins = topScore > botScore;
  const iWin = (myRole === 'host' && hostWins) || (myRole === 'guest' && guestWins);
  const tied  = topScore === botScore;

  document.getElementById('app').innerHTML = `
    <div class="phase-screen gameover">
      <div class="logo-small">⚾ FULL COUNT</div>
      <h1>${tied ? 'TIED GAME' : iWin ? '🏆 YOU WIN!' : '😔 You Lose'}</h1>
      <div class="final-score">
        <div class="score-col">
          <div class="team-label">Visitors</div>
          <div class="final-score-num">${topScore}</div>
        </div>
        <div class="score-dash">—</div>
        <div class="score-col">
          <div class="team-label">Home</div>
          <div class="final-score-num">${botScore}</div>
        </div>
      </div>
      <div class="final-innings">Final: ${gs.inning - 1} innings</div>
      <button class="btn-primary" onclick="window.location.href='index.html'">Play Again</button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function opponentRole() { return myRole === 'host' ? 'guest' : 'host'; }

function renderPhaseLoading(msg) {
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<div class="phase-screen"><div class="logo-small">⚾</div><p>${msg}</p></div>`;
}

function showError(msg) {
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<div class="phase-screen error"><h2>⚠️ Error</h2><p>${msg}</p><a href="index.html">← Back to Lobby</a></div>`;
}

// Watch for both committed → trigger resolve (both clients listen, host acts)
function watchForBothCommitted() {
  gameRef('currentPA/committed').on('value', snap => {
    const committed = snap.val();
    if (committed?.host && committed?.guest && myRole === 'host') {
      gameRef('currentPA').once('value', paSnap => {
        const pa = paSnap.val();
        if (!pa || pa.phase === 'resolved' || pa.phase === 'beat1_result' || pa.phase === 'battle_back_result' || pa.phase === 'wild_pitch_result' || window._resolvingBeat) return;
        const currentBeat = pa.beat || 'beat1';
        window._resolvingBeat = true;
        setTimeout(() => {
          resolveBeatStep(currentBeat);
          window._resolvingBeat = false;
        }, 300);
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window._isDevPreview) return;
  const params = new URLSearchParams(window.location.search);
  gameId = params.get('id');
  myRole = params.get('role');
  myUid  = params.get('uid');

  if (!gameId || !myRole || !myUid) {
    window.location.href = 'index.html';
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch(e) {
    if (e.code !== 'app/duplicate-app') {
      showError('Firebase not configured. See README.md.');
      return;
    }
    db = firebase.database();
  }

  renderPhaseLoading('Connecting…');

  gameListener = db.ref(`fullcount_games/${gameId}`);
  gameListener.on('value', snap => {
    try {
      const g = snap.val();
      if (!g) { showError(`Game "${gameId}" not found. Double-check room code.`); return; }
      window._lastGameState = g;
      handleGameState(g);
    } catch(err) {
      console.error('Error handling game state:', err);
      showError('Error loading game: ' + err.message);
    }
  }, err => {
    console.error('Firebase on value error:', err);
    showError('Firebase error: ' + err.message);
  });

  watchForBothCommitted();
});
