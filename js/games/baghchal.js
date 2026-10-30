(function () {
  const N = 5, SP = 70, M = 40, PX = M * 2 + SP * (N - 1);
  const opp = (s) => s === 'p1' ? 'p2' : 'p1';
  const name = (s) => s === 'p1' ? 'Goats' : 'Tigers';
  const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const dirs = (r, c) => { const d = [[-1,0],[1,0],[0,-1],[0,1]]; if ((r + c) % 2 === 0) d.push([-1,-1],[-1,1],[1,-1],[1,1]); return d; };
  function init() {
    const b = Array.from({ length: N }, () => Array(N).fill(null));
    [[0,0],[0,4],[4,0],[4,4]].forEach(([r, c]) => { b[r][c] = 'T'; });
    return { b, turn: 'p1', toPlace: 20, captured: 0 };
  }
  function moves(s) {
    const out = [], b = s.b;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (s.turn === 'p1') {
        if (s.toPlace > 0) { if (!b[r][c]) out.push({ to: [r, c] }); continue; }
        if (b[r][c] !== 'G') continue;
        dirs(r, c).forEach(([dr, dc]) => { if (inB(r + dr, c + dc) && !b[r + dr][c + dc]) out.push({ from: [r, c], to: [r + dr, c + dc] }); });
      } else if (b[r][c] === 'T') {
        dirs(r, c).forEach(([dr, dc]) => {
          const a = r + dr, e = c + dc; if (!inB(a, e)) return;
          if (!b[a][e]) out.push({ from: [r, c], to: [a, e] });
          else if (b[a][e] === 'G' && inB(a + dr, e + dc) && !b[a + dr][e + dc]) out.push({ from: [r, c], to: [a + dr, e + dc], over: [a, e] });
        });
      }
    }
    return out;
  }
  function apply(s, m) {
    const n = Common.clone(s);
    if (!m.from) { n.b[m.to[0]][m.to[1]] = 'G'; n.toPlace--; }
    else { n.b[m.to[0]][m.to[1]] = n.b[m.from[0]][m.from[1]]; n.b[m.from[0]][m.from[1]] = null; }
    if (m.over) { n.b[m.over[0]][m.over[1]] = null; n.captured++; }
    n.turn = opp(n.turn); return n;
  }
  function winner(s) {
    if (s.captured >= 5) return 'p2';
    if (moves({ ...s, turn: 'p2' }).length === 0) return 'p1';
    if (s.turn === 'p1' && moves(s).length === 0) return 'p2';
    return null;
  }
  const api = {
    getMoves: moves, applyMove: apply, isTerminal: (s) => !!winner(s),
    evaluate(s) { const w = winner(s); if (w) return w === 'p2' ? 1000 : -1000; return s.captured * 40 + moves({ ...s, turn: 'p2' }).length * 2; },
  };

  function start({ boardEl, panel, mode }) {
    let st = init(), sel = null, dead = false;
    const AI = mode === 'ai' ? 'p2' : null;
    boardEl.innerHTML = '';
    const shell = Common.el('div', { style: `position:relative;width:${PX}px;height:${PX}px;` });
    boardEl.appendChild(shell);
    const xy = (r, c) => [M + c * SP, M + r * SP];
    function render() {
      shell.innerHTML = '';
      const L = (a, b, c, d) => { const p = xy(a, b), q = xy(c, d); return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; };
      let g = '';
      for (let i = 0; i < N; i++) g += L(i, 0, i, 4) + L(0, i, 4, i);
      g += L(0,0,4,4) + L(0,4,4,0) + L(0,2,2,0) + L(2,0,4,2) + L(4,2,2,4) + L(2,4,0,2);
      shell.insertAdjacentHTML('beforeend', `<svg width="${PX}" height="${PX}" style="position:absolute;left:0;top:0" stroke="rgba(0,0,0,.4)" stroke-width="2">${g}</svg>`);
      const legal = moves(st), targets = sel ? legal.filter((m) => m.from && m.from[0] === sel[0] && m.from[1] === sel[1]) : [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const [x, y] = xy(r, c), v = st.b[r][c];
        const placeable = st.turn === 'p1' && st.toPlace > 0 && !v;
        const d = Common.el('div', { class: 'point' + (targets.some((m) => m.to[0] === r && m.to[1] === c) || placeable ? ' movable' : '') + (sel && sel[0] === r && sel[1] === c ? ' selected' : '') });
        d.style.left = x + 'px'; d.style.top = y + 'px';
        if (v) d.appendChild(Common.el('div', { class: 'piece ' + (v === 'G' ? 'p1' : 'p2'), text: v === 'G' ? '🐐' : '🐅', style: 'display:flex;align-items:center;justify-content:center;font-size:17px;' }));
        d.addEventListener('click', () => click(r, c));
        shell.appendChild(d);
      }
      const trapped = st.b.flat().filter((x) => x === 'T').length - new Set(moves({ ...st, turn: 'p2' }).filter((m) => m.from).map((m) => m.from.join())).size;
      panel.setTurn(name(st.turn) + ' to move', st.turn === 'p1' ? '#e8e0c8' : '#d9722a');
      panel.setStats([{ label: 'Goats to place', value: st.toPlace }, { label: 'Goats captured', value: st.captured + ' / 5' }, { label: 'Tigers trapped', value: trapped + ' / 4' }]);
    }
    function click(r, c) {
      if (dead || (AI && st.turn === AI)) return;
      const legal = moves(st);
      let m = legal.find((x) => (!x.from && x.to[0] === r && x.to[1] === c) || (sel && x.from && x.from[0] === sel[0] && x.from[1] === sel[1] && x.to[0] === r && x.to[1] === c));
      if (m) { sel = null; st = apply(st, m); return after(); }
      sel = legal.some((x) => x.from && x.from[0] === r && x.from[1] === c) ? [r, c] : null;
      render();
    }
    function after() {
      render();
      const w = winner(st);
      if (w) { dead = true; panel.setMessage(w === 'p2' ? 'Tigers win — five goats have been captured.' : 'Goats win — every tiger is trapped.'); return; }
      panel.setMessage(`${name(st.turn)} to move.`);
      if (AI && st.turn === AI) setTimeout(() => { if (dead) return; const m = Common.bestMove(st, 3, api); if (m) st = apply(st, m); after(); }, 400);
    }
    render();
    panel.setMessage('Goats go first: place one goat per turn on any empty point (20 in total), then slide them. Tigers step one point or jump over a goat to capture it. Diagonal lines exist only through the marked diagonal points.');
    return { destroy() { dead = true; } };
  }

  GAMES.push({
    id: 'baghchal', name: 'Bagh-Chal', emblem: '🐅', origin: 'Nepal · Himalayan hunt game', sides: ['Goats', 'Tigers'],
    theme: { accent: '#e08a2e', panel: '#1f2418', board1: '#d8c9a0', board2: '#bfa970', p1Light: '#fffaf0', p1Dark: '#d8c8a2', p2Light: '#e8a050', p2Dark: '#6b3410' },
    tagline: 'Four tigers hunt twenty goats on a 5×5 grid.',
    rules: '<strong>Bagh-Chal ("move the tiger"):</strong> four tigers start in the corners. Goats (who move first) must place all 20 goats one at a time before sliding them. A tiger moves one step along a line, or jumps a goat in a straight line to capture it. Tigers win by capturing five goats; goats win by trapping all four tigers so none can move.',
    engine: { init, moves, apply, winner, api }, start,
  });
})();
