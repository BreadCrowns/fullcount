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
let localPitchLocation = 'high';      // 'high' | 'low'
let localGuessPitch    = 'fastball';  // 'fastball' | 'breaking' | 'offspeed'
let localSwingType     = 'balanced';  // 'contact' | 'balanced' | 'power'
let localTargetZone    = 'high';      // 'high' | 'low'
let gameListener     = null; // Firebase listener ref

const TOTAL_INNINGS = 3;
const MAX_HAND      = 6;
const ZONE_LIMIT    = 2;  // max cards per zone
const PA_CARD_LIMIT = 4;  // max cards per PA (BC09 The Captain: 5)

function selectPitchType(pitch) {
  localPitchType = pitch;
  localPitchChoice = pitch;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectPitchType = selectPitchType;
window.selectPitchCall = selectPitchType;

function selectPitchLocation(loc) {
  localPitchLocation = loc;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectPitchLocation = selectPitchLocation;

function selectGuessPitch(pitch) {
  localGuessPitch = pitch;
  localGuessChoice = pitch;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectGuessPitch = selectGuessPitch;

function selectSwingType(swing) {
  localSwingType = swing;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectSwingType = selectSwingType;

function selectTargetZone(zone) {
  localTargetZone = zone;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectTargetZone = selectTargetZone;
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
  if (typeof db === 'undefined' || !db) {
    const dummy = {
      update: () => Promise.resolve(),
      set: () => Promise.resolve(),
      once: (evt, cb) => { if (cb) cb({ val: () => null }); return Promise.resolve({ val: () => null }); },
      on: () => {},
      off: () => {}
    };
    return dummy;
  }
  return db.ref(`fullcount_games/${gameId}${path ? '/'+path : ''}`);
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
    case 'placing':      renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'beat1_result': renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'reveal':       renderReveal(g, gs, pa, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'resolved':     renderResolved(g, gs, pa, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
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
      const baseDiff = pitcherChar?.executionDifficulties?.[localPitchType] ?? 4;
      const countDisc = (b1?.count === '0-2') ? 2 : 0;
      const effDiff = Math.max(1, baseDiff - countDisc);
      const executes = localBeatCard ? (cardVal >= effDiff) : false;

      if (!localBeatCard) {
        lockBtnLabel = 'CHOOSE CARD';
        lockBtnSub = `${localPitchType.toUpperCase()} ${localPitchLocation.toUpperCase()} &bull; Diff ${effDiff}`;
        lockBtnDisabled = true;
      } else {
        lockBtnLabel = 'LOCK IN PITCH';
        lockBtnSub = `${localPitchType.toUpperCase()} ${localPitchLocation.toUpperCase()} &bull; [${cardVal}] vs Diff ${effDiff} (${executes ? 'SPOT ON' : 'HANGER'})`;
        lockBtnDisabled = false;
      }
    } else {
      const baseDiff = batterChar?.swingDifficulties?.[localSwingType] ?? 5;
      const countDisc = (b1?.count === '3-1') ? 2 : 0;
      const effDiff = Math.max(1, baseDiff - countDisc);
      const executes = localBeatCard ? (cardVal >= effDiff) : false;

      if (!localBeatCard) {
        lockBtnLabel = 'CHOOSE CARD';
        lockBtnSub = `${localSwingType.toUpperCase()} ${localTargetZone.toUpperCase()} &bull; Diff ${effDiff}`;
        lockBtnDisabled = true;
      } else {
        lockBtnLabel = 'LOCK IN SWING';
        lockBtnSub = `${localSwingType.toUpperCase()} ${localTargetZone.toUpperCase()} &bull; [${cardVal}] vs Diff ${effDiff} (${executes ? 'BARRELED' : 'MISTIMED'})`;
        lockBtnDisabled = false;
      }
    }
  }

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      <!-- TOP HUD -->
      <header class="game-hud">
        ${renderScoreHeader(gs, half, g.rosters)}
        <div class="opponent-bar">
          <div class="opponent-profile">
            <div class="opp-avatar">${iAmBatting ? '⚾' : '🏏'}</div>
            <div class="opp-meta">
              <div class="opp-name">${oppName}</div>
              <div class="opp-role-tag">${oppRoleTag} · ${oppChar?.name || ''}</div>
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

      <!-- CENTER BATTLEFIELD -->
      <main class="battlefield">
        ${renderZoneBoard(pa, iAmBatting, myCommitted, pa.phase, null, pitcherChar, batterChar, gs)}
      </main>

      <!-- BOTTOM PLAYER DOCK -->
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
              <div class="opp-role-tag">${oppRoleTag} · ${oppChar?.name || ''}</div>
            </div>
          </div>
          <div class="opp-status-pill ready">REVEAL</div>
        </div>
      </header>

      <!-- CENTER MARVEL SNAP 3-ZONE BATTLEFIELD (REVEALED) -->
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
          <button class="btn-intel" onclick="toggleMatchupModal(true)">ℹ️ Intel</button>
        </div>

        <div class="hand-row">
          ${renderHand(localHand, battingRole === myRole, pitchingRole === myRole, true, currentBeat, pa?.firstRevealedCard, batterChar)}
        </div>
      </footer>

      <!-- OUTCOME MODAL OVERLAY (MARVEL SNAP DRAMATIC REVEAL) -->
      ${res ? renderOutcomeOverlay(res, battingRole === myRole) : ''}

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
  const countLabel = count === '0-2' ? "-2 Diff" : count === '3-1' ? "-2 Diff" : count === '3-2' ? "Full Count" : "Duel";

  return `
    <div class="scouting-report-bar">
      <!-- Pitcher Repertoire & Diff Strip -->
      <div class="scout-card pitcher-card">
        <div class="scout-header">
          <span class="scout-avatar">⚾</span>
          <span class="scout-name">${pName}</span>
        </div>
        <div class="scout-chips">
          <span class="scout-chip ${charges?.fastball > 0 ? '' : 'exhausted'}" title="Fastball: Diff ${pDiffs.fastball}">
            FB <b>${charges?.fastball ?? 0}</b> <small>(D${pDiffs.fastball})</small>
          </span>
          <span class="scout-chip ${charges?.breaking > 0 ? '' : 'exhausted'}" title="Breaking: Diff ${pDiffs.breaking}">
            BR <b>${charges?.breaking ?? 0}</b> <small>(D${pDiffs.breaking})</small>
          </span>
          <span class="scout-chip ${charges?.offspeed > 0 ? '' : 'exhausted'}" title="Offspeed: Diff ${pDiffs.offspeed}">
            OFF <b>${charges?.offspeed ?? 0}</b> <small>(D${pDiffs.offspeed})</small>
          </span>
        </div>
      </div>

      <!-- Center Count Badge -->
      <div class="scout-count-badge ${countBadgeClass}" title="Established Count">
        <span class="count-num">${count}</span>
        <span class="count-tag">${countLabel}</span>
      </div>

      <!-- Batter Tendencies & Diff Strip -->
      <div class="scout-card batter-card">
        <div class="scout-header">
          <span class="scout-avatar">🏏</span>
          <span class="scout-name">${bName}</span>
        </div>
        <div class="scout-chips">
          <span class="scout-chip hot" title="Hot Zone">
            HOT: <b>${bScout.hotZone.toUpperCase()}</b>
          </span>
          <span class="scout-chip cold" title="Cold Zone">
            COLD: <b>${bScout.coldZone.toUpperCase()}</b>
          </span>
          <span class="scout-chip fav" title="Favorite Pitch">
            FAV: <b>${bScout.favoritePitch.toUpperCase().slice(0, 3)}</b>
          </span>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER PAYOFF DECK (BEAT 2)
// ─────────────────────────────────────────────────────────────────────────────
function renderPitcherPayoffDeck(charges, localPitchType, localPitchLocation, bScout, pDiffs, count, cardObj, b1Data) {
  const isOffspeedLocked = (count === '3-1') || (b1Data?.lockedOption === 'offspeed');
  if (isOffspeedLocked && localPitchType === 'offspeed') {
    localPitchType = 'fastball';
  }

  const pitches = [
    { key: 'fastball', name: 'Fastball', icon: '🔥', baseDiff: pDiffs.fastball },
    { key: 'breaking', name: 'Breaking', icon: '🌀', baseDiff: pDiffs.breaking },
    { key: 'offspeed', name: 'Offspeed', icon: '⏱️', baseDiff: pDiffs.offspeed, locked: isOffspeedLocked },
  ];

  const locations = [
    { key: 'high', label: 'HIGH', icon: '⬆️', isHot: bScout.hotZone === 'high', isCold: bScout.coldZone === 'high' },
    { key: 'low',  label: 'LOW',  icon: '⬇️', isHot: bScout.hotZone === 'low',  isCold: bScout.coldZone === 'low' },
  ];

  const baseDiff = pDiffs[localPitchType] ?? 4;
  const effDiff = baseDiff;
  const cardVal = cardObj ? (cardObj.value || 0) : 0;
  const executes = cardObj ? (cardVal >= effDiff) : null;

  return `
    <div class="payoff-controls-deck">
      <!-- 1. Pitch Selection -->
      <div class="control-section">
        <div class="control-label">1. Pitch:</div>
        <div class="selection-tiles">
          ${pitches.map(p => {
            const countLeft = charges[p.key] ?? 0;
            const isSelected = (localPitchType === p.key);
            const isLocked = Boolean(p.locked);
            const isDisabled = countLeft <= 0 || isLocked;
            const pEffDiff = p.baseDiff;
            return `
              <button class="choice-tile ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''}"
                      onclick="${isLocked ? '' : `selectPitchType('${p.key}')`}" ${isDisabled ? 'disabled' : ''}>
                <div class="ct-header">
                  <span class="ct-icon">${isLocked ? '🔒' : p.icon}</span>
                  <span class="ct-count">${isLocked ? 'LOCKED' : `${countLeft} left`}</span>
                </div>
                <div class="ct-name">${p.name}</div>
                <div class="ct-diff">${isLocked ? '3-1 Count Lockout' : `Diff: <b>${pEffDiff}</b>`}</div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 2. Location Selection -->
      <div class="control-section">
        <div class="control-label">2. Target Location:</div>
        <div class="selection-tiles loc-tiles">
          ${locations.map(l => {
            const isSelected = (localPitchLocation === l.key);
            const tagHtml = l.isHot
              ? `<span class="intel-tag hot">⚠️ HOT</span>`
              : (l.isCold ? `<span class="intel-tag cold">🎯 COLD</span>` : '');
            return `
              <button class="choice-tile loc ${isSelected ? 'active' : ''}"
                      onclick="selectPitchLocation('${l.key}')">
                <div class="ct-header">
                  <span class="ct-icon">${l.icon}</span>
                  ${tagHtml}
                </div>
                <div class="ct-name">${l.label}</div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 3. Clean Execution Feedback -->
      <div class="exec-quick-bar ${executes === null ? 'waiting' : (executes ? 'pass' : 'fail')}">
        <span class="eq-label">${localPitchType.toUpperCase()} ${localPitchLocation.toUpperCase()}: Diff <b>${effDiff}</b></span>
        <span class="eq-status">${executes === null ? 'Pick a card below' : (executes ? '🟢 SPOT ON' : '🔴 HANGER')}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTER PAYOFF DECK (BEAT 2)
// ─────────────────────────────────────────────────────────────────────────────
function renderBatterPayoffDeck(localSwingType, localTargetZone, localGuessPitch, bScout, bDiffs, count, cardObj, b1Data) {
  const isPowerLocked = (count === '0-2') || (b1Data?.lockedOption === 'power');
  if (isPowerLocked && localSwingType === 'power') {
    localSwingType = 'balanced';
  }

  const isOffspeedLocked = (count === '3-1') || (b1Data?.lockedOption === 'offspeed');
  if (isOffspeedLocked && localGuessPitch === 'offspeed') {
    localGuessPitch = 'fastball';
  }

  const pitches = [
    { key: 'fastball', name: 'Fastball', icon: '🔥' },
    { key: 'breaking', name: 'Breaking', icon: '🌀' },
    { key: 'offspeed', name: 'Offspeed', icon: '⏱️', locked: isOffspeedLocked },
  ];

  const locations = [
    { key: 'high', label: 'HIGH', icon: '⬆️', isHot: bScout.hotZone === 'high', isCold: bScout.coldZone === 'high' },
    { key: 'low',  label: 'LOW',  icon: '⬇️', isHot: bScout.hotZone === 'low',  isCold: bScout.coldZone === 'low' },
  ];

  const swings = [
    { key: 'contact',  name: 'Contact',  icon: '🛡️', baseDiff: bDiffs.contact },
    { key: 'balanced', name: 'Balanced', icon: '⚖️', baseDiff: bDiffs.balanced },
    { key: 'power',    name: 'Power',    icon: '💥', baseDiff: bDiffs.power, locked: isPowerLocked },
  ];

  const baseDiff = bDiffs[localSwingType] ?? 5;
  const effDiff = baseDiff;
  const cardVal = cardObj ? (cardObj.value || 0) : 0;
  const executes = cardObj ? (cardVal >= effDiff) : null;

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
                ${isLocked ? `<div class="ct-sub" style="color:#ff6b81;font-size:0.5rem;font-weight:800;">3-1 Pitcher Lockout</div>` : ''}
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 2. Target Location -->
      <div class="control-section">
        <div class="control-label">2. Anticipate Location:</div>
        <div class="selection-tiles loc-tiles">
          ${locations.map(l => {
            const isSelected = (localTargetZone === l.key);
            const tagHtml = l.isHot
              ? `<span class="intel-tag hot">🔥 HOT ZONE</span>`
              : (l.isCold ? `<span class="intel-tag cold">❄️ COLD ZONE</span>` : '');
            return `
              <button class="choice-tile loc ${isSelected ? 'active' : ''}"
                      onclick="selectTargetZone('${l.key}')">
                <div class="ct-header">
                  <span class="ct-icon">${l.icon}</span>
                  ${tagHtml}
                </div>
                <div class="ct-name">${l.label}</div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 3. Swing Selection -->
      <div class="control-section">
        <div class="control-label">3. Swing Approach:</div>
        <div class="selection-tiles">
          ${swings.map(s => {
            const isSelected = (localSwingType === s.key);
            const isLocked = Boolean(s.locked);
            const isDisabled = isLocked;
            const sEffDiff = s.baseDiff;
            return `
              <button class="choice-tile ${isSelected ? 'active' : ''} ${isLocked ? 'locked disabled' : ''}"
                      onclick="${isLocked ? '' : `selectSwingType('${s.key}')`}" ${isDisabled ? 'disabled' : ''}>
                <div class="ct-header">
                  <span class="ct-icon">${isLocked ? '🔒' : s.icon}</span>
                  <span class="ct-diff">${isLocked ? 'LOCKED' : `Diff: <b>${sEffDiff}</b>`}</span>
                </div>
                <div class="ct-name">${s.name}</div>
                ${isLocked ? `<div class="ct-sub" style="color:#ff6b81;font-size:0.5rem;font-weight:800;">0-2 Count Lockout</div>` : ''}
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 4. Clean Execution Feedback -->
      <div class="exec-quick-bar ${executes === null ? 'waiting' : (executes ? 'pass' : 'fail')}">
        <span class="eq-label">Looking <b>${localGuessPitch.toUpperCase()} ${localTargetZone.toUpperCase()}</b> &bull; ${localSwingType.toUpperCase()} (Diff <b>${effDiff}</b>)</span>
        <span class="eq-status">${executes === null ? 'Pick a card below' : (executes ? '🟢 BARRELED' : '🔴 MISTIMED')}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE BOARD RENDERING (2-BEAT FLOW: COUNT DUEL & PAYOFF PITCH)
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

  // 1. Strategic scouting bar
  const scoutingBarHtml = renderPublicScoutingBar(pitcherChar, batterChar, charges, count);

  let mainContentHtml = '';

  if (revealed && res) {
    // ── REVEALED AT-BAT CLASH BREAKDOWN ──
    const z1 = res.z1 || b1Data;
    const z2 = res.z2;

    const b1WinnerLabel = z1?.winner === 'pitcher' ? "⚾ 0-2 Pitcher Count" : (z1?.winner === 'batter' ? "🏏 3-1 Hitter Count" : "⚖️ 3-2 Full Count");
    const pCardObj = z1?.pitcherCards?.[0] ? getCard(z1.pitcherCards[0]) : null;
    const bCardObj = z1?.batterCards?.[0] ? getCard(z1.batterCards[0]) : null;

    const pPayoffCard = z2?.pitcherCardId ? getCard(z2.pitcherCardId) : null;
    const bPayoffCard = z2?.batterCardId ? getCard(z2.batterCardId) : null;

    mainContentHtml = `
      <div class="battlefield-clash-board">
        <div class="clash-beat-header">
          <span class="cbh-tag">BEAT 1: ${b1WinnerLabel}</span>
          <div class="cbh-cards">
            <span>P: <b>[${pCardObj?.value ?? z1?.pitcherTotal ?? 0}]</b></span>
            <span>vs</span>
            <span>B: <b>[${bCardObj?.value ?? z1?.batterTotal ?? 0}]</b></span>
          </div>
        </div>

        ${z2 ? `
          <div class="payoff-clash-card">
            <div class="clash-matchup-header">
              <span class="cm-tag">💥 PAYOFF PITCH</span>
              <span class="cm-loc ${z2.sameLocation ? 'match' : 'diff'}">${z2.sameLocation ? '🎯 LOCATION MATCHED' : '❌ LOCATION MISSED'}</span>
            </div>

            <div class="clash-teams-row">
              <div class="clash-side pitcher">
                <div class="cs-label">⚾ Pitcher</div>
                <div class="cs-action">${(z2.pitchType || 'fastball').toUpperCase()} &bull; ${(z2.pitchLocation || 'high').toUpperCase()}</div>
                <div class="cs-exec ${z2.pitcherExecuted ? 'pass' : 'fail'}">
                  ${z2.pitcherExecuted ? '🟢 SPOT ON' : '🔴 HANGER'}
                </div>
                <div class="cs-card">Card: [${pPayoffCard?.value ?? z2.pitcherCardValue ?? '—'}]</div>
              </div>

              <div class="clash-vs-divider">VS</div>

              <div class="clash-side batter">
                <div class="cs-label">🏏 Batter</div>
                <div class="cs-action">${(z2.swingType || 'balanced').toUpperCase()} &bull; ${(z2.targetZone || 'high').toUpperCase()}</div>
                <div class="cs-exec ${z2.batterExecuted ? 'pass' : 'fail'}">
                  ${z2.batterExecuted ? '🟢 BARRELED' : '🔴 MISTIMED'}
                </div>
                <div class="cs-card">Card: [${bPayoffCard?.value ?? z2.batterCardValue ?? '—'}]</div>
              </div>
            </div>

            <div class="clash-outcome-badge">
              <span class="cob-title">${z2.outcomeDisplay || res.outcome?.display || 'Outcome Resolved'}</span>
            </div>
          </div>
        ` : `
          <div class="payoff-clash-card">
            <div class="clash-outcome-badge">
              <span class="cob-title">${res.outcome?.display || 'At-Bat Complete'}</span>
            </div>
          </div>
        `}
      </div>`;

  } else if (currentBeat === 'beat1') {
    // ── BEAT 1: THE COUNT BATTLE (SETUP) ──
    const myPlacedCardHtml = localBeatCard
      ? renderMiniPlacedCard(localBeatCard, 'z1', !myCommitted)
      : (!myCommitted
          ? `<div class="empty-drop-slot" onclick="if(selectedCard) selectBeatCard(selectedCard)">
               <span class="drop-hint">+ Pick a card below</span>
             </div>`
          : '<div class="empty-drop-slot" style="opacity:0.3;">—</div>');

    const oppSlotHtml = oppCommitted
      ? `<div class="hidden-opponent-card"><span class="mystery-mark">✓ READY</span></div>`
      : `<div class="hidden-opponent-card waiting"><span class="mystery-mark">⏳ DECIDING…</span></div>`;

    mainContentHtml = `
      <div class="beat1-arena">
        <div class="beat1-banner">
          <span class="b1-title">BEAT 1: THE COUNT BATTLE</span>
          <span class="b1-subtitle">High card wins count advantage &bull; Tie is 3-2 full count</span>
        </div>

        <div class="b1-cards-row">
          <div class="b1-card-slot opp">
            <span class="slot-role-tag">${iAmBatting ? '⚾ Pitcher Card' : '🏏 Batter Card'}</span>
            ${oppSlotHtml}
          </div>

          <div class="b1-vs-badge">VS</div>

          <div class="b1-card-slot mine">
            <span class="slot-role-tag">${iAmBatting ? '🏏 Your Card' : '⚾ Your Card'}</span>
            ${myPlacedCardHtml}
          </div>
        </div>
      </div>`;

  } else {
    // ── BEAT 2: THE PAYOFF PITCH ──
    const isDominant = Boolean(b1Data?.isDominant);
    const disAdvSide = b1Data?.revealCardFirst;
    const battingRole = (pitchingRole === 'host') ? 'guest' : 'host';
    const disAdvRole = (disAdvSide === 'pitcher') ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null);
    const isOppDisadvantaged = Boolean(disAdvRole && disAdvRole === oppKey);
    const amIDisadvantaged = Boolean(disAdvRole && disAdvRole === myKey);

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
            <span class="revealed-intel-badge">👁️ REVEALED INTEL &bull; FACE-UP</span>
            <span class="ri-title">${iAmBatting ? 'Pitcher' : 'Batter'} committed Card [${oppVal}]</span>
            <span class="ri-sub">You have complete information advantage!</span>
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

    const myPlacedCardHtml = localBeatCard
      ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted)
      : (!myCommitted
          ? `<div class="empty-drop-slot" onclick="if(selectedCard) selectBeatCard(selectedCard)">
               <span class="drop-hint">+ Pick execution card below</span>
             </div>`
          : '<div class="empty-drop-slot" style="opacity:0.3;">—</div>');

    mainContentHtml = `
      <div class="beat2-arena">
        ${disAdvNoticeHtml}
        <div class="b2-opp-strip">
          <span class="opp-role-label">${iAmBatting ? '⚾ Pitcher Move:' : '🏏 Batter Move:'}</span>
          ${oppSlotHtml}
        </div>

        <div class="b2-controls-wrapper">
          ${!iAmBatting
            ? renderPitcherPayoffDeck(charges, localPitchType, localPitchLocation, bScout, pDiffs, count, cardObj, b1Data)
            : renderBatterPayoffDeck(localSwingType, localTargetZone, localGuessPitch, bScout, bDiffs, count, cardObj, b1Data)}
        </div>

        <div class="b2-exec-slot-row">
          <div class="exec-slot-label">${amIDisadvantaged ? '⚠️ Face-Up Execution Card:' : 'Execution Card:'}</div>
          ${myPlacedCardHtml}
        </div>
      </div>`;
  }

  return `
    ${scoutingBarHtml}
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
               onclick="${isActive ? `selectCard('${id}')` : ''}"
               title="${isActive ? `Value: ${card.value}` : 'Cannot play this card'}">
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
          ? { pitchType: localPitchType, pitchLocation: localPitchLocation, cardId: localBeatCard }
          : { swingType: localSwingType, targetZone: localTargetZone, guessPitch: localGuessPitch, cardId: localBeatCard });

    const updates = {
      [`currentPA/beatPlacements/${currentBeat}/${myRole}`]: myBeatPlacement,
      [`currentPA/placement/${myRole}`]:                   updatedLocalPlacement,
      [`currentPA/committed/${myRole}`]:                   true,
      [`gameState/hands/${myRole}`]:                       newHand,
    };

    let shouldResolve = false;

    if (currentBeat === 'beat1') {
      if (isBot && myRole === 'host') {
        const botPlay = executeBotPlayBeat(liveGS, 'guest', 'beat1');
        const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[] }) };
        if (botPlay.cardId) {
          updatedBotPlacement.z1 = [botPlay.cardId];
        }

        updates['currentPA/beatPlacements/beat1/guest'] = { cardId: botPlay.cardId };
        updates['currentPA/placement/guest']           = updatedBotPlacement;
        updates['currentPA/committed/guest']           = true;
        updates['gameState/hands/guest']               = botPlay.botHand;
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
          const botPlay = executeBotPlayBeat(liveGS, 'guest', 'beat2', localBeatCard);
          const botIsPitching = (liveGS.half === 'bottom');
          const botBeatPlacement = botIsPitching
            ? { pitchType: botPlay.pitchType, pitchLocation: botPlay.pitchLocation, cardId: botPlay.cardId }
            : { swingType: botPlay.swingType, targetZone: botPlay.targetZone, guessPitch: botPlay.guessPitch, cardId: botPlay.cardId };

          const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[] }) };
          if (botPlay.cardId) {
            updatedBotPlacement.z2 = [botPlay.cardId];
          }

          updates['currentPA/beatPlacements/beat2/guest'] = botBeatPlacement;
          updates['currentPA/placement/guest']           = updatedBotPlacement;
          updates['currentPA/committed/guest']           = true;
          updates['gameState/hands/guest']               = botPlay.botHand;
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
        const pitchLocation = pPlacements.pitchLocation || 'high';

        const batterCardId = bPlacements.cardId || null;
        const swingType = bPlacements.swingType || 'balanced';
        const targetZone = bPlacements.targetZone || 'high';
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
          pitchLocation,
          pitcherCardId,
          guessPitch,
          swingType,
          targetZone,
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
        localPitchLocation = 'high';
        localGuessPitch  = 'fastball';
        localSwingType   = 'balanced';
        localTargetZone  = 'high';
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
        ? `🔥 <b>Dominant Win (+${margin})!</b> Batter's <b>Power Swing is LOCKED OUT</b>, and Batter must commit their execution card <b>FACE-UP FIRST</b>!`
        : `⚠️ <b>Dominant Loss (+${margin})!</b> Your <b>Power Swing is LOCKED OUT</b>, and you must commit your execution card <b>FACE-UP FIRST</b>!`;
    } else {
      explanation = isPitcherMe
        ? `Pitcher won the count battle! Batter's <b>Power Swing is LOCKED OUT</b> (cannot hit home runs on clean pitches).`
        : `Opponent won the count battle! Your <b>Power Swing is LOCKED OUT</b> (forced to choose Contact or Balanced).`;
    }
  } else if (winner === 'batter') {
    countTitle = "3-1 HITTER'S COUNT";
    bannerClass = 'count-hitter';
    winnerTag = !isPitcherMe ? '🎉 YOU WON COUNT' : '⚠️ OPPONENT WON COUNT';
    if (isDominant) {
      explanation = !isPitcherMe
        ? `🔥 <b>Dominant Win (+${margin})!</b> Pitcher's <b>Offspeed is LOCKED OUT</b>, and Pitcher must commit their execution card <b>FACE-UP FIRST</b>!`
        : `⚠️ <b>Dominant Loss (+${margin})!</b> Your <b>Offspeed is LOCKED OUT</b>, and you must commit your execution card <b>FACE-UP FIRST</b>!`;
    } else {
      explanation = !isPitcherMe
        ? `Batter won the count battle! Pitcher's <b>Offspeed is LOCKED OUT</b> (forced to challenge with Fastball or Breaking).`
        : `Opponent won the count battle! Your <b>Offspeed is LOCKED OUT</b> (changeups eliminated).`;
    }
  }

  return `
    <div class="result-modal-overlay" id="beat1-result-modal">
      <div class="result-modal-card">
        <div class="rm-header">
          <span class="rm-tag">BEAT 1 RESULT &bull; THE COUNT</span>
          <span class="rm-suspense-label">⚡ COUNT DUEL REVEAL</span>
          <span class="rm-winner-pill ${bannerClass}">${winnerTag}</span>
        </div>

        <div class="rm-cards-compare">
          <div class="rm-player-box anticipate-flip-p">
            <span class="rm-role">⚾ Pitcher</span>
            <div class="number-card sm selected">
              <span class="card-hero-num">${pVal}</span>
            </div>
          </div>
          <div class="rm-vs anticipate-vs">VS</div>
          <div class="rm-player-box anticipate-flip-b">
            <span class="rm-role">🏏 Batter</span>
            <div class="number-card sm selected">
              <span class="card-hero-num">${bVal}</span>
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
  gameRef().once('value', snap => {
    const g = snap.val();
    if (!g) return;
    const pa = g.currentPA || {};
    const gs = g.gameState || {};
    const isBot = Boolean(g.isSolo || g.guest?.isBot);
    const half = gs.half || 'top';
    const pitchingRole = half === 'top' ? 'host' : 'guest';
    const battingRole  = half === 'top' ? 'guest' : 'host';
    const b1 = pa.beatResults?.beat1 || {};

    const updates = {
      'currentPA/phase': 'placing',
      'currentPA/beat': 'beat2',
      'currentPA/committed/host': false,
      'currentPA/committed/guest': false,
      'currentPA/firstRevealedCard': null,
    };

    // If dominant beat, check if Bot is the disadvantaged player who must play first!
    if (isBot && b1.isDominant) {
      const disAdvSide = b1.revealCardFirst; // 'pitcher' or 'batter'
      const disAdvRole = (disAdvSide === 'pitcher' ? pitchingRole : (disAdvSide === 'batter' ? battingRole : null));
      if (disAdvRole === 'guest') {
        const botPlay = executeBotPlayBeat(gs, 'guest', 'beat2');
        const botIsPitching = (half === 'bottom');
        const botBeatPlacement = botIsPitching
          ? { pitchType: botPlay.pitchType, pitchLocation: botPlay.pitchLocation, cardId: botPlay.cardId }
          : { swingType: botPlay.swingType, targetZone: botPlay.targetZone, guessPitch: botPlay.guessPitch, cardId: botPlay.cardId };

        const updatedBotPlacement = { ...(pa.placement?.guest || { z1:[], z2:[] }) };
        if (botPlay.cardId) {
          updatedBotPlacement.z2 = [botPlay.cardId];
        }

        updates['currentPA/beatPlacements/beat2/guest'] = botBeatPlacement;
        updates['currentPA/placement/guest']           = updatedBotPlacement;
        updates['currentPA/committed/guest']           = true;
        updates['currentPA/firstRevealedCard']         = botPlay.cardId;
        updates['gameState/hands/guest']               = botPlay.botHand;
      }
    }

    gameRef().update(updates).catch(err => {
      console.error('proceedToBeat2 error:', err);
    });
  });
}
window.proceedToBeat2 = proceedToBeat2;

function renderOutcomeOverlay(res, isBatting = false) {
  if (!res?.outcome) return '';
  const o = res.outcome;
  const z1 = res.z1;
  const z2 = res.z2;

  const runsScored = o.runsScored || 0;
  const outsAdded = o.outsAdded || 0;

  // Pitcher recap
  const pCard = z2?.pitcherCardId ? getCard(z2.pitcherCardId) : (z1?.pitcherCards?.[0] ? getCard(z1.pitcherCards[0]) : null);
  const pVal = pCard?.value ?? z2?.pitcherCardValue ?? z1?.pitcherTotal ?? '—';
  const pPitch = z2?.pitchType ? z2.pitchType.toUpperCase() : 'FASTBALL';
  const pLoc = z2?.pitchLocation ? z2.pitchLocation.toUpperCase() : 'HIGH';
  const pExec = z2?.pitcherExecuted ?? true;
  const pExecText = pExec ? 'Spot On ✓' : 'Hanger ⚠️';

  // Batter recap
  const bCard = z2?.batterCardId ? getCard(z2.batterCardId) : (z1?.batterCards?.[0] ? getCard(z1.batterCards[0]) : null);
  const bVal = bCard?.value ?? z2?.batterCardValue ?? z1?.batterTotal ?? '—';
  const bSwing = z2?.swingType ? z2.swingType.toUpperCase() : 'BALANCED';
  const bZone = z2?.targetZone ? z2.targetZone.toUpperCase() : 'HIGH';
  const bGuess = z2?.guessPitch ? z2.guessPitch.toUpperCase() : 'FASTBALL';
  const bExec = z2?.batterExecuted ?? true;
  const bExecText = bExec ? 'Barreled ✓' : 'Mistimed ⚠️';

  const matchTier = z2?.matchTier || (z2?.sameLocation ? 'partial' : 'whiff');
  const pitchMatched = Boolean(z2?.pitchMatched);
  const locMatched = Boolean(z2?.locationMatched ?? z2?.sameLocation);

  let deductionBadgeHtml = '';
  if (matchTier === 'full') {
    deductionBadgeHtml = `<span class="deduction-badge full">🎯 READ LIKE A BOOK (PITCH &amp; ZONE)</span>`;
  } else if (matchTier === 'partial') {
    if (pitchMatched) {
      deductionBadgeHtml = `<span class="deduction-badge partial">🔍 PITCH TIMED (${pPitch}) &bull; ZONE MISSED</span>`;
    } else {
      deductionBadgeHtml = `<span class="deduction-badge partial">🔍 ZONE READ (${pLoc}) &bull; FOOLED BY PITCH</span>`;
    }
  } else {
    deductionBadgeHtml = `<span class="deduction-badge whiff">❌ COMPLETELY FOOLED (WRONG PITCH &amp; ZONE)</span>`;
  }

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
            <span class="recap-label">⚾ Pitch:</span>
            <span class="recap-val"><b>${pPitch} &bull; ${pLoc}</b> [${pVal}] &bull; <span class="${pExec ? 'pass' : 'fail'}">${pExecText}</span></span>
          </div>
          <div class="recap-row anticipate-b-action">
            <span class="recap-label">🏏 Swing:</span>
            <span class="recap-val"><b>${bSwing}</b> (Anticipated <b>${bGuess} ${bZone}</b>) [${bVal}] &bull; <span class="${bExec ? 'pass' : 'fail'}">${bExecText}</span></span>
          </div>
          ${z2 ? `
            <div class="recap-row anticipate-matchup">
              <span class="recap-label">🎯 Deduction:</span>
              <span class="recap-val">${deductionBadgeHtml}</span>
            </div>
          ` : ''}
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
