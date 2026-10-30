(function () {
  const N = 8, CELL = 52;
  const BOARD_PX = N * CELL;
  const COLORS = ['brown','green','red','yellow','pink','purple','blue','orange'];
  const COLOR_HEX = {
    brown:'#7a5230', green:'#3f8f4f', red:'#c0392b', yellow:'#e0c23c',
    pink:'#e08fb0', purple:'#7d5aa6', blue:'#3f6fb0', orange:'#e07b39',
  };
  const PASS_CAP = 24;

  function colorAt(r,c){ return COLORS[((c - r) % 8 + 8) % 8]; }
  function opp(s){ return s==='p1' ? 'p2' : 'p1'; }
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  // p1 = Black, home row 7, moves "forward" = decreasing row.
  // p2 = Gold,  home row 0, moves "forward" = increasing row.
  function forwardDirs(side){
    return side==='p1' ? [[-1,0],[-1,-1],[-1,1]] : [[1,0],[1,-1],[1,1]];
  }

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    for(let c=0;c<N;c++){
      board[7][c] = { side:'p1', color: colorAt(7,c) };
      board[0][c] = { side:'p2', color: colorAt(0,c) };
    }
    return { board, turn:'p1', forcedColor:null, deadlock:false, deadlockLoser:null };
  }

  function findTower(board, side, color){
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const p=board[r][c]; if(p && p.side===side && p.color===color) return {r,c}; }
    return null;
  }

  function movesForTower(board, r, c){
    const p = board[r][c];
    if(!p) return [];
    const out = [];
    for(const [dr,dc] of forwardDirs(p.side)){
      let nr=r+dr, nc=c+dc;
      while(inBounds(nr,nc) && !board[nr][nc]){
        out.push({ from:{r,c}, to:{r:nr,c:nc} });
        nr+=dr; nc+=dc;
      }
    }
    return out;
  }

  function winner(state){
    for(let c=0;c<N;c++){
      if(state.board[0][c] && state.board[0][c].side==='p1') return 'p1';
      if(state.board[7][c] && state.board[7][c].side==='p2') return 'p2';
    }
    if(state.deadlock) return opp(state.deadlockLoser);
    return null;
  }

  function rawMoves(state){
    if(winner(state)) return [];
    if(state.forcedColor===null){
      const out=[];
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const p = state.board[r][c];
        if(p && p.side===state.turn) out.push(...movesForTower(state.board,r,c));
      }
      return out;
    }
    const pos = findTower(state.board, state.turn, state.forcedColor);
    if(!pos) return [];
    return movesForTower(state.board, pos.r, pos.c);
  }

  // Resolves chains of forced-pass "the required tower can't move" situations.
  function resolveForced(state){
    let passes = 0;
    while(!winner(state) && rawMoves(state).length===0 && passes < PASS_CAP){
      state.turn = opp(state.turn);
      passes++;
    }
    if(passes >= PASS_CAP && !winner(state)){
      state.deadlock = true;
      state.deadlockLoser = state.turn;
    }
    return state;
  }

  function allMoves(state){ return rawMoves(state); }

  function applyMove(state, move){
    const s = Common.clone(state);
    const mover = s.board[move.from.r][move.from.c];
    s.board[move.to.r][move.to.c] = mover;
    s.board[move.from.r][move.from.c] = null;
    s.forcedColor = colorAt(move.to.r, move.to.c);
    s.turn = opp(s.turn);
    resolveForced(s);
    return s;
  }

  function isTerminal(state){ return !!winner(state) || allMoves(state).length===0; }

  function labelFor(side){ return side==='p1' ? 'Black' : 'Gold'; }

  function progress(p){ return p.side==='p1' ? (7 - p.r) : p.r; }

  function makeApi(aiSide){
    const humanSide = opp(aiSide);
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        const w = winner(state);
        if(w===aiSide) return 1000;
        if(w===humanSide) return -1000;
        let score = 0;
        for(let r=0;r<N;r++) for(let c=0;c<N;c++){
          const p = state.board[r][c];
          if(!p) continue;
          const prog = (p.side==='p1' ? (7-r) : r);
          score += (p.side===aiSide ? prog : -prog);
        }
        score += (allMoves({...state, turn:aiSide}).length - allMoves({...state, turn:humanSide}).length) * 0.2;
        return score;
      },
    };
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML = '';
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    const cellsLayer = Common.el('div', { style:'position:absolute;left:0;top:0;width:100%;height:100%;' });
    shell.appendChild(cellsLayer);
    boardEl.appendChild(shell);

    function px(i){ return i*CELL; }

    function autoSelect(){
      if(state.forcedColor!==null){
        const pos = findTower(state.board, state.turn, state.forcedColor);
        selected = pos;
      }
    }

    function render(){
      cellsLayer.innerHTML = '';
      const legal = selected ? movesForTower(state.board, selected.r, selected.c) : [];
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const bg = COLOR_HEX[colorAt(r,c)];
        const div = Common.el('div', { class:'cell', style:`background:${bg};` });
        div.style.left = px(c)+'px'; div.style.top = px(r)+'px';
        div.style.width = CELL+'px'; div.style.height = CELL+'px';
        const piece = state.board[r][c];
        const mv = legal.find(m => m.to.r===r && m.to.c===c);
        if(selected && selected.r===r && selected.c===c) div.style.boxShadow = 'inset 0 0 0 3px #fff';
        if(mv) div.classList.add('movable');
        div.appendChild(Common.el('div',{class:'hit'}));
        if(piece){
          const disc = Common.el('div', {
            style:`width:36px;height:36px;border-radius:10px;background:${COLOR_HEX[piece.color]};` +
              `display:flex;align-items:center;justify-content:center;font-size:1.1rem;` +
              `box-shadow:${piece.side==='p1' ? '0 0 0 3px #1a1410, 0 3px 6px rgba(0,0,0,0.5)' : '0 0 0 3px #f0e6c8, 0 3px 6px rgba(0,0,0,0.5)'};`
          });
          disc.textContent = '\u{1F409}';
          div.appendChild(disc);
        }
        div.addEventListener('click', () => onClick(r,c));
        cellsLayer.appendChild(div);
      }
      const req = state.forcedColor ? `Move your ${state.forcedColor} tower.` : 'Move any tower to start.';
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#241a14' : '#e8dcc0');
      panel.setStats([
        { label:'Black best row', value: bestProgress(state.board,'p1') },
        { label:'Gold best row', value: bestProgress(state.board,'p2') },
      ]);
      panel.setMessage(req);
    }

    function bestProgress(board, side){
      let best = 0;
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const p=board[r][c]; if(p && p.side===side) best = Math.max(best, progress(p)); }
      return best + '/7';
    }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const piece = state.board[r][c];
      if(selected){
        const legal = movesForTower(state.board, selected.r, selected.c);
        const mv = legal.find(m => m.to.r===r && m.to.c===c);
        if(mv){ state = applyMove(state, mv); selected=null; afterMove(); return; }
      }
      if(state.forcedColor===null && piece && piece.side===state.turn) selected = {r,c};
      render();
    }

    function afterMove(){
      const w = winner(state);
      if(w){ autoSelect(); render(); panel.setMessage(`${labelFor(w)} wins by reaching the home row!`); return; }
      autoSelect();
      render();
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 3, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    autoSelect();
    render();
    panel.setMessage('Black moves first and may choose any tower. After that, you must move the tower whose color matches the square your opponent just landed on. Move straight or diagonally forward any distance, never through or onto an occupied square. First tower to reach the far row wins.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'kamisado',
    name:'Kamisado',
    emblem:'\u{1F409}',
    theme: { accent:'#c99a4a', panel:'#241f1a', board1:'#ece2c8', board2:'#c9b98a', p1Light:'#3a3a3a', p1Dark:'#0a0a0a', p2Light:'#fdfdfd', p2Dark:'#cfcfcf' },
    tagline:'8x8 coloured race — the square you land on picks your opponent\'s next tower.',
    rules:'<strong>Kamisado:</strong> each of your 8 towers matches one of the 8 board colors. Black moves first and may pick any tower; after that, each player must move the tower whose color matches the square the opponent\'s last tower landed on. Towers move any distance straight or diagonally forward, never sideways or back, and never through or onto an occupied square. First to place a tower on the opponent\'s home row wins. This version implements the Single Round base game only — the Sumo/match-scoring rules from longer formats are not modeled, and the board\'s color arrangement is a simplified Latin-square layout (each color appears once per row and column) rather than the exact printed board.',
    start,
  });
})();
