(function () {
  const N = 5, SPACING = 78, MARGIN = 46;
  const BOARD_PX = MARGIN * 2 + SPACING * (N - 1);
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    for(let c=0;c<N;c++){
      board[0][c]='p1'; board[1][c]='p1';
      board[3][c]='p2'; board[4][c]='p2';
    }
    return { board, turn:'p1', capturedP1:0, capturedP2:0 };
  }

  function countPieces(board,player){
    let n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c]===player) n++;
    return n;
  }

  function movesForPiece(board,r,c){
    const p = board[r][c];
    if(!p) return [];
    const moves=[];
    for(const [dr,dc] of DIRS){
      const nr=r+dr, nc=c+dc;
      if(inBounds(nr,nc) && !board[nr][nc]) moves.push({from:{r,c}, to:{r:nr,c:nc}});
    }
    return moves;
  }

  function allMoves(state){
    const out=[];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(state.board[r][c]===state.turn) out.push(...movesForPiece(state.board,r,c));
    }
    return out;
  }

  function captureFrom(board, r, c, player){
    const opp = player==='p1' ? 'p2' : 'p1';
    const captured = [];
    for(const [dr,dc] of DIRS){
      const line=[];
      let nr=r+dr, nc=c+dc;
      while(inBounds(nr,nc) && board[nr][nc]===opp){ line.push({r:nr,c:nc}); nr+=dr; nc+=dc; }
      if(line.length>0 && inBounds(nr,nc) && board[nr][nc]===player) captured.push(...line);
    }
    return captured;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    const mover = s.board[move.from.r][move.from.c];
    s.board[move.to.r][move.to.c] = mover;
    s.board[move.from.r][move.from.c] = null;
    const captured = captureFrom(s.board, move.to.r, move.to.c, mover);
    for(const cell of captured){
      s.board[cell.r][cell.c] = null;
      if(mover==='p1') s.capturedP1++; else s.capturedP2++;
    }
    s.turn = s.turn==='p1' ? 'p2' : 'p1';
    return s;
  }

  function isTerminal(state){
    return countPieces(state.board,'p1')===0 || countPieces(state.board,'p2')===0 || allMoves(state).length===0;
  }

  function makeApi(aiSide){
    const humanSide = aiSide==='p1' ? 'p2' : 'p1';
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        const mine = countPieces(state.board, aiSide);
        const theirs = countPieces(state.board, humanSide);
        return (mine - theirs) * 10 + allMoves({...state, turn:aiSide}).length * 0.1;
      },
    };
  }

  function labelFor(side){ return side==='p1' ? 'Amber' : 'Umber'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width', BOARD_PX); svg.setAttribute('height', BOARD_PX);
    svg.style.position='absolute'; svg.style.left='0'; svg.style.top='0';
    const pointsLayer = Common.el('div', { style:'position:absolute;left:0;top:0;width:100%;height:100%;' });
    shell.appendChild(svg); shell.appendChild(pointsLayer);
    boardEl.appendChild(shell);

    function px(i){ return MARGIN + i*SPACING; }

    function drawGrid(){
      let s=''; const stroke='rgba(138,90,52,0.55)';
      for(let i=0;i<N;i++){
        s += `<line x1="${px(0)}" y1="${px(i)}" x2="${px(N-1)}" y2="${px(i)}" stroke="${stroke}" stroke-width="1.5"/>`;
        s += `<line x1="${px(i)}" y1="${px(0)}" x2="${px(i)}" y2="${px(N-1)}" stroke="${stroke}" stroke-width="1.5"/>`;
      }
      s += `<circle cx="${px(2)}" cy="${px(2)}" r="5" fill="#c99a4a"/>`;
      svg.innerHTML = s;
    }

    function render(){
      pointsLayer.innerHTML='';
      const legal = selected ? movesForPiece(state.board, selected.r, selected.c) : [];
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const div = Common.el('div', { class:'point' });
        div.style.left = px(c)+'px'; div.style.top = px(r)+'px';
        const piece = state.board[r][c];
        const mv = legal.find(m=>m.to.r===r && m.to.c===c);
        if(selected && selected.r===r && selected.c===c) div.classList.add('selected');
        if(mv) div.classList.add('movable');
        div.appendChild(Common.el('div',{class:'hit'}));
        if(piece) div.appendChild(Common.el('div',{class:`piece ${piece}`}));
        div.addEventListener('click', () => onClick(r,c));
        pointsLayer.appendChild(div);
      }
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#e8dcc0' : '#3a2a1e');
      panel.setStats([
        { label:'Amber captured', value: state.capturedP1 },
        { label:'Umber captured', value: state.capturedP2 },
      ]);
    }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const piece = state.board[r][c];
      if(selected){
        const legal = movesForPiece(state.board, selected.r, selected.c);
        const mv = legal.find(m=>m.to.r===r && m.to.c===c);
        if(mv){ state = applyMove(state, mv); selected=null; afterMove(); return; }
      }
      selected = (piece===state.turn) ? {r,c} : null;
      render();
    }

    function afterMove(){
      if(countPieces(state.board,'p1')===0){ render(); panel.setMessage('Umber wins — Amber has no pieces left.'); return; }
      if(countPieces(state.board,'p2')===0){ render(); panel.setMessage('Amber wins — Umber has no pieces left.'); return; }
      if(allMoves(state).length===0){
        const winner = state.turn==='p1' ? 'Umber' : 'Amber';
        render(); panel.setMessage(`${labelFor(state.turn)} has no legal moves — ${winner} wins.`);
        return;
      }
      render();
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 350);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 3, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    drawGrid();
    render();
    panel.setMessage('Amber moves first. Sandwich an enemy piece between two of yours (in a straight line) to capture it.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'seega',
    name:'Seega',
    emblem:'▦',
    theme: { accent:'#d97b4f', panel:'#3a2418', board1:'#f0dfc2', board2:'#e8d4ab', p1Light:'#f2c675', p1Dark:'#c98a2e', p2Light:'#5a3a24', p2Dark:'#2a1810' },
    tagline:'Egyptian custodian-capture game on a 5×5 board.',
    rules:'<strong>Seega:</strong> move one step orthogonally onto an empty square. If your move sandwiches one or more enemy pieces in a straight line between the piece you moved and another of your own pieces, those enemy pieces are captured. This simplified setup skips the traditional turn-by-turn placement phase and starts with two full rows per side.',
    start,
  });
})();
