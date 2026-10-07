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
let myRole;      // 'host' | 'guest'
let myUid;       // Simple UID

// Local placement (not pushed until committed)
let localPlacement   = { z1:[], z2:[] };
let localHand        = [];  // card IDs currently in hand
let selectedCard     = null; // currently selected card ID from hand
let localPitchChoice = null; // legacy alias
let localGuessChoice = null; // legacy alias
let localBeatCard    = null; // cardId placed in active beat (at most 1)
let localPitchType     = 'fastball';  // 'fastball' | 'breaking' | 'offspeed'
let localGuessPitch    = 'fastball';  // 'fastball' | 'breaking' | 'offspeed'
let localSwingType     = 'balanced';  // 'contact' | 'balanced' | 'power'
let gameListener     = null; // Firebase listener ref

const TOTAL_INNINGS = 3;
const MAX_HAND      = 6;
const ZONE_LIMIT    = 2;  // max cards per zone
const PA_CARD_LIMIT = 4;  // max cards per PA (BC09 The Captain: 5)

// Note: PITCH_RANGES and SWING_RANGES are defined in js/resolution.js


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
  if (g && localBeatCard && g.currentPA?.beat === 'beat2') {
    const card = getCard(localBeatCard);
    const cardVal = card ? (card.value || 0) : 0;
    const gs = g.gameState || {};
    const half = gs.half || 'top';
    const pitchingRole = half === 'top' ? 'host' : 'guest';
    const iAmPitching = (myRole === pitchingRole);
    const b1Data = g.currentPA?.beatResults?.beat1 || {};
    const isOffspeedLocked = (b1Data?.count === '3-1') || (b1Data?.lockedOption === 'offspeed');

    if (iAmPitching) {
      const pR = PITCH_RANGES[localPitchType] || { min: 1, max: 10 };
      if (cardVal < pR.min || cardVal > pR.max) {
        if (cardVal <= 2 && !isOffspeedLocked) localPitchType = 'offspeed';
        else if (cardVal >= 8) localPitchType = 'fastball';
        else if (cardVal >= 6) localPitchType = 'fastball';
        else localPitchType = 'breaking';
      }
    }
  }

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

// ── DRAG AND DROP & SELECTION STATE ──────────────────────────────────────────
let draggedCardId = null;

function handleCardDragStart(e, cardId) {
  draggedCardId = cardId;
  selectedCard = cardId;
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  }
  const el = e.currentTarget;
  if (el) el.classList.add('is-dragging');
}
window.handleCardDragStart = handleCardDragStart;

function handleCardDragEnd(e) {
  draggedCardId = null;
  const el = e.currentTarget;
  if (el) el.classList.remove('is-dragging');
  document.querySelectorAll('.tray-drop-target, .pitch-tray, .b1-card-slot').forEach(t => {
    t.classList.remove('drag-over');
  });
}
window.handleCardDragEnd = handleCardDragEnd;

function handleTrayDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}
window.handleTrayDragOver = handleTrayDragOver;

function handleTrayDragEnter(e) {
  e.preventDefault();
  const el = e.currentTarget;
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
  const el = e.currentTarget;
  if (el) el.classList.remove('drag-over');
  if (el && (el.classList.contains('locked') || el.classList.contains('disabled'))) return;

  const cardId = draggedCardId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null) || selectedCard;
  if (!cardId) return;

  const g = window._lastGameState;
  const currentBeat = g?.currentPA?.beat || 'beat1';
  const half = g?.gameState?.half || 'top';
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const iAmPitching = (myRole === pitchingRole);

  if (currentBeat === 'beat2' && pitchType) {
    if (iAmPitching) {
      localPitchType = pitchType;
    } else {
      localGuessPitch = pitchType;
    }
  }

  localBeatCard = cardId;
  selectedCard = null;
  draggedCardId = null;

  if (g) renderPlay(g);
}
window.handleTrayDrop = handleTrayDrop;

function handleTrayClick(pitchType, zoneType) {
  const g = window._lastGameState;
  const currentBeat = g?.currentPA?.beat || 'beat1';
  const half = g?.gameState?.half || 'top';
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const iAmPitching = (myRole === pitchingRole);

  if (currentBeat === 'beat2' && pitchType) {
    if (iAmPitching) {
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
      return 'Slugger: Enormous raw power. Barreled Delta 0 contacts on high cards (7+) produce Home Runs. Warning track power on Delta 2.';
    case 'contact':
    case 'contact hitter':
      return 'Contact Hitter: Elite bat control. Avoids strikeouts on fooled pitches and beats out infield singles on off-balance swings (Delta 3–4).';
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
      beat2: { host:{}, guest:{} }
    },
    beatResults:       { beat1:null, beat2:null },
    placement: {
      host:  { z1:[], z2:[] },
      guest: { z1:[], z2:[] },
    },
    resolution:        null,
    isFirstPAOfInning: true,
  };

  gameRef().update({ phase:'play', gameState: initialState, currentPA: paState });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GAME RENDER
// ─────────────────────────────────────────────────────────────────────────────
function renderPlay(g) {
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

  // Initialize arsenalCharges if missing
  if (!gs.arsenalCharges) {
    const hostP = getPitcher(gs.activePitcher?.host || g.rosters?.host?.startingPitcher);
    const guestP = getPitcher(gs.activePitcher?.guest || g.rosters?.guest?.startingPitcher);
    gs.arsenalCharges = {
      host:  { ...(hostP?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) },
      guest: { ...(guestP?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) }
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

  // Opponent chips (Top bar exclusively)
  let oppScoutChips = '';
  if (iAmBatting) {
    // Opponent is Pitcher
    oppScoutChips = `
      <div class="opp-scout-chips">
        <span class="scout-chip ${pCharges?.fastball > 0 ? '' : 'exhausted'}"
              onclick="handleTooltipClick(event, 'Pitch Repertoire: Fastball', 'Execution window: [6–10 Heat]. High velocity pitch. Remaining: ${pCharges?.fastball ?? 0}')"
              ontouchstart="handleTooltipTouchStart(event, 'Pitch Repertoire: Fastball', 'Execution window: [6–10 Heat]. High velocity pitch. Remaining: ${pCharges?.fastball ?? 0}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Fastball (6-10)">FB <b>${pCharges?.fastball ?? 0}</b> <small>[6–10]</small></span>
        <span class="scout-chip ${pCharges?.breaking > 0 ? '' : 'exhausted'}"
              onclick="handleTooltipClick(event, 'Pitch Repertoire: Breaking', 'Execution window: [3–7 Bite]. Sharp breaking pitch. Remaining: ${pCharges?.breaking ?? 0}')"
              ontouchstart="handleTooltipTouchStart(event, 'Pitch Repertoire: Breaking', 'Execution window: [3–7 Bite]. Sharp breaking pitch. Remaining: ${pCharges?.breaking ?? 0}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Breaking (3-7)">BR <b>${pCharges?.breaking ?? 0}</b> <small>[3–7]</small></span>
        <span class="scout-chip ${pCharges?.offspeed > 0 ? '' : 'exhausted'}"
              onclick="handleTooltipClick(event, 'Pitch Repertoire: Offspeed', 'Execution window: [1–5 Touch]. Offspeed changeup. (Locked on 3-1 count). Remaining: ${pCharges?.offspeed ?? 0}')"
              ontouchstart="handleTooltipTouchStart(event, 'Pitch Repertoire: Offspeed', 'Execution window: [1–5 Touch]. Offspeed changeup. (Locked on 3-1 count). Remaining: ${pCharges?.offspeed ?? 0}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Offspeed (1-5)">OFF <b>${pCharges?.offspeed ?? 0}</b> <small>[1–5]</small></span>
      </div>`;
  } else {
    // Opponent is Batter
    oppScoutChips = `
      <div class="opp-scout-chips">
        <span class="scout-chip hot"
              onclick="handleTooltipClick(event, 'Hitter Archetype: ${oppChar?.archetype || 'Hitter'}', '${getArchetypeTooltip(oppChar?.archetype)}')"
              ontouchstart="handleTooltipTouchStart(event, 'Hitter Archetype: ${oppChar?.archetype || 'Hitter'}', '${getArchetypeTooltip(oppChar?.archetype)}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Archetype">STYLE: <b>${oppChar?.archetype || 'Hitter'}</b></span>
        <span class="scout-chip fav"
              onclick="handleTooltipClick(event, 'Favorite Pitch: ${(oppChar?.scoutingReport?.favoritePitch || bScout?.favoritePitch || 'fastball').toUpperCase()}', 'When anticipating their favorite pitch, barreled timing produces extra bases (HR/2B)!')"
              ontouchstart="handleTooltipTouchStart(event, 'Favorite Pitch: ${(oppChar?.scoutingReport?.favoritePitch || bScout?.favoritePitch || 'fastball').toUpperCase()}', 'When anticipating their favorite pitch, barreled timing produces extra bases (HR/2B)!')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Favorite Pitch">⭐ HUNTS: <b>${(oppChar?.scoutingReport?.favoritePitch || bScout?.favoritePitch || 'fastball').toUpperCase()}</b></span>
      </div>`;
  }

  // User chips (Bottom dock exclusively)
  let myScoutChips = '';
  if (iAmPitching) {
    // User is Pitcher
    myScoutChips = `
      <div class="my-scout-chips">
        <span class="scout-chip ${pCharges?.fastball > 0 ? '' : 'exhausted'}"
              onclick="handleTooltipClick(event, 'Pitch Repertoire: Fastball', 'Your fastball window is [6–10 Heat]. Remaining charges: ${pCharges?.fastball ?? 0}')"
              ontouchstart="handleTooltipTouchStart(event, 'Pitch Repertoire: Fastball', 'Your fastball window is [6–10 Heat]. Remaining charges: ${pCharges?.fastball ?? 0}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Fastball (6-10)">FB <b>${pCharges?.fastball ?? 0}</b> <small>[6–10]</small></span>
        <span class="scout-chip ${pCharges?.breaking > 0 ? '' : 'exhausted'}"
              onclick="handleTooltipClick(event, 'Pitch Repertoire: Breaking', 'Your breaking window is [3–7 Bite]. Remaining charges: ${pCharges?.breaking ?? 0}')"
              ontouchstart="handleTooltipTouchStart(event, 'Pitch Repertoire: Breaking', 'Your breaking window is [3–7 Bite]. Remaining charges: ${pCharges?.breaking ?? 0}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Breaking (3-7)">BR <b>${pCharges?.breaking ?? 0}</b> <small>[3–7]</small></span>
        <span class="scout-chip ${pCharges?.offspeed > 0 ? '' : 'exhausted'}"
              onclick="handleTooltipClick(event, 'Pitch Repertoire: Offspeed', 'Your offspeed window is [1–5 Touch]. Locked on 3-1 count! Remaining: ${pCharges?.offspeed ?? 0}')"
              ontouchstart="handleTooltipTouchStart(event, 'Pitch Repertoire: Offspeed', 'Your offspeed window is [1–5 Touch]. Locked on 3-1 count! Remaining: ${pCharges?.offspeed ?? 0}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Offspeed (1-5)">OFF <b>${pCharges?.offspeed ?? 0}</b> <small>[1–5]</small></span>
      </div>`;
  } else {
    // User is Batter
    myScoutChips = `
      <div class="my-scout-chips">
        <span class="scout-chip hot"
              onclick="handleTooltipClick(event, 'Your Archetype: ${myChar?.archetype || 'Hitter'}', '${getArchetypeTooltip(myChar?.archetype)}')"
              ontouchstart="handleTooltipTouchStart(event, 'Your Archetype: ${myChar?.archetype || 'Hitter'}', '${getArchetypeTooltip(myChar?.archetype)}')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Archetype">STYLE: <b>${myChar?.archetype || 'Hitter'}</b></span>
        <span class="scout-chip fav"
              onclick="handleTooltipClick(event, 'Favorite Pitch: ${(myChar?.scoutingReport?.favoritePitch || 'fastball').toUpperCase()}', 'You hunt this pitch! Barreled timing produces towering extra bases!')"
              ontouchstart="handleTooltipTouchStart(event, 'Favorite Pitch: ${(myChar?.scoutingReport?.favoritePitch || 'fastball').toUpperCase()}', 'You hunt this pitch! Barreled timing produces towering extra bases!')"
              ontouchend="handleTooltipTouchEnd(event)"
              title="Favorite Pitch">⭐ HUNTS: <b>${(myChar?.scoutingReport?.favoritePitch || 'fastball').toUpperCase()}</b></span>
      </div>`;
  }

  // Lock In Button Configuration based on Active Beat
  let lockBtnLabel = 'LOCK IN';
  let lockBtnSub = '';
  let lockBtnDisabled = false;

  if (currentBeat === 'beat1') {
    if (!localBeatCard) {
      lockBtnLabel = 'CHOOSE CARD';
      lockBtnSub = 'Pick 1 from hand';
      lockBtnDisabled = true;
    } else {
      const cardObj = getCard(localBeatCard);
      lockBtnLabel = 'LOCK IN COUNT';
      lockBtnSub = `Card [${cardObj?.value ?? 0}]`;
      lockBtnDisabled = false;
    }
  } else if (currentBeat === 'beat2') {
    const b1 = pa?.beatResults?.beat1;
    const cardObj = localBeatCard ? getCard(localBeatCard) : null;
    const cardVal = cardObj ? (cardObj.value || 0) : 0;

    if (iAmPitching) {
      const pRange = PITCH_RANGES[localPitchType] || { min: 1, max: 10 };
      const inRange = localBeatCard ? (cardVal >= pRange.min && cardVal <= pRange.max) : false;

      if (!localBeatCard) {
        lockBtnLabel = 'CHOOSE CARD';
        lockBtnSub = `${localPitchType.toUpperCase()} &bull; Timing Range [${pRange.min}–${pRange.max}]`;
        lockBtnDisabled = true;
      } else {
        lockBtnLabel = 'LOCK IN PITCH';
        lockBtnSub = `${localPitchType.toUpperCase()} &bull; Card [${cardVal}] ${inRange ? '✓ In Timing Range' : '⚠ Out of Range'}`;
        lockBtnDisabled = false;
      }
    } else {
      const bRange = PITCH_RANGES[localGuessPitch] || { min: 1, max: 10 };
      const inRange = localBeatCard ? (cardVal >= bRange.min && cardVal <= bRange.max) : false;

      if (!localBeatCard) {
        lockBtnLabel = 'CHOOSE CARD';
        lockBtnSub = `LOOKING ${localGuessPitch.toUpperCase()} &bull; Timing Range [${bRange.min}–${bRange.max}]`;
        lockBtnDisabled = true;
      } else {
        lockBtnLabel = 'LOCK IN SWING';
        lockBtnSub = `LOOKING ${localGuessPitch.toUpperCase()} &bull; Card [${cardVal}] ${inRange ? '✓ In Timing Range' : '⚠ Out of Range'}`;
        lockBtnDisabled = false;
      }
    }
  }

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      <!-- TOP HUD: OPPONENT INFORMATION ONLY -->
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
          ${oppScoutChips}
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

      <!-- BOTTOM PLAYER DOCK: USER INFORMATION ONLY -->
      <footer class="player-dock">
        <div class="player-bar">
          <div class="player-profile">
            <div class="my-avatar">${iAmBatting ? '🏏' : '⚾'}</div>
            <div class="my-details">
              <span class="my-role-badge ${iAmBatting ? 'batting' : 'pitching'}">${iAmBatting ? 'YOU ARE BATTING' : 'YOU ARE PITCHING'}</span>
              <span class="my-char-name">${myChar?.name || ''}</span>
            </div>
          </div>
          ${myScoutChips}
          <div class="dock-controls-row">
            <span class="placed-indicator">Beat <b>${currentBeat === 'beat1' ? '1' : '2'}</b> &bull; Card: <b>${localBeatCard ? '1' : '0'}</b>/1</span>
            ${canSub ? `<button class="btn-relief" onclick="substitutePitcher('${reliefId}')">Relief</button>` : ''}
          </div>
        </div>

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

      <!-- BEAT 1 RESULT MODAL POP-UP (WHEN IN BEAT 1 RESULT PHASE) -->
      ${pa.phase === 'beat1_result' ? renderBeat1ResultModal(pa.beatResults?.beat1, pitchingRole === myRole) : ''}

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

  // Opponent chips (Top bar exclusively)
  let oppScoutChips = '';
  if (iAmBatting) {
    oppScoutChips = `
      <div class="opp-scout-chips">
        <span class="scout-chip ${pCharges?.fastball > 0 ? '' : 'exhausted'}" title="Fastball (6-10)">FB <b>${pCharges?.fastball ?? 0}</b> <small>[6–10]</small></span>
        <span class="scout-chip ${pCharges?.breaking > 0 ? '' : 'exhausted'}" title="Breaking (3-7)">BR <b>${pCharges?.breaking ?? 0}</b> <small>[3–7]</small></span>
        <span class="scout-chip ${pCharges?.offspeed > 0 ? '' : 'exhausted'}" title="Offspeed (1-5)">OFF <b>${pCharges?.offspeed ?? 0}</b> <small>[1–5]</small></span>
      </div>`;
  } else {
    oppScoutChips = `
      <div class="opp-scout-chips">
        <span class="scout-chip hot" title="Archetype">STYLE: <b>${oppChar?.archetype || 'Hitter'}</b></span>
        <span class="scout-chip fav" title="Favorite Pitch">⭐ HUNTS: <b>${(oppChar?.scoutingReport?.favoritePitch || bScout?.favoritePitch || 'fastball').toUpperCase()}</b></span>
      </div>`;
  }

  // User chips (Bottom dock exclusively)
  let myScoutChips = '';
  if (!iAmBatting) {
    myScoutChips = `
      <div class="my-scout-chips">
        <span class="scout-chip ${pCharges?.fastball > 0 ? '' : 'exhausted'}" title="Fastball (6-10)">FB <b>${pCharges?.fastball ?? 0}</b> <small>[6–10]</small></span>
        <span class="scout-chip ${pCharges?.breaking > 0 ? '' : 'exhausted'}" title="Breaking (3-7)">BR <b>${pCharges?.breaking ?? 0}</b> <small>[3–7]</small></span>
        <span class="scout-chip ${pCharges?.offspeed > 0 ? '' : 'exhausted'}" title="Offspeed (1-5)">OFF <b>${pCharges?.offspeed ?? 0}</b> <small>[1–5]</small></span>
      </div>`;
  } else {
    myScoutChips = `
      <div class="my-scout-chips">
        <span class="scout-chip hot" title="Archetype">STYLE: <b>${myChar?.archetype || 'Hitter'}</b></span>
        <span class="scout-chip fav" title="Favorite Pitch">⭐ HUNTS: <b>${(myChar?.scoutingReport?.favoritePitch || 'fastball').toUpperCase()}</b></span>
      </div>`;
  }

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      <!-- TOP HUD -->
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
          ${oppScoutChips}
          <div class="opp-status-pill ready">REVEAL</div>
        </div>
      </header>

      <!-- CENTER BATTLEFIELD -->
      <main class="battlefield">
        ${renderZoneBoard(pa, battingRole === myRole, true, 'reveal', res, pitcherChar, batterChar, gs)}
      </main>

      <!-- BOTTOM PLAYER DOCK -->
      <footer class="player-dock">
        <div class="player-bar">
          <div class="player-profile" onclick="toggleMatchupModal(true)">
            <div class="my-avatar">${battingRole === myRole ? '🏏' : '⚾'}</div>
            <div class="my-details">
              <span class="my-role-badge ${battingRole === myRole ? 'batting' : 'pitching'}">${battingRole === myRole ? 'YOU ARE BATTING' : 'YOU ARE PITCHING'}</span>
              <span class="my-char-name">${myChar?.name || ''}</span>
            </div>
          </div>
          ${myScoutChips}
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
// PUBLIC SCOUTING & INTEL STRIP
// ─────────────────────────────────────────────────────────────────────────────
function renderPublicScoutingBar(pitcherChar, batterChar, charges, count = '0-0') {
  const pDiffs = pitcherChar?.executionDifficulties || { fastball: 3, breaking: 5, offspeed: 8 };
  const bScout = batterChar?.scoutingReport || { hotZone: 'high', coldZone: 'low', favoritePitch: 'fastball' };

  const pName = pitcherChar?.name || 'Pitcher';
  const bName = batterChar?.name || 'Batter';

  const countBadgeClass = count === '0-2' ? 'count-pitcher' : count === '3-1' ? 'count-hitter' : count === '3-2' ? 'count-full' : 'count-duel';
  const countLabel = count === '0-2' ? "Pitcher's Count" : count === '3-1' ? "Hitter's Count" : count === '3-2' ? "Full Count" : "Duel";

  return `
    <div class="scouting-report-bar">
      <!-- Pitcher Repertoire Strip -->
      <div class="scout-card pitcher-card">
        <div class="scout-header">
          <span class="scout-avatar">⚾</span>
          <span class="scout-name">${pName}</span>
        </div>
        <div class="scout-chips">
          <span class="scout-chip ${charges?.fastball > 0 ? '' : 'exhausted'}" title="Fastball: Velocity (6-10)">
            FB <b>${charges?.fastball ?? 0}</b> <small>[6–10]</small>
          </span>
          <span class="scout-chip ${charges?.breaking > 0 ? '' : 'exhausted'}" title="Breaking: Bite & Spin (3-7)">
            BR <b>${charges?.breaking ?? 0}</b> <small>[3–7]</small>
          </span>
          <span class="scout-chip ${charges?.offspeed > 0 ? '' : 'exhausted'}" title="Offspeed: Touch & Deception (1-5)">
            OFF <b>${charges?.offspeed ?? 0}</b> <small>[1–5]</small>
          </span>
        </div>
      </div>

      <!-- Center Count Badge -->
      <div class="scout-count-badge ${countBadgeClass}" title="Established Count">
        <span class="count-num">${count}</span>
        <span class="count-tag">${countLabel}</span>
      </div>

      <!-- Batter Tendencies Strip -->
      <div class="scout-card batter-card">
        <div class="scout-header">
          <span class="scout-avatar">🏏</span>
          <span class="scout-name">${bName}</span>
        </div>
        <div class="scout-chips">
          <span class="scout-chip hot" title="Hitter Archetype">
            STYLE: <b>${batterChar?.archetype || 'Hitter'}</b>
          </span>
          <span class="scout-chip fav" title="Favorite Pitch">
            ⭐ HUNTS: <b>${bScout.favoritePitch.toUpperCase()}</b>
          </span>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER PAYOFF DECK (BEAT 2)
// ─────────────────────────────────────────────────────────────────────────────
function renderPitcherPayoffDeck(charges, localPitchType, bScout, pDiffs, count, cardObj, b1Data) {
  const isOffspeedLocked = (count === '3-1') || (b1Data?.lockedOption === 'offspeed');
  if (isOffspeedLocked && localPitchType === 'offspeed') {
    localPitchType = 'fastball';
  }

  const pitches = [
    { key: 'fastball', name: 'Fastball', icon: '🔥', range: '6–10 Heat', min: 6, max: 10 },
    { key: 'breaking', name: 'Breaking', icon: '🌀', range: '3–7 Bite',   min: 3, max: 7 },
    { key: 'offspeed', name: 'Offspeed', icon: '⏱️', range: '1–5 Touch',  min: 1, max: 5, locked: isOffspeedLocked },
  ];

  const curRange = PITCH_RANGES[localPitchType] || { min: 1, max: 10, label: '1–10' };
  const cardVal = cardObj ? (cardObj.value || 0) : null;
  const inRange = cardVal !== null ? (cardVal >= curRange.min && cardVal <= curRange.max) : null;

  return `
    <div class="payoff-controls-deck">
      <!-- 1. Pitch Selection -->
      <div class="control-section">
        <div class="control-label">1. Choose Pitch:</div>
        <div class="selection-tiles">
          ${pitches.map(p => {
            const countLeft = charges[p.key] ?? 0;
            const isSelected = (localPitchType === p.key);
            const isLocked = Boolean(p.locked);
            const isDisabled = countLeft <= 0 || isLocked;
            return `
              <button class="choice-tile ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''}"
                      onclick="${isLocked ? '' : `selectPitchType('${p.key}')`}" ${isDisabled ? 'disabled' : ''}>
                <div class="ct-header">
                  <span class="ct-icon">${isLocked ? '🔒' : p.icon}</span>
                  <span class="ct-count">${isLocked ? 'LOCKED' : `${countLeft} left`}</span>
                </div>
                <div class="ct-name">${p.name}</div>
                <div class="ct-diff">${isLocked ? '3-1 Count Lockout' : `<span class="range-pill">${p.range}</span>`}</div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 2. Range & Execution Feedback -->
      <div class="exec-quick-bar ${inRange === null ? 'waiting' : (inRange ? 'pass' : 'fail')}">
        <span class="eq-label">${localPitchType.toUpperCase()}: Range <b>${curRange.label}</b></span>
        <span class="eq-status">${cardVal === null ? 'Pick a card below' : (inRange ? `🟢 IN RANGE [Card ${cardVal}]` : `⚠️ OUT OF RANGE [Card ${cardVal}]`)}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTER PAYOFF DECK (BEAT 2)
// ─────────────────────────────────────────────────────────────────────────────
function renderBatterPayoffDeck(localGuessPitch, bScout, count, cardObj, b1Data) {
  const isOffspeedLocked = (count === '3-1') || (b1Data?.lockedOption === 'offspeed');
  if (isOffspeedLocked && localGuessPitch === 'offspeed') {
    localGuessPitch = 'fastball';
  }

  const pitches = [
    { key: 'fastball', name: 'Fastball', icon: '🔥', range: '6–10 Heat', min: 6, max: 10 },
    { key: 'breaking', name: 'Breaking', icon: '🌀', range: '3–7 Bite',   min: 3, max: 7 },
    { key: 'offspeed', name: 'Offspeed', icon: '⏱️', range: '1–5 Touch',  min: 1, max: 5, locked: isOffspeedLocked },
  ];

  const curRange = PITCH_RANGES[localGuessPitch] || { min: 1, max: 10, label: '1–10' };
  const cardVal = cardObj ? (cardObj.value || 0) : null;
  const inRange = cardVal !== null ? (cardVal >= curRange.min && cardVal <= curRange.max) : null;

  return `
    <div class="payoff-controls-deck">
      <!-- 1. Anticipated Pitch Type -->
      <div class="control-section">
        <div class="control-label">1. Anticipate Pitch:</div>
        <div class="selection-tiles">
          ${pitches.map(p => {
            const isSelected = (localGuessPitch === p.key);
            const isLocked = Boolean(p.locked);
            return `
              <button class="choice-tile ${isSelected ? 'active' : ''} ${isLocked ? 'locked disabled' : ''}"
                      onclick="${isLocked ? '' : `selectGuessPitch('${p.key}')`}" ${isLocked ? 'disabled' : ''}>
                <div class="ct-header">
                  <span class="ct-icon">${isLocked ? '🔒' : p.icon}</span>
                  <span class="ct-diff">${isLocked ? 'LOCKED' : (p.key === bScout.favoritePitch ? '⭐ FAV' : '')}</span>
                </div>
                <div class="ct-name">${p.name}</div>
                <div class="ct-diff">${isLocked ? '3-1 Count Lockout' : `<span class="range-pill">${p.range}</span>`}</div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 2. Timing & Range Feedback -->
      <div class="exec-quick-bar ${inRange === null ? 'waiting' : (inRange ? 'pass' : 'fail')}">
        <span class="eq-label">Looking <b>${localGuessPitch.toUpperCase()}</b>: Target Timing <b>${curRange.label}</b></span>
        <span class="eq-status">${cardVal === null ? 'Pick a card below' : (inRange ? `🟢 IN RANGE [Card ${cardVal}]` : `⚠️ OUT OF RANGE [Card ${cardVal}]`)}</span>
      </div>
    </div>`;
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
      descText = 'Pitcher holds count leverage: Put-away punchouts active on fooled swings (Delta 3–4). Batter power is suppressed (Delta 0 capped at Double).';
    } else {
      badgeText = '⚠️ 0-2 TWO-STRIKE COUNT &bull; PLATE PROTECTION DEFICIT';
      descText = 'Defensive count: Fooled swings trigger strikeouts. Power is capped at a Double even on a perfect Delta 0 barrel.';
    }
  } else if (count === '3-1') {
    bannerClass = 'count-hitter';
    if (iAmBatting) {
      badgeText = '🏏 3-1 HITTER COUNT &bull; COUNT ADVANTAGE';
      descText = 'Pitcher cannot throw Offspeed! Mistimed swings convert into walks or bloop hits. Hunt Fastball [6–10] or Breaking [3–7]!';
    } else {
      badgeText = '⚠️ 3-1 HITTER COUNT &bull; OFFSPEED LOCKOUT PENALTY';
      descText = 'Penalty active: Offspeed [1–5] is locked out! You must execute Fastball [6–10] or Breaking [3–7].';
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

// ─────────────────────────────────────────────────────────────────────────────
// ZONE BOARD RENDERING (2-BEAT FLOW: COUNT DUEL & PAYOFF PITCH)
// ─────────────────────────────────────────────────────────────────────────────
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
    const delta = z2?.timingDelta ?? 0;

    const myZ1Val = iAmBatting ? (bCardObj?.value ?? z1?.batterTotal ?? 0) : (pCardObj?.value ?? z1?.pitcherTotal ?? 0);
    const oppZ1Val = iAmBatting ? (pCardObj?.value ?? z1?.pitcherTotal ?? 0) : (bCardObj?.value ?? z1?.batterTotal ?? 0);
    const myZ1Label = iAmBatting ? 'You (B)' : 'You (P)';
    const oppZ1Label = iAmBatting ? 'Opp (P)' : 'Opp (B)';

    // Mound Content (Pitcher 3D Card Flip)
    const moundHtml = `
      <div class="mound-rubber"></div>
      <div class="mound-title">⚾ PITCHER: ${pPitchType}</div>
      <div class="field-card-container">
        <div class="card-flipper is-flipped">
          <div class="card-face card-back"><span class="card-back-icon">⚾</span></div>
          <div class="card-face card-front"><span class="card-hero-num">${pCardVal}</span></div>
        </div>
        <div class="field-card-tag ${z2?.pitcherExecuted ? 'pass' : 'fail'}">
          ${z2?.pitcherExecuted ? '🟢 SPOT ON' : '🔴 HANGER'}
        </div>
      </div>
    `;

    // Plate Content (Batter 3D Card Flip)
    const plateHtml = `
      <div class="home-plate-pentagon"></div>
      <div class="plate-title">🏏 BATTER: LOOKING ${bGuessPitch}</div>
      <div class="field-card-container">
        <div class="card-flipper is-flipped">
          <div class="card-face card-back"><span class="card-back-icon">🏏</span></div>
          <div class="card-face card-front"><span class="card-hero-num">${bCardVal}</span></div>
        </div>
        <div class="field-card-tag ${z2?.batterExecuted ? 'pass' : 'fail'}">
          ${z2?.batterExecuted ? '🟢 IN RANGE' : '🔴 OUT OF RANGE'}
        </div>
      </div>
    `;

    // Center Clash Beam
    const centerBeamHtml = `
      <div class="field-clash-beam">
        <div class="fcb-badge ${isMatch ? 'match' : 'whiff'}">
          <span class="fcb-title">${isMatch ? '🎯 PITCH ANTICIPATED' : '❌ FOOLED ON PITCH'}</span>
          <span class="fcb-delta">&Delta; ${delta}</span>
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

          <!-- Pitcher on Mound -->
          <div class="diamond-mound ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${moundHtml}
          </div>

          <!-- Center Clash Beam -->
          ${centerBeamHtml}

          <!-- Batter at Plate -->
          <div class="diamond-plate-area ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${plateHtml}
          </div>
        </div>

        <!-- Outcome Headline on Field -->
        <div class="clash-outcome-badge diamond-outcome-tag">
          <span class="cob-title">${z2?.outcomeDisplay || res.outcome?.display || 'Outcome Resolved'}</span>
        </div>
      </div>
    `;

  } else if (currentBeat === 'beat1') {
    // ── BEAT 1: THE COUNT BATTLE ON THE BASEBALL DIAMOND ──
    const myPlacedCardHtml = localBeatCard
      ? renderMiniPlacedCard(localBeatCard, 'z1', !myCommitted)
      : (!myCommitted
          ? `<div class="empty-drop-slot" onclick="if(selectedCard) selectBeatCard(selectedCard)">
               <span class="drop-hint">+ Drag or tap card</span>
             </div>`
          : '<div class="empty-drop-slot" style="opacity:0.3;">—</div>');

    const oppSlotHtml = oppCommitted
      ? `<div class="hidden-opponent-card"><span class="mystery-mark">✓ READY</span></div>`
      : `<div class="hidden-opponent-card waiting"><span class="mystery-mark">⏳ DECIDING…</span></div>`;

    // Drop slot on user territory, opponent slot on opp territory
    const mySlotEl = `
      <div class="b1-card-slot mine tray-drop-target"
           ondragover="handleTrayDragOver(event)"
           ondragenter="handleTrayDragEnter(event)"
           ondragleave="handleTrayDragLeave(event)"
           ondrop="handleTrayDrop(event, null, 'b1')"
           onclick="handleTrayClick(null, 'b1')">
        <span class="slot-role-tag">${iAmBatting ? '🏏 Your Batter Card' : '⚾ Your Pitcher Card'}</span>
        ${myPlacedCardHtml}
      </div>
    `;

    const oppSlotEl = `
      <div class="b1-card-slot opp">
        <span class="slot-role-tag">${iAmBatting ? '⚾ Opponent Pitcher Card' : '🏏 Opponent Batter Card'}</span>
        ${oppSlotHtml}
      </div>
    `;

    mainContentHtml = `
      <div class="beat1-arena diamond-arena">
        <div class="beat1-banner" onclick="handleTooltipClick(event, 'Beat 1: The Count Battle', 'Both players clash with a single card. The higher card wins count advantage (0-2 for pitcher, 3-1 for batter). A tie establishes a neutral 3-2 full count!')" title="Tap for info">
          <span class="b1-title">BEAT 1: THE COUNT DUEL <span class="adv-info-icon">ⓘ</span></span>
          <span class="b1-subtitle">Mound vs Plate &bull; High card wins count leverage</span>
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

          <!-- Left-Side User Rule & Test Compatibility: .b1-cards-row contains mine then opp -->
          <div class="b1-cards-row diamond-b1-row">
            ${mySlotEl}
            <div class="b1-vs-badge">VS</div>
            ${oppSlotEl}
          </div>
        </div>
      </div>
    `;

  } else {
    // ── BEAT 2: THE PAYOFF PITCH ON THE BASEBALL DIAMOND ──
    const isDominant = Boolean(b1Data?.isDominant);
    const disAdvSide = b1Data?.revealCardFirst;
    const battingRole = (pitchingRole === 'host') ? 'guest' : 'host';
    const disAdvRole = (disAdvSide === 'pitcher') ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null);
    const isOppDisadvantaged = Boolean(disAdvRole && disAdvRole === oppKey);
    const amIDisadvantaged = Boolean(disAdvRole && disAdvRole === myKey);

    const isOffspeedLocked = (count === '3-1') || (b1Data?.lockedOption === 'offspeed');
    if (isOffspeedLocked) {
      if (!iAmBatting && localPitchType === 'offspeed') localPitchType = 'fastball';
      if (iAmBatting && localGuessPitch === 'offspeed') localGuessPitch = 'fastball';
    }

    const curPitch = !iAmBatting ? localPitchType : localGuessPitch;
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
      // User is Pitching: 3 Pitch Trays on Mound
      moundContent = `
        <div class="mound-rubber"></div>
        <div class="mound-title">⚾ PITCHER'S MOUND &bull; DRAG CARD TO PITCH</div>
        <div class="pitch-trays-container selection-tiles">
          <!-- Fastball -->
          <div class="pitch-tray choice-tile tray-drop-target ${localPitchType === 'fastball' ? 'active' : ''} ${charges.fastball <= 0 ? 'disabled' : ''}"
               ondragover="handleTrayDragOver(event)"
               ondragenter="handleTrayDragEnter(event)"
               ondragleave="handleTrayDragLeave(event)"
               ondrop="handleTrayDrop(event, 'fastball', 'mound')"
               onclick="handleTrayClick('fastball', 'mound')"
               data-tooltip-title="Fastball [6–10 Heat]"
               data-tooltip-body="Velocity heat. Target window is 6–10. Cards below 6 will result in a hung mistake pitch! Remaining: ${charges.fastball}">
            <div class="pt-header">
              <span class="pt-icon">🔥</span>
              <span class="pt-name">Fastball</span>
              <span class="pt-charges">${charges.fastball ?? 0}</span>
            </div>
            <div class="pt-range">[6–10 Heat]</div>
            ${(localBeatCard && localPitchType === 'fastball') ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted) : '<div class="tray-empty-hint">+ Drop Card</div>'}
          </div>

          <!-- Breaking -->
          <div class="pitch-tray choice-tile tray-drop-target ${localPitchType === 'breaking' ? 'active' : ''} ${charges.breaking <= 0 ? 'disabled' : ''}"
               ondragover="handleTrayDragOver(event)"
               ondragenter="handleTrayDragEnter(event)"
               ondragleave="handleTrayDragLeave(event)"
               ondrop="handleTrayDrop(event, 'breaking', 'mound')"
               onclick="handleTrayClick('breaking', 'mound')"
               data-tooltip-title="Breaking Ball [3–7 Bite]"
               data-tooltip-body="Spin and bite. Target window is 3–7. Effective against balanced swings. Remaining: ${charges.breaking}">
            <div class="pt-header">
              <span class="pt-icon">🌀</span>
              <span class="pt-name">Breaking</span>
              <span class="pt-charges">${charges.breaking ?? 0}</span>
            </div>
            <div class="pt-range">[3–7 Bite]</div>
            ${(localBeatCard && localPitchType === 'breaking') ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted) : '<div class="tray-empty-hint">+ Drop Card</div>'}
          </div>

          <!-- Offspeed -->
          <div class="pitch-tray choice-tile tray-drop-target ${localPitchType === 'offspeed' ? 'active' : ''} ${isOffspeedLocked ? 'locked disabled' : (charges.offspeed <= 0 ? 'disabled' : '')}"
               ondragover="${isOffspeedLocked ? '' : 'handleTrayDragOver(event)'}"
               ondragenter="${isOffspeedLocked ? '' : 'handleTrayDragEnter(event)'}"
               ondragleave="${isOffspeedLocked ? '' : 'handleTrayDragLeave(event)'}"
               ondrop="${isOffspeedLocked ? '' : 'handleTrayDrop(event, \'offspeed\', \'mound\')'}"
               onclick="${isOffspeedLocked ? '' : 'handleTrayClick(\'offspeed\', \'mound\')'}"
               data-tooltip-title="Offspeed [1–5 Touch]"
               data-tooltip-body="${isOffspeedLocked ? 'Offspeed is locked out due to 3-1 Hitter Count penalty!' : `Deception & touch. Target window is 1–5. Disables power bats. Remaining: ${charges.offspeed}`}">
            <div class="pt-header">
              <span class="pt-icon">${isOffspeedLocked ? '🔒' : '⏱️'}</span>
              <span class="pt-name">Offspeed</span>
              <span class="pt-charges">${isOffspeedLocked ? 'LOCKED' : (charges.offspeed ?? 0)}</span>
            </div>
            <div class="pt-range">${isOffspeedLocked ? '3-1 Lockout' : '[1–5 Touch]'}</div>
            ${(localBeatCard && localPitchType === 'offspeed' && !isOffspeedLocked) ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted) : (isOffspeedLocked ? '<div class="tray-locked-hint">🔒 Locked</div>' : '<div class="tray-empty-hint">+ Drop Card</div>')}
          </div>
        </div>
      `;
    } else {
      // Opponent is Pitcher on Mound
      moundContent = `
        <div class="mound-rubber"></div>
        <div class="mound-title">⚾ PITCHER'S MOUND &bull; OPPONENT</div>
        <div class="opp-mound-status">
          ${oppSlotHtml}
        </div>
      `;
    }

    // Plate Content
    let plateContent = '';
    if (iAmBatting) {
      // User is Batting: 3 Anticipation Trays at Home Plate
      plateContent = `
        <div class="home-plate-pentagon"></div>
        <div class="plate-title">🏏 HOME PLATE &bull; DRAG CARD TO GUESS PITCH</div>
        <div class="batter-trays-container selection-tiles">
          <!-- Fastball -->
          <div class="pitch-tray choice-tile tray-drop-target ${localGuessPitch === 'fastball' ? 'active' : ''}"
               ondragover="handleTrayDragOver(event)"
               ondragenter="handleTrayDragEnter(event)"
               ondragleave="handleTrayDragLeave(event)"
               ondrop="handleTrayDrop(event, 'fastball', 'plate')"
               onclick="handleTrayClick('fastball', 'plate')"
               data-tooltip-title="Anticipate Fastball [6–10]"
               data-tooltip-body="Anticipate high velocity. Target timing window is 6–10.${bScout.favoritePitch === 'fastball' ? ' ⭐ Favorite pitch: barreled contact produces extra bases!' : ''}">
            <div class="pt-header">
              <span class="pt-icon">🔥</span>
              <span class="pt-name">Fastball</span>
              ${bScout.favoritePitch === 'fastball' ? '<span class="pt-fav-tag">⭐ FAV</span>' : ''}
            </div>
            <div class="pt-range">[6–10]</div>
            ${(localBeatCard && localGuessPitch === 'fastball') ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted) : '<div class="tray-empty-hint">+ Drop Card</div>'}
          </div>

          <!-- Breaking -->
          <div class="pitch-tray choice-tile tray-drop-target ${localGuessPitch === 'breaking' ? 'active' : ''}"
               ondragover="handleTrayDragOver(event)"
               ondragenter="handleTrayDragEnter(event)"
               ondragleave="handleTrayDragLeave(event)"
               ondrop="handleTrayDrop(event, 'breaking', 'plate')"
               onclick="handleTrayClick('breaking', 'plate')"
               data-tooltip-title="Anticipate Breaking [3–7]"
               data-tooltip-body="Anticipate spin & break. Target timing window is 3–7.${bScout.favoritePitch === 'breaking' ? ' ⭐ Favorite pitch: barreled contact produces extra bases!' : ''}">
            <div class="pt-header">
              <span class="pt-icon">🌀</span>
              <span class="pt-name">Breaking</span>
              ${bScout.favoritePitch === 'breaking' ? '<span class="pt-fav-tag">⭐ FAV</span>' : ''}
            </div>
            <div class="pt-range">[3–7]</div>
            ${(localBeatCard && localGuessPitch === 'breaking') ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted) : '<div class="tray-empty-hint">+ Drop Card</div>'}
          </div>

          <!-- Offspeed -->
          <div class="pitch-tray choice-tile tray-drop-target ${localGuessPitch === 'offspeed' ? 'active' : ''} ${isOffspeedLocked ? 'locked disabled' : ''}"
               ondragover="${isOffspeedLocked ? '' : 'handleTrayDragOver(event)'}"
               ondragenter="${isOffspeedLocked ? '' : 'handleTrayDragEnter(event)'}"
               ondragleave="${isOffspeedLocked ? '' : 'handleTrayDragLeave(event)'}"
               ondrop="${isOffspeedLocked ? '' : 'handleTrayDrop(event, \'offspeed\', \'plate\')'}"
               onclick="${isOffspeedLocked ? '' : 'handleTrayClick(\'offspeed\', \'plate\')'}"
               data-tooltip-title="Anticipate Offspeed [1–5]"
               data-tooltip-body="${isOffspeedLocked ? 'Offspeed is locked out on 3-1 count!' : `Anticipate touch & changeup. Target timing window is 1–5.${bScout.favoritePitch === 'offspeed' ? ' ⭐ Favorite pitch!' : ''}`}">
            <div class="pt-header">
              <span class="pt-icon">${isOffspeedLocked ? '🔒' : '⏱️'}</span>
              <span class="pt-name">Offspeed</span>
              ${isOffspeedLocked ? '<span class="pt-fav-tag">LOCKED</span>' : (bScout.favoritePitch === 'offspeed' ? '<span class="pt-fav-tag">⭐ FAV</span>' : '')}
            </div>
            <div class="pt-range">${isOffspeedLocked ? '3-1 Lockout' : '[1–5]'}</div>
            ${(localBeatCard && localGuessPitch === 'offspeed' && !isOffspeedLocked) ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted) : (isOffspeedLocked ? '<div class="tray-locked-hint">🔒 Locked</div>' : '<div class="tray-empty-hint">+ Drop Card</div>')}
          </div>
        </div>
      `;
    } else {
      // Opponent is Batter at Home Plate
      plateContent = `
        <div class="home-plate-pentagon"></div>
        <div class="plate-title">🏏 HOME PLATE &bull; OPPONENT</div>
        <div class="opp-plate-status">
          ${oppSlotHtml}
        </div>
      `;
    }

    // Execution range feedback
    const execFeedbackHtml = (cardVal !== null) ? `
      <div class="diamond-exec-pill ${inRange ? 'pass' : 'fail'}">
        <span>${!iAmBatting ? curPitch.toUpperCase() : `LOOKING ${curPitch.toUpperCase()}`} [${curRange.label}]</span>
        <span>${inRange ? `🟢 IN RANGE [Card ${cardVal}]` : `⚠️ OUT OF RANGE [Card ${cardVal}]`}</span>
      </div>
    ` : `
      <div class="diamond-exec-pill waiting">
        <span>${!iAmBatting ? curPitch.toUpperCase() : `LOOKING ${curPitch.toUpperCase()}`} [${curRange.label}]</span>
        <span>Drag a card to a tray</span>
      </div>
    `;

    mainContentHtml = `
      <div class="beat2-arena diamond-arena">
        ${renderBeat2AdvantageBanner(b1Data, iAmBatting, !iAmBatting)}
        ${disAdvNoticeHtml}

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

          <!-- Pitcher's Mound (Center) -->
          <div class="diamond-mound ${!iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${moundContent}
          </div>

          <!-- Home Plate / Batter's Box (Bottom) -->
          <div class="diamond-plate-area ${iAmBatting ? 'mine-territory' : 'opp-territory'}">
            ${plateContent}
          </div>
        </div>

        ${execFeedbackHtml}
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

function renderMiniPlacedCard(id, targetZone, canRemove, index) {
  const card = getCard(id);
  if (!card) return '';

  return `
    <div class="placed-number-card" onclick="${canRemove ? 'removeBeatCard()' : ''}" title="${canRemove ? 'Click to remove' : ''}">
      <span class="pnc-num">${card.value}</span>
      ${canRemove ? '<span class="remove-btn">✕</span>' : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAND RENDERING (PURE NUMBER CARDS)
// ─────────────────────────────────────────────────────────────────────────────
function renderHand(handIds, iAmBatting, iAmPitching, myCommitted, currentBeat = 'beat1') {
  if (!handIds || handIds.length === 0) {
    return '<div class="hand-cards-container"><p class="muted" style="margin:auto;font-size:0.75rem;">Hand empty</p></div>';
  }

  return `
    <div class="hand-cards-container">
      ${handIds.map((id) => {
        const card = getCard(id);
        if (!card) return '';
        const inPlacement = isInPlacement(id);
        const isActive = isCardActiveForRole(card, iAmBatting, iAmPitching) && !inPlacement && !myCommitted;
        const isSelected = (selectedCard === id) || (localBeatCard === id);

        return `
          <div class="number-card ${isActive ? 'active' : 'inactive'} ${isSelected ? 'selected' : ''}"
               draggable="${isActive ? 'true' : 'false'}"
               ondragstart="${isActive ? `handleCardDragStart(event, '${id}')` : ''}"
               ondragend="${isActive ? `handleCardDragEnd(event)` : ''}"
               onclick="${isActive ? `selectCard('${id}')` : ''}"
               title="${isActive ? `Value: ${card.value} (Drag to diamond tray or tap)` : 'Cannot play this card'}">
            <span class="card-hero-num">${card.value}</span>
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
  return ['z1','z2'].some(z => (localPlacement[z] || []).includes(cardId));
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD INTERACTION
// ─────────────────────────────────────────────────────────────────────────────
function selectCard(cardId) {
  if (localBeatCard === cardId) {
    localBeatCard = null;
    selectedCard = null;
  } else {
    localBeatCard = cardId;
    selectedCard = null;
  }
  const g = window._lastGameState;
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

  if (currentBeat === 'beat1') {
    if (!localBeatCard) {
      alert('Please choose 1 card from your hand to contest the Count Battle.');
      return;
    }
  } else if (currentBeat === 'beat2') {
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

  // Remove chosen card from hand
  const newHand = [...localHand];
  if (localBeatCard) {
    const idx = newHand.indexOf(localBeatCard);
    if (idx > -1) newHand.splice(idx, 1);
  }
  localHand = newHand;

  const targetZone = (currentBeat === 'beat1') ? 'z1' : 'z2';
  const updatedLocalPlacement = { ...(pa.placement?.[myRole] || { z1:[], z2:[] }) };
  if (localBeatCard) {
    updatedLocalPlacement[targetZone] = [localBeatCard];
  }

  gameRef().once('value', snap => {
    const liveG = snap.val();
    if (!liveG) return;
    const livePA = liveG.currentPA || {};
    const liveGS = liveG.gameState || {};

    const myBeatPlacement = (currentBeat === 'beat1')
      ? { cardId: localBeatCard }
      : (iAmPitching
          ? { pitchType: localPitchType, cardId: localBeatCard }
          : { guessPitch: localGuessPitch, cardId: localBeatCard });

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
        const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[] }) };
        if (botPlay.cardId) {
          updatedBotPlacement.z1 = [botPlay.cardId];
        }

        updates['currentPA/beatPlacements/beat1/guest'] = { cardId: botPlay.cardId || null };
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

          const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[] }) };
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
    }

    gameRef().update(updates).then(() => {
      localBeatCard = null;
      selectedCard  = null;
      if (shouldResolve && myRole === 'host') {
        resolveBeatStep(currentBeat);
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
        const batterCardId = bPlacements.cardId || null;

        const beat1Result = resolveBeat1({
          pitcherCardId,
          batterCardId,
          pitcherChar,
          batterChar,
          pitcherPAsFaced,
          isFirstPAOfInning: Boolean(pa.isFirstPAOfInning)
        });

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
          finalizePA(g, res);
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
        };

        gameRef().update(updates);

      } else if (beat === 'beat2') {
        const beat1Result = pa.beatResults?.beat1 || {};
        const pitcherCardId = pPlacements.cardId || null;
        const pitchType = pPlacements.pitchType || 'fastball';

        const batterCardId = bPlacements.cardId || null;
        const guessPitch = bPlacements.guessPitch || 'fastball';

        // Deduct pitch charge
        const charges = { ...(gs.arsenalCharges || {}) };
        if (!charges[pitchingRole]) {
          charges[pitchingRole] = { ...(pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 }) };
        } else {
          charges[pitchingRole] = { ...charges[pitchingRole] };
        }
        if ((charges[pitchingRole][pitchType] || 0) > 0) {
          charges[pitchingRole][pitchType]--;
        }

        const beat2Result = resolveBeat2({
          count: beat1Result.count || '3-2',
          beat1Winner: beat1Result.winner || 'tie',
          z1Winner: beat1Result.winner || 'tie',
          pitchType,
          pitcherCardId,
          guessPitch,
          batterCardId,
          pitcherChar,
          batterChar,
          pitcherPAsFaced,
          bases,
          outs,
          score,
          pitcherAdvantagePerk: beat1Result.pitcherAdvantagePerk,
          batterAdvantagePerk: beat1Result.batterAdvantagePerk,
        });

        // Spoil It: fouls off an out, resetting Beat 2
        if (beat2Result.isFoulBall) {
          const updates = {
            'currentPA/beat': 'beat2',
            'currentPA/committed/host': false,
            'currentPA/committed/guest': false,
            'currentPA/beatPlacements/beat2': { host:{}, guest:{} },
            [`currentPA/placement/${pitchingRole}/z2`]: [],
            [`currentPA/placement/${battingRole}/z2`]:  [],
            'gameState/arsenalCharges': charges,
          };
          gameRef().update(updates);
          return;
        }

        // Option 3: Wild Pitch in dirt on 0-2 resets count to 3-2 and advances runners!
        if (beat2Result.isWildPitchReset) {
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

          const newScore = { ...(gs.score || { top:0, bottom:0 }) };
          newScore[half] = (newScore[half] || 0) + (beat2Result.runsScored || 0);

          const updates = {
            'currentPA/phase': 'wild_pitch_result',
            'currentPA/resolution': res,
            'gameState/bases': beat2Result.newBases,
            'gameState/score': newScore,
            'gameState/arsenalCharges': charges,
          };
          gameRef().update(updates);
          return;
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
        finalizePA(g, res, charges);
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

function finalizePA(g, res, updatedCharges) {
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
      ['beat1', 'beat2'].forEach(b => {
        ['host', 'guest'].forEach(r => {
          const cId = pa.beatPlacements?.[b]?.[r]?.cardId;
          if (cId && !playedCards[r].includes(cId)) playedCards[r].push(cId);
        });
      });
      ['host', 'guest'].forEach(r => {
        ['z1', 'z2'].forEach(z => {
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
        updates['currentPA/beatPlacements']    = { beat1: { host:{}, guest:{} }, beat2: { host:{}, guest:{} } };
        updates['currentPA/beatResults']       = { beat1: null, beat2: null };
        updates['currentPA/placement/host']    = { z1:[], z2:[] };
        updates['currentPA/placement/guest']   = { z1:[], z2:[] };
        updates['currentPA/resolution']        = null;
        updates['currentPA/isFirstPAOfInning'] = false;
      }

      gameRef().update(updates).then(() => {
        localPitchChoice = null;
        localGuessChoice = null;
        localBeatCard    = null;
        selectedCard     = null;
        localPitchType   = 'fastball';
        localGuessPitch  = 'fastball';
        localSwingType   = 'balanced';
        localPlacement   = { z1:[], z2:[] };
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
        <span>Z1 (Read): <b>${pitcherChar.zoneBonuses.z1>=0?'+':''}${pitcherChar.zoneBonuses.z1}</b></span>
        <span>Z2 (Swing): <b>${pitcherChar.zoneBonuses.z2>=0?'+':''}${pitcherChar.zoneBonuses.z2}</b></span>
        <span>Z3 (Result): <b>${pitcherChar.zoneBonuses.z3>=0?'+':''}${pitcherChar.zoneBonuses.z3}</b></span>
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
        <span>Z1 (Read): <b>${batterChar.zoneBonuses.z1>=0?'+':''}${batterChar.zoneBonuses.z1}</b></span>
        <span>Z2 (Swing): <b>${batterChar.zoneBonuses.z2>=0?'+':''}${batterChar.zoneBonuses.z2}</b></span>
        <span>Z3 (Result): <b>${batterChar.zoneBonuses.z3>=0?'+':''}${batterChar.zoneBonuses.z3}</b></span>
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

function renderBeat1ResultModal(b1, isPitcherMe) {
  if (!b1) return '';
  const winner = b1.winner || 'tie';
  const count = b1.count || (winner === 'pitcher' ? '0-2' : (winner === 'batter' ? '3-1' : '3-2'));
  const pCard = b1.pitcherCards?.[0] ? getCard(b1.pitcherCards[0]) : null;
  const bCard = b1.batterCards?.[0] ? getCard(b1.batterCards[0]) : null;
  const pVal = pCard?.value ?? b1.pitcherTotal ?? 0;
  const bVal = bCard?.value ?? b1.batterTotal ?? 0;
  const margin = b1.margin ?? Math.abs(pVal - bVal);
  const isDominant = Boolean(b1.isDominant || margin >= 5);

  let countTitle = '3-2 FULL COUNT';
  let bannerClass = 'count-full';
  let explanation = 'Both cards had equal value. Even battle &mdash; all pitch and swing options available for the payoff pitch.';
  let winnerTag = '⚖️ COUNT TIED';

  if (winner === 'pitcher') {
    countTitle = "0-2 PITCHER'S COUNT";
    bannerClass = 'count-pitcher';
    winnerTag = isPitcherMe ? '🎉 YOU WON COUNT' : '⚠️ OPPONENT WON COUNT';
    if (isDominant) {
      explanation = isPitcherMe
        ? `🔥 <b>Dominant Win (+${margin})!</b> 0-2 Count established &mdash; two-strike plate protection in effect, and Batter must commit their execution card <b>FACE-UP FIRST</b>!`
        : `⚠️ <b>Dominant Loss (+${margin})!</b> 0-2 Count against you &mdash; two-strike plate protection in effect, and you must commit your execution card <b>FACE-UP FIRST</b>!`;
    } else {
      explanation = isPitcherMe
        ? `Pitcher won the count battle! 0-2 Count established &mdash; two-strike plate protection in effect (home runs capped at doubles, elevated strikeout danger).`
        : `Opponent won the count battle! 0-2 Count against you &mdash; two-strike plate protection in effect (home runs capped at doubles).`;
    }
  } else if (winner === 'batter') {
    countTitle = "3-1 HITTER'S COUNT";
    bannerClass = 'count-hitter';
    winnerTag = !isPitcherMe ? '🎉 YOU WON COUNT' : '⚠️ OPPONENT WON COUNT';
    if (isDominant) {
      explanation = !isPitcherMe
        ? `🔥 <b>Dominant Win (+${margin})!</b> Pitcher's <b>Offspeed pitch is LOCKED OUT</b>, and Pitcher must commit their execution card <b>FACE-UP FIRST</b>!`
        : `⚠️ <b>Dominant Loss (+${margin})!</b> Your <b>Offspeed pitch is LOCKED OUT</b>, and you must commit your execution card <b>FACE-UP FIRST</b>!`;
    } else {
      explanation = !isPitcherMe
        ? `Batter won the count battle! Pitcher's <b>Offspeed pitch is LOCKED OUT</b> (forced to challenge with Fastball or Breaking).`
        : `Opponent won the count battle! Your <b>Offspeed pitch is LOCKED OUT</b> (changeups eliminated).`;
    }
  }

  const myCardVal = isPitcherMe ? pVal : bVal;
  const oppCardVal = isPitcherMe ? bVal : pVal;
  const myRoleTag = isPitcherMe ? '⚾ You (Pitcher)' : '🏏 You (Batter)';
  const oppRoleTag = isPitcherMe ? '🏏 Opponent (Batter)' : '⚾ Opponent (Pitcher)';

  return `
    <div class="result-modal-overlay" id="beat1-result-modal">
      <div class="result-modal-card">
        <div class="rm-header">
          <span class="rm-tag">BEAT 1 RESULT &bull; THE COUNT</span>
          <span class="rm-suspense-label">⚡ COUNT DUEL REVEAL</span>
          <span class="rm-winner-pill ${bannerClass}">${winnerTag}</span>
        </div>

        <div class="rm-cards-compare">
          <div class="rm-player-box mine anticipate-flip-p">
            <span class="rm-role">${myRoleTag}</span>
            <div class="number-card sm selected">
              <span class="card-hero-num">${myCardVal}</span>
            </div>
          </div>
          <div class="rm-vs anticipate-vs">VS</div>
          <div class="rm-player-box opp anticipate-flip-b">
            <span class="rm-role">${oppRoleTag}</span>
            <div class="number-card sm selected">
              <span class="card-hero-num">${oppCardVal}</span>
            </div>
          </div>
        </div>

        <div class="rm-count-banner ${bannerClass} anticipate-banner">
          <div class="rm-count-num">${count}</div>
          <div class="rm-count-label">${countTitle}</div>
        </div>

        ${isDominant ? `<div class="rm-dominant-tag anticipate-dominant">🔥 DOMINANT BEAT (+${margin}) &bull; COMBINED ADVANTAGE</div>` : ''}

        <div class="rm-explanation anticipate-explain">
          ${explanation}
        </div>

        <button class="btn-primary rm-btn anticipate-btn" onclick="proceedToBeat2()">
          Continue to Payoff Pitch &rarr;
        </button>
      </div>
    </div>`;
}

function proceedToBeat2() {
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
  const z2 = res.z2;

  const runsScored = o.runsScored || 0;
  const outsAdded = o.outsAdded || 0;

  // Pitcher recap
  const pCard = z2?.pitcherCardId ? getCard(z2.pitcherCardId) : (z1?.pitcherCards?.[0] ? getCard(z1.pitcherCards[0]) : null);
  const pVal = pCard?.value ?? z2?.pitcherCardVal ?? z1?.pitcherTotal ?? '—';
  const pPitch = z2?.pitchType ? z2.pitchType.toUpperCase() : 'FASTBALL';

  // Batter recap
  const bCard = z2?.batterCardId ? getCard(z2.batterCardId) : (z1?.batterCards?.[0] ? getCard(z1.batterCards[0]) : null);
  const bVal = bCard?.value ?? z2?.batterCardVal ?? z1?.batterTotal ?? '—';
  const bGuess = z2?.guessPitch ? z2.guessPitch.toUpperCase() : 'FASTBALL';

  const timingDelta = z2?.timingDelta ?? (typeof pVal === 'number' && typeof bVal === 'number' ? Math.abs(pVal - bVal) : 0);
  let timingBadgeHtml = '';
  if (timingDelta === 0) {
    timingBadgeHtml = `<span class="timing-badge squared">🎯 DELTA 0 &bull; SQUARED UP BARREL</span>`;
  } else if (timingDelta <= 2) {
    timingBadgeHtml = `<span class="timing-badge solid">🏏 DELTA ${timingDelta} &bull; SOLID TIMING</span>`;
  } else if (timingDelta <= 4) {
    timingBadgeHtml = `<span class="timing-badge weak">🧤 DELTA ${timingDelta} &bull; OFF-BALANCE CONTACT</span>`;
  } else {
    timingBadgeHtml = `<span class="timing-badge miss">⚡ DELTA ${timingDelta} &bull; MISTIMED</span>`;
  }

  const pitchMatched = Boolean(z2?.pitchMatched ?? (z2?.matchTier === 'matched'));
  let deductionBadgeHtml = '';
  if (pitchMatched) {
    deductionBadgeHtml = `<span class="deduction-badge full">🎯 PITCH ANTICIPATED (${pPitch})</span>`;
  } else {
    deductionBadgeHtml = `<span class="deduction-badge whiff">❌ FOOLED ON PITCH (Threw ${pPitch}, Anticipated ${bGuess})</span>`;
  }

  // 3-Step Breakdown Details
  const step1ReadHtml = pitchMatched
    ? `<span class="rb-step-val success">🎯 ANTICIPATED (${pPitch})</span>`
    : `<span class="rb-step-val fail">❌ FOOLED (${pPitch} vs Looking ${bGuess})</span>`;

  const myVal = isBatting ? bVal : pVal;
  const oppVal = isBatting ? pVal : bVal;
  const myRoleTag = isBatting ? '🏏 You (Batter)' : '⚾ You (Pitcher)';
  const oppRoleTag = isBatting ? '⚾ Opponent (Pitcher)' : '🏏 Opponent (Batter)';

  const myActionText = isBatting ? `Looking <b>${bGuess}</b> [Card ${bVal}]` : `<b>${pPitch}</b> [Card ${pVal}]`;
  const oppActionText = isBatting ? `<b>${pPitch}</b> [Card ${pVal}]` : `Looking <b>${bGuess}</b> [Card ${bVal}]`;

  const myExecText = isBatting
    ? (z2 ? (z2.batterExecuted ? `You: [${bVal}] 🟢 In Range` : `You: [${bVal}] 🔴 Out of Range`) : `You: [${bVal}]`)
    : (z2 ? (z2.pitcherExecuted ? `You: [${pVal}] 🟢 Spot-on` : `You: [${pVal}] 🔴 Hanger`) : `You: [${pVal}]`);

  const oppExecText = isBatting
    ? (z2 ? (z2.pitcherExecuted ? `Opp: [${pVal}] 🟢 Spot-on` : `Opp: [${pVal}] 🔴 Hanger`) : `Opp: [${pVal}]`)
    : (z2 ? (z2.batterExecuted ? `Opp: [${bVal}] 🟢 In Range` : `Opp: [${bVal}] 🔴 Out of Range`) : `Opp: [${bVal}]`);

  const step2ExecHtml = `<span class="rb-step-val">${myExecText} vs ${oppExecText} &bull; Δ ${timingDelta}</span>`;

  const ruleReason = z2?.ruleReason || o.ruleReason || (pitchMatched ? `Anticipated pitch with Delta ${timingDelta} contact.` : `Fooled on pitch type with Delta ${timingDelta} swing.`);

  return `
    <div class="result-modal-overlay" id="outcome-overlay">
      <div class="result-modal-card outcome">
        <div class="rm-header">
          <span class="rm-tag">AT-BAT OUTCOME</span>
          <span class="rm-suspense-label">⚡ PAYOFF CLASH</span>
          <span class="rm-count-tag">${z1?.count ? `Count: ${z1.count}` : ''}</span>
        </div>

        <div class="rm-clash-recap">
          <div class="recap-row anticipate-p-action">
            <span class="recap-label">${myRoleTag}:</span>
            <span class="recap-val">${myActionText}</span>
          </div>
          <div class="recap-row anticipate-b-action">
            <span class="recap-label">${oppRoleTag}:</span>
            <span class="recap-val">${oppActionText}</span>
          </div>
          ${z2 ? `
            <div class="recap-row anticipate-timing">
              <span class="recap-label">⏱️ Timing:</span>
              <span class="recap-val">${timingBadgeHtml}</span>
            </div>
            <div class="recap-row anticipate-matchup">
              <span class="recap-label">🎯 Deduction:</span>
              <span class="recap-val">${deductionBadgeHtml}</span>
            </div>
          ` : ''}
        </div>

        <!-- 3-STEP RESOLUTION BREAKDOWN -->
        <div class="rm-resolution-breakdown">
          <div class="rb-step">
            <span class="rb-step-title">1. PITCH READ:</span>
            ${step1ReadHtml}
          </div>
          <div class="rb-step">
            <span class="rb-step-title">2. EXECUTION &amp; &Delta;:</span>
            ${step2ExecHtml}
          </div>
        </div>

        <!-- PLAIN-ENGLISH RULE REASON -->
        <div class="rm-rule-explanation">
          <span class="rre-icon">💡</span>
          <div class="rre-text">${ruleReason}</div>
        </div>

        <div class="rm-outcome-banner hero anticipate-outcome">
          <div class="rm-outcome-title">${o.display || 'At-Bat Complete'}</div>
        </div>

        <div class="rm-impact-row anticipate-impact">
          ${runsScored > 0
            ? `<span class="impact-runs">⚾ ${runsScored} RUN${runsScored > 1 ? 'S' : ''} SCORED!</span>`
            : '<span class="impact-noruns">No runs scored</span>'}
          <span class="impact-outs">${outsAdded > 0 ? `+${outsAdded} Out${outsAdded > 1 ? 's' : ''}` : 'No outs recorded'}</span>
        </div>

        <!-- MATRIX QUICK GUIDE (COLLAPSIBLE) -->
        <details class="rm-matrix-guide">
          <summary class="rmg-header"><span>📖 Outcome Matrix Guide</span><span>▼</span></summary>
          <div class="rmg-body">
            <div class="rmg-item">🎯 <b>Anticipated + &Delta; 0:</b> Squared-up barrel &rarr; Moonshot HR (capped at Double on 0-2 count).</div>
            <div class="rmg-item">🏏 <b>Anticipated + &Delta; 1–2:</b> Solid timing &rarr; Line drive Single or Wall Double.</div>
            <div class="rmg-item">🧤 <b>Anticipated + &Delta; 3–4:</b> Off-balance swing &rarr; Groundout/Flyout (Single on 3-1 count).</div>
            <div class="rmg-item">⚡ <b>Anticipated + &Delta; 5+:</b> Whiffed swing &rarr; Swinging Strikeout on executed delivery.</div>
            <div class="rmg-item">⚡ <b>Fooled on Pitch:</b> Pitcher advantage &rarr; Popout (&Delta; 0–2), Strikeout (&Delta; 3+), Punchout on 0-2.</div>
            <div class="rmg-item">⚠️ <b>Mistake Pitch (Out-of-Range):</b> Hung pitch with anticipated in-range timing is crushed for extra bases (HR/2B), never an out!</div>
          </div>
        </details>

        <button class="btn-primary rm-btn btn-next-batter anticipate-next-btn" onclick="nextPA()">
          Next Batter &rarr;
        </button>
      </div>
    </div>`;
}

function renderOutcomeBanner(res) {
  return renderOutcomeOverlay(res);
}

function renderActionCard(id, isSelected, isInactive, canRemove, context) {
  const card = getCard(id);
  if (!card) return '';
  const classes = ['number-card', 'sm', context, isSelected ? 'selected' : '', isInactive ? 'inactive' : 'active'].filter(Boolean).join(' ');
  return `
    <div class="${classes}">
      <span class="card-hero-num">${card.value}</span>
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
        if (!pa || pa.phase === 'resolved' || pa.phase === 'beat1_result' || window._resolvingBeat) return;
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
