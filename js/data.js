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
  'P1' :{ id:'P1' , name:'Four-Seam Fastball'  , type:'pitcher', zone:'read'   , value:10, pitchCall:'fastball'    , desc:'Counter: Guess Fastball ×2.0, Sit Fastball ×2.0' },
  'P2' :{ id:'P2' , name:'Changeup'             , type:'pitcher', zone:'read'   , value:9 , pitchCall:'changeup'    , desc:'Counter: Patient Eye ×1.5, Look Off-Speed ×2.0' },
  'P3' :{ id:'P3' , name:'Curveball'            , type:'pitcher', zone:'read'   , value:10, pitchCall:'curveball'   , desc:'Counter: Sit on the Breaking Ball ×2.0' },
  'P4' :{ id:'P4' , name:'Slider'               , type:'pitcher', zone:'read'   , value:11, pitchCall:'slider'      , desc:'Counter: Off-Speed Specialist ×2.0, Look Off-Speed ×2.0' },
  'P5' :{ id:'P5' , name:'Two-Seamer'           , type:'pitcher', zone:'read'   , value:7 , pitchCall:'twoseamer'   , desc:'Counter: Read the Room ×2.0' },
  'P6' :{ id:'P6' , name:'Cutter'               , type:'pitcher', zone:'read'   , value:9 , pitchCall:'cutter'      , desc:'Counter: Read the Room ×2.0' },
  'P7' :{ id:'P7' , name:'Changeup (Slow)'      , type:'pitcher', zone:'read'   , value:8 , pitchCall:'changeup_slow', desc:'Counter: Patient Eye ×1.5. If not countered: +5 to pitcher Zone 2.' , special:'uncountered_z2_bonus:5' },
  'P8' :{ id:'P8' , name:'Slurve'               , type:'pitcher', zone:'read'   , value:9 , pitchCall:'slurve'      , desc:'Counter: Sit on Breaking Ball ×2.0, Off-Speed Specialist ×2.0' },
  'P9' :{ id:'P9' , name:'Split-Finger'         , type:'pitcher', zone:'read'   , value:8 , pitchCall:'splitter'    , desc:'Counter: Look Off-Speed ×2.0' },
  'P10':{ id:'P10', name:'Knuckleball'           , type:'pitcher', zone:'read'   , value:8 , pitchCall:'knuckleball' , desc:'Immune to all counters.' , special:'immune' },
  'P11':{ id:'P11', name:'Eephus'               , type:'pitcher', zone:'read'   , value:4 , pitchCall:'eephus'      , desc:'Immune to counters. Batter Z2 ≥15 → batter auto-loses Zone 2.' , special:'immune' },
  'P12':{ id:'P12', name:'Fastball (Cut)'        , type:'pitcher', zone:'read'   , value:9 , pitchCall:'cutter_fast' , desc:'Counter: Guess Fastball ×1.5 only (partial).' },

  // ── PITCHER ZONE 2: VELOCITY & DECEPTION [contact] ─────────────────────────
  'P13':{ id:'P13', name:'Extra Heat'            , type:'pitcher', zone:'contact', value:12, desc:'No special effect.' },
  'P14':{ id:'P14', name:'Paint the Corners'     , type:'pitcher', zone:'contact', value:8 , desc:'+4 to pitcher Zone 3 total when played.' , special:'z3bonus:4' },
  'P15':{ id:'P15', name:'High Cheese'           , type:'pitcher', zone:'contact', value:10, desc:'+3 if pitch type card is a fastball variant.' , special:'fastball_bonus:3' },
  'P16':{ id:'P16', name:'Backdoor Breaking Ball', type:'pitcher', zone:'contact', value:9 , desc:'Counters Pull Heavy (B23) in Zone 3: −8.' , z3CounterOf:'B23', penalty:-8 },
  'P17':{ id:'P17', name:'Change of Speed'       , type:'pitcher', zone:'contact', value:9 , desc:'Reduces batter Zone 2 total by 4.' , special:'reduce_batter_z2:4' },
  'P18':{ id:'P18', name:'Tunneling'             , type:'pitcher', zone:'contact', value:12, desc:'Stays hidden until Zone 1 resolves.' },
  'P19':{ id:'P19', name:'Sequence Breaker'      , type:'pitcher', zone:'contact', value:7 , desc:'+6 if a different pitch type was thrown last PA.' , special:'sequence_bonus:6' },
  'P20':{ id:'P20', name:'Bury It'               , type:'pitcher', zone:'contact', value:10, desc:'+4 if pitch type card was a breaking ball.' , special:'breaking_bonus:4' },
  'P21':{ id:'P21', name:'Spotting'              , type:'pitcher', zone:'contact', value:8 , desc:'Also counts as +4 to Zone 3 simultaneously.' , special:'z3bonus:4' },
  'P22':{ id:'P22', name:'Fog Machine'           , type:'pitcher', zone:'contact', value:7 , desc:'Opponent discards 1 Zone 1 card before Zone 1 resolves.' },

  // ── PITCHER ZONE 3: DEFENSE [result] ───────────────────────────────────────
  'P23':{ id:'P23', name:'Infield Shift (Pull)'  , type:'pitcher', zone:'result' , value:11, desc:'Counters Pull Heavy (B23): −8 to batter Zone 3.' , z3CounterOf:'B23', penalty:-8 },
  'P24':{ id:'P24', name:'No Doubles'            , type:'pitcher', zone:'result' , value:9 , desc:'Counters Launch Angle (B22): −5 to batter Zone 3.' , z3CounterOf:'B22', penalty:-5 },
  'P25':{ id:'P25', name:'Infield In'            , type:'pitcher', zone:'result' , value:8 , desc:'Runners cannot score from 2nd on a single this PA.' },
  'P26':{ id:'P26', name:'Gold Glove'            , type:'pitcher', zone:'result' , value:12, desc:'No special effect.' },
  'P27':{ id:'P27', name:'Double Play Depth'     , type:'pitcher', zone:'result' , value:9 , desc:'Groundout with runner on 1st = automatic Double Play.' , special:'auto_dp' },
  'P28':{ id:'P28', name:'Opposite Field Defense', type:'pitcher', zone:'result' , value:9 , desc:'Counters Opposite Field (B24): −8 to batter Zone 3.' , z3CounterOf:'B24', penalty:-8 },
  'P29':{ id:'P29', name:'Vacuum'                , type:'pitcher', zone:'result' , value:10, desc:'Ground ball outcomes with batter score <20 = automatic out.' , special:'vacuum' },
  'P30':{ id:'P30', name:'Corner Depth'          , type:'pitcher', zone:'result' , value:8 , desc:'Line drives: 30% chance converted to foul out.' },

  // ── BATTER ZONE 1: READ & GUESS [read] ─────────────────────────────────────
  'B1' :{ id:'B1' , name:'Guess Fastball'        , type:'batter' , zone:'read'   , value:8 , counters:['fastball','cutter_fast']              , counterMult:{fastball:2.0, cutter_fast:1.5}                                , desc:'Counter: Fastball ×2.0, Cut Fastball ×1.5' },
  'B2' :{ id:'B2' , name:'Sit on the Breaking Ball', type:'batter', zone:'read'  , value:9 , counters:['curveball','slurve']                  , counterMult:{curveball:2.0, slurve:2.0}                                    , desc:'Counter: Curveball ×2.0, Slurve ×2.0' },
  'B3' :{ id:'B3' , name:'Look Off-Speed'        , type:'batter' , zone:'read'   , value:8 , counters:['changeup','changeup_slow','splitter']  , counterMult:{changeup:2.0, changeup_slow:2.0, splitter:2.0}               , desc:'Counter: Changeup ×2.0, Split-Finger ×2.0' },
  'B4' :{ id:'B4' , name:'Patient Eye'           , type:'batter' , zone:'read'   , value:7 , counters:['changeup','changeup_slow']             , counterMult:{changeup:1.5, changeup_slow:1.5}                              , desc:'Counter: Changeup ×1.5. Walk probability +10%.' , special:'walk_bonus' },
  'B5' :{ id:'B5' , name:'Off-Speed Specialist'  , type:'batter' , zone:'read'   , value:9 , counters:['slider','slurve']                     , counterMult:{slider:2.0, slurve:2.0}                                       , desc:'Counter: Slider ×2.0, Slurve ×2.0' },
  'B6' :{ id:'B6' , name:'Sit Fastball'          , type:'batter' , zone:'read'   , value:10, counters:['fastball','cutter_fast','cutter']      , counterMult:{fastball:2.0, cutter_fast:2.0, cutter:2.0}                   , desc:'Counter: All fastball variants ×2.0' },
  'B7' :{ id:'B7' , name:'Read the Room'         , type:'batter' , zone:'read'   , value:8 , counters:['twoseamer','cutter']                  , counterMult:{twoseamer:2.0, cutter:2.0}                                    , desc:'Counter: Two-Seamer ×2.0, Cutter ×2.0' },
  'B8' :{ id:'B8' , name:'First Pitch Aggressor' , type:'batter' , zone:'read'   , value:7 , counters:[]                                      , counterMult:{}                                                              , desc:'+5 if first PA of the inning.' , special:'first_pa_bonus:5' },
  'B9' :{ id:'B9' , name:'Scouting Report'       , type:'batter' , zone:'read'   , value:9 , counters:[]                                      , counterMult:{}                                                              , desc:'After placement, opponent reveals their Zone 2 card.' },
  'B10':{ id:'B10', name:'Veteran Instinct'       , type:'batter' , zone:'read'   , value:7 , counters:['fastball','changeup','curveball','slider','twoseamer','cutter','slurve','splitter','cutter_fast','changeup_slow'], counterMult:1.3, desc:'Counter: Any pitch type ×1.3' },

  // ── BATTER ZONE 2: CONTACT & SWING [contact] ───────────────────────────────
  'B11':{ id:'B11', name:'Bat Speed'             , type:'batter' , zone:'contact', value:11, desc:'No special effect.' },
  'B12':{ id:'B12', name:'Contact Swing'         , type:'batter' , zone:'contact', value:9 , desc:'−3 to own Zone 3 value.' , special:'self_z3_penalty:-3' },
  'B13':{ id:'B13', name:'Choke Up'              , type:'batter' , zone:'contact', value:8 , desc:'Immune to Strikeout Swinging trigger this PA.' , special:'k_immune' },
  'B14':{ id:'B14', name:'Full Extension'        , type:'batter' , zone:'contact', value:8 , desc:'+5 to own Zone 3 value.' , special:'self_z3_bonus:5' },
  'B15':{ id:'B15', name:'Quick Hands'           , type:'batter' , zone:'contact', value:12, desc:'No special effect.' },
  'B16':{ id:'B16', name:'Two-Strike Approach'   , type:'batter' , zone:'contact', value:7 , desc:'Immune to ALL strikeout triggers this PA.' , special:'k_immune' },
  'B17':{ id:'B17', name:'Late Contact'          , type:'batter' , zone:'contact', value:9 , desc:'+4 if pitch type was off-speed.' , special:'offspeed_bonus:4' },
  'B18':{ id:'B18', name:'Barrel It'             , type:'batter' , zone:'contact', value:10, desc:'Batter wins Zone 2 → Zone 3 batter total +6.' , special:'z2_win_z3_bonus:6' },
  'B19':{ id:'B19', name:'Inside-Out Swing'      , type:'batter' , zone:'contact', value:8 , desc:'Counters both Infield Shift cards: −6 each.' , special:'counter_shift:6' },
  'B20':{ id:'B20', name:'Level Swing'           , type:'batter' , zone:'contact', value:8 , desc:'Fly ball outcomes converted to line drives.' },

  // ── BATTER ZONE 3: POWER & SPEED [result] ──────────────────────────────────
  'B21':{ id:'B21', name:'Power Surge'           , type:'batter' , zone:'result' , value:12, desc:'No special effect.' },
  'B22':{ id:'B22', name:'Launch Angle'          , type:'batter' , zone:'result' , value:11, desc:'Countered by No Doubles (P24): −5.' , z3CounteredBy:['P24'] },
  'B23':{ id:'B23', name:'Pull Heavy'            , type:'batter' , zone:'result' , value:11, desc:'Countered by Infield Shift (P23): −8, Backdoor (P16): −8.' , z3CounteredBy:['P23','P16'] },
  'B24':{ id:'B24', name:'Opposite Field'        , type:'batter' , zone:'result' , value:10, desc:'Countered by Opposite Field Defense (P28): −8.' , z3CounteredBy:['P28'] },
  'B25':{ id:'B25', name:'Hustle'                , type:'batter' , zone:'result' , value:9 , desc:'All baserunners advance +1 base on any hit.' , special:'hustle' },
  'B26':{ id:'B26', name:'Green Light'           , type:'batter' , zone:'result' , value:8 , desc:'Automatic steal attempt. 70% success.' , special:'steal' },
  'B27':{ id:'B27', name:'Upper Deck'            , type:'batter' , zone:'result' , value:13, desc:'−4 to own Zone 2 value (big swing).' , special:'self_z2_penalty:-4' },
  'B28':{ id:'B28', name:'Line Drive'            , type:'batter' , zone:'result' , value:10, desc:'Immune to outfield positioning cards.' , special:'line_drive_immune' },
  'B29':{ id:'B29', name:'Hit and Run'           , type:'batter' , zone:'result' , value:8 , desc:'All runners advance on any contact, including outs.' , special:'hit_and_run' },
  'B30':{ id:'B30', name:'Clutch'                , type:'batter' , zone:'result' , value:10, desc:'Value doubled if batting team is trailing.' , special:'trailing_double' },

  // ── UNIVERSAL ───────────────────────────────────────────────────────────────
  'U1' :{ id:'U1' , name:'Momentum'              , type:'universal', zone:'any'  , value:7 , desc:'+2 for each zone already won by your side.' , special:'momentum' },
  'U2' :{ id:'U2' , name:'Intensity'             , type:'universal', zone:'any'  , value:6 , desc:'+3 to all zones you have ≥1 card in.' },
  'U3' :{ id:'U3' , name:'Pressure'              , type:'universal', zone:'any'  , value:8 , desc:'+4 if your team is trailing.' , special:'pressure' },
  'U4' :{ id:'U4' , name:'Discipline'            , type:'universal', zone:'any'  , value:6 , desc:'Prevents one trigger from firing against you this PA.' , special:'discipline' },
  'U5' :{ id:'U5' , name:'Audible'               , type:'universal', zone:'any'  , value:0 , desc:'[UI] Swap one face-down card to an adjacent zone before reveal.' },
  'U6' :{ id:'U6' , name:'Time Out'              , type:'universal', zone:'any'  , value:0 , desc:'[UI] Both players reveal Zone 1 cards before Zones 2 & 3.' },
  'U7' :{ id:'U7' , name:'Mulligan'              , type:'universal', zone:'any'  , value:0 , desc:'Discard this card, draw 2 immediately.' , special:'mulligan' },
  'U8' :{ id:'U8' , name:'Second Wind'           , type:'universal', zone:'any'  , value:0 , desc:'Recover 2 stamina boxes on your active pitcher.' , special:'second_wind' },
  'U9' :{ id:'U9' , name:'Clutch Hit'            , type:'universal', zone:'any'  , value:10, desc:'Only playable with runner in scoring position.' , special:'risp_only' },
  'U10':{ id:'U10', name:'Walk-Off'              , type:'universal', zone:'any'  , value:15, desc:'Only playable in extra innings. One use per game.' , special:'extra_innings_only' },
};

// ─────────────────────────────────────────────────────────────────────────────
// PITCHER CHARACTERS (8)
// stamina: freshMax = last PA index that's Fresh. tiringMax = last PA that's Tiring. Beyond = Gassed.
// pitchAffinity: zone (z1/z2/z3) bonus when matching pitchCall is used in Z1.
// ─────────────────────────────────────────────────────────────────────────────
const PITCHER_CHARACTERS = {
  'PC01':{ id:'PC01', name:'"Big Jake" Harmon'        , archetype:'Power Pitcher'      , color:'#c44b4b',
    zoneBonuses:{ z1:-1, z2:5, z3:-2 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z2', bonus:3}, {pitchCall:'slider', zone:'z2', bonus:2} ],
    stamina:{ freshMax:5, tiringMax:8, tiringMod:{z1:0,z2:-3,z3:0}, gassedMod:{z1:-2,z2:-5,z3:0} },
    specialText:'Strikeout Swinging → opponent discards 1 card. Restores 1 stamina box.' },
  'PC02':{ id:'PC02', name:'"El Arte" Medina'          , archetype:'Control Artist'     , color:'#4b8bc4',
    zoneBonuses:{ z1:4, z2:2, z3:2 },
    pitchAffinity:[ {pitchCall:'changeup', zone:'z1', bonus:4}, {pitchCall:'changeup_slow', zone:'z1', bonus:4}, {pitchCall:'curveball', zone:'z1', bonus:2} ],
    stamina:{ freshMax:7, tiringMax:10, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Counter multipliers against Medina reduced by 0.25 (×2.0 → ×1.75).' },
  'PC03':{ id:'PC03', name:'"The Groundskeeper" Pérez', archetype:'Ground Ball Machine', color:'#4baa5a',
    zoneBonuses:{ z1:2, z2:0, z3:6 },
    pitchAffinity:[ {pitchCall:'twoseamer', zone:'z3', bonus:5}, {pitchCall:'splitter', zone:'z3', bonus:3} ],
    stamina:{ freshMax:7, tiringMax:11, tiringMod:{z1:0,z2:0,z3:-3}, gassedMod:{z1:0,z2:-2,z3:-5} },
    specialText:'Double Play Depth gains +5 value. Any groundout with runner on 1st = auto DP.' },
  'PC04':{ id:'PC04', name:'"Smoke" Williams'          , archetype:'Closer'             , color:'#e0a020',
    zoneBonuses:{ z1:0, z2:7, z3:2 },
    pitchAffinity:[ {pitchCall:'slider', zone:'z2', bonus:5}, {pitchCall:'fastball', zone:'z2', bonus:3} ],
    stamina:{ freshMax:3, tiringMax:5, tiringMod:{z1:0,z2:-4,z3:0}, gassedMod:{z1:0,z2:-8,z3:0} },
    specialText:'First 3 PAs: all zone bonuses +2 (Ice in His Veins). Do NOT extend past PA 5.' },
  'PC05':{ id:'PC05', name:'"The Professor" Volkov'    , archetype:'Junkballer'         , color:'#8855cc',
    zoneBonuses:{ z1:6, z2:-2, z3:3 },
    pitchAffinity:[ {pitchCall:'knuckleball', zone:'z1', bonus:3}, {pitchCall:'eephus', zone:'z1', bonus:5} ],
    stamina:{ freshMax:6, tiringMax:9, tiringMod:{z1:-2,z2:0,z3:0}, gassedMod:{z1:-4,z2:0,z3:-2} },
    specialText:'Knuckleball & Eephus immune to all counters. Immune to Scouting Report.' },
  'PC06':{ id:'PC06', name:'"The Machine" Castillo'    , archetype:'Ace'                , color:'#e8b84b',
    zoneBonuses:{ z1:2, z2:3, z3:2 },
    pitchAffinity:[ {pitchCall:'fastball', zone:'z1', bonus:1}, {pitchCall:'slider', zone:'z1', bonus:1}, {pitchCall:'curveball', zone:'z1', bonus:1}, {pitchCall:'changeup', zone:'z1', bonus:1} ],
    stamina:{ freshMax:8, tiringMax:11, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:-1,z2:-3,z3:0} },
    specialText:'Once per game: after placement, view opponent Zone 1 before reveal.' },
  'PC07':{ id:'PC07', name:'"Setup Man" Kowalski'      , archetype:'Reliever'           , color:'#4b99aa',
    zoneBonuses:{ z1:2, z2:4, z3:3 },
    pitchAffinity:[ {pitchCall:'cutter', zone:'z2', bonus:3}, {pitchCall:'twoseamer', zone:'z3', bonus:2} ],
    stamina:{ freshMax:4, tiringMax:6, tiringMod:{z1:0,z2:-2,z3:0}, gassedMod:{z1:0,z2:-4,z3:-2} },
    specialText:'Fireman: when entering with runners on base, Zone 3 +4 for first PA.' },
  'PC08':{ id:'PC08', name:'"The Wizard" Chen'         , archetype:'Deceptive Starter'  , color:'#cc5599',
    zoneBonuses:{ z1:3, z2:2, z3:1 },
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
  grind    :{ name:'🛡️ Grind It Out', desc:'Control pitching, patient hitting, stamina management. Win 3-2.',
    cards:['P2','P3','P5','P6','P14','P17','P19','P24','P25','P27','B4','B7','B9','B10','B12','B13','B16','B17','B20','B24','B25','U1','U4','U7','U8'] },
  bigInning:{ name:'💥 Big Inning'  , desc:'Raw power, high velocity, swing for the fences. Win 8-5.',
    cards:['P1','P1','P4','P13','P13','P15','P20','P23','P23','P26','B1','B6','B11','B11','B15','B21','B21','B22','B23','B27','B30','U1','U3','U7','U9'] },
  manager  :{ name:'🧠 The Manager' , desc:'Information advantage, deck manipulation, situational mastery.',
    cards:['P2','P8','P10','P14','P17','P21','P22','P25','P28','P29','B4','B9','B9','B10','B13','B16','B19','B20','B24','B26','U1','U4','U5','U6','U7'] },
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
