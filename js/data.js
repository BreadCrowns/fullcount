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
  // ── PITCHER ZONE 1: PITCH TYPES [read] ─────────────────────────────────────
  'P1' :{ id:'P1' , name:'Four-Seam Fastball'  , type:'pitcher', zone:'read'   , value:10, pitchCall:'fastball'   , desc:'Fastball. Countered by Guess Fastball (×2.0).' },
  'P2' :{ id:'P2' , name:'Changeup'             , type:'pitcher', zone:'read'   , value:9 , pitchCall:'offspeed'   , desc:'Off-Speed. Countered by Look Off-Speed (×2.0).' },
  'P3' :{ id:'P3' , name:'Curveball'            , type:'pitcher', zone:'read'   , value:10, pitchCall:'breaking'   , desc:'Breaking Ball. Countered by Sit Breaking Ball (×2.0).' },
  'P4' :{ id:'P4' , name:'Slider'               , type:'pitcher', zone:'read'   , value:11, pitchCall:'breaking'   , desc:'Breaking Ball. Countered by Sit Breaking Ball (×2.0).' },
  'P5' :{ id:'P5' , name:'Two-Seamer'           , type:'pitcher', zone:'read'   , value:8 , pitchCall:'fastball'   , desc:'Fastball variant. Countered by Guess Fastball (×2.0).' },
  'P6' :{ id:'P6' , name:'Cutter'               , type:'pitcher', zone:'read'   , value:9 , pitchCall:'fastball'   , desc:'Cut Fastball. Countered by Guess Fastball (×2.0).' },
  'P7' :{ id:'P7' , name:'Sinker'               , type:'pitcher', zone:'read'   , value:9 , pitchCall:'fastball'   , desc:'Heavy Fastball. Countered by Guess Fastball (×2.0).' },
  'P8' :{ id:'P8' , name:'Slurve'               , type:'pitcher', zone:'read'   , value:9 , pitchCall:'breaking'   , desc:'Breaking Ball. Countered by Sit Breaking Ball (×2.0).' },
  'P9' :{ id:'P9' , name:'Splitter'             , type:'pitcher', zone:'read'   , value:9 , pitchCall:'offspeed'   , desc:'Diving Off-Speed. Countered by Look Off-Speed (×2.0).' },
  'P10':{ id:'P10', name:'Knuckleball'          , type:'pitcher', zone:'read'   , value:8 , pitchCall:'knuckleball', desc:'Fluttering Knuckleball. Immune to pitch guess counters.' },
  'P11':{ id:'P11', name:'Palmball'             , type:'pitcher', zone:'read'   , value:8 , pitchCall:'offspeed'   , desc:'Soft Off-Speed. Countered by Look Off-Speed (×2.0).' },
  'P12':{ id:'P12', name:'High Heat'            , type:'pitcher', zone:'read'   , value:10, pitchCall:'fastball'   , desc:'Elevated Fastball. Countered by Guess Fastball (×2.0).' },

  // ── PITCHER ZONE 2: VELOCITY & COMMAND [contact] ───────────────────────────
  'P13':{ id:'P13', name:'Extra Heat'           , type:'pitcher', zone:'contact', value:12, desc:'Maximum velocity. High Zone 2 pitching power.' },
  'P14':{ id:'P14', name:'Corner Paint'         , type:'pitcher', zone:'contact', value:10, desc:'Pinpoint command in Zone 2.' },
  'P15':{ id:'P15', name:'High Cheese'          , type:'pitcher', zone:'contact', value:11, desc:'Fastball up in the strike zone.' },
  'P16':{ id:'P16', name:'Backdoor Strike'      , type:'pitcher', zone:'contact', value:10, desc:'Deceptive pitch on the outer edge.' },
  'P17':{ id:'P17', name:'Change of Pace'       , type:'pitcher', zone:'contact', value:10, desc:'Disrupts batter swing timing.' },
  'P18':{ id:'P18', name:'Tunneling'            , type:'pitcher', zone:'contact', value:11, desc:'Matching release angles for swing-and-miss.' },
  'P19':{ id:'P19', name:'Sequence Pitch'       , type:'pitcher', zone:'contact', value:10, desc:'Unpredictable pitch location.' },
  'P20':{ id:'P20', name:'Bury It'              , type:'pitcher', zone:'contact', value:11, desc:'Sharp low pitch for strikeouts.' },
  'P21':{ id:'P21', name:'Pitcher Spotting'     , type:'pitcher', zone:'contact', value:9 , desc:'Solid control on the strike zone border.' },
  'P22':{ id:'P22', name:'Deception'            , type:'pitcher', zone:'contact', value:10, desc:'Hides the ball during delivery.' },

  // ── PITCHER ZONE 3: DEFENSE & FIELDING [result] ────────────────────────────
  'P23':{ id:'P23', name:'Infield Shift'        , type:'pitcher', zone:'result' , value:11, desc:'Loaded defensive positioning in Zone 3.' },
  'P24':{ id:'P24', name:'No Doubles'           , type:'pitcher', zone:'result' , value:10, desc:'Deep outfield alignment prevents extra bases.' },
  'P25':{ id:'P25', name:'Infield In'           , type:'pitcher', zone:'result' , value:9 , desc:'Infield drawn in to stop runs at home.' },
  'P26':{ id:'P26', name:'Gold Glove'           , type:'pitcher', zone:'result' , value:12, desc:'Elite fielding defense in Zone 3.' },
  'P27':{ id:'P27', name:'Double Play Depth'    , type:'pitcher', zone:'result' , value:10, desc:'Turned double play positioning.' },
  'P28':{ id:'P28', name:'Deep Outfield'        , type:'pitcher', zone:'result' , value:10, desc:'Outfield shaded deep against power hitters.' },
  'P29':{ id:'P29', name:'Vacuum Defense'       , type:'pitcher', zone:'result' , value:10, desc:'Smothers hard-hit ground balls.' },
  'P30':{ id:'P30', name:'Warning Track'        , type:'pitcher', zone:'result' , value:9 , desc:'Fielders back up against the wall.' },

  // ── BATTER ZONE 1: READ & GUESS [read] ─────────────────────────────────────
  'B1' :{ id:'B1' , name:'Guess Fastball'       , type:'batter' , zone:'read'   , value:8 , counters:['fastball','cutter_fast'], counterMult:2.0, desc:'Counters Fastball pitches (×2.0 power).' },
  'B2' :{ id:'B2' , name:'Sit on Breaking Ball' , type:'batter' , zone:'read'   , value:9 , counters:['breaking','curveball','slurve'], counterMult:2.0, desc:'Counters Breaking Ball pitches (×2.0 power).' },
  'B3' :{ id:'B3' , name:'Look Off-Speed'       , type:'batter' , zone:'read'   , value:8 , counters:['offspeed','changeup','splitter'], counterMult:2.0, desc:'Counters Off-Speed pitches (×2.0 power).' },
  'B4' :{ id:'B4' , name:'Patient Eye'          , type:'batter' , zone:'read'   , value:8 , counters:['offspeed','changeup'], counterMult:1.5, desc:'Patient approach. Counters Off-Speed (×1.5 power).' },
  'B5' :{ id:'B5' , name:'Breaking Ball Hunter' , type:'batter' , zone:'read'   , value:9 , counters:['breaking','slider'], counterMult:2.0, desc:'Counters Breaking Ball pitches (×2.0 power).' },
  'B6' :{ id:'B6' , name:'Sit Fastball'         , type:'batter' , zone:'read'   , value:10, counters:['fastball'], counterMult:2.0, desc:'Counters Fastball pitches (×2.0 power).' },
  'B7' :{ id:'B7' , name:'Read the Pitch'       , type:'batter' , zone:'read'   , value:8 , counters:['fastball','breaking'], counterMult:1.5, desc:'Counters Fastball or Breaking pitches (×1.5 power).' },
  'B8' :{ id:'B8' , name:'First Pitch Aggressor', type:'batter' , zone:'read'   , value:9 , counters:['fastball'], counterMult:1.5, desc:'Counters Fastball (×1.5 power).' },
  'B9' :{ id:'B9' , name:'Pitch Tracking'       , type:'batter' , zone:'read'   , value:9 , counters:['breaking','offspeed'], counterMult:1.5, desc:'Counters Breaking or Off-Speed pitches (×1.5 power).' },
  'B10':{ id:'B10', name:'Veteran Instinct'      , type:'batter' , zone:'read'   , value:8 , counters:['fastball','breaking','offspeed'], counterMult:1.3, desc:'Counters any standard pitch (×1.3 power).' },

  // ── BATTER ZONE 2: CONTACT & SWING [contact] ───────────────────────────────
  'B11':{ id:'B11', name:'Bat Speed'            , type:'batter' , zone:'contact', value:11, desc:'Fast bat velocity in Zone 2.' },
  'B12':{ id:'B12', name:'Contact Swing'        , type:'batter' , zone:'contact', value:10, desc:'Puts the ball in play reliably.' },
  'B13':{ id:'B13', name:'Choke Up'             , type:'batter' , zone:'contact', value:9 , desc:'Shortened swing. Immune to Strikeout Swinging.' },
  'B14':{ id:'B14', name:'Full Extension'       , type:'batter' , zone:'contact', value:10, desc:'Reaching across the plate for solid contact.' },
  'B15':{ id:'B15', name:'Quick Hands'          , type:'batter' , zone:'contact', value:12, desc:'Blazing hand speed through the zone.' },
  'B16':{ id:'B16', name:'Two-Strike Approach'  , type:'batter' , zone:'contact', value:8 , desc:'Defensive two-strike swing. Immune to Strikeouts.' },
  'B17':{ id:'B17', name:'Sweet Spot'           , type:'batter' , zone:'contact', value:11, desc:'Squared-up sweet spot contact.' },
  'B18':{ id:'B18', name:'Barrel It'            , type:'batter' , zone:'contact', value:11, desc:'Hits the ball right on the barrel.' },
  'B19':{ id:'B19', name:'Inside-Out Swing'     , type:'batter' , zone:'contact', value:10, desc:'Drives pitch with solid balance.' },
  'B20':{ id:'B20', name:'Level Swing'          , type:'batter' , zone:'contact', value:9 , desc:'Flat bat path for line drives.' },

  // ── BATTER ZONE 3: POWER & BALL FLIGHT [result] ────────────────────────────
  'B21':{ id:'B21', name:'Power Surge'          , type:'batter' , zone:'result' , value:12, desc:'Max launch power in Zone 3.' },
  'B22':{ id:'B22', name:'Launch Angle'         , type:'batter' , zone:'result' , value:11, desc:'Ideal flight trajectory for extra bases.' },
  'B23':{ id:'B23', name:'Pull Heavy'           , type:'batter' , zone:'result' , value:11, desc:'Crushed into the pull-side gap.' },
  'B24':{ id:'B24', name:'Opposite Field'       , type:'batter' , zone:'result' , value:10, desc:'Drives ball with power to the opposite field.' },
  'B25':{ id:'B25', name:'Extra Bases'          , type:'batter' , zone:'result' , value:10, desc:'Aggressive base hit into the gap.' },
  'B26':{ id:'B26', name:'Gap Power'            , type:'batter' , zone:'result' , value:10, desc:'Deep shot between outfielders.' },
  'B27':{ id:'B27', name:'Upper Deck'           , type:'batter' , zone:'result' , value:13, desc:'Massive swing for towering distance.' },
  'B28':{ id:'B28', name:'Line Drive'           , type:'batter' , zone:'result' , value:10, desc:'Stinging line drive through the infield.' },
  'B29':{ id:'B29', name:'Hard Contact'         , type:'batter' , zone:'result' , value:10, desc:'Hard exit velocity into the outfield.' },
  'B30':{ id:'B30', name:'Clutch Blast'         , type:'batter' , zone:'result' , value:11, desc:'High-leverage power swing.' },

  // ── UNIVERSAL [any zone] ───────────────────────────────────────────────────
  'U1' :{ id:'U1' , name:'Momentum'             , type:'universal', zone:'any'  , value:8 , desc:'Universal power. Usable in any zone.' },
  'U2' :{ id:'U2' , name:'Intensity'            , type:'universal', zone:'any'  , value:7 , desc:'Universal power. Usable in any zone.' },
  'U3' :{ id:'U3' , name:'Pressure'             , type:'universal', zone:'any'  , value:8 , desc:'Universal power. Usable in any zone.' },
  'U4' :{ id:'U4' , name:'Discipline'           , type:'universal', zone:'any'  , value:8 , desc:'Universal power. Usable in any zone.' },
  'U5' :{ id:'U5' , name:'Strategy'             , type:'universal', zone:'any'  , value:7 , desc:'Universal power. Usable in any zone.' },
  'U6' :{ id:'U6' , name:'Tactics'              , type:'universal', zone:'any'  , value:7 , desc:'Universal power. Usable in any zone.' },
  'U7' :{ id:'U7' , name:'Rally Spark'          , type:'universal', zone:'any'  , value:8 , desc:'Universal power. Usable in any zone.' },
  'U8' :{ id:'U8' , name:'Reset'                , type:'universal', zone:'any'  , value:8 , desc:'Universal power. Usable in any zone.' },
  'U9' :{ id:'U9' , name:'Clutch Spark'         , type:'universal', zone:'any'  , value:10, desc:'Universal power. Usable in any zone.' },
  'U10':{ id:'U10', name:'Big Play'             , type:'universal', zone:'any'  , value:12, desc:'Universal power. Usable in any zone.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER CHARACTERS (8)
// stamina: freshMax = last PA index that's Fresh. tiringMax = last PA that's Tiring. Beyond = Gassed.
// pitchAffinity: zone (z1/z2/z3) bonus when matching pitchCall is used in Z1.
// ─────────────────────────────────────────────────────────────────────────────
const PITCH_BASE_POWER = {
  fastball: 8,
  breaking: 7,
  offspeed: 7
};

const PITCHER_CHARACTERS = {
  'PC01':{ id:'PC01', name:'"Big Jake" Harmon'        , archetype:'Power Pitcher'      , color:'#c44b4b',
    zoneBonuses:{ z1:-1, z2:5, z3:-2 },
    repertoire:{ fastball:5, breaking:3, offspeed:1 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z2', bonus:3}, {pitchCall:'slider', zone:'z2', bonus:2} ],
    stamina:{ freshMax:5, tiringMax:8, tiringMod:{z1:0,z2:-3,z3:0}, gassedMod:{z1:-2,z2:-5,z3:0} },
    specialText:'Strikeout Swinging → opponent discards 1 card. Restores 1 stamina box.' },
  'PC02':{ id:'PC02', name:'"El Arte" Medina'          , archetype:'Control Artist'     , color:'#4b8bc4',
    zoneBonuses:{ z1:4, z2:2, z3:2 },
    repertoire:{ fastball:3, breaking:4, offspeed:2 },
    pitchAffinity:[ {pitchCall:'changeup', zone:'z1', bonus:4}, {pitchCall:'changeup_slow', zone:'z1', bonus:4}, {pitchCall:'curveball', zone:'z1', bonus:2} ],
    stamina:{ freshMax:7, tiringMax:10, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Counter multipliers against Medina reduced by 0.25 (×2.0 → ×1.75).' },
  'PC03':{ id:'PC03', name:'"The Groundskeeper" Pérez', archetype:'Ground Ball Machine', color:'#4baa5a',
    zoneBonuses:{ z1:2, z2:0, z3:6 },
    repertoire:{ fastball:4, breaking:3, offspeed:2 },
    pitchAffinity:[ {pitchCall:'twoseamer', zone:'z3', bonus:5}, {pitchCall:'splitter', zone:'z3', bonus:3} ],
    stamina:{ freshMax:7, tiringMax:11, tiringMod:{z1:0,z2:0,z3:-3}, gassedMod:{z1:0,z2:-2,z3:-5} },
    specialText:'Double Play Depth gains +5 value. Any groundout with runner on 1st = auto DP.' },
  'PC04':{ id:'PC04', name:'"Smoke" Williams'          , archetype:'Closer'             , color:'#e0a020',
    zoneBonuses:{ z1:0, z2:7, z3:2 },
    repertoire:{ fastball:5, breaking:4, offspeed:0 },
    pitchAffinity:[ {pitchCall:'slider', zone:'z2', bonus:5}, {pitchCall:'fastball', zone:'z2', bonus:3} ],
    stamina:{ freshMax:3, tiringMax:5, tiringMod:{z1:0,z2:-4,z3:0}, gassedMod:{z1:0,z2:-8,z3:0} },
    specialText:'First 3 PAs: all zone bonuses +2 (Ice in His Veins). Do NOT extend past PA 5.' },
  'PC05':{ id:'PC05', name:'"The Professor" Volkov'    , archetype:'Junkballer'         , color:'#8855cc',
    zoneBonuses:{ z1:6, z2:-2, z3:3 },
    repertoire:{ fastball:2, breaking:4, offspeed:3 },
    pitchAffinity:[ {pitchCall:'knuckleball', zone:'z1', bonus:3}, {pitchCall:'eephus', zone:'z1', bonus:5} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:0,z3:-2} },
    specialText:'Knuckleball & Eephus immune to all counters. Immune to Scouting Report.' },
  'PC06':{ id:'PC06', name:'"The Machine" Castillo'    , archetype:'Ace'                , color:'#e8b84b',
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    repertoire:{ fastball:4, breaking:3, offspeed:2 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z1', bonus:1}, {pitchCall:'slider', zone:'z1', bonus:1}, {pitchCall:'curveball', zone:'z1', bonus:1}, {pitchCall:'changeup', zone:'z1', bonus:1} ],
    stamina:{ freshMax:8, tiringMax:11, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Once per game: after placement, view opponent Zone 1 before reveal.' },
  'PC07':{ id:'PC07', name:'"Setup Man" Kowalski'      , archetype:'Reliever'           , color:'#4b99aa',
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    repertoire:{ fastball:4, breaking:4, offspeed:1 },
    pitchAffinity:[ {pitchCall:'cutter', zone:'z2', bonus:3}, {pitchCall:'twoseamer', zone:'z3', bonus:2} ],
    stamina:{ freshMax:4, tiringMax:6, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:0,z2:-4,z3:-2} },
    specialText:'Fireman: when entering with runners on base, Zone 3 +4 for first PA.' },
  'PC08':{ id:'PC08', name:'"The Wizard" Chen'         , archetype:'Deceptive Starter'  , color:'#cc5599',
    zoneBonuses:{ z1:3, z2:2, z3:1 },
    repertoire:{ fastball:3, breaking:5, offspeed:1 },
    pitchAffinity:[ {pitchCall:'slurve', zone:'z1', bonus:5}, {pitchCall:'splitter', zone:'z1', bonus:3} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:-2,z3:0} },
    specialText:'[Advanced] Once per PA: swap Zone 1 and Zone 2 placement after reveal.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// BATTER CHARACTERS (12)
// readAffinity.trigger: 'any_counter' | card ID | null
// clutch.condition: 'risp'|'trailing'|'two_outs'|'runner_on_base'|'final_inning_close'
// ─────────────────────────────────────────────────────────────────────────────
const BATTER_CHARACTERS = {
  'BC01':{ id:'BC01', name:'"The Bear" Mackintosh'      , archetype:'Slugger'            , color:'#c44b4b',
    zoneBonuses:{ z1:-2, z2:2, z3:6 },
    readAffinity:{ trigger:'any_counter', effect:'z3_bonus:3' },
    clutch:{ condition:'risp', bonuses:{z3:5} },
    specialText:'Upper Deck & Power Surge +5. Win all 3 zones: Advantage Score +8.' },
  'BC02':{ id:'BC02', name:'"Slick" Torres'             , archetype:'Contact Hitter'     , color:'#4b8bc4',
    zoneBonuses:{ z1:2, z2:5, z3:-1 },
    readAffinity:{ trigger:'B1', effect:'z2_bonus:5' },
    clutch:{ condition:'two_strikes', bonuses:{z2:3} },
    specialText:'Cannot receive Strikeout Swinging trigger. Pitcher Z2 wins treated as one tier lower.' },
  'BC03':{ id:'BC03', name:'"The Professor" Nakamura'   , archetype:'Disciplined Hitter' , color:'#8855cc',
    zoneBonuses:{ z1:6, z2:1, z3:-2 },
    readAffinity:{ trigger:'B4', effect:'walk_at_7' },
    clutch:{ condition:'full_count', bonuses:{z1:4} },
    specialText:'Patient Eye walk trigger fires at margin +7 (not +10).' },
  'BC04':{ id:'BC04', name:'"Boom Boom" Barrett'        , archetype:'Free Swinger'       , color:'#e0a020',
    zoneBonuses:{ z1:-4, z2:4, z3:5 },
    readAffinity:{ trigger:'B6', effect:'z3_bonus:8' },
    clutch:{ condition:'pitcher_won_z1_last_pa', bonuses:{z1:-2} },
    specialText:'Pitcher won Zone 1 last PA → −2 to own Zone 1. Sit Fastball counter: Zone 3 +8.' },
  'BC05':{ id:'BC05', name:'"El Rayo" Fuentes'          , archetype:'Speed Specialist'   , color:'#4baa5a',
    zoneBonuses:{ z1:2, z2:2, z3:4 },
    readAffinity:{ trigger:'any_counter', effect:'auto_steal' },
    clutch:{ condition:'runner_on_second', bonuses:{z3:5} },
    specialText:'Any counter fires → Green Light steal auto-succeeds. Hustle & Hit and Run +5.' },
  'BC06':{ id:'BC06', name:'"Ice" Peterson'             , archetype:'Clutch Hitter'      , color:'#4b99aa',
    zoneBonuses:{ z1:1, z2:2, z3:3 },
    readAffinity:{ trigger:'any_counter', effect:'all_zones_bonus:2' },
    clutch:{ condition:'final_inning_close', effect:'double_bonuses' },
    specialText:'Final inning within 1 run: all zone bonuses doubled. Clutch card costs 0 slots.' },
  'BC07':{ id:'BC07', name:'"Scrappy" Olsen'            , archetype:'Utility Hitter'     , color:'#888888',
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    readAffinity:null,
    clutch:{ condition:'two_outs', bonuses:{chosen:3} },
    specialText:'2 outs: +3 to any one zone of choice (choose after placement, before reveal).' },
  'BC08':{ id:'BC08', name:'"Lightning" Jackson'        , archetype:'Power Hitter'       , color:'#e8b84b',
    zoneBonuses:{ z1:-1, z2:2, z3:7 },
    readAffinity:{ trigger:'B2', effect:'z3_bonus:9' },
    clutch:{ condition:'runner_on_base', bonuses:{z3:5} },
    specialText:'Win all 3 zones: Advantage Score +10. Home run counts as 2 runs.' },
  'BC09':{ id:'BC09', name:'"The Captain" Reyes'        , archetype:'Complete Hitter'    , color:'#cc5599',
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    readAffinity:null,
    clutch:{ condition:'trailing', bonuses:{z1:3,z2:3,z3:3} },
    specialText:'May play 5 Action Cards per PA instead of 4. Trailing: +3 all zones.' },
  'BC10':{ id:'BC10', name:'"Ghost" Yamamoto'           , archetype:'Switch Hitter'      , color:'#5599dd',
    zoneBonuses:{ z1:3, z2:2, z3:2 },
    readAffinity:null,
    clutch:null,
    specialText:'[Advanced] Once per PA: after reveal, move one card to adjacent zone before resolution.' },
  'BC11':{ id:'BC11', name:'"The Wall" Dubois'          , archetype:'Defensive Specialist', color:'#44aa88',
    zoneBonuses:{ z1:5, z2:0, z3:-3 },
    readAffinity:{ trigger:'B5', effect:'walk_bonus_pct:25' },
    clutch:{ condition:'ahead_in_count', bonuses:{z1:5} },
    specialText:'Walk drawn → draw 1 extra card before next PA.' },
  'BC12':{ id:'BC12', name:'"The Bricks" Murphy'        , archetype:'Designated Hitter'  , color:'#aa4444',
    zoneBonuses:{ z1:-4, z2:0, z3:9 },
    readAffinity:{ trigger:'B1_only', effect:'only_b1_counters' },
    clutch:{ condition:'risp', bonuses:{z3:7} },
    specialText:'Only Guess Fastball (B1) counter fires. Power Surge, Upper Deck, Home Run Swing +6.' },
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
