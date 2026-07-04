(function () {
  const N = 6, SPACING = 70, MARGIN = 48;
  const BOARD_PX = MARGIN * 2 + SPACING * (N - 1);
  const DIRV = { N: [-1,0], S: [1,0], E: [0,1], W: [0,-1], NE:[-1,1], NW:[-1,-1], SE:[1,1], SW:[1,-1] };
  const ORTHO = ['N','S','E','W'];
  const ALL8 = ['N','S','E','W','NE','NW','SE','SW'];
  const WRAPS = {
    "1,0,W": {r:0,c:1,dir:'S'}, "0,1,N": {r:1,c:0,dir:'E'},
    "1,5,E": {r:0,c:4,dir:'S'}, "0,4,N": {r:1,c:5,dir:'W'},
    "4,0,W": {r:5,c:1,dir:'N'}, "5,1,S": {r:4,c:0,dir:'E'},
    "4,5,E": {r:5,c:4,dir:'N'}, "5,4,S": {r:4,c:5,dir:'W'},
  };
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    for(let c=0;c<N;c++){
      board[0][c]='p2'; board[1][c]='p2';
      board[4][c]='p1'; board[5][c]='p1';
    }
    return { board, turn:'p1', capturedP1:0, capturedP2:0 };
  }

  function getCaptureTarget(board,r,c,dir,player){
    let cur={r,c}, curDir=dir;
    for(let s=0;s<40;s++){
      const v=DIRV[curDir];
      const nr=cur.r+v[0], nc=cur.c+v[1];
      if(inBounds(nr,nc)){
        const occ=board[nr][nc];
        if(!occ){ cur={r:nr,c:nc}; continue; }
        if(occ!==player) return {r:nr,c:nc};
        return null;
      } else {
        const w = WRAPS[`${cur.r},${cur.c},${curDir}`];
        if(!w) return null;
        const occ = board[w.r][w.c];
        if(!occ){ cur={r:w.r,c:w.c}; curDir=w.dir; continue; }
        if(occ!==player) return {r:w.r,c:w.c};
        return null;
      }
    }
    return null;
  }

  function movesForPiece(board,r,c){
    const p = board[r][c];
    if(!p) return [];
    const moves=[];
    for(const dir of ORTHO){
      const t = getCaptureTarget(board,r,c,dir,p);
      if(t) moves.push({from:{r,c}, to:t, type:'capture'});
    }
    for(const dir of ALL8){
      const v=DIRV[dir];
      const nr=r+v[0], nc=c+v[1];
      if(inBounds(nr,nc) && !board[nr][nc]) moves.push({from:{r,c}, to:{r:nr,c:nc}, type:'move'});
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

  function countPieces(board,player){
    let n=0;
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c]===player) n++;
    return n;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    const mover = s.board[move.from.r][move.from.c];
    if(move.type==='capture'){
      if(mover==='p1') s.capturedP1++; else s.capturedP2++;
    }
    s.board[move.to.r][move.to.c] = mover;
    s.board[move.from.r][move.from.c] = null;
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
        return (mine - theirs) * 10 + (allMoves({...state, turn:aiSide}).length * 0.1);
      },
    };
  }

  function start(ctx){
    const { boardEl, panel, mode, aiSide } = ctx;
    let state = initState();
    let selected = null;
    let destroyed = false;
    const api = makeApi(aiSide === 'p1' ? 'p2' : aiSide || 'p2');
    const AI_SIDE = mode === 'ai' ? 'p2' : null;

    boardEl.innerHTML = '';
    const shell = Common.el('div', { style: `position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width', BOARD_PX); svg.setAttribute('height', BOARD_PX);
    svg.setAttribute('viewBox', `0 0 ${BOARD_PX} ${BOARD_PX}`);
    svg.style.position='absolute'; svg.style.left='0'; svg.style.top='0';
    const pointsLayer = Common.el('div', { style: 'position:absolute;left:0;top:0;width:100%;height:100%;' });
    shell.appendChild(svg); shell.appendChild(pointsLayer);
    boardEl.appendChild(shell);

    function px(i){ return MARGIN + i*SPACING; }

    function drawGrid(){
      let s='';
      const stroke='rgba(138,90,52,0.55)';
      for(let i=0;i<N;i++){
        s += `<line x1="${px(0)}" y1="${px(i)}" x2="${px(N-1)}" y2="${px(i)}" stroke="${stroke}" stroke-width="1.5"/>`;
        s += `<line x1="${px(i)}" y1="${px(0)}" x2="${px(i)}" y2="${px(N-1)}" stroke="${stroke}" stroke-width="1.5"/>`;
      }
      for(let r=0;r<N-1;r++) for(let c=0;c<N-1;c++){
        s += `<line x1="${px(c)}" y1="${px(r)}" x2="${px(c+1)}" y2="${px(r+1)}" stroke="${stroke}" stroke-width="0.75" opacity="0.6"/>`;
        s += `<line x1="${px(c+1)}" y1="${px(r)}" x2="${px(c)}" y2="${px(r+1)}" stroke="${stroke}" stroke-width="0.75" opacity="0.6"/>`;
      }
      const loops = [[[1,0],[0,1],[-1.1,-1.1]], [[1,5],[0,4],[-1.1,6.1]], [[4,0],[5,1],[6.1,-1.1]], [[4,5],[5,4],[6.1,6.1]]];
      for(const [a,b,ctrl] of loops){
        s += `<path d="M ${px(a[1])} ${px(a[0])} Q ${px(ctrl[1])} ${px(ctrl[0])} ${px(b[1])} ${px(b[0])}" fill="none" stroke="#c99a4a" stroke-width="2"/>`;
      }
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
        if(mv && mv.type==='move') div.classList.add('movable');
        if(mv && mv.type==='capture') div.classList.add('capturable');
        div.appendChild(Common.el('div',{class:'hit'}));
        if(piece) div.appendChild(Common.el('div',{class:`piece ${piece}`}));
        div.addEventListener('click', () => onClick(r,c));
        pointsLayer.appendChild(div);
      }
      panel.setTurn(labelFor(state.turn) + ' to move', state.turn==='p1' ? '#e8dcc0' : '#3a2a1e');
      panel.setStats([
        { label:'Ivory captured', value: state.capturedP1 },
        { label:'Ebony captured', value: state.capturedP2 },
      ]);
    }

    function labelFor(side){ return side==='p1' ? 'Ivory' : 'Ebony'; }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const piece = state.board[r][c];
      if(selected){
        const legal = movesForPiece(state.board, selected.r, selected.c);
        const mv = legal.find(m=>m.to.r===r && m.to.c===c);
        if(mv){
          state = applyMove(state, mv);
          selected = null;
          afterMove();
          return;
        }
      }
      selected = (piece===state.turn) ? {r,c} : null;
      render();
    }

    function afterMove(){
      if(countPieces(state.board,'p1')===0){ endGame('Ebony wins — all of Ivory\'s pieces are gone.'); return; }
      if(countPieces(state.board,'p2')===0){ endGame('Ivory wins — all of Ebony\'s pieces are gone.'); return; }
      if(allMoves(state).length===0){
        const winner = state.turn==='p1' ? 'Ebony' : 'Ivory';
        endGame(`${labelFor(state.turn)} has no legal moves — ${winner} wins.`);
        return;
      }
      render();
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 350);
    }

    function endGame(text){
      render();
      panel.setMessage(text);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 2, api);
      if(mv){ state = applyMove(state, mv); }
      afterMove();
    }

    drawGrid();
    render();
    panel.setMessage('Ivory moves first. Captures slide through the loops at the corners.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id: 'surakarta',
    name: 'Surakarta',
    emblem: '◉',
    theme: { accent:'#c99a4a', panel:'#223258', board1:'#f4ecda', board2:'#efe6d3', p1Light:'#fffaf0', p1Dark:'#d8c8a2', p2Light:'#4a3a2c', p2Dark:'#17100b' },
    tagline: 'Javanese loop-capture game on a 6×6 board.',
    rules: '<strong>Surakarta:</strong> step one square any direction to move; capture by sliding orthogonally, curling through a corner loop if the line reaches one, and landing on the first enemy piece found. Own pieces block the line. Captures are optional.',
    start,
  });
})();
