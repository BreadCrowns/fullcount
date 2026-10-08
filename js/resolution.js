'use strict';
// resolution.js — Pure game resolution logic. No side effects. No Firebase.

// ─────────────────────────────────────────────────────────────────────────────
// PITCH SWEET SPOT CENTERS & RANGES (Values 1-6)
// Idea 3 & 4: Pitch Centers (Offspeed 6, Breaking 9, Fastball 12) + Plate Coverage Expansion
// ─────────────────────────────────────────────────────────────────────────────
const PITCH_SWEET_SPOTS = {
  offspeed: {
    center: 6,
    baseBarrel: [5, 7],
    lineDrive: [4, 4],
    name: 'Offspeed',
    icon: '⏱️',
    desc: 'Touch & Deception (Sweet Spot Center: 6)'
  },
  breaking: {
    center: 9,
    baseBarrel: [8, 10],
    lineDrive: [6, 7],
    name: 'Breaking',
    icon: '🌀',
    desc: 'Bite & Spin (Sweet Spot Center: 9)'
  },
  fastball: {
    center: 12,
    baseBarrel: [11, 13],
    lineDrive: [9, 10],
    name: 'Fastball',
    icon: '🔥',
    desc: 'Velocity & Heat (Sweet Spot Center: 12)'
  }
};

const PITCH_RANGES = {
  offspeed: { min: 1, max: 3, label: '1–3 (Touch & Deception)', name: 'Offspeed', icon: '⏱️' },
  breaking: { min: 2, max: 5, label: '2–5 (Bite & Spin)',        name: 'Breaking', icon: '🌀' },
  fastball: { min: 4, max: 6, label: '4–6 (Velocity & Heat)',  name: 'Fastball', icon: '🔥' }
};

const SWING_RANGES = {
  contact:  { min: 1, max: 3, label: '1–3 (Choke Up / Wait Back)', name: 'Contact',  icon: '🛡️' },
  balanced: { min: 2, max: 5, label: '2–5 (Controlled Timing)',    name: 'Balanced', icon: '⚖️' },
  power:    { min: 4, max: 6, label: '4–6 (Turn on the Ball)',    name: 'Power',    icon: '💥' }
};

if (typeof window !== 'undefined') {
  window.PITCH_SWEET_SPOTS = PITCH_SWEET_SPOTS;
  window.PITCH_RANGES = PITCH_RANGES;
  window.SWING_RANGES = SWING_RANGES;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE VALUE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

function getZoneValue(card, targetZone) {
  if (!card) return 0;
  return card.value || 0;
}


// Sum effective values for a list of card IDs played in a given zone.
function sumZone(cardIds, zoneName) {
  return (cardIds || []).reduce((sum, id) => {
    const c = getCard(id);
    return sum + (c ? getZoneValue(c, zoneName) : 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER CHECK — ZONE 1
// ─────────────────────────────────────────────────────────────────────────────

// Returns { multiplier, counterFired, counterCardId, pitchCallMatched }
// Multiplier applies to batter's Z1 ACTION card total only (not player bonus).
function checkZ1Counter(batterZ1Ids, pitcherZ1Ids, pitcherChar) {
  // Collect pitch calls from pitcher Z1 cards
  const pitchCalls = (pitcherZ1Ids || [])
    .map(id => getCard(id))
    .filter(c => c && c.pitchCall)
    .map(c => c.pitchCall);

  // Check immune pitches (Knuckleball / Eephus — also handled by PC05 special)
  const immunePitches = pitchCalls.filter(pc => pc === 'knuckleball' || pc === 'eephus');
  if (pitchCalls.length > 0 && pitchCalls.every(pc => pc === 'knuckleball' || pc === 'eephus')) {
    return { multiplier:1.0, counterFired:false, counterCardId:null, pitchCallMatched:null };
  }
  const nonImmunePitches = pitchCalls.filter(pc => pc !== 'knuckleball' && pc !== 'eephus');

  // Medina (PC02) reduces counter multipliers by 0.25
  const counterReduction = (pitcherChar && pitcherChar.id === 'PC02') ? 0.25 : 0;

  let bestMult = 1.0;
  let counterFired = false;
  let counterCardId = null;
  let pitchCallMatched = null;

  for (const batterId of (batterZ1Ids || [])) {
    const bCard = getCard(batterId);
    if (!bCard || !bCard.counters || bCard.counters.length === 0) continue;

    // BC12 (The Bricks): only B1 Guess Fastball counter fires
    // (Handled by disabling other cards in the caller, but we filter here too)

    for (const pc of nonImmunePitches) {
      if (bCard.counters.includes(pc)) {
        let mult;
        if (typeof bCard.counterMult === 'number') {
          mult = bCard.counterMult;
        } else {
          mult = (bCard.counterMult || {})[pc] || 1.0;
        }
        mult = Math.max(1.0, mult - counterReduction);
        if (mult > bestMult) {
          bestMult = mult;
          counterFired = true;
          counterCardId = batterId;
          pitchCallMatched = pc;
        }
      }
    }
  }

  return { multiplier: bestMult, counterFired, counterCardId, pitchCallMatched };
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 3 DEFENSE COUNTERS
// ─────────────────────────────────────────────────────────────────────────────

// Returns total penalty (negative number) to subtract from batter Z3 action total.
function checkZ3Counters(batterZ3Ids, pitcherZ3Ids, pitcherZ2Ids) {
  let totalPenalty = 0;

  // Collect all pitcher defense cards (Z3 + Backdoor Breaking Ball from Z2)
  const pitcherDefenseCards = [
    ...(pitcherZ3Ids || []).map(id => getCard(id)),
    ...(pitcherZ2Ids || []).map(id => getCard(id)),
  ].filter(c => c && c.z3CounterOf !== undefined);

  // Inside-Out Swing (B19) in batter Z2 reduces shift card penalties by 6
  const hasInsideOut = (pitcherZ2Ids || []).includes('B19') || false;
  // Note: B19 is a batter card, so it'll be in batterZ2, not pitcherZ2. Fixed in resolvePA.

  for (const batterId of (batterZ3Ids || [])) {
    const bCard = getCard(batterId);
    if (!bCard || !bCard.z3CounteredBy) continue;

    for (const pDef of pitcherDefenseCards) {
      if (bCard.z3CounteredBy.includes(pDef.id)) {
        let pen = pDef.penalty || 0;
        totalPenalty += pen;
      }
    }
  }

  return totalPenalty;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNERS & BASES HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function countRunners(bases) {
  return (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0);
}

// Returns runs scored when all runners advance 'spaces' bases (batter occupies 1st).
function runsOnHit(bases, spaces) {
  let runs = 0;
  if (spaces >= 1 && bases.third)  runs++;
  if (spaces >= 2 && bases.second) runs++;
  if (spaces >= 3 && bases.first)  runs++;
  return runs;
}

// Returns new bases state after a hit where batter takes 'spaces' bases.
function advanceBases(bases, spaces) {
  const newBases = { first:false, second:false, third:false };
  if (spaces === 1) {
    newBases.first  = true;
    newBases.second = bases.first;
    newBases.third  = bases.second;
    // bases.third scores (handled by runsOnHit)
  } else if (spaces === 2) {
    newBases.second = true;
    newBases.third  = bases.first;
    // bases.second and third score
  } else if (spaces === 3) {
    newBases.third = true;
    // everyone scores
  } else if (spaces >= 4) {
    // HR — all clear
  }
  return newBases;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTCOME TABLE
// Returns { type, display, runsScored, outsAdded, newBases, extraAdvance }
// extraAdvance: additional base for all runners (Hustle effect)
// ─────────────────────────────────────────────────────────────────────────────

function getOutcome(advantageScore, side, bases) {
  const r = Math.random();
  const rollPct = Math.round(r * 100);

  if (side === 'neutral' || advantageScore < 1) {
    return {
      type: 'out',
      display: 'Groundout',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases, first: false },
      rng: {
        rollPct: 0,
        tier: 'Neutral Advantage (Score < 1)',
        odds: [{ label: 'Groundout', pct: 100, range: '0–100%' }]
      }
    };
  }

  if (side === 'batter') {
    if (advantageScore >= 50) {
      return {
        type: 'hr',
        display: '🚀 HOME RUN!',
        runsScored: 1 + countRunners(bases),
        outsAdded: 0,
        newBases: { first: false, second: false, third: false },
        rng: {
          rollPct,
          tier: 'Batter Advantage 50+ (Maximum Power)',
          odds: [{ label: 'Home Run 🚀', pct: 100, range: '0–100%' }]
        }
      };
    }
    if (advantageScore >= 40) {
      const odds = [
        { label: 'Home Run 💥', pct: 55, range: '0–54%' },
        { label: 'Triple 🔥', pct: 45, range: '55–99%' }
      ];
      if (r < 0.55) {
        return {
          type: 'hr',
          display: '💥 HOME RUN!',
          runsScored: 1 + countRunners(bases),
          outsAdded: 0,
          newBases: { first: false, second: false, third: false },
          rng: { rollPct, tier: 'Batter Advantage 40–49 (Elite Contact)', odds }
        };
      }
      return {
        type: 'triple',
        display: '🔥 TRIPLE!',
        runsScored: runsOnHit(bases, 3),
        outsAdded: 0,
        newBases: advanceBases(bases, 3),
        rng: { rollPct, tier: 'Batter Advantage 40–49 (Elite Contact)', odds }
      };
    }
    if (advantageScore >= 30) {
      const odds = [
        { label: 'Home Run ⚾', pct: 15, range: '0–14%' },
        { label: 'Triple 🔥', pct: 35, range: '15–49%' },
        { label: 'Double ⚡', pct: 50, range: '50–99%' }
      ];
      if (r < 0.15) {
        return {
          type: 'hr',
          display: '⚾ HOME RUN!',
          runsScored: 1 + countRunners(bases),
          outsAdded: 0,
          newBases: { first: false, second: false, third: false },
          rng: { rollPct, tier: 'Batter Advantage 30–39 (Extra-Base Power)', odds }
        };
      }
      if (r < 0.50) {
        return {
          type: 'triple',
          display: '🔥 TRIPLE!',
          runsScored: runsOnHit(bases, 3),
          outsAdded: 0,
          newBases: advanceBases(bases, 3),
          rng: { rollPct, tier: 'Batter Advantage 30–39 (Extra-Base Power)', odds }
        };
      }
      return {
        type: 'double',
        display: 'Double!',
        runsScored: runsOnHit(bases, 2),
        outsAdded: 0,
        newBases: advanceBases(bases, 2),
        rng: { rollPct, tier: 'Batter Advantage 30–39 (Extra-Base Power)', odds }
      };
    }
    if (advantageScore >= 20) {
      const odds = [
        { label: 'Double ⚡', pct: 40, range: '0–39%' },
        { label: 'Single', pct: 35, range: '40–74%' },
        { label: 'Hard Out', pct: 25, range: '75–99%' }
      ];
      if (r < 0.40) {
        return {
          type: 'double',
          display: 'Double!',
          runsScored: runsOnHit(bases, 2),
          outsAdded: 0,
          newBases: advanceBases(bases, 2),
          rng: { rollPct, tier: 'Batter Advantage 20–29 (Solid Hit)', odds }
        };
      }
      if (r < 0.75) {
        return {
          type: 'single',
          display: 'Single!',
          runsScored: runsOnHit(bases, 1),
          outsAdded: 0,
          newBases: advanceBases(bases, 1),
          rng: { rollPct, tier: 'Batter Advantage 20–29 (Solid Hit)', odds }
        };
      }
      return {
        type: 'out',
        display: 'Hard hit — out at 1st',
        runsScored: 0,
        outsAdded: 1,
        newBases: { ...bases },
        rng: { rollPct, tier: 'Batter Advantage 20–29 (Solid Hit)', odds }
      };
    }
    if (advantageScore >= 10) {
      const rbi = bases.second || bases.third;
      const odds = [
        { label: 'Single', pct: 50, range: '0–49%' },
        { label: 'Flyout', pct: 30, range: '50–79%' },
        { label: rbi ? 'RBI Single' : 'Single', pct: 20, range: '80–99%' }
      ];
      if (r < 0.50) {
        return {
          type: 'single',
          display: 'Single!',
          runsScored: runsOnHit(bases, 1),
          outsAdded: 0,
          newBases: advanceBases(bases, 1),
          rng: { rollPct, tier: 'Batter Advantage 10–19 (Contact Chance)', odds }
        };
      }
      if (r < 0.80) {
        return {
          type: 'out',
          display: 'Flyout',
          runsScored: 0,
          outsAdded: 1,
          newBases: { ...bases },
          rng: { rollPct, tier: 'Batter Advantage 10–19 (Contact Chance)', odds }
        };
      }
      return {
        type: 'single',
        display: rbi ? 'RBI Single!' : 'Single!',
        runsScored: runsOnHit(bases, 1),
        outsAdded: 0,
        newBases: advanceBases(bases, 1),
        rng: { rollPct, tier: 'Batter Advantage 10–19 (Contact Chance)', odds }
      };
    }
    // 1–9
    const odds = [
      { label: 'Infield Single', pct: 30, range: '0–29%' },
      { label: 'Weak Groundout', pct: 70, range: '30–99%' }
    ];
    if (r < 0.30) {
      return {
        type: 'single',
        display: 'Infield Single!',
        runsScored: 0,
        outsAdded: 0,
        newBases: advanceBases(bases, 1),
        rng: { rollPct, tier: 'Batter Advantage 1–9 (Weak Advantage)', odds }
      };
    }
    return {
      type: 'out',
      display: 'Weak Groundout',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: { rollPct, tier: 'Batter Advantage 1–9 (Weak Advantage)', odds }
    };
  }

  // Pitcher advantage
  if (advantageScore >= 50) {
    return {
      type: 'k',
      display: '⚡ STRIKEOUT! (Dominant)',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: { rollPct, tier: 'Pitcher Advantage 50+ (Absolute Dominance)', odds: [{ label: 'Strikeout ⚡', pct: 100, range: '0–100%' }] }
    };
  }
  if (advantageScore >= 40) {
    return {
      type: 'k',
      display: '⚡ STRIKEOUT! Punchout!',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: { rollPct, tier: 'Pitcher Advantage 40–49 (Elite Strikeout)', odds: [{ label: 'Strikeout ⚡', pct: 100, range: '0–100%' }] }
    };
  }
  if (advantageScore >= 30) {
    return {
      type: 'k',
      display: '⚡ STRIKEOUT!',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: { rollPct, tier: 'Pitcher Advantage 30–39 (High Strikeout)', odds: [{ label: 'Strikeout ⚡', pct: 100, range: '0–100%' }] }
    };
  }
  if (advantageScore >= 20) {
    const odds = [
      { label: 'Strikeout ⚡', pct: 60, range: '0–59%' },
      { label: 'Groundout', pct: 40, range: '60–99%' }
    ];
    if (r < 0.60) {
      return {
        type: 'k',
        display: 'Strikeout',
        runsScored: 0,
        outsAdded: 1,
        newBases: { ...bases },
        rng: { rollPct, tier: 'Pitcher Advantage 20–29 (Put-Away Count)', odds }
      };
    }
    return {
      type: 'out',
      display: 'Groundout',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: { rollPct, tier: 'Pitcher Advantage 20–29 (Put-Away Count)', odds }
    };
  }
  if (advantageScore >= 10) {
    const odds = [
      { label: 'Groundout / Flyout', pct: 75, range: '0–74%' },
      { label: 'Weak Single', pct: 25, range: '75–99%' }
    ];
    if (r < 0.75) {
      return {
        type: 'out',
        display: 'Groundout / Flyout',
        runsScored: 0,
        outsAdded: 1,
        newBases: { ...bases },
        rng: { rollPct, tier: 'Pitcher Advantage 10–19 (Pitcher In-Play)', odds }
      };
    }
    return {
      type: 'single',
      display: 'Weak Single',
      runsScored: 0,
      outsAdded: 0,
      newBases: advanceBases(bases, 1),
      rng: { rollPct, tier: 'Pitcher Advantage 10–19 (Pitcher In-Play)', odds }
    };
  }
  // 1–9
  const odds = [
    { label: 'Groundout', pct: 90, range: '0–89%' },
    { label: 'Bloop Single', pct: 10, range: '90–99%' }
  ];
  if (r < 0.10) {
    return {
      type: 'single',
      display: 'Bloop Single',
      runsScored: 0,
      outsAdded: 0,
      newBases: advanceBases(bases, 1),
      rng: { rollPct, tier: 'Pitcher Advantage 1–9 (Low Pitcher Edge)', odds }
    };
  }
  return {
    type: 'out',
    display: 'Groundout',
    runsScored: 0,
    outsAdded: 1,
    newBases: { ...bases },
    rng: { rollPct, tier: 'Pitcher Advantage 1–9 (Low Pitcher Edge)', odds }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLUTION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a full Plate Appearance from both players' placements.
 * @param {object} opts
 *   pitcherPlacement: { z1:[], z2:[], z3:[] }
 *   batterPlacement:  { z1:[], z2:[], z3:[] }
 *   pitcherChar:      PITCHER_CHARACTERS entry
 *   batterChar:       BATTER_CHARACTERS entry
 *   pitcherPAsFaced:  number (before this PA — used for stamina state)
 *   bases:            { first:bool, second:bool, third:bool }
 *   isFirstPAOfInning: bool
 *   prevPitchCall:    string|null (last PA's pitch call, for Sequence Breaker)
 *   score:            { batting:number, pitching:number } (from perspective of batting team)
 *   outs:             number (current outs before this PA)
 *   inning:           number
 *   totalInnings:     number
 *   pitcherWonZ1LastPA: bool (for Barrett clutch penalty)
 */
function resolvePA(opts) {
  const {
    pitcherPlacement, batterPlacement,
    pitcherChar, batterChar,
    pitcherPAsFaced,
    bases, isFirstPAOfInning,
    prevPitchCall, score, outs, inning, totalInnings,
    pitcherWonZ1LastPA,
  } = opts;

  const log = [];
  const staminaMod = getStaminaMod(pitcherChar, pitcherPAsFaced);
  const staminaState = getPitcherStaminaState(pitcherChar, pitcherPAsFaced);

  // Collect pitcher Z1 pitch type cards
  const pitchTypeCards = (pitcherPlacement.z1 || []).map(id => getCard(id)).filter(c => c && c.pitchCall);
  const primaryPitchCall = pitchTypeCards[0]?.pitchCall || null;

  // ── ZONE 1 ─────────────────────────────────────────────────────────────────
  let pitcherZ1Action = sumZone(pitcherPlacement.z1, 'z1');
  let batterZ1Action  = sumZone(batterPlacement.z1,  'z1');

  // Pitch affinity — Zone 1
  let affinityZ1 = 0;
  for (const aff of (pitcherChar.pitchAffinity || [])) {
    if (aff.zone === 'z1' && pitchTypeCards.some(c => c.pitchCall === aff.pitchCall)) {
      affinityZ1 += aff.bonus;
    }
  }
  pitcherZ1Action += affinityZ1;

  // Stamina modifier — Zone 1
  pitcherZ1Action += staminaMod.z1;

  // Barrett clutch penalty — lost Zone 1 last PA
  if (batterChar.id === 'BC04' && pitcherWonZ1LastPA) {
    batterZ1Action = Math.max(0, batterZ1Action - 2);
    log.push('Barrett: lost Z1 last PA → own Z1 −2');
  }

  // First PA of inning bonus (B8)
  if (isFirstPAOfInning && batterPlacement.z1.includes('B8')) {
    batterZ1Action += 5;
    log.push('First Pitch Aggressor: +5');
  }

  // Counter check
  const counterResult = checkZ1Counter(batterPlacement.z1, pitcherPlacement.z1, pitcherChar);

  // Apply counter multiplier to ACTION total only (not player card bonus)
  const batterZ1ActionMultiplied = batterZ1Action * counterResult.multiplier;

  // Player card zone bonuses
  const pitcherZ1Bonus = pitcherChar.zoneBonuses.z1;
  let   batterZ1Bonus  = batterChar.zoneBonuses.z1;

  // Read affinity: counter fired → zone bonus
  let readAffinityBonus = { z1:0, z2:0, z3:0 };
  if (counterResult.counterFired && batterChar.readAffinity) {
    const ra = batterChar.readAffinity;
    if (ra.trigger === 'any_counter' || ra.trigger === counterResult.counterCardId) {
      const [eff, val] = (ra.effect || '').split(':');
      if (eff === 'z3_bonus')      readAffinityBonus.z3 += parseInt(val);
      if (eff === 'z2_bonus')      readAffinityBonus.z2 += parseInt(val);
      if (eff === 'all_zones_bonus') { const v=parseInt(val); readAffinityBonus.z1+=v; readAffinityBonus.z2+=v; readAffinityBonus.z3+=v; }
      log.push(`Read Affinity (${batterChar.name}): effect ${ra.effect}`);
    }
  }
  batterZ1Bonus += readAffinityBonus.z1;

  // Smoke first-3-PA bonus (+2 all zones)
  const smokeBonus = (pitcherChar.id === 'PC04' && pitcherPAsFaced < 3) ? 2 : 0;

  const pitcherZ1Total = pitcherZ1Action + pitcherZ1Bonus + smokeBonus;
  const batterZ1Total  = batterZ1ActionMultiplied + batterZ1Bonus;
  const z1Margin       = batterZ1Total - pitcherZ1Total;
  const z1Winner       = z1Margin > 0 ? 'batter' : (z1Margin < 0 ? 'pitcher' : 'tie');

  log.push(`Z1 — Pitcher: ${Math.round(pitcherZ1Total)}  Batter: ${Math.round(batterZ1Total)}  → ${z1Winner.toUpperCase()} (margin: ${Math.round(Math.abs(z1Margin))})${counterResult.counterFired ? ` 🎯 COUNTER ×${counterResult.multiplier} (${counterResult.pitchCallMatched})` : ''}`);

  // ── WALK THRESHOLD ──────────────────────────────────────────────────────────
  let walkThreshold = 10;
  if (batterChar.id === 'BC03' && batterPlacement.z1.includes('B4')) walkThreshold = 7; // Nakamura + Patient Eye
  if (batterPlacement.z1.includes('B4') && !(batterChar.id === 'BC03'))
    log.push('Patient Eye: walk probability +10% (flavour)');

  if (z1Margin >= walkThreshold) {
    const outcome = {
      type: 'walk',
      display: '🟡 WALK — Ball four!',
      runsScored: 0,
      outsAdded: 0,
      newBases: advanceBases(bases, 1),
      rng: {
        rollPct: 0,
        tier: `Zone 1 Knockout: Batter Margin ${Math.round(z1Margin)} ≥ ${walkThreshold}`,
        odds: [{ label: 'Walk 🟡', pct: 100, range: 'Instant' }],
        isTrigger: true
      }
    };
    log.push(`TRIGGER: Walk (margin ${Math.round(z1Margin)} ≥ ${walkThreshold})`);
    return buildResult({
      z1: {
        pitcherTotal: Math.round(pitcherZ1Total), batterTotal: Math.round(batterZ1Total),
        margin: Math.round(Math.abs(z1Margin)), winner: z1Winner,
        pitcherCards: [...(pitcherPlacement.z1 || [])], batterCards: [...(batterPlacement.z1 || [])],
        counterFired: counterResult.counterFired, counterCardId: counterResult.counterCardId,
        pitchCallMatched: counterResult.pitchCallMatched, mult: counterResult.multiplier,
        cascadeEffect: 'walk'
      },
      z2: { pitcherTotal: 0, batterTotal: 0, margin: 0, winner: 'none', pitcherCards: [], batterCards: [], cascadeEffect: 'Skipped (Walk)' },
      z3: { pitcherTotal: 0, batterTotal: 0, margin: 0, winner: 'none', pitcherCards: [], batterCards: [], cascadeEffect: 'Skipped (Walk)' },
      zonesWon: { batter: 1, pitcher: 0 },
      trigger: 'walk', advantageSide: 'batter', advantageScore: Math.round(batterZ1Total), outcome, log, staminaState, primaryPitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher', batterCharName: batterChar?.name || 'Batter'
    });
  }
  if (-z1Margin >= 10) {
    const outcome = {
      type: 'k',
      display: '⚫ Called Strike 3!',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: {
        rollPct: 0,
        tier: `Zone 1 Knockout: Pitcher Margin ${Math.round(-z1Margin)} ≥ 10`,
        odds: [{ label: 'Called Strike 3 ⚫', pct: 100, range: 'Instant' }],
        isTrigger: true
      }
    };
    log.push(`TRIGGER: Called Strike 3 (pitcher margin ${Math.round(-z1Margin)} ≥ 10)`);
    return buildResult({
      z1: {
        pitcherTotal: Math.round(pitcherZ1Total), batterTotal: Math.round(batterZ1Total),
        margin: Math.round(Math.abs(z1Margin)), winner: z1Winner,
        pitcherCards: [...(pitcherPlacement.z1 || [])], batterCards: [...(batterPlacement.z1 || [])],
        counterFired: counterResult.counterFired, counterCardId: counterResult.counterCardId,
        pitchCallMatched: counterResult.pitchCallMatched, mult: counterResult.multiplier,
        cascadeEffect: 'called_k'
      },
      z2: { pitcherTotal: 0, batterTotal: 0, margin: 0, winner: 'none', pitcherCards: [], batterCards: [], cascadeEffect: 'Skipped (Called K)' },
      z3: { pitcherTotal: 0, batterTotal: 0, margin: 0, winner: 'none', pitcherCards: [], batterCards: [], cascadeEffect: 'Skipped (Called K)' },
      zonesWon: { batter: 0, pitcher: 1 },
      trigger: 'called_k', advantageSide: 'pitcher', advantageScore: Math.round(pitcherZ1Total), outcome, log, staminaState, primaryPitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher', batterCharName: batterChar?.name || 'Batter'
    });
  }

  // ── ZONE 2 ─────────────────────────────────────────────────────────────────
  let pitcherZ2Action = sumZone(pitcherPlacement.z2, 'z2');
  let batterZ2Action  = sumZone(batterPlacement.z2,  'z2');

  // Zone 1 inheritance: winner gets +3 in Zone 2
  if (z1Winner === 'pitcher') { pitcherZ2Action += 3; log.push('Z1 inheritance: Pitcher +3 Z2'); }
  else if (z1Winner === 'batter') { batterZ2Action += 3; log.push('Z1 inheritance: Batter +3 Z2'); }

  // Pitch affinity — Zone 2
  let affinityZ2 = 0;
  for (const aff of (pitcherChar.pitchAffinity || [])) {
    if (aff.zone === 'z2' && pitchTypeCards.some(c => c.pitchCall === aff.pitchCall)) {
      affinityZ2 += aff.bonus;
      log.push(`Pitch affinity Z2 (${pitcherChar.name}): +${aff.bonus}`);
    }
  }
  pitcherZ2Action += affinityZ2;

  // Stamina modifier — Zone 2
  pitcherZ2Action += staminaMod.z2;

  // Player card Z2 bonuses
  const pitcherZ2Bonus = pitcherChar.zoneBonuses.z2 + smokeBonus;
  let   batterZ2Bonus  = batterChar.zoneBonuses.z2 + readAffinityBonus.z2;

  const pitcherZ2Total = pitcherZ2Action + pitcherZ2Bonus;
  const batterZ2Total  = batterZ2Action  + batterZ2Bonus;
  const z2Margin       = batterZ2Total - pitcherZ2Total;
  const hardContact    = z2Margin >= 15;
  const z2Winner       = z2Margin > 0 ? 'batter' : (z2Margin < 0 ? 'pitcher' : 'tie');

  log.push(`Z2 — Pitcher: ${Math.round(pitcherZ2Total)}  Batter: ${Math.round(batterZ2Total)}  → ${z2Winner.toUpperCase()} (margin: ${Math.round(Math.abs(z2Margin))})${hardContact ? ' 🔥 HARD CONTACT!' : ''}`);

  // Strikeout Swinging trigger
  const kImmune = (batterPlacement.z2 || []).some(id => ['B13','B16'].includes(id)) || batterChar.id === 'BC02';
  if (-z2Margin >= 15 && !kImmune) {
    const outcome = {
      type: 'k',
      display: '⚡ STRIKEOUT SWINGING!',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: {
        rollPct: 0,
        tier: `Zone 2 Knockout: Pitcher Margin ${Math.round(-z2Margin)} ≥ 15`,
        odds: [{ label: 'Strikeout Swinging ⚡', pct: 100, range: 'Instant' }],
        isTrigger: true
      }
    };
    log.push('TRIGGER: Strikeout Swinging (pitcher margin ≥ 15)');
    return buildResult({
      z1: {
        pitcherTotal: Math.round(pitcherZ1Total), batterTotal: Math.round(batterZ1Total),
        margin: Math.round(Math.abs(z1Margin)), winner: z1Winner,
        pitcherCards: [...(pitcherPlacement.z1 || [])], batterCards: [...(batterPlacement.z1 || [])],
        counterFired: counterResult.counterFired, counterCardId: counterResult.counterCardId,
        pitchCallMatched: counterResult.pitchCallMatched, mult: counterResult.multiplier,
        cascadeEffect: z1Winner !== 'tie' ? `+3 momentum into Zone 2 for ${z1Winner}` : 'None'
      },
      z2: {
        pitcherTotal: Math.round(pitcherZ2Total), batterTotal: Math.round(batterZ2Total),
        margin: Math.round(Math.abs(z2Margin)), winner: z2Winner,
        pitcherCards: [...(pitcherPlacement.z2 || [])], batterCards: [...(batterPlacement.z2 || [])],
        hardContact, cascadeEffect: 'k_swinging'
      },
      z3: { pitcherTotal: 0, batterTotal: 0, margin: 0, winner: 'none', pitcherCards: [], batterCards: [], cascadeEffect: 'Skipped (Strikeout)' },
      zonesWon: { batter: z1Winner === 'batter' ? 1 : 0, pitcher: (z1Winner === 'pitcher' ? 1 : 0) + 1 },
      trigger: 'k_swinging', advantageSide: 'pitcher', advantageScore: Math.round(pitcherZ1Total + pitcherZ2Total), outcome, log, staminaState, primaryPitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher', batterCharName: batterChar?.name || 'Batter'
    });
  }

  // ── ZONE 3 ─────────────────────────────────────────────────────────────────
  let pitcherZ3Action = sumZone(pitcherPlacement.z3, 'z3');
  let batterZ3Action  = sumZone(batterPlacement.z3,  'z3');

  // Pitch affinity — Zone 3
  for (const aff of (pitcherChar.pitchAffinity || [])) {
    if (aff.zone === 'z3' && pitchTypeCards.some(c => c.pitchCall === aff.pitchCall)) {
      pitcherZ3Action += aff.bonus;
      log.push(`Pitch affinity Z3 (${pitcherChar.name}): +${aff.bonus}`);
    }
  }

  // Stamina modifier — Zone 3
  pitcherZ3Action += staminaMod.z3;

  // Hard Contact: double batter Z3 action total
  if (hardContact) {
    batterZ3Action *= 2;
    log.push('Hard Contact: batter Z3 Action doubled (×2)');
  }

  // Player card Z3 bonuses
  const pitcherZ3Bonus = pitcherChar.zoneBonuses.z3 + smokeBonus;
  let   batterZ3Bonus  = batterChar.zoneBonuses.z3 + readAffinityBonus.z3;

  const pitcherZ3Total = pitcherZ3Action + pitcherZ3Bonus;
  const batterZ3Total  = batterZ3Action  + batterZ3Bonus;
  const z3Margin       = batterZ3Total - pitcherZ3Total;
  const z3Winner       = z3Margin > 0 ? 'batter' : (z3Margin < 0 ? 'pitcher' : 'tie');

  log.push(`Z3 — Pitcher: ${Math.round(pitcherZ3Total)}  Batter: ${Math.round(batterZ3Total)}  → ${z3Winner.toUpperCase()} (margin: ${Math.round(Math.abs(z3Margin))})`);

  // ── ZONE MAJORITY ──────────────────────────────────────────────────────────
  const zones = [z1Winner, z2Winner, z3Winner];
  const batterWins  = zones.filter(w => w === 'batter').length;
  const pitcherWins = zones.filter(w => w === 'pitcher').length;

  let advantageSide = 'neutral';
  if (batterWins  >= 2) advantageSide = 'batter';
  if (pitcherWins >= 2) advantageSide = 'pitcher';

  log.push(`ZONES — Batter: ${batterWins}  Pitcher: ${pitcherWins}  → ${advantageSide.toUpperCase()} ADVANTAGE`);

  // Advantage Score: winning side's action card totals + player zone bonuses (all 3 zones)
  let advantageScore = 0;
  if (advantageSide === 'batter') {
    advantageScore = Math.round(
      batterZ1ActionMultiplied + batterZ1Bonus +
      batterZ2Action + batterZ2Bonus +
      batterZ3Action + batterZ3Bonus
    );
    if (batterChar.id === 'BC01' && batterWins === 3) { advantageScore += 8;  log.push('The Bear: win all 3 → +8 score'); }
    if (batterChar.id === 'BC08' && batterWins === 3) { advantageScore += 10; log.push('Jackson: win all 3 → +10 score'); }
  } else if (advantageSide === 'pitcher') {
    advantageScore = Math.round(
      pitcherZ1Action + pitcherZ1Bonus +
      pitcherZ2Action + pitcherZ2Bonus +
      pitcherZ3Action + pitcherZ3Bonus
    );
  } else {
    advantageScore = 5;
  }

  log.push(`ADVANTAGE SCORE: ${advantageScore}`);

  // ── ZONE 3 SPECIAL TRIGGERS ─────────────────────────────────────────────────
  if (advantageSide === 'batter' && batterWins === 3 && advantageScore >= 30) {
    const outcome = {
      type: 'hr',
      display: '🚀💥 HOME RUN! SLAMMED!',
      runsScored: 1 + countRunners(bases),
      outsAdded: 0,
      newBases: { first: false, second: false, third: false },
      rng: {
        rollPct: 0,
        tier: `Dominant Sweep: Win All 3 Zones & Advantage Score ${advantageScore} ≥ 30`,
        odds: [{ label: 'Home Run 🚀💥', pct: 100, range: 'Instant' }],
        isTrigger: true
      }
    };
    log.push('TRIGGER: Home Run (win all 3 zones, score ≥ 30)');
    // Jackson: HR counts as 2 runs
    if (batterChar.id === 'BC08') { outcome.runsScored += 1; outcome.display += ' (Tape Measure — 2 runs!)'; }
    return buildResult({
      z1: {
        pitcherTotal: Math.round(pitcherZ1Total), batterTotal: Math.round(batterZ1Total),
        margin: Math.round(Math.abs(z1Margin)), winner: z1Winner,
        pitcherCards: [...(pitcherPlacement.z1 || [])], batterCards: [...(batterPlacement.z1 || [])],
        counterFired: counterResult.counterFired, counterCardId: counterResult.counterCardId,
        pitchCallMatched: counterResult.pitchCallMatched, mult: counterResult.multiplier,
        cascadeEffect: '+3 momentum into Zone 2 for batter'
      },
      z2: {
        pitcherTotal: Math.round(pitcherZ2Total), batterTotal: Math.round(batterZ2Total),
        margin: Math.round(Math.abs(z2Margin)), winner: z2Winner,
        pitcherCards: [...(pitcherPlacement.z2 || [])], batterCards: [...(batterPlacement.z2 || [])],
        hardContact,
        cascadeEffect: hardContact ? '🔥 Hard Contact! Doubles (×2) Zone 3 Action' : 'Solid contact'
      },
      z3: {
        pitcherTotal: Math.round(pitcherZ3Total), batterTotal: Math.round(batterZ3Total),
        margin: Math.round(Math.abs(z3Margin)), winner: z3Winner,
        pitcherCards: [...(pitcherPlacement.z3 || [])], batterCards: [...(batterPlacement.z3 || [])],
        hardContactActive: hardContact, z3Penalty: 0
      },
      zonesWon: { batter: 3, pitcher: 0 },
      trigger: 'hr', advantageSide, advantageScore, outcome, log, staminaState, primaryPitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher', batterCharName: batterChar?.name || 'Batter'
    });
  }

  if (advantageSide === 'pitcher' && pitcherWins === 3 && advantageScore >= 30) {
    let outcome;
    if (bases.first) {
      outcome = {
        type: 'dp',
        display: '🔄 DOUBLE PLAY!',
        runsScored: 0,
        outsAdded: 2,
        newBases: { ...bases, first: false, second: bases.first },
        rng: {
          rollPct: 0,
          tier: `Dominant Sweep: Pitcher Win All 3 Zones & Score ${advantageScore} ≥ 30`,
          odds: [{ label: 'Double Play 🔄', pct: 100, range: 'Instant' }],
          isTrigger: true
        }
      };
    } else {
      outcome = {
        type: 'k',
        display: '⚫⚡ STRIKEOUT LOOKING!',
        runsScored: 0,
        outsAdded: 1,
        newBases: { ...bases },
        rng: {
          rollPct: 0,
          tier: `Dominant Sweep: Pitcher Win All 3 Zones & Score ${advantageScore} ≥ 30`,
          odds: [{ label: 'Strikeout Looking ⚫⚡', pct: 100, range: 'Instant' }],
          isTrigger: true
        }
      };
    }
    log.push('TRIGGER: Dominant pitcher (win all 3 zones, score ≥ 30)');
    return buildResult({
      z1: {
        pitcherTotal: Math.round(pitcherZ1Total), batterTotal: Math.round(batterZ1Total),
        margin: Math.round(Math.abs(z1Margin)), winner: z1Winner,
        pitcherCards: [...(pitcherPlacement.z1 || [])], batterCards: [...(batterPlacement.z1 || [])],
        counterFired: counterResult.counterFired, counterCardId: counterResult.counterCardId,
        pitchCallMatched: counterResult.pitchCallMatched, mult: counterResult.multiplier,
        cascadeEffect: '+3 momentum into Zone 2 for pitcher'
      },
      z2: {
        pitcherTotal: Math.round(pitcherZ2Total), batterTotal: Math.round(batterZ2Total),
        margin: Math.round(Math.abs(z2Margin)), winner: z2Winner,
        pitcherCards: [...(pitcherPlacement.z2 || [])], batterCards: [...(batterPlacement.z2 || [])],
        hardContact: false,
        cascadeEffect: 'Pitcher suppressed contact'
      },
      z3: {
        pitcherTotal: Math.round(pitcherZ3Total), batterTotal: Math.round(batterZ3Total),
        margin: Math.round(Math.abs(z3Margin)), winner: z3Winner,
        pitcherCards: [...(pitcherPlacement.z3 || [])], batterCards: [...(batterPlacement.z3 || [])],
        hardContactActive: false, z3Penalty: 0
      },
      zonesWon: { batter: 0, pitcher: 3 },
      trigger: 'dp_or_k', advantageSide, advantageScore, outcome, log, staminaState, primaryPitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher', batterCharName: batterChar?.name || 'Batter'
    });
  }

  // ── GENERAL OUTCOME ─────────────────────────────────────────────────────────
  let outcome = getOutcome(advantageScore, advantageSide, bases);

  // Double Play Depth (P27): groundout with runner on 1st → DP
  if (outcome.type === 'out' && (pitcherPlacement.z3 || []).includes('P27') && bases.first) {
    outcome = {
      type: 'dp',
      display: '🔄 Double Play! (Double Play Depth)',
      runsScored: 0,
      outsAdded: 2,
      newBases: { ...bases, first: false },
      rng: {
        rollPct: outcome.rng?.rollPct || 0,
        tier: outcome.rng?.tier || 'In-Play Out',
        odds: [{ label: 'Double Play 🔄', pct: 100, range: 'Modified by Double Play Depth' }]
      }
    };
    log.push('Double Play Depth: groundout → Double Play');
  }

  // Hustle (B25): runners advance +1 on any hit
  if (outcome.type !== 'out' && outcome.type !== 'k' && outcome.type !== 'dp' && outcome.type !== 'walk' &&
      (batterPlacement.z3 || []).includes('B25')) {
    outcome.display += ' (Hustle! +1 base)';
    log.push('Hustle: runners advance +1 base');
  }

  // Hit and Run (B29): runners advance on any contact
  if (outcome.type === 'out' && (batterPlacement.z3 || []).includes('B29') && hasRunnerOnBase) {
    outcome.display += ' (Hit & Run: runners advance)';
    log.push('Hit and Run: runners advance even on out');
  }

  log.push(`OUTCOME: ${outcome.display} (runs: ${outcome.runsScored}, outs: ${outcome.outsAdded})`);

  return buildResult({
    z1: {
      pitcherTotal: Math.round(pitcherZ1Total), batterTotal: Math.round(batterZ1Total),
      margin: Math.round(Math.abs(z1Margin)), winner: z1Winner,
      pitcherCards: [...(pitcherPlacement.z1 || [])], batterCards: [...(batterPlacement.z1 || [])],
      counterFired: counterResult.counterFired, counterCardId: counterResult.counterCardId,
      pitchCallMatched: counterResult.pitchCallMatched, mult: counterResult.multiplier,
      cascadeEffect: z1Winner !== 'tie' ? `+3 momentum into Zone 2 for ${z1Winner}` : 'None'
    },
    z2: {
      pitcherTotal: Math.round(pitcherZ2Total), batterTotal: Math.round(batterZ2Total),
      margin: Math.round(Math.abs(z2Margin)), winner: z2Winner,
      pitcherCards: [...(pitcherPlacement.z2 || [])], batterCards: [...(batterPlacement.z2 || [])],
      hardContact,
      cascadeEffect: hardContact ? '🔥 Hard Contact! Doubles (×2) Zone 3 Action' : 'Solid contact'
    },
    z3: {
      pitcherTotal: Math.round(pitcherZ3Total), batterTotal: Math.round(batterZ3Total),
      margin: Math.round(Math.abs(z3Margin)), winner: z3Winner,
      pitcherCards: [...(pitcherPlacement.z3 || [])], batterCards: [...(batterPlacement.z3 || [])],
      hardContactActive: hardContact, z3Penalty: 0
    },
    zonesWon: { batter: batterWins, pitcher: pitcherWins },
    trigger: null, advantageSide, advantageScore, outcome, log, staminaState, primaryPitchCall,
    pitcherCharName: pitcherChar?.name || 'Pitcher', batterCharName: batterChar?.name || 'Batter'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENTIAL 3-BEAT RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 2-BEAT SEQUENTIAL RESOLUTION SYSTEM
// Zone 1: The Pitch & Advantage (Pitcher establishes Strike Zone spectrum)
// Zone 2: The Batted Ball & Outcome (Hitter establishes Batted Ball spectrum)
// Initiative: Loser of Beat 1 reveals first; Winner counters with open eyes!
// ─────────────────────────────────────────────────────────────────────────────

// BEAT 1: The Setup Pitch / Battle for the Count
function resolveBeat1(opts) {
  const {
    pitcherCardId = null,
    pitchType = 'fastball',
    batterCardId = null,
    guessPitch = null,
    batterGuess = guessPitch || opts.batterGuess || 'fastball',
    pitchCall = pitchType || opts.pitchCall || 'fastball',
    pitcherChar = PITCHER_CHARACTERS['PC01'],
    batterChar = BATTER_CHARACTERS['BC01'],
    pitcherPAsFaced = 0,
    isFirstPAOfInning = false,
    pitcherRatings = null,
    bases = { first: false, second: false, third: false },
    outs = 0,
  } = opts;

  const effPitchType = pitchCall || pitchType || 'fastball';
  const effBatterGuess = batterGuess || guessPitch || 'fastball';
  const pitchMatched = (effBatterGuess === effPitchType);

  const pCard = pitcherCardId ? getCard(pitcherCardId) : null;
  const bCard = batterCardId ? getCard(batterCardId) : null;

  let pCardVal = pCard ? (pCard.value || 0) : 0;
  let bCardVal = bCard ? (bCard.value || 0) : 0;

  const isPitcherWP = (pCardVal === 1);
  const isBatterK   = (bCardVal === 1);

  // Live or base character ratings
  const pBonus = (pitcherRatings && pitcherRatings[effPitchType] !== undefined)
    ? pitcherRatings[effPitchType]
    : ((typeof getPitcherPitchRating === 'function')
      ? getPitcherPitchRating(pitcherChar, effPitchType)
      : (pitcherChar?.pitchRatings?.[effPitchType] ?? 0));

  const bBonus = (typeof getBatterPitchRating === 'function')
    ? getBatterPitchRating(batterChar, effPitchType)
    : (batterChar?.pitchRatings?.[effPitchType] ?? 0);

  // Stamina penalty if tiring / gassed
  const staminaMod = getStaminaMod(pitcherChar, pitcherPAsFaced);
  let staminaPen = (staminaMod && staminaMod.z1) ? staminaMod.z1 : 0;

  const pitcherDelivery = Math.max(0, pCardVal + pBonus + staminaPen);
  const batterReaction = bCardVal + (pitchMatched ? bBonus : 0);

  let winner = 'tie';
  let count = '3-2';
  let countDisplay = '3-2 Full Count (Even Battle)';
  let cascadeEffect = 'count_3_2';
  let advantageSide = 'neutral';
  let lockedOption = null;
  let revealCardFirst = null;
  let isDominant = false;
  let margin = Math.abs(pitcherDelivery - batterReaction);
  let isWildPitch = false;

  // 1. Special Cards Check: WP (Wild Pitch) & K (Swinging Whiff)
  if (isPitcherWP && isBatterK) {
    winner = 'tie';
    count = '3-2';
    countDisplay = '1-1 Count (Wild Pitch Whiff in Dirt — Runners Advance)';
    cascadeEffect = 'count_3_2';
    advantageSide = 'neutral';
    isWildPitch = true;
  } else if (isPitcherWP) {
    // Pitcher uncorked a wild pitch in the dirt! Ball One! Runners advance 1 base!
    winner = 'batter';
    count = '3-1';
    countDisplay = "3-1 Hitter's Count (Wild Pitch in the Dirt — Ball One! Runners Advance)";
    cascadeEffect = 'count_3_1';
    advantageSide = 'batter';
    isWildPitch = true;
    margin = 5;
    isDominant = true;
    revealCardFirst = 'pitcher';
  } else if (isBatterK) {
    // Batter chased out of the zone / whiffed! Strike One!
    winner = 'pitcher';
    count = '0-2';
    countDisplay = "0-2 Pitcher's Count (Batter Whiffed on Strike One!)";
    cascadeEffect = 'count_0_2';
    advantageSide = 'pitcher';
    margin = 5;
    isDominant = true;
    revealCardFirst = 'batter';
  } else {
    // 2. Standard Pitch 1 Resolution: Pitcher Delivery vs Batter Reaction
    margin = Math.abs(pitcherDelivery - batterReaction);
    isDominant = margin >= 4;

    if (pitcherDelivery > batterReaction) {
      winner = 'pitcher';
      count = '0-2';
      cascadeEffect = 'count_0_2';
      advantageSide = 'pitcher';
      if (isDominant) {
        revealCardFirst = 'batter';
        countDisplay = "0-2 Pitcher's Count (DOMINANT ADVANTAGE: Two-Strike Protection + Batter Plays Face-Up First)";
      } else {
        countDisplay = "0-2 Pitcher's Count (Two-Strike Protection: Home Runs Capped at Doubles)";
      }
    } else if (batterReaction > pitcherDelivery) {
      winner = 'batter';
      count = '3-1';
      cascadeEffect = 'count_3_1';
      advantageSide = 'batter';
      if (isDominant) {
        revealCardFirst = 'pitcher';
        countDisplay = "3-1 Hitter's Count (DOMINANT ADVANTAGE: Any Strike Battles Back + Pitcher Plays Face-Up First)";
      } else {
        countDisplay = "3-1 Hitter's Count (Hitter's Count: Any Strike Battles Back to 3-2)";
      }
    } else {
      winner = 'tie';
      count = '3-2';
      cascadeEffect = 'count_3_2';
      advantageSide = 'neutral';
      countDisplay = '3-2 Full Count (Even Battle - All Options Available)';
    }
  }

  const pitcherAdvantagePerk = (winner === 'pitcher' && pCard?.advantagePerk) ? pCard.advantagePerk : null;
  const batterAdvantagePerk = (winner === 'batter' && bCard?.advantagePerk) ? bCard.advantagePerk : null;

  return {
    winner,
    count,
    countDisplay,
    cascadeEffect,
    advantageSide,
    lockedOption: null,
    revealCardFirst,
    isDominant,
    pitcherDiscount: 0,
    batterDiscount: 0,
    pitcherTotal: pitcherDelivery,
    batterTotal: batterReaction,
    pitcherDelivery,
    batterReaction,
    pitcherCardVal: pCardVal,
    batterCardVal: bCardVal,
    pitcherBaseBonus: pBonus,
    batterBaseBonus: pitchMatched ? bBonus : 0,
    pitchType: effPitchType,
    guessPitch: effBatterGuess,
    pitchCall: effPitchType,
    batterGuess: effBatterGuess,
    pitchMatched,
    isPitcherWP,
    isBatterK,
    isWildPitch,
    margin,
    rawMargin: winner === 'batter' ? margin : -margin,
    pitcherCardId,
    batterCardId,
    pitcherCards: pitcherCardId ? [pitcherCardId] : [],
    batterCards: batterCardId ? [batterCardId] : [],
    pitcherAdvantagePerk,
    batterAdvantagePerk,
    isKnockout: false,
    strikeZone: pitcherChar?.strikeZone || { low: 10, high: 16, bullseye: 13, wildBust: 20 },
    sz: pitcherChar?.strikeZone || { low: 10, high: 16, bullseye: 13, wildBust: 20 },
  };
}

// BEAT 2: The Attack Pitch (Sweet Spot Centers & Plate Coverage)
function resolveBeat2(opts) {
  const {
    count = '3-2',
    beat1Winner = 'tie',
    z1Winner = beat1Winner,
    pitchType = 'fastball',
    pitcherCardId = null,
    guessPitch = null,
    swingType = 'balanced',
    batterCardId = null,
    pitcherChar = PITCHER_CHARACTERS['PC01'],
    batterChar = BATTER_CHARACTERS['BC01'],
    bases = { first: false, second: false, third: false },
    outs = 0,
    score = { batting: 0, pitching: 0 },
    pitcherAdvantagePerk = null,
    batterAdvantagePerk = null,
  } = opts;

  const effectiveCount = count || (z1Winner === 'pitcher' ? '0-2' : z1Winner === 'batter' ? '3-1' : '3-2');
  const effectiveGuessPitch = guessPitch || opts.batterGuess || 'fastball';

  // 1. Deduction Check: Did batter anticipate pitch type?
  const pitchMatched = (effectiveGuessPitch === pitchType);
  const matchTier = pitchMatched ? 'matched' : 'whiff';

  // 2. Card Values & Character Base Pitch Ratings
  const pCard = getCard(pitcherCardId);
  const pCardVal = pCard ? (pCard.value || 0) : 0;
  const bCard = getCard(batterCardId);
  const bCardVal = bCard ? (bCard.value || 0) : 0;

  const isPitcherWP = (pCardVal === 1);
  const isBatterK   = (bCardVal === 1);

  const pitcherBonus = (opts.pitcherRatings && opts.pitcherRatings[pitchType] !== undefined)
    ? opts.pitcherRatings[pitchType]
    : ((typeof getPitcherPitchRating === 'function')
      ? getPitcherPitchRating(pitcherChar, pitchType)
      : (pitcherChar?.pitchRatings?.[pitchType] ?? 0));

  const batterBonus = (typeof getBatterPitchRating === 'function')
    ? getBatterPitchRating(batterChar, pitchType)
    : (batterChar?.pitchRatings?.[pitchType] ?? 0);

  // Idea 3 & 4: Total = Pitcher Delivery (Card + Rating) + Batter Card.
  // Batter pitch rating does NOT push total higher into out territory; it widens the Sweet Spot barrel window!
  const pitcherEffectiveVal = pCardVal + pitcherBonus;
  const batterEffectiveVal = bCardVal;
  const launchAngle = pitcherEffectiveVal + bCardVal;

  const sweetSpotInfo = PITCH_SWEET_SPOTS[pitchType] || PITCH_SWEET_SPOTS.fastball;
  const center = sweetSpotInfo.center; // 6 for offspeed, 9 for breaking, 12 for fastball

  // Barrel window calculation: plate coverage expands barrel when anticipated!
  let barrelMin, barrelMax, lineDriveMin, lineDriveMax;
  let expansion = 0;
  if (pitchMatched) {
    expansion = Math.max(1, Math.min(3, Math.floor((batterBonus + 1) / 2)));
    barrelMin = center - expansion;
    barrelMax = center + expansion;
    lineDriveMin = barrelMin - 2;
    lineDriveMax = barrelMin - 1;
  } else {
    barrelMin = center - 1;
    barrelMax = center + 1;
    lineDriveMin = barrelMin - 1;
    lineDriveMax = barrelMin - 1;
  }

  const timingDelta = Math.abs(launchAngle - center);
  const effectiveMargin = bCardVal - pitcherEffectiveVal;

  let timingQuality = 'miss';
  if (timingDelta === 0) {
    timingQuality = 'squared'; // 🎯 Squared Up Barrel
  } else if (timingDelta <= (pitchMatched ? expansion : 1)) {
    timingQuality = 'solid';   // 🏏 Solid Timing
  } else if (timingDelta <= (pitchMatched ? expansion + 2 : 2)) {
    timingQuality = 'weak';    // 🧤 Off-Balance Timing
  } else {
    timingQuality = 'miss';    // ⚡ Whiff / Completely Mistimed
  }

  const isSlugger = (batterChar?.archetype === 'Slugger' || batterChar?.archetype === 'Free Swinger');
  const isContactHitter = (batterChar?.archetype === 'Contact Hitter' || batterChar?.archetype === 'Speed Specialist');

  let outcomeType = 'out';
  let outcomeDisplay = 'Out';
  let ruleReason = '';
  let isWildPitchReset = false;
  let isBattleBack = false;
  const perkLogs = [];

  // ═════════════════════════════════════════════════════════════════════════
  // SWEET SPOT CENTERS & COUNT LEVERAGE RESOLUTION MATRIX
  // ═════════════════════════════════════════════════════════════════════════

  // ── SPECIAL CARDS: WP (Wild Pitch) & K (Automatic Strikeout) ──
  if (isPitcherWP && isBatterK) {
    outcomeType = 'k';
    outcomeDisplay = '⚡ STRIKEOUT ON WILD PITCH IN DIRT!';
    ruleReason = 'Batter swung and missed (K) on a wild pitch (WP) in the dirt! Strikeout recorded, base runners advance 1 base on the wild pitch.';
    isWildPitchReset = true;

  } else if (isPitcherWP) {
    if (effectiveCount === '0-2') {
      outcomeType = 'wild_pitch';
      isWildPitchReset = true;
      outcomeDisplay = '⚡ WILD PITCH IN THE DIRT (BALL / RUNNERS ADVANCE)!';
      ruleReason = '0-2 Count: Pitcher threw a wild pitch (WP) in the dirt (Ball). Runners advance 1 base and count resets to 3-2 Full Count!';
    } else if (effectiveCount === '3-1' || effectiveCount === '3-2') {
      outcomeType = 'walk';
      outcomeDisplay = '🚶 WALK (BALL FOUR — WILD PITCH IN THE DIRT)!';
      ruleReason = `${effectiveCount} Count: Pitcher threw a wild pitch (WP) into the dirt for Ball Four Walk!`;
    } else {
      outcomeType = 'wild_pitch';
      isWildPitchReset = true;
      outcomeDisplay = '⚡ WILD PITCH IN THE DIRT (RUNNERS ADVANCE)!';
      ruleReason = 'Pitcher threw a wild pitch (WP) in the dirt. Runners advance 1 base and count resets to 3-2 Full Count!';
    }

  } else if (isBatterK) {
    if (effectiveCount === '3-1') {
      outcomeType = 'battle_back';
      isBattleBack = true;
      outcomeDisplay = '🔥 CLUTCH STRIKE! PITCHER FIGHTS BACK TO 3-2!';
      ruleReason = '3-1 Count: Batter whiffed on K card, but count was 3-1! Pitcher earns Strike Two and battles back to 3-2 for Beat 3!';
    } else {
      outcomeType = 'k';
      outcomeDisplay = '⚡ AUTOMATIC STRIKEOUT (K CARD WHIFF)!';
      ruleReason = 'Batter played K card and swung through the delivery for an automatic Strikeout!';
    }

  } else if (pitchMatched) {
    // ── PITCH READ: Batter anticipated the Pitch Type! ──
    // Evaluated via Sweet Spot Centers (Offspeed 6, Breaking 9, Fastball 12) + Plate Coverage Expansion
    if (launchAngle >= barrelMin && launchAngle <= barrelMax) {
      // 🎯 SWEET SPOT / BARREL BAND
      if (effectiveCount === '0-2') {
        outcomeType = 'double';
        outcomeDisplay = '⚡ CLUTCH DOUBLE OFF THE WALL (TWO-STRIKE BARREL)!';
        ruleReason = `Squared-up sweet spot barrel (Total ${launchAngle} in [${barrelMin}–${barrelMax}] Sweet Spot Band), but 0-2 two-strike plate protection capped the hit at a Double!`;
      } else if (Math.abs(launchAngle - center) <= 1 || isSlugger || bCardVal >= 5) {
        outcomeType = 'homerun';
        outcomeDisplay = '💥 NO-DOUBTER HOME RUN (SQUARED UP BARREL)!';
        ruleReason = `Squared-up sweet spot barrel (Total ${launchAngle} in [${barrelMin}–${barrelMax}] Sweet Spot Band, Center ${center}) crushed for a towering Home Run!`;
      } else {
        outcomeType = 'double';
        outcomeDisplay = '⚡ ROCKET DOUBLE INTO THE GAP (SWEET SPOT BARREL)!';
        ruleReason = `Perfect sweet spot collision (Total ${launchAngle} in [${barrelMin}–${barrelMax}] Sweet Spot Band) ripped into the gap for a Double!`;
      }

    } else if (launchAngle >= lineDriveMin && launchAngle <= lineDriveMax) {
      // 🏏 LINE DRIVE BAND: Clean contact finding a hole
      if (effectiveCount === '0-2') {
        outcomeType = 'battle_back';
        isBattleBack = true;
        outcomeDisplay = '⚾ BATTLED BACK! FOUL BALL (COUNT RUNS TO 3-2)!';
        ruleReason = `0-2 Count: Batter fought off pitcher's delivery with clean line drive contact (Total ${launchAngle} in [${lineDriveMin}–${lineDriveMax}] Line Drive Band)! The count runs full to 3-2 for Beat 3!`;
      } else {
        outcomeType = 'single';
        outcomeDisplay = '🏏 CLEAN LINE DRIVE SINGLE!';
        ruleReason = `Pitch anticipated with clean line drive contact (Total ${launchAngle} in [${lineDriveMin}–${lineDriveMax}] Line Drive Band) produced a Single!`;
      }

    } else if (launchAngle < lineDriveMin) {
      // ⚾ LOW CONTACT BAND: Sinker in dirt / rollover
      if (effectiveCount === '3-1') {
        outcomeType = 'battle_back';
        isBattleBack = true;
        outcomeDisplay = '🔥 CLUTCH STRIKE! PITCHER FIGHTS BACK TO 3-2!';
        ruleReason = `3-1 Count: Pitcher induced a low ground ball (Total ${launchAngle} below sweet spot). In 3-1 count, any strike battles back to 3-2 for Beat 3!`;
      } else {
        outcomeType = 'groundout';
        outcomeDisplay = '⚾ ROUTINE GROUNDOUT TO SHORT';
        ruleReason = `Low contact (Total ${launchAngle} below sweet spot: Delivery ${pitcherEffectiveVal} + Swing ${bCardVal}) resulted in a routine groundout.`;
      }

    } else {
      // ⚡ HIGH HEAT BAND: Blown away above barrel
      if (effectiveCount === '3-1') {
        outcomeType = 'battle_back';
        isBattleBack = true;
        outcomeDisplay = '🔥 CLUTCH STRIKE! PITCHER FIGHTS BACK TO 3-2!';
        ruleReason = `3-1 Count: Pitcher challenged the hitter with high heat (Total ${launchAngle} above sweet spot)! The count runs full to 3-2 for Beat 3!`;
      } else if (effectiveCount === '0-2') {
        if (isContactHitter) {
          outcomeType = 'battle_back';
          isBattleBack = true;
          outcomeDisplay = '⚾ CONTACT SPOIL! BATTLED TO 3-2!';
          ruleReason = '0-2 Count: Contact Hitter archetype spoiled high heat to stay alive! Count runs full to 3-2 for Beat 3!';
        } else {
          outcomeType = 'k';
          outcomeDisplay = '⚡ STRIKEOUT SWINGING (PUT-AWAY PUNCHOUT)!';
          ruleReason = `0-2 Count: Pitcher blew high heat past the hitter (Total ${launchAngle} above sweet spot) for a swinging Strikeout!`;
        }
      } else {
        outcomeType = (pitchType === 'fastball') ? 'flyout' : 'groundout';
        outcomeDisplay = (pitchType === 'fastball') ? '🧤 ROUTINE FLYOUT (HIGH HEAT)' : '⚾ ROUTINE GROUNDOUT';
        ruleReason = `High delivery (Total ${launchAngle} above sweet spot) produced a routine out.`;
      }
    }

  } else {
    // ── WHIFF / FOOLED: Batter anticipated the wrong pitch! ──
    if (effectiveCount === '3-1') {
      outcomeType = 'battle_back';
      isBattleBack = true;
      outcomeDisplay = '🔥 CLUTCH STRIKE! PITCHER FIGHTS BACK TO 3-2!';
      ruleReason = '3-1 Count: Pitcher fooled the batter and painted the zone with a clutch strike! Count runs full to 3-2 for Beat 3!';

    } else if (effectiveCount === '0-2') {
      outcomeType = 'k';
      outcomeDisplay = '⚡ STRIKEOUT SWINGING (PUNCHOUT ON PUT-AWAY PITCH)!';
      ruleReason = '0-2 Count: Pitcher put away the fooled batter with a spot-on punchout Strikeout!';

    } else if (launchAngle >= center + 3) {
      outcomeType = 'k';
      outcomeDisplay = '⚡ SWINGING STRIKEOUT (COMPLETELY FOOLED ON HIGH HEAT)!';
      ruleReason = `Batter completely fooled on pitch type with high heat (Total ${launchAngle} >= ${center + 3}). Swinging Strikeout.`;

    } else {
      outcomeType = (pitchType === 'fastball') ? 'flyout' : 'groundout';
      outcomeDisplay = (pitchType === 'fastball') ? '🧤 POPUP TO INFIELD (FOOLED ON PITCH)' : '⚾ WEAK ROLLOVER GROUNDOUT (FOOLED ON PITCH)';
      ruleReason = `Batter was fooled on pitch type (${pitchType.toUpperCase()} vs Looking ${effectiveGuessPitch.toUpperCase()}). Weak contact (Total ${launchAngle}) produced a routine out.`;
    }
  }

  let isDoublePlay = false;
  let isFoulBall = false;
  if (outcomeType === 'battle_back') isFoulBall = true;
  if (outcomeType === 'wild_pitch') isWildPitchReset = true;
  let bonusRun = 0;

  // Calculate Base Running & Outs
  let runsScored = 0;
  let outsAdded = 0;
  let newBases = { ...bases };

  if (isFoulBall || outcomeType === 'battle_back') {
    outsAdded = 0;
    runsScored = 0;
  } else if (outcomeType === 'wild_pitch') {
    runsScored = bases.third ? 1 : 0;
    newBases = {
      first: false,
      second: Boolean(bases.first),
      third: Boolean(bases.second)
    };
    outsAdded = 0;
    isWildPitchReset = true;
  } else if (outcomeType === 'homerun') {
    runsScored = countRunners(bases) + 1 + bonusRun;
    newBases = { first: false, second: false, third: false };
    outsAdded = 0;
  } else if (isDoublePlay || outcomeType === 'double_play') {
    outsAdded = 2;
    runsScored = 0;
    newBases = { first: false, second: bases.third, third: false };
  } else if (outcomeType === 'k' || outcomeType === 'groundout' || outcomeType === 'flyout' || outcomeType === 'out') {
    outsAdded = 1;
    runsScored = 0;
  } else if (outcomeType === 'walk') {
    runsScored = (bases.first && bases.second && bases.third) ? 1 : 0;
    newBases = advanceBases(bases, 1);
    outsAdded = 0;
  } else if (outcomeType === 'single') {
    runsScored = runsOnHit(bases, 1);
    newBases = advanceBases(bases, 1);
    outsAdded = 0;
  } else if (outcomeType === 'double') {
    runsScored = runsOnHit(bases, 2);
    newBases = advanceBases(bases, 2);
    outsAdded = 0;
  } else if (outcomeType === 'triple') {
    runsScored = runsOnHit(bases, 3);
    newBases = advanceBases(bases, 3);
    outsAdded = 0;
  }

  const isHit = ['single','double','triple','homerun'].includes(outcomeType);
  const winner = (runsScored > 0 || isHit || outcomeType === 'walk' || outcomeType === 'wild_pitch') ? 'batter' : (isFoulBall || isBattleBack ? 'tie' : 'pitcher');

  const outcome = {
    type: outcomeType,
    display: outcomeDisplay,
    runsScored,
    outsAdded,
    newBases,
    isFoulBall,
    isBattleBack,
    isWildPitchReset,
    bonusRun,
    specialEffectTriggered: perkLogs.length > 0 ? perkLogs.join(' · ') : null,
    launchAngle,
    needle: launchAngle,
    timingDelta,
    timingQuality,
    ruleReason,
    margin: effectiveMargin,
    effectiveMargin,
    pitcherEffectiveVal,
    batterEffectiveVal,
    rng: { rollPct: launchAngle, tier: outcomeDisplay, odds: [{ label: outcomeDisplay, pct: 100, range: `Total: ${launchAngle}` }] }
  };

  return {
    winner,
    total: launchAngle,
    launchAngle,
    needle: launchAngle,
    timingDelta,
    timingQuality,
    outcome,
    outcomeType,
    outcomeDisplay,
    ruleReason,
    isWildPitchReset,
    isBattleBack,
    runsScored,
    outsAdded,
    newBases,
    isFoulBall,
    bonusRun,
    specialEffectTriggered: outcome.specialEffectTriggered,
    pitchType,
    guessPitch: effectiveGuessPitch,
    swingType,
    pitchMatched,
    locationMatched: pitchMatched, // backward compat
    matchTier,
    pitcherExecuted: !isPitcherWP,
    batterExecuted: !isBatterK,
    pitcherCardVal: pCardVal,
    batterCardVal: bCardVal,
    pitcherBaseBonus: pitcherBonus,
    batterBaseBonus: pitchMatched ? batterBonus : 0,
    pitcherEffectiveVal,
    batterEffectiveVal,
    effectiveMargin,
    pitcherRange: { min: 1, max: 6, label: '1–6' },
    swingRange: { min: 1, max: 6, label: '1–6' },
    sameLocation: pitchMatched, // backward compat
    isFavoritePitch: false,
    isPitcherWP,
    isBatterK,
    count: effectiveCount,
    pitcherTotal: pitcherEffectiveVal,
    batterTotal: batterEffectiveVal,
    pitcherCardId,
    batterCardId,
    pitcherCards: pitcherCardId ? [pitcherCardId] : [],
    batterCards: batterCardId ? [batterCardId] : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BEAT 3: 3-2 FULL COUNT SHOWDOWN
// ─────────────────────────────────────────────────────────────────────────────
function resolveBeat3(opts) {
  const {
    pitchType = 'fastball',
    pitcherCardId = null,
    guessPitch = null,
    swingType = 'balanced',
    batterCardId = null,
    pitcherChar = PITCHER_CHARACTERS['PC01'],
    batterChar = BATTER_CHARACTERS['BC01'],
    bases = { first: false, second: false, third: false },
    outs = 0,
    score = { batting: 0, pitching: 0 },
  } = opts;

  const effectiveGuessPitch = guessPitch || opts.batterGuess || 'fastball';
  const pitchMatched = (effectiveGuessPitch === pitchType);
  const matchTier = pitchMatched ? 'matched' : 'whiff';

  const pCard = getCard(pitcherCardId);
  const pCardVal = pCard ? (pCard.value || 0) : 0;
  const bCard = getCard(batterCardId);
  const bCardVal = bCard ? (bCard.value || 0) : 0;

  const isPitcherWP = (pCardVal === 1);
  const isBatterK   = (bCardVal === 1);

  const pitcherBonus = (opts.pitcherRatings && opts.pitcherRatings[pitchType] !== undefined)
    ? opts.pitcherRatings[pitchType]
    : ((typeof getPitcherPitchRating === 'function')
      ? getPitcherPitchRating(pitcherChar, pitchType)
      : (pitcherChar?.pitchRatings?.[pitchType] ?? 0));
  const batterBonus = (typeof getBatterPitchRating === 'function')
    ? getBatterPitchRating(batterChar, pitchType)
    : (batterChar?.pitchRatings?.[pitchType] ?? 0);

  const pitcherEffectiveVal = pCardVal + pitcherBonus;
  const batterEffectiveVal = bCardVal;
  const launchAngle = pitcherEffectiveVal + bCardVal;

  const sweetSpotInfo = PITCH_SWEET_SPOTS[pitchType] || PITCH_SWEET_SPOTS.fastball;
  const center = sweetSpotInfo.center;

  let barrelMin, barrelMax, lineDriveMin, lineDriveMax;
  let expansion = 0;
  if (pitchMatched) {
    expansion = Math.max(1, Math.min(3, Math.floor((batterBonus + 1) / 2)));
    barrelMin = center - expansion;
    barrelMax = center + expansion;
    lineDriveMin = barrelMin - 2;
    lineDriveMax = barrelMin - 1;
  } else {
    barrelMin = center - 1;
    barrelMax = center + 1;
    lineDriveMin = barrelMin - 1;
    lineDriveMax = barrelMin - 1;
  }

  const margin = bCardVal - pitcherEffectiveVal;
  const timingDelta = Math.abs(launchAngle - center);

  const isSlugger = (batterChar?.archetype === 'Slugger' || batterChar?.archetype === 'Free Swinger');
  const isContactHitter = (batterChar?.archetype === 'Contact Hitter' || batterChar?.archetype === 'Speed Specialist');

  let outcomeType = 'out';
  let outcomeDisplay = 'Out';
  let ruleReason = '';

  if (isPitcherWP && isBatterK) {
    outcomeType = 'k';
    outcomeDisplay = '⚡ 3-2 FULL COUNT: STRIKEOUT ON WILD PITCH IN DIRT!';
    ruleReason = 'Full Count Showdown: Batter swung through a wild pitch (WP) in the dirt! Strikeout recorded, base runners advance 1 base.';
  } else if (isPitcherWP) {
    outcomeType = 'walk';
    outcomeDisplay = '🚶 3-2 FULL COUNT: BALL FOUR WALK (WILD PITCH IN DIRT)!';
    ruleReason = 'Full Count Showdown: Pitcher threw a wild pitch (WP) into the dirt for Ball Four Walk!';
  } else if (isBatterK) {
    outcomeType = 'k';
    outcomeDisplay = '⚡ 3-2 FULL COUNT: AUTOMATIC STRIKEOUT (K CARD WHIFF)!';
    ruleReason = 'Full Count Showdown: Batter played K card and swung through the delivery for an automatic Strikeout!';
  } else if (pitchMatched) {
    // ── PITCH READ: Batter anticipated the Pitch Type in 3-2 Showdown! ──
    if (launchAngle >= barrelMin && launchAngle <= barrelMax) {
      if (Math.abs(launchAngle - center) <= 1 || isSlugger || bCardVal >= 5) {
        outcomeType = 'homerun';
        outcomeDisplay = '💥 3-2 FULL COUNT: NO-DOUBTER HOME RUN!';
        ruleReason = `Full Count Showdown: Squared-up sweet spot barrel (Total ${launchAngle} in [${barrelMin}–${barrelMax}] Sweet Spot Band, Center ${center}) crushed for a towering Home Run!`;
      } else {
        outcomeType = 'double';
        outcomeDisplay = '⚡ 3-2 FULL COUNT: ROCKET DOUBLE INTO THE GAP!';
        ruleReason = `Full Count Showdown: Sweet spot barrel collision (Total ${launchAngle} in [${barrelMin}–${barrelMax}] Sweet Spot Band) ripped into the gap for a Double!`;
      }

    } else if (launchAngle >= lineDriveMin && launchAngle <= lineDriveMax) {
      outcomeType = 'single';
      outcomeDisplay = '🏏 3-2 FULL COUNT: CLUTCH LINE DRIVE SINGLE!';
      ruleReason = `Full Count Showdown: Batter came through with clean line drive contact (Total ${launchAngle} in [${lineDriveMin}–${lineDriveMax}] Line Drive Band) for a clutch Single!`;

    } else if (launchAngle < lineDriveMin) {
      outcomeType = 'groundout';
      outcomeDisplay = '⚾ 3-2 FULL COUNT: ROUTINE GROUNDOUT';
      ruleReason = `Full Count Showdown: Low contact (Total ${launchAngle} below sweet spot) induced a routine groundout.`;

    } else {
      if (launchAngle >= center + 3) {
        outcomeType = 'k';
        outcomeDisplay = '⚡ 3-2 FULL COUNT: PUNCHOUT STRIKEOUT (HIGH HEAT)!';
        ruleReason = `Full Count Showdown: Pitcher overpowered the hitter with high heat (Total ${launchAngle} >= ${center + 3}) for a punchout Strikeout!`;
      } else {
        outcomeType = (pitchType === 'fastball') ? 'flyout' : 'groundout';
        outcomeDisplay = (pitchType === 'fastball') ? '🧤 3-2 FULL COUNT: DEEP FLYOUT TO THE TRACK' : '⚾ 3-2 FULL COUNT: ROUTINE OUT';
        ruleReason = `Full Count Showdown: High delivery (Total ${launchAngle}) resulted in a deep flyout.`;
      }
    }

  } else {
    // ── FOOLED ON PITCH TYPE (3-2 Showdown) ──
    if (launchAngle >= center + 3) {
      outcomeType = 'k';
      outcomeDisplay = '⚡ 3-2 FULL COUNT: SWINGING STRIKEOUT (HIGH HEAT)!';
      ruleReason = `Full Count Showdown: Pitcher fooled the batter with ${pitchType.toUpperCase()} (+${pitcherBonus}) on high heat (Total ${launchAngle}) for a swinging Strikeout!`;
    } else {
      outcomeType = (pitchType === 'fastball') ? 'flyout' : 'groundout';
      outcomeDisplay = (pitchType === 'fastball') ? '🧤 3-2 FULL COUNT: POPUP TO INFIELD (FOOLED ON PITCH)' : '⚾ 3-2 FULL COUNT: WEAK GROUNDOUT (FOOLED ON PITCH)';
      ruleReason = `Full Count Showdown: Batter was fooled on pitch type (${pitchType.toUpperCase()} vs Looking ${effectiveGuessPitch.toUpperCase()}), rolling over for a routine out (Total ${launchAngle}).`;
    }
  }

  // Base advancement
  let runsScored = 0;
  let outsAdded = 0;
  let newBases = { ...bases };

  if (outcomeType === 'homerun') {
    runsScored = countRunners(bases) + 1;
    newBases = { first: false, second: false, third: false };
    outsAdded = 0;
  } else if (outcomeType === 'k' || outcomeType === 'groundout' || outcomeType === 'flyout' || outcomeType === 'out') {
    outsAdded = 1;
    runsScored = 0;
  } else if (outcomeType === 'walk') {
    runsScored = (bases.first && bases.second && bases.third) ? 1 : 0;
    newBases = advanceBases(bases, 1);
    outsAdded = 0;
  } else if (outcomeType === 'single') {
    runsScored = runsOnHit(bases, 1);
    newBases = advanceBases(bases, 1);
    outsAdded = 0;
  } else if (outcomeType === 'double') {
    runsScored = runsOnHit(bases, 2);
    newBases = advanceBases(bases, 2);
    outsAdded = 0;
  } else if (outcomeType === 'triple') {
    runsScored = runsOnHit(bases, 3);
    newBases = advanceBases(bases, 3);
    outsAdded = 0;
  }

  const isHit = ['single','double','triple','homerun'].includes(outcomeType);
  const winner = (runsScored > 0 || isHit || outcomeType === 'walk') ? 'batter' : 'pitcher';

  const outcome = {
    type: outcomeType,
    display: outcomeDisplay,
    runsScored,
    outsAdded,
    newBases,
    isFoulBall: false,
    isBattleBack: false,
    isWildPitchReset: false,
    bonusRun: 0,
    launchAngle,
    timingDelta,
    ruleReason,
    margin,
    effectiveMargin: margin,
    pitcherEffectiveVal,
    batterEffectiveVal,
    rng: { rollPct: timingDelta, tier: outcomeDisplay, odds: [{ label: outcomeDisplay, pct: 100, range: `Launch Angle: ${launchAngle}` }] }
  };

  return {
    winner,
    total: launchAngle,
    launchAngle,
    timingDelta,
    outcome,
    outcomeType,
    outcomeDisplay,
    ruleReason,
    isWildPitchReset: false,
    isBattleBack: false,
    runsScored,
    outsAdded,
    newBases,
    isFoulBall: false,
    pitchType,
    guessPitch: effectiveGuessPitch,
    swingType,
    pitchMatched,
    locationMatched: pitchMatched,
    matchTier,
    pitcherExecuted: !isPitcherWP,
    batterExecuted: !isBatterK,
    pitcherCardVal: pCardVal,
    batterCardVal: bCardVal,
    pitcherBaseBonus: pitcherBonus,
    batterBaseBonus: pitchMatched ? batterBonus : 0,
    pitcherEffectiveVal,
    batterEffectiveVal,
    effectiveMargin: margin,
    count: '3-2',
    pitcherTotal: pitcherEffectiveVal,
    batterTotal: batterEffectiveVal,
    pitcherCardId,
    batterCardId,
    pitcherCards: pitcherCardId ? [pitcherCardId] : [],
    batterCards: batterCardId ? [batterCardId] : [],
  };
}

// Combine the beats into final PA outcome
function resolveSequentialPA(opts) {
  const {
    beat1,
    beat2 = null,
    beat3 = null,
    bases = { first:false, second:false, third:false },
    pitcherChar = PITCHER_CHARACTERS['PC01'],
    batterChar = BATTER_CHARACTERS['BC01'],
    score = { batting: 0, pitching: 0 },
    outs = 0,
    half = 'top'
  } = opts;

  const log = [];
  log.push(`Beat 1 (The Count): Pitcher (${beat1?.pitcherTotal ?? 0}) vs Batter (${beat1?.batterTotal ?? 0}) → ${beat1?.countDisplay || 'Full Count'}`);

  // Instant Walk in Beat 1
  if (beat1?.cascadeEffect === 'walk') {
    const runsScored = bases.third && bases.second && bases.first ? 1 : 0;
    const newBases = advanceBases(bases, 1);
    log.push(`Instant Walk! Ball Four.`);
    const outcome = {
      type: 'walk',
      display: '🚶 WALK! (Ball Four)',
      runsScored,
      outsAdded: 0,
      newBases,
      rng: { rollPct: 100, tier: 'Instant Walk', odds: [{ label: 'Walk 🚶', pct: 100, range: 'Instant' }] }
    };
    return {
      z1: beat1, z2: null, z3: null,
      zonesWon: { batter: 1, pitcher: 0 },
      trigger: 'walk', advantageSide: 'batter', advantageScore: beat1.margin || 5,
      outcome, log, primaryPitchCall: beat1.pitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher',
      batterCharName: batterChar?.name || 'Batter',
      half
    };
  }

  // Instant Called Strike 3 in Beat 1
  if (beat1?.cascadeEffect === 'called_k') {
    log.push(`Instant Called Strike 3!`);
    const outcome = {
      type: 'k',
      display: '⚡ STRIKEOUT LOOKING! (Called Strike 3)',
      runsScored: 0,
      outsAdded: 1,
      newBases: { ...bases },
      rng: { rollPct: 0, tier: 'Instant Strikeout', odds: [{ label: 'Called Strike 3 ⚡', pct: 100, range: 'Instant' }] }
    };
    return {
      z1: beat1, z2: null, z3: null,
      zonesWon: { batter: 0, pitcher: 1 },
      trigger: 'called_k', advantageSide: 'pitcher', advantageScore: beat1.margin || 5,
      outcome, log, primaryPitchCall: beat1.pitchCall,
      pitcherCharName: pitcherChar?.name || 'Pitcher',
      batterCharName: batterChar?.name || 'Batter',
      half
    };
  }

  // Beat 2: The Advantage Duel
  if (beat2) {
    const timingStr = `Launch Angle: Total ${beat2?.launchAngle ?? beat2?.total ?? 11}`;
    log.push(`Beat 2 (The Payoff): Pitcher threw ${beat2?.pitchType?.toUpperCase() || 'PITCH'} [Card ${beat2?.pitcherCardVal ?? '?'}${beat2?.pitcherBaseBonus ? `+${beat2.pitcherBaseBonus}` : ''} = ${beat2?.pitcherEffectiveVal ?? '?'}] vs Batter [Card ${beat2?.batterCardVal ?? '?'}${beat2?.batterBaseBonus ? `+${beat2.batterBaseBonus}` : ''} = ${beat2?.batterEffectiveVal ?? '?'}] (Looking ${beat2?.guessPitch?.toUpperCase() || 'FASTBALL'}) [${beat2?.matchTier?.toUpperCase() || 'MATCH'}] [${timingStr}] → ${beat2?.outcome?.display || beat2?.outcomeDisplay || ''}`);
    if (beat2?.specialEffectTriggered) {
      log.push(`⚡ Special Play: ${beat2.specialEffectTriggered}`);
    }
  }

  // If Beat 3 was played (3-2 Full Count Showdown)
  if (beat3) {
    log.push(`Beat 3 (3-2 Full Count Showdown): Pitcher threw ${beat3?.pitchType?.toUpperCase() || 'PITCH'} [${beat3?.pitcherEffectiveVal ?? '?'}] vs Batter [${beat3?.batterEffectiveVal ?? '?'}] → ${beat3?.outcome?.display || beat3?.outcomeDisplay || ''}`);
    const b3Outcome = beat3.outcome;
    const advantageSide = beat1?.winner || 'neutral';
    const zonesWon = {
      batter: (beat1?.winner === 'batter' ? 1 : 0) + (beat2?.winner === 'batter' ? 1 : 0) + (beat3?.winner === 'batter' ? 1 : 0),
      pitcher: (beat1?.winner === 'pitcher' ? 1 : 0) + (beat2?.winner === 'pitcher' ? 1 : 0) + (beat3?.winner === 'pitcher' ? 1 : 0),
    };
    return {
      z1: beat1,
      z2: beat2,
      z3: beat3,
      zonesWon,
      trigger: beat3?.outcomeType || null,
      advantageSide,
      advantageScore: beat1?.margin || 0,
      outcome: b3Outcome,
      log,
      primaryPitchCall: beat3?.pitchType || beat2?.pitchType || beat1?.pitchCall || 'fastball',
      pitcherCharName: pitcherChar?.name || 'Pitcher',
      batterCharName: batterChar?.name || 'Batter',
      half
    };
  }

  // Otherwise PA resolved in Beat 2
  const b2Outcome = beat2?.outcome || {
    type: 'out',
    display: 'Out',
    runsScored: 0,
    outsAdded: 1,
    newBases: { ...bases }
  };

  const advantageSide = beat1?.winner || 'neutral';
  const zonesWon = {
    batter: (beat1?.winner === 'batter' ? 1 : 0) + (beat2?.winner === 'batter' ? 1 : 0),
    pitcher: (beat1?.winner === 'pitcher' ? 1 : 0) + (beat2?.winner === 'pitcher' ? 1 : 0),
  };

  return {
    z1: beat1,
    z2: beat2,
    z3: null,
    zonesWon,
    trigger: beat2?.outcomeType || null,
    advantageSide,
    advantageScore: beat1?.margin || 0,
    outcome: b2Outcome,
    log,
    primaryPitchCall: beat2?.pitchType || beat1?.pitchCall || 'fastball',
    pitcherCharName: pitcherChar?.name || 'Pitcher',
    batterCharName: batterChar?.name || 'Batter',
    half
  };
}

function executeBotPlayBeat(gameState, botRole, beat, firstRevealedCard = null) {
  const half = gameState?.half || 'top';
  const botIsPitching = (botRole === 'host') ? (half === 'top') : (half === 'bottom');
  const botHand = [...(gameState?.hands?.[botRole] || [])];
  const charges = gameState?.arsenalCharges?.[botRole] || { fastball: 4, breaking: 3, offspeed: 2 };
  const pitcherId = gameState?.activePitcher?.[(half === 'top' ? 'host' : 'guest')];
  const pitcherChar = getPitcher(pitcherId) || PITCHER_CHARACTERS['PC01'];
  const oppRole = (botRole === 'host') ? 'guest' : 'host';
  const batterLineup = gameState?.rosters?.[(half === 'top' ? 'guest' : 'host')]?.lineup || [];
  const bIdx = (gameState?.batterIndex?.[half] || 0) % (batterLineup.length || 1);
  const batterChar = getBatter(batterLineup[bIdx]) || BATTER_CHARACTERS['BC01'];

  let pitchCall = null;
  let batterGuess = null;
  let pitchType = null;
  let swingType = null;
  let guessPitch = null;
  let cardId = null;

  if (beat === 'beat1') {
    // Beat 1: Pitch 1 Setup Pitch! Both players contest the count with pitch type + card
    if (botIsPitching) {
      const liveRatings = gameState?.pitcherRatings?.[botRole] || pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };
      const available = [];
      const fbWeight = Math.max(1, liveRatings.fastball || 1);
      const brWeight = Math.max(1, liveRatings.breaking || 1);
      const offWeight = Math.max(1, liveRatings.offspeed || 1);
      for (let i = 0; i < fbWeight; i++) available.push('fastball');
      for (let i = 0; i < brWeight; i++) available.push('breaking');
      for (let i = 0; i < offWeight; i++) available.push('offspeed');
      pitchType = available[Math.floor(Math.random() * available.length)];
      pitchCall = pitchType;

      if (botHand.length > 0) {
        let midIdx = botHand.findIndex(id => {
          const v = getCard(id)?.value || 0;
          return v >= 3 && v <= 5;
        });
        if (midIdx === -1) midIdx = 0;
        [cardId] = botHand.splice(midIdx, 1);
      }
    } else {
      const oppRatings = gameState?.pitcherRatings?.[oppRole] || { fastball: 3, breaking: 2, offspeed: 1 };
      const pitchPool = [];
      const fbWeight = Math.max(1, oppRatings.fastball || 1);
      const brWeight = Math.max(1, oppRatings.breaking || 1);
      const offWeight = Math.max(1, oppRatings.offspeed || 1);
      for (let i = 0; i < fbWeight; i++) pitchPool.push('fastball');
      for (let i = 0; i < brWeight; i++) pitchPool.push('breaking');
      for (let i = 0; i < offWeight; i++) pitchPool.push('offspeed');
      guessPitch = pitchPool[Math.floor(Math.random() * pitchPool.length)];
      batterGuess = guessPitch;

      if (botHand.length > 0) {
        let midIdx = botHand.findIndex(id => {
          const v = getCard(id)?.value || 0;
          return v >= 3 && v <= 5;
        });
        if (midIdx === -1) midIdx = 0;
        [cardId] = botHand.splice(midIdx, 1);
      }
    }

  } else if (beat === 'beat2' || beat === 'beat3') {
    const b1 = gameState?.currentPA?.beatResults?.beat1 || gameState?.beatResults?.beat1 || gameState?.beat1 || {};
    const b1Winner = b1.winner || 'tie';
    const count = b1.count || ((b1Winner === 'pitcher') ? '0-2' : (b1Winner === 'batter') ? '3-1' : '3-2');
    const lockedOption = b1.lockedOption || (count === '0-2' ? 'power' : count === '3-1' ? 'offspeed' : null);
    const oppRevealedCardId = firstRevealedCard || gameState?.currentPA?.firstRevealedCard || gameState?.firstRevealedCard || null;
    const oppRevealedCard = oppRevealedCardId ? getCard(oppRevealedCardId) : null;
    const oppRevealedVal = oppRevealedCard ? (oppRevealedCard.value || 0) : null;

    if (botIsPitching) {
      // 1. Pick Pitch Type: weighted by live stamina ratings
      const liveRatings = gameState?.pitcherRatings?.[botRole] || pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };
      const available = [];
      const fbWeight = Math.max(1, liveRatings.fastball || 1);
      const brWeight = Math.max(1, liveRatings.breaking || 1);
      const offWeight = Math.max(1, liveRatings.offspeed || 1);
      for (let i = 0; i < fbWeight; i++) available.push('fastball');
      for (let i = 0; i < brWeight; i++) available.push('breaking');
      for (let i = 0; i < offWeight; i++) available.push('offspeed');
      pitchType = available[Math.floor(Math.random() * available.length)];
      pitchCall = pitchType;

      // 2. Pick Execution Card: avoid WP (value 1) if possible
      if (botHand.length > 0) {
        let nonWPIndices = [];
        botHand.forEach((id, idx) => {
          const v = getCard(id)?.value || 0;
          if (v > 1) nonWPIndices.push(idx);
        });

        const pool = (nonWPIndices.length > 0) ? nonWPIndices : botHand.map((_, i) => i);
        const center = PITCH_SWEET_SPOTS[pitchType]?.center || 12;
        const myRating = liveRatings[pitchType] || 0;

        if (myRating >= 4) {
          // High power: push delivery high above sweet spot
          pool.sort((a, b) => (getCard(botHand[b])?.value || 0) - (getCard(botHand[a])?.value || 0));
        } else {
          // Low touch: push delivery low below sweet spot
          pool.sort((a, b) => (getCard(botHand[a])?.value || 0) - (getCard(botHand[b])?.value || 0));
        }
        const chosenIdx = pool[0];
        [cardId] = botHand.splice(chosenIdx, 1);
      }

    } else {
      // Bot is Batter
      const oppRatings = gameState?.pitcherRatings?.[oppRole] || { fastball: 3, breaking: 2, offspeed: 1 };
      const pitchPool = [];
      const fbWeight = Math.max(1, oppRatings.fastball || 1);
      const brWeight = Math.max(1, oppRatings.breaking || 1);
      const offWeight = Math.max(1, oppRatings.offspeed || 1);
      for (let i = 0; i < fbWeight; i++) pitchPool.push('fastball');
      for (let i = 0; i < brWeight; i++) pitchPool.push('breaking');
      for (let i = 0; i < offWeight; i++) pitchPool.push('offspeed');

      guessPitch = pitchPool[Math.floor(Math.random() * pitchPool.length)];
      batterGuess = guessPitch;

      // Select card: avoid K (value 1) if possible, and target Sweet Spot Center
      if (botHand.length > 0) {
        let nonKIndices = [];
        botHand.forEach((id, idx) => {
          const v = getCard(id)?.value || 0;
          if (v > 1) nonKIndices.push(idx);
        });

        const pool = (nonKIndices.length > 0) ? nonKIndices : botHand.map((_, i) => i);
        const oppRating = oppRatings[guessPitch] || 0;
        const oppDeliveryEst = (oppRevealedVal !== null) ? (oppRevealedVal + oppRating) : (3 + oppRating);
        const center = PITCH_SWEET_SPOTS[guessPitch]?.center || 12;
        const idealCardVal = Math.max(1, Math.min(6, center - oppDeliveryEst));

        pool.sort((a, b) => {
          const diffA = Math.abs((getCard(botHand[a])?.value || 0) - idealCardVal);
          const diffB = Math.abs((getCard(botHand[b])?.value || 0) - idealCardVal);
          return diffA - diffB;
        });

        const chosenIdx = pool[0];
        [cardId] = botHand.splice(chosenIdx, 1);
      }
    }
  }

  return {
    pitchCall,
    batterGuess,
    pitchType,
    swingType: 'balanced',
    guessPitch: guessPitch || batterGuess || 'fastball',
    cardId,
    botHand
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER STAMINA DRAIN & RECOVERY MECHANICS
// ─────────────────────────────────────────────────────────────────────────────
function updatePitcherRatingsOnPitch(currentRatings, pitchingRole, pitcherChar, pitchType, cardVal) {
  if (!currentRatings || !currentRatings[pitchingRole]) return;
  const roleRatings = currentRatings[pitchingRole];
  const baseRatings = pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };

  if (pitchType === 'offspeed') {
    // Offspeed recovers +1 Fastball arm stamina (capped at base character rating)
    roleRatings.fastball = Math.min(baseRatings.fastball || 3, (roleRatings.fastball || 0) + 1);
  } else if (pitchType === 'fastball') {
    // High effort fastball (cardVal >= 5) drains Fastball arm rating by 1
    if (cardVal >= 5) {
      roleRatings.fastball = Math.max(0, (roleRatings.fastball || 0) - 1);
    }
  } else if (pitchType === 'breaking') {
    // High effort breaking ball (cardVal >= 5) drains Breaking spin rating by 1
    if (cardVal >= 5) {
      roleRatings.breaking = Math.max(0, (roleRatings.breaking || 0) - 1);
    }
  }
}

function updatePitcherRatingsOnOut(currentRatings, pitchingRole, pitcherChar, pitchType, isQuickOut, isStrikeout) {
  if (!currentRatings || !currentRatings[pitchingRole]) return;
  const roleRatings = currentRatings[pitchingRole];
  const baseRatings = pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };

  if (isStrikeout) {
    // Strikeout adrenaline surge: +1 to all fatigued ratings
    for (const pt of ['fastball', 'breaking', 'offspeed']) {
      roleRatings[pt] = Math.min(baseRatings[pt] || 0, (roleRatings[pt] || 0) + 1);
    }
  } else if (isQuickOut && pitchType) {
    // Efficient out in <= 2 pitches: +1 recovery to pitch used
    roleRatings[pitchType] = Math.min(baseRatings[pitchType] || 0, (roleRatings[pitchType] || 0) + 1);
  }
}

function updatePitcherRatingsOnInningChange(currentRatings, pitchingRole, pitcherChar) {
  if (!currentRatings || !currentRatings[pitchingRole]) return;
  const roleRatings = currentRatings[pitchingRole];
  const baseRatings = pitcherChar?.pitchRatings || { fastball: 3, breaking: 2, offspeed: 1 };

  // Bench / dugout rest: recover +2 to all pitch ratings
  for (const pt of ['fastball', 'breaking', 'offspeed']) {
    roleRatings[pt] = Math.min(baseRatings[pt] || 0, (roleRatings[pt] || 0) + 2);
  }
}

if (typeof window !== 'undefined') {
  window.updatePitcherRatingsOnPitch = updatePitcherRatingsOnPitch;
  window.updatePitcherRatingsOnOut = updatePitcherRatingsOnOut;
  window.updatePitcherRatingsOnInningChange = updatePitcherRatingsOnInningChange;
}

function buildResult(r) { return r; }

// ─────────────────────────────────────────────────────────────────────────────
// PRACTICE BOT PLAY (1-PLAYER SOLOMODE)
// Zero complex AI: lightweight rules for natural card placement into zones
// ─────────────────────────────────────────────────────────────────────────────
function executeBotPlay(gameState, botRole = 'guest') {
  if (!gameState) return { botPlacement: { z1:[], z2:[], z3:[] }, botHand: [] };

  const half = gameState.half || 'top';
  // In Full Count: top half = guest bats, host pitches; bottom half = host bats, guest pitches
  const botIsPitching = (botRole === 'host') ? (half === 'top') : (half === 'bottom');
  const botHand = [...(gameState.hands?.[botRole] || [])];
  const botPlacement = { z1: [], z2: [], z3: [] };

  if (botHand.length === 0) {
    return { botPlacement, botHand };
  }

  if (botIsPitching) {
    // 1. Throw a pitch in Zone 1 (The Read)
    let pitchIdx = botHand.findIndex(id => {
      const c = getCard(id);
      return c && c.type === 'pitcher' && c.zone === 'read';
    });
    if (pitchIdx === -1) {
      pitchIdx = botHand.findIndex(id => {
        const c = getCard(id);
        return c && (c.type === 'pitcher' || c.type === 'universal');
      });
    }
    if (pitchIdx > -1) {
      const [cardId] = botHand.splice(pitchIdx, 1);
      botPlacement.z1.push(cardId);
    }

    // 2. Play 1 supporting card (Zone 2 velocity or Zone 3 defense)
    if (botHand.length > 0) {
      let supIdx = botHand.findIndex(id => {
        const c = getCard(id);
        return c && (c.zone === 'contact' || c.zone === 'result' || c.type === 'universal');
      });
      if (supIdx === -1 && botHand.length > 0) supIdx = 0;
      if (supIdx > -1) {
        const [cardId] = botHand.splice(supIdx, 1);
        const c = getCard(cardId);
        const target = (c?.zone === 'contact') ? 'z2' : (c?.zone === 'result') ? 'z3' : 'z2';
        botPlacement[target].push(cardId);
      }
    }
  } else {
    // Batter bot:
    // 1. Swing card in Zone 2 (The Swing)
    let swingIdx = botHand.findIndex(id => {
      const c = getCard(id);
      return c && (c.zone === 'contact' || c.type === 'universal');
    });
    if (swingIdx === -1 && botHand.length > 0) swingIdx = 0;
    if (swingIdx > -1) {
      const [cardId] = botHand.splice(swingIdx, 1);
      botPlacement.z2.push(cardId);
    }

    // 2. Read or result card
    if (botHand.length > 0) {
      let secIdx = botHand.findIndex(id => {
        const c = getCard(id);
        return c && (c.zone === 'read' || c.zone === 'result' || c.type === 'universal');
      });
      if (secIdx === -1 && botHand.length > 0) secIdx = 0;
      if (secIdx > -1) {
        const [cardId] = botHand.splice(secIdx, 1);
        const c = getCard(cardId);
        const target = (c?.zone === 'read') ? 'z1' : (c?.zone === 'result') ? 'z3' : 'z1';
        botPlacement[target].push(cardId);
      }
    }
  }

  return { botPlacement, botHand };
}
