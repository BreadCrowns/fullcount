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
let localPlacement = { z1:[], z2:[], z3:[] };
let localHand      = [];  // card IDs currently in hand
let selectedCard   = null; // currently selected card ID from hand
let gameListener   = null; // Firebase listener ref

const TOTAL_INNINGS = 3;
const MAX_HAND      = 6;
const ZONE_LIMIT    = 2;  // max cards per zone
const PA_CARD_LIMIT = 4;  // max cards per PA (BC09 The Captain: 5)

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
function gameRef(path = '') { return db.ref(`fullcount_games/${gameId}${path ? '/'+path : ''}`); }

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
// ROSTER SELECTION
// ─────────────────────────────────────────────────────────────────────────────
function renderRosterSelect(g) {
  const isBot = Boolean(g.isSolo || g.guest?.isBot);

  // Auto-initialize bot roster if playing solo
  if (isBot && myRole === 'host' && !g.rosters?.guest?.ready) {
    const botDeckPreset = DECK_PRESETS.grind || Object.values(DECK_PRESETS)[0];
    const botDeckCards = shuffleArray([...botDeckPreset.cards]);
    const botHand = botDeckCards.splice(0, 5);
    const updates = {
      'rosters/guest': {
        name: 'Practice Bot 🤖',
        startingPitcher: 'PC01', // Marcus Cole (The Ace)
        reliefPitcher:   'PC02', // Jackson Vance
        lineup:          LINEUP_PRESETS.balanced.lineup,
        deckPreset:      'grind',
        ready:           true,
      },
      'gameState/hands/guest':    botHand,
      'gameState/decks/guest':    botDeckCards,
      'gameState/discards/guest': [],
    };
    gameRef().update(updates);
  }

  const myRoster = g.rosters?.[myRole];
  if (myRoster?.ready) {
    const oppRoster = g.rosters?.[opponentRole()];
    if (oppRoster?.ready) {
      // Both ready — host starts game
      if (myRole === 'host') startGame(g);
    } else {
      document.getElementById('app').innerHTML = `
        <div class="phase-screen">
          <h2>Roster locked in! ✅</h2>
          <p>Waiting for opponent to finish their selection…</p>
        </div>`;
    }
    return;
  }

  const pitcherOptions = Object.values(PITCHER_CHARACTERS).map((p, idx) => `
    <label class="card-option">
      <input type="radio" name="starter" value="${p.id}" ${idx === 0 ? 'checked' : ''}>
      <div class="player-card-mini" style="border-color:${p.color}">
        <div class="pc-name">${p.name}</div>
        <div class="pc-arch">${p.archetype}</div>
        <div class="pc-zones">Z1: <b>${p.zoneBonuses.z1>=0?'+':''}${p.zoneBonuses.z1}</b> &nbsp; Z2: <b>${p.zoneBonuses.z2>=0?'+':''}${p.zoneBonuses.z2}</b> &nbsp; Z3: <b>${p.zoneBonuses.z3>=0?'+':''}${p.zoneBonuses.z3}</b></div>
        <div class="pc-stamina">⏱ Fresh: 0–${p.stamina.freshMax} PA</div>
      </div>
    </label>`).join('');

  const reliefOptions = Object.values(PITCHER_CHARACTERS).map((p, idx) => `
    <label class="card-option">
      <input type="radio" name="relief" value="${p.id}" ${idx === 1 ? 'checked' : ''}>
      <div class="player-card-mini" style="border-color:${p.color}">
        <div class="pc-name">${p.name}</div>
        <div class="pc-arch">${p.archetype}</div>
        <div class="pc-zones">Z1: <b>${p.zoneBonuses.z1>=0?'+':''}${p.zoneBonuses.z1}</b> &nbsp; Z2: <b>${p.zoneBonuses.z2>=0?'+':''}${p.zoneBonuses.z2}</b> &nbsp; Z3: <b>${p.zoneBonuses.z3>=0?'+':''}${p.zoneBonuses.z3}</b></div>
        <div class="pc-stamina">⏱ Fresh: 0–${p.stamina.freshMax} PA</div>
      </div>
    </label>`).join('');

  const lineupOptions = Object.entries(LINEUP_PRESETS).map(([key,lp], idx) => `
    <label class="card-option">
      <input type="radio" name="lineup" value="${key}" ${idx === 0 ? 'checked' : ''}>
      <div class="preset-card">
        <div class="pc-name">${lp.name}</div>
        <div class="pc-desc">${lp.desc}</div>
        <div class="lineup-mini">${lp.lineup.map(id => `<span class="batter-chip" style="border-color:${getBatter(id)?.color||'#888'}">${getBatter(id)?.name.replace(/"/g,'').split(' ')[0] || id}</span>`).join(' ')}</div>
      </div>
    </label>`).join('');

  const deckOptions = Object.entries(DECK_PRESETS).map(([key,dp], idx) => `
    <label class="card-option">
      <input type="radio" name="deck" value="${key}" ${idx === 0 ? 'checked' : ''}>
      <div class="preset-card">
        <div class="pc-name">${dp.name}</div>
        <div class="pc-desc">${dp.desc}</div>
      </div>
    </label>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="roster-screen">
      <div class="logo-small">⚾ FULL COUNT</div>
      <h2>Build Your Team</h2>

      <section>
        <h3>Starting Pitcher</h3>
        <div class="card-option-grid">${pitcherOptions}</div>
      </section>

      <section>
        <h3>Relief Pitcher</h3>
        <div class="card-option-grid">${reliefOptions}</div>
      </section>

      <section>
        <h3>Batting Lineup</h3>
        <div class="card-option-grid">${lineupOptions}</div>
      </section>

      <section>
        <h3>Action Deck</h3>
        <div class="card-option-grid">${deckOptions}</div>
      </section>

      <button class="btn-primary" onclick="submitRoster()">Lock In Roster ✅</button>
    </div>`;
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

  const deckCards = shuffleArray([...DECK_PRESETS[deck].cards]);
  const hand = deckCards.splice(0, 5);

  gameRef(`rosters/${myRole}`).set({
    startingPitcher: starter,
    reliefPitcher:   relief,
    lineup:          LINEUP_PRESETS[lineup].lineup,
    deckPreset:      deck,
    ready:           true,
  });

  // Store initial deck/hand state on game
  gameRef(`gameState/hands/${myRole}`).set(hand);
  gameRef(`gameState/decks/${myRole}`).set(deckCards);
  gameRef(`gameState/discards/${myRole}`).set([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// START GAME (host only)
// ─────────────────────────────────────────────────────────────────────────────
function startGame(g) {
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
    hands: g.gameState?.hands || { host:[], guest:[] },
    decks: g.gameState?.decks || { host:[], guest:[] },
    discards: { host:[], guest:[] },
  };

  const paState = {
    phase:     'placing',
    committed: { host:false, guest:false },
    placement: {
      host:  { z1:[], z2:[], z3:[] },
      guest: { z1:[], z2:[], z3:[] },
    },
    resolution: null,
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
  const half = gs.half;

  // Who is batting / pitching
  const battingRole  = half === 'top' ? 'guest' : 'host';
  const pitchingRole = half === 'top' ? 'host'  : 'guest';
  const iAmBatting   = myRole === battingRole;
  const iAmPitching  = myRole === pitchingRole;

  // Current pitcher & batter character cards
  const myPitcherChar  = getPitcher(gs.activePitcher[pitchingRole]);
  const battingLineup  = g.rosters[battingRole].lineup;
  const currentBatterIndex = gs.batterIndex[half] % 9;
  const currentBatterChar  = getBatter(battingLineup[currentBatterIndex]);

  // Sync local hand from Firebase
  localHand = gs.hands[myRole] || [];

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

  // Determine max cards for this PA
  const maxCards = (batterChar?.id === 'BC09') ? 5 : PA_CARD_LIMIT;
  window._maxCardsThisPA = maxCards;

  const oppKey = opponentRole();
  const oppName = g.rosters?.[oppKey]?.name || (oppKey === 'host' ? 'Host' : 'Guest');
  const oppHand = gs.hands?.[oppKey] || [];
  const oppChar = iAmBatting ? pitcherChar : batterChar;
  const oppRoleTag = iAmBatting ? '⚾ PITCHING' : '🏏 BATTING';

  const isBot = Boolean(g.isSolo || g.guest?.isBot);
  const myChar = iAmBatting ? batterChar : pitcherChar;
  const totalPlaced = ['z1','z2','z3'].reduce((s,z) => s + (localPlacement[z]||[]).length, 0);

  const canSub = iAmPitching && !myCommitted && gs.activePitcher[pitchingRole] === g.rosters[pitchingRole].startingPitcher;
  const reliefId = canSub ? g.rosters[pitchingRole].reliefPitcher : null;

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
            ${oppCommitted ? 'READY' : (isBot ? 'BOT 🤖' : 'PLACING')}
          </div>
        </div>
      </header>

      <!-- CENTER MARVEL SNAP 3-ZONE BATTLEFIELD -->
      <main class="battlefield">
        ${renderZoneBoard(pa, iAmBatting, myCommitted, 'placing')}
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
            <span class="placed-indicator">Placed: <b id="card-count">${totalPlaced}</b>/${maxCards}</span>
            ${canSub ? `<button class="btn-relief" onclick="substitutePitcher('${reliefId}')">Relief</button>` : ''}
            <button class="btn-intel" onclick="toggleMatchupModal(true)">ℹ️ Intel</button>
          </div>
        </div>

        <!-- HAND + TURN ACTION BUTTON -->
        <div class="hand-row">
          ${renderHand(localHand, iAmBatting, iAmPitching, myCommitted)}
          <div class="lock-in-action-area">
            ${!myCommitted ? `
              <button class="btn-snap-lock" id="lock-btn" onclick="commitPlacement()">
                <span class="btn-icon">🔒</span>
                <span class="btn-label">LOCK IN</span>
                <span class="btn-sub">${totalPlaced}/${maxCards}</span>
              </button>
            ` : `
              <div class="locked-indicator-badge">
                <span class="lock-icon">✅</span>
                <span class="lock-text">LOCKED IN</span>
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

  const oppKey = opponentRole();
  const oppName = g.rosters?.[oppKey]?.name || (oppKey === 'host' ? 'Host' : 'Guest');
  const oppChar = (battingRole === myRole) ? pitcherChar : batterChar;
  const oppRoleTag = (battingRole === myRole) ? '⚾ PITCHING' : '🏏 BATTING';

  const myChar = (battingRole === myRole) ? batterChar : pitcherChar;
  const maxCards = (batterChar?.id === 'BC09') ? 5 : PA_CARD_LIMIT;
  const totalPlaced = ['z1','z2','z3'].reduce((s,z) => s + (localPlacement[z]||[]).length, 0);

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
        ${renderZoneBoard(pa, battingRole === myRole, true, 'reveal', res)}
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
          ${renderHand(localHand, battingRole === myRole, pitchingRole === myRole, true)}
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
// ZONE BOARD RENDERING (MARVEL SNAP 3 LOCATIONS DOWN THE MIDDLE)
// ─────────────────────────────────────────────────────────────────────────────
function renderZoneBoard(pa, iAmBatting, myCommitted, phase, res) {
  const myKey  = myRole;
  const oppKey = opponentRole();
  const zones  = ['z1','z2','z3'];
  const revealed = phase === 'reveal' || phase === 'resolved';

  const zoneMeta = {
    z1: { tag:'Z1: READ',   icon:'🎯', title:'PITCH vs GUESS', summary:'Counters multiply batter value (1.5×–2.0×)' },
    z2: { tag:'Z2: SWING',  icon:'💥', title:'HEAT vs CONTACT', summary:'Margin 15+ triggers K or Hard Contact' },
    z3: { tag:'Z3: RESULT', icon:'🛡️', title:'SHIFT vs POWER',  summary:'Pitcher shifts counter swing directions' }
  };

  return `<div class="zones-container">
    ${zones.map(z => {
      const myPlaced  = localPlacement[z] || [];
      const oppPlaced = pa.placement?.[oppKey]?.[z] || [];
      const meta = zoneMeta[z];

      let winClass = '';
      let winBanner = '';
      let oppScoreDisplay = '0';
      let myScoreDisplay = String(sumZone(myPlaced, z));

      if (revealed && res?.[z]) {
        const zr = res[z];
        const youWin = (iAmBatting && zr.winner === 'batter') || (!iAmBatting && zr.winner === 'pitcher');
        const oppWin = (iAmBatting && zr.winner === 'pitcher') || (!iAmBatting && zr.winner === 'batter');
        
        if (zr.winner === 'tie') {
          winClass = '';
          winBanner = `<span class="loc-winner-banner tie">TIE</span>`;
        } else if (youWin) {
          winClass = 'winner-me';
          winBanner = `<span class="loc-winner-banner win-me">WIN +${zr.margin}</span>`;
        } else if (oppWin) {
          winClass = 'winner-opp';
          winBanner = `<span class="loc-winner-banner win-opp">LOSE -${zr.margin}</span>`;
        }

        oppScoreDisplay = String(iAmBatting ? zr.pitcherTotal : zr.batterTotal);
        myScoreDisplay  = String(iAmBatting ? zr.batterTotal  : zr.pitcherTotal);
      } else {
        oppScoreDisplay = oppPlaced.length > 0 ? '?' : '0';
      }

      // Opponent cards (TOP)
      const oppCardsHtml = revealed
        ? (oppPlaced.map(id => renderMiniPlacedCard(id, z, false)).join('') || '<div class="board-slot empty-drop" style="opacity:0.25;cursor:default;">—</div>')
        : (oppPlaced.length > 0
            ? oppPlaced.map(() => '<div class="hidden-opponent-card"><span class="mystery-mark">?</span></div>').join('')
            : '<div class="board-slot empty-drop" style="opacity:0.25;cursor:default;">—</div>');

      // Player cards (BOTTOM)
      const myCardsHtml = myPlaced.map((id, idx) => renderMiniPlacedCard(id, z, !myCommitted, idx)).join('');
      const canDropHere = !myCommitted && myPlaced.length < ZONE_LIMIT;
      const dropSlotHtml = canDropHere ? `
        <div class="board-slot empty-drop ${selectedCard ? 'pulse-ready' : ''}" onclick="placeSelectedCard('${z}')">
          <span style="font-size:1.1rem;font-weight:900;">+</span>
        </div>` : '';

      return `
        <div class="zone-column zone-${z} ${winClass}" data-zone="${z}">
          <!-- TOP: OPPONENT PLAYED CARDS -->
          <div class="zone-slots opponent-slots">
            ${oppCardsHtml}
          </div>

          <!-- MIDDLE: MARVEL SNAP LOCATION CARD -->
          <div class="location-card">
            <div class="loc-power-badge opp ${winClass === 'winner-opp' ? 'winning' : ''}">
              ${oppScoreDisplay}
            </div>

            <div class="loc-center-emblem">
              <div class="loc-zone-tag ${z}">${meta.tag}</div>
              <div class="loc-icon">${meta.icon}</div>
              <div class="loc-title">${meta.title}</div>
              <div class="loc-summary">${meta.summary}</div>
              ${winBanner}
            </div>

            <div class="loc-power-badge mine ${winClass === 'winner-me' ? 'winning' : ''}">
              ${myScoreDisplay}
            </div>
          </div>

          <!-- BOTTOM: PLAYER PLAYED CARDS -->
          <div class="zone-slots my-slots" id="slots-${z}">
            ${myCardsHtml}
            ${dropSlotHtml}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function renderMiniPlacedCard(id, targetZone, canRemove, index) {
  const card = getCard(id);
  if (!card) return '';
  const prefMap = { read:'z1', contact:'z2', result:'z3' };
  const isPenalty = card.zone !== 'any' && prefMap[card.zone] !== targetZone;
  const effectiveVal = getZoneValue(card, targetZone);

  return `
    <div class="placed-card" ${canRemove ? `onclick="removeFromZone('${targetZone}', ${index})"` : ''} title="${card.desc}">
      <div class="zone-indicator ${card.zone}"></div>
      <div class="card-info">
        <span class="card-title">${card.name}</span>
        ${isPenalty ? '<span class="card-penalty-note">50% PENALTY</span>' : ''}
      </div>
      <span class="power-badge">${effectiveVal}</span>
      ${canRemove ? '<span class="remove-btn">✕</span>' : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAND RENDERING (HORIZONTAL TACTILE TRAY)
// ─────────────────────────────────────────────────────────────────────────────
function renderHand(handIds, iAmBatting, iAmPitching, myCommitted) {
  if (!handIds || handIds.length === 0) {
    return '<div class="hand-cards-container"><p class="muted" style="margin:auto;font-size:0.75rem;">Hand empty — draw coming next PA</p></div>';
  }

  return `
    <div class="hand-cards-container">
      ${handIds.map((id, idx) => {
        const card = getCard(id);
        if (!card) return '';
        const inPlacement = isInPlacement(id);
        const isActive = isCardActiveForRole(card, iAmBatting, iAmPitching) && !inPlacement && !myCommitted;
        const isSelected = selectedCard === id;
        return `
          <div class="hand-card ${isActive ? 'active' : 'inactive'} ${isSelected ? 'selected' : ''} ${inPlacement ? 'in-zone' : ''}"
               onclick="${isActive ? `selectCard('${id}', ${idx})` : ''}"
               title="${card.desc}">
            <div class="hand-card-header">
              <span class="hc-tag ${card.zone}">${card.zone === 'any' ? 'UNI' : card.zone.toUpperCase()}</span>
              <span class="hc-val">${card.zone === 'any' && card.value === 0 ? '✨' : card.value}</span>
            </div>
            <div class="hc-name">${card.name}</div>
            <div class="hc-desc">${card.desc}</div>
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
  return ['z1','z2','z3'].some(z => (localPlacement[z] || []).includes(cardId));
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD INTERACTION
// ─────────────────────────────────────────────────────────────────────────────
function selectCard(cardId) {
  selectedCard = selectedCard === cardId ? null : cardId;
  // Re-render hand in place
  const g = window._lastGameState;
  if (g) renderPlay(g);
}

function placeSelectedCard(zone) {
  if (!selectedCard) return;
  const alreadyInZone = (localPlacement[zone] || []).length >= ZONE_LIMIT;
  const totalPlaced = ['z1','z2','z3'].reduce((s,z) => s + (localPlacement[z]||[]).length, 0);
  const maxCards = window._maxCardsThisPA || PA_CARD_LIMIT;

  if (alreadyInZone) { alert(`Zone ${zone.toUpperCase()} is full (max ${ZONE_LIMIT} cards).`); return; }
  if (totalPlaced >= maxCards) { alert(`Max ${maxCards} cards per PA.`); return; }

  if (!localPlacement[zone]) localPlacement[zone] = [];
  localPlacement[zone].push(selectedCard);
  selectedCard = null;

  updateCardCount();
  const g = window._lastGameState;
  if (g) renderPlay(g);
}

function removeFromZone(zone, index) {
  if (!localPlacement[zone]) return;
  localPlacement[zone].splice(index, 1);
  updateCardCount();
  const g = window._lastGameState;
  if (g) renderPlay(g);
}

function attachZoneClickHandlers() {
  // Handled inline via onclick attributes
}

function updateCardCount() {
  const total = ['z1','z2','z3'].reduce((s,z) => s + (localPlacement[z]||[]).length, 0);
  const el = document.getElementById('card-count');
  if (el) el.textContent = total;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT PLACEMENT
// ─────────────────────────────────────────────────────────────────────────────
function commitPlacement() {
  const total = ['z1','z2','z3'].reduce((s,z) => s + (localPlacement[z]||[]).length, 0);
  if (total === 0) { if (!confirm('Play with no cards this PA?')) return; }

  const btn = document.getElementById('lock-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">LOCKING IN…</span>';
  }

  // Remove placed cards from hand
  const placedAll = [...(localPlacement.z1||[]), ...(localPlacement.z2||[]), ...(localPlacement.z3||[])];
  const newHand = [...localHand];
  placedAll.forEach(id => {
    const idx = newHand.indexOf(id);
    if (idx > -1) newHand.splice(idx, 1);
  });

  localHand = newHand;

  gameRef().once('value', snap => {
    const g = snap.val();
    if (!g) return;

    const updates = {
      [`currentPA/placement/${myRole}`]: localPlacement,
      [`currentPA/committed/${myRole}`]: true,
      [`gameState/hands/${myRole}`]:     newHand,
    };

    const isBot = Boolean(g.isSolo || g.guest?.isBot);
    let shouldResolve = false;

    if (isBot && myRole === 'host') {
      const botPlay = executeBotPlay(g.gameState, 'guest');
      updates['currentPA/placement/guest'] = botPlay.botPlacement;
      updates['currentPA/committed/guest'] = true;
      updates['gameState/hands/guest']     = botPlay.botHand;
      shouldResolve = true;
    } else {
      const oppRole = opponentRole();
      if (g.currentPA?.committed?.[oppRole]) {
        shouldResolve = true;
      }
    }

    gameRef().update(updates).then(() => {
      if (shouldResolve && myRole === 'host') {
        resolveAndAdvance();
      }
    }).catch(err => {
      console.error('commitPlacement update error:', err);
      showError('Lock In failed: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-icon">🔒</span><span class="btn-label">LOCK IN</span><span class="btn-sub">${total}/${window._maxCardsThisPA || 4}</span>`;
      }
    });
  });
}

// Firebase listener handles reveal update when both committed
gameRef && (() => {
  // This is set up after Firebase init in listenToGame via on('value', ...)
})();

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUTION (HOST ONLY)
// ─────────────────────────────────────────────────────────────────────────────
function resolveAndAdvance() {
  gameRef().once('value', snap => {
    try {
      const g = snap.val();
      if (!g || g.currentPA?.resolution) return; // already resolved
      if (!g.currentPA?.committed?.host || !g.currentPA?.committed?.guest) return;

      const gs   = g.gameState;
      const pa   = g.currentPA;
      const half = gs.half;
      const pitchingRole = half === 'top' ? 'host'  : 'guest';
      const battingRole  = half === 'top' ? 'guest' : 'host';

      const pitcherChar  = getPitcher(gs.activePitcher?.[pitchingRole]);
      const battingLineup= g.rosters?.[battingRole]?.lineup || [];
      const bIdx         = (gs.batterIndex?.[half] || 0) % 9;
      const batterChar   = getBatter(battingLineup[bIdx]);

      const pitcherPlacement = pa.placement?.[pitchingRole] || { z1:[], z2:[], z3:[] };
      const batterPlacement  = pa.placement?.[battingRole] || { z1:[], z2:[], z3:[] };

      const score = { batting: gs.score?.[half] || 0, pitching: gs.score?.[half==='top'?'bottom':'top'] || 0 };

      const res = resolvePA({
        pitcherPlacement,
        batterPlacement,
        pitcherChar,
        batterChar,
        pitcherPAsFaced:    gs.pitcherPAs?.[pitchingRole] || 0,
        bases:              gs.bases || { first:false, second:false, third:false },
        isFirstPAOfInning:  Boolean(pa.isFirstPAOfInning),
        prevPitchCall:      gs.lastPitchCall?.[pitchingRole] || null,
        score,
        outs:               gs.outs || 0,
        inning:             gs.inning || 1,
        totalInnings:       TOTAL_INNINGS,
        pitcherWonZ1LastPA: gs.lastPitcherWonZ1?.[pitchingRole] || false,
      });

      // Update game state based on outcome
      const outcome = res.outcome;
      let newOuts   = (gs.outs || 0) + (outcome.outsAdded || 0);
      let newBases  = outcome.newBases || gs.bases || { first:false, second:false, third:false };
      const newScore = { ...(gs.score || { top:0, bottom:0 }) };
      newScore[half] = (newScore[half] || 0) + (outcome.runsScored || 0);

      // Hustle: runners advance +1 (adjust newBases)
      if (outcome.type !== 'out' && outcome.type !== 'k' && outcome.type !== 'dp' &&
          (batterPlacement.z3 || []).includes('B25') && outcome.runnersAdvance > 0) {
        if (!newBases.third && newBases.second) { newBases = {...newBases, third:true, second:newBases.first, first:false}; }
        if (!newBases.second && newBases.first) { newBases = {...newBases, second:true, first:false}; }
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

        // Check game over
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
        const botPitcher = pitcherChar;
        const pasFaced = newPitcherPAs.guest;
        if (pasFaced >= (botPitcher?.stamina?.exhaustedMin || 6) && gs.activePitcher?.guest === g.rosters?.guest?.startingPitcher) {
          newPitcherPAs.guest = 0;
          if (gs.activePitcher) gs.activePitcher.guest = g.rosters.guest.reliefPitcher;
          res.log.push(`Practice Bot brings in relief pitcher: ${getPitcher(g.rosters.guest.reliefPitcher)?.name}`);
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

      if (nextPhase === 'gameover') {
        updates['phase'] = 'gameover';
      }

      gameRef().update(updates).catch(err => {
        console.error('Firebase resolution update error:', err);
        showError('Resolution save error: ' + err.message);
      });
    } catch(err) {
      console.error('resolveAndAdvance error:', err);
      showError('Resolution error: ' + err.message);
    }
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

      const updates = {};
      const discardsObj = gs.discards || {};
      const handsObj    = gs.hands    || {};
      const decksObj    = gs.decks    || {};

      ['host','guest'].forEach(role => {
        let hand = [...(handsObj[role] || [])];
        let deck = [...(decksObj[role] || [])];
        let disc = [...(discardsObj[role] || [])];

        if (deck.length === 0 && disc.length > 0) {
          deck = shuffleArray(disc);
          disc = [];
        }

        if (deck.length > 0) {
          hand.push(deck.shift());
          if (hand.length > MAX_HAND) {
            disc.push(hand.shift());
          }
        }

        updates[`gameState/hands/${role}`]    = hand;
        updates[`gameState/decks/${role}`]    = deck;
        updates[`gameState/discards/${role}`] = disc;
      });

      // Also move placed cards to discard
      ['host','guest'].forEach(role => {
        const placed = [
          ...(pa.placement?.[role]?.z1 || []),
          ...(pa.placement?.[role]?.z2 || []),
          ...(pa.placement?.[role]?.z3 || []),
        ];
        const currentDisc = [...(updates[`gameState/discards/${role}`] || discardsObj[role] || [])];
        placed.forEach(id => currentDisc.push(id));
        updates[`gameState/discards/${role}`] = currentDisc;
      });

      // Determine next inning/half state (already updated by host in resolveAndAdvance)
      const isGameOver = g.phase === 'gameover';

      if (!isGameOver) {
        updates['currentPA/phase']             = 'placing';
        updates['currentPA/committed/host']    = false;
        updates['currentPA/committed/guest']   = false;
        updates['currentPA/placement/host']    = { z1:[], z2:[], z3:[] };
        updates['currentPA/placement/guest']   = { z1:[], z2:[], z3:[] };
        updates['currentPA/resolution']        = null;
        updates['currentPA/isFirstPAOfInning'] = false;
      }

      gameRef().update(updates).then(() => {
        // Reset local placement
        localPlacement = { z1:[], z2:[], z3:[] };
        selectedCard   = null;
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
  if (!confirm(`Bring in ${getPitcher(reliefId)?.name}?`)) return;
  const updates = {
    [`gameState/activePitcher/${myRole}`]: reliefId,
    [`gameState/pitcherPAs/${myRole}`]:   0,
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
  if (!z) return '';
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
    if (z.counterFired) {
      extraHtml += `<div class="cascade-callout counter">🎯 <b>PITCH GUESS COUNTERED!</b> Batter read <b>${(z.pitchCallMatched || '').toUpperCase()}</b> &rarr; Action power multiplied by <b>&times;${z.mult}</b>!</div>`;
    } else {
      extraHtml += `<div class="cascade-callout neutral">No pitch guess counter matched in Zone 1.</div>`;
    }

    if (z.cascadeEffect === 'walk') {
      cascadeHtml = `<div class="cascade-trigger-alert walk">🟡 <b>INSTANT WALK TRIGGERED!</b> Batter won Zone 1 by ${z.margin} &ge; 10. Plate appearance concludes immediately!</div>`;
    } else if (z.cascadeEffect === 'called_k') {
      cascadeHtml = `<div class="cascade-trigger-alert k">⚫ <b>INSTANT CALLED STRIKE 3!</b> Pitcher won Zone 1 by ${z.margin} &ge; 10. Plate appearance concludes immediately!</div>`;
    } else if (winner !== 'tie') {
      cascadeHtml = `<div class="cascade-effect-banner">⬇️ <b>MOMENTUM CASCADE:</b> <b>+3 points</b> awarded to <b>${winner.toUpperCase()}</b> in Zone 2!</div>`;
    } else {
      cascadeHtml = `<div class="cascade-effect-banner neutral">⬇️ Zone 1 tied &mdash; no momentum bonus into Zone 2.</div>`;
    }
  } else if (zKey === 'z2') {
    if (z.z1Inheritance && z.z1Inheritance !== 'tie' && z.z1Inheritance !== 'none') {
      extraHtml += `<div class="cascade-callout bonus">⚡ <b>+3 Momentum from Zone 1</b> active for ${z.z1Inheritance.toUpperCase()}</div>`;
    }

    if (z.cascadeEffect === 'k_swinging') {
      cascadeHtml = `<div class="cascade-trigger-alert k">⚡ <b>INSTANT STRIKEOUT SWINGING!</b> Pitcher won Zone 2 by ${z.margin} &ge; 15. Plate appearance concludes immediately!</div>`;
    } else if (z.hardContact) {
      cascadeHtml = `<div class="cascade-trigger-alert hard-contact">🔥 <b>HARD CONTACT ACHIEVED!</b> Batter won Zone 2 by ${z.margin} &ge; 15 &rarr; Batter Zone 3 Action power is <b>DOUBLED (&times;2)</b>!</div>`;
    } else {
      cascadeHtml = `<div class="cascade-effect-banner neutral">⬇️ Solid contact made &mdash; standard power carried into Zone 3.</div>`;
    }
  } else if (zKey === 'z3') {
    if (z.hardContactActive) {
      extraHtml += `<div class="cascade-callout hard-contact">🔥 <b>Hard Contact Active:</b> Batter action points doubled (&times;2)!</div>`;
    }
    if (z.z3Penalty && z.z3Penalty < 0) {
      extraHtml += `<div class="cascade-callout penalty">🛡️ <b>Defensive Shift:</b> Subtracted ${Math.abs(z.z3Penalty)} pts from batter power</div>`;
    }
    cascadeHtml = `<div class="cascade-effect-banner">🏁 Zone 3 resolved for <b>${winner.toUpperCase()}</b>. Proceeding to Advantage Tally &amp; Outcome Roll.</div>`;
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

function renderRngSection(res, isBatting) {
  const o = res.outcome || {};
  const rng = o.rng || {};
  const adv = res.advantageSide || 'neutral';
  const score = res.advantageScore || 0;
  const zonesWon = res.zonesWon || {};

  const isSweep = res.trigger === 'hr' || res.trigger === 'dp_or_k';
  const isKnockout = res.trigger === 'walk' || res.trigger === 'called_k' || res.trigger === 'k_swinging';

  let oddsHtml = '';
  if (rng.odds && rng.odds.length > 0) {
    oddsHtml = `
      <div class="rng-odds-container">
        <div class="odds-title">🎲 OUTCOME ODDS FOR THIS ADVANTAGE TIER (${rng.tier || ''}):</div>
        <div class="odds-pills">
          ${rng.odds.map(odd => {
            const isSelected = (o.display || '').toLowerCase().includes(odd.label.toLowerCase()) || 
                               (odd.label.toLowerCase().includes('home run') && o.type === 'hr') ||
                               (odd.label.toLowerCase().includes('strikeout') && o.type === 'k') ||
                               (odd.label.toLowerCase().includes('double') && o.type === 'double') ||
                               (odd.label.toLowerCase().includes('single') && o.type === 'single') ||
                               (odd.label.toLowerCase().includes('triple') && o.type === 'triple');
            return `<div class="odds-pill ${isSelected ? 'selected' : ''}">
              <span class="odds-label">${odd.label}</span>
              <span class="odds-pct">${odd.pct}%</span>
              ${odd.range ? `<span class="odds-range">${odd.range}</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  let rollResultHtml = '';
  if (rng.rollPct !== null && rng.rollPct !== undefined && !isKnockout && !isSweep) {
    rollResultHtml = `
      <div class="rng-roll-box">
        <span class="roll-dice-icon">🎲</span>
        <div class="roll-meta">
          <div class="roll-value">RNG Dice Roll: <b>${rng.rollPct}%</b></div>
          <div class="roll-result-text">Selected: <b class="chosen-outcome">${o.display}</b></div>
        </div>
      </div>`;
  } else if (isSweep) {
    rollResultHtml = `
      <div class="rng-roll-box sweep">
        <span class="roll-dice-icon">⭐</span>
        <div class="roll-meta">
          <div class="roll-value"><b>3-Zone Dominant Sweep!</b> (Score &ge; 30)</div>
          <div class="roll-result-text">Guaranteed: <b class="chosen-outcome">${o.display}</b> (No RNG roll required)</div>
        </div>
      </div>`;
  } else if (isKnockout) {
    rollResultHtml = `
      <div class="rng-roll-box knockout">
        <span class="roll-dice-icon">⚡</span>
        <div class="roll-meta">
          <div class="roll-value"><b>Zone Knockout Triggered!</b></div>
          <div class="roll-result-text">Guaranteed: <b class="chosen-outcome">${o.display}</b> (No RNG roll required)</div>
        </div>
      </div>`;
  }

  return `
    <div class="cascade-step-card step-rng">
      <div class="step-header">
        <div class="step-title">
          <span class="step-icon">⚖️</span>
          <span class="step-name">Zone Majority &amp; Final Resolution</span>
        </div>
        <span class="step-badge adv-${adv}">${adv.toUpperCase()} ADVANTAGE</span>
      </div>

      <div class="adv-summary-bar">
        <div class="adv-tally">
          Zones Won: 🏏 Batter <b>${zonesWon.batter ?? '—'}</b> &middot; ⚾ Pitcher <b>${zonesWon.pitcher ?? '—'}</b>
        </div>
        <div class="adv-score-tag">
          Advantage Power: <b>${score} pts</b>
        </div>
      </div>

      ${oddsHtml}
      ${rollResultHtml}
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
          ${renderZoneCascadeStep(res, 'z1', 'Zone 1: Pitch &amp; Read', '🎯', isBatting)}
          ${renderZoneCascadeStep(res, 'z2', 'Zone 2: Contact &amp; Swing', '💥', isBatting)}
          ${renderZoneCascadeStep(res, 'z3', 'Zone 3: Result &amp; Defense', '🛡️', isBatting)}
          ${renderRngSection(res, isBatting)}
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
      // Small delay to ensure both placements are written
      setTimeout(() => resolveAndAdvance(), 300);
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
