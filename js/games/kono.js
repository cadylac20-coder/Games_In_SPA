(function () {
  const N = 5, SPACING = 80, MARGIN = 46;
  const BOARD_PX = MARGIN * 2 + SPACING * (N - 1);
  const DIAGS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  const P1_START = [{r:0,c:0},{r:0,c:1},{r:1,c:0},{r:0,c:3},{r:0,c:4},{r:1,c:4}];
  const P2_START = [{r:4,c:4},{r:4,c:3},{r:3,c:4},{r:4,c:0},{r:4,c:1},{r:3,c:0}];

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    P1_START.forEach(({r,c}) => board[r][c]='p1');
    P2_START.forEach(({r,c}) => board[r][c]='p2');
    return { board, turn:'p1' };
  }

  function countPieces(board,player){
    let n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c]===player) n++;
    return n;
  }

  function movesForPiece(board,r,c){
    const p = board[r][c];
    if(!p) return [];
    const opp = p==='p1' ? 'p2':'p1';
    const moves=[];
    for(const [dr,dc] of DIAGS){
      const mr=r+dr, mc=c+dc;
      if(!inBounds(mr,mc)) continue;
      if(!board[mr][mc]){ moves.push({from:{r,c}, to:{r:mr,c:mc}, type:'move'}); continue; }
      if(board[mr][mc]===p){
        const lr=r+2*dr, lc=c+2*dc;
        if(inBounds(lr,lc) && board[lr][lc]===opp) moves.push({from:{r,c}, to:{r:lr,c:lc}, type:'capture'});
      }
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

  function applyMove(state, move){
    const s = Common.clone(state);
    const mover = s.board[move.from.r][move.from.c];
    s.board[move.to.r][move.to.c] = mover;
    s.board[move.from.r][move.from.c] = null;
    s.turn = s.turn==='p1' ? 'p2' : 'p1';
    return s;
  }

  function winner(state){
    if(P2_START.every(({r,c}) => state.board[r][c]==='p1')) return 'p1';
    if(P1_START.every(({r,c}) => state.board[r][c]==='p2')) return 'p2';
    if(countPieces(state.board,'p1')===0) return 'p2';
    if(countPieces(state.board,'p2')===0) return 'p1';
    return null;
  }

  function isTerminal(state){
    return !!winner(state) || allMoves(state).length===0;
  }

  function targetProgress(board, player, targets){
    return targets.filter(({r,c}) => board[r][c]===player).length;
  }

  function makeApi(aiSide){
    const humanSide = aiSide==='p1' ? 'p2' : 'p1';
    const aiTargets = aiSide==='p1' ? P2_START : P1_START;
    const humanTargets = aiSide==='p1' ? P1_START : P2_START;
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        const mine = countPieces(state.board, aiSide);
        const theirs = countPieces(state.board, humanSide);
        const w = winner(state);
        if(w===aiSide) return 1000;
        if(w && w!==aiSide) return -1000;
        return (mine - theirs) * 5 + targetProgress(state.board, aiSide, aiTargets) * 8 - targetProgress(state.board, humanSide, humanTargets) * 8;
      },
    };
  }

  function labelFor(side){ return side==='p1' ? 'Jade' : 'Coral'; }

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
      for(let r=0;r<N-1;r++) for(let c=0;c<N-1;c++){
        s += `<line x1="${px(c)}" y1="${px(r)}" x2="${px(c+1)}" y2="${px(r+1)}" stroke="${stroke}" stroke-width="0.75" opacity="0.5"/>`;
        s += `<line x1="${px(c+1)}" y1="${px(r)}" x2="${px(c)}" y2="${px(r+1)}" stroke="${stroke}" stroke-width="0.75" opacity="0.5"/>`;
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
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#e8dcc0' : '#3a2a1e');
      panel.setStats([
        { label:'Jade on target', value: `${targetProgress(state.board,'p1',P2_START)}/6` },
        { label:'Coral on target', value: `${targetProgress(state.board,'p2',P1_START)}/6` },
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
      const w = winner(state);
      if(w){ render(); panel.setMessage(`${labelFor(w)} wins by occupying every target square!`); return; }
      if(allMoves(state).length===0){
        const win2 = state.turn==='p1' ? 'p2' : 'p1';
        render(); panel.setMessage(`${labelFor(state.turn)} has no legal moves — ${labelFor(win2)} wins.`);
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
    panel.setMessage('Jade moves first. Move diagonally onto an empty point, or jump over an adjacent piece of your own to capture an enemy piece two spaces beyond. Occupy every one of your target squares (the opponent\'s starting squares) to win.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'kono',
    name:'Five Field Kono',
    emblem:'✕',
    theme: { accent:'#4fae8b', panel:'#1e3b36', board1:'#eaf5ef', board2:'#d8ece2', p1Light:'#8fd9bb', p1Dark:'#2f8a63', p2Light:'#f2a08a', p2Dark:'#c1502e' },
    tagline:'Korean diagonal jump-capture race on a 5×5 board.',
    rules:'<strong>Five Field Kono:</strong> pieces move diagonally one step onto an empty point, or jump over an adjacent own piece to capture an enemy piece two spaces beyond in the same direction. The jumped-over piece is not affected. First player to occupy all six of their target squares (the opponent\'s original starting squares) wins.',
    start,
  });
})();
