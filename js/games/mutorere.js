(function () {
  const SZ = 360, C = 180, R = 130;
  const pos = (i) => i === 8 ? { x: C, y: C } : { x: C + R * Math.cos(i * Math.PI / 4 - Math.PI / 2), y: C + R * Math.sin(i * Math.PI / 4 - Math.PI / 2) };
  const opp = (s) => s === 'p1' ? 'p2' : 'p1';
  const name = (s) => s === 'p1' ? 'Ochre' : 'Slate';
  const init = () => ({ pts: ['p1','p1','p1','p1','p2','p2','p2','p2',null], turn: 'p1' });
  // Outer points step to an empty neighbour; a piece may enter the centre only while touching an enemy.
  function moves(st) {
    const out = [], p = st.pts, me = st.turn;
    for (let i = 0; i < 9; i++) {
      if (p[i] !== me) continue;
      if (i === 8) { for (let j = 0; j < 8; j++) if (!p[j]) out.push({ from: 8, to: j }); continue; }
      const a = (i + 1) % 8, b = (i + 7) % 8;
      [a, b].forEach((j) => { if (!p[j]) out.push({ from: i, to: j }); });
      if (!p[8] && (p[a] === opp(me) || p[b] === opp(me))) out.push({ from: i, to: 8 });
    }
    return out;
  }
  function apply(st, m) { const s = Common.clone(st); s.pts[m.to] = s.pts[m.from]; s.pts[m.from] = null; s.turn = opp(s.turn); return s; }
  const api = {
    getMoves: moves, applyMove: apply, isTerminal: (s) => moves(s).length === 0,
    evaluate(s) {
      if (moves(s).length === 0) return s.turn === 'p2' ? -1000 : 1000;
      return 3 * (moves({ pts: s.pts, turn: 'p2' }).length - moves({ pts: s.pts, turn: 'p1' }).length);
    },
  };

  function start({ boardEl, panel, mode }) {
    let st = init(), sel = null, dead = false;
    const AI = mode === 'ai' ? 'p2' : null;
    boardEl.innerHTML = '';
    const shell = Common.el('div', { style: `position:relative;width:${SZ}px;height:${SZ}px;` });
    boardEl.appendChild(shell);

    function render() {
      shell.innerHTML = '';
      let svg = `<svg width="${SZ}" height="${SZ}" style="position:absolute;left:0;top:0">`;
      for (let i = 0; i < 8; i++) {
        const a = pos(i), b = pos((i + 1) % 8), c = pos(8);
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(0,0,0,.4)" stroke-width="2"/><line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="rgba(0,0,0,.25)" stroke-width="2"/>`;
      }
      shell.insertAdjacentHTML('beforeend', svg + '</svg>');
      const targets = sel === null ? [] : moves(st).filter((m) => m.from === sel).map((m) => m.to);
      for (let i = 0; i < 9; i++) {
        const q = pos(i), d = Common.el('div', { class: 'point' + (sel === i ? ' selected' : '') + (targets.includes(i) ? ' movable' : '') });
        d.style.left = q.x + 'px'; d.style.top = q.y + 'px';
        if (!st.pts[i]) d.style.background = 'rgba(0,0,0,0.12)';
        else d.appendChild(Common.el('div', { class: 'piece ' + st.pts[i] }));
        d.addEventListener('click', () => click(i));
        shell.appendChild(d);
      }
      panel.setTurn(name(st.turn) + ' to move', st.turn === 'p1' ? '#e0a050' : '#556070');
      panel.setStats([{ label: 'Ochre mobility', value: moves({ pts: st.pts, turn: 'p1' }).length }, { label: 'Slate mobility', value: moves({ pts: st.pts, turn: 'p2' }).length }]);
    }
    function click(i) {
      if (dead || (AI && st.turn === AI)) return;
      const legal = moves(st), m = sel !== null && legal.find((x) => x.from === sel && x.to === i);
      if (m) { sel = null; st = apply(st, m); return after(); }
      sel = st.pts[i] === st.turn && legal.some((x) => x.from === i) ? i : null;
      render();
    }
    function after() {
      render();
      if (!moves(st).length) { dead = true; panel.setMessage(`${name(opp(st.turn))} wins — ${name(st.turn)} cannot move.`); return; }
      panel.setMessage(`${name(st.turn)} to move.`);
      if (AI && st.turn === AI) setTimeout(() => { if (dead) return; const m = Common.bestMove(st, 6, api); if (m) st = apply(st, m); after(); }, 400);
    }
    render();
    panel.setMessage('Ochre moves first. Slide to an empty neighbouring point on the ring. You may step into the centre only while your piece touches an enemy piece. A player who cannot move loses.');
    return { destroy() { dead = true; } };
  }

  GAMES.push({
    id: 'mutorere', name: 'Mū Tōrere', emblem: '✺', origin: 'Māori · Aotearoa (New Zealand)', sides: ['Ochre', 'Slate'],
    theme: { accent: '#d9833a', panel: '#2a1a14', board1: '#e6c79a', board2: '#d2a46c', p1Light: '#f2b266', p1Dark: '#b8672a', p2Light: '#6b7686', p2Dark: '#262c36' },
    tagline: 'Eight points and a star: a tiny Māori blocking game.',
    rules: '<strong>Mū Tōrere:</strong> each side has four pieces on the eight-point ring, with the centre (the <em>pūtahi</em>) empty. Move to an empty neighbouring ring point, or between ring and centre. A piece may enter the centre only if it is next to at least one enemy piece. Whoever cannot move loses.',
    engine: { init, moves, apply, api }, start,
  });
})();
