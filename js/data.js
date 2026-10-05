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
  'P1' :{ id:'P1' , name:'Corner Paint'         , type:'pitcher', zone:'read'   , value:10, pitchCall:'fastball'   , desc:'[Beat 1: Pitch Control] Pinpoint command on the black. Adds +10 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P2' :{ id:'P2' , name:'Offspeed Touch'       , type:'pitcher', zone:'read'   , value:9 , pitchCall:'offspeed'   , desc:'[Beat 1: Pitch Control] Baffling speed differential. Adds +9 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P3' :{ id:'P3' , name:'Sharp Movement'       , type:'pitcher', zone:'read'   , value:10, pitchCall:'breaking'   , desc:'[Beat 1: Pitch Control] Late sharp break on the plate. Adds +10 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P4' :{ id:'P4' , name:'Nasty Bite'           , type:'pitcher', zone:'read'   , value:11, pitchCall:'breaking'   , desc:'[Beat 1: Pitch Control] Vicious bite that freezes hitters. Adds +11 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P5' :{ id:'P5' , name:'Arm-Side Run'         , type:'pitcher', zone:'read'   , value:8 , pitchCall:'fastball'   , desc:'[Beat 1: Pitch Control] Tailing action off the barrel. Adds +8 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P6' :{ id:'P6' , name:'Bust In on Hands'     , type:'pitcher', zone:'read'   , value:9 , pitchCall:'fastball'   , desc:'[Beat 1: Pitch Control] Jams the hitter on the handle. Adds +9 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P7' :{ id:'P7' , name:'Heavy Sinker'         , type:'pitcher', zone:'read'   , value:9 , pitchCall:'fastball'   , desc:'[Beat 1: Pitch Control] Heavy downward sink at the knees. Adds +9 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P8' :{ id:'P8' , name:'Backdoor Break'       , type:'pitcher', zone:'read'   , value:9 , pitchCall:'breaking'   , desc:'[Beat 1: Pitch Control] Sweeps onto the corner for a strike. Adds +9 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P9' :{ id:'P9' , name:'Diving Drop'          , type:'pitcher', zone:'read'   , value:9 , pitchCall:'offspeed'   , desc:'[Beat 1: Pitch Control] Dives sharply below the zone. Adds +9 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P10':{ id:'P10', name:'Dancing Flutter'      , type:'pitcher', zone:'read'   , value:8 , pitchCall:'knuckleball', desc:'[Beat 1: Pitch Control] Fluttering movement immune to guess counters. Adds +8 Power toward Strike Zone.' },
  'P11':{ id:'P11', name:'Change of Pace'       , type:'pitcher', zone:'read'   , value:8 , pitchCall:'offspeed'   , desc:'[Beat 1: Pitch Control] Pulls the string on the swing. Adds +8 Power to hit your Strike Zone (aim for Bullseye!).' },
  'P12':{ id:'P12', name:'High Heat Rise'       , type:'pitcher', zone:'read'   , value:10, pitchCall:'fastball'   , desc:'[Beat 1: Pitch Control] Rising velocity at the letters. Adds +10 Power to hit your Strike Zone (aim for Bullseye!).' },

  // ── PITCHER BEAT 2: VELOCITY, WEAK CONTACT & PUT-AWAY [contact] ─────────────
  'P13':{ id:'P13', name:'Extra Heat'           , type:'pitcher', zone:'contact', value:7, desc:'[Beat 2: Launch Angle] Maximum velocity (+7). Pushes the launch angle meter toward popups/flyouts (>16).' },
  'P14':{ id:'P14', name:'Corner Paint'         , type:'pitcher', zone:'contact', value:6, desc:'[Beat 2: Launch Angle] Pinpoint command (+6). Steers the launch angle meter away from the home run sweet spot.' },
  'P15':{ id:'P15', name:'High Cheese'          , type:'pitcher', zone:'contact', value:6, desc:'[Beat 2: Launch Angle] High pitch (+6). Designed to elevate the ball toward flyout territory (>16).' },
  'P16':{ id:'P16', name:'Backdoor Strike'      , type:'pitcher', zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Deceptive outer edge placement (+5). Suppresses exit velocity.' },
  'P17':{ id:'P17', name:'Timing Disruption'    , type:'pitcher', zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Disrupts swing timing (+5). Induces weak contact.' },
  'P18':{ id:'P18', name:'Wipeout Slider'       , type:'pitcher', zone:'contact', value:6, outcomeEffect:'wipeout_slider', desc:'[Beat 2 Highlight] Wipeout Pitch (+6): If pitcher won Beat 1 and contact is a Single, converts it to a Strikeout!' },
  'P19':{ id:'P19', name:'Sequence Pitch'       , type:'pitcher', zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Unpredictable location (+5). Induces weak contact away from sweet spot.' },
  'P20':{ id:'P20', name:'Bury It'              , type:'pitcher', zone:'contact', value:7, desc:'[Beat 2: Launch Angle] Low dirt pitch (+7). Forces swing-and-miss or weak contact.' },
  'P21':{ id:'P21', name:'Pitcher Spotting'     , type:'pitcher', zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Careful location on the edge (+5). Keeps ball out of the sweet spot.' },
  'P22':{ id:'P22', name:'Deception Delivery'   , type:'pitcher', zone:'contact', value:6, desc:'[Beat 2: Launch Angle] Masks release point (+6). Suppresses exit velocity.' },

  // ── PITCHER BEAT 2: DEFENSE & FIELDING GEMS [result] ────────────────────────
  'P23':{ id:'P23', name:'Infield Shift'        , type:'pitcher', zone:'result' , value:3, outcomeEffect:'infield_shift', desc:'[Beat 2 Highlight] The Shift (+3): Swaps Single and Groundout bands on the Launch Angle meter!' },
  'P24':{ id:'P24', name:'No Doubles Depth'     , type:'pitcher', zone:'result' , value:5, desc:'[Beat 2 Defense] Outfielders guard the fences (+5). Prevents extra-base hits.' },
  'P25':{ id:'P25', name:'Infield In'           , type:'pitcher', zone:'result' , value:4, desc:'[Beat 2 Defense] Infield drawn in (+4). Cuts down runners attempting to score at home.' },
  'P26':{ id:'P26', name:'Gold Glove'           , type:'pitcher', zone:'result' , value:4, outcomeEffect:'web_gem', desc:'[Beat 2 Highlight] Web Gem (+4): If the batted ball lands on Home Run, robs it at the wall for an OUT!' },
  'P27':{ id:'P27', name:'Double Play Depth'    , type:'pitcher', zone:'result' , value:2, outcomeEffect:'double_play', desc:'[Beat 2 Highlight] Double Play (+2): If ball lands on Groundout with runners on base, turns it into a 2-Out DP!' },
  'P28':{ id:'P28', name:'Deep Outfield'        , type:'pitcher', zone:'result' , value:5, desc:'[Beat 2 Defense] Deep outfield positioning (+5). Shields against power hitters.' },
  'P29':{ id:'P29', name:'Vacuum Defense'       , type:'pitcher', zone:'result' , value:5, desc:'[Beat 2 Defense] Smothers hard grounders (+5) into routine outs.' },
  'P30':{ id:'P30', name:'Warning Track'        , type:'pitcher', zone:'result' , value:4, desc:'[Beat 2 Defense] Track catches (+4). Catches deep drives at the wall.' },

  // ── BATTER BEAT 1: READ & GUESS [read] ─────────────────────────────────────
  'B1' :{ id:'B1' , name:'Guess Fastball'       , type:'batter' , zone:'read'   , value:4, counters:['fastball','cutter_fast'], counterMult:2.0, desc:'[Beat 1 Read] Hunting Fastball. If pitcher throws Fastball, card power DOUBLES to +8 to seize Reaction Advantage!' },
  'B2' :{ id:'B2' , name:'Sit on Breaking Ball' , type:'batter' , zone:'read'   , value:5, counters:['breaking','curveball','slurve'], counterMult:2.0, desc:'[Beat 1 Read] Sitting on the hook. If pitcher throws Breaking, card power DOUBLES to +10 to seize Reaction Advantage!' },
  'B3' :{ id:'B3' , name:'Look Off-Speed'       , type:'batter' , zone:'read'   , value:4, counters:['offspeed','changeup','splitter'], counterMult:2.0, desc:'[Beat 1 Read] Waiting on changeup. If pitcher throws Off-Speed, card power DOUBLES to +8 to seize Reaction Advantage!' },
  'B4' :{ id:'B4' , name:'Patient Eye'          , type:'batter' , zone:'read'   , value:4, counters:['offspeed','changeup'], counterMult:1.5, desc:'[Beat 1 Read] Disciplined eye (+4). If pitcher throws Off-Speed, power increases ×1.5 to +6 to challenge the zone.' },
  'B5' :{ id:'B5' , name:'Breaking Ball Hunter' , type:'batter' , zone:'read'   , value:5, counters:['breaking','slider'], counterMult:2.0, desc:'[Beat 1 Read] Hunting spin. If pitcher throws Breaking, card power DOUBLES to +10 to seize Reaction Advantage!' },
  'B6' :{ id:'B6' , name:'Sit Fastball'         , type:'batter' , zone:'read'   , value:6, counters:['fastball'], counterMult:2.0, desc:'[Beat 1 Read] Aggressive on velocity. If pitcher throws Fastball, card power DOUBLES to +12 to seize Reaction Advantage!' },
  'B7' :{ id:'B7' , name:'Read the Pitch'       , type:'batter' , zone:'read'   , value:4, counters:['fastball','breaking'], counterMult:1.5, desc:'[Beat 1 Read] Anticipating hard stuff (+4). Counters Fastball or Breaking (×1.5 to +6).' },
  'B8' :{ id:'B8' , name:'First Pitch Aggressor', type:'batter' , zone:'read'   , value:5, counters:['fastball'], counterMult:1.5, desc:'[Beat 1 Read] First-pitch ambush (+5). +3 bonus if 1st PA of inning; ×1.5 if Fastball to seize Reaction Advantage!' },
  'B9' :{ id:'B9' , name:'Pitch Tracking'       , type:'batter' , zone:'read'   , value:5, counters:['breaking','offspeed'], counterMult:1.5, desc:'[Beat 1 Read] Tracking trajectory (+5). Counters Breaking or Off-Speed (×1.5 to +8).' },
  'B10':{ id:'B10', name:'Veteran Instinct'      , type:'batter' , zone:'read'   , value:4, counters:['fastball','breaking','offspeed'], counterMult:1.3, desc:'[Beat 1 Read] Veteran read (+4). Counters any standard pitch (×1.3 on correct guess).' },

  // ── BATTER BEAT 2: CONTACT & SWING [contact] ───────────────────────────────
  'B11':{ id:'B11', name:'Bat Speed'            , type:'batter' , zone:'contact', value:6, desc:'[Beat 2: Launch Angle] Fast bat velocity (+6). Drives the launch angle meter toward extra-base hits.' },
  'B12':{ id:'B12', name:'Contact Swing'        , type:'batter' , zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Controlled stroke (+5). Puts the ball in play reliably.' },
  'B13':{ id:'B13', name:'Choke Up'             , type:'batter' , zone:'contact', value:1, outcomeEffect:'bunt_shift', desc:'[Beat 2 Highlight] Bunt Hit (+1): If combined sum is under 8, converts Groundout into an Infield Single!' },
  'B14':{ id:'B14', name:'Full Extension'       , type:'batter' , zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Reaching across the plate (+5) for solid contact.' },
  'B15':{ id:'B15', name:'Quick Hands'          , type:'batter' , zone:'contact', value:6, desc:'[Beat 2: Launch Angle] Blazing hand speed (+6) through the hitting zone.' },
  'B16':{ id:'B16', name:'Two-Strike Approach'  , type:'batter' , zone:'contact', value:4, desc:'[Beat 2: Launch Angle] Shortened defensive swing (+4) to put the ball in play and avoid strikeouts.' },
  'B17':{ id:'B17', name:'Sweet Spot'           , type:'batter' , zone:'contact', value:6, desc:'[Beat 2: Launch Angle] Squared-up sweet spot contact (+6) pushing toward the Home Run band.' },
  'B18':{ id:'B18', name:'Barrel It'            , type:'batter' , zone:'contact', value:6, desc:'[Beat 2: Launch Angle] Crushing the ball on the barrel (+6) for maximum exit velocity.' },
  'B19':{ id:'B19', name:'Inside-Out Swing'     , type:'batter' , zone:'contact', value:3, outcomeEffect:'spoil_it', desc:'[Beat 2 Highlight] Spoil It (+3): If the outcome would be an Out or Strikeout, fouls it off (resets Beat 2)!' },
  'B20':{ id:'B20', name:'Level Swing'          , type:'batter' , zone:'contact', value:5, desc:'[Beat 2: Launch Angle] Flat bat path (+5) built for stinging line drives.' },

  // ── BATTER BEAT 2: POWER & BALL FLIGHT [result] ────────────────────────────
  'B21':{ id:'B21', name:'Power Surge'          , type:'batter' , zone:'result' , value:7, desc:'[Beat 2: Launch Angle] Heavy power surge (+7). Launches the needle into Home Run territory (11–15).' },
  'B22':{ id:'B22', name:'Launch Angle'         , type:'batter' , zone:'result' , value:6, desc:'[Beat 2: Launch Angle] Optimal elevation (+6). Built for home runs and extra bases.' },
  'B23':{ id:'B23', name:'Pull Heavy'           , type:'batter' , zone:'result' , value:6, desc:'[Beat 2: Launch Angle] Pull-side power (+6). Crushed into the pull-side seats.' },
  'B24':{ id:'B24', name:'Opposite Field'       , type:'batter' , zone:'result' , value:5, desc:'[Beat 2: Launch Angle] Power to opposite field (+5). Drives outside pitches into the gap.' },
  'B25':{ id:'B25', name:'Extra Bases'          , type:'batter' , zone:'result' , value:5, desc:'[Beat 2: Launch Angle] Aggressive drive into the alley (+5) for extra bases.' },
  'B26':{ id:'B26', name:'Gap Power'            , type:'batter' , zone:'result' , value:6, outcomeEffect:'gap_power', desc:'[Beat 2 Highlight] Gap Power (+6): Upgrades Single into a Double, or Double into a Triple!' },
  'B27':{ id:'B27', name:'Upper Deck'           , type:'batter' , zone:'result' , value:8, outcomeEffect:'moonshot', desc:'[Beat 2 Highlight] Moonshot (+8): Massive power. If Home Run hits, scores +1 bonus run!' },
  'B28':{ id:'B28', name:'Line Drive'           , type:'batter' , zone:'result' , value:5, desc:'[Beat 2: Launch Angle] Stinging line drive missile (+5) through the infield.' },
  'B29':{ id:'B29', name:'Hard Contact'         , type:'batter' , zone:'result' , value:5, desc:'[Beat 2: Launch Angle] Hard exit velocity (+5) into the outfield.' },
  'B30':{ id:'B30', name:'Clutch Blast'         , type:'batter' , zone:'result' , value:6, desc:'[Beat 2: Launch Angle] High-leverage power swing (+6) in big moments.' },

  // ── UNIVERSAL [any beat] ───────────────────────────────────────────────────
  'U1' :{ id:'U1' , name:'Momentum'             , type:'universal', zone:'any'  , value:4, desc:'[Universal: Either Beat] Flexible +4 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U2' :{ id:'U2' , name:'Intensity'            , type:'universal', zone:'any'  , value:3, desc:'[Universal: Either Beat] Flexible +3 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U3' :{ id:'U3' , name:'Pressure'             , type:'universal', zone:'any'  , value:4, desc:'[Universal: Either Beat] Flexible +4 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U4' :{ id:'U4' , name:'Discipline'           , type:'universal', zone:'any'  , value:4, desc:'[Universal: Either Beat] Flexible +4 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U5' :{ id:'U5' , name:'Strategy'             , type:'universal', zone:'any'  , value:3, desc:'[Universal: Either Beat] Flexible +3 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U6' :{ id:'U6' , name:'Tactics'              , type:'universal', zone:'any'  , value:3, desc:'[Universal: Either Beat] Flexible +3 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U7' :{ id:'U7' , name:'Rally Spark'          , type:'universal', zone:'any'  , value:4, desc:'[Universal: Either Beat] Flexible +4 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U8' :{ id:'U8' , name:'Reset'                , type:'universal', zone:'any'  , value:4, desc:'[Universal: Either Beat] Flexible +4 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U9' :{ id:'U9' , name:'Clutch Spark'         , type:'universal', zone:'any'  , value:5, desc:'[Universal: Either Beat] Flexible +5 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
  'U10':{ id:'U10', name:'Big Play'             , type:'universal', zone:'any'  , value:7, desc:'[Universal: Either Beat] Flexible +7 Power. Play in Beat 1 for pitch control OR in Beat 2 for launch angle.' },
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

const PITCHER_CHARACTERS = {
  'PC01':{ id:'PC01', name:'"Big Jake" Harmon'        , archetype:'Power Pitcher'      , color:'#c44b4b',
    zoneBonuses:{ z1:-1, z2:5, z3:-2 },
    repertoire:{ fastball:5, breaking:3, offspeed:1 },
    strikeZone:{ low:10, high:16, bullseye:13, wildBust:20 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z2', bonus:3}, {pitchCall:'slider', zone:'z2', bonus:2} ],
    stamina:{ freshMax:5, tiringMax:8, tiringMod:{z1:0,z2:-3,z3:0}, gassedMod:{z1:-2,z2:-5,z3:0} },
    specialText:'Strike Zone: 10–16 (Bullseye: 13). Strikeout Swinging → opponent discards 1 card.' },
  'PC02':{ id:'PC02', name:'"El Arte" Medina'          , archetype:'Control Artist'     , color:'#4b8bc4',
    zoneBonuses:{ z1:4, z2:2, z3:2 },
    repertoire:{ fastball:3, breaking:4, offspeed:2 },
    strikeZone:{ low:9, high:15, bullseye:12, wildBust:19 },
    pitchAffinity:[ {pitchCall:'changeup', zone:'z1', bonus:4}, {pitchCall:'changeup_slow', zone:'z1', bonus:4}, {pitchCall:'curveball', zone:'z1', bonus:2} ],
    stamina:{ freshMax:7, tiringMax:10, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Strike Zone: 9–15 (Bullseye: 12). Pinpoint command.' },
  'PC03':{ id:'PC03', name:'"The Groundskeeper" Pérez', archetype:'Ground Ball Machine', color:'#4baa5a',
    zoneBonuses:{ z1:2, z2:0, z3:6 },
    repertoire:{ fastball:4, breaking:3, offspeed:2 },
    strikeZone:{ low:8, high:14, bullseye:11, wildBust:18 },
    pitchAffinity:[ {pitchCall:'twoseamer', zone:'z3', bonus:5}, {pitchCall:'splitter', zone:'z3', bonus:3} ],
    stamina:{ freshMax:7, tiringMax:11, tiringMod:{z1:0,z2:0,z3:-3}, gassedMod:{z1:0,z2:-2,z3:-5} },
    specialText:'Strike Zone: 8–14 (Bullseye: 11). Heavy sinking action.' },
  'PC04':{ id:'PC04', name:'"Smoke" Williams'          , archetype:'Closer'             , color:'#e0a020',
    zoneBonuses:{ z1:0, z2:7, z3:2 },
    repertoire:{ fastball:5, breaking:4, offspeed:0 },
    strikeZone:{ low:11, high:17, bullseye:14, wildBust:21 },
    pitchAffinity:[ {pitchCall:'slider', zone:'z2', bonus:5}, {pitchCall:'fastball', zone:'z2', bonus:3} ],
    stamina:{ freshMax:3, tiringMax:5, tiringMod:{z1:0,z2:-4,z3:0}, gassedMod:{z1:0,z2:-8,z3:0} },
    specialText:'Strike Zone: 11–17 (Bullseye: 14). High velocity heat.' },
  'PC05':{ id:'PC05', name:'"The Professor" Volkov'    , archetype:'Junkballer'         , color:'#8855cc',
    zoneBonuses:{ z1:6, z2:-2, z3:3 },
    repertoire:{ fastball:2, breaking:4, offspeed:3 },
    strikeZone:{ low:7, high:13, bullseye:10, wildBust:17 },
    pitchAffinity:[ {pitchCall:'knuckleball', zone:'z1', bonus:3}, {pitchCall:'eephus', zone:'z1', bonus:5} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:0,z3:-2} },
    specialText:'Strike Zone: 7–13 (Bullseye: 10). Soft, baffling movement.' },
  'PC06':{ id:'PC06', name:'"The Machine" Castillo'    , archetype:'Ace'                , color:'#e8b84b',
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    repertoire:{ fastball:4, breaking:3, offspeed:2 },
    strikeZone:{ low:9, high:16, bullseye:12, wildBust:20 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z1', bonus:1}, {pitchCall:'slider', zone:'z1', bonus:1}, {pitchCall:'curveball', zone:'z1', bonus:1}, {pitchCall:'changeup', zone:'z1', bonus:1} ],
    stamina:{ freshMax:8, tiringMax:11, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Strike Zone: 9–16 (Bullseye: 12). Elite four-pitch mix.' },
  'PC07':{ id:'PC07', name:'"Setup Man" Kowalski'      , archetype:'Reliever'           , color:'#4b99aa',
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    repertoire:{ fastball:4, breaking:4, offspeed:1 },
    strikeZone:{ low:10, high:15, bullseye:13, wildBust:19 },
    pitchAffinity:[ {pitchCall:'cutter', zone:'z2', bonus:3}, {pitchCall:'twoseamer', zone:'z3', bonus:2} ],
    stamina:{ freshMax:4, tiringMax:6, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:0,z2:-4,z3:-2} },
    specialText:'Strike Zone: 10–15 (Bullseye: 13). Setup specialist.' },
  'PC08':{ id:'PC08', name:'"The Wizard" Chen'         , archetype:'Deceptive Starter'  , color:'#cc5599',
    zoneBonuses:{ z1:3, z2:2, z3:1 },
    repertoire:{ fastball:3, breaking:5, offspeed:1 },
    strikeZone:{ low:8, high:15, bullseye:11, wildBust:19 },
    pitchAffinity:[ {pitchCall:'slurve', zone:'z1', bonus:5}, {pitchCall:'splitter', zone:'z1', bonus:3} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:-2,z3:0} },
    specialText:'Strike Zone: 8–15 (Bullseye: 11). Deceptive release angles.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// BATTER CHARACTERS (12)
// battedBallSpectrum: [{ min, max, outcome, label, color }]
// ─────────────────────────────────────────────────────────────────────────────
const BATTER_CHARACTERS = {
  'BC01':{ id:'BC01', name:'"The Bear" Mackintosh'      , archetype:'Slugger'            , color:'#c44b4b',
    battedBallSpectrum: [
      { min:0, max:7, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:8, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:15, outcome:'homerun', label:'HOME RUN 🔥', color:'#ecc94b' },
      { min:16, max:17, outcome:'double', label:'Double ⚡', color:'#38b2ac' },
      { min:18, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-2, z2:2, z3:6 },
    readAffinity:{ trigger:'any_counter', effect:'z3_bonus:3' },
    clutch:{ condition:'risp', bonuses:{z3:5} },
    specialText:'Monster Sweet Spot (11–15 Home Run). Upper Deck & Power Surge +5.' },
  'BC02':{ id:'BC02', name:'"Slick" Torres'             , archetype:'Contact Hitter'     , color:'#4b8bc4',
    battedBallSpectrum: [
      { min:0, max:6, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:7, max:9, outcome:'single', label:'Single', color:'#3182ce' },
      { min:10, max:14, outcome:'double', label:'Line Drive ⚡', color:'#38b2ac' },
      { min:15, max:15, outcome:'homerun', label:'Home Run 🔥', color:'#ecc94b' },
      { min:16, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:5, z3:-1 },
    readAffinity:{ trigger:'B1', effect:'z2_bonus:5' },
    clutch:{ condition:'two_strikes', bonuses:{z2:3} },
    specialText:'Huge Base Hit Window (7–14). Cannot receive Strikeout Swinging trigger.' },
  'BC03':{ id:'BC03', name:'"The Professor" Nakamura'   , archetype:'Disciplined Hitter' , color:'#8855cc',
    battedBallSpectrum: [
      { min:0, max:7, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:8, max:11, outcome:'single', label:'Single', color:'#3182ce' },
      { min:12, max:14, outcome:'double', label:'Gap Double ⚡', color:'#38b2ac' },
      { min:15, max:15, outcome:'homerun', label:'Home Run 🔥', color:'#ecc94b' },
      { min:16, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:6, z2:1, z3:-2 },
    readAffinity:{ trigger:'B4', effect:'walk_at_7' },
    clutch:{ condition:'full_count', bonuses:{z1:4} },
    specialText:'Balanced Spray Spectrum. Patient Eye walk trigger fires at margin +7.' },
  'BC04':{ id:'BC04', name:'"Boom Boom" Barrett'        , archetype:'Free Swinger'       , color:'#e0a020',
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:16, outcome:'homerun', label:'MONSTER BOMB 🔥', color:'#ecc94b' },
      { min:17, max:17, outcome:'double', label:'Double', color:'#38b2ac' },
      { min:18, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-4, z2:4, z3:5 },
    readAffinity:{ trigger:'B6', effect:'z3_bonus:8' },
    clutch:{ condition:'pitcher_won_z1_last_pa', bonuses:{z1:-2} },
    specialText:'Giant Home Run Band (11–16). Sit Fastball counter: Beat 2 Power +8.' },
  'BC05':{ id:'BC05', name:'"El Rayo" Fuentes'          , archetype:'Speed Specialist'   , color:'#4baa5a',
    battedBallSpectrum: [
      { min:0, max:4, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:5, max:8, outcome:'single', label:'Infield Single ⚡', color:'#48bb78' },
      { min:9, max:13, outcome:'single', label:'Single', color:'#3182ce' },
      { min:14, max:15, outcome:'double', label:'Speed Double', color:'#38b2ac' },
      { min:16, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:2, z3:4 },
    readAffinity:{ trigger:'any_counter', effect:'auto_steal' },
    clutch:{ condition:'runner_on_second', bonuses:{z3:5} },
    specialText:'Speed Window (5–8 Infield Single). Any counter fires → Green Light steal auto-succeeds.' },
  'BC06':{ id:'BC06', name:'"Ice" Peterson'             , archetype:'Clutch Hitter'      , color:'#4b99aa',
    battedBallSpectrum: [
      { min:0, max:7, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:8, max:11, outcome:'single', label:'Clutch Single', color:'#3182ce' },
      { min:12, max:14, outcome:'homerun', label:'HOME RUN 🔥', color:'#ecc94b' },
      { min:15, max:16, outcome:'double', label:'Double ⚡', color:'#38b2ac' },
      { min:17, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:1, z2:2, z3:3 },
    readAffinity:{ trigger:'any_counter', effect:'all_zones_bonus:2' },
    clutch:{ condition:'final_inning_close', effect:'double_bonuses' },
    specialText:'Final inning within 1 run: all beat bonuses doubled. Clutch card costs 0 slots.' },
  'BC07':{ id:'BC07', name:'"Scrappy" Olsen'            , archetype:'Utility Hitter'     , color:'#888888',
    battedBallSpectrum: [
      { min:0, max:6, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:7, max:9, outcome:'single', label:'Single', color:'#3182ce' },
      { min:10, max:13, outcome:'double', label:'Hustle Double', color:'#38b2ac' },
      { min:14, max:14, outcome:'homerun', label:'Home Run 🔥', color:'#ecc94b' },
      { min:15, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    readAffinity:null,
    clutch:{ condition:'two_outs', bonuses:{chosen:3} },
    specialText:'2 outs: +3 to either beat of choice. Reliable line drive gap hitter.' },
  'BC08':{ id:'BC08', name:'"Lightning" Jackson'        , archetype:'Power Hitter'       , color:'#e8b84b',
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:15, outcome:'homerun', label:'LIGHTNING BLAST 🔥', color:'#ecc94b' },
      { min:16, max:17, outcome:'double', label:'Double', color:'#38b2ac' },
      { min:18, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-1, z2:2, z3:7 },
    readAffinity:{ trigger:'B2', effect:'z3_bonus:9' },
    clutch:{ condition:'runner_on_base', bonuses:{z3:5} },
    specialText:'Power Sweet Spot (11–15). Home run counts as 2 runs.' },
  'BC09':{ id:'BC09', name:'"The Captain" Reyes'        , archetype:'Complete Hitter'    , color:'#cc5599',
    battedBallSpectrum: [
      { min:0, max:6, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:7, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:14, outcome:'double', label:'Gap Double ⚡', color:'#38b2ac' },
      { min:15, max:16, outcome:'homerun', label:'Home Run 🔥', color:'#ecc94b' },
      { min:17, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    readAffinity:null,
    clutch:{ condition:'trailing', bonuses:{z1:3,z2:3,z3:3} },
    specialText:'All-Fields Hitter (7–16 Hit & Power Range). Trailing: +3 all beats.' },
  'BC10':{ id:'BC10', name:'"Ghost" Yamamoto'           , archetype:'Switch Hitter'      , color:'#5599dd',
    battedBallSpectrum: [
      { min:0, max:5, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:6, max:9, outcome:'single', label:'Bunt / Single ⚡', color:'#48bb78' },
      { min:10, max:13, outcome:'single', label:'Clean Single', color:'#3182ce' },
      { min:14, max:15, outcome:'double', label:'Double', color:'#38b2ac' },
      { min:16, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:3, z2:2, z3:2 },
    readAffinity:null,
    clutch:null,
    specialText:'Switch Hitter: adapts to any pitcher hand. Solid 6–13 single range.' },
  'BC11':{ id:'BC11', name:'"The Wall" Dubois'          , archetype:'Defensive Specialist', color:'#44aa88',
    battedBallSpectrum: [
      { min:0, max:6, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:7, max:11, outcome:'single', label:'Pure Single', color:'#3182ce' },
      { min:12, max:14, outcome:'double', label:'Line Drive ⚡', color:'#38b2ac' },
      { min:15, max:15, outcome:'homerun', label:'Home Run 🔥', color:'#ecc94b' },
      { min:16, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:5, z2:0, z3:-3 },
    readAffinity:{ trigger:'B5', effect:'walk_bonus_pct:25' },
    clutch:{ condition:'ahead_in_count', bonuses:{z1:5} },
    specialText:'Disciplined Table Setter. Walk drawn → draw 1 extra card before next PA.' },
  'BC12':{ id:'BC12', name:'"The Bricks" Murphy'        , archetype:'Designated Hitter'  , color:'#aa4444',
    battedBallSpectrum: [
      { min:0, max:8, outcome:'groundout', label:'Groundout', color:'#718096' },
      { min:9, max:10, outcome:'single', label:'Single', color:'#3182ce' },
      { min:11, max:16, outcome:'homerun', label:'UPPER DECK HR 🔥', color:'#ecc94b' },
      { min:17, max:17, outcome:'double', label:'Wall-Ball Double', color:'#38b2ac' },
      { min:18, max:99, outcome:'flyout', label:'Flyout', color:'#718096' }
    ],
    zoneBonuses:{ z1:-4, z2:0, z3:9 },
    readAffinity:{ trigger:'B1_only', effect:'only_b1_counters' },
    clutch:{ condition:'risp', bonuses:{z3:7} },
    specialText:'Pure Cleanup Hitter. Giant 11–16 Home Run band. RISP: +7 power.' },
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
