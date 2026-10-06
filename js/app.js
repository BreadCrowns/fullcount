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

function selectSwingType(swing) {
  localSwingType = swing;
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectSwingType = selectSwingType;

function selectTargetZone(zone) {
  localTargetZone = zone;
  localGuessChoice = (zone === 'high') ? 'fastball' : 'breaking';
  const g = window._lastGameState;
  if (g) renderPlay(g);
}
window.selectTargetZone = selectTargetZone;
window.selectBatterGuess = function(guess) {
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
    case 'placing':  renderPlacing(g, gs, pa, iAmBatting, iAmPitching, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'reveal':   renderReveal(g, gs, pa, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
    case 'resolved': renderResolved(g, gs, pa, myPitcherChar, currentBatterChar, pitchingRole, battingRole, half); break;
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
      lockBtnLabel = 'CHOOSE COUNT CARD';
      lockBtnSub = 'Pick 1 card from hand';
      lockBtnDisabled = true;
    } else {
      const cardObj = getCard(localBeatCard);
      lockBtnLabel = 'LOCK IN COUNT CARD';
      lockBtnSub = `${cardObj?.name || 'Card'} (Pwr +${cardObj?.value || 0})`;
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
        lockBtnLabel = 'CHOOSE PITCH CARD';
        lockBtnSub = `${localPitchType.toUpperCase()} ${localPitchLocation.toUpperCase()} &bull; Diff ${effDiff}`;
        lockBtnDisabled = true;
      } else {
        lockBtnLabel = 'LOCK IN PAYOFF PITCH';
        lockBtnSub = `${localPitchType.toUpperCase()} ${localPitchLocation.toUpperCase()} &bull; Pwr ${cardVal} vs Diff ${effDiff} (${executes ? 'SPOT ON' : 'HANGER'})`;
        lockBtnDisabled = false;
      }
    } else {
      const baseDiff = batterChar?.swingDifficulties?.[localSwingType] ?? 5;
      const countDisc = (b1?.count === '3-1') ? 2 : 0;
      const effDiff = Math.max(1, baseDiff - countDisc);
      const executes = localBeatCard ? (cardVal >= effDiff) : false;

      if (!localBeatCard) {
        lockBtnLabel = 'CHOOSE SWING CARD';
        lockBtnSub = `${localSwingType.toUpperCase()} ${localTargetZone.toUpperCase()} &bull; Diff ${effDiff}`;
        lockBtnDisabled = true;
      } else {
        lockBtnLabel = 'LOCK IN PAYOFF SWING';
        lockBtnSub = `${localSwingType.toUpperCase()} ${localTargetZone.toUpperCase()} &bull; Pwr ${cardVal} vs Diff ${effDiff} (${executes ? 'BARRELED' : 'MISTIMED'})`;
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
          <div class="opponent-profile" onclick="toggleMatchupModal(true)" title="View Matchup Details">
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

      <!-- CENTER 2-ZONE BATTLEFIELD -->
      <main class="battlefield">
        ${renderZoneBoard(pa, iAmBatting, myCommitted, 'placing', null, pitcherChar, batterChar, gs)}
      </main>

      <!-- BOTTOM PLAYER DOCK -->
      <footer class="player-dock">
        <div class="player-bar">
          <div class="player-profile" onclick="toggleMatchupModal(true)" title="View Character Intel">
            <div class="my-avatar">${iAmBatting ? '🏏' : '⚾'}</div>
            <div class="my-details">
              <span class="my-role-badge ${iAmBatting ? 'batting' : 'pitching'}">${iAmBatting ? 'YOU ARE BATTING' : 'YOU ARE PITCHING'}</span>
              <span class="my-char-name">${myChar?.name || ''}</span>
            </div>
          </div>
          <div class="dock-controls-row">
            <span class="placed-indicator">Beat: <b>${currentBeat === 'beat1' ? '1 (Count Battle)' : '2 (Payoff Pitch)'}</b> · Card: <b>${localBeatCard ? '1' : '0'}</b>/1</span>
            ${canSub ? `<button class="btn-relief" onclick="substitutePitcher('${reliefId}')">Relief</button>` : ''}
            <button class="btn-intel" onclick="toggleMatchupModal(true)">ℹ️ Intel</button>
          </div>
        </div>

        <!-- HAND + TURN ACTION BUTTON -->
        <div class="hand-row">
          ${renderHand(localHand, iAmBatting, iAmPitching, myCommitted, currentBeat, pa?.firstRevealedCard, batterChar)}
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

      <!-- MATCHUP INTEL DRAWER -->
      ${renderMatchupDrawer(pitcherChar, staminaState, gs.pitcherPAs[pitchingRole], iAmPitching, g.rosters[pitchingRole].reliefPitcher, gs.activePitcher[pitchingRole], batterChar, battingRole === myRole, score, gs, half)}
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
  const bDiffs = batterChar?.swingDifficulties || { contact: 3, balanced: 5, power: 8 };

  const pName = pitcherChar?.name || 'Pitcher';
  const bName = batterChar?.name || 'Batter';

  const countBadgeClass = count === '0-2' ? 'count-pitcher' : count === '3-1' ? 'count-hitter' : count === '3-2' ? 'count-full' : 'count-duel';
  const countLabel = count === '0-2' ? "0-2 (Pitcher -2 Diff)" : count === '3-1' ? "3-1 (Hitter -2 Diff)" : count === '3-2' ? "3-2 FULL COUNT" : "0-0 COUNT DUEL";

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
            🔥 FB <b>${pDiffs.fastball}</b> <small>(${charges?.fastball ?? 0})</small>
          </span>
          <span class="scout-chip ${charges?.breaking > 0 ? '' : 'exhausted'}" title="Breaking: Diff ${pDiffs.breaking}">
            🌀 BRK <b>${pDiffs.breaking}</b> <small>(${charges?.breaking ?? 0})</small>
          </span>
          <span class="scout-chip ${charges?.offspeed > 0 ? '' : 'exhausted'}" title="Offspeed: Diff ${pDiffs.offspeed}">
            ⏱️ OFF <b>${pDiffs.offspeed}</b> <small>(${charges?.offspeed ?? 0})</small>
          </span>
        </div>
      </div>

      <!-- Center Count Badge -->
      <div class="scout-count-badge ${countBadgeClass}" title="Established Count for Payoff Pitch">
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
          <span class="scout-chip hot" title="Hot Zone: High power / HR danger zone">
            🔥 HOT: <b>${bScout.hotZone.toUpperCase()}</b>
          </span>
          <span class="scout-chip cold" title="Cold Zone: Weak contact / Out zone">
            ❄️ COLD: <b>${bScout.coldZone.toUpperCase()}</b>
          </span>
          <span class="scout-chip fav" title="Favorite Pitch: Extra batter contact power">
            ⭐ FAV: <b>${bScout.favoritePitch.toUpperCase().slice(0, 3)}</b>
          </span>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION DIFFICULTY GAUGE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function renderExecutionGauge(label, baseDiff, countDisc, cardVal, isPitcher = true) {
  const effDiff = Math.max(1, baseDiff - countDisc);
  const executed = (cardVal >= effDiff);

  const statusClass = executed ? 'exec-pass' : 'exec-fail';
  const statusText = isPitcher
    ? (executed ? '🟢 SPOT ON (Clean Execution)' : '🔴 HANGER (Missed Location)')
    : (executed ? '🟢 BARRELED UP (Crushed Contact)' : '🔴 MISTIMED (Weak Swing)');

  return `
    <div class="exec-gauge">
      <div class="exec-gauge-top">
        <span class="eg-title">${label}</span>
        <span class="eg-formula">Base ${baseDiff}${countDisc > 0 ? ` &minus; ${countDisc} Count` : ''} = <b>Diff ${effDiff}</b></span>
      </div>
      <div class="exec-meter-track">
        <div class="exec-meter-fill ${statusClass}" style="width: ${Math.min(100, Math.max(12, (cardVal / 10) * 100))}%;"></div>
        <div class="exec-target-marker" style="left: ${Math.min(95, Math.max(5, (effDiff / 10) * 100))}%;" title="Difficulty threshold: ${effDiff}">
          <span class="exec-target-label">Diff ${effDiff}</span>
        </div>
      </div>
      <div class="exec-gauge-status ${statusClass}">
        <span class="eg-val">Card Power: <b>+${cardVal}</b></span>
        <span class="eg-badge">${statusText}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER PAYOFF DECK (BEAT 2)
// ─────────────────────────────────────────────────────────────────────────────
function renderPitcherPayoffDeck(charges, localPitchType, localPitchLocation, bScout, pDiffs, count, cardObj) {
  const pitches = [
    { key: 'fastball', name: 'Fastball', icon: '🔥', diff: pDiffs.fastball },
    { key: 'breaking', name: 'Breaking', icon: '🌀', diff: pDiffs.breaking },
    { key: 'offspeed', name: 'Offspeed', icon: '⏱️', diff: pDiffs.offspeed },
  ];

  const locations = [
    { key: 'high', label: 'HIGH ZONE', icon: '⬆️', isHot: bScout.hotZone === 'high', isCold: bScout.coldZone === 'high' },
    { key: 'low',  label: 'LOW ZONE',  icon: '⬇️', isHot: bScout.hotZone === 'low',  isCold: bScout.coldZone === 'low' },
  ];

  const baseDiff = pDiffs[localPitchType] ?? 4;
  const countDisc = (count === '0-2') ? 2 : 0;
  const cardVal = cardObj ? (cardObj.value || 0) : 0;

  return `
    <div class="payoff-controls-deck">
      <!-- 1. Pitch Selection -->
      <div class="control-section">
        <div class="control-label">1. Choose Pitch Type:</div>
        <div class="selection-tiles">
          ${pitches.map(p => {
            const countLeft = charges[p.key] ?? 0;
            const isSelected = (localPitchType === p.key);
            const isDisabled = countLeft <= 0;
            return `
              <button class="choice-tile ${isSelected ? 'active' : ''} ${isDisabled ? 'disabled' : ''}"
                      onclick="selectPitchType('${p.key}')" ${isDisabled ? 'disabled' : ''}>
                <div class="ct-header">
                  <span class="ct-icon">${p.icon}</span>
                  <span class="ct-count">${countLeft} left</span>
                </div>
                <div class="ct-name">${p.name}</div>
                <div class="ct-diff">Diff: <b>${p.diff}</b></div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 2. Location Selection -->
      <div class="control-section">
        <div class="control-label">2. Target Pitch Location:</div>
        <div class="selection-tiles loc-tiles">
          ${locations.map(l => {
            const isSelected = (localPitchLocation === l.key);
            const tagHtml = l.isHot
              ? `<span class="intel-tag hot">⚠️ BATTER HOT</span>`
              : (l.isCold ? `<span class="intel-tag cold">🎯 BATTER COLD</span>` : '');
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

      <!-- 3. Live Execution Preview Gauge -->
      ${renderExecutionGauge(`Pitch Execution (${localPitchType.toUpperCase()} ${localPitchLocation.toUpperCase()})`, baseDiff, countDisc, cardVal, true)}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTER PAYOFF DECK (BEAT 2)
// ─────────────────────────────────────────────────────────────────────────────
function renderBatterPayoffDeck(localSwingType, localTargetZone, bScout, bDiffs, count, cardObj) {
  const swings = [
    { key: 'contact',  name: 'Contact',  icon: '🛡️', diff: bDiffs.contact,  sub: 'Protect / Slap' },
    { key: 'balanced', name: 'Balanced', icon: '⚖️', diff: bDiffs.balanced, sub: 'Line Drive' },
    { key: 'power',    name: 'Power',    icon: '💥', diff: bDiffs.power,    sub: 'Home Run' },
  ];

  const locations = [
    { key: 'high', label: 'HIGH ZONE', icon: '⬆️', isHot: bScout.hotZone === 'high', isCold: bScout.coldZone === 'high' },
    { key: 'low',  label: 'LOW ZONE',  icon: '⬇️', isHot: bScout.hotZone === 'low',  isCold: bScout.coldZone === 'low' },
  ];

  const baseDiff = bDiffs[localSwingType] ?? 5;
  const countDisc = (count === '3-1') ? 2 : 0;
  const cardVal = cardObj ? (cardObj.value || 0) : 0;

  return `
    <div class="payoff-controls-deck">
      <!-- 1. Swing Approach Selection -->
      <div class="control-section">
        <div class="control-label">1. Choose Swing Approach:</div>
        <div class="selection-tiles">
          ${swings.map(s => {
            const isSelected = (localSwingType === s.key);
            return `
              <button class="choice-tile ${isSelected ? 'active' : ''}"
                      onclick="selectSwingType('${s.key}')">
                <div class="ct-header">
                  <span class="ct-icon">${s.icon}</span>
                  <span class="ct-diff">Diff: <b>${s.diff}</b></span>
                </div>
                <div class="ct-name">${s.name}</div>
                <div class="ct-sub">${s.sub}</div>
              </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 2. Target Zone Selection -->
      <div class="control-section">
        <div class="control-label">2. Anticipate Pitch Location:</div>
        <div class="selection-tiles loc-tiles">
          ${locations.map(l => {
            const isSelected = (localTargetZone === l.key);
            const tagHtml = l.isHot
              ? `<span class="intel-tag hot">🔥 YOUR HOT ZONE</span>`
              : (l.isCold ? `<span class="intel-tag cold">❄️ YOUR COLD ZONE</span>` : '');
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

      <!-- 3. Live Execution Preview Gauge -->
      ${renderExecutionGauge(`Swing Execution (${localSwingType.toUpperCase()} ${localTargetZone.toUpperCase()})`, baseDiff, countDisc, cardVal, false)}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE BOARD RENDERING (2-BEAT FLOW: COUNT DUEL & PAYOFF PITCH)
// ─────────────────────────────────────────────────────────────────────────────
function setViewZone(zoneKey) {
  window.selectedViewZone = zoneKey;
  if (window._lastGameState) {
    handleGameState(window._lastGameState);
  }
}

function renderZoneBoard(pa, iAmBatting, myCommitted, phase, res, pitcherChar, batterChar, gs) {
  const myKey  = myRole;
  const oppKey = opponentRole();
  const revealed = phase === 'reveal' || phase === 'resolved';

  const half = (revealed && res?.half) ? res.half : (gs?.half || 'top');
  const pitchingRole = half === 'top' ? 'host' : 'guest';
  const battingRole  = half === 'top' ? 'guest' : 'host';
  const charges = gs?.arsenalCharges?.[pitchingRole] || pitcherChar?.repertoire || { fastball: 4, breaking: 3, offspeed: 2 };
  const currentBeat = pa?.beat || 'beat1';

  const b1Data = res?.z1 || pa?.beatResults?.beat1;
  const count = b1Data?.count || (currentBeat === 'beat1' ? '0-0' : '3-2');

  const pDiffs = pitcherChar?.executionDifficulties || { fastball: 3, breaking: 5, offspeed: 8 };
  const bScout = batterChar?.scoutingReport || { hotZone: 'high', coldZone: 'low', favoritePitch: 'fastball' };
  const bDiffs = batterChar?.swingDifficulties || { contact: 3, balanced: 5, power: 8 };

  const oppCommitted = Boolean(pa?.committed?.[oppKey]);
  const cardObj = localBeatCard ? getCard(localBeatCard) : null;

  // Track active beat view (allows inspecting Beat 1 when in Beat 2)
  let activeBeatView = window.selectedViewZone === 'z1' ? 'beat1' : (window.selectedViewZone === 'z2' ? 'beat2' : currentBeat);
  if (revealed && !window.selectedViewZone) {
    activeBeatView = 'resolved';
  }

  // 1. Public Scouting Report Bar (Always accessible, clearly visible)
  const scoutingBarHtml = renderPublicScoutingBar(pitcherChar, batterChar, charges, count);

  // 2. Beat Step Navigation Bar
  const b1Done = Boolean(pa?.beatResults?.beat1 || (revealed && res?.z1));
  const b2Done = Boolean(pa?.beatResults?.beat2 || (revealed && res?.z2));

  const beatStepBar = `
    <div class="beat-step-tracker">
      <div class="beat-step ${activeBeatView === 'beat1' ? 'active' : b1Done ? 'done' : ''}"
           onclick="setViewZone('z1')"
           title="Beat 1: The Count Battle"
           style="cursor:pointer;">
        <span class="step-num">${b1Done ? '✓' : '1'}</span>
        <span class="step-label">Beat 1: Count Battle</span>
      </div>
      <div class="beat-step-arrow">&rarr;</div>
      <div class="beat-step ${activeBeatView === 'beat2' ? 'active' : b2Done ? 'done' : ''}"
           ${(b1Done || currentBeat === 'beat2' || revealed) ? 'onclick="setViewZone(\'z2\')" style="cursor:pointer;"' : 'style="opacity:0.4;cursor:not-allowed;"'}
           title="${(b1Done || currentBeat === 'beat2' || revealed) ? 'Beat 2: The Payoff Pitch' : 'Locked until Beat 1 resolves'}">
        <span class="step-num">${b2Done ? '✓' : '2'}</span>
        <span class="step-label">Beat 2: Payoff Pitch</span>
      </div>
    </div>`;

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
        <!-- Beat 1 Recap Header -->
        <div class="clash-beat-header">
          <span class="cbh-tag">BEAT 1 RESULT: ${b1WinnerLabel}</span>
          <div class="cbh-cards">
            <span>P: <b>${pCardObj?.name || 'Card'} (+${z1?.pitcherTotal ?? 0})</b></span>
            <span>vs</span>
            <span>B: <b>${bCardObj?.name || 'Card'} (+${z1?.batterTotal ?? 0})</b></span>
          </div>
        </div>

        <!-- Beat 2 Payoff Pitch Clash Details -->
        ${z2 ? `
          <div class="payoff-clash-card">
            <div class="clash-matchup-header">
              <span class="cm-tag">💥 THE PAYOFF PITCH</span>
              <span class="cm-loc ${z2.sameLocation ? 'match' : 'diff'}">${z2.sameLocation ? '🎯 LOCATION MATCHED!' : '❌ LOCATION MISSED'}</span>
            </div>

            <div class="clash-teams-row">
              <!-- Pitcher Side -->
              <div class="clash-side pitcher">
                <div class="cs-label">⚾ ${res.pitcherCharName || 'Pitcher'}</div>
                <div class="cs-action">${(z2.pitchType || 'fastball').toUpperCase()} &bull; ${(z2.pitchLocation || 'high').toUpperCase()}</div>
                <div class="cs-exec ${z2.pitcherExecuted ? 'pass' : 'fail'}">
                  ${z2.pitcherExecuted ? '🟢 SPOT ON' : '🔴 HANGER'}
                </div>
                <div class="cs-card">${pPayoffCard ? `${pPayoffCard.name} (+${pPayoffCard.value})` : '—'}</div>
              </div>

              <div class="clash-vs-divider">VS</div>

              <!-- Batter Side -->
              <div class="clash-side batter">
                <div class="cs-label">🏏 ${res.batterCharName || 'Batter'}</div>
                <div class="cs-action">${(z2.swingType || 'balanced').toUpperCase()} &bull; ${(z2.targetZone || 'high').toUpperCase()}</div>
                <div class="cs-exec ${z2.batterExecuted ? 'pass' : 'fail'}">
                  ${z2.batterExecuted ? '🟢 BARRELED UP' : '🔴 MISTIMED'}
                </div>
                <div class="cs-card">${bPayoffCard ? `${bPayoffCard.name} (+${bPayoffCard.value})` : '—'}</div>
              </div>
            </div>

            <!-- Hot/Cold Factor Tag -->
            ${z2.isHotZone ? `<div class="clash-zone-note hot">🔥 Pitch thrown into Batter's Hot Zone (+Power!)</div>` : ''}
            ${z2.isColdZone ? `<div class="clash-zone-note cold">❄️ Pitch thrown into Batter's Cold Zone (Pitcher Advantage!)</div>` : ''}
            ${z2.isFavoritePitch ? `<div class="clash-zone-note fav">⭐ Pitch was Batter's Favorite Pitch!</div>` : ''}

            <!-- Outcome Callout -->
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

  } else if (activeBeatView === 'beat1') {
    // ── BEAT 1: THE COUNT BATTLE (SETUP) ──
    const myPlacedCardHtml = localBeatCard
      ? renderMiniPlacedCard(localBeatCard, 'z1', !myCommitted, 0)
      : (!myCommitted
          ? `<div class="board-slot empty-drop ${selectedCard ? 'pulse-ready' : ''}" onclick="selectBeatCard(selectedCard)">
               <span style="font-size:0.75rem;font-weight:800;">+ Select 1 Card from Hand</span>
             </div>`
          : '<div class="board-slot empty-drop" style="opacity:0.3;">—</div>');

    const oppSlotHtml = oppCommitted
      ? `<div class="hidden-opponent-card"><span class="mystery-mark">✓ OPPONENT READY</span></div>`
      : `<div class="board-slot empty-drop" style="opacity:0.4;cursor:default;font-size:0.7rem;">⏳ Opponent Choosing...</div>`;

    mainContentHtml = `
      <div class="beat1-arena">
        <!-- Opponent Slot -->
        <div class="b1-slot-container opponent">
          <div class="slot-role-tag">${iAmBatting ? '⚾ Pitcher Card (Secret)' : '🏏 Batter Card (Secret)'}</div>
          ${oppSlotHtml}
        </div>

        <!-- Center Count Meter / Instructions -->
        <div class="b1-duel-center">
          <div class="b1-duel-title">⚔️ COUNT ADVANTAGE BATTLE</div>
          <div class="b1-duel-pills">
            <div class="b1-count-tier pitcher">0-2 Count<small>Pitcher Wins</small></div>
            <div class="b1-count-tier tie">3-2 Full Count<small>Even Battle</small></div>
            <div class="b1-count-tier batter">3-1 Count<small>Hitter Wins</small></div>
          </div>
          <div class="b1-duel-hint">
            <b>Hand Economy:</b> Both players commit 1 card face down. Highest card wins the count. <b>Played cards are discarded</b> for Beat 2!
          </div>
        </div>

        <!-- Player Slot -->
        <div class="b1-slot-container mine">
          <div class="slot-role-tag">${iAmBatting ? '🏏 Your Count Card' : '⚾ Your Count Card'}</div>
          ${myPlacedCardHtml}
        </div>
      </div>`;

  } else {
    // ── BEAT 2: THE PAYOFF PITCH ──
    const oppSlotHtml = oppCommitted
      ? `<div class="hidden-opponent-card"><span class="mystery-mark">✓ OPPONENT LOCKED IN</span></div>`
      : `<div class="board-slot empty-drop" style="opacity:0.4;cursor:default;font-size:0.7rem;">⏳ Opponent Planning Move...</div>`;

    const myPlacedCardHtml = localBeatCard
      ? renderMiniPlacedCard(localBeatCard, 'z2', !myCommitted, 0)
      : (!myCommitted
          ? `<div class="board-slot empty-drop ${selectedCard ? 'pulse-ready' : ''}" onclick="selectBeatCard(selectedCard)">
               <span style="font-size:0.75rem;font-weight:800;">+ Select Execution Card</span>
             </div>`
          : '<div class="board-slot empty-drop" style="opacity:0.3;">—</div>');

    mainContentHtml = `
      <div class="beat2-arena">
        <!-- Opponent Status -->
        <div class="b2-opp-strip">
          <span class="opp-role-label">${iAmBatting ? '⚾ Pitcher Move:' : '🏏 Batter Move:'}</span>
          ${oppSlotHtml}
        </div>

        <!-- Player Controls: Pitcher vs Batter -->
        <div class="b2-player-deck">
          ${!iAmBatting
            ? renderPitcherPayoffDeck(charges, localPitchType, localPitchLocation, bScout, pDiffs, count, cardObj)
            : renderBatterPayoffDeck(localSwingType, localTargetZone, bScout, bDiffs, count, cardObj)}
        </div>

        <!-- Player Execution Card Slot -->
        <div class="b2-my-slot-section">
          <div class="slot-role-label">Your Payoff Card:</div>
          ${myPlacedCardHtml}
        </div>
      </div>`;
  }

  return `
    ${scoutingBarHtml}
    ${beatStepBar}
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

function getCardBeatLabel(card) {
  if (!card) return 'UNI';
  if (card.zone === 'read') return 'BEAT 1';
  if (card.zone === 'contact' || card.zone === 'result') return 'BEAT 2';
  return 'UNI';
}
window.getCardBeatLabel = getCardBeatLabel;

let _holdTimer = null;
let _holdCardId = null;
let _isHolding = false;
let _holdStartX = 0;
let _holdStartY = 0;

function startCardHold(cardId, e) {
  _holdCardId = cardId;
  _isHolding = false;
  if (e && e.clientX !== undefined) {
    _holdStartX = e.clientX;
    _holdStartY = e.clientY;
  }
  clearTimeout(_holdTimer);
  _holdTimer = setTimeout(() => {
    _isHolding = true;
    if (navigator.vibrate) navigator.vibrate(35);
    showCardMagnifier(cardId);
  }, 350);
}
window.startCardHold = startCardHold;

function cancelCardHold(e) {
  clearTimeout(_holdTimer);
}
window.cancelCardHold = cancelCardHold;

function onCardPointerMove(e) {
  if (e && _holdStartX && _holdStartY) {
    const dx = Math.abs(e.clientX - _holdStartX);
    const dy = Math.abs(e.clientY - _holdStartY);
    if (dx > 10 || dy > 10) {
      clearTimeout(_holdTimer);
    }
  }
}
window.onCardPointerMove = onCardPointerMove;

function handleCardClick(cardId, idx, e) {
  if (_isHolding) {
    _isHolding = false;
    return;
  }
  clearTimeout(_holdTimer);
  selectCard(cardId, idx);
}
window.handleCardClick = handleCardClick;

function showCardMagnifier(cardId) {
  const card = getCard(cardId);
  if (!card) return;

  const beatLabel = getCardBeatLabel(card);
  const beatClass = beatLabel === 'BEAT 1' ? 'beat1' : (beatLabel === 'BEAT 2' ? 'beat2' : 'universal');
  const roleLabel = card.type === 'pitcher' ? '⚾ PITCHER' : (card.type === 'batter' ? '🏏 BATTER' : '✨ UNIVERSAL');

  let tipText = '';
  if (card.zone === 'read') {
    tipText = '<b>Beat 1 Strategy:</b> Play alongside your pitch call or guess to push your total power toward the Strike Zone target. Aim for Bullseye to strike out the batter!';
  } else if (card.zone === 'contact' || card.zone === 'result') {
    tipText = '<b>Beat 2 Strategy:</b> In Beat 2, your card is added to your opponent\'s card to determine launch angle. Center values produce Hits and Home Runs; low values induce Groundouts; high values induce Flyouts.';
  } else {
    tipText = '<b>Universal Strategy:</b> Can be played in either Beat 1 (The Pitch) or Beat 2 (The Batted Ball) with zero penalties.';
  }

  let effectHtml = '';
  if (card.outcomeEffect) {
    effectHtml = `
      <div class="mag-effect-box">
        <div class="mag-effect-tag">⚡ SIGNATURE HIGHLIGHT EFFECT</div>
        <div class="mag-effect-text">${formatOutcomeEffect(card.outcomeEffect)}</div>
      </div>`;
  }

  const liveGS = window._lastGameState?.gameState;
  const half = liveGS?.half || 'top';
  const isBatting = (myRole === 'host') ? (half === 'bottom') : (half === 'top');
  const isPitching = !isBatting;
  const canPlay = isCardActiveForRole(card, isBatting, isPitching);

  const modalHtml = `
    <div class="card-inspector-overlay" id="card-inspector-overlay" onclick="closeCardMagnifier(event)">
      <div class="card-inspector-modal" onclick="event.stopPropagation()">
        <button class="btn-close-inspector" onclick="closeCardMagnifier(event)" aria-label="Close">&times;</button>
        
        <div class="magnified-card ${card.type} ${beatClass}">
          <div class="mag-top-strip">
            <span class="mag-role-pill ${card.type}">${roleLabel}</span>
            <span class="mag-beat-pill ${beatClass}">${beatLabel}</span>
          </div>

          <div class="mag-card-body">
            <div class="mag-name-row">
              <h2 class="mag-card-name">${card.name}</h2>
              <div class="mag-val-badge">
                <span class="mag-val-plus">+</span>
                <span class="mag-val-number">${card.value}</span>
                <span class="mag-val-sub">POWER</span>
              </div>
            </div>

            <div class="mag-desc-box">
              <div class="mag-box-label">CARD EFFECT &amp; DETAILS</div>
              <p class="mag-full-desc">${card.desc}</p>
            </div>

            ${card.powerBadge ? `
              <div class="mag-badge-box">
                <div class="mag-box-label">CARD SPECIALTY</div>
                <div class="card-power-chip">${card.powerBadge}</div>
              </div>` : ''}

            ${card.synergyPitch ? `
              <div class="mag-synergy-box">
                <div class="mag-box-label">✨ PITCH SYNERGY</div>
                <div class="mag-synergy-text">Pairs with <b>${card.synergyPitch.toUpperCase()}</b> for +${card.synergyBonus || 2} power in Beat 1!</div>
              </div>` : ''}

            ${card.advantagePerk ? `
              <div class="mag-perk-box">
                <div class="mag-box-label">⚡ BEAT 2 CARRYOVER PERK</div>
                <div class="mag-perk-text">Winning Beat 1 activates: <b>${card.advantagePerk.replace('_', ' ').toUpperCase()}</b> in Beat 2!</div>
              </div>` : ''}

            ${effectHtml}

            <div class="mag-strategy-box">
              <div class="mag-box-label">COACH'S INTEL</div>
              <p class="mag-tip-text">${tipText}</p>
            </div>
          </div>

          <div class="mag-actions-row">
            ${canPlay ? `
              <button class="btn-primary mag-play-btn" onclick="playInspectedCard('${card.id}')">
                Play This Card
              </button>
            ` : ''}
            <button class="btn-secondary mag-close-btn" onclick="closeCardMagnifier(event)">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>`;

  const existing = document.getElementById('card-inspector-overlay');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.showCardMagnifier = showCardMagnifier;

function closeCardMagnifier(e) {
  if (e) e.stopPropagation();
  const el = document.getElementById('card-inspector-overlay');
  if (el) el.remove();
}
window.closeCardMagnifier = closeCardMagnifier;

function playInspectedCard(cardId) {
  closeCardMagnifier();
  selectCard(cardId);
}
window.playInspectedCard = playInspectedCard;

function renderMiniPlacedCard(id, targetZone, canRemove, index) {
  const card = getCard(id);
  if (!card) return '';
  const effectiveVal = card.value || 0;

  return `
    <div class="placed-card" onclick="${canRemove ? 'removeBeatCard()' : `showCardMagnifier('${id}')`}" title="${canRemove ? 'Click to remove' : 'Click to inspect'}">
      <div class="zone-indicator ${card.zone}"></div>
      <div class="card-info">
        <span class="card-title">${card.name}</span>
        ${card.powerBadge ? `<span class="card-power-chip mini">${card.powerBadge}</span>` : ''}
        ${card.outcomeEffect ? `<span class="outcome-effect-badge" style="font-size:0.5rem;padding:0 3px;">${formatOutcomeEffect(card.outcomeEffect)}</span>` : ''}
      </div>
      <span class="power-badge">+${effectiveVal}</span>
      ${canRemove ? '<span class="remove-btn">✕</span>' : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAND RENDERING (HORIZONTAL TACTILE TRAY WITH DYNAMIC OUTCOME PREVIEWS)
// ─────────────────────────────────────────────────────────────────────────────
function renderHand(handIds, iAmBatting, iAmPitching, myCommitted, currentBeat = 'beat1', firstRevealedCard = null, batterChar = null) {
  if (!handIds || handIds.length === 0) {
    return '<div class="hand-cards-container"><p class="muted" style="margin:auto;font-size:0.75rem;">Hand empty — draw coming next PA</p></div>';
  }

  const oppFirstVal = (firstRevealedCard && firstRevealedCard !== 'NONE') ? (getCard(firstRevealedCard)?.value || 0) : null;
  const spectrum = batterChar?.battedBallSpectrum || [];

  return `
    <div class="hand-cards-container">
      ${handIds.map((id, idx) => {
        const card = getCard(id);
        if (!card) return '';
        const inPlacement = isInPlacement(id);
        const isActive = isCardActiveForRole(card, iAmBatting, iAmPitching) && !inPlacement && !myCommitted;
        const isSelected = (selectedCard === id) || (localBeatCard === id);
        const beatTag = getCardBeatLabel(card);
        const beatTagClass = beatTag === 'BEAT 1' ? 'beat1' : (beatTag === 'BEAT 2' ? 'beat2' : 'any');

        let dynamicOutcomeHtml = '';
        if (currentBeat === 'beat2') {
          const g = window._lastGameState;
          const pa = g?.currentPA;
          const gs = g?.gameState;
          const b1Count = pa?.beatResults?.beat1?.count;
          const half = gs?.half || 'top';
          const pitchingRole = half === 'top' ? 'host' : 'guest';
          const pitcherChar = getPitcher(gs?.activePitcher?.[pitchingRole]);

          if (iAmPitching) {
            const pDiffs = pitcherChar?.executionDifficulties || { fastball: 3, breaking: 5, offspeed: 8 };
            const baseDiff = pDiffs[localPitchType] ?? 4;
            const countDisc = (b1Count === '0-2') ? 2 : 0;
            const effDiff = Math.max(1, baseDiff - countDisc);
            const executes = (card.value >= effDiff);
            dynamicOutcomeHtml = executes
              ? `<div class="card-exec-chip pass">🎯 SPOT ON (Diff ${effDiff})</div>`
              : `<div class="card-exec-chip fail">⚠️ HANGER (Diff ${effDiff})</div>`;
          } else {
            const bDiffs = batterChar?.swingDifficulties || { contact: 3, balanced: 5, power: 8 };
            const baseDiff = bDiffs[localSwingType] ?? 5;
            const countDisc = (b1Count === '3-1') ? 2 : 0;
            const effDiff = Math.max(1, baseDiff - countDisc);
            const executes = (card.value >= effDiff);
            dynamicOutcomeHtml = executes
              ? `<div class="card-exec-chip pass">💥 BARREL (Diff ${effDiff})</div>`
              : `<div class="card-exec-chip fail">⚠️ MISTIME (Diff ${effDiff})</div>`;
          }
        } else if (currentBeat === 'beat1' && card.advantagePerk) {
          dynamicOutcomeHtml = `<div class="card-perk-chip">⚡ ${card.advantagePerk.replace('_', ' ').toUpperCase()}</div>`;
        }

        return `
          <div class="hand-card ${isActive ? 'active' : 'inactive'} ${isSelected ? 'selected' : ''} ${inPlacement ? 'in-zone' : ''}"
               onpointerdown="startCardHold('${id}', event)"
               onpointermove="onCardPointerMove(event)"
               onpointerup="cancelCardHold(event)"
               onpointerleave="cancelCardHold(event)"
               oncontextmenu="event.preventDefault(); showCardMagnifier('${id}')"
               onclick="${isActive ? `handleCardClick('${id}', ${idx}, event)` : `showCardMagnifier('${id}')`}"
               title="Hold down to inspect full card view">
            <button class="hc-inspect-btn" onclick="event.stopPropagation(); showCardMagnifier('${id}')" title="Inspect Card Details">🔍</button>
            <div class="hand-card-header">
              <span class="hc-tag ${beatTagClass}">${beatTag}</span>
              <span class="hc-val">${card.zone === 'any' && card.value === 0 ? '✨' : '+' + card.value}</span>
            </div>
            <div class="hc-name">${card.name}</div>
            ${card.powerBadge ? `<div class="card-power-chip">${card.powerBadge}</div>` : ''}
            <div class="hc-desc">${card.desc}</div>
            ${card.outcomeEffect ? `<div class="outcome-effect-badge">${formatOutcomeEffect(card.outcomeEffect)}</div>` : ''}
            ${dynamicOutcomeHtml}
          </div>`;
      }).join('')}
    </div>`;
}

function attachZoneClickHandlers() {
  // Handled inline via onclick attributes
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
          : { swingType: localSwingType, targetZone: localTargetZone, cardId: localBeatCard });

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
      if (isBot && myRole === 'host') {
        const botPlay = executeBotPlayBeat(liveGS, 'guest', 'beat2');
        const botIsPitching = (liveGS.half === 'bottom');
        const botBeatPlacement = botIsPitching
          ? { pitchType: botPlay.pitchType, pitchLocation: botPlay.pitchLocation, cardId: botPlay.cardId }
          : { swingType: botPlay.swingType, targetZone: botPlay.targetZone, cardId: botPlay.cardId };

        const updatedBotPlacement = { ...(livePA.placement?.guest || { z1:[], z2:[] }) };
        if (botPlay.cardId) {
          updatedBotPlacement.z2 = [botPlay.cardId];
        }

        updates['currentPA/beatPlacements/beat2/guest'] = botBeatPlacement;
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

        // Advance to Beat 2
        const updates = {
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

function renderCascadeCardChip(id, targetZone) {
  const card = getCard(id);
  if (!card) return '';
  const prefMap = { read: 'z1', contact: 'z2', result: 'z3' };
  const isPenalty = card.zone !== 'any' && prefMap[card.zone] !== targetZone;
  const effectiveVal = getZoneValue(card, targetZone);
  return `<span class="cascade-card-chip ${isPenalty ? 'penalty' : ''}" title="${card.desc || ''}">
    <span class="chip-name">${card.name}</span>
    <span class="chip-val">${effectiveVal}</span>
    ${isPenalty ? '<span class="chip-pen">(-50%)</span>' : ''}
  </span>`;
}

function renderZoneCascadeStep(res, zKey, title, icon, isBatting) {
  const z = res[zKey];
  if (!z) {
    return `
      <div class="cascade-step-card step-${zKey} skipped">
        <div class="step-header">
          <div class="step-title">
            <span class="step-icon">${icon}</span>
            <span class="step-name">${title}</span>
          </div>
          <span class="step-badge neutral" style="background:rgba(255,255,255,0.06);color:var(--text-dim);">SKIPPED</span>
        </div>
        <div class="cascade-callout neutral" style="font-size:0.68rem;padding:6px 8px;">
          ⏭️ Not reached &mdash; At-bat concluded earlier due to knockout.
        </div>
      </div>`;
  }
  const winner = z.winner || 'tie';
  const youWon = (isBatting && winner === 'batter') || (!isBatting && winner === 'pitcher');
  const oppWon = (isBatting && winner === 'pitcher') || (!isBatting && winner === 'batter');
  const winBadge = winner === 'tie'
    ? '<span class="step-badge tie">TIE</span>'
    : (youWon ? `<span class="step-badge win">YOU WIN +${z.margin || 0}</span>` : `<span class="step-badge lose">OPPONENT +${z.margin || 0}</span>`);

  const pCards = (z.pitcherCards || []).map(id => renderCascadeCardChip(id, zKey)).join('') || '<span class="no-cards-tag">—</span>';
  const bCards = (z.batterCards || []).map(id => renderCascadeCardChip(id, zKey)).join('') || '<span class="no-cards-tag">—</span>';

  let extraHtml = '';
  let cascadeHtml = '';

  if (zKey === 'z1') {
    const countDisplay = z.countDisplay || (z.count ? `${z.count} Count` : 'Even Battle');
    extraHtml = `<div class="cascade-callout neutral">Count Established: <b>${countDisplay}</b></div>`;

    if (z.winner === 'pitcher') {
      cascadeHtml = `<div class="cascade-effect-banner">⚡ <b>0-2 PITCHER'S COUNT:</b> Pitcher Execution Difficulties discounted by <b>-2</b> in Beat 2!</div>`;
    } else if (z.winner === 'batter') {
      cascadeHtml = `<div class="cascade-effect-banner">⚡ <b>3-1 HITTER'S COUNT:</b> Batter Swing Difficulties discounted by <b>-2</b> in Beat 2!</div>`;
    } else {
      cascadeHtml = `<div class="cascade-effect-banner neutral">⚖️ <b>3-2 FULL COUNT:</b> Even battle &mdash; standard difficulties for both sides.</div>`;
    }
  } else if (zKey === 'z2') {
    const pStatus = z.pitcherExecuted ? '🟢 SPOT ON' : '🔴 HANGER';
    const bStatus = z.batterExecuted ? '🟢 BARRELED UP' : '🔴 MISTIMED';
    const locMatch = z.sameLocation ? '🎯 LOCATION MATCHED' : '❌ LOCATION MISSED';

    extraHtml = `
      <div class="cascade-callout neutral" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span>Pitcher: <b>${(z.pitchType || 'fastball').toUpperCase()} ${(z.pitchLocation || 'high').toUpperCase()}</b> (${pStatus})</span>
        <span>Batter: <b>${(z.swingType || 'balanced').toUpperCase()} ${(z.targetZone || 'high').toUpperCase()}</b> (${bStatus})</span>
        <span><b>${locMatch}</b></span>
      </div>`;

    if (z.specialEffectTriggered) {
      extraHtml += `<div class="cascade-callout counter">✨ <b>HIGHLIGHT CARD TRIGGERED:</b> ${z.specialEffectTriggered}</div>`;
    }
    cascadeHtml = `<div class="cascade-effect-banner">💥 Payoff Result: <b>${z.outcomeDisplay || z.outcome?.display || ''}</b></div>`;
  }

  return `
    <div class="cascade-step-card step-${zKey}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-icon">${icon}</span>
          <span class="step-name">${title}</span>
        </div>
        ${winBadge}
      </div>

      <div class="step-matchup-row">
        <div class="step-team batter">
          <div class="team-label">🏏 Batter (${res.batterCharName || 'Batter'})</div>
          <div class="team-cards">${bCards}</div>
          <div class="team-score">Zone Total: <b>${z.batterTotal}</b></div>
        </div>
        <div class="step-vs">VS</div>
        <div class="step-team pitcher">
          <div class="team-label">⚾ Pitcher (${res.pitcherCharName || 'Pitcher'})</div>
          <div class="team-cards">${pCards}</div>
          <div class="team-score">Zone Total: <b>${z.pitcherTotal}</b></div>
        </div>
      </div>

      ${extraHtml}
      ${cascadeHtml}
    </div>`;
}

function renderOutcomeOverlay(res, isBatting = false) {
  if (!res?.outcome) return '';
  const o = res.outcome;

  const runsText = o.runsScored > 0
    ? `<div class="outcome-runs">🏠 <b>${o.runsScored} RUN${o.runsScored > 1 ? 'S' : ''} SCORED!</b></div>`
    : `<div class="outcome-runs muted">No runs scored &middot; Outs added: ${o.outsAdded}</div>`;

  return `
    <div class="outcome-overlay" id="outcome-overlay">
      <!-- PEEK DOCK BAR (ONLY VISIBLE IN PEEK MODE) -->
      <div class="outcome-peek-bar">
        <button class="btn-peek-restore" onclick="toggleOverlayPeek()">📊 Show Zone Cascade</button>
        <button class="btn-primary btn-next-batter" onclick="nextPA()">Next Batter &rarr;</button>
      </div>

      <!-- MAIN EXPANDED OUTCOME CARD OVER MAIN BOARD -->
      <div class="outcome-card">
        <div class="outcome-card-topbar">
          <span class="at-bat-tag">⚾ AT-BAT RESOLUTION</span>
          <button class="btn-peek-board" onclick="toggleOverlayPeek()" title="Temporarily hide overlay to view raw board cards">
            👁️ Peek Board
          </button>
        </div>

        <div class="outcome-headline">${o.display}</div>
        ${runsText}

        <!-- SEQUENTIAL ZONE CASCADE TIMELINE -->
        <div class="cascade-flow-container">
          ${renderZoneCascadeStep(res, 'z1', 'Beat 1: The Pitch &amp; Advantage', '⚾', isBatting)}
          ${res.z2 ? renderZoneCascadeStep(res, 'z2', 'Beat 2: The Batted Ball &amp; Outcome', '💥', isBatting) : ''}
        </div>

        <!-- FULL RAW LOG DETAILS -->
        ${res.log && res.log.length > 0 ? `
          <details class="outcome-calc-details">
            <summary>📜 Play-by-Play Calculation Log (${res.log.length} events)</summary>
            <pre>${res.log.join('\n')}</pre>
          </details>
        ` : ''}

        <!-- ACTION FOOTER -->
        <div class="outcome-actions-footer">
          <button class="btn-primary btn-next-batter" onclick="nextPA()">Next Batter &rarr;</button>
          <button class="btn-peek-secondary" onclick="toggleOverlayPeek()">👁️ Inspect Board Underneath</button>
        </div>
      </div>
    </div>`;
}

function renderOutcomeBanner(res) {
  return renderOutcomeOverlay(res);
}

function renderActionCard(id, isSelected, isInactive, canRemove, context) {
  const card = getCard(id);
  if (!card) return '';
  const classes = ['action-card', context, isSelected?'selected':'', isInactive?'inactive':'active', canRemove?'removable':''].filter(Boolean).join(' ');
  return `<div class="${classes}" title="${card.desc}">
    <div class="card-zone-tag ${card.zone}">${card.zone === 'any' ? 'UNI' : card.zone.toUpperCase()}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-value">${card.value || '✨'}</div>
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
        if (!pa || pa.phase === 'resolved' || window._resolvingBeat) return;
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
