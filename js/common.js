// Shared utilities used across game modules.
window.GAMES = window.GAMES || [];

window.Common = (function () {
  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  // Generic alpha-beta search.
  // api = { getMoves(state), applyMove(state, move) -> newState, evaluate(state), isTerminal(state) }
  // evaluate(state) must always return a score from the AI player's point of view
  // (positive = good for the AI), regardless of whose turn it is in `state`.
  function alphaBeta(state, depth, alpha, beta, maximizing, api) {
    if (depth === 0 || api.isTerminal(state)) return api.evaluate(state);
    const moves = api.getMoves(state);
    if (moves.length === 0) return api.evaluate(state);

    if (maximizing) {
      let value = -Infinity;
      for (const m of moves) {
        const child = api.applyMove(state, m);
        value = Math.max(value, alphaBeta(child, depth - 1, alpha, beta, false, api));
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const m of moves) {
        const child = api.applyMove(state, m);
        value = Math.min(value, alphaBeta(child, depth - 1, alpha, beta, true, api));
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  // Picks the best move for the side to move in `state`, searching `depth` plies deep.
  function bestMove(state, depth, api) {
    const moves = api.getMoves(state);
    if (moves.length === 0) return null;
    const shuffled = moves.slice().sort(() => Math.random() - 0.5);
    let best = null;
    let bestVal = -Infinity;
    for (const m of shuffled) {
      const child = api.applyMove(state, m);
      const val = alphaBeta(child, depth - 1, -Infinity, Infinity, false, api);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  // Picks the move that looks best after a single random-ish heuristic evaluation
  // (used for games where full minimax is too expensive: Go, Hive).
  function greedyMove(state, api) {
    const moves = api.getMoves(state);
    if (moves.length === 0) return null;
    let best = null;
    let bestVal = -Infinity;
    for (const m of moves.slice().sort(() => Math.random() - 0.5)) {
      const child = api.applyMove(state, m);
      const val = api.evaluate(child);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "text") e.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => e.appendChild(c));
    return e;
  }

  return { clone, alphaBeta, bestMove, greedyMove, el };
})();
