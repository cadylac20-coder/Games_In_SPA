(function () {
  const N = 20, CELL = 20;
  const BOARD_PX = N * CELL;
  const CORNERS = { p1:{r:0,c:0}, p2:{r:19,c:19} };

  const BASE_PIECES = [
    { id:'mono1', cells:[[0,0]] },
    { id:'domino2', cells:[[0,0],[0,1]] },
    { id:'tri3_I', cells:[[0,0],[0,1],[0,2]] },
    { id:'tri3_L', cells:[[0,0],[1,0],[1,1]] },
    { id:'tet4_I', cells:[[0,0],[0,1],[0,2],[0,3]] },
    { id:'tet4_O', cells:[[0,0],[0,1],[1,0],[1,1]] },
    { id:'tet4_L', cells:[[0,0],[1,0],[2,0],[2,1]] },
    { id:'tet4_S', cells:[[0,1],[0,2],[1,0],[1,1]] },
    { id:'tet4_T', cells:[[0,0],[0,1],[0,2],[1,1]] },
    { id:'pent5_I', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
    { id:'pent5_L', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
    { id:'pent5_Y', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
    { id:'pent5_N', cells:[[0,1],[1,1],[1,0],[2,0],[3,0]] },
    { id:'pent5_T', cells:[[0,0],[0,1],[0,2],[1,1],[2,1]] },
    { id:'pent5_U', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
    { id:'pent5_V', cells:[[0,0],[1,0],[2,0],[2,1],[2,2]] },
    { id:'pent5_W', cells:[[0,0],[1,0],[1,1],[2,1],[2,2]] },
    { id:'pent5_X', cells:[[0,1],[1,0],[1,1],[1,2],[2,1]] },
    { id:'pent5_Z', cells:[[0,1],[0,2],[1,1],[2,0],[2,1]] },
    { id:'pent5_F', cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] },
    { id:'pent5_P', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
  ];

  function normalize(cells){
    const minR = Math.min(...cells.map(c=>c[0]));
    const minC = Math.min(...cells.map(c=>c[1]));
    return cells.map(([r,c]) => [r-minR, c-minC]).sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  }
  function rotate(cells){ return normalize(cells.map(([r,c]) => [c, -r])); }
  function flip(cells){ return normalize(cells.map(([r,c]) => [r, -c])); }
  function keyOf(cells){ return cells.map(c => c.join(',')).join('|'); }

  function uniqueOrientations(baseCells){
    const seen = new Map();
    let cur = normalize(baseCells);
    for(let f=0; f<2; f++){
      let rc = cur;
      for(let r=0; r<4; r++){
        const k = keyOf(rc);
        if(!seen.has(k)) seen.set(k, rc);
        rc = rotate(rc);
      }
      cur = flip(cur);
    }
    return [...seen.values()];
  }

  const PIECES = BASE_PIECES.map(p => ({ id:p.id, size:p.cells.length, orientations: uniqueOrientations(p.cells) }));

  function initState(){
    return {
      board: Array.from({length:N}, () => Array(N).fill(null)),
      remaining: {
        p1: PIECES.map(p => p.id),
        p2: PIECES.map(p => p.id),
      },
      hasPlaced: { p1:false, p2:false },
      turn: 'p1',
      passedInRow: 0,
      gameOver: false,
    };
  }

  function pieceById(id){ return PIECES.find(p => p.id===id); }

  function isValidPlacement(state, player, cells){
    for(const [r,c] of cells){
      if(r<0||r>=N||c<0||c>=N) return false;
      if(state.board[r][c]) return false;
    }
    if(!state.hasPlaced[player]){
      const corner = CORNERS[player];
      return cells.some(([r,c]) => r===corner.r && c===corner.c);
    }
    let touchesOwnCorner = false;
    for(const [r,c] of cells){
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nr=r+dr, nc=c+dc;
        if(nr>=0 && nr<N && nc>=0 && nc<N && state.board[nr][nc]===player) return false;
      }
      for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
        const nr=r+dr, nc=c+dc;
        if(nr>=0 && nr<N && nc>=0 && nc<N && state.board[nr][nc]===player) touchesOwnCorner = true;
      }
    }
    return touchesOwnCorner;
  }

  function anyLegalPlacement(state, player){
    for(const pid of state.remaining[player]){
      const piece = pieceById(pid);
      for(const orient of piece.orientations){
        const maxR = Math.max(...orient.map(c=>c[0]));
        const maxC = Math.max(...orient.map(c=>c[1]));
        for(let R=0; R<=N-1-maxR; R++){
          for(let C=0; C<=N-1-maxC; C++){
            const cells = orient.map(([r,c]) => [R+r, C+c]);
            if(isValidPlacement(state, player, cells)) return true;
          }
        }
      }
    }
    return false;
  }

  function applyPlacement(state, player, pieceId, cells){
    const s = Common.clone(state);
    cells.forEach(([r,c]) => { s.board[r][c] = player; });
    s.remaining[player] = s.remaining[player].filter(id => id!==pieceId);
    s.hasPlaced[player] = true;
    s.passedInRow = 0;
    s.turn = player==='p1' ? 'p2':'p1';
    return s;
  }

  function applyPass(state){
    const s = Common.clone(state);
    s.passedInRow++;
    s.turn = s.turn==='p1' ? 'p2':'p1';
    if(s.passedInRow>=2) s.gameOver = true;
    return s;
  }

  function remainingScore(state, player){
    return state.remaining[player].reduce((sum,id) => sum + pieceById(id).size, 0);
  }

  function aiChooseMove(state){
    const player = state.turn;
    const pieces = state.remaining[player].map(pieceById).sort((a,b) => b.size-a.size);
    for(const piece of pieces){
      const candidates = [];
      for(const orient of piece.orientations){
        const maxR = Math.max(...orient.map(c=>c[0]));
        const maxC = Math.max(...orient.map(c=>c[1]));
        for(let R=0; R<=N-1-maxR; R++){
          for(let C=0; C<=N-1-maxC; C++){
            const cells = orient.map(([r,c]) => [R+r, C+c]);
            if(isValidPlacement(state, player, cells)) candidates.push({ pieceId:piece.id, cells });
          }
        }
      }
      if(candidates.length>0) return candidates[Math.floor(Math.random()*candidates.length)];
    }
    return null;
  }

  function labelFor(side){ return side==='p1' ? 'Indigo' : 'Terracotta'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selectedPieceId = null;
    let orientIndex = 0;
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;

    boardEl.innerHTML='';
    const wrap = Common.el('div', { style:'display:flex;flex-direction:column;gap:10px;align-items:center;' });
    const boardShell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;background:#f5f2e9;border:1px solid rgba(138,90,52,0.4);` });
    const controlsRow = Common.el('div', { style:'display:flex;gap:8px;' });
    const trayTop = Common.el('div', { style:'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;max-width:520px;' });
    const trayBottom = Common.el('div', { style:'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;max-width:520px;' });
    wrap.appendChild(Common.el('div', { text:'Terracotta pieces', style:'font-size:0.75rem;color:#b7c1d9;' }));
    wrap.appendChild(trayTop);
    wrap.appendChild(boardShell);
    wrap.appendChild(controlsRow);
    wrap.appendChild(Common.el('div', { text:'Indigo pieces', style:'font-size:0.75rem;color:#b7c1d9;' }));
    wrap.appendChild(trayBottom);
    boardEl.appendChild(wrap);

    const rotateBtn = Common.el('button', { text:'Rotate ⟳', onclick: () => { cycleOrient(1); } });
    const flipBtn = Common.el('button', { text:'Flip ⇋', onclick: () => { flipSelected(); } });
    const passBtn = Common.el('button', { text:'Pass turn', onclick: () => { onPass(); } });
    controlsRow.appendChild(rotateBtn); controlsRow.appendChild(flipBtn); controlsRow.appendChild(passBtn);

    function currentOrientations(){
      if(!selectedPieceId) return null;
      return pieceById(selectedPieceId).orientations;
    }
    function cycleOrient(dir){
      const orients = currentOrientations();
      if(!orients) return;
      orientIndex = (orientIndex + dir + orients.length) % orients.length;
      render();
    }
    function flipSelected(){
      // approximate a flip by jumping halfway through the orientation list (covers mirrored variants for asymmetric pieces)
      const orients = currentOrientations();
      if(!orients) return;
      orientIndex = (orientIndex + Math.ceil(orients.length/2)) % orients.length;
      render();
    }

    function renderTray(container, player){
      container.innerHTML='';
      state.remaining[player].map(pieceById).forEach((piece) => {
        const cells = piece.orientations[0];
        const maxR = Math.max(...cells.map(c=>c[0]))+1, maxC = Math.max(...cells.map(c=>c[1]))+1;
        const mini = Common.el('div', {
          style:`position:relative;width:${maxC*7+6}px;height:${maxR*7+6}px;padding:3px;cursor:pointer;border-radius:4px;${selectedPieceId===piece.id ? 'background:rgba(201,154,74,0.35);' : ''}`,
          onclick: () => { if(state.turn===player) { selectedPieceId = piece.id; orientIndex = 0; render(); } },
        });
        cells.forEach(([r,c]) => {
          mini.appendChild(Common.el('div', { style:`position:absolute;left:${3+c*7}px;top:${3+r*7}px;width:6px;height:6px;background:${player==='p1' ? '#4f6fae' : '#c1502e'};` }));
        });
        container.appendChild(mini);
      });
    }

    function render(){
      boardShell.innerHTML='';
      const orients = currentOrientations();
      const preview = orients ? orients[orientIndex] : null;
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const div = Common.el('div');
        div.style.position='absolute'; div.style.left=(c*CELL)+'px'; div.style.top=(r*CELL)+'px';
        div.style.width=CELL+'px'; div.style.height=CELL+'px';
        div.style.border='1px solid rgba(138,90,52,0.15)';
        const owner = state.board[r][c];
        if(owner) div.style.background = owner==='p1' ? '#4f6fae' : '#c1502e';
        div.addEventListener('click', () => onCellClick(r,c));
        boardShell.appendChild(div);
      }
      if(preview && !(mode==='ai' && state.turn===AI_SIDE)){
        // ghost preview is added on hover via mouseover per cell for simplicity; skipped for brevity
      }
      (CORNERS.p1.r===0 ? [] : []); // no-op, corners drawn below
      ['p1','p2'].forEach((pl) => {
        const k = CORNERS[pl];
        const marker = Common.el('div', { style:`position:absolute;left:${k.c*CELL}px;top:${k.r*CELL}px;width:${CELL}px;height:${CELL}px;box-shadow:inset 0 0 0 2px ${pl==='p1'?'#4f6fae':'#c1502e'};pointer-events:none;` });
        boardShell.appendChild(marker);
      });

      renderTray(trayBottom, 'p1');
      renderTray(trayTop, 'p2');
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#4f6fae' : '#c1502e');
      panel.setStats([
        { label:'Indigo squares left', value: remainingScore(state,'p1') },
        { label:'Terracotta squares left', value: remainingScore(state,'p2') },
      ]);
      rotateBtn.disabled = !selectedPieceId;
      flipBtn.disabled = !selectedPieceId;
    }

    function onCellClick(r,c){
      if(destroyed || state.gameOver) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(!selectedPieceId){ panel.setMessage('Select a piece from your tray first.'); return; }
      const orients = currentOrientations();
      const orient = orients[orientIndex];
      const cells = orient.map(([dr,dc]) => [r+dr, c+dc]);
      if(!isValidPlacement(state, state.turn, cells)){
        panel.setMessage('That placement is not legal there — remember, your pieces may only touch your own color at a corner, never along an edge.');
        return;
      }
      state = applyPlacement(state, state.turn, selectedPieceId, cells);
      selectedPieceId = null; orientIndex = 0;
      afterMove();
    }

    function onPass(){
      if(destroyed || state.gameOver) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      state = applyPass(state);
      selectedPieceId = null;
      afterMove();
    }

    function afterMove(){
      if(state.gameOver){
        render();
        const s1 = remainingScore(state,'p1'), s2 = remainingScore(state,'p2');
        const winner = s1===s2 ? null : (s1<s2 ? 'Indigo' : 'Terracotta');
        panel.setMessage(winner ? `Both sides passed. Squares left — Indigo ${s1}, Terracotta ${s2}. ${winner} wins.` : `Both sides passed. It's a tie, ${s1} squares left each.`);
        return;
      }
      render();
      if(!anyLegalPlacement(state, state.turn)){
        panel.setMessage(`${labelFor(state.turn)} has no legal placement and must pass.`);
        setTimeout(() => { state = applyPass(state); afterMove(); }, 700);
        return;
      }
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 450);
    }

    function aiTurn(){
      if(destroyed) return;
      if(!anyLegalPlacement(state, state.turn)){ state = applyPass(state); afterMove(); return; }
      const mv = aiChooseMove(state);
      if(mv) state = applyPlacement(state, state.turn, mv.pieceId, mv.cells);
      else state = applyPass(state);
      afterMove();
    }

    render();
    panel.setMessage('Indigo moves first, starting from the top-left corner. Select a piece, rotate/flip if needed, then click the board cell for its top-left corner to place it.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'blokus',
    name:'Blokus',
    emblem:'▧',
    theme: { accent:'#e0483e', panel:'#241b2e', board1:'#f5f2e9', board2:'#e9e3d0' },
    tagline:'2-player polyomino placement race on a 20×20 board.',
    rules:"<strong>Blokus (2-player):</strong> the full 21-piece set per side. Your first piece must cover your starting corner. Every later piece must touch at least one of your own pieces corner-to-corner (diagonally) and must never touch your own color edge-to-edge — touching an opponent's pieces along an edge is fine. Click a piece in your tray, rotate/flip as needed, then click the board cell where its top-left corner should land. When neither side can place anything, fewer unplaced squares wins. (Official scoring bonuses for placing every piece, or finishing with the monomino, are omitted here.)",
    start,
  });
})();
