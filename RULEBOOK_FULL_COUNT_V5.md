# Full Count — Official Tabletop Rulebook (Version 5)

## 1. Overview & Components

*Full Count* is a head-to-head tabletop baseball duel where each manager commands a starting lineup of **9 Batters** and an active **Pitching Staff** (Starting Pitchers, Bullpen Relievers, and Closers).

### Game Components
* **Two Team Rosters (18 Player Half-Cards per side):**
  * 9 Position Players / Batters
  * 3 Starting Pitchers (`SP`), 2 Relief Pitchers (`RP`), 1 Closer (`CL`)
* **Stance Hands (3 Half-Cards per Manager):**
  * 🔴 **Red Card** (Pitcher: *Heat / Velocity* • Batter: *Power Swing*)
  * 🔵 **Blue Card** (Pitcher: *Zone / Command* • Batter: *Eye / Take / Discipline*)
  * 🟢 **Green Card** (Pitcher: *Break / Movement* • Batter: *Contact Swing*)
* **Polyhedral Attribute Dice:** A standard tabletop set (`d4`, `d6`, `d8`, `d10`, `d12`).
* **Momentum Tokens & 8mm Wooden Cubes:** To track each active player’s Momentum Ladder.
* **11" × 17" Manager Playmats:** Featuring the Universal At-Bat Outcome Table, Bullpen/Dugout areas, and 9 Lineup slots.

---

## 2. Player Anatomy & Card Structure

Every player card displays their **Single Core Attribute Die** for each color, their physical **Momentum Ladder**, and their unique **Card Identity** (Surge Trigger, Locked-In Perk, and Special Ability):

### Attribute Dice Mapping
* **Pitchers:**
  * 🔴 **Red:** Velocity (`VEL`) Die (`d6` to `d12`)
  * 🔵 **Blue:** Command (`CMD`) Die (`d6` to `d12`)
  * 🟢 **Green:** Movement (`MOV`) Die (`d6` to `d12`)
* **Batters:**
  * 🔴 **Red:** Power (`POW`) Die (`d4` to `d12`)
  * 🔵 **Blue:** Eye (`EYE`) Die (`d4` to `d12`)
  * 🟢 **Green:** Contact (`CON`) Die (`d4` to `d12`)
  * 🏃 **Speed:** `SPD` Die (`d4` to `d12`)

```
┌────────────────────────────────────────────────────────┐
│ [POS]  PLAYER NAME                         [TEAM LOGO] │
├────────────────────────────────────────────────────────┤
│ 🔴 RED: DIE          🔵 BLUE: DIE       🟢 GREEN: DIE  │
│ SPEED: DIE (Batters)                                   │
├────────────────────────────────────────────────────────┤
│ MOMENTUM LADDER (Inverted: High on Left, Low on Right):│
│ [ L3 🔥 (+5) ]  [ L2 ★ (+3) ]  [ L1 (+2) ]  [ ✕ EXH (+0) ]│
│                                                        │
│ ⚡ SURGE: [Personalized trigger that slides cube LEFT]  │
│ 🔥 LOCKED IN: [Amplified superpower when at Level 3]   │
│ ★ ABILITY (Spend 1 Level): [Slides cube RIGHT]         │
└────────────────────────────────────────────────────────┘
```

---

## 3. The Turn Sequence (Every At-Bat)

Each plate appearance resolves in 4 rapid steps taking approximately **5 seconds**:

```mermaid
flowchart TD
    A["1. Stance Selection<br/>(Secretly choose 🔴, 🔵, or 🟢)"] --> B["2. Simultaneous Reveal<br/>(The Read)"]
    B --> C{"Color Match?"}
    C -->|"MATCH (Same Color)"| D["Batter Wins Momentum!<br/>(Adds Momentum Bonus to Batter Roll)"]
    C -->|"MISMATCH (Different Color)"| E["Pitcher Wins Momentum!<br/>(Adds Momentum Bonus to Pitcher Roll)"]
    D --> F["3. Roll 1 Die Each + Flat Bonus"]
    E --> F
    F --> G["4. Calculate Margin:<br/>Margin = Pitcher Total - Batter Total"]
    G --> H["Lookup Outcome on Universal Chart"]
    H --> I["Check Player Card for ⚡ SURGE!"]
```

### Step 1: Pre-Pitch & Stance Selection
* The defense may make a bullpen pitching change.
* Either manager may declare their active player's **Special Ability** by paying **1 Level** down on their Momentum Ladder (`L3 → L2`, `L2 → L1`, or `L1 → Exhausted`).
* Both managers secretly choose one card from their 3-card hand:
  * **Pitcher chooses pitch type:** 🔴 Heat (`VEL`), 🔵 Zone (`CMD`), or 🟢 Break (`MOV`).
  * **Batter chooses approach:** 🔴 Power Swing (`POW`), 🔵 Eye / Take (`EYE`), or 🟢 Contact Swing (`CON`).

### Step 2: The Read (Simultaneous Reveal)
Both managers flip their chosen cards simultaneously:
* **🎯 MATCH (Same Color):** **Batter Reads the Pitch!** The batter anticipated the pitch location/type and earns their **Momentum Bonus** (`+5`, `+3`, `+2`, or `+0`).
* **🌀 MISMATCH (Different Colors):** **Pitcher Fools the Batter!** The pitcher crossed up the batter and earns their **Momentum Bonus** (`+5`, `+3`, `+2`, or `+0`).

### Step 3: Roll the Dice (1 Die per Player)
* **Pitcher rolls:** The single attribute die matching their chosen color (`VEL`, `CMD`, or `MOV`) + Pitcher Momentum Bonus (if won).
* **Batter rolls:** The single attribute die matching their chosen color (`POW`, `EYE`, or `CON`) + Batter Momentum Bonus (if won).
* Apply any flat modifiers from activated Special Abilities (`+2` or `+3`).

### Step 4: Calculate Margin & Resolve
$$\text{Margin} = (\text{Pitcher Total}) - (\text{Batter Total})$$
Look up the Margin on the **Universal At-Bat Outcome Table** according to the **Batter's Chosen Approach Color**.

---

## 4. Universal At-Bat Outcome Table

The central table is universal and fixed. There are no player exceptions on this chart:

| Margin | 🔴 Red (Power Swing) | 🟢 Green (Contact Swing) | 🔵 Blue (Eye / Take) |
| :---: | :--- | :--- | :--- |
| **$\ge +2$** | **STRIKEOUT (K)** *(Whiff)* | **ROUTINE OUT** *(K-Protected)* | **ROUTINE OUT** |
| **$+1 \dots 0$**| **ROUTINE OUT** | **ROUTINE OUT** | **ROUTINE OUT** |
| **$-1$** | **SAC OUT** *(R3 Scores!)* | **SAC OUT** *(R3 Scores!)* | **WALK (BB)** |
| **$-2$** | **WALK (BB)** | **WALK (BB)** | **WALK (BB)** |
| **$-3$** | **CLEAN SINGLE** | **CLEAN SINGLE** *(Capped 1B)* | **WALK (BB)** |
| **$-4$** | **CLEAN SINGLE** | **CLEAN SINGLE** *(Capped 1B)* | **CLEAN SINGLE** |
| **$\le -5$** | **EXTRA-BASE / HR** *(Roll `POW`)*| **CLEAN SINGLE** *(Capped 1B)* | **CLEAN SINGLE** |

### Extra-Base Hit Resolution (Margin $\le -5$ on 🔴 Red Power)
When a Power Swing beats the pitch by 5 or more, roll the batter's **`POW` die**:
* **`1 to 5`:** **DOUBLE (2B)** — Runners on 2nd and 3rd score; runner on 1st advances to 3rd.
* **`6`:** **TRIPLE (3B)** — All baserunners score; batter to 3rd base.
* **`7 or higher`:** **HOME RUN (HR)** — Batter and all baserunners score! *(Requires `d8`, `d10`, or `d12` `POW` unless boosted by a Locked-In state or ability).*

### Baserunner Speed Option (Singles)
When a Clean Single is hit with a runner on **2nd base**:
* **Hold at 3rd:** Runner advances safely to 3rd (no risk).
* **Send Home:** Roll the runner's **Speed (`SPD`) die**:
  * **`4+`:** **SAFE AT HOME!** Runner scores (+1 Run).
  * **`1–3`:** **OUT AT THE PLATE!** Runner is thrown out (+1 Out).

---

## 5. Inverted Momentum Ladders, Surges & Locked In Status

The Momentum Ladder is **Inverted: High on the Left, Low on the Right**, creating a natural intuitive physical progression where climbing toward peak flow slides leftward into the fiery red Level 3 slot, while fatigue drops rightward toward grey exhaustion.

### The 4 Ladder Levels (Left to Right)
* **Level 3 (`L3 🔥`): LOCKED IN** (Far Left) — `+5` Momentum Bonus + Player Superpower Unlocked!
* **Level 2 (`L2 ★`): PRIME** (Middle-Left) — `+3` Momentum Bonus (Stars start here).
* **Level 1 (`L1`): READY** (Middle-Right) — `+2` Momentum Bonus (Role players start here).
* **Level 0 (`✕ EXH`): EXHAUSTED** (Far Right) — `+0` Bonus (Abilities locked; cannot spend fuel).

### Asymmetric Ladder Tiers Across the Roster
* **Superstars & Aces (4-Slot Ladder):** `[L3 🔥 (+5)] ← [L2 ★ (+3)] ← [L1 (+2)] ← [✕ EXH (+0)]` *(Starts at L2, can surge LEFT into Locked In!)*
* **Everyday Starters (3-Slot Ladder):** `[L2 ★ (+3)] ← [L1 (+2)] ← [✕ EXH (+0)]` *(Starts at L2 or L1, max L2).*
* **Role Players & Underdogs (2-Slot Ladder):** `[L1 ★ (+2)] ← [✕ EXH (+0)]` *(Starts at L1, one-shot fuel).*

### How Surges Work (Printed on Each Player Card)
A **`⚡ SURGE`** occurs immediately when a player executes their signature strength during play:
* If the player is currently below their maximum ladder box, **slide their wooden cube one slot to the LEFT** (toward Level 3 🔥).
* **Hitting Level 3 (`L3 🔥`):** When a Tier-1 superstar surges while already at Level 2, they achieve **LOCKED IN 🔥** status!
* **Spending Fuel / Fatigue:** Activating a Special Ability slides the cube **one slot to the RIGHT** (toward Exhaustion). A Locked In player who spends fuel drops rightward to Level 2 (Prime), remaining dangerous.

---

## 5.1 Component Standards: Half-Size Cards & 11x17 Playmats

* **Half-Size Player Cards (1.82" × 2.52" Mini Cards):** All 30 players and reference cards are formatted as half-size mini cards, allowing entire 15-player team rosters to fit on a single 8.5" × 11" printable sheet.
* **11×17 Playmat with 9-Card Lineup Tray:** Each team has a dedicated 11" × 17" Manager Playmat. Across the entire bottom edge sits a 9-slot batting order track where all 9 half-size player cards line up side-by-side in batting order!
* **2-Sheet Easy Home Printing:** Each 11" × 17" playmat is split into two standard 8.5" × 11" Letter sheets (Left Half & Right Half) with overlap alignment marks (`✛`), allowing any standard home printer to produce full-size 11" × 17" tournament-grade playmats with zero trimming hassle.

---

## 6. Pitcher Fatigue & Bullpen Management

Pitchers face realistic baseball fatigue governed by **Times Through the Order (TTO)** and bullpen stamina:

1. **Times Through the Order (Starting Pitchers):**
   * Starters begin at their printed Level (Aces at `L2`).
   * **2nd Time Facing Opposing #1 Leadoff:** The starter drops **1 Level** (`L2 → L1`).
   * **3rd Time Facing Opposing #1 Leadoff:** The starter drops **1 Level** (`L1 → Exhausted`).
   * **High-Stress Rally:** If a starter allows 3+ runs in a single half-inning, they immediately drop 1 Level.
2. **Bullpen Relievers (`RP` & `CL`):**
   * Relievers enter the game fresh at their printed Level (Setup relievers at `L1` or `L2`, Closers at `L2`).
   * **Single-Inning Stamina:** Relievers are maximum-effort arms. If a reliever remains on the mound for a **second inning**, they drop **1 Level** at the start of that inning.

---

### The Economy of Amplified Abilities
Because spending 1 Momentum level drops a player down the ladder (`L3 → L2` loses 2 momentum bonus; `L1 → EXH` loses 2 momentum bonus), **Special Abilities are high-impact and game-changing**. 

Rather than weak `+2` nudges, abilities deliver **massive leverage**:
1. **Commanding Roll Swings (+4 to +5):** Net gain of +3 to +4 even after paying fuel.
2. **Explosive Bonus Dice (+d10, +d8, or Double Dice Sums):** Creates unpredictable, clutch surges.
3. **Outcome Bending:** Complete strikeout immunity, guaranteed double plays, automatic intentional walks, or instant Home Runs!

---

## 7. Official Team Rosters

### Team 1: The Metro Titans
* **SP "Apex" Garrison (Ace • 4-Box Ladder • Starts L2):** 🔴 VEL d12 • 🔵 CMD d6 • 🟢 MOV d8
  * `⚡ SURGE:` On Strikeout with Margin $\ge +3$.
  * `🔥 LOCKED IN:` Opponents rolling Red Power against his fastball roll with Disadvantage (roll 2 dice, take lower).
  * `★ ABILITY (1 Lvl):` *102 MPH Heat* — Pitch die automatically counts as Maximum (12 on d12) + Batter rolls with Disadvantage!
* **SP "Brick" Kowalski (Sinker SP • 3-Box Ladder • Starts L2):** 🔴 VEL d8 • 🔵 CMD d8 • 🟢 MOV d10
  * `⚡ SURGE:` When inducing a Sac/Fielded Groundout.
  * `★ ABILITY (1 Lvl):` *Twin-Killer Sinker* — Margin 0 or higher immediately triggers an instant 6-4-3 DOUBLE PLAY (records 2 outs) and holds all baserunners!
* **SP Dakota Ridge (Workhorse SP • 2-Box Ladder • Starts L1):** 🔴 VEL d6 • 🔵 CMD d8 • 🟢 MOV d6
  * `★ ABILITY (1 Lvl):` *Inning Eater* — Add +5 to pitch roll; wipes batter's Momentum bonus to +0 this at-bat!
* **RP Tyler Miller (Fireman RP • 2-Box Ladder • Starts L1):** 🔴 VEL d10 • 🔵 CMD d4 • 🟢 MOV d8
  * `⚡ SURGE:` On any Strikeout (K).
  * `★ ABILITY (1 Lvl):` *Flamethrower Smoke* — Add +5 to pitch roll; if batter chose Red Power, they automatically strike out swinging!
* **RP Alexis Diaz (Electric RP • 2-Box Ladder • Starts L1):** 🔴 VEL d6 • 🔵 CMD d8 • 🟢 MOV d8
  * `⚡ SURGE:` On inducing a soft popout.
  * `★ ABILITY (1 Lvl):` *Wicked Wipeout* — Pitch die counts as Maximum (8 on d8) and completely strips the batter of their Momentum bonus!
* **CL Josh Hader (Shutdown Closer • 4-Box Ladder • Starts L2):** 🔴 VEL d12 • 🔵 CMD d4 • 🟢 MOV d8
  * `⚡ SURGE:` On Game-Ending Out or Strikeout.
  * `🔥 LOCKED IN:` Flamethrower heat: Adds +3 to pitch roll on every pitch.
  * `★ ABILITY (1 Lvl):` *Lights Out* — Auto-claim Momentum (+5) AND add +4 to pitch roll; any out recorded is a Strikeout!
* **CF Axel Mercer (Speed Demon • 2-Box Ladder • Starts L1):** 🔴 POW d6 • 🔵 CON d10 • 🟢 EYE d10 • 🏃 SPD 5
  * `⚡ SURGE:` On Single + Stolen Base.
  * `★ ABILITY (1 Lvl):` *Lightning Leap* — Add +4 to roll; on any ball in play (hit or fielder's choice), advances +2 extra bases and automatically steals next base!
* **2B Lucas Vance (Pure Barrel • 4-Box Ladder • Starts L2):** 🔴 POW d10 • 🔵 CON d10 • 🟢 EYE d8 • 🏃 SPD 3
  * `⚡ SURGE:` On Clean Barrel Single (Margin -4 to -6).
  * `🔥 LOCKED IN:` Any Strikeout becomes a Routine Out.
  * `★ ABILITY (1 Lvl):` *Strikeout Shield* — Zero Strikeouts: Cannot strike out this at-bat! Margin > 0 becomes a Sac (0); any hit is an automatic Double (2B)!
* **3B Marcus Reyes (Clutch Drive • 4-Box Ladder • Starts L2):** 🔴 POW d8 • 🔵 CON d10 • 🟢 EYE d8 • 🏃 SPD 3
  * `⚡ SURGE:` On Extra-Base Hit or RBI.
  * `🔥 LOCKED IN:` Adds +2 to Batter total roll on all at-bats.
  * `★ ABILITY (1 Lvl):` *Grand Slammer* — Add +5 to roll with runners in scoring position; all baserunners score!
* **1B Rex Stone (Colossus Power • 4-Box Ladder • Starts L2):** 🔴 POW d12 • 🔵 CON d6 • 🟢 EYE d4 • 🏃 SPD 2
  * `⚡ SURGE:` On any Home Run (HR).
  * `🔥 LOCKED IN:` Crush — Roll 2 dice on POW, choose higher.
  * `★ ABILITY (1 Lvl):` *Grand Sledgehammer* — Add +5 to roll; on ANY hit (Margin -4 or less), it is an automatic 450-foot HOME RUN!
* **RF Duke Cole (Hot Corner • 3-Box Ladder • Starts L2):** 🔴 POW d8 • 🔵 CON d8 • 🟢 EYE d6 • 🏃 SPD 3
  * `⚡ SURGE:` On RBI or Line Drive.
  * `★ ABILITY (1 Lvl):` *Scorching Liner* — Add +4 to roll; any hit clears the bases!
* **DH Silas Dan (Gritty Veteran • 2-Box Ladder • Starts L1):** 🔴 POW d6 • 🔵 CON d8 • 🟢 EYE d6 • 🏃 SPD 3
  * `⚡ SURGE:` On Gritty 2-Strike Contact.
  * `★ ABILITY (1 Lvl):` *Count Battle* — Add +4 to roll; any Margin +1 to +3 is fouled off, letting you redraw and re-roll with fresh momentum!
* **SS Bryan Chen (Gap Spark • 2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 CON d8 • 🟢 EYE d6 • 🏃 SPD 4
  * `⚡ SURGE:` On Infield Single or Bunt.
  * `★ ABILITY (1 Lvl):` *Suicide Squeeze* — Add +4 to roll; bunts to score runner from 3rd base guaranteed!
* **C "Iron" Pete (Defensive Anchor • 2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 CON d6 • 🟢 EYE d4 • 🏃 SPD 2
  * `⚡ SURGE:` On Sac/Fielded Groundout (0).
  * `★ ABILITY (1 Lvl):` *Iron Wall Framing* — While catching, adds +3 to all pitch rolls. At bat: guaranteed Sacrifice Fly driving in runner on 3rd!
* **LF Eli Vance (Underdog • 2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 CON d4 • 🟢 EYE d4 • 🏃 SPD 3
  * `⚡ SURGE:` On any Walk (BB) or Hit.
  * `★ ABILITY (1 Lvl):` *Miracle Spark* — Roll an explosive +d10 bonus die added directly to your roll!

---

### Team 2: The Crimson Serpents
* **SP "Professor" Webb (Ace • 4-Box Ladder • Starts L2):** 🔴 VEL d6 • 🔵 CMD d12 • 🟢 MOV d10
  * `⚡ SURGE:` On Inducing Groundout on Green.
  * `🔥 LOCKED IN:` Sinkers drop: Margin 0 becomes Strikeout Looking.
  * `★ ABILITY (1 Lvl):` *The Painted Abyss* — Completely wipes batter's Momentum to +0; Margin 0 and -1 become Strikeout Looking!
* **SP "Ghost" Strider (Power SP • 4-Box Ladder • Starts L2):** 🔴 VEL d8 • 🔵 CMD d8 • 🟢 MOV d8
  * `⚡ SURGE:` On any Strikeout (K).
  * `🔥 LOCKED IN:` Tunneling: Pitcher adds +2 to roll on stance match.
  * `★ ABILITY (1 Lvl):` *Quad-Drive Heat* — Roll pitch die + bonus +d8; if total roll $\ge 14$, instant swinging Strikeout!
* **SP Logan Webb (Groundball SP • 2-Box Ladder • Starts L1):** 🔴 VEL d6 • 🔵 CMD d10 • 🟢 MOV d6
  * `⚡ SURGE:` When inducing a Double Play.
  * `★ ABILITY (1 Lvl):` *Veteran Trap* — Add +4 to pitch roll; downgrade ANY hit (even a Home Run) to a soft Single!
* **RP Spencer Strider (Rising RP • 2-Box Ladder • Starts L1):** 🔴 VEL d8 • 🔵 CMD d6 • 🟢 MOV d10
  * `⚡ SURGE:` On Strikeout with Margin $\ge +3$.
  * `★ ABILITY (1 Lvl):` *High Strike Fog* — Add +5 to pitch roll; batter rolls with Disadvantage!
* **RP Felix Bautista (Mountain RP • 2-Box Ladder • Starts L1):** 🔴 VEL d6 • 🔵 CMD d10 • 🟢 MOV d6
  * `⚡ SURGE:` On 1-2-3 Relief Inning.
  * `★ ABILITY (1 Lvl):` *The Mountain* — Red Power swings are totally negated; add +5 to pitch roll!
* **CL Emmanuel Clase (Cutter CL • 4-Box Ladder • Starts L2):** 🔴 VEL d8 • 🔵 CMD d8 • 🟢 MOV d12
  * `⚡ SURGE:` On 3-Pitch Strikeout or Save.
  * `🔥 LOCKED IN:` Cutter bite: Opponents roll Contact with Disadvantage.
  * `★ ABILITY (1 Lvl):` *101 MPH Cutter* — Batter subtracts -3 from their roll; on any ball in play, forces a routine groundout!
* **LF Juan Soto (Eagle Eye • 4-Box Ladder • Starts L2):** 🔴 POW d6 • 🔵 CON d10 • 🟢 EYE d12 • 🏃 SPD 4
  * `⚡ SURGE:` On any Walk (BB) on Eye.
  * `🔥 LOCKED IN:` Opponents cannot use Command to reduce walks.
  * `★ ABILITY (1 Lvl):` *The Soto Shuffle* — Zone mastery: Draw an automatic Walk (BB) on any Margin between -1 and +2 (steals pitcher's weak outs)!
* **DH Elly Cruz (5-Tool Phenomenon • 4-Box Ladder • Starts L2):** 🔴 POW d10 • 🔵 CON d10 • 🟢 EYE d10 • 🏃 SPD 5
  * `⚡ SURGE:` On any Stolen Base or HR.
  * `🔥 LOCKED IN:` Auto-wins approach guess on 1st pitch.
  * `★ ABILITY (1 Lvl):` *Apex Predator* — Auto-win stance guess, claim Momentum (+5), and automatically steal Home on any ball in play!
* **SS Gunnar Henderson (Gap Hunter • 4-Box Ladder • Starts L2):** 🔴 POW d8 • 🔵 CON d10 • 🟢 EYE d8 • 🏃 SPD 4
  * `⚡ SURGE:` On Clean Single or Double.
  * `🔥 LOCKED IN:` Adds +2 to Batter total roll on all at-bats.
  * `★ ABILITY (1 Lvl):` *Gap Executioner* — Add +4 to roll; ANY hit is upgraded to a bases-clearing Stand-up Double!
* **1B Bryce Harper (Showtime • 4-Box Ladder • Starts L2):** 🔴 POW d10 • 🔵 CON d8 • 🟢 EYE d8 • 🏃 SPD 3
  * `⚡ SURGE:` On Extra-Base Hit or HR.
  * `🔥 LOCKED IN:` Rolls 2 dice on Power, takes higher.
  * `★ ABILITY (1 Lvl):` *Showtime Blast* — Roll 2 Power dice and ADD them together; on Margin $\le -4$, instant upper-deck Home Run!
* **3B Manny Machado (Line Drive • 3-Box Ladder • Starts L2):** 🔴 POW d8 • 🔵 CON d8 • 🟢 EYE d6 • 🏃 SPD 3
  * `⚡ SURGE:` On Hard Line Drive Single.
  * `★ ABILITY (1 Lvl):` *Laser Beam* — Add +4 to roll; line drive scores runner from 1st base!
* **2B Francisco Lindor (Mr. Smile • 3-Box Ladder • Starts L1):** 🔴 POW d6 • 🔵 CON d8 • 🟢 EYE d6 • 🏃 SPD 4
  * `⚡ SURGE:` On inducing 2-Strike Foul/Hit.
  * `★ ABILITY (1 Lvl):` *Switch-Hit Maestro* — Pitch peeking: Peek at pitcher's chosen stance BEFORE picking your own stance!
* **CF Nico Hoerner (Bat Control • 3-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 CON d10 • 🟢 EYE d6 • 🏃 SPD 4
  * `⚡ SURGE:` On 2-Strike Contact Single.
  * `★ ABILITY (1 Lvl):` *Contact Machine* — Strikeouts impossible: Add +4 to roll & reroll die to guarantee putting ball in play!
* **C Austin Hedges (Elite Framing • 2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 CON d6 • 🟢 EYE d6 • 🏃 SPD 2
  * `⚡ SURGE:` On Catcher Framing / Strikeout.
  * `★ ABILITY (1 Lvl):` *Laser Back-Pick* — Back-pick any lead runner for an immediate OUT, or add +4 to Pitcher's Command roll!
* **RF Leo "The Spark" (Pure Hustle • 2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 CON d4 • 🟢 EYE d4 • 🏃 SPD 4
  * `⚡ SURGE:` On reaching base via Walk or Hit.
  * `★ ABILITY (1 Lvl):` *Chaos on the Paths* — Roll an explosive +d10 bonus die; on contact, defense must roll d6 $\ge 4$ or commit a 2-base throwing error!
* **RP "Submarine" Skenes (Setup RP • 3-Box Ladder • Starts L2):** 🔴 VEL d8 • 🔵 CMD d6 • 🟢 MOV d10
  * `⚡ SURGE:` Induces a Fielded/Sac Out.
  * `★ ABILITY (1 Lvl):` *Rising Slider* — +2 to roll.
* **RP "Icebox" Keller (Middle RP • 2-Box Ladder • Starts L1):** 🔴 VEL d6 • 🔵 CMD d10 • 🟢 MOV d6
  * `★ ABILITY (1 Lvl):` *Fireman* — +2 to roll.
* **CL Shohei "Viper" Cruz (Closer • 4-Box Ladder • Starts L2):** 🔴 VEL d8 • 🔵 CMD d8 • 🟢 MOV d12
  * `⚡ SURGE:` On any Strikeout.
  * `🔥 LOCKED IN:` Automatically claims the Momentum advantage for the remainder of the inning.
  * `★ ABILITY (1 Lvl):` *Nasty Bite* — +3 to pitch roll.
* **LF "Professor" Soto (4-Box Ladder • Starts L2):** 🔴 POW d6 • 🔵 EYE d12 • 🟢 CON d10 • 🏃 SPD d8
  * `⚡ SURGE:` Draws a Walk on a 🔵 Blue Eye card.
  * `🔥 LOCKED IN:` Completely immune to Strikeouts; matches against Blue automatically result in a Walk or Single.
  * `★ ABILITY (1 Lvl):` *Eagle Eye* — +2 to roll; draws Walk on Margin 0 to -3.
* **DH Shohei "Viper" Cruz (4-Box Ladder • Starts L2):** 🔴 POW d10 • 🔵 EYE d10 • 🟢 CON d10 • 🏃 SPD d10
  * `⚡ SURGE:` Hits an Extra-Base Hit or 2-out RBI hit.
  * `🔥 LOCKED IN:` Automatically claims the Momentum advantage on every at-bat.
  * `★ ABILITY (1 Lvl):` *Five-Tool Genius* — Automatically wins the Pitch Read.
* **SS Gunnar Henderson (4-Box Ladder • Starts L2):** 🔴 POW d8 • 🔵 EYE d8 • 🟢 CON d10 • 🏃 SPD d8
  * `⚡ SURGE:` Hits a Double or Triple.
  * `🔥 LOCKED IN:` All Clean Singles are automatically upgraded into Doubles.
  * `★ ABILITY (1 Lvl):` *Gap Hunter* — +2 to roll; upgrades Clean Single to Double.
* **1B Bryce Harper (4-Box Ladder • Starts L2):** 🔴 POW d10 • 🔵 EYE d8 • 🟢 CON d8 • 🏃 SPD d6
  * `⚡ SURGE:` Hits a Home Run or extra-base hit.
  * `🔥 LOCKED IN:` Showtime — Adds +4 to all rolls; HR on `POW 6+`.
  * `★ ABILITY (1 Lvl):` *Showtime* — +3 to roll.
* **3B Manny Machado (3-Box Ladder • Starts L1):** 🔴 POW d8 • 🔵 EYE d6 • 🟢 CON d8 • 🏃 SPD d6
  * `⚡ SURGE:` Drives in an RBI with RISP.
  * `★ ABILITY (1 Lvl):` *Line Drive* — +2 to roll.
* **CF Francisco Lindor (3-Box Ladder • Starts L1):** 🔴 POW d6 • 🔵 EYE d6 • 🟢 CON d8 • 🏃 SPD d8
  * `⚡ SURGE:` Hits a Single and advances on Speed roll.
  * `★ ABILITY (1 Lvl):` *Mr. Smile* — +2 to roll.
* **2B Nico Hoerner (3-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 EYE d6 • 🟢 CON d10 • 🏃 SPD d8
  * `⚡ SURGE:` Hits a Contact Single on a 🟢 Green card.
  * `★ ABILITY (1 Lvl):` *Bat Control* — Reroll contact die and keep higher result.
* **C Austin Hedges (2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 EYE d6 • 🟢 CON d6 • 🏃 SPD d4
  * `★ ABILITY (1 Lvl):` *Veteran Eye* — +2 to roll.
* **RF Leo "The Spark" (2-Box Ladder • Starts L1):** 🔴 POW d4 • 🔵 EYE d4 • 🟢 CON d4 • 🏃 SPD d8
  * `★ ABILITY (1 Lvl):` *Pure Hustle* — Roll an extra +d6 bonus die to your roll.
