# Twelve Boards

A single-page collection of twelve traditional and modern strategy games,
playable against a friend on the same screen or against a built-in AI. No
build step, no dependencies, no backend — pure HTML/CSS/JS. Each game gets
its own accent color and board palette.

Games included: **Surakarta**, **Seega**, **Five Field Kono**, **Tablut**,
**Hex**, **Go** (simplified 9×9), **Hive**, **Reversi (Othello)**,
**Chess**, **Backgammon**, **Blokus** (2-player), and **Homeworlds**
(simplified).

# How to play 

Go to https://cadylac20-coder.github.io/Games_In_SPA/ and enjoy !

# How strong is the AI?

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

# Known simplifications

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
