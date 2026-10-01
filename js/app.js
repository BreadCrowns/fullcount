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

function listenToGame() {
  if (gameListener) gameListener.off();
  gameListener = gameRef();
  gameListener.on('value', snap => {
    const g = snap.val();
    if (!g) { showError('Game not found.'); return; }
    handleGameState(g);
  });
}

function handleGameState(g) {
  switch(g.phase) {
    case 'lobby':   renderLobbyWait(g); break;
    case 'roster':  renderRosterSelect(g); break;
    case 'play':    renderPlay(g); break;
    case 'gameover':renderGameOver(g); break;
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

  const pitcherOptions = Object.values(PITCHER_CHARACTERS).map(p => `
    <label class="card-option">
      <input type="radio" name="starter" value="${p.id}">
      <div class="player-card-mini" style="border-color:${p.color}">
        <div class="pc-name">${p.name}</div>
        <div class="pc-arch">${p.archetype}</div>
        <div class="pc-zones">Z1: <b>${p.zoneBonuses.z1>=0?'+':''}${p.zoneBonuses.z1}</b> &nbsp; Z2: <b>${p.zoneBonuses.z2>=0?'+':''}${p.zoneBonuses.z2}</b> &nbsp; Z3: <b>${p.zoneBonuses.z3>=0?'+':''}${p.zoneBonuses.z3}</b></div>
        <div class="pc-stamina">⏱ Fresh: 0–${p.stamina.freshMax} PA</div>
      </div>
    </label>`).join('');

  const reliefOptions = Object.values(PITCHER_CHARACTERS).map(p => `
    <label class="card-option">
      <input type="radio" name="relief" value="${p.id}">
      <div class="player-card-mini" style="border-color:${p.color}">
        <div class="pc-name">${p.name}</div>
        <div class="pc-arch">${p.archetype}</div>
        <div class="pc-zones">Z1: <b>${p.zoneBonuses.z1>=0?'+':''}${p.zoneBonuses.z1}</b> &nbsp; Z2: <b>${p.zoneBonuses.z2>=0?'+':''}${p.zoneBonuses.z2}</b> &nbsp; Z3: <b>${p.zoneBonuses.z3>=0?'+':''}${p.zoneBonuses.z3}</b></div>
        <div class="pc-stamina">⏱ Fresh: 0–${p.stamina.freshMax} PA</div>
      </div>
    </label>`).join('');

  const lineupOptions = Object.entries(LINEUP_PRESETS).map(([key,lp]) => `
    <label class="card-option">
      <input type="radio" name="lineup" value="${key}">
      <div class="preset-card">
        <div class="pc-name">${lp.name}</div>
        <div class="pc-desc">${lp.desc}</div>
        <div class="lineup-mini">${lp.lineup.map(id => `<span class="batter-chip" style="border-color:${getBatter(id)?.color||'#888'}">${getBatter(id)?.name.replace(/"/g,'').split(' ')[0] || id}</span>`).join(' ')}</div>
      </div>
    </label>`).join('');

  const deckOptions = Object.entries(DECK_PRESETS).map(([key,dp]) => `
    <label class="card-option">
      <input type="radio" name="deck" value="${key}">
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

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      ${renderScoreHeader(gs, half, g.rosters)}

      <div class="game-body">
        <!-- Left: Active pitcher info -->
        <div class="sidebar left">
          ${renderPitcherPanel(pitcherChar, staminaState, gs.pitcherPAs[pitchingRole], iAmPitching, g.rosters[pitchingRole].reliefPitcher, gs.activePitcher[pitchingRole])}
        </div>

        <!-- Center: Zone board -->
        <div class="center-panel">
          <div class="pa-info">
            ${iAmBatting ? `<span class="role-badge batting">🏏 You are BATTING</span>` : `<span class="role-badge pitching">⚾ You are PITCHING</span>`}
            <span class="opponent-status">${oppCommitted ? '✅ Opponent locked in' : '⏳ Opponent placing…'}</span>
          </div>
          <div class="zone-board" id="zone-board">
            ${renderZoneBoard(pa, iAmBatting, myCommitted, 'placing')}
          </div>
          ${!myCommitted ? `
            <div class="placement-controls">
              <div class="placement-count">Cards placed: <b id="card-count">0</b> / ${maxCards} &nbsp;|&nbsp; Zones: max ${ZONE_LIMIT} per zone</div>
              <button class="btn-primary" onclick="commitPlacement()" id="lock-btn">🔒 Lock In</button>
            </div>` : `<div class="waiting-msg">✅ You're locked in. Waiting for opponent…</div>`}
        </div>

        <!-- Right: Active batter info -->
        <div class="sidebar right">
          ${renderBatterPanel(batterChar, battingRole === myRole, score, gs, half)}
        </div>
      </div>

      <!-- Hand -->
      ${!myCommitted ? renderHand(localHand, iAmBatting, iAmPitching) : ''}
    </div>`;

  updateCardCount();
  attachZoneClickHandlers(maxCards);

  // Substitution button (pitching side)
  if (iAmPitching && gs.activePitcher[pitchingRole] === g.rosters[pitchingRole].startingPitcher) {
    const reliefId = g.rosters[pitchingRole].reliefPitcher;
    document.querySelector('.sidebar.left')?.insertAdjacentHTML('beforeend', `
      <button class="btn-secondary sub-btn" onclick="substitutePitcher('${reliefId}')">⬅️ Bring in ${getPitcher(reliefId)?.name}</button>`);
  }
}

// ── REVEAL PHASE ─────────────────────────────────────────────────────────────
function renderReveal(g, gs, pa, pitcherChar, batterChar, pitchingRole, battingRole, half) {
  const res = pa.resolution;
  const staminaState = getPitcherStaminaState(pitcherChar, gs.pitcherPAs[pitchingRole]);

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      ${renderScoreHeader(gs, half, g.rosters)}
      <div class="game-body">
        <div class="sidebar left">${renderPitcherPanel(pitcherChar, staminaState, gs.pitcherPAs[pitchingRole], false)}</div>
        <div class="center-panel">
          <div class="pa-info"><span class="role-badge reveal">🃏 REVEAL</span></div>
          <div class="zone-board">
            ${renderZoneBoard(pa, battingRole===myRole, true, 'reveal', res)}
          </div>
          ${res ? renderOutcomeBanner(res) : '<p class="muted center">Resolving…</p>'}
          ${res ? `<button class="btn-primary" onclick="nextPA()">Next Batter →</button>` : ''}
        </div>
        <div class="sidebar right">${renderBatterPanel(batterChar, battingRole===myRole, {batting:gs.score[half], pitching:gs.score[half==='top'?'bottom':'top']}, gs, half)}</div>
      </div>
    </div>`;
}

// ── RESOLVED — same as reveal with next batter button ────────────────────────
function renderResolved(g, gs, pa, pitcherChar, batterChar, pitchingRole, battingRole, half) {
  renderReveal(g, gs, pa, pitcherChar, batterChar, pitchingRole, battingRole, half);
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE BOARD RENDERING
// ─────────────────────────────────────────────────────────────────────────────
function renderZoneBoard(pa, iAmBatting, myCommitted, phase, res) {
  const myKey  = myRole;
  const oppKey = opponentRole();
  const zones  = ['z1','z2','z3'];
  const labels = { z1:'ZONE 1 — THE READ', z2:'ZONE 2 — THE SWING', z3:'ZONE 3 — THE RESULT' };
  const revealed = phase === 'reveal' || phase === 'resolved';

  return `<div class="zones-container">
    ${zones.map(z => {
      const myPlaced  = localPlacement[z] || [];
      const oppPlaced = pa.placement?.[oppKey]?.[z] || [];
      let zClass = 'zone-column';
      if (revealed && res?.[z]?.winner) {
        zClass += res[z].winner === 'batter' ? ' zone-batter-win' : res[z].winner === 'pitcher' ? ' zone-pitcher-win' : '';
      }
      return `
        <div class="${zClass}" data-zone="${z}">
          <div class="zone-label">${labels[z]}</div>

          <!-- OPPONENT SIDE -->
          <div class="zone-half opponent-half">
            <div class="half-label">${iAmBatting ? '⚾ Pitcher' : '🏏 Batter'}</div>
            <div class="card-slots">
              ${revealed
                ? oppPlaced.map(id => renderActionCard(id, false, false, false, 'placed')).join('') || '<div class="slot-empty">—</div>'
                : oppPlaced.length > 0
                  ? oppPlaced.map(() => '<div class="card-slot hidden-card">?</div>').join('')
                  : '<div class="slot-empty muted">Empty</div>'
              }
            </div>
            ${revealed && res?.[z] ? `<div class="zone-total opp">${iAmBatting ? res[z].pitcherTotal : res[z].batterTotal}</div>` : ''}
          </div>

          <div class="zone-divider">${revealed && res?.[z] ? zoneWinLabel(res[z], iAmBatting) : '  vs  '}</div>

          <!-- MY SIDE -->
          <div class="zone-half my-half">
            <div class="half-label">${iAmBatting ? '🏏 Batter (You)' : '⚾ Pitcher (You)'}</div>
            <div class="card-slots" id="slots-${z}">
              ${myPlaced.map((id, idx) => `
                <div class="card-slot filled" data-zone="${z}" data-index="${idx}" onclick="${!myCommitted ? `removeFromZone('${z}', ${idx})` : ''}">
                  ${renderActionCard(id, false, false, !myCommitted, 'placed')}
                </div>`).join('')}
              ${!myCommitted && myPlaced.length < ZONE_LIMIT
                ? `<div class="card-slot empty drop-target" data-zone="${z}" onclick="placeSelectedCard('${z}')"></div>`
                : ''}
            </div>
            ${revealed && res?.[z] ? `<div class="zone-total mine">${iAmBatting ? res[z].batterTotal : res[z].pitcherTotal}</div>` : ''}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function zoneWinLabel(zr, iAmBatting) {
  if (!zr.winner || zr.winner === 'tie') return '<span class="zone-tie">TIE</span>';
  const youWin = (iAmBatting && zr.winner === 'batter') || (!iAmBatting && zr.winner === 'pitcher');
  return youWin ? `<span class="zone-you-win">✅ ${zr.margin}</span>` : `<span class="zone-opp-win">❌ ${zr.margin}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAND RENDERING
// ─────────────────────────────────────────────────────────────────────────────
function renderHand(handIds, iAmBatting, iAmPitching) {
  if (!handIds || handIds.length === 0) return '<div class="hand-area"><p class="muted">Hand empty — draw coming next PA</p></div>';

  return `<div class="hand-area">
    <div class="hand-label">YOUR HAND (click card → click zone slot)</div>
    <div class="hand-cards">
      ${handIds.map((id, idx) => {
        const card = getCard(id);
        if (!card) return '';
        const inPlacement = isInPlacement(id);
        const isActive = isCardActiveForRole(card, iAmBatting, iAmPitching) && !inPlacement;
        const isSelected = selectedCard === id;
        return `<div class="action-card ${isActive ? 'active' : 'inactive'} ${isSelected ? 'selected' : ''} ${inPlacement ? 'in-zone' : ''}"
          onclick="${isActive && !inPlacement ? `selectCard('${id}', ${idx})` : ''}"
          title="${card.desc}">
          <div class="card-zone-tag ${card.zone}">${card.zone.toUpperCase()}</div>
          <div class="card-name">${card.name}</div>
          <div class="card-value">${card.zone === 'any' && card.value === 0 ? '✨' : card.value}</div>
          <div class="card-type">${card.type.toUpperCase()}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
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

  // Remove placed cards from hand
  const placedAll = [...(localPlacement.z1||[]), ...(localPlacement.z2||[]), ...(localPlacement.z3||[])];
  const newHand = [...localHand];
  placedAll.forEach(id => {
    const idx = newHand.indexOf(id);
    if (idx > -1) newHand.splice(idx, 1);
  });

  // Write placement and committed flag + updated hand to Firebase
  gameRef(`currentPA/placement/${myRole}`).set(localPlacement);
  gameRef(`currentPA/committed/${myRole}`).set(true);
  gameRef(`gameState/hands/${myRole}`).set(newHand);

  localHand = newHand;

  // Check if opponent is already committed → resolve
  gameRef('currentPA').once('value', snap => {
    const pa = snap.val();
    if (pa.committed?.host && pa.committed?.guest) {
      if (myRole === 'host') resolveAndAdvance();
    }
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
    const g = snap.val();
    if (!g || g.currentPA.resolution) return; // already resolved
    if (!g.currentPA.committed?.host || !g.currentPA.committed?.guest) return;

    const gs   = g.gameState;
    const pa   = g.currentPA;
    const half = gs.half;
    const pitchingRole = half === 'top' ? 'host'  : 'guest';
    const battingRole  = half === 'top' ? 'guest' : 'host';

    const pitcherChar  = getPitcher(gs.activePitcher[pitchingRole]);
    const battingLineup= g.rosters[battingRole].lineup;
    const bIdx         = gs.batterIndex[half] % 9;
    const batterChar   = getBatter(battingLineup[bIdx]);

    const pitcherPlacement = pa.placement[pitchingRole];
    const batterPlacement  = pa.placement[battingRole];

    const score = { batting: gs.score[half], pitching: gs.score[half==='top'?'bottom':'top'] };

    const res = resolvePA({
      pitcherPlacement,
      batterPlacement,
      pitcherChar,
      batterChar,
      pitcherPAsFaced:    gs.pitcherPAs[pitchingRole],
      bases:              gs.bases,
      isFirstPAOfInning:  pa.isFirstPAOfInning,
      prevPitchCall:      gs.lastPitchCall[pitchingRole],
      score,
      outs:               gs.outs,
      inning:             gs.inning,
      totalInnings:       TOTAL_INNINGS,
      pitcherWonZ1LastPA: gs.lastPitcherWonZ1?.[pitchingRole] || false,
    });

    // Update game state based on outcome
    const outcome = res.outcome;
    let newOuts   = gs.outs + (outcome.outsAdded || 0);
    let newBases  = outcome.newBases || gs.bases;
    const newScore = { ...gs.score };
    newScore[half] = (newScore[half] || 0) + (outcome.runsScored || 0);

    // Hustle: runners advance +1 (adjust newBases)
    if (outcome.type !== 'out' && outcome.type !== 'k' && outcome.type !== 'dp' &&
        (batterPlacement.z3 || []).includes('B25') && outcome.runnersAdvance > 0) {
      // Re-advance all runners one more base (simplified)
      if (!newBases.third && newBases.second) { newBases = {...newBases, third:true, second:newBases.first, first:false}; }
      if (!newBases.second && newBases.first) { newBases = {...newBases, second:true, first:false}; }
    }

    const newBatterIndex = { ...gs.batterIndex, [half]: gs.batterIndex[half] + 1 };
    const newPitcherPAs  = { ...gs.pitcherPAs,  [pitchingRole]: gs.pitcherPAs[pitchingRole] + 1 };
    const newLastPitch   = { ...gs.lastPitchCall, [pitchingRole]: res.primaryPitchCall };

    let newInning = gs.inning;
    let newHalf   = gs.half;
    let nextPhase = 'play';
    let isFirstPA = false;

    if (newOuts >= 3) {
      newOuts = 0;
      newBases = { first:false, second:false, third:false };
      isFirstPA = true;

      if (gs.half === 'top') {
        newHalf = 'bottom';
      } else {
        newHalf = 'top';
        newInning = gs.inning + 1;
      }

      // Check game over
      if (newInning > TOTAL_INNINGS) {
        // Extra innings or game over
        const topScore = newScore.top;
        const botScore = newScore.bottom;
        if (topScore !== botScore) {
          nextPhase = 'gameover';
        }
        // If tied: continue to extra inning
      }
    }

    const updates = {
      'currentPA/resolution': res,
      'currentPA/phase':      nextPhase === 'gameover' ? 'resolved' : 'resolved',
      'gameState/outs':       newOuts,
      'gameState/bases':      newBases,
      'gameState/score':      newScore,
      'gameState/batterIndex':newBatterIndex,
      'gameState/pitcherPAs': newPitcherPAs,
      'gameState/lastPitchCall': newLastPitch,
      'gameState/half':       newHalf,
      'gameState/inning':     newInning,
    };

    if (nextPhase === 'gameover') {
      updates['phase'] = 'gameover';
    }

    gameRef().update(updates);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT PA
// ─────────────────────────────────────────────────────────────────────────────
function nextPA() {
  // Draw 1 card for each player
  gameRef().once('value', snap => {
    const g = snap.val();
    const gs = g.gameState;

    const updates = {};
    ['host','guest'].forEach(role => {
      let hand = [...(gs.hands[role] || [])];
      let deck = [...(gs.decks[role] || [])];
      let disc = [...(gs.discards[role] || [])];

      if (deck.length === 0) {
        deck = shuffleArray(disc);
        disc = [];
      }

      if (deck.length > 0) {
        hand.push(deck.shift());
        if (hand.length > MAX_HAND) { disc.push(hand.shift()); } // discard oldest if over max
      }

      updates[`gameState/hands/${role}`]    = hand;
      updates[`gameState/decks/${role}`]    = deck;
      updates[`gameState/discards/${role}`] = disc;
    });

    // Also move placed cards to discard
    const pa = g.currentPA;
    ['host','guest'].forEach(role => {
      const placed = [...(pa.placement[role].z1||[]), ...(pa.placement[role].z2||[]), ...(pa.placement[role].z3||[])];
      const disc = [...(updates[`gameState/discards/${role}`] || gs.discards[role] || [])];
      placed.forEach(id => disc.push(id));
      updates[`gameState/discards/${role}`] = disc;
    });

    // Determine next inning/half state (already updated by host in resolveAndAdvance)
    const isGameOver = g.phase === 'gameover';

    const newPA = {
      phase:    'placing',
      committed:{ host:false, guest:false },
      placement:{ host:{z1:[],z2:[],z3:[]}, guest:{z1:[],z2:[],z3:[]} },
      resolution: null,
      isFirstPAOfInning: pa.resolution?.newHalf !== g.gameState?.half, // rough check
    };

    if (!isGameOver) {
      updates['currentPA'] = newPA;
    }

    gameRef().update(updates);

    // Reset local placement
    localPlacement = { z1:[], z2:[], z3:[] };
    selectedCard   = null;
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
  const inningLabel = half === 'top' ? `▲ Inning ${gs.inning}` : `▼ Inning ${gs.inning}`;
  return `
    <div class="score-header">
      <div class="score-block">
        <div class="team-name">${rosters.guest?.name || 'Visitors'}</div>
        <div class="score-num">${gs.score.top}</div>
      </div>
      <div class="inning-block">
        <div class="inning-label">${inningLabel}</div>
        <div class="outs-display">${renderOuts(gs.outs)}</div>
        <div class="bases-display">${renderBases(gs.bases)}</div>
      </div>
      <div class="score-block">
        <div class="team-name">${rosters.host?.name || 'Home'}</div>
        <div class="score-num">${gs.score.bottom}</div>
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

function renderPitcherPanel(pitcherChar, staminaState, pasFaced, isMe, reliefId, activeId) {
  if (!pitcherChar) return '<div class="panel-empty">No pitcher</div>';
  const stateColor = staminaState === 'fresh' ? '#4CAF50' : staminaState === 'tiring' ? '#FF9800' : '#f44336';
  const maxPA = pitcherChar.stamina.tiringMax + 3;
  return `
    <div class="character-panel pitcher-panel" style="border-color:${pitcherChar.color}">
      <div class="cp-role">⚾ PITCHER ${isMe ? '(You)' : ''}</div>
      <div class="cp-name" style="color:${pitcherChar.color}">${pitcherChar.name}</div>
      <div class="cp-arch">${pitcherChar.archetype}</div>
      <div class="cp-zones-row">
        <span>Z1 <b>${pitcherChar.zoneBonuses.z1>=0?'+':''}${pitcherChar.zoneBonuses.z1}</b></span>
        <span>Z2 <b>${pitcherChar.zoneBonuses.z2>=0?'+':''}${pitcherChar.zoneBonuses.z2}</b></span>
        <span>Z3 <b>${pitcherChar.zoneBonuses.z3>=0?'+':''}${pitcherChar.zoneBonuses.z3}</b></span>
      </div>
      <div class="stamina-track">
        <div class="stamina-label" style="color:${stateColor}">⏱ ${staminaState.toUpperCase()} (PA ${pasFaced})</div>
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
  if (!batterChar) return '<div class="panel-empty">No batter</div>';
  const isTrailing = score.batting < score.pitching;
  return `
    <div class="character-panel batter-panel" style="border-color:${batterChar.color}">
      <div class="cp-role">🏏 BATTER ${isMe ? '(You)' : ''}</div>
      <div class="cp-name" style="color:${batterChar.color}">${batterChar.name}</div>
      <div class="cp-arch">${batterChar.archetype}</div>
      <div class="cp-zones-row">
        <span>Z1 <b>${batterChar.zoneBonuses.z1>=0?'+':''}${batterChar.zoneBonuses.z1}</b></span>
        <span>Z2 <b>${batterChar.zoneBonuses.z2>=0?'+':''}${batterChar.zoneBonuses.z2}</b></span>
        <span>Z3 <b>${batterChar.zoneBonuses.z3>=0?'+':''}${batterChar.zoneBonuses.z3}</b></span>
      </div>
      ${isTrailing ? `<div class="trailing-badge">⚡ TRAILING</div>` : ''}
      ${gs.bases.second || gs.bases.third ? `<div class="risp-badge">🏃 RISP</div>` : ''}
      <div class="cp-special">${batterChar.specialText}</div>
    </div>`;
}

function renderOutcomeBanner(res) {
  if (!res?.outcome) return '';
  const o = res.outcome;
  const typeClass = { hr:'outcome-hr', triple:'outcome-hit', double:'outcome-hit', single:'outcome-hit', walk:'outcome-walk', k:'outcome-k', dp:'outcome-k', out:'outcome-out' }[o.type] || '';
  return `
    <div class="outcome-banner ${typeClass}">
      <div class="outcome-display">${o.display}</div>
      ${o.runsScored > 0 ? `<div class="runs-scored">🏠 ${o.runsScored} run${o.runsScored!==1?'s':''} score!</div>` : ''}
    </div>
    <div class="resolution-detail">
      ${res.z1?.winner ? `<div class="zone-result">Z1: ${res.z1.batterTotal} vs ${res.z1.pitcherTotal} → ${res.z1.winner.toUpperCase()}${res.z1.counterFired ? ` 🎯 Counter ×${res.z1.mult} (${res.z1.pitchCallMatched})` : ''}</div>` : ''}
      ${res.z2?.winner ? `<div class="zone-result">Z2: ${res.z2.batterTotal} vs ${res.z2.pitcherTotal} → ${res.z2.winner.toUpperCase()}${res.z2.hardContact ? ' 🔥 Hard Contact!' : ''}</div>` : ''}
      ${res.z3?.winner ? `<div class="zone-result">Z3: ${res.z3.batterTotal} vs ${res.z3.pitcherTotal} → ${res.z3.winner.toUpperCase()}</div>` : ''}
      ${res.advantageSide !== 'neutral' ? `<div class="adv-score">Advantage: ${res.advantageSide.toUpperCase()} — Score: ${res.advantageScore}</div>` : ''}
    </div>
    <details class="log-details"><summary>Resolution Log</summary><pre>${(res.log||[]).join('\n')}</pre></details>`;
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

// Cache last game state for re-renders triggered by card clicks
const _origHandleGameState = typeof handleGameState !== 'undefined' ? handleGameState : null;

// Patch handleGameState to cache
window._lastGameState = null;
const _rawHandle = handleGameState;
function handleGameState(g) {
  window._lastGameState = g;
  _rawHandle(g);
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
    const g = snap.val();
    if (!g) { showError('Game not found.'); return; }
    window._lastGameState = g;
    handleGameState(g);
  });

  watchForBothCommitted();
});
