// app.js - Simple mobile prototype for Full Count V2
// Loads card data, displays cards, and handles power usage with momentum die degradation.

// Utility: dice roll 1‑6
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

// Load cards JSON
async function loadCards() {
  const resp = await fetch('cards_v2.json');
  if (!resp.ok) {
    log(`Failed to load cards: ${resp.status}`);
    return [];
  }
  const data = await resp.json();
  // Initialize runtime state for each card
  return data.map(card => ({
    ...card,
    usesLeft: card.maxUses,
    // momentum tiers: 0 = d8, 1 = d6, 2 = d4, 3 = none
    momentumTier: 0,
    id: `${card.name.replace(/\s+/g, '_')}_${Date.now()}`
  }));
}

function momentumLabel(tier) {
  const labels = ['d8', 'd6', 'd4', 'none'];
  return labels[tier] || 'none';
}

function log(message) {
  const logEl = document.getElementById('log');
  const line = document.createElement('div');
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${message}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function renderCards(cards) {
  const container = document.getElementById('cardContainer');
  container.innerHTML = '';
  cards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerHTML = `
      <h3>${card.name}</h3>
      <p><strong>Position:</strong> ${card.position}</p>
      <p><strong>Power:</strong> ${card.power}</p>
      <p><strong>Uses left:</strong> <span id="uses-${card.id}">${card.usesLeft}</span></p>
      <p><strong>Momentum die:</strong> <span id="mom-${card.id}">${momentumLabel(card.momentumTier)}</span></p>
      <button class="btn" id="btn-${card.id}">Use Power</button>
    `;
    container.appendChild(cardEl);

    // Attach click handler
    document.getElementById(`btn-${card.id}`).addEventListener('click', () => {
      if (card.usesLeft <= 0) {
        log(`${card.name} has no power uses remaining.`);
        return;
      }
      const roll = rollD6();
      log(`${card.name} rolls d6 → ${roll}`);
      const success = roll >= 4; // 4‑6 is success
      if (success) {
        log(`✅ Success! ${card.power}`);
      } else {
        log(`❌ Failure – momentum die degrades.`);
        // degrade momentum
        if (card.momentumTier < 3) card.momentumTier += 1;
      }
      // consume a use
      card.usesLeft -= 1;
      // update UI
      document.getElementById(`uses-${card.id}`).textContent = card.usesLeft;
      document.getElementById(`mom-${card.id}`).textContent = momentumLabel(card.momentumTier);
    });
  });
}

// Main init
(async () => {
  const cards = await loadCards();
  renderCards(cards);
  log('Prototype loaded – tap a "Use Power" button to play.');
})();
