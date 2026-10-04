'use strict';
// resolution.js — Pure game resolution logic. No side effects. No Firebase.

// ─────────────────────────────────────────────────────────────────────────────
// ZONE VALUE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

// Returns the effective value of a card played in a target zone.
// Playing outside preferred zone → 50% penalty. Universal → always full.
function getZoneValue(card, targetZone) {
  if (!card) return 0;
  if (card.zone === 'any') return card.value;
  const prefMap = { read:'z1', contact:'z2', result:'z3' };
  return prefMap[card.zone] === targetZone ? card.value : Math.floor(card.value * 0.5);
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

  if (side === 'neutral' || advantageScore < 1) {
    return { type:'out', display:'Groundout', runsScored:0, outsAdded:1, newBases:{ ...bases, first:false } };
  }

  if (side === 'batter') {
    if (advantageScore >= 50) {
      return { type:'hr', display:'🚀 HOME RUN!', runsScored:1+countRunners(bases), outsAdded:0, newBases:{first:false,second:false,third:false} };
    }
    if (advantageScore >= 40) {
      if (r < 0.55) return { type:'hr', display:'💥 HOME RUN!', runsScored:1+countRunners(bases), outsAdded:0, newBases:{first:false,second:false,third:false} };
      return { type:'triple', display:'🔥 TRIPLE!', runsScored:runsOnHit(bases,3), outsAdded:0, newBases:advanceBases(bases,3) };
    }
    if (advantageScore >= 30) {
      if (r < 0.15) return { type:'hr', display:'⚾ HOME RUN!', runsScored:1+countRunners(bases), outsAdded:0, newBases:{first:false,second:false,third:false} };
      if (r < 0.50) return { type:'triple', display:'🔥 TRIPLE!', runsScored:runsOnHit(bases,3), outsAdded:0, newBases:advanceBases(bases,3) };
      return { type:'double', display:'Double!', runsScored:runsOnHit(bases,2), outsAdded:0, newBases:advanceBases(bases,2) };
    }
    if (advantageScore >= 20) {
      if (r < 0.40) return { type:'double', display:'Double!', runsScored:runsOnHit(bases,2), outsAdded:0, newBases:advanceBases(bases,2) };
      if (r < 0.75) return { type:'single', display:'Single!', runsScored:runsOnHit(bases,1), outsAdded:0, newBases:advanceBases(bases,1) };
      return { type:'out', display:'Hard hit — out at 1st', runsScored:0, outsAdded:1, newBases:{...bases} };
    }
    if (advantageScore >= 10) {
      if (r < 0.50) return { type:'single', display:'Single!', runsScored:runsOnHit(bases,1), outsAdded:0, newBases:advanceBases(bases,1) };
      if (r < 0.80) return { type:'out', display:'Flyout', runsScored:0, outsAdded:1, newBases:{...bases} };
      const rbi = bases.second || bases.third;
      return { type:'single', display: rbi ? 'RBI Single!' : 'Single!', runsScored:runsOnHit(bases,1), outsAdded:0, newBases:advanceBases(bases,1) };
    }
    // 1–9
    if (r < 0.30) return { type:'single', display:'Infield Single!', runsScored:0, outsAdded:0, newBases:advanceBases(bases,1) };
    return { type:'out', display:'Weak Groundout', runsScored:0, outsAdded:1, newBases:{...bases} };
  }

  // Pitcher advantage
  if (advantageScore >= 50) return { type:'k', display:'⚡ STRIKEOUT! (Dominant)', runsScored:0, outsAdded:1, newBases:{...bases} };
  if (advantageScore >= 40) return { type:'k', display:'⚡ STRIKEOUT! Punchout!',  runsScored:0, outsAdded:1, newBases:{...bases} };
  if (advantageScore >= 30) return { type:'k', display:'⚡ STRIKEOUT!',             runsScored:0, outsAdded:1, newBases:{...bases} };
  if (advantageScore >= 20) {
    if (r < 0.60) return { type:'k',   display:'Strikeout', runsScored:0, outsAdded:1, newBases:{...bases} };
    return              { type:'out', display:'Groundout',  runsScored:0, outsAdded:1, newBases:{...bases} };
  }
  if (advantageScore >= 10) {
    if (r < 0.75) return { type:'out',    display:'Groundout / Flyout', runsScored:0, outsAdded:1, newBases:{...bases} };
    return              { type:'single', display:'Weak Single',         runsScored:0, outsAdded:0, newBases:advanceBases(bases,1) };
  }
  // 1–9
  if (r < 0.10) return { type:'single', display:'Bloop Single', runsScored:0, outsAdded:0, newBases:advanceBases(bases,1) };
  return               { type:'out',    display:'Groundout',     runsScored:0, outsAdded:1, newBases:{...bases} };
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
    const outcome = { type:'walk', display:'🟡 WALK — Ball four!', runsScored:0, outsAdded:0, newBases:advanceBases(bases,1) };
    log.push(`TRIGGER: Walk (margin ${Math.round(z1Margin)} ≥ ${walkThreshold})`);
    return buildResult({ z1:{pitcherTotal:Math.round(pitcherZ1Total),batterTotal:Math.round(batterZ1Total),margin:Math.round(Math.abs(z1Margin)),winner:z1Winner,counterFired:counterResult.counterFired,counterCardId:counterResult.counterCardId,pitchCallMatched:counterResult.pitchCallMatched,mult:counterResult.multiplier}, z2:{}, z3:{}, trigger:'walk', advantageSide:'batter', advantageScore:0, outcome, log, staminaState, primaryPitchCall });
  }
  if (-z1Margin >= 10) {
    const outcome = { type:'k', display:'⚫ Called Strike 3!', runsScored:0, outsAdded:1, newBases:{...bases} };
    log.push(`TRIGGER: Called Strike 3 (pitcher margin ${Math.round(-z1Margin)} ≥ 10)`);
    return buildResult({ z1:{pitcherTotal:Math.round(pitcherZ1Total),batterTotal:Math.round(batterZ1Total),margin:Math.round(Math.abs(z1Margin)),winner:z1Winner,counterFired:counterResult.counterFired,counterCardId:counterResult.counterCardId,pitchCallMatched:counterResult.pitchCallMatched,mult:counterResult.multiplier}, z2:{}, z3:{}, trigger:'called_k', advantageSide:'pitcher', advantageScore:0, outcome, log, staminaState, primaryPitchCall });
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

  // Change of Speed (P17): reduce batter Z2 by 4
  if ((pitcherPlacement.z2 || []).includes('P17')) {
    batterZ2Action = Math.max(0, batterZ2Action - 4);
    log.push('Change of Speed: batter Z2 −4');
  }

  // Upper Deck (B27): batter's own Z2 −4
  if ((batterPlacement.z3 || []).includes('B27')) {
    batterZ2Action = Math.max(0, batterZ2Action - 4);
    log.push('Upper Deck: batter Z2 −4');
  }

  // Sequence Breaker (P19): +6 if different pitch than last PA
  if ((pitcherPlacement.z2 || []).includes('P19') && prevPitchCall && prevPitchCall !== primaryPitchCall) {
    pitcherZ2Action += 6;
    log.push('Sequence Breaker: +6 (different pitch)');
  }

  // High Cheese (P15): +3 if pitch is fastball variant
  if ((pitcherPlacement.z2 || []).includes('P15') && isFastballVariant(primaryPitchCall)) {
    pitcherZ2Action += 3;
    log.push('High Cheese: +3 (fastball variant)');
  }

  // Bury It (P20): +4 if pitch is breaking ball
  if ((pitcherPlacement.z2 || []).includes('P20') && isBreakingBall(primaryPitchCall)) {
    pitcherZ2Action += 4;
    log.push('Bury It: +4 (breaking ball)');
  }

  // Late Contact (B17): +4 if pitch was off-speed
  if ((batterPlacement.z2 || []).includes('B17') && isOffSpeedPitch(primaryPitchCall)) {
    batterZ2Action += 4;
    log.push('Late Contact: +4 (off-speed pitch)');
  }

  // Uncountered Changeup (Slow) bonus — P7: +5 to pitcher Z2 if not countered
  if ((pitcherPlacement.z1 || []).includes('P7') && !counterResult.counterFired) {
    pitcherZ2Action += 5;
    log.push('Changeup (Slow) uncountered: pitcher Z2 +5');
  }

  // Player card Z2 bonuses
  const pitcherZ2Bonus = pitcherChar.zoneBonuses.z2 + smokeBonus;
  let   batterZ2Bonus  = batterChar.zoneBonuses.z2 + readAffinityBonus.z2;

  // Clutch bonus: Captain (BC09) trailing +3
  if (batterChar.id === 'BC09' && score.batting < score.pitching) {
    batterZ2Bonus += 3;
  }

  // Ice Peterson final inning close — double zone bonuses (simplified: +z2 bonus again)
  const isPetersonClutch = batterChar.id === 'BC06' && inning >= totalInnings && Math.abs(score.batting - score.pitching) <= 1;
  if (isPetersonClutch) batterZ2Bonus += batterChar.zoneBonuses.z2;

  const pitcherZ2Total = pitcherZ2Action + pitcherZ2Bonus;
  const batterZ2Total  = batterZ2Action  + batterZ2Bonus;
  const z2Margin       = batterZ2Total - pitcherZ2Total;
  const hardContact    = z2Margin >= 15;
  const z2Winner       = z2Margin > 0 ? 'batter' : (z2Margin < 0 ? 'pitcher' : 'tie');

  log.push(`Z2 — Pitcher: ${Math.round(pitcherZ2Total)}  Batter: ${Math.round(batterZ2Total)}  → ${z2Winner.toUpperCase()} (margin: ${Math.round(Math.abs(z2Margin))})${hardContact ? ' 🔥 HARD CONTACT!' : ''}`);

  // Strikeout Swinging trigger
  const kImmune = (batterPlacement.z2 || []).some(id => ['B13','B16'].includes(id)) || batterChar.id === 'BC02';
  if (-z2Margin >= 15 && !kImmune) {
    const outcome = { type:'k', display:'⚡ STRIKEOUT SWINGING!', runsScored:0, outsAdded:1, newBases:{...bases} };
    log.push('TRIGGER: Strikeout Swinging (pitcher margin ≥ 15)');
    return buildResult({ z1:{pitcherTotal:Math.round(pitcherZ1Total),batterTotal:Math.round(batterZ1Total),margin:Math.round(Math.abs(z1Margin)),winner:z1Winner,counterFired:counterResult.counterFired,counterCardId:counterResult.counterCardId,pitchCallMatched:counterResult.pitchCallMatched,mult:counterResult.multiplier}, z2:{pitcherTotal:Math.round(pitcherZ2Total),batterTotal:Math.round(batterZ2Total),margin:Math.round(Math.abs(z2Margin)),winner:z2Winner,hardContact}, z3:{}, trigger:'k_swinging', advantageSide:'pitcher', advantageScore:0, outcome, log, staminaState, primaryPitchCall });
  }

  // ── ZONE 3 ─────────────────────────────────────────────────────────────────
  let pitcherZ3Action = sumZone(pitcherPlacement.z3, 'z3');
  let batterZ3Action  = sumZone(batterPlacement.z3,  'z3');

  // Paint the Corners (P14) / Spotting (P21): +4 to pitcher Z3
  if ((pitcherPlacement.z2 || []).includes('P14')) { pitcherZ3Action += 4; log.push('Paint the Corners: pitcher Z3 +4'); }
  if ((pitcherPlacement.z2 || []).includes('P21')) { pitcherZ3Action += 4; log.push('Spotting: pitcher Z3 +4'); }

  // Pitch affinity — Zone 3
  for (const aff of (pitcherChar.pitchAffinity || [])) {
    if (aff.zone === 'z3' && pitchTypeCards.some(c => c.pitchCall === aff.pitchCall)) {
      pitcherZ3Action += aff.bonus;
      log.push(`Pitch affinity Z3 (${pitcherChar.name}): +${aff.bonus}`);
    }
  }

  // Stamina modifier — Zone 3
  pitcherZ3Action += staminaMod.z3;

  // Batter Z2 specials that affect Z3
  if ((batterPlacement.z2 || []).includes('B12')) { batterZ3Action = Math.max(0, batterZ3Action - 3); log.push('Contact Swing: batter Z3 −3'); }
  if ((batterPlacement.z2 || []).includes('B14')) { batterZ3Action += 5; log.push('Full Extension: batter Z3 +5'); }
  if ((batterPlacement.z2 || []).includes('B18') && z2Winner === 'batter') { batterZ3Action += 6; log.push('Barrel It: batter Z3 +6 (won Z2)'); }

  // Hard Contact: double batter Z3 action total
  if (hardContact) { batterZ3Action *= 2; log.push('Hard Contact: batter Z3 ×2'); }

  // Zone 3 defense counters
  const z3Penalty = checkZ3Counters(batterPlacement.z3, pitcherPlacement.z3, pitcherPlacement.z2);
  if (z3Penalty < 0) { batterZ3Action += z3Penalty; log.push(`Z3 counters: batter Z3 ${z3Penalty}`); }

  // Inside-Out Swing (B19): reduces shift penalties on batter Z3 by 6
  if ((batterPlacement.z2 || []).includes('B19')) {
    // Re-add 6 for each shift card (P23, P28) that was applied (they were already subtracted above)
    const shiftCards = (pitcherPlacement.z3 || []).filter(id => ['P23','P28'].includes(id));
    shiftCards.forEach(() => { batterZ3Action = Math.min(batterZ3Action + 6, batterZ3Action + 6); }); // clamp isn't needed here
    if (shiftCards.length > 0) log.push(`Inside-Out Swing: recovers 6 per shift card (${shiftCards.length})`);
  }

  // Player card Z3 bonuses
  const pitcherZ3Bonus = pitcherChar.zoneBonuses.z3 + smokeBonus;
  let   batterZ3Bonus  = batterChar.zoneBonuses.z3 + readAffinityBonus.z3;

  // Clutch bonuses
  const hasRISP = bases.second || bases.third;
  const hasRunnerOnBase = bases.first || bases.second || bases.third;
  if (batterChar.id === 'BC01' && hasRISP)         { batterZ3Bonus += 5; log.push('The Bear RISP: +5 Z3'); }
  if (batterChar.id === 'BC08' && hasRISP)         { batterZ3Bonus += 5; log.push('Jackson runner on base: +5 Z3'); }
  if (batterChar.id === 'BC12' && hasRISP)         { batterZ3Bonus += 7; log.push('The Bricks RISP: +7 Z3'); }
  if (batterChar.id === 'BC09' && score.batting < score.pitching) { batterZ3Bonus += 3; log.push('The Captain trailing: +3 Z3'); }
  if (isPetersonClutch) { batterZ3Bonus += batterChar.zoneBonuses.z3; log.push('Ice Peterson clutch: Z3 bonuses doubled'); }
  if (batterChar.id === 'BC05' && bases.second)    { batterZ3Bonus += 5; log.push('El Rayo runner on 2nd: +5 Z3'); }

  // Clutch card (B30): double value when trailing
  const clutchVal = (batterPlacement.z3 || []).filter(id => id === 'B30').length;
  if (clutchVal > 0 && score.batting < score.pitching) {
    const cardV = getZoneValue(getCard('B30'), 'z3');
    batterZ3Action += cardV * clutchVal; // already counted once in sumZone; add another time
    log.push(`Clutch card: double value while trailing (+${cardV * clutchVal})`);
  }

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
    const outcome = { type:'hr', display:'🚀💥 HOME RUN! SLAMMED!', runsScored:1+countRunners(bases), outsAdded:0, newBases:{first:false,second:false,third:false} };
    log.push('TRIGGER: Home Run (win all 3 zones, score ≥ 30)');
    // Jackson: HR counts as 2 runs
    if (batterChar.id === 'BC08') { outcome.runsScored += 1; outcome.display += ' (Tape Measure — 2 runs!)'; }
    return buildResult({ z1:{pitcherTotal:Math.round(pitcherZ1Total),batterTotal:Math.round(batterZ1Total),margin:Math.round(Math.abs(z1Margin)),winner:z1Winner,counterFired:counterResult.counterFired,counterCardId:counterResult.counterCardId,pitchCallMatched:counterResult.pitchCallMatched,mult:counterResult.multiplier}, z2:{pitcherTotal:Math.round(pitcherZ2Total),batterTotal:Math.round(batterZ2Total),margin:Math.round(Math.abs(z2Margin)),winner:z2Winner,hardContact}, z3:{pitcherTotal:Math.round(pitcherZ3Total),batterTotal:Math.round(batterZ3Total),margin:Math.round(Math.abs(z3Margin)),winner:z3Winner}, trigger:'hr', advantageSide, advantageScore, outcome, log, staminaState, primaryPitchCall });
  }

  if (advantageSide === 'pitcher' && pitcherWins === 3 && advantageScore >= 30) {
    let outcome;
    if (bases.first) {
      outcome = { type:'dp', display:'🔄 DOUBLE PLAY!', runsScored:0, outsAdded:2, newBases:{...bases, first:false, second:bases.first} };
    } else {
      outcome = { type:'k', display:'⚫⚡ STRIKEOUT LOOKING!', runsScored:0, outsAdded:1, newBases:{...bases} };
    }
    log.push('TRIGGER: Dominant pitcher (win all 3 zones, score ≥ 30)');
    return buildResult({ z1:{pitcherTotal:Math.round(pitcherZ1Total),batterTotal:Math.round(batterZ1Total),margin:Math.round(Math.abs(z1Margin)),winner:z1Winner,counterFired:counterResult.counterFired,counterCardId:counterResult.counterCardId,pitchCallMatched:counterResult.pitchCallMatched,mult:counterResult.multiplier}, z2:{pitcherTotal:Math.round(pitcherZ2Total),batterTotal:Math.round(batterZ2Total),margin:Math.round(Math.abs(z2Margin)),winner:z2Winner,hardContact}, z3:{pitcherTotal:Math.round(pitcherZ3Total),batterTotal:Math.round(batterZ3Total),margin:Math.round(Math.abs(z3Margin)),winner:z3Winner}, trigger:'dp_or_k', advantageSide, advantageScore, outcome, log, staminaState, primaryPitchCall });
  }

  // ── GENERAL OUTCOME ─────────────────────────────────────────────────────────
  let outcome = getOutcome(advantageScore, advantageSide, bases);

  // Double Play Depth (P27): groundout with runner on 1st → DP
  if (outcome.type === 'out' && (pitcherPlacement.z3 || []).includes('P27') && bases.first) {
    outcome = { type:'dp', display:'🔄 Double Play! (Double Play Depth)', runsScored:0, outsAdded:2, newBases:{...bases, first:false} };
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
    z1:{ pitcherTotal:Math.round(pitcherZ1Total), batterTotal:Math.round(batterZ1Total), margin:Math.round(Math.abs(z1Margin)), winner:z1Winner, counterFired:counterResult.counterFired, counterCardId:counterResult.counterCardId, pitchCallMatched:counterResult.pitchCallMatched, mult:counterResult.multiplier },
    z2:{ pitcherTotal:Math.round(pitcherZ2Total), batterTotal:Math.round(batterZ2Total), margin:Math.round(Math.abs(z2Margin)), winner:z2Winner, hardContact },
    z3:{ pitcherTotal:Math.round(pitcherZ3Total), batterTotal:Math.round(batterZ3Total), margin:Math.round(Math.abs(z3Margin)), winner:z3Winner },
    trigger: null, advantageSide, advantageScore, outcome, log, staminaState, primaryPitchCall,
  });
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
