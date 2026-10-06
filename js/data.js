'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ACTION CARDS (70 cards) — Pure Number Cards (Values 1-10)
// No bonuses, no modifiers, no special rules.
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_CARDS = {
  // Pitcher Number Cards (Values 1-10)
  'P1' :{ id:'P1' , value:10, type:'pitcher' },
  'P2' :{ id:'P2' , value:9 , type:'pitcher' },
  'P3' :{ id:'P3' , value:9 , type:'pitcher' },
  'P4' :{ id:'P4' , value:8 , type:'pitcher' },
  'P5' :{ id:'P5' , value:5 , type:'pitcher' },
  'P6' :{ id:'P6' , value:2 , type:'pitcher' },
  'P7' :{ id:'P7' , value:3 , type:'pitcher' },
  'P8' :{ id:'P8' , value:6 , type:'pitcher' },
  'P9' :{ id:'P9' , value:2 , type:'pitcher' },
  'P10':{ id:'P10', value:3 , type:'pitcher' },
  'P11':{ id:'P11', value:3 , type:'pitcher' },
  'P12':{ id:'P12', value:10, type:'pitcher' },
  'P13':{ id:'P13', value:7 , type:'pitcher' },
  'P14':{ id:'P14', value:6 , type:'pitcher' },
  'P15':{ id:'P15', value:9 , type:'pitcher' },
  'P16':{ id:'P16', value:2 , type:'pitcher' },
  'P17':{ id:'P17', value:2 , type:'pitcher' },
  'P18':{ id:'P18', value:5 , type:'pitcher' },
  'P19':{ id:'P19', value:1 , type:'pitcher' },
  'P20':{ id:'P20', value:8 , type:'pitcher' },
  'P21':{ id:'P21', value:2 , type:'pitcher' },
  'P22':{ id:'P22', value:9 , type:'pitcher' },
  'P23':{ id:'P23', value:5 , type:'pitcher' },
  'P24':{ id:'P24', value:3 , type:'pitcher' },
  'P25':{ id:'P25', value:2 , type:'pitcher' },
  'P26':{ id:'P26', value:4 , type:'pitcher' },
  'P27':{ id:'P27', value:4 , type:'pitcher' },
  'P28':{ id:'P28', value:8 , type:'pitcher' },
  'P29':{ id:'P29', value:5 , type:'pitcher' },
  'P30':{ id:'P30', value:1 , type:'pitcher' },

  // Batter Number Cards (Values 1-10)
  'B1' :{ id:'B1' , value:2 , type:'batter' },
  'B2' :{ id:'B2' , value:8 , type:'batter' },
  'B3' :{ id:'B3' , value:2 , type:'batter' },
  'B4' :{ id:'B4' , value:3 , type:'batter' },
  'B5' :{ id:'B5' , value:8 , type:'batter' },
  'B6' :{ id:'B6' , value:9 , type:'batter' },
  'B7' :{ id:'B7' , value:2 , type:'batter' },
  'B8' :{ id:'B8' , value:5 , type:'batter' },
  'B9' :{ id:'B9' , value:7 , type:'batter' },
  'B10':{ id:'B10', value:4 , type:'batter' },
  'B11':{ id:'B11', value:6 , type:'batter' },
  'B12':{ id:'B12', value:2 , type:'batter' },
  'B13':{ id:'B13', value:1 , type:'batter' },
  'B14':{ id:'B14', value:2 , type:'batter' },
  'B15':{ id:'B15', value:8 , type:'batter' },
  'B16':{ id:'B16', value:3 , type:'batter' },
  'B17':{ id:'B17', value:5 , type:'batter' },
  'B18':{ id:'B18', value:9 , type:'batter' },
  'B19':{ id:'B19', value:4 , type:'batter' },
  'B20':{ id:'B20', value:2 , type:'batter' },
  'B21':{ id:'B21', value:7 , type:'batter' },
  'B22':{ id:'B22', value:8 , type:'batter' },
  'B23':{ id:'B23', value:9 , type:'batter' },
  'B24':{ id:'B24', value:2 , type:'batter' },
  'B25':{ id:'B25', value:1 , type:'batter' },
  'B26':{ id:'B26', value:6 , type:'batter' },
  'B27':{ id:'B27', value:8 , type:'batter' },
  'B28':{ id:'B28', value:3 , type:'batter' },
  'B29':{ id:'B29', value:10, type:'batter' },
  'B30':{ id:'B30', value:5 , type:'batter' },

  // Universal Number Cards (Values 1-10)
  'U1' :{ id:'U1' , value:5 , type:'universal' },
  'U2' :{ id:'U2' , value:3 , type:'universal' },
  'U3' :{ id:'U3' , value:8 , type:'universal' },
  'U4' :{ id:'U4' , value:4 , type:'universal' },
  'U5' :{ id:'U5' , value:2 , type:'universal' },
  'U6' :{ id:'U6' , value:2 , type:'universal' },
  'U7' :{ id:'U7' , value:8 , type:'universal' },
  'U8' :{ id:'U8' , value:1 , type:'universal' },
  'U9' :{ id:'U9' , value:9 , type:'universal' },
  'U10':{ id:'U10', value:10, type:'universal' },
};


// ─────────────────────────────────────────────────────────────────────────────
// PITCHER CHARACTERS (8)
// strikeZone: { low, high, bullseye, wildBust }
// ─────────────────────────────────────────────────────────────────────────────
const PITCH_BASE_POWER = {
  fastball: 8,
  breaking: 6,
  offspeed: 4
};

const SWING_TYPES = {
  contact:  { id: 'contact',  name: 'Contact Swing',  baseDiff: 3, icon: '🏏', desc: 'Protects the plate. Avoids Strikeout. Focuses on singles and putting ball in play.' },
  balanced: { id: 'balanced', name: 'Balanced Swing', baseDiff: 5, icon: '⚖️', desc: 'Standard line drive swing. Capable of gap doubles and home runs on mistake pitches.' },
  power:    { id: 'power',    name: 'Power Swing',    baseDiff: 8, icon: '💥', desc: 'Swinging for the fences. Unlocks home runs and extra bases, but vulnerable to strikeouts.' }
};

const PITCHER_CHARACTERS = {
  'PC01':{ id:'PC01', name:'"Big Jake" Harmon'        , archetype:'Power Pitcher'      , color:'#c44b4b',
    executionDifficulties:{ fastball:3, breaking:5, offspeed:8 },
    zoneBonuses:{ z1:-1, z2:5, z3:-2 },
    repertoire:{ fastball:5, breaking:3, offspeed:1 },
    strikeZone:{ low:10, high:16, bullseye:13, wildBust:20 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z2', bonus:3}, {pitchCall:'slider', zone:'z2', bonus:2} ],
    stamina:{ freshMax:5, tiringMax:8, tiringMod:{z1:0,z2:-3,z3:0}, gassedMod:{z1:-2,z2:-5,z3:0} },
    specialText:'Power Ace. Fastball (Diff 3), Breaking (Diff 5), Offspeed (Diff 8).' },
  'PC02':{ id:'PC02', name:'"El Arte" Medina'          , archetype:'Control Artist'     , color:'#4b8bc4',
    executionDifficulties:{ offspeed:3, breaking:4, fastball:6 },
    zoneBonuses:{ z1:4, z2:2, z3:2 },
    repertoire:{ fastball:3, breaking:4, offspeed:2 },
    strikeZone:{ low:9, high:15, bullseye:12, wildBust:19 },
    pitchAffinity:[ {pitchCall:'changeup', zone:'z1', bonus:4}, {pitchCall:'changeup_slow', zone:'z1', bonus:4}, {pitchCall:'curveball', zone:'z1', bonus:2} ],
    stamina:{ freshMax:7, tiringMax:10, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Pinpoint Master. Offspeed (Diff 3), Breaking (Diff 4), Fastball (Diff 6).' },
  'PC03':{ id:'PC03', name:'"The Groundskeeper" Pérez', archetype:'Ground Ball Machine', color:'#4baa5a',
    executionDifficulties:{ fastball:3, breaking:5, offspeed:6 },
    zoneBonuses:{ z1:2, z2:0, z3:6 },
    repertoire:{ fastball:4, breaking:3, offspeed:2 },
    strikeZone:{ low:8, high:14, bullseye:11, wildBust:18 },
    pitchAffinity:[ {pitchCall:'twoseamer', zone:'z3', bonus:5}, {pitchCall:'splitter', zone:'z3', bonus:3} ],
    stamina:{ freshMax:7, tiringMax:11, tiringMod:{z1:0,z2:0,z3:-3}, gassedMod:{z1:0,z2:-2,z3:-5} },
    specialText:'Heavy Sinkerballer. Fastball (Diff 3), Breaking (Diff 5), Offspeed (Diff 6).' },
  'PC04':{ id:'PC04', name:'"Smoke" Williams'          , archetype:'Closer'             , color:'#e0a020',
    executionDifficulties:{ fastball:2, breaking:6, offspeed:9 },
    zoneBonuses:{ z1:0, z2:7, z3:2 },
    repertoire:{ fastball:5, breaking:4, offspeed:0 },
    strikeZone:{ low:11, high:17, bullseye:14, wildBust:21 },
    pitchAffinity:[ {pitchCall:'slider', zone:'z2', bonus:5}, {pitchCall:'fastball', zone:'z2', bonus:3} ],
    stamina:{ freshMax:3, tiringMax:5, tiringMod:{z1:0,z2:-4,z3:0}, gassedMod:{z1:0,z2:-8,z3:0} },
    specialText:'Flamethrower Closer. Fastball (Diff 2), Breaking (Diff 6), Offspeed (Diff 9).' },
  'PC05':{ id:'PC05', name:'"The Professor" Volkov'    , archetype:'Junkballer'         , color:'#8855cc',
    executionDifficulties:{ offspeed:2, breaking:4, fastball:7 },
    zoneBonuses:{ z1:6, z2:-2, z3:3 },
    repertoire:{ fastball:2, breaking:4, offspeed:3 },
    strikeZone:{ low:7, high:13, bullseye:10, wildBust:17 },
    pitchAffinity:[ {pitchCall:'knuckleball', zone:'z1', bonus:3}, {pitchCall:'eephus', zone:'z1', bonus:5} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:0,z3:-2} },
    specialText:'Soft-tossing Wizard. Offspeed (Diff 2), Breaking (Diff 4), Fastball (Diff 7).' },
  'PC06':{ id:'PC06', name:'"The Machine" Castillo'    , archetype:'Ace'                , color:'#e8b84b',
    executionDifficulties:{ fastball:3, breaking:4, offspeed:5 },
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    repertoire:{ fastball:4, breaking:3, offspeed:2 },
    strikeZone:{ low:9, high:16, bullseye:12, wildBust:20 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z1', bonus:1}, {pitchCall:'slider', zone:'z1', bonus:1}, {pitchCall:'curveball', zone:'z1', bonus:1}, {pitchCall:'changeup', zone:'z1', bonus:1} ],
    stamina:{ freshMax:8, tiringMax:11, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Complete Ace. Fastball (Diff 3), Breaking (Diff 4), Offspeed (Diff 5).' },
  'PC07':{ id:'PC07', name:'"Setup Man" Kowalski'      , archetype:'Reliever'           , color:'#4b99aa',
    executionDifficulties:{ fastball:4, breaking:4, offspeed:6 },
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    repertoire:{ fastball:4, breaking:4, offspeed:1 },
    strikeZone:{ low:10, high:15, bullseye:13, wildBust:19 },
    pitchAffinity:[ {pitchCall:'cutter', zone:'z2', bonus:3}, {pitchCall:'twoseamer', zone:'z3', bonus:2} ],
    stamina:{ freshMax:4, tiringMax:6, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:0,z2:-4,z3:-2} },
    specialText:'Setup Specialist. Fastball (Diff 4), Breaking (Diff 4), Offspeed (Diff 6).' },
  'PC08':{ id:'PC08', name:'"The Wizard" Chen'         , archetype:'Deceptive Starter'  , color:'#cc5599',
    executionDifficulties:{ breaking:3, offspeed:4, fastball:6 },
    zoneBonuses:{ z1:3, z2:2, z3:1 },
    repertoire:{ fastball:3, breaking:5, offspeed:1 },
    strikeZone:{ low:8, high:15, bullseye:11, wildBust:19 },
    pitchAffinity:[ {pitchCall:'slurve', zone:'z1', bonus:5}, {pitchCall:'splitter', zone:'z1', bonus:3} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:-2,z3:0} },
    specialText:'Spin Deception. Breaking (Diff 3), Offspeed (Diff 4), Fastball (Diff 6).' },
};

// ─────────────────────────────────────────────────────────────────────────────
// BATTER CHARACTERS (12)
// battedBallSpectrum: [{ min, max, outcome, label, color }]
// ─────────────────────────────────────────────────────────────────────────────
const BATTER_CHARACTERS = {
  'BC01':{ id:'BC01', name:'"The Bear" Mackintosh'      , archetype:'Slugger'            , color:'#c44b4b',
    scoutingReport:{ hotZone:'high', coldZone:'low', favoritePitch:'fastball' },
    swingDifficulties:{ contact:3, balanced:5, power:8 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:9, outcome:'single', label:'Single', color:'#3182ce' },
      { min:10, max:10, outcome:'flyout', label:'Deep Flyout', color:'#718096' },
      { min:11, max:12, outcome:'homerun', label:'HOME RUN 🔥', color:'#ecc94b' },
      { min:13, max:13, outcome:'double', label:'Monster Double ⚡', color:'#38b2ac' },
      { min:14, max:14, outcome:'homerun', label:'UPPER DECK HR 🔥', color:'#ecc94b' },
      { min:15, max:99, outcome:'flyout', label:'Deep Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-2, z2:2, z3:6 },
    readAffinity:{ trigger:'any_counter', effect:'z3_bonus:3' },
    clutch:{ condition:'risp', bonuses:{z3:5} },
    specialText:'Slugger. Hot: High 🔥 | Cold: Low ❄️ | Loves Fastballs. Power Swing (Diff 8).' },
  'BC02':{ id:'BC02', name:'"Slick" Torres'             , archetype:'Contact Hitter'     , color:'#4b8bc4',
    scoutingReport:{ hotZone:'low', coldZone:'high', favoritePitch:'offspeed' },
    swingDifficulties:{ contact:2, balanced:5, power:9 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:11, outcome:'single', label:'Single', color:'#3182ce' },
      { min:12, max:13, outcome:'flyout', label:'Lineout / Flyout', color:'#718096' },
      { min:14, max:14, outcome:'double', label:'Line Drive ⚡', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:5, z3:-1 },
    readAffinity:{ trigger:'B1', effect:'z2_bonus:5' },
    clutch:{ condition:'two_strikes', bonuses:{z2:3} },
    specialText:'Contact Master. Hot: Low 🔥 | Cold: High ❄️ | Loves Offspeed. Elite Contact (Diff 2).' },
  'BC03':{ id:'BC03', name:'"The Professor" Nakamura'   , archetype:'Disciplined Hitter' , color:'#8855cc',
    scoutingReport:{ hotZone:'low', coldZone:'high', favoritePitch:'breaking' },
    swingDifficulties:{ contact:3, balanced:4, power:8 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:12, outcome:'flyout', label:'Flyout', color:'#718096' },
      { min:13, max:13, outcome:'double', label:'Gap Double ⚡', color:'#38b2ac' },
      { min:14, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:6, z2:1, z3:-2 },
    readAffinity:{ trigger:'B4', effect:'walk_at_7' },
    clutch:{ condition:'full_count', bonuses:{z1:4} },
    specialText:'Disciplined Eye. Hot: Low 🔥 | Cold: High ❄️ | Loves Breaking. Balanced (Diff 4).' },
  'BC04':{ id:'BC04', name:'"Boom Boom" Barrett'        , archetype:'Free Swinger'       , color:'#e0a020',
    scoutingReport:{ hotZone:'high', coldZone:'low', favoritePitch:'fastball' },
    swingDifficulties:{ contact:4, balanced:5, power:7 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'k', label:'Strikeout Swinging ⚡', color:'#e53e3e' },
      { min:11, max:11, outcome:'single', label:'Single', color:'#3182ce' },
      { min:12, max:13, outcome:'homerun', label:'MONSTER BOMB 🔥', color:'#ecc94b' },
      { min:14, max:14, outcome:'double', label:'Double', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-4, z2:4, z3:5 },
    readAffinity:{ trigger:'B6', effect:'z3_bonus:8' },
    clutch:{ condition:'pitcher_won_z1_last_pa', bonuses:{z1:-2} },
    specialText:'Free Swinger. Hot: High 🔥 | Cold: Low ❄️ | Loves Fastballs. Power Swing (Diff 7).' },
  'BC05':{ id:'BC05', name:'"El Rayo" Fuentes'          , archetype:'Speed Specialist'   , color:'#4baa5a',
    scoutingReport:{ hotZone:'low', coldZone:'high', favoritePitch:'fastball' },
    swingDifficulties:{ contact:2, balanced:5, power:9 },
    battedBallSpectrum: [
      { min:0, max:7, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:8, max:10, outcome:'single', label:'Infield Single ⚡', color:'#48bb78' },
      { min:11, max:13, outcome:'flyout', label:'Popout / Flyout', color:'#718096' },
      { min:14, max:14, outcome:'double', label:'Speed Double', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:2, z3:4 },
    readAffinity:{ trigger:'any_counter', effect:'auto_steal' },
    clutch:{ condition:'runner_on_second', bonuses:{z3:5} },
    specialText:'Speedster. Hot: Low 🔥 | Cold: High ❄️ | Loves Fastballs. Contact Swing (Diff 2).' },
  'BC06':{ id:'BC06', name:'"Ice" Peterson'             , archetype:'Clutch Hitter'      , color:'#4b99aa',
    scoutingReport:{ hotZone:'high', coldZone:'low', favoritePitch:'breaking' },
    swingDifficulties:{ contact:3, balanced:5, power:8 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Clutch Single', color:'#3182ce' },
      { min:11, max:12, outcome:'flyout', label:'Flyout', color:'#718096' },
      { min:13, max:13, outcome:'homerun', label:'HOME RUN 🔥', color:'#ecc94b' },
      { min:14, max:14, outcome:'double', label:'Double ⚡', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:1, z2:2, z3:3 },
    readAffinity:{ trigger:'any_counter', effect:'all_zones_bonus:2' },
    clutch:{ condition:'final_inning_close', effect:'double_bonuses' },
    specialText:'Clutch Performer. Hot: High 🔥 | Cold: Low ❄️ | Loves Breaking. Balanced (Diff 5).' },
  'BC07':{ id:'BC07', name:'"Scrappy" Olsen'            , archetype:'Utility Hitter'     , color:'#888888',
    scoutingReport:{ hotZone:'low', coldZone:'high', favoritePitch:'offspeed' },
    swingDifficulties:{ contact:3, balanced:5, power:8 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:9, outcome:'single', label:'Single', color:'#3182ce' },
      { min:10, max:12, outcome:'flyout', label:'Flyout', color:'#718096' },
      { min:13, max:13, outcome:'double', label:'Hustle Double', color:'#38b2ac' },
      { min:14, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    readAffinity:null,
    clutch:{ condition:'two_outs', bonuses:{chosen:3} },
    specialText:'Reliable Utility. Hot: Low 🔥 | Cold: High ❄️ | Loves Offspeed. Balanced (Diff 5).' },
  'BC08':{ id:'BC08', name:'"Lightning" Jackson'        , archetype:'Power Hitter'       , color:'#e8b84b',
    scoutingReport:{ hotZone:'high', coldZone:'low', favoritePitch:'fastball' },
    swingDifficulties:{ contact:3, balanced:5, power:7 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:9, outcome:'single', label:'Single', color:'#3182ce' },
      { min:10, max:12, outcome:'flyout', label:'Flyout', color:'#718096' },
      { min:13, max:13, outcome:'homerun', label:'LIGHTNING BLAST 🔥', color:'#ecc94b' },
      { min:14, max:14, outcome:'double', label:'Double', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-1, z2:2, z3:7 },
    readAffinity:{ trigger:'B2', effect:'z3_bonus:9' },
    clutch:{ condition:'runner_on_base', bonuses:{z3:5} },
    specialText:'Pure Power. Hot: High 🔥 | Cold: Low ❄️ | Loves Fastballs. Power Swing (Diff 7).' },
  'BC09':{ id:'BC09', name:'"The Captain" Reyes'        , archetype:'Complete Hitter'    , color:'#cc5599',
    scoutingReport:{ hotZone:'high', coldZone:'low', favoritePitch:'breaking' },
    swingDifficulties:{ contact:3, balanced:4, power:8 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:12, outcome:'flyout', label:'Lineout / Flyout', color:'#718096' },
      { min:13, max:13, outcome:'double', label:'Gap Double ⚡', color:'#38b2ac' },
      { min:14, max:14, outcome:'homerun', label:'Home Run 🔥', color:'#ecc94b' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    readAffinity:null,
    clutch:{ condition:'trailing', bonuses:{z1:3,z2:3,z3:3} },
    specialText:'Complete Leader. Hot: High 🔥 | Cold: Low ❄️ | Loves Breaking. Balanced (Diff 4).' },
  'BC10':{ id:'BC10', name:'"Ghost" Yamamoto'           , archetype:'Switch Hitter'      , color:'#5599dd',
    scoutingReport:{ hotZone:'low', coldZone:'high', favoritePitch:'offspeed' },
    swingDifficulties:{ contact:3, balanced:5, power:8 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Bunt / Single ⚡', color:'#48bb78' },
      { min:11, max:12, outcome:'flyout', label:'Flyout', color:'#718096' },
      { min:13, max:13, outcome:'single', label:'Clean Single', color:'#3182ce' },
      { min:14, max:14, outcome:'double', label:'Double', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:3, z2:2, z3:2 },
    readAffinity:null,
    clutch:null,
    specialText:'Switch Hitter. Hot: Low 🔥 | Cold: High ❄️ | Loves Offspeed. Balanced (Diff 5).' },
  'BC11':{ id:'BC11', name:'"The Wall" Dubois'          , archetype:'Defensive Specialist', color:'#44aa88',
    scoutingReport:{ hotZone:'low', coldZone:'high', favoritePitch:'fastball' },
    swingDifficulties:{ contact:2, balanced:5, power:9 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Pure Single', color:'#3182ce' },
      { min:11, max:12, outcome:'flyout', label:'Flyout', color:'#718096' },
      { min:13, max:13, outcome:'double', label:'Line Drive ⚡', color:'#38b2ac' },
      { min:14, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:5, z2:0, z3:-3 },
    readAffinity:{ trigger:'B5', effect:'walk_bonus_pct:25' },
    clutch:{ condition:'ahead_in_count', bonuses:{z1:5} },
    specialText:'Lead-off Table Setter. Hot: Low 🔥 | Cold: High ❄️ | Loves Fastballs. Contact (Diff 2).' },
  'BC12':{ id:'BC12', name:'"The Bricks" Murphy'        , archetype:'Designated Hitter'  , color:'#aa4444',
    scoutingReport:{ hotZone:'high', coldZone:'low', favoritePitch:'fastball' },
    swingDifficulties:{ contact:4, balanced:5, power:7 },
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'k', label:'Strikeout Swinging ⚡', color:'#e53e3e' },
      { min:11, max:11, outcome:'single', label:'Single', color:'#3182ce' },
      { min:12, max:13, outcome:'homerun', label:'UPPER DECK HR 🔥', color:'#ecc94b' },
      { min:14, max:14, outcome:'double', label:'Wall-Ball Double', color:'#38b2ac' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-4, z2:0, z3:9 },
    readAffinity:{ trigger:'B1_only', effect:'only_b1_counters' },
    clutch:{ condition:'risp', bonuses:{z3:7} },
    specialText:'Pure Cleanup DH. Hot: High 🔥 | Cold: Low ❄️ | Loves Fastballs. Power Swing (Diff 7).' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINEUP PRESETS (3 lineups of 9 batters)
// ─────────────────────────────────────────────────────────────────────────────
const LINEUP_PRESETS = {
  sluggers:{ name:'⚡ Power Order'  , desc:'Load up on sluggers and cleanup hitters'       , lineup:['BC08','BC01','BC12','BC06','BC04','BC09','BC07','BC02','BC05'] },
  balanced:{ name:'⚖️ Balanced Order', desc:'Contact at top, power in middle, speed at bottom', lineup:['BC11','BC02','BC09','BC08','BC01','BC06','BC07','BC05','BC03'] },
  speedy  :{ name:'🚀 Small Ball'   , desc:'Speed, contact, patience — manufacture runs'   , lineup:['BC05','BC11','BC03','BC02','BC10','BC07','BC09','BC06','BC04'] },
};

// ─────────────────────────────────────────────────────────────────────────────
// DECK PRESETS (3 decks of exactly 25 card IDs; duplicates allowed)
// ─────────────────────────────────────────────────────────────────────────────
const DECK_PRESETS = {
  grind: {
    name: '🛡️ Grind It Out',
    desc: 'Control pitching, patient hitting, stamina management. Win 3-2.',
    pitcherCards: ['P2','P3','P5','P6','P14','P17','P19','P24','P25','P27','U1','U4','U7','U8'],
    batterCards:  ['B4','B7','B9','B10','B12','B13','B16','B17','B20','B24','B25','U1','U4','U7','U8'],
    cards: ['P2','P3','P5','P6','P14','P17','P19','P24','P25','P27','B4','B7','B9','B10','B12','B13','B16','B17','B20','B24','B25','U1','U4','U7','U8']
  },
  bigInning: {
    name: '💥 Big Inning',
    desc: 'Raw power, high velocity, swing for the fences. Win 8-5.',
    pitcherCards: ['P1','P1','P4','P13','P13','P15','P20','P23','P23','P26','U1','U3','U7','U9'],
    batterCards:  ['B1','B6','B11','B11','B15','B21','B21','B22','B23','B27','B30','U1','U3','U7','U9'],
    cards: ['P1','P1','P4','P13','P13','P15','P20','P23','P23','P26','B1','B6','B11','B11','B15','B21','B21','B22','B23','B27','B30','U1','U3','U7','U9']
  },
  manager: {
    name: '🧠 The Manager',
    desc: 'Information advantage, deck manipulation, situational mastery.',
    pitcherCards: ['P2','P8','P10','P14','P17','P21','P22','P25','P28','P29','U1','U4','U5','U6','U7'],
    batterCards:  ['B4','B9','B9','B10','B13','B16','B19','B20','B24','B26','U1','U4','U5','U6','U7'],
    cards: ['P2','P8','P10','P14','P17','P21','P22','P25','P28','P29','B4','B9','B9','B10','B13','B16','B19','B20','B24','B26','U1','U4','U5','U6','U7']
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function getCard(id)          { return ACTION_CARDS[id]          || null; }
function getPitcher(id)       { return PITCHER_CHARACTERS[id]    || null; }
function getBatter(id)        { return BATTER_CHARACTERS[id]     || null; }
function getLineup(key)       { return LINEUP_PRESETS[key]       || null; }
function getDeckPreset(key)   { return DECK_PRESETS[key]         || null; }

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPitcherStaminaState(pitcherChar, pasFaced) {
  if (!pitcherChar) return 'fresh';
  if (pasFaced <= pitcherChar.stamina.freshMax)  return 'fresh';
  if (pasFaced <= pitcherChar.stamina.tiringMax) return 'tiring';
  return 'gassed';
}

function getStaminaMod(pitcherChar, pasFaced) {
  const state = getPitcherStaminaState(pitcherChar, pasFaced);
  if (state === 'fresh')  return {z1:0,z2:0,z3:0};
  if (state === 'tiring') return pitcherChar.stamina.tiringMod;
  return pitcherChar.stamina.gassedMod;
}

function isOffSpeedPitch(pitchCall) {
  return ['changeup','changeup_slow','slider','slurve','splitter','curveball','eephus'].includes(pitchCall);
}

function isBreakingBall(pitchCall) {
  return ['curveball','slider','slurve'].includes(pitchCall);
}

function isFastballVariant(pitchCall) {
  return ['fastball','cutter_fast','cutter'].includes(pitchCall);
}
