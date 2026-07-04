# Twelve Boards

A single-page collection of twelve traditional and modern strategy games,
playable against a friend on the same screen or against a built-in AI. No
build step, no dependencies, no backend — pure HTML/CSS/JS. Each game gets
its own accent color and board palette.

Games included: **Surakarta**, **Seega**, **Five Field Kono**, **Tablut**,
**Hex**, **Go** (simplified 9×9), **Hive**, **Reversi (Othello)**,
**Chess**, **Backgammon**, **Blokus** (2-player), and **Homeworlds**
(simplified).

## Play it locally

Open `index.html` in any browser. Pick a game from the grid, then choose
"Play vs Friend" (local hotseat) or "Play vs AI".

## How strong is the AI?

- **Surakarta, Seega, Five Field Kono, Tablut, Reversi, Chess** — real
  minimax search with alpha-beta pruning (2–3 ply). These play tactically
  soundly and are genuine opponents, though Chess in particular is a solid
  casual player rather than a tournament engine (no opening book, fixed
  shallow search, simple evaluation).
- **Hex** — flat Monte Carlo (random-rollout) evaluation, the standard
  lightweight approach for this game specifically.
- **Go, Hive** — one-ply heuristic (evaluate the position immediately
  after each candidate move). Sensible and legal, not expert-level — a
  genuinely strong engine for either is a research-scale project.
- **Backgammon, Blokus, Homeworlds** — heuristic move selection tuned to
  each game's shape (blot-hitting and bearing off; biggest-piece-first
  placement; attack-then-build priority) rather than deep search, since
  none of these fit a simple single-move-per-turn minimax cleanly (dice,
  massive placement branching, and multi-part actions respectively).

## Known simplifications

- **Hive** — does not model the physical "freedom to move" sliding-gate
  rule that can block a piece from squeezing between two tightly packed
  neighbours in official play.
- **Seega** — skips the traditional alternating placement phase; both
  sides start with two full rows already filled.
- **Go** — basic single-stone ko rule (not full positional superko), and
  scoring without a dead-stone-removal phase.
- **Tablut** — king capture requires attackers on all four orthogonal
  neighbours directly; the "hostile throne/corner assists capture" nuance
  some rule sets add is not modeled.
- **Chess** — pawns auto-promote to a queen (no under-promotion choice).
  No draw detection for threefold repetition or the 50-move rule.
- **Backgammon** — doesn't enforce the tournament rule requiring you to
  use the maximum number of dice possible each turn; you can skip a die
  with no legal move.
- **Blokus** — 2-player only, official scoring bonuses (for placing every
  piece, or finishing on the monomino) are omitted; fewer unplaced squares
  simply wins. "Flip" cycles through the piece's mirrored orientations
  rather than a literal drag-to-mirror gesture.
- **Homeworlds** — a deliberately simplified interpretation. It drops the
  star-size connectivity requirement between systems (movement is allowed
  between any existing systems), the original's multiple-actions-per-turn
  structure (here it's one action per turn), and the sacrifice-based setup
  phase, in favor of a fixed starting fleet. Catastrophes and all four
  action colors work as in the original.

## Hosting it on GitHub Pages

You can do this entirely from GitHub's website — no terminal required:

1. Create a new repository (e.g. `twelve-boards`), public, without a
   README (you already have one here).
2. On the empty repo page, use **"uploading an existing file"** and drag
   in this whole folder's *contents* (not a zip file) — `index.html`,
   `README.md`, and the `css/` and `js/` folders (with `js/games/` nested
   inside) — so they land at the repo's root, not inside a wrapper folder.
   Commit.
3. Go to **Settings → Pages** → set **Source** to "Deploy from a branch",
   branch **main**, folder **/ (root)** → **Save**.
4. After a minute, your site is live at:
   `https://<your-username>.github.io/<repo-name>/`

If you'd rather use git from the command line instead:

```bash
git init
git add .
git commit -m "Twelve Boards"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then set up Pages the same way through Settings → Pages.

## Project structure

```
index.html
css/style.css
js/common.js          shared minimax/alpha-beta search + small DOM helpers
js/app.js             menu, routing between games, side-panel builder, theming
js/games/surakarta.js
js/games/seega.js
js/games/kono.js
js/games/tablut.js
js/games/hex.js
js/games/go.js
js/games/hive.js
js/games/reversi.js
js/games/chess.js
js/games/backgammon.js
js/games/blokus.js
js/games/homeworlds.js
```

## Adding a new game

Each game file is self-contained and registers itself with
`GAMES.push({ id, name, emblem, theme, tagline, rules, start })` —
`app.js` just reads that list to build the menu and launch whichever one
is picked, applying that game's `theme` colors (accent, panel, board
background, and piece colors) via CSS custom properties. To add a
thirteenth game, drop a new file under `js/games/`, add one `<script>` tag
for it in `index.html` before `js/app.js`, and give it its own `theme`
object so it gets a distinct look automatically.
