(function () {
  const N = 9, CELL = 46;
  const BOARD_PX = N * CELL;
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  const CORNERS = [{r:0,c:0},{r:0,c:8},{r:8,c:0},{r:8,c:8}];
  const THRONE = {r:4,c:4};

  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }
  function isRestricted(r,c){
    if(!inBounds(r,c)) return false;
    if(r===THRONE.r && c===THRONE.c) return true;
    return CORNERS.some(k => k.r===r && k.c===c);
  }
  function sideOf(piece){ if(piece==='A') return 'attacker'; if(piece==='D'||piece==='K') return 'defender'; return null; }

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    board[4][4] = 'K';
    [[3,3],[3,4],[3,5],[4,3],[4,5],[5,3],[5,4],[5,5]].forEach(([r,c]) => board[r][c]='D');
    [[0,3],[0,4],[0,5],[1,4], [8,3],[8,4],[8,5],[7,4], [3,0],[4,0],[5,0],[4,1], [3,8],[4,8],[5,8],[4,7]]
      .forEach(([r,c]) => board[r][c]='A');
    return { board, turn:'attacker', kingCaptured:false, kingEscaped:false };
  }

  function slideMoves(board, r, c){
    const piece = board[r][c];
    if(!piece) return [];
    const moves = [];
    for(const [dr,dc] of DIRS){
      let step=1;
      while(true){
        const nr=r+dr*step, nc=c+dc*step;
        if(!inBounds(nr,nc)) break;
        if(board[nr][nc]) break;
        if(piece==='K' || !isRestricted(nr,nc)) moves.push({from:{r,c}, to:{r:nr,c:nc}});
        step++;
      }
    }
    return moves;
  }

  function allMoves(state){
    const out=[];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      const piece = state.board[r][c];
      if(!piece) continue;
      const side = sideOf(piece);
      if(side===state.turn) out.push(...slideMoves(state.board,r,c));
    }
    return out;
  }

  function findKing(board){
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c]==='K') return {r,c};
    return null;
  }

  function captureFrom(board, r, c, moverPiece){
    const moverSide = sideOf(moverPiece);
    const captured = [];
    for(const [dr,dc] of DIRS){
      const nr=r+dr, nc=c+dc;
      if(!inBounds(nr,nc)) continue;
      const target = board[nr][nc];
      if(!target || target==='K') continue;
      if(sideOf(target)===moverSide) continue;
      const br=nr+dr, bc=nc+dc;
      const beyondFriendly = inBounds(br,bc) && board[br][bc] && sideOf(board[br][bc])===moverSide;
      const beyondHostileEmpty = inBounds(br,bc) && isRestricted(br,bc) && !board[br][bc];
      if(beyondFriendly || beyondHostileEmpty) captured.push({r:nr,c:nc});
    }
    return captured;
  }

  function kingSurrounded(board){
    const k = findKing(board);
    if(!k) return false;
    for(const [dr,dc] of DIRS){
      const nr=k.r+dr, nc=k.c+dc;
      if(!inBounds(nr,nc)) continue; // edge counts as open (no wall-assist simplification)
      if(board[nr][nc] !== 'A') return false;
    }
    return true;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    const moverPiece = s.board[move.from.r][move.from.c];
    s.board[move.to.r][move.to.c] = moverPiece;
    s.board[move.from.r][move.from.c] = null;
    const captured = captureFrom(s.board, move.to.r, move.to.c, moverPiece);
    for(const cell of captured) s.board[cell.r][cell.c] = null;
    if(moverPiece === 'A' && kingSurrounded(s.board)) s.kingCaptured = true;
    if(moverPiece === 'K' && CORNERS.some(k => k.r===move.to.r && k.c===move.to.c)) s.kingEscaped = true;
    s.turn = s.turn==='attacker' ? 'defender' : 'attacker';
    return s;
  }

  function winnerOf(state){
    if(state.kingCaptured) return 'attacker';
    if(state.kingEscaped) return 'defender';
    return null;
  }

  function isTerminal(state){
    return !!winnerOf(state) || allMoves(state).length===0;
  }

  function cornerDistance(pos){
    return Math.min(...CORNERS.map(k => Math.abs(k.r-pos.r) + Math.abs(k.c-pos.c)));
  }

  function makeApi(aiSide){
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        const w = winnerOf(state);
        if(w) return w===aiSide ? 2000 : -2000;
        let attackers=0, defenders=0;
        for(let r=0;r<N;r++) for(let c=0;c<N;c++){
          if(state.board[r][c]==='A') attackers++;
          else if(state.board[r][c]==='D') defenders++;
        }
        const king = findKing(state.board);
        const kd = king ? cornerDistance(king) : 8;
        let score = aiSide==='attacker' ? (attackers*3 - defenders*4) : (defenders*4 - attackers*3);
        score += aiSide==='defender' ? (8-kd)*2 : -(8-kd)*2;
        return score;
      },
    };
  }

  function labelFor(side){ return side==='attacker' ? 'Attackers' : 'Defenders'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'defender' : null;
    const api = makeApi('defender');

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    boardEl.appendChild(shell);

    function render(){
      shell.innerHTML='';
      const legal = selected ? slideMoves(state.board, selected.r, selected.c) : [];
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const div = Common.el('div', { class:'cell' });
        div.style.left = (c*CELL)+'px'; div.style.top = (r*CELL)+'px';
        div.style.width = CELL+'px'; div.style.height = CELL+'px';
        if(isRestricted(r,c)) div.classList.add('restricted');
        const piece = state.board[r][c];
        const mv = legal.find(m=>m.to.r===r && m.to.c===c);
        if(selected && selected.r===r && selected.c===c) div.classList.add('selected');
        if(mv) div.classList.add('movable');
        div.appendChild(Common.el('div',{class:'hit', style:'border:1px solid rgba(138,90,52,0.35);'}));
        if(piece){
          const p = Common.el('div', { style:'width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;box-shadow:0 3px 6px rgba(0,0,0,0.35), inset 0 -3px 6px rgba(0,0,0,0.25);' });
          if(piece==='A'){ p.style.background='radial-gradient(circle at 35% 30%, #4a3a2c, #241a14 70%)'; p.style.color='#c99a4a'; }
          else if(piece==='D'){ p.style.background='radial-gradient(circle at 35% 30%, #fffaf0, #d8c8a2 70%)'; p.style.color='#8a5a34'; }
          else { p.style.background='radial-gradient(circle at 35% 30%, #fff3c9, #c99a4a 70%)'; p.style.color='#1c2b4a'; p.textContent='K'; }
          div.appendChild(p);
        }
        div.addEventListener('click', () => onClick(r,c));
        shell.appendChild(div);
      }
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='attacker' ? '#3a2a1e' : '#e8dcc0');
      const king = findKing(state.board);
      panel.setStats([
        { label:'Attackers left', value: countPiece(state.board,'A') },
        { label:'Defenders left', value: countPiece(state.board,'D') },
        { label:'King distance to corner', value: king ? cornerDistance(king) : '—' },
      ]);
    }

    function countPiece(board,letter){
      let n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c]===letter) n++; return n;
    }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const piece = state.board[r][c];
      if(selected){
        const legal = slideMoves(state.board, selected.r, selected.c);
        const mv = legal.find(m=>m.to.r===r && m.to.c===c);
        if(mv){ state = applyMove(state, mv); selected=null; afterMove(); return; }
      }
      selected = (piece && sideOf(piece)===state.turn) ? {r,c} : null;
      render();
    }

    function afterMove(){
      const w = winnerOf(state);
      if(w){ render(); panel.setMessage(w==='attacker' ? 'The king is surrounded — Attackers win.' : 'The king reached a corner — Defenders win.'); return; }
      if(allMoves(state).length===0){
        const win2 = state.turn==='attacker' ? 'defender' : 'attacker';
        render(); panel.setMessage(`${labelFor(state.turn)} have no legal moves — ${labelFor(win2)} win.`);
        return;
      }
      render();
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 2, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    render();
    panel.setMessage('Attackers move first and try to surround the king on all 4 sides. Defenders try to walk the king to any corner. All pieces slide like a rook; only the king may stop on the throne or a corner.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'tablut',
    name:'Tablut',
    emblem:'♔',
    theme: { accent:'#b8763e', panel:'#2a2117', board1:'#efe6d3', board2:'#dccdA6' },
    tagline:'Norse Tafl king-and-defenders escape game, 9×9.',
    rules:'<strong>Tablut:</strong> every piece slides like a rook (any distance, no jumping); only the king may stop on the throne or the corners. A piece is captured when an enemy move sandwiches it between two enemy pieces (or one enemy piece and a hostile empty throne/corner). The king is captured only when attackers occupy all four of his orthogonal neighbors.',
    start,
  });
})();
