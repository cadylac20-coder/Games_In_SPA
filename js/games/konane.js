(function () {
  const N = 8, CELL = 48, DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  const opp = (s) => s === 'p1' ? 'p2' : 'p1';
  const name = (s) => s === 'p1' ? 'Black' : 'White';
  const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  function init() {
    const b = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (r + c) % 2 ? 'p2' : 'p1'));
    b[3][3] = null; b[3][4] = null;
    return { board: b, turn: 'p1' };
  }
  // Jump orthogonally over an enemy into an empty square; several jumps in one straight line are allowed.
  function moves(st) {
    const out = [], b = st.board, me = st.turn;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (b[r][c] !== me) continue;
      for (const [dr, dc] of DIRS) {
        let pr = r, pc = c; const caps = [];
        while (inB(pr + 2 * dr, pc + 2 * dc) && b[pr + dr][pc + dc] === opp(me) && !b[pr + 2 * dr][pc + 2 * dc]) {
          caps.push([pr + dr, pc + dc]); pr += 2 * dr; pc += 2 * dc;
          out.push({ from: [r, c], to: [pr, pc], caps: caps.slice() });
        }
      }
    }
    return out;
  }
  function apply(st, m) {
    const s = Common.clone(st);
    s.board[m.to[0]][m.to[1]] = s.board[m.from[0]][m.from[1]]; s.board[m.from[0]][m.from[1]] = null;
    m.caps.forEach(([r, c]) => { s.board[r][c] = null; });
    s.turn = opp(s.turn); return s;
  }
  const api = {
    getMoves: moves, applyMove: apply, isTerminal: (s) => moves(s).length === 0,
    evaluate(s) {
      if (moves(s).length === 0) return s.turn === 'p2' ? -1000 : 1000;
      return moves({ board: s.board, turn: 'p2' }).length - moves({ board: s.board, turn: 'p1' }).length;
    },
  };

  function start({ boardEl, panel, mode }) {
    let st = init(), sel = null, dead = false;
    const AI = mode === 'ai' ? 'p2' : null;
    boardEl.innerHTML = '';
    const shell = Common.el('div', { style: `position:relative;width:${N * CELL}px;height:${N * CELL}px;` });
    boardEl.appendChild(shell);
    function render() {
      shell.innerHTML = '';
      const legal = moves(st), targets = sel ? legal.filter((m) => m.from[0] === sel[0] && m.from[1] === sel[1]) : [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const d = Common.el('div', { class: 'cell' + (targets.some((m) => m.to[0] === r && m.to[1] === c) ? ' movable' : '') });
        d.style.cssText = `left:${c * CELL}px;top:${r * CELL}px;width:${CELL}px;height:${CELL}px;background:rgba(0,0,0,${(r + c) % 2 ? 0.12 : 0.04});`;
        if (st.board[r][c]) d.appendChild(Common.el('div', { class: 'piece ' + st.board[r][c], style: 'width:34px;height:34px;' + (sel && sel[0] === r && sel[1] === c ? 'box-shadow:0 0 0 3px var(--t-accent);' : '') }));
        d.addEventListener('click', () => click(r, c));
        shell.appendChild(d);
      }
      const count = (p) => st.board.flat().filter((x) => x === p).length;
      panel.setTurn(name(st.turn) + ' to move', st.turn === 'p1' ? '#111' : '#eee');
      panel.setStats([{ label: 'Black stones', value: count('p1') }, { label: 'White stones', value: count('p2') }, { label: 'Moves available', value: legal.length }]);
    }
    function click(r, c) {
      if (dead || (AI && st.turn === AI)) return;
      const legal = moves(st), m = sel && legal.find((x) => x.from[0] === sel[0] && x.from[1] === sel[1] && x.to[0] === r && x.to[1] === c);
      if (m) { sel = null; st = apply(st, m); return after(); }
      sel = st.board[r][c] === st.turn && legal.some((x) => x.from[0] === r && x.from[1] === c) ? [r, c] : null;
      render();
    }
    function after() {
      render();
      if (!moves(st).length) { dead = true; panel.setMessage(`${name(opp(st.turn))} wins — ${name(st.turn)} has no jump left.`); return; }
      panel.setMessage(`${name(st.turn)} to move.`);
      if (AI && st.turn === AI) setTimeout(() => { if (dead) return; const m = Common.bestMove(st, 4, api); if (m) st = apply(st, m); after(); }, 400);
    }
    render();
    panel.setMessage('Black moves first. Pick a stone, then a highlighted landing square: you jump over an adjacent enemy stone into an empty square and remove it. Keep jumping in the same straight line if you can. If you cannot jump, you lose.');
    return { destroy() { dead = true; } };
  }

  GAMES.push({
    id: 'konane', name: 'Kōnane', emblem: '◐', origin: 'Hawaiian · pre-contact', sides: ['Black', 'White'],
    theme: { accent: '#d4572a', panel: '#1d1816', board1: '#c9a97c', board2: '#a8845a', p1Light: '#555', p1Dark: '#111', p2Light: '#fdfdfd', p2Dark: '#cfcfcf' },
    tagline: 'Hawaiian jumping game where running out of jumps means defeat.',
    rules: '<strong>Kōnane:</strong> the board starts full of alternating black and white stones, with two adjacent centre stones removed. On your turn jump one of your stones orthogonally over an adjacent enemy stone into the empty square beyond, removing the jumped stone. You may chain several jumps in the same straight line. The first player unable to jump loses.',
    engine: { init, moves, apply, api }, start,
  });
})();
