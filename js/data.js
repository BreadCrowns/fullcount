'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ACTION CARDS (70 cards)
// zone: preferred zone. Playing outside preferred zone → 50% value penalty.
// pitchCall: identifies pitch type for counter checks (pitcher Z1 cards only)
// counters: pitchCalls this card counters (batter Z1 cards only)
// counterMult: number = same mult for all; object = per-pitchCall mult
// z3CounterOf: batter card ID this pitcher Z3/Z2 card counters
// penalty: negative value applied to batter Z3 when z3CounterOf fires
// z3CounteredBy: pitcher card IDs that counter this batter Z3 card
// special: machine-readable effect tag
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_CARDS = {
  // ── PITCHER BEAT 1: PITCH EXECUTION & STRIKE ZONE CONTROL [read] ────────────
  'P1' :{ id:'P1' , name:'Corner Paint'         , type:'pitcher', beat:'beat1', zone:'read'   , value:10, pitchCall:'fastball'   , synergyPitch:'fastball', synergyBonus:2, advantagePerk:'high_heat'   , powerBadge:'🔥 Fastball +2', desc:'[Beat 1: Fastball Synergy] +10 Base. Pairs with Fastball for +2 Synergy. If Advantage won: Batter loses -2 Power in Beat 2!' },
  'P2' :{ id:'P2' , name:'Offspeed Touch'       , type:'pitcher', beat:'beat1', zone:'read'   , value:9 , pitchCall:'offspeed'   , synergyPitch:'offspeed', synergyBonus:2, advantagePerk:'fooled_timing', powerBadge:'⏱️ Offspeed +2', desc:'[Beat 1: Offspeed Synergy] +9 Base. Pairs with Offspeed (4 + 9 = 13 Bullseye!). If Advantage won: Batter loses -3 Power in Beat 2!' },
  'P3' :{ id:'P3' , name:'Sharp Movement'       , type:'pitcher', beat:'beat1', zone:'read'   , value:9 , pitchCall:'breaking'   , synergyPitch:'breaking', synergyBonus:2, advantagePerk:'nasty_bite'  , powerBadge:'🌀 Breaking +2', desc:'[Beat 1: Breaking Synergy] +9 Base. Pairs with Breaking for +2 Synergy. If Advantage won: Pitcher gains +2 Launch Angle control in Beat 2!' },
  'P4' :{ id:'P4' , name:'Nasty Bite'           , type:'pitcher', beat:'beat1', zone:'read'   , value:8 , pitchCall:'breaking'   , synergyPitch:'breaking', synergyBonus:2, advantagePerk:'nasty_bite'  , powerBadge:'🌀 Breaking +2', desc:'[Beat 1: Breaking Synergy] +8 Base. Pairs with Breaking for +2 Synergy. If Advantage won: Pitcher gains +2 Launch Angle control in Beat 2!' },
  'P5' :{ id:'P5' , name:'Arm-Side Run'         , type:'pitcher', beat:'beat1', zone:'read'   , value:5 , pitchCall:'fastball'   , synergyPitch:'fastball', synergyBonus:2, advantagePerk:'high_heat'   , powerBadge:'🔥 Fastball +2', desc:'[Beat 1: Fastball Synergy] +5 Base. Pairs with Fastball (8 + 5 = 13 Bullseye!). If Advantage won: Batter loses -2 Power in Beat 2!' },
  'P6' :{ id:'P6' , name:'Bust In on Hands'     , type:'pitcher', beat:'beat1', zone:'read'   , value:2 , pitchCall:'fastball'   , synergyPitch:'fastball', synergyBonus:2, advantagePerk:'high_heat'   , powerBadge:'🔥 Fastball +2', desc:'[Beat 1: Fastball Synergy] +2 Finesse. Pairs with Fastball (8 + 2 = 10 Zone). If Advantage won: Batter loses -2 Power in Beat 2!' },
  'P7' :{ id:'P7' , name:'Heavy Sinker'         , type:'pitcher', beat:'beat1', zone:'read'   , value:3 , pitchCall:'fastball'   , synergyPitch:'fastball', synergyBonus:2, advantagePerk:'sinker_depth' , powerBadge:'🔥 Fastball +2', desc:'[Beat 1: Fastball Synergy] +3 Base. Pairs with Fastball (8 + 3 = 11 Zone). If Advantage won: Expands Groundout band by +2 in Beat 2!' },
  'P8' :{ id:'P8' , name:'Backdoor Break'       , type:'pitcher', beat:'beat1', zone:'read'   , value:6 , pitchCall:'breaking'   , synergyPitch:'breaking', synergyBonus:2, advantagePerk:'nasty_bite'  , powerBadge:'🌀 Breaking +2', desc:'[Beat 1: Breaking Synergy] +6 Base. Pairs with Breaking (6 + 6 = 12 Bullseye!). If Advantage won: Pitcher gains +2 control in Beat 2!' },
  'P9' :{ id:'P9' , name:'Diving Drop'          , type:'pitcher', beat:'beat1', zone:'read'   , value:2 , pitchCall:'offspeed'   , synergyPitch:'offspeed', synergyBonus:2, advantagePerk:'fooled_timing', powerBadge:'⏱️ Offspeed +2', desc:'[Beat 1: Offspeed Synergy] +2 Finesse. Pairs with Offspeed for low bait. If Advantage won: Batter loses -3 Power in Beat 2!' },
  'P10':{ id:'P10', name:'Dancing Flutter'      , type:'pitcher', beat:'beat1', zone:'read'   , value:3 , pitchCall:'knuckleball', synergyPitch:'offspeed', synergyBonus:2, advantagePerk:'fooled_timing', powerBadge:'⏱️ Offspeed +2', desc:'[Beat 1: Offspeed Synergy] +3 Finesse. Immune to guess counters. If Advantage won: Batter loses -3 Power in Beat 2!' },
  'P11':{ id:'P11', name:'Change of Pace'       , type:'pitcher', beat:'beat1', zone:'read'   , value:3 , pitchCall:'offspeed'   , synergyPitch:'offspeed', synergyBonus:2, advantagePerk:'fooled_timing', powerBadge:'⏱️ Offspeed +2', desc:'[Beat 1: Offspeed Synergy] +3 Base. Pairs with Offspeed (4 + 3 = 7). If Advantage won: Batter loses -3 Power in Beat 2!' },
  'P12':{ id:'P12', name:'High Heat Rise'       , type:'pitcher', beat:'beat1', zone:'read'   , value:10, pitchCall:'fastball'   , synergyPitch:'fastball', synergyBonus:2, advantagePerk:'high_heat'   , powerBadge:'🔥 Fastball +2', desc:'[Beat 1: Fastball Synergy] +10 Max Heat. Pairs with Fastball (8 + 10 = 18). If Advantage won: Batter loses -2 Power in Beat 2!' },

  // ── PITCHER BEAT 2: VELOCITY, WEAK CONTACT & PUT-AWAY [contact] ─────────────
  'P13':{ id:'P13', name:'Extra Heat'           , type:'pitcher', beat:'beat2', zone:'contact', value:7, outcomeEffect:'high_cheese'    , powerBadge:'⚡ High Cheese', desc:'[Beat 2: Launch Angle] High velocity (+7). If combined sum > 16, converts Flyout into a Strikeout!' },
  'P14':{ id:'P14', name:'Corner Paint'         , type:'pitcher', beat:'beat2', zone:'contact', value:6,                                  powerBadge:'🎯 Pinpoint Control', desc:'[Beat 2: Launch Angle] Precision command (+6). Steers the launch angle into pitcher-friendly zones.' },
  'P15':{ id:'P15', name:'High Cheese'          , type:'pitcher', beat:'beat2', zone:'contact', value:9, outcomeEffect:'high_cheese'    , powerBadge:'⚡ High Cheese', desc:'[Beat 2: Launch Angle] High heater (+9). Pushes launch angle high into popout territory (>16).' },
  'P16':{ id:'P16', name:'Backdoor Strike'      , type:'pitcher', beat:'beat2', zone:'contact', value:2,                                  powerBadge:'🛡️ Suppress Exit Velo', desc:'[Beat 2: Launch Angle] Low exit velocity (+2). Suppresses launch angle into groundout territory (<8).' },
  'P17':{ id:'P17', name:'Timing Disruption'    , type:'pitcher', beat:'beat2', zone:'contact', value:2,                                  powerBadge:'🛡️ Weak Contact', desc:'[Beat 2: Launch Angle] Soft touch (+2). Off-balance contact stays under 8 for a groundout.' },
  'P18':{ id:'P18', name:'Wipeout Slider'       , type:'pitcher', beat:'beat2', zone:'contact', value:5, outcomeEffect:'wipeout_slider' , powerBadge:'🔥 Wipeout Slider', desc:'[Beat 2 Highlight] Wipeout Pitch (+5): If pitcher won Beat 1 and contact is a Single, converts it to a Strikeout!' },
  'P19':{ id:'P19', name:'Sequence Pitch'       , type:'pitcher', beat:'beat2', zone:'contact', value:1,                                  powerBadge:'🛡️ Micro-Nudge', desc:'[Beat 2: Launch Angle] Micro-adjustment (+1). Drags the combined launch angle down to force weak grounders.' },
  'P20':{ id:'P20', name:'Bury It'              , type:'pitcher', beat:'beat2', zone:'contact', value:8, outcomeEffect:'high_cheese'    , powerBadge:'⚡ Elevated Heat', desc:'[Beat 2: Launch Angle] High velocity (+8). Pushes launch angle high into flyout territory (>16).' },
  'P21':{ id:'P21', name:'Pitcher Spotting'     , type:'pitcher', beat:'beat2', zone:'contact', value:2,                                  powerBadge:'🛡️ Low Grounder', desc:'[Beat 2: Launch Angle] Edge placement (+2). Keeps total low to induce weak groundball contact.' },
  'P22':{ id:'P22', name:'Deception Delivery'   , type:'pitcher', beat:'beat2', zone:'contact', value:9, outcomeEffect:'high_cheese'    , powerBadge:'⚡ Popout Force', desc:'[Beat 2: Launch Angle] Elevated release (+9). Pushes launch angle high into flyout territory (>16).' },

  // ── PITCHER BEAT 2: DEFENSE & FIELDING GEMS [result] ────────────────────────
  'P23':{ id:'P23', name:'Infield Shift'        , type:'pitcher', beat:'beat2', zone:'result' , value:5, outcomeEffect:'infield_shift'  , powerBadge:'🛡️ The Shift', desc:'[Beat 2 Highlight] The Shift (+5): Swaps Single and Groundout bands on the Launch Angle meter!' },
  'P24':{ id:'P24', name:'No Doubles Depth'     , type:'pitcher', beat:'beat2', zone:'result' , value:3,                                  powerBadge:'🛡️ Guard Fence', desc:'[Beat 2 Defense] Low trajectory defense (+3). Keeps ball on the ground away from the gaps.' },
  'P25':{ id:'P25', name:'Infield In'           , type:'pitcher', beat:'beat2', zone:'result' , value:2,                                  powerBadge:'🛡️ Infield Squeeze', desc:'[Beat 2 Defense] Infield squeezed (+2). Low grounder force to cut down lead runners.' },
  'P26':{ id:'P26', name:'Gold Glove'           , type:'pitcher', beat:'beat2', zone:'result' , value:4, outcomeEffect:'web_gem'        , powerBadge:'🧤 Web Gem', desc:'[Beat 2 Highlight] Web Gem (+4): If the batted ball lands on Home Run, robs it at the wall for an OUT!' },
  'P27':{ id:'P27', name:'Double Play Depth'    , type:'pitcher', beat:'beat2', zone:'result' , value:4, outcomeEffect:'double_play'    , powerBadge:'⚡ Double Play', desc:'[Beat 2 Highlight] Double Play (+4): If ball lands on Groundout with runners on base, turns it into a 2-Out DP!' },
  'P28':{ id:'P28', name:'Deep Outfield'        , type:'pitcher', beat:'beat2', zone:'result' , value:8, outcomeEffect:'high_cheese'    , powerBadge:'⚡ Deep Flyout', desc:'[Beat 2 Defense] Deep fence guard (+8). Pushes launch angle into can-of-corn flyouts.' },
  'P29':{ id:'P29', name:'Vacuum Defense'       , type:'pitcher', beat:'beat2', zone:'result' , value:5, outcomeEffect:'infield_shift'  , powerBadge:'🛡️ Smother Grounder', desc:'[Beat 2 Defense] Smothers hard drives (+5) into routine outs.' },
  'P30':{ id:'P30', name:'Warning Track'        , type:'pitcher', beat:'beat2', zone:'result' , value:1,                                  powerBadge:'🛡️ Soft Touch', desc:'[Beat 2 Defense] Soft touch (+1). Keeps exit velocity low to prevent extra bases.' },

  // ── BATTER BEAT 1: READ & GUESS [read] ─────────────────────────────────────
  'B1' :{ id:'B1' , name:'Guess Fastball'       , type:'batter' , beat:'beat1', zone:'read'   , value:2, counters:['fastball','cutter_fast'], counterMult:2.0, advantagePerk:'sit_fastball'  , powerBadge:'🎯 Guess Fastball', desc:'[Beat 1: Read Fastball] Hunting Fastball (+2). If Fastball, DOUBLES to +4! If Advantage won: Home Run band widens by +2 in Beat 2!' },
  'B2' :{ id:'B2' , name:'Sit on Breaking Ball' , type:'batter' , beat:'beat1', zone:'read'   , value:8, counters:['breaking','curveball','slurve'], counterMult:2.0, advantagePerk:'hang_breaking', powerBadge:'🎯 Sit Breaking', desc:'[Beat 1: Read Breaking] Sitting on hook (+8). If Breaking, DOUBLES to +16! If Advantage won: Batter gains +3 Launch Power in Beat 2!' },
  'B3' :{ id:'B3' , name:'Look Off-Speed'       , type:'batter' , beat:'beat1', zone:'read'   , value:2, counters:['offspeed','changeup','splitter'], counterMult:2.0, advantagePerk:'spit_offspeed' , powerBadge:'🎯 Look Offspeed', desc:'[Beat 1: Read Offspeed] Waiting on changeup (+2). If Offspeed, DOUBLES to +4! If Advantage won: Converts Beat 2 Flyout into a Walk!' },
  'B4' :{ id:'B4' , name:'Patient Eye'          , type:'batter' , beat:'beat1', zone:'read'   , value:3, counters:['offspeed','changeup'], counterMult:1.5, advantagePerk:'spit_offspeed'           , powerBadge:'🎯 Patient Eye', desc:'[Beat 1: Read Offspeed] Disciplined eye (+3). If Offspeed, power is ×1.5 (+4.5). If Advantage won: Converts Beat 2 Flyout into a Walk!' },
  'B5' :{ id:'B5' , name:'Breaking Ball Hunter' , type:'batter' , beat:'beat1', zone:'read'   , value:8, counters:['breaking','slider'], counterMult:2.0, advantagePerk:'hang_breaking'            , powerBadge:'🎯 Hunter Spin', desc:'[Beat 1: Read Breaking] Hunting spin (+8). If Breaking, DOUBLES to +16! If Advantage won: Batter gains +3 Launch Power in Beat 2!' },
  'B6' :{ id:'B6' , name:'Sit Fastball'         , type:'batter' , beat:'beat1', zone:'read'   , value:9, counters:['fastball'], counterMult:2.0, advantagePerk:'sit_fastball'                        , powerBadge:'🎯 Sit Fastball', desc:'[Beat 1: Read Fastball] Ambush velocity (+9). If Fastball, DOUBLES to +18! If Advantage won: Home Run band widens by +2 in Beat 2!' },
  'B7' :{ id:'B7' , name:'Read the Pitch'       , type:'batter' , beat:'beat1', zone:'read'   , value:2, counters:['fastball','breaking'], counterMult:1.5, advantagePerk:'sit_fastball'            , powerBadge:'🎯 Read Stuff', desc:'[Beat 1: Read Pitch] Short read (+2). Counters Fastball or Breaking (×1.5 to +3). If Advantage won: Home Run band widens by +1!' },
  'B8' :{ id:'B8' , name:'First Pitch Aggressor', type:'batter' , beat:'beat1', zone:'read'   , value:5, counters:['fastball'], counterMult:1.5, advantagePerk:'ambush_first'                        , powerBadge:'🎯 Ambush First', desc:'[Beat 1: Read Fastball] Ambush (+5, +3 bonus if 1st PA). If Fastball, power is ×1.5. If Advantage won: +2 Launch Power in Beat 2!' },
  'B9' :{ id:'B9' , name:'Pitch Tracking'       , type:'batter' , beat:'beat1', zone:'read'   , value:7, counters:['breaking','offspeed'], counterMult:1.5, advantagePerk:'hang_breaking'           , powerBadge:'🎯 Track Offspeed', desc:'[Beat 1: Read Offspeed] Trajectory read (+7). Counters Breaking or Offspeed (×1.5 to +10.5). If Advantage won: +3 Launch Power in Beat 2!' },
  'B10':{ id:'B10', name:'Veteran Instinct'      , type:'batter' , beat:'beat1', zone:'read'   , value:4, counters:['fastball','breaking','offspeed'], counterMult:1.3, advantagePerk:'sit_fastball'  , powerBadge:'🎯 Veteran Read', desc:'[Beat 1: Universal Read] Veteran read (+4). Counters any pitch (×1.3 to +5.2). If Advantage won: Home Run band widens by +1!' },

  // ── BATTER BEAT 2: CONTACT & SWING [contact] ───────────────────────────────
  'B11':{ id:'B11', name:'Bat Speed'            , type:'batter' , beat:'beat2', zone:'contact', value:6,                                  powerBadge:'⚡ Bat Speed', desc:'[Beat 2: Launch Angle] Fast bat velocity (+6). Drives launch angle right into the sweet spot corridor.' },
  'B12':{ id:'B12', name:'Contact Swing'        , type:'batter' , beat:'beat2', zone:'contact', value:2,                                  powerBadge:'🏏 Contact Stroke', desc:'[Beat 2: Launch Angle] Controlled stroke (+2). Pairs with high pitch (+8) for an 8–10 Single.' },
  'B13':{ id:'B13', name:'Choke Up'             , type:'batter' , beat:'beat2', zone:'contact', value:1, outcomeEffect:'bunt_shift'     , powerBadge:'⚡ Bunt Hit', desc:'[Beat 2 Highlight] Bunt Hit (+1): If combined sum is under 8, converts Groundout into an Infield Single!' },
  'B14':{ id:'B14', name:'Full Extension'       , type:'batter' , beat:'beat2', zone:'contact', value:2,                                  powerBadge:'🏏 Full Reach', desc:'[Beat 2: Launch Angle] Outside reach (+2). Balances high pitches into clean singles.' },
  'B15':{ id:'B15', name:'Quick Hands'          , type:'batter' , beat:'beat2', zone:'contact', value:8,                                  powerBadge:'⚡ Power Hands', desc:'[Beat 2: Launch Angle] Blazing hand speed (+8). Drives launch angle into extra-base and home run territory.' },
  'B16':{ id:'B16', name:'Two-Strike Approach'  , type:'batter' , beat:'beat2', zone:'contact', value:3, outcomeEffect:'two_strike'     , powerBadge:'🛡️ Avoid K', desc:'[Beat 2 Highlight] Two-Strike Approach (+3): Prevents swinging Strikeouts — turns any K into a Groundout!' },
  'B17':{ id:'B17', name:'Sweet Spot'           , type:'batter' , beat:'beat2', zone:'contact', value:5,                                  powerBadge:'🎯 Sweet Spot', desc:'[Beat 2: Launch Angle] Squared-up contact (+5). Pairs with +8 to reach 13 for a Home Run!' },
  'B18':{ id:'B18', name:'Barrel It'            , type:'batter' , beat:'beat2', zone:'contact', value:9,                                  powerBadge:'💥 Barrel Blast', desc:'[Beat 2: Launch Angle] Crushing exit velocity (+9). Elevates launch angle into Home Run territory.' },
  'B19':{ id:'B19', name:'Inside-Out Swing'     , type:'batter' , beat:'beat2', zone:'contact', value:4, outcomeEffect:'spoil_it'        , powerBadge:'⚾ Spoil It', desc:'[Beat 2 Highlight] Spoil It (+4): If outcome would be an Out or Strikeout, fouls it off (resets Beat 2)!' },
  'B20':{ id:'B20', name:'Level Swing'          , type:'batter' , beat:'beat2', zone:'contact', value:2,                                  powerBadge:'🏏 Line Path', desc:'[Beat 2: Launch Angle] Flat line-drive path (+2). Balances high power into an 8–11 single.' },

  // ── BATTER BEAT 2: POWER & BALL FLIGHT [result] ────────────────────────────
  'B21':{ id:'B21', name:'Power Surge'          , type:'batter' , beat:'beat2', zone:'result' , value:7, outcomeEffect:'power_surge'     , powerBadge:'💥 Power Surge', desc:'[Beat 2 Highlight] Power Surge (+7). If Batter won Beat 1 Reaction Advantage, adds +3 bonus power!' },
  'B22':{ id:'B22', name:'Launch Angle'         , type:'batter' , beat:'beat2', zone:'result' , value:8,                                  powerBadge:'🚀 Launch Lift', desc:'[Beat 2: Launch Angle] Optimal lift (+8). Built for home runs and gap doubles.' },
  'B23':{ id:'B23', name:'Pull Heavy'           , type:'batter' , beat:'beat2', zone:'result' , value:9,                                  powerBadge:'💥 Pull Power', desc:'[Beat 2: Launch Angle] Pull-side power (+9). High exit velocity drive into the seats.' },
  'B24':{ id:'B24', name:'Opposite Field'       , type:'batter' , beat:'beat2', zone:'result' , value:2,                                  powerBadge:'🏏 Oppo Poke', desc:'[Beat 2: Launch Angle] Soft opposite-field poke (+2). Balances high pitch velocity into a single.' },
  'B25':{ id:'B25', name:'Extra Bases'          , type:'batter' , beat:'beat2', zone:'result' , value:1,                                  powerBadge:'🏏 Finesse Poke', desc:'[Beat 2: Launch Angle] Finesse poke (+1). Drags total down to counter high flyout attempts.' },
  'B26':{ id:'B26', name:'Gap Power'            , type:'batter' , beat:'beat2', zone:'result' , value:6, outcomeEffect:'gap_power'       , powerBadge:'🚀 Gap Power', desc:'[Beat 2 Highlight] Gap Power (+6): Upgrades Single into a Double, or Double into a Triple!' },
  'B27':{ id:'B27', name:'Upper Deck'           , type:'batter' , beat:'beat2', zone:'result' , value:8, outcomeEffect:'moonshot'        , powerBadge:'💥 Moonshot', desc:'[Beat 2 Highlight] Moonshot (+8): Massive power. If Home Run hits, scores +1 bonus run!' },
  'B28':{ id:'B28', name:'Line Drive'           , type:'batter' , beat:'beat2', zone:'result' , value:3,                                  powerBadge:'🏏 Line Missile', desc:'[Beat 2: Launch Angle] Stinging line drive (+3). Pairs with 8 for an 11 Single.' },
  'B29':{ id:'B29', name:'Hard Contact'         , type:'batter' , beat:'beat2', zone:'result' , value:10,                                 powerBadge:'💥 Max Exit Velo', desc:'[Beat 2: Launch Angle] Maximum exit velocity (+10). Rockets the launch angle deep into the outfield.' },
  'B30':{ id:'B30', name:'Clutch Blast'         , type:'batter' , beat:'beat2', zone:'result' , value:5,                                  powerBadge:'🎯 Sweet Spot Stabilizer', desc:'[Beat 2: Launch Angle] High-leverage stroke (+5). Perfect stabilizer for the sweet spot.' },

  // ── UNIVERSAL [any beat] ───────────────────────────────────────────────────
  'U1' :{ id:'U1' , name:'Momentum'             , type:'universal', beat:'any'  , zone:'any'  , value:5, powerBadge:'🌟 Universal +5', desc:'[Universal: Either Beat] Flexible +5 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U2' :{ id:'U2' , name:'Intensity'            , type:'universal', beat:'any'  , zone:'any'  , value:3, powerBadge:'🌟 Universal +3', desc:'[Universal: Either Beat] Flexible +3 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U3' :{ id:'U3' , name:'Pressure'             , type:'universal', beat:'any'  , zone:'any'  , value:8, powerBadge:'🌟 Universal +8', desc:'[Universal: Either Beat] Flexible +8 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U4' :{ id:'U4' , name:'Discipline'           , type:'universal', beat:'any'  , zone:'any'  , value:4, powerBadge:'🌟 Universal +4', desc:'[Universal: Either Beat] Flexible +4 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U5' :{ id:'U5' , name:'Strategy'             , type:'universal', beat:'any'  , zone:'any'  , value:2, powerBadge:'🌟 Universal +2', desc:'[Universal: Either Beat] Flexible +2 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U6' :{ id:'U6' , name:'Tactics'              , type:'universal', beat:'any'  , zone:'any'  , value:2, powerBadge:'🌟 Universal +2', desc:'[Universal: Either Beat] Flexible +2 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U7' :{ id:'U7' , name:'Rally Spark'          , type:'universal', beat:'any'  , zone:'any'  , value:8, powerBadge:'🌟 Universal +8', desc:'[Universal: Either Beat] Flexible +8 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U8' :{ id:'U8' , name:'Reset'                , type:'universal', beat:'any'  , zone:'any'  , value:1, powerBadge:'🌟 Universal +1', desc:'[Universal: Either Beat] Flexible +1 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U9' :{ id:'U9' , name:'Clutch Spark'         , type:'universal', beat:'any'  , zone:'any'  , value:9, powerBadge:'🌟 Universal +9', desc:'[Universal: Either Beat] Flexible +9 Power. Full power in Beat 1 or Beat 2 without penalty.' },
  'U10':{ id:'U10', name:'Big Play'             , type:'universal', beat:'any'  , zone:'any'  , value:10, powerBadge:'🌟 Universal +10', desc:'[Universal: Either Beat] Flexible +10 Power. Full power in Beat 1 or Beat 2 without penalty.' },
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
