# Full Count — Prototype Setup Guide

> **v1 Prototype** · 2-player online · 3-inning game  
> 📱 **Live Mobile Card Game UI Prototype**: [https://breadcrowns.github.io/fullcount/prototype.html](https://breadcrowns.github.io/fullcount/prototype.html)

---

## Quick Start

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `full-count`)
3. Disable Google Analytics (not needed) → **Create project**

### 2. Set Up Realtime Database

1. In the Firebase console sidebar → **Build → Realtime Database**
2. Click **Create Database**
3. Choose a location (any) → **Next**
4. Start in **Test mode** → **Enable**  
   _(This allows read/write without auth — fine for a prototype between friends)_

### 3. Get Your Config Keys

1. In the sidebar → ⚙️ **Project Settings** (gear icon)
2. Scroll to **Your apps** → click the `</>` (Web) icon → **Register app**
3. Copy the `firebaseConfig` object that appears

### 4. Paste Config into the Game Files

Open these two files and replace the placeholder `FIREBASE_CONFIG`:

- `FullCount/index.html` — look for `const FIREBASE_CONFIG = {`
- `FullCount/js/app.js` — look for `const FIREBASE_CONFIG = {`

Paste your actual values into both files.

**Example:**
```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAbc123...",
  authDomain:        "full-count-abc12.firebaseapp.com",
  databaseURL:       "https://full-count-abc12-default-rtdb.firebaseio.com",
  projectId:         "full-count-abc12",
  storageBucket:     "full-count-abc12.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef123456"
};
```

> ⚠️ **The `databaseURL` field is required.** It looks like `https://your-project-default-rtdb.firebaseio.com`. If it's missing from your config object in the Firebase console, copy it from the **Realtime Database** page URL.

### 5. Serve the Files

Open `FullCount/index.html` directly in a browser, **or** use a local server for best results:

```bash
# If you have Node.js:
npx live-server FullCount/

# Or Python:
python -m http.server 8080 --directory FullCount/
# Then open http://localhost:8080
```

> Firebase requires requests from `localhost` or HTTPS. Opening the file directly (`file://`) may block Firebase connections in some browsers. Use a local server if you see connection errors.

---

## How to Play

### Starting a Game

1. **Player 1** opens `index.html`, enters their name, clicks **Create Game**
2. A 6-letter **Room Code** appears — share it with Player 2
3. **Player 2** opens `index.html`, enters their name + the room code, clicks **Join Game**
4. Both players are taken to their roster selection screen

### Roster Selection

Each player independently selects:
- **Starting Pitcher** — 8 options, each with different zone bonuses and stamina tracks
- **Relief Pitcher** — must be a different pitcher card
- **Batting Lineup** — 3 preset orders (Power, Balanced, Small Ball)
- **Action Deck** — 3 preset decks (Grind It Out, Big Inning, The Manager)

Click **Lock In Roster** when ready. Game starts when both players have locked in.

### Playing a PA (Plate Appearance)

**Both players see:**
- Score, inning, outs, bases
- Their active pitcher's stats and stamina
- The current batter's zone bonuses
- Their own hand of cards

**The PA cycle:**
1. **Place cards** — click a card in your hand to select it (gold border), then click an empty zone slot to place it
   - Max 2 cards per zone, 4 cards total per PA
   - Role restrictions: pitcher-type cards only work when pitching; batter-type cards only work when batting
   - Placing outside your card's preferred zone → 50% value penalty (shown by zone tag color)
2. **Lock In** — click the lock button when your placement is ready
3. **Wait** — opponent's zone cards appear as "?" until both players lock in
4. **Reveal** — all cards revealed simultaneously, zones resolve with full log
5. **Outcome** — displayed with runs, outs, base changes
6. Click **Next Batter** to draw and advance

### Pitcher Substitution

While placing cards (pitching half-inning only), a **Bring In [Name]** button appears in the left panel. This replaces your starting pitcher with your relief pitcher and resets their stamina to 0.

---

## Card Rules Quick Reference

| Rule | Effect |
|------|--------|
| Zone tag penalty | Card played outside preferred zone = **×0.5 value** |
| Zone 1 inheritance | Zone 1 winner gets **+3** added to their Zone 2 total |
| Hard Contact | Batter wins Zone 2 by **15+** → Zone 3 batter total **×2** |
| Walk trigger | Batter wins Zone 1 by **10+** → automatic Walk |
| Called Strike 3 | Pitcher wins Zone 1 by **10+** → automatic Out |
| Strikeout Swinging | Pitcher wins Zone 2 by **15+** → automatic Out (blocked by Choke Up / Two-Strike Approach) |
| Home Run trigger | Batter wins **all 3 zones** AND Advantage Score **≥30** |
| Dominant Pitcher | Pitcher wins **all 3 zones** AND Advantage Score **≥30** → DP or K |
| Counter | Batter reads pitcher's pitch type in Zone 1 → multiplier on batter Z1 action total |
| Zone 3 counters | Pitcher defense cards (e.g., Infield Shift) reduce batter Zone 3 value |

---

## Known Prototype Limitations

These are intentional scope cuts for v1 — all planned for iteration:

| Feature | Status |
|---------|--------|
| Custom deck building | Not yet — choose from 3 presets |
| Complex card specials (Misdirection, Audible, Time Out) | Text only — not auto-enforced |
| Card rarity tiers | Pending |
| Draft variant | Not implemented |
| Anti-cheat for hidden placement | Trust-based (no server validation) |
| Green Light steal resolution UI | Flavour text only |
| Extra innings automatic detection | Basic (tied after 3 = continues) |
| Mulligan (draw 2) | Described but not UI-triggered mid-PA |

---

## File Structure

```
FullCount/
  index.html        Lobby (create/join)
  game.html         Main game screen
  fullcount.css     Dark baseball theme
  js/
    data.js         All card and character data (70 action + 8 pitcher + 12 batter)
    resolution.js   Zone resolution logic (pure functions, no side effects)
    app.js          Firebase sync + game controller + UI rendering
  README.md         This file
```

---

## Deck Presets

### 🛡️ Grind It Out
Control pitching, patient hitting, stamina management. Aim to win 3-2.  
Pitch type mix: Changeup, Curveball, Two-Seamer, Cutter. Defense: No Doubles, Infield In, DP Depth.  
Batter mix: Patient Eye counters, Contact Swing, Two-Strike Approach.

### 💥 Big Inning
Raw power, high velocity. Aim to win 8-5.  
Pitch type mix: 2× Four-Seam, Slider. Zone 2: 2× Extra Heat, High Cheese, Bury It. Zone 3: 2× Infield Shift.  
Batter mix: Guess Fastball, Sit Fastball, 2× Bat Speed, 2× Power Surge, Launch Angle, Pull Heavy, Upper Deck.

### 🧠 The Manager
Information advantage, deck manipulation.  
Pitch type mix: Changeup, Slurve, Knuckleball — hard to counter. Zone 3: Opposite Field Defense, Vacuum.  
Batter mix: 2× Scouting Report, Veteran Instinct, Two-Strike Approach, Inside-Out Swing, Opposite Field.
