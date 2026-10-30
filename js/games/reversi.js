(function () {
  const N = 8, CELL = 48;
  const BOARD_PX = N * CELL;
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    board[3][3]='p2'; board[4][4]='p2';
    board[4][3]='p1'; board[3][4]='p1';
    return { board, turn:'p1' };
  }

  function flipsFor(board, r, c, player){
    if(board[r][c]) return [];
    const opp = player==='p1' ? 'p2':'p1';
    const all = [];
    for(const [dr,dc] of DIRS){
      const line=[];
      let nr=r+dr, nc=c+dc;
      while(inBounds(nr,nc) && board[nr][nc]===opp){ line.push({r:nr,c:nc}); nr+=dr; nc+=dc; }
      if(line.length>0 && inBounds(nr,nc) && board[nr][nc]===player) all.push(...line);
    }
    return all;
  }

  function allMoves(state){
    const out=[];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(state.board[r][c]) continue;
      if(flipsFor(state.board,r,c,state.turn).length>0) out.push({r,c});
    }
    return out;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    const flips = flipsFor(s.board, move.r, move.c, s.turn);
    s.board[move.r][move.c] = s.turn;
    flips.forEach(f => { s.board[f.r][f.c] = s.turn; });
    let next = s.turn==='p1' ? 'p2':'p1';
    s.turn = next;
    if(allMoves(s).length===0){
      s.turn = s.turn==='p1' ? 'p2':'p1'; // pass back if the other side has no moves either it stays, terminal check handles end
    }
    return s;
  }

  function countDiscs(board, player){
    let n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c]===player) n++;
    return n;
  }

  function isTerminal(state){
    return allMoves(state).length===0 && allMoves({...state, turn: state.turn==='p1'?'p2':'p1'}).length===0;
  }

  const CORNER_W = 25, EDGE_W = 5;
  function positionalWeight(r,c){
    if((r===0||r===N-1) && (c===0||c===N-1)) return CORNER_W;
    if((r===0||r===N-1) || (c===0||c===N-1)) return EDGE_W;
    return 1;
  }

  function makeApi(aiSide){
    const humanSide = aiSide==='p1' ? 'p2':'p1';
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        let mine=0, theirs=0;
        for(let r=0;r<N;r++) for(let c=0;c<N;c++){
          const p = state.board[r][c];
          if(p===aiSide) mine += positionalWeight(r,c);
          else if(p===humanSide) theirs += positionalWeight(r,c);
        }
        const mob = allMoves({...state, turn:aiSide}).length - allMoves({...state, turn:humanSide}).length;
        return (mine-theirs) + mob*2;
      },
    };
  }

  function labelFor(side){ return side==='p1' ? 'Black' : 'White'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    boardEl.appendChild(shell);

    function render(){
      shell.innerHTML='';
      const legal = allMoves(state);
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const div = Common.el('div', { class:'cell' });
        div.style.left=(c*CELL)+'px'; div.style.top=(r*CELL)+'px';
        div.style.width=CELL+'px'; div.style.height=CELL+'px';
        const piece = state.board[r][c];
        const isLegal = legal.some(m=>m.r===r && m.c===c);
        if(isLegal) div.classList.add('movable');
        div.appendChild(Common.el('div',{class:'hit', style:'border:1px solid rgba(0,0,0,0.15);'}));
        if(piece) div.appendChild(Common.el('div',{class:`piece ${piece}`, style:'width:38px;height:38px;'}));
        div.addEventListener('click', () => onClick(r,c));
        shell.appendChild(div);
      }
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#111' : '#eee');
      panel.setStats([
        { label:'Black discs', value: countDiscs(state.board,'p1') },
        { label:'White discs', value: countDiscs(state.board,'p2') },
      ]);
    }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const legal = allMoves(state);
      if(!legal.some(m=>m.r===r && m.c===c)) return;
      state = applyMove(state, {r,c});
      afterMove();
    }

    function afterMove(){
      if(isTerminal(state)){
        render();
        const b = countDiscs(state.board,'p1'), w = countDiscs(state.board,'p2');
        const winner = b===w ? null : (b>w ? 'Black':'White');
        panel.setMessage(winner ? `Game over — Black ${b}, White ${w}. ${winner} wins.` : `Game over — Black ${b}, White ${w}. It's a tie.`);
        return;
      }
      render();
      const noMovesForMover = allMoves(state).length===0;
      panel.setMessage(noMovesForMover ? `${labelFor(state.turn)} has no legal move and passes.` : `${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 350);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 3, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    render();
    panel.setMessage('Black moves first. Place a disc that sandwiches one or more enemy discs in a line to flip them to your color. A side with no legal move passes automatically.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'reversi',
    name:'Reversi (Othello)',
    emblem:'◍',
    theme: { accent:'#2f9e63', panel:'#122016', board1:'#1f6b40', board2:'#155230', p1Light:'#3a3a3a', p1Dark:'#0a0a0a', p2Light:'#fdfdfd', p2Dark:'#cfcfcf' },
    tagline:'Flip-and-claim disc game on an 8×8 board.',
    rules:'<strong>Reversi (Othello):</strong> place a disc so that it sandwiches one or more opposing discs, in any of the 8 directions, between your new disc and another disc of yours already on the board — all sandwiched discs flip to your color. If you have no legal move, your turn is skipped. Most discs on the board when neither side can move wins.',
    start,
  });
})();
