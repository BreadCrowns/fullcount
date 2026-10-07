# Full Count — Developer Diary & Design Chronicle

> *"Baseball is ninety percent mental. The other half is physical."* — Yogi Berra  
> 
> This diary chronicles the design iterations, philosophical debates, technical breakthroughs, and discarded dead-ends in building **Full Count**: a tabletop-digital baseball confrontational card game.

---

## Design Philosophy

The driving ambition of *Full Count* has never been to build a spreadsheet simulation of baseball. It is to capture the visceral, high-stakes psychological chess match between a pitcher standing on the mound and a hitter digging into the batter's box.

Every pitch in baseball is a game of deduction, hand management, and execution:
- What does the count dictate?
- What is the pitcher's tendency in this spot?
- Does the batter sit on high heat or stay back for the breaking ball?
- Can you read the opponent's intent, and when you do, can you execute?

Here is how *Full Count* evolved from a cluttered 3-zone math puzzle into a clean, tense, deduction-first card duel.

---

## Entry 1: The First Pitch — The 3-Zone Prototype & Multiplayer Foundation
**Date**: September 30, 2026  
**Commits**: `dd6a5e4` → `9cb12ee`

### The Problem
We started with a blank canvas and a core question: *How do you simulate a plate appearance using cards without turning it into a 20-minute board game?*

Our earliest design took inspiration from modern card battlers. We created three distinct zones to resolve an at-bat:
1. **Zone 1 (The Pitch / Approach)**: Contest of intent and eye.
2. **Zone 2 (The Contact / Velocity)**: Contest of bat speed vs. fastball life.
3. **Zone 3 (The Batted Ball / Field)**: Contest of trajectory and defense.

We built this as a real-time 2-player web application backed by Firebase Realtime Database with 6-letter room codes, customizable rosters (starting pitchers, relievers, lineup batting orders), and 70 action cards loaded with counters, affinities, and modifiers.

### What Didn't Feel Right
In practice, the game suffered from severe cognitive overload:
- Players were asked to distribute up to 4 cards across 3 zones *simultaneously*.
- Cards had walls of rules text: cross-zone penalties, counter-conditions, and stamina modifiers.
- The UI was overflowing on screens; players spent more time reading small text on cards than looking at the scoreboard or thinking about what pitch was coming.
- It felt like an accounting spreadsheet rather than standing at home plate.

### The Fix
We immediately established strict layout boundaries, flex-box anchoring for mobile viewports, and began hunting for a cleaner model.

---

## Entry 2: Going Solo — The Practice Bot & Headless Test Suite
**Date**: October 4, 2026  
**Commits**: `6437f56` → `34e49bf`

### The Problem
Iterating on a 2-player multiplayer game is painfully slow if every test requires opening two browser windows, creating a room, copying a code, and playing against yourself. Furthermore, game balance was impossible to gauge without thousands of at-bats.

### Options Explored
1. *Local Hotseat*: Two players pass the phone. (Awkward, doesn't solve solo testing).
2. *Random Bot*: Bot plays completely random cards. (Fails to test real game scenarios or tactical edge cases).
3. *Autonomous Practice Bot with Repertoire Awareness*: A bot that plays role-specific cards, conserves pitching charges, and hunts scouting weaknesses.

### The Decision
We built the **Practice Bot 🤖** and integrated a 1-click **Solo Practice Match** directly on the lobby screen.
Simultaneously, we engineered a headless Chrome testing infrastructure:
- `run-tests.ps1`: Automated browser runner verifying card data, character attributes, zone math, and UI rendering.
- `run-sim.ps1`: A 10-game headless simulation harness executing ~300 plate appearances in under 5 seconds to generate statistical box scores, ERA, and batting averages.

This test harness became our safety net: from this point forward, every single rules tweak could be verified against a 10-game simulation in seconds.

---

## Entry 3: Breaking the Mold — From Simultaneous Dump to Sequential Beats
**Date**: October 4–5, 2026  
**Commits**: `8c5d6ac` → `79356f5`

### The Problem
Even with the Practice Bot, the core game loop had a fundamental pacing flaw: **the simultaneous card dump**. Both players placed all their cards across all zones at once, pressed "Lock In," and watched a barrage of numbers resolve.

In real baseball, a plate appearance is never resolved in one simultaneous burst. It unfolds in sequential beats:
1. The windup and the pitch establish the count.
2. The batter reacts, decides whether to commit, and starts the swing.
3. The collision determines the flight of the ball.

### Options Explored
- **Option A: The Gauge & Bell-Curve System**. We experimented with a numerical strike zone gauge where players tried to hit target sums (e.g., target 13, wild bust over 20) with inverse bell-curve distributions.
  - *Why it was discarded*: It felt artificial and mathematical. Real pitchers don't think about "tuning a dial to 13"; they think about throwing 98 mph up and in or dropping a curveball below the knees.
- **Option B: Sequential Multi-Beat Resolution**. Break the plate appearance into sequential chapters, where the outcome of the first phase changes the conditions of the second phase.

### The Decision
We discarded the gauge meters and committed to sequential phases:
- Tracked pitch repertoires with charges (Fastball: 4, Breaking: 3, Offspeed: 2).
- Introduced initiative: the loser of an early beat reveals their card first in the next beat, giving the leader tactical vision.

---

## Entry 4: The Crucible — The 2-Beat Engine & Hand Economy
**Date**: October 6, 2026 (Morning)  
**Commits**: `b36c98f` → `20cd06c`

### The Problem
Three beats still had too much filler. Beat 3 (resolving the batted ball) felt like rolling dice or re-adjudicating what Beat 2 had already decided. If a batter crushes a 95 mph fastball right down the middle, the outcome should belong to that collision, not an arbitrary post-contact phase.

Furthermore, hand sizes had ballooned to 6–8 cards, causing choice paralysis.

### The Solution: The 2-Beat Engine
We distilled the entire confrontation down to baseball's two sacred dramatic moments:

```mermaid
flowchart LR
    A["BEAT 1: The Count<br/>(Setup & Leverage)"] -->|"0-2 / 3-1 / 3-2"| B["BEAT 2: The Payoff Pitch<br/>(Deduction & Execution)"]
    B --> C["FINAL OUTCOME<br/>(K, Walk, Out, Hit, HR)"]
```

1. **Beat 1: The Count**
   - A single-card clash that decides leverage:
     - Pitcher wins $\rightarrow$ **0-2 Pitcher's Count** (Batter on defense).
     - Batter wins $\rightarrow$ **3-1 Hitter's Count** (Pitcher in danger).
     - Tie $\rightarrow$ **3-2 Full Count** (Even showdown).
2. **Beat 2: The Payoff Pitch**
   - The pitcher selects Pitch Type & Pitch Location.
   - The batter selects Swing Type & Anticipated Zone.
   - Both play a card to execute.
3. **The 5-Card Hand Economy**
   - Each PA starts with exactly 5 cards.
   - Players play exactly **1 card in Beat 1** and **1 card in Beat 2**.
   - After the PA, both players draw back up to 5.
   - Every single card gained enormous tactical significance: do you spend your best card to win the count in Beat 1, or save it to execute the payoff pitch in Beat 2?

We also introduced the **Public Scouting Report** for every batter (Hot Zone, Cold Zone, Favorite Pitch) so pitching strategy felt grounded in real tactical scouting.

---

## Entry 5: Stripping Away the Noise — Pure Number Cards & The Anticipation Factor
**Date**: October 6, 2026 (Midday)  
**Commits**: `c2c0e18` → `ed98a5b`

### The Problem
Even with the 2-Beat structure, cards still had legacy text, conditional triggers, and ability paragraphs. Players had to squint at their screens and read complex logic mid-turn.

Additionally, the moment of resolution felt abrupt. When both players locked in, the result instantly appeared with no buildup, robbing the game of the breath-holding tension that makes baseball thrilling.

### The Solution: Pure Numbers (1–10)
We stripped all 70 action cards down to **Pure Number Cards (Values 1–10)**.
- No ability text. No modifiers. No conditional triggers.
- Just clean, beautiful, bold numbers with crisp tactile styling.
- All game rules moved from card text into the core system mechanics.

### The Solution: Anticipation & Tiered Count Leverage
To bring the drama to life:
1. **The In-Between Beats Result Modal**: An animated suspense banner recapping who won Beat 1 and the established count (`0-2`, `3-1`, or `3-2`).
2. **Tiered Count Leverage**:
   - **Simple Win (Margin 1–3)**: Imposes an **Option Lockout** on the opponent:
     - `0-2 Count`: Batter's **Power Swing** is locked out (forced into survival contact).
     - `3-1 Count`: Pitcher's **Offspeed Pitch** is locked out (forced to challenge with heat or break).
   - **Dominant Win (Margin $\ge 4$)**: Imposes Option Lockout PLUS **Forced Face-Up Reveal**! The loser must commit and expose their card face-up first; the winner counters with open eyes.

---

## Entry 6: The Deduction Heart — Aligning Outcomes with Deduction
**Date**: October 6, 2026 (Afternoon)  
**Commit**: `dec138a`

### The Problem
During playtesting, a critical design dissonance emerged. The user pointed out:
> *"The outcome of the ab doesn't feel right. Let's think through it some more. Because it's a game of deduction, the primary driver of the result should be the location and pitch type match. If the batter guessed correctly and executed a good swing, then ultimately the result should be in their favor. But if they guessed incorrectly, even if they executed a good swing, it should favor the pitcher."*

Under the prior system, if a batter guessed completely wrong (looked high fastball, pitcher threw low curve), but played a higher raw number card, they could still get a ringing hit. That betrayed the core promise of the game: **deduction must matter more than raw number supremacy**.

### The Solution: The Deduction Hierarchy
We codified three strict Match Tiers:
- **Full Match**: Batter correctly read **both** Pitch Type and Location. The batter holds supreme advantage; good card execution yields extra-base hits or home runs.
- **Partial Match**: Batter read **one** of the two (e.g., timed the fastball, but missed the location). Duel is contested; card execution decides whether pitcher or batter wins.
- **Whiff**: Batter guessed **neither** pitch nor location. The batter was completely fooled. Even if the batter played a powerful card, the result is capped at weak flyouts or popouts, heavily favoring the pitcher.

---

## Entry 7: The Grand Unification — Overlapping Ranges and the Timing Delta
**Date**: October 6, 2026 (Evening)  
**Commit**: `f04f6d2`

### The Problem: The "Mistimed" Trap & The "High Card Always Wins" Trap
As we refined Beat 2, the user identified a deep logical contradiction:
> *"What does a result of mistimed mean? Why would a player ever play a swing and card combination where the card is less than the difficulty? This same logic applies to the pitcher choice. How can we address that too?"*

In the previous system, pitches and swings had flat execution difficulties (e.g., Fastball required $\ge 3$, Power required $\ge 8$).
- If a player had a card lower than 8, playing Power was an objectively terrible self-sabotaging mistake ("mistimed").
- If we simply made "highest card wins," the game degenerated into always hoarding and playing 10s. Low cards (1, 2) became useless garbage in the hand.

The user then proposed a revolutionary concept:
> *"Here's another idea, what if the number range associated with a pitch are not exclusive. So an offspeed is 1-5, a breaking ball is 3-7, etc. What does that unlock? So is the outcome determined by the delta between the cards then?"*

### The Architectural Breakthrough: Overlapping Ranges + Timing Delta ($\Delta$)

```
PITCHES:
Offspeed (Touch & Deception):    [ 1 ─── 2 ─── 3 ─── 4 ─── 5 ]
Breaking (Bite & Spin):                  [ 3 ─── 4 ─── 5 ─── 6 ─── 7 ]
Fastball (Velocity & Heat):                              [ 6 ─── 7 ─── 8 ─── 9 ─── 10 ]

SWINGS:
Contact (Choke Up / Wait Back):  [ 1 ─── 2 ─── 3 ─── 4 ─── 5 ]
Balanced (Controlled Timing):            [ 3 ─── 4 ─── 5 ─── 6 ─── 7 ]
Power (Turn on the Ball):                                [ 6 ─── 7 ─── 8 ─── 9 ─── 10 ]
```

#### Why Overlapping Ranges Work
1. **Every Number Has a Vital Purpose**: Low cards (1, 2) are no longer junk—they are elite weapons to throw unhittable changeups or choke up on defense.
2. **Pitch Tunneling**: Cards 3–5 can be either an Offspeed pitch or a Breaking ball. Cards 6–7 can be either a Breaking ball or a Fastball. Even when a dominant Beat 1 forces a pitcher to reveal a card face-up (e.g. Card 4), the batter still does not know if it is an offspeed fading away or a breaking ball snapping down!

#### The Timing Delta Formula
The collision is governed by the timing difference between pitcher and batter:
$$\Delta = | \text{Pitcher Card} - \text{Batter Card} |$$

| Timing Delta | Quality | Description | Collision Effect |
| :---: | :---: | :---: | :--- |
| **$\Delta = 0$** | **Squared Up** 🎯 | Sweet Spot Barrel | Punishes mistake pitches; transforms full deduction into crushed Home Runs. |
| **$\Delta \le 2$** | **Solid Timing** 🏏 | Clean Contact | Sharp line drives, gap doubles, or flyouts depending on location read. |
| **$\Delta \le 4$** | **Off-Balance** 🧤 | Weak Contact | Choked-up defensive singles, routine grounders, or infield popouts. |
| **$\Delta \ge 5$** | **Mistimed Whiff** ⚡ | Way Off | Swinging strikeout on nasty stuff unless protected by a defensive contact swing. |

### The Genius of Timing Delta
If a pitcher throws a dirty 2 Offspeed changeup and the batter swings out of their shoes with a 10 Power card:
$$\Delta = |2 - 10| = 8$$
The batter is caught way out in front—**an ugly swinging strikeout**!
Playing the highest card no longer guarantees a win. You must match the timing of the pitch you are hunting.

---

## Current Status & Verification Baseline
As of Commit `f04f6d2`:
- **Automated Tests**: 121 browser-automated unit tests pass with zero failures (`tests/test_resolution.html`, `tests/test_play_ui.html`).
- **Game Simulation**: 10-game automated simulation (`run-sim.ps1`) confirms realistic baseball metrics: 3.50 runs/game, extra-inning drama, and a 50/50 balance between home and away.
- **Repository State**: Clean working tree on `main` branch.

---

## Living Changelog Protocol
> **From this point forward**, every code modification, rules tweak, or balance adjustment will conclude with an appended entry in this diary documenting:
> 1. The specific problem being addressed.
> 2. The options explored and trade-offs weighed.
> 3. The decision and technical implementation.
> 4. Verification test results and simulation impact.

---

## Entry 8: Streamlining the Duel — Removing Location to Focus on Pitch & Timing

### The Problem: Cognitive Overload & Decision Fatigue in Beat 2
Following the implementation of overlapping timing ranges, the game gained immense strategic depth. A card of value 4 was no longer just "4 points"—it was the snap of a sweeping slider or the fading tumble of a changeup.

However, this mechanical depth immediately exposed an interface and cognitive flaw. The user observed:
> *"The pitch selection needs to be simpler now that we've implemented the overlapping pitches. I want to pick a pitch type and a number card. Choosing location is too much."*

In the previous design, resolving Beat 2 required an overwhelming number of concurrent decisions:
- **Pitcher**: Pick Pitch Type (`fastball`, `breaking`, `offspeed`) + Pick Location (`high`, `low`) + Pick Number Card (1–10). *(3 selections)*
- **Batter**: Anticipate Pitch (`fastball`, `breaking`, `offspeed`) + Anticipate Location (`high`, `low`) + Choose Swing Approach (`contact`, `balanced`, `power`) + Pick Number Card (1–10). *(4 selections)*

For the batter, making four distinct choices on every single payoff pitch was exhausting. It diluted the psychological focus of the duel. Instead of asking the quintessential baseball question—*"Is he bringing the heater or dropping the curveball, and can I time it?"*—the player was bogged down in a 50/50 high/low coin toss that felt like mechanical clutter.

### Options Explored

1. **Option 1: Retain Location as a Passive Modifier or Trait Bonus**
   - *Concept*: Keep high/low location as an optional guess that provides a minor +1 timing forgiveness if guessed correctly.
   - *Why Rejected*: It would preserve the visual clutter and UI buttons without adding compelling gameplay. It would fail to solve the user's direct directive: *"Choosing location is too much."*

2. **Option 2: Tie Pitch Types to Fixed Zones**
   - *Concept*: Dictate that fastballs are always high and breaking balls are always low.
   - *Why Rejected*: Artificial and rigid. It eliminates agency without making the decision-making cleaner, and turns scouting reports into predictable scripts.

3. **Option 3 (Chosen): Eliminate Location Completely — Focus on Pitch Deduction & Timing Delta**
   - *Pitcher selects*: **Pitch Type** + **Number Card**.
   - *Batter selects*: **Anticipated Pitch** + **Swing Approach** + **Number Card**.
   - *Why it succeeds*:
     - **Purity of Deduction**: The batter either correctly reads the pitch type (`matched`) or is fooled (`whiff`).
     - **Intuitive Execution**: The pitch type dictates the required timing window (Offspeed [1–5], Breaking [3–7], Fastball [6–10]).
     - **Snappy UI**: The interface drops an entire section of tiles from both sides. The player can look at the count, pick their pitch/swing, tap a card, and lock in within seconds.

### Technical Implementation

1. **Resolution Engine (`js/resolution.js`)**:
   - Stripped `pitchLocation` and `targetZone` from `resolveBeat2`.
   - Deduction simplified to a crisp binary check:
     $$\text{pitchMatched} = (\text{effectiveGuessPitch} === \text{pitchType})$$
   - Resolution matrix streamlined:
     - **Pitch Anticipated**:
       - $\Delta = 0$ (Squared Up): Crushed Home Run on Power swing, gap double on Balanced, clean single on Contact.
       - $\Delta \le 2$ (Solid Timing): Wall-ball doubles, clean singles, or home runs if hunting the batter's favorite pitch (`scoutingReport.favoritePitch`).
       - $\Delta \le 4$ (Off-Balance): Protected by the correct pitch read; contact swings find holes for singles, power swings fly out to the warning track.
       - $\Delta \ge 5$ (Mistimed): Even with the pitch read, massive timing error leads to strikeouts on power swings.
     - **Fooled on Pitch (`whiff`)**:
       - Pitcher heavily favored!
       - $\Delta \le 2$: Weak contact only (popouts and routine grounders); barrel HRs are impossible when fooled.
       - $\Delta \ge 3$: Swinging strikeouts dominate unless the batter choked up on a defensive Contact swing.
   - Preserved `locationMatched: pitchMatched` and `sameLocation: pitchMatched` in return objects for backward compatibility.
   - Updated `resolveSequentialPA` and `executeBotPlayBeat` to remove all zone/location logic.

2. **User Interface (`js/app.js`)**:
   - Removed Section 2 Location selection tiles from `renderPitcherPayoffDeck` and `renderBatterPayoffDeck`.
   - Updated the Action Lock button subtext to display dynamic timing range validation (`✓ In Timing Range [min–max]` vs `⚠ Out of Range`).
   - Cleaned up the public scouting bar: replaced obsolete Hot/Cold zone chips with the Batter's Archetype style and their Favorite Pitch (`⭐ HUNTS: [PITCH]`), plus pitcher pitch timing brackets (`[6–10]`, `[3–7]`, `[1–5]`).
   - Streamlined the outcome overlay to display clear deduction badges: `🎯 PITCH ANTICIPATED` vs `❌ FOOLED ON PITCH`.

3. **Test Suites & Verification**:
   - Updated Section 13 of `tests/test_resolution.html` to validate all timing delta outcomes without location parameters.
   - Updated `tests/sim_games.html` and headless test runners.

### Verification Results
- **Automated Unit Tests**: 120 of 120 browser tests pass (`run-tests.ps1`).
- **Game Simulation**: 10-game simulation (`run-sim.ps1`) completed 260 PAs with realistic baseball totals (5.70 runs/game, 94 total hits, 5 home wins, 5 away wins).
- **Player Experience**: Beat 2 now feels electric, focused, and fast-paced. Pitcher and batter engage in an uncluttered mind game of pitch selection and timing execution.

---

## Entry 9: Total Duel Symmetry — Removing Swing Type for Pure Pitch Guessing

### The Problem: Asymmetry and Residual Redundancy in Beat 2
Even after eliminating high/low locations in Entry 8, an immediate player experience friction remained. The user pointed it out directly:
> *"Hold on, the batter is still choosing 3 things. That seems redundant and just as much cognitive overload as the pitching used to be. For now, lets remove swing type and only focus on guessing pitch type and timing card."*

The math of player actions was uneven:
- **Pitcher**: Pick Pitch Type (`fastball`, `breaking`, `offspeed`) + Pick Number Card (1–10). *(2 decisions)*
- **Batter**: Anticipate Pitch (`fastball`, `breaking`, `offspeed`) + Pick Swing Approach (`contact`, `balanced`, `power`) + Pick Number Card (1–10). *(3 decisions)*

Beyond the cognitive asymmetry, the swing approach was mechanically redundant with the overlapping pitch ranges. In Entry 7, we defined:
- **Offspeed**: [1–5] (Touch & Deception)
- **Breaking**: [3–7] (Bite & Spin)
- **Fastball**: [6–10] (Velocity & Heat)

If a batter was anticipating a **Fastball**, of course they were timing for the high-velocity 6–10 window! Forcing them to also click the "Power" button (which had the exact same 6–10 range) was completely superfluous button-clicking. If a batter was looking for an **Offspeed** changeup, forcing them to click "Contact" (1–5) was just as redundant.

### Options Explored

1. **Option 1: Retain Swing Type as an Automatic Background Setting**
   - *Concept*: Automatically set the swing approach based on the card value played (e.g. Card 8 auto-selects Power).
   - *Why Rejected*: Overcomplicates the internal model and creates hidden rules. If the card value and the pitch type already dictate the physics of the collision, there is no need for a third intermediary concept like "swing type."

2. **Option 2 (Chosen): Total Duel Symmetry — 2 Choices Each**
   - **Pitcher**:
     1. Choose Pitch Type (`fastball` [6–10], `breaking` [3–7], `offspeed` [1–5])
     2. Play Timing Card (1–10)
   - **Batter**:
     1. Anticipate Pitch Type (`fastball`, `breaking`, `offspeed`)
     2. Play Timing Card (1–10)
   - *Why it succeeds*:
     - **Intuitive Mental Model**: The batter is hunting a pitch. If they think heat is coming, they hunt Fastball [6–10] and try to match the pitcher's card value.
     - **Zero UI Clutter**: Both players look at a single row of 3 pitch tiles, see their target timing bracket, tap a card in their hand, and lock in.
     - **Pure Psychological Poker**: It's a direct mind game: *What pitch is coming, and what timing card are they throwing it with?*

### Technical Implementation

1. **Resolution Engine (`js/resolution.js`)**:
   - `resolveBeat2`: Removed dependencies on `swingType`.
   - The batter's target timing range is now directly the range of the pitch they anticipated:
     $$\text{bRange} = \text{PITCH\_RANGES}[\text{effectiveGuessPitch}]$$
     $$\text{batterExecuted} = (\text{bCardVal} \ge \text{bRange.min} \land \text{bCardVal} \le \text{bRange.max})$$
   - Outcome matrix refactored around natural baseball contact physics, batter archetypes, and count leverage:
     - **Pitch Anticipated (`pitchMatched === true`)**:
       - **$\Delta = 0$ (Squared Up Barrel 🎯)**:
         - On 0-2 Count (Two Strikes): Batter protects plate; capped at Double (`⚡ CLUTCH DOUBLE OFF THE WALL (TWO-STRIKE BARREL)!`).
         - Favorite Pitch read: Crushed Home Run (`💥 CRUSHED MOONSHOT HOME RUN (FAVORITE PITCH BARRELED)!`).
         - Slugger archetype on Fastball / Card $\ge 7$: Home Run (`💥 NO-DOUBTER HOME RUN!`).
         - High fastball barrel (Card $\ge 9$): Home Run (`💥 CRUSHED HOME RUN OVER THE WALL!`).
         - Otherwise: Gap Double (`⚡ ROCKET DOUBLE INTO THE GAP!`).
       - **$\Delta \le 2$ (Solid Timing 🏏)**:
         - Pitcher mistake (`!pitcherExecuted` hanger): Punished for Home Run or Wall-Ball Double.
         - Favorite Pitch read: Home Run (Sluggers) or Double.
         - $\Delta = 1$: Clean Line Drive Single.
         - $\Delta = 2$: Solid contact, but against well-executed pitches: Single on 3-1 count; otherwise sharp well-hit outs (Lineout or Hard Groundout).
       - **$\Delta \le 4$ (Off-Balance Contact 🧤)**:
         - On 3-1 count: Bloop Single.
         - Contact Hitter / Speed Specialist: Infield Chopper Single.
         - Otherwise: Routine Groundout or Flyout.
       - **$\Delta \ge 5$ (Badly Mistimed ⚡)**:
         - On 3-1 count: Walk (Ball Four).
         - Otherwise: Swinging Strikeout.
     - **Fooled on Pitch (`whiff`)**:
       - $\Delta \le 2$: Fluke contact capped at popouts and routine groundouts.
       - $\Delta \ge 3$: Swinging strikeouts dominate (unless protected by a 3-1 walk or contact-hitter groundout).
   - Bot AI (`executeBotPlayBeat`):
     - Bot batter now chooses their pitch guess and timing card directly, with full pitch randomization when charge pools empty to prevent stale pitching loops.

2. **User Interface (`js/app.js`)**:
   - `renderBatterPayoffDeck`: Section 2 (Swing Approach) completely deleted. The deck now features:
     1. **Anticipate Pitch**: Fastball [6–10], Breaking [3–7], Offspeed [1–5].
     2. **Timing & Range Feedback Bar**: Dynamic live readout (`Looking FASTBALL: Target Timing 6–10` &bull; `🟢 IN RANGE [Card 8]`).
   - Action lock button subtext updated: `LOOKING [PITCH] &bull; Card [X] ✓ In Timing Range`.
   - `renderZoneBoard`: Simplified the revealed clash recap card to display `LOOKING [PITCH]` without swing type text.
   - `renderOutcomeOverlay`: Streamlined at-bat outcome recap to show `Looking [PITCH] [Card X]`.
   - `commitPlacement`: Both human and bot batter payloads streamlined to `{ guessPitch, cardId }`.

3. **Test Suites & Verification**:
   - `tests/test_resolution.html`: Updated Section 13 and Section 16 simulation loop to eliminate `swingType` arguments and verify the streamlined duel.
   - `tests/sim_games.html`: Updated 10-game simulation runner.

### Verification Results
- **Automated Unit Tests**: 119 of 119 browser tests pass (`run-tests.ps1`).
- **Game Simulation**: 10-game headless simulation (`run-sim.ps1`) executed 322 PAs across 10 completed games with an average of 8.00 runs/game, 122 total hits, 6 home wins, 4 away wins, and zero runaway innings.
- **Player Experience**: Perfect symmetry has been achieved. Both pitcher and batter now make exactly two decisions per payoff pitch: **Pitch Type** and **Timing Card**. The game is fast, intuitive, and razor-sharp.

---

## Entry 10: Unfreezing the Dominant Duel — Resolving the Beat 1 Result Modal Lockup

### The Bug Report
During playtesting of the new streamlined 2-choice duel, an immediate roadblock surfaced:
> *"I had a dominant beat 1 and the game froze in the results pop-up."*

When a player achieved a dominant Beat 1 Count victory ($\Delta \ge 5$, establishing an 0-2 Pitcher's Count or 3-1 Hitter's Count), the "BEAT 1 RESULT • THE COUNT" modal appeared as designed. However, clicking **"Continue to Payoff Pitch →"** did nothing. The button remained unresponsive, and the game remained completely stuck on the results pop-up.

---

### Root Cause Analysis: The Ghost of Deprecated Fields in Firebase Updates

To preserve the asymmetry of dominant count victories, the game engine requires the disadvantaged player to commit their Beat 2 execution card **face-up first**. In solo play, when the human player achieves a dominant win (e.g. pitching a 10 vs. a 2, or batting a 9 vs. a 1), the bot is the disadvantaged participant.

When clicking "Continue to Payoff Pitch →", `proceedToBeat2()` is invoked. Recognizing that the bot was the disadvantaged player, `proceedToBeat2()` called `executeBotPlayBeat()` so the bot would pre-commit its card and display it face-up to the human player entering Beat 2.

The crash occurred in the payload construction:
```javascript
// Legacy code in proceedToBeat2():
const botBeatPlacement = botIsPitching
  ? { pitchType: botPlay.pitchType, pitchLocation: botPlay.pitchLocation, cardId: botPlay.cardId }
  : { swingType: botPlay.swingType, targetZone: botPlay.targetZone, guessPitch: botPlay.guessPitch, cardId: botPlay.cardId };
```

In Entries 8 and 9, we systematically eliminated `pitchLocation`, `targetZone`, and `swingType` from `executeBotPlayBeat()`. As a result:
- `botPlay.pitchLocation` evaluated to `undefined`.
- `botPlay.targetZone` evaluated to `undefined`.

In the Google Firebase Realtime Database JavaScript SDK, calling `ref.update(updates)` with an object that contains even a single `undefined` value immediately throws a fatal exception:
`Firebase.update failed: First argument contains undefined in property 'currentPA/beatPlacements/beat2/guest/pitchLocation'`.

Because the error was caught in `gameRef().update(updates).catch(...)`, the database write was entirely aborted. The game phase was never transitioned from `'beat1_result'` to `'placing'`, and the modal pop-up was never dismissed.

Furthermore, a secondary issue was uncovered: `executeBotPlayBeat(gs, 'guest', 'beat2')` was receiving only `gameState`, lacking `currentPA`. Without `currentPA.beatResults.beat1`, the bot could not read which pitch option had been locked out (e.g., Offspeed locked on a 3-1 count). Finally, the modal copy still referenced legacy mechanics ("Batter's Power Swing is LOCKED OUT"), which no longer existed in the 2-choice model.

---

### Options Explored

1. **Option A: Eliminate Bot Pre-Commitment on Dominant Beats**
   - *Concept*: Stop having the bot pre-commit face-up during `proceedToBeat2()`. Instead, let both players enter Beat 2 concurrently as in non-dominant counts.
   - *Verdict*: **Rejected**. Dominant counts are the core reward for decisive Beat 1 hand-management victories. Stripping face-up pre-commitment would eliminate the thrill of having complete information advantage over the opponent.

2. **Option B: Clean 2-Choice Payload, Robust State Passing, and Fail-Safe Sanitization**
   - *Concept*:
     1. Modernize `proceedToBeat2()` and `commitPlacement()` to generate clean 2-choice payloads: `{ pitchType, cardId }` for pitchers, and `{ guessPitch, cardId }` for batters.
     2. Provide defensive fallback defaults (`|| null`, `|| 'fastball'`) guaranteeing zero `undefined` values can ever be passed to Firebase.
     3. Provide immediate button UI feedback (`⏳ Proceeding to Payoff Pitch…`) with error rollback if the network rejects a write.
     4. Pass full contextual state `{ ...gs, currentPA: pa }` into `executeBotPlayBeat()` so the AI bot always respects count lockouts.
     5. Update modal copy to accurately explain 2-choice count rules (0-2 Two-Strike Plate Protection capping home runs at doubles; 3-1 Offspeed lockout).
   - *Verdict*: **Accepted**. This restores seamless gameplay, maintains strategic asymmetry, and ensures the UI matches the underlying game engine.

---

### Implementation Details

1. **User Interface & State Transitions (`js/app.js`)**:
   - `proceedToBeat2`:
     - Added instant button feedback disabling duplicate clicks and displaying progress.
     - Reconstructed `botBeatPlacement` strictly according to the 2-choice contract:
       ```javascript
       const botBeatPlacement = botIsPitching
         ? { pitchType: botPlay.pitchType || 'fastball', cardId: botPlay.cardId || null }
         : { guessPitch: botPlay.guessPitch || 'fastball', cardId: botPlay.cardId || null };
       ```
     - Passed `{ ...gs, currentPA: pa }` into `executeBotPlayBeat` so the bot evaluates the count accurately.
     - Added button re-enablement on `.catch()` to prevent unrecoverable UI states.
   - `commitPlacement`:
     - Added identical defensive fallbacks for bot placement updates during Beat 2.
   - `renderBeat1ResultModal`:
     - Updated explanation text:
       - **0-2 Count**: "Two-strike plate protection in effect (home runs capped at doubles, elevated strikeout danger), and Batter must commit their execution card FACE-UP FIRST!"
       - **3-1 Count**: "Pitcher's Offspeed pitch is LOCKED OUT, and Pitcher must commit their execution card FACE-UP FIRST!"
   - `gameRef`:
     - Added support for `window.db` mock fallback in headless testing environments.

2. **AI Bot & Resolution Engine (`js/resolution.js`)**:
   - `executeBotPlayBeat`:
     - Robustified Beat 1 data ingestion to accept `gameState?.currentPA?.beatResults?.beat1`, `gameState?.beatResults?.beat1`, or `gameState?.beat1`.
     - Read `oppRevealedCardId` from `firstRevealedCard`, `currentPA.firstRevealedCard`, or `gameState.firstRevealedCard`.
   - `resolveBeat1`:
     - Updated `countDisplay` to accurately reflect two-strike plate protection.

3. **Automated Testing Suite (`tests/test_play_ui.html`)**:
   - Added automated tests verifying `proceedToBeat2()` under Dominant Beat 1 conditions:
     - Confirmed phase transitions to `'placing'`.
     - Confirmed beat transitions to `'beat2'`.
     - Confirmed disadvantaged bot pre-commits face-up with card revealed.
     - Validated that the updates payload contains strictly zero `undefined` values across all keys and nested objects.

---

### Verification Results
- **Automated Unit Tests**: **125 of 125 tests pass** with 0 failures across `test_resolution.html` and `test_play_ui.html`.
- **Game Simulation**: 10-game headless simulation executed 295 PAs across 10 completed games with an average of **6.10 runs/game**, 103 hits, 7 home wins, 3 away wins, and zero runaway innings.
- **Player Experience**: Dominant Beat 1 victories now transition instantly and smoothly into the Payoff Pitch arena, displaying the opponent's revealed card face-up with full information advantage.

---

## Entry 11: Spatial Clarity & Outcome Transparency — Top/Bottom Layout Isolation, Beat 2 Advantage Banners, and Mistake Pitch Balancing
*Date: October 6, 2026*

### Context & The Problem
After completing our first full end-to-end 3-inning game playtest, several critical usability hurdles and balance anomalies emerged that obscured the core thrill of the duel:

1. **Spatial Role Confusion**:
   The shared public scouting bar was centered in the middle of the screen above the arena, locking the Pitcher on the left and Batter on the right regardless of whether the user was batting or pitching. This created severe cognitive friction—players had to constantly look between the center bar, top HUD, and bottom dock to discern whose charges, archetype, and favorite pitch were whose. The design mandate: **User player information must display exclusively at the bottom of the play area; Opponent information must display exclusively at the top.**

2. **Invisible Count Advantage in Beat 2**:
   After battling through Beat 1 to establish an advantage (such as a 0-2 Pitcher's Count or a 3-1 Hitter's Count), the Beat 2 Payoff Pitch arena provided no prominent, persistent reminder of the active bonuses or penalties in play (Two-Strike Plate Protection, Offspeed pitch lockout, or dominant face-up commitment requirements).

3. **Outcome Matrix Opacity**:
   When the At-Bat Outcome pop-up appeared at the end of a plate appearance, players were often confused by why a particular result occurred. The modal showed a final badge (e.g., "SWINGING STRIKEOUT" or "CLEAN SINGLE") without articulating the underlying 3-step clash mechanics (Pitch Read &rarr; Execution & Timing Delta &rarr; Matrix Resolution Rule).

4. **The Fastball "Mistake Pitch" Anomaly**:
   During the playtest, a user pitched a Card value `1` on a `Fastball` (Fastball range is 6–10; Card 1 represents a grooved, poorly executed mistake pitch). Unexpectedly, the engine awarded the pitcher a swinging strikeout!
   *Investigation*: Because the batter anticipated Fastball and played a card in range (e.g., Card 8), the timing delta was calculated as $|1 - 8| = 7$. Because $\Delta \ge 5$, the old matrix unconditionally mapped high deltas to "Badly Mistimed &rarr; Swinging Strikeout on Nasty Stuff", failing to recognize that the pitcher had thrown an out-of-range meatball!

---

### Options Explored

#### 1. Spatial Layout Re-Architecture
- **Option A: Retain Center Scouting Bar with Dynamic Swapping**: Flip the left/right position of cards in the center scouting bar depending on who is home/away.
  - *Cons*: Still placed opponent stats directly next to player stats in the center arena, causing visual clutter and dividing attention from the cards in play.
- **Option B (Chosen): Complete Top/Bottom Domain Isolation**:
  - Top HUD (`.opponent-bar`): Strictly shows opponent profile, avatar, remaining repertoire charges (if pitching) or archetype and hunted pitch (if batting), and hand count.
  - Bottom Player Dock (`.player-bar`): Strictly shows user profile, role badge, user arsenal charges or batter archetype/favorite pitch, and turn status indicators.
  - Center Battlefield: Freed entirely from scouting clutter to focus purely on the duel arena and cards.

#### 2. Beat 2 Advantage & Penalty Visibility
- **Option A: Passive Tooltips**: Add informational hover tooltips to cards and buttons.
  - *Cons*: Easy to overlook; does not convey active count tension.
- **Option B (Chosen): Dynamic Beat 2 Advantage Banner (`.beat2-advantage-banner`)**:
  - Mounted directly at the top of the Payoff Pitch arena in Beat 2.
  - Distinct styling for each count state:
    - **0-2 Pitcher Count (`.count-pitcher`)**: Pitcher count leverage active; put-away punchouts enabled on fooled swings; batter power suppressed (Delta 0 capped at Double).
    - **3-1 Hitter Count (`.count-hitter`)**: Batter count leverage active; pitcher locked out of throwing Offspeed [1–5]; mistimed swings convert into walks / bloop hits.
    - **3-2 Full Count (`.count-full`)**: Neutral duel; all pitches available.
    - **Dominant Reveal Callouts**: Clearly flags who must play their card face-up first.

#### 3. Outcome Transparency & Context
- **Option A: Detailed Verbose Paragraph**: Write a long text log describing the play.
  - *Cons*: Dense to read on mobile and fast-paced screens.
- **Option B (Chosen): 3-Step Resolution Breakdown + Collapsible Matrix Guide**:
  - **Step 1: Pitch Read**: Displays whether the batter anticipated the pitch type or was fooled.
  - **Step 2: Execution & Timing Collision**: Displays whether each side executed in-range and the resulting Timing Delta.
  - **Plain-English Rule Explanation**: A clear callout badge (`.rm-rule-explanation`) describing the exact baseball logic that decided the play.
  - **Collapsible Outcome Matrix Guide**: An expandable dropdown educating players on how pitch anticipation, delta tiers, and count leverage interact.

#### 4. Mistake Pitch Balancing
- **Option A: Treat Mistake Pitches as Instant Walks**:
  - *Cons*: Unrealistic for baseball; an unexecuted pitch down the middle should be hammered by an anticipating hitter, not automatically called a ball.
- **Option B (Chosen): Execution Gate Priority in Resolution Ladder**:
  - Check `if (!pitcherExecuted)` at the very top of `resolveBeat2`.
  - If pitcher threw out-of-range (e.g. Card 1 on Fastball) and batter anticipated with in-range timing (e.g. Card 8):
    - Award a **Home Run** (for Sluggers, favorite pitch hunts, or card $\ge 7$) or **Double** (all others). It is physically impossible to strike out on an anticipated hanger!
  - If both sides failed execution windows: weak contact dribbler groundout.
  - If batter guessed the wrong pitch: weak contact out or walk (3-1), never an unearned strikeout on spot-on stuff.

---

### Implementation Details

1. **Resolution Engine Overhaul (`js/resolution.js`)**:
   - Re-architected `resolveBeat2`:
     ```javascript
     if (!pitcherExecuted) {
       // Pitcher threw an out-of-range hanger/mistake pitch!
       if (pitchMatched) {
         if (batterExecuted) {
           // Grooved meatball punished for extra bases!
           outcomeType = (isSlugger || isFavoritePitch || bCardVal >= 7) ? 'homerun' : 'double';
           outcomeDisplay = (outcomeType === 'homerun') ? '💥 CRUSHED HOME RUN (MISTAKE PITCH PUNISHED)!' : '⚡ WALL-BALL DOUBLE (HANGER CRUSHED)!';
           ruleReason = `Pitcher failed execution (Card [${pCardVal}] outside ${pitchType.toUpperCase()} [${pRange.min}–${pRange.max}]) against batter's timed read (Card [${bCardVal}]). Grooved meatball crushed for extra bases!`;
         } else {
           outcomeType = 'groundout';
           ruleReason = `Both pitcher and batter missed their target execution windows. Weak contact recorded an out.`;
         }
       } else {
         // Batter fooled on mistake pitch
         ...
       }
     }
     ```
   - Added plain-English `ruleReason` strings to all branches of `resolveBeat2` and propagated through `resolveSequentialPA`.

2. **User Interface Redesign (`js/app.js` & `fullcount.css`)**:
   - Implemented `renderBeat2AdvantageBanner(b1Data, iAmBatting, iAmPitching)` with contextual color themes and dominant callouts.
   - Removed `renderPublicScoutingBar` from the center battlefield in `renderZoneBoard`.
   - Placed `.opp-scout-chips` in `.opponent-bar` (top) and `.my-scout-chips` in `.player-bar` (bottom) across both `renderPlacing` and `renderReveal`.
   - Replaced outcome modal card recap with the 3-Step Resolution Breakdown, `.rm-rule-explanation`, and `<details class="rm-matrix-guide">`.

3. **Automated Verification Suite (`tests/test_resolution.html` & `tests/test_play_ui.html`)**:
   - Added unit test asserting that throwing Card 1 on Fastball against an anticipated Card 8 produces a Home Run with a valid `ruleReason`, never a strikeout.
   - Added UI tests asserting proper placement of top opponent chips, bottom user chips, Beat 2 advantage banner rendering, and outcome modal breakdown elements.

---

### Verification Results
- **Automated Unit Tests**: **137 of 137 tests pass** with 0 failures across `test_resolution.html` and `test_play_ui.html`.
- **Headless Game Simulation**: 10-game simulation executed 317 PAs across 10 completed games with an average of **9.60 runs/game**, 115 hits, 7 home wins, 3 away wins, and zero errors.
- **Player Experience**: Clean spatial separation between player and opponent, immediate visual clarity on count bonuses during Beat 2, transparent post-clash explanations, and fair punishment of mistake pitches.

---

## Entry 12: The Wild Pitch in the Dirt & Absolute Left-Side Player Orientation
*Date: October 7, 2026*

### Context & The Problem
A user playtest revealed two distinct issues that disrupted player intuition:

1. **The 0-2 Botched Delivery Anomaly**:
   A user pitched a Fastball with Card `3` (Fastball range is `6–10`, meaning Card 3 was an out-of-range failed delivery / wild pitch). The batter anticipated Offspeed with Card `3` (an exact $\Delta = 0$ timing match). The game resolved this into `⚡ AWKWARD STRIKEOUT (CHASED WILD PITCH IN DIRT)!`.
   While the engine was attempting to emulate a two-strike chase in the dirt, awarding the pitcher a strikeout on an unexecuted fastball creates a perverse incentive: pitchers could dump useless low cards with zero risk. Furthermore, with $\Delta = 0$, the batter's bat crossed the plate right on time with the ball.
2. **Left/Right Placement Inconsistency**:
   During Beat 1 placement, the player’s card slot was placed on the right (`b1-card-slot mine`) and the opponent on the left. However, in the Beat 1 Result modal and outcome clash boards, Pitcher was hardcoded on the left and Batter on the right. If the user was pitching, they placed on the right but saw their results on the left; if batting, vice versa. The mandate was clear: **The player’s cards and actions must ALWAYS be on the left side everywhere in the game.**

---

### Options Explored for the 0-2 Botched Pitch

- **Option 1: Weak Groundout / Infield Dribbler**: Batter makes awkward contact on the mistake pitch for a routine out.
  - *Cons*: Still lets the pitcher off the hook with a free out despite a botched pitch.
- **Option 2: Batter Timing Override**: Batter slaps the $\Delta = 0$ mistake pitch for an infield single.
  - *Cons*: Ignores that the batter guessed the wrong pitch type.
- **Option 3 (Chosen): Wild Pitch / Ball in the Dirt**:
  - In baseball, an unexecuted pitch out of the zone is a **Ball**. On an 0-2 count, a wild pitch in the dirt misses the zone (Ball One) and allows base runners to advance 1 base (runner on 3rd scores).
  - The count resets to a **3-2 Full Count payoff pitch**, preserving the at-bat and forcing the pitcher to execute properly in a neutral duel!
  - If the pitcher misses execution again on 3-2, it becomes Ball Four &rarr; **Walk**.

---

### Implementation Details

1. **Engine Logic (`js/resolution.js`)**:
   - In `resolveBeat2`: when `!pitcherExecuted && !pitchMatched && effectiveCount === '0-2'`:
     ```javascript
     outcomeType = 'wild_pitch';
     isWildPitchReset = true;
     runsScored = bases.third ? 1 : 0;
     newBases = {
       first: false,
       second: Boolean(bases.first),
       third: Boolean(bases.second)
     };
     outsAdded = 0;
     outcomeDisplay = '⚡ WILD PITCH IN THE DIRT (BALL / RUNNERS ADVANCE)!';
     ruleReason = `0-2 Count: Pitcher threw an out-of-range delivery into the dirt (Ball). Any runners advance on the wild pitch, and count resets to a neutral 3-2 Full Count!`;
     ```
   - On 3-2 count, an unexecuted delivery resolves to a **Walk** (Ball Four).

2. **Game State & Modal Flow (`js/app.js`)**:
   - In `resolveBeatStep`: when `beat2Result.isWildPitchReset`, updates `currentPA/phase` to `'wild_pitch_result'`, advances runners in `gameState/bases`, and adds runs if scored.
   - Added `renderWildPitchModal(res, isBatting)` showing:
     - Player action on the left vs Opponent on the right.
     - Explanation of the ball in dirt and runner advancements.
     - "Continue to 3-2 Payoff Pitch &rarr;" button invoking `proceedFromWildPitch()`.
   - `proceedFromWildPitch()` resets `currentPA` to `beat2` with count `3-2` and cleared placements, allowing both players to contest the full-count payoff pitch.

3. **Absolute Left-Side Player Orientation (`js/app.js`)**:
   - **Beat 1 Placement Arena**: Player slot (`.b1-card-slot.mine`) is on the LEFT; opponent slot (`.b1-card-slot.opp`) is on the RIGHT.
   - **Beat 1 Result Modal**: Player box (`.rm-player-box.mine`) is on the LEFT; opponent box is on the RIGHT.
   - **Battlefield Clash Cards**: Player action (`.clash-side.batter`/`.pitcher`) is on the LEFT; opponent is on the RIGHT.
   - **At-Bat Outcome Pop-up**: Player recap row and execution delta score are ALWAYS first/left; opponent is second/right.
   - **Wild Pitch Modal**: Player is on the left; opponent on the right.

---

### Verification Results
- **Automated Unit Tests**: **150 of 150 tests pass** with 0 failures across `test_resolution.html` and `test_play_ui.html`.
- **Headless Game Simulation**: 10-game simulation executed 370 PAs across 10 completed games with an average of **10.80 runs/game**, 149 hits, 5 home wins, 5 away wins, and zero errors.
- **Player Experience**: Perfect spatial predictability—the player is always on the left. Wild pitches now act like real baseball wild pitches, punishing pitcher misfires on 0-2 by advancing runners and resetting to a full-count duel.



