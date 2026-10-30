(function () {
  const N = 9, SPACING = 42, MARGIN = 30;
  const BOARD_PX = MARGIN * 2 + SPACING * (N - 1);
  const NEI = [[-1,0],[1,0],[0,-1],[0,1]];
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  function initState(){
    return {
      board: Array.from({length:N}, () => Array(N).fill(null)),
      turn:'p1', passes:0, koPoint:null,
      capturedP1:0, capturedP2:0, gameOver:false, finalScore:null,
    };
  }

  function getGroup(board, r, c){
    const color = board[r][c];
    const stones = [];
    const liberties = new Set();
    const seen = new Set([`${r},${c}`]);
    const stack = [[r,c]];
    while(stack.length){
      const [cr,cc] = stack.pop();
      stones.push({r:cr,c:cc});
      for(const [dr,dc] of NEI){
        const nr=cr+dr, nc=cc+dc;
        if(!inBounds(nr,nc)) continue;
        const key = `${nr},${nc}`;
        if(!board[nr][nc]) liberties.add(key);
        else if(board[nr][nc]===color && !seen.has(key)){ seen.add(key); stack.push([nr,nc]); }
      }
    }
    return { stones, liberties };
  }

  // Attempts to place `color` at (r,c). Returns { board, captured } or null if illegal.
  function placeStone(board, r, c, color){
    if(board[r][c]) return null;
    const b = board.map(row => row.slice());
    b[r][c] = color;
    const opp = color==='p1' ? 'p2' : 'p1';
    const captured = [];
    const checked = new Set();
    for(const [dr,dc] of NEI){
      const nr=r+dr, nc=c+dc;
      if(!inBounds(nr,nc) || b[nr][nc]!==opp) continue;
      const key = `${nr},${nc}`;
      if(checked.has(key)) continue;
      const grp = getGroup(b, nr, nc);
      grp.stones.forEach(s => checked.add(`${s.r},${s.c}`));
      if(grp.liberties.size===0) captured.push(...grp.stones);
    }
    captured.forEach(s => { b[s.r][s.c] = null; });
    const ownGroup = getGroup(b, r, c);
    if(ownGroup.liberties.size===0) return null; // suicide
    return { board: b, captured };
  }

  function getMoves(state){
    if(state.gameOver) return [];
    const moves = [{ type:'pass' }];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(state.board[r][c]) continue;
      if(state.koPoint && state.koPoint.r===r && state.koPoint.c===c) continue;
      if(placeStone(state.board, r, c, state.turn)) moves.push({ type:'place', r, c });
    }
    return moves;
  }

  function computeScore(board){
    const visited = Array.from({length:N}, () => Array(N).fill(false));
    let scoreP1=0, scoreP2=0;
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(board[r][c]==='p1') scoreP1++;
      else if(board[r][c]==='p2') scoreP2++;
    }
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      if(board[r][c] || visited[r][c]) continue;
      const region=[]; const borders=new Set();
      const stack=[[r,c]]; visited[r][c]=true;
      while(stack.length){
        const [cr,cc]=stack.pop(); region.push([cr,cc]);
        for(const [dr,dc] of NEI){
          const nr=cr+dr, nc=cc+dc;
          if(!inBounds(nr,nc)) continue;
          if(!board[nr][nc]){ if(!visited[nr][nc]){ visited[nr][nc]=true; stack.push([nr,nc]); } }
          else borders.add(board[nr][nc]);
        }
      }
      if(borders.size===1){
        const owner = [...borders][0];
        if(owner==='p1') scoreP1 += region.length; else scoreP2 += region.length;
      }
    }
    return { p1:scoreP1, p2:scoreP2 };
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    if(move.type==='pass'){
      s.passes += 1; s.koPoint = null; s.turn = s.turn==='p1' ? 'p2':'p1';
      if(s.passes>=2){ s.gameOver=true; s.finalScore = computeScore(s.board); }
      return s;
    }
    const res = placeStone(s.board, move.r, move.c, s.turn);
    s.passes = 0;
    s.board = res.board;
    if(s.turn==='p1') s.capturedP2 += res.captured.length; else s.capturedP1 += res.captured.length;
    if(res.captured.length===1){
      const grp = getGroup(s.board, move.r, move.c);
      const capKey = `${res.captured[0].r},${res.captured[0].c}`;
      s.koPoint = (grp.stones.length===1 && grp.liberties.size===1 && grp.liberties.has(capKey)) ? res.captured[0] : null;
    } else {
      s.koPoint = null;
    }
    s.turn = s.turn==='p1' ? 'p2':'p1';
    return s;
  }

  function isTerminal(state){ return state.gameOver; }

  function makeApi(aiSide){
    const humanSide = aiSide==='p1' ? 'p2':'p1';
    return {
      getMoves, applyMove, isTerminal,
      evaluate(state){
        if(state.gameOver){
          const diff = state.finalScore[aiSide] - state.finalScore[humanSide];
          return diff * 20;
        }
        let mine=0, theirs=0, myLib=0, theirLib=0;
        const seen = new Set();
        for(let r=0;r<N;r++) for(let c=0;c<N;c++){
          const p = state.board[r][c];
          if(!p) continue;
          if(p===aiSide) mine++; else theirs++;
          const key=`${r},${c}`;
          if(!seen.has(key)){
            const grp = getGroup(state.board,r,c);
            grp.stones.forEach(s2=>seen.add(`${s2.r},${s2.c}`));
            if(p===aiSide) myLib += grp.liberties.size; else theirLib += grp.liberties.size;
          }
        }
        const capDiff = aiSide==='p1' ? (state.capturedP1-state.capturedP2) : (state.capturedP2-state.capturedP1);
        return (mine-theirs)*4 + (myLib-theirLib)*1.5 + capDiff*6;
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
    const HOSHI = [[2,2],[2,6],[6,2],[6,6],[4,4]];

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width', BOARD_PX); svg.setAttribute('height', BOARD_PX);
    svg.style.position='absolute'; svg.style.left='0'; svg.style.top='0';
    const pointsLayer = Common.el('div', { style:'position:absolute;left:0;top:0;width:100%;height:100%;' });
    shell.appendChild(svg); shell.appendChild(pointsLayer);
    boardEl.appendChild(shell);
    const passBtn = Common.el('button', { text:'Pass turn', style:'margin-top:12px;width:100%;', onclick:() => { if(!(mode==='ai' && state.turn===AI_SIDE)) onPass(); } });
    boardEl.appendChild(passBtn);

    function px(i){ return MARGIN + i*SPACING; }

    function drawGrid(){
      let s=''; const stroke='rgba(138,90,52,0.55)';
      for(let i=0;i<N;i++){
        s += `<line x1="${px(0)}" y1="${px(i)}" x2="${px(N-1)}" y2="${px(i)}" stroke="${stroke}" stroke-width="1.2"/>`;
        s += `<line x1="${px(i)}" y1="${px(0)}" x2="${px(i)}" y2="${px(N-1)}" stroke="${stroke}" stroke-width="1.2"/>`;
      }
      HOSHI.forEach(([r,c]) => { s += `<circle cx="${px(c)}" cy="${px(r)}" r="3" fill="#8a5a34"/>`; });
      svg.innerHTML = s;
    }

    function render(){
      pointsLayer.innerHTML='';
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const div = Common.el('div', { class:'point' });
        div.style.width='34px'; div.style.height='34px'; div.style.marginLeft='-17px'; div.style.marginTop='-17px';
        div.style.left = px(c)+'px'; div.style.top = px(r)+'px';
        const piece = state.board[r][c];
        div.appendChild(Common.el('div',{class:'hit'}));
        if(piece) div.appendChild(Common.el('div',{class:`piece ${piece}`, style:'width:26px;height:26px;'}));
        if(state.koPoint && state.koPoint.r===r && state.koPoint.c===c && !piece){
          div.style.boxShadow = '0 0 0 2px var(--capture-glow)';
        }
        div.addEventListener('click', () => onClick(r,c));
        pointsLayer.appendChild(div);
      }
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#3a2a1e' : '#e8dcc0');
      panel.setStats([
        { label:'Black captures', value: state.capturedP1 },
        { label:'White captures', value: state.capturedP2 },
        { label:'Passes in a row', value: state.passes },
      ]);
    }

    function onClick(r,c){
      if(destroyed || state.gameOver) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(state.koPoint && state.koPoint.r===r && state.koPoint.c===c) { panel.setMessage("That point is temporarily forbidden — it would repeat the position (ko)."); return; }
      const res = placeStone(state.board, r, c, state.turn);
      if(!res){ panel.setMessage('That move is not legal there (occupied, or it would be self-capture).'); return; }
      state = applyMove(state, { type:'place', r, c });
      afterMove();
    }

    function onPass(){
      if(destroyed || state.gameOver) return;
      state = applyMove(state, { type:'pass' });
      afterMove();
    }

    function afterMove(){
      render();
      if(state.gameOver){
        const s = state.finalScore;
        const winner = s.p1===s.p2 ? null : (s.p1>s.p2 ? 'Black' : 'White');
        panel.setMessage(winner ? `Both passed. Final score — Black ${s.p1}, White ${s.p2}. ${winner} wins.` : `Both passed. Final score — Black ${s.p1}, White ${s.p2}. It's a tie.`);
        return;
      }
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.greedyMove(state, api);
      state = mv ? applyMove(state, mv) : applyMove(state, {type:'pass'});
      afterMove();
    }

    drawGrid();
    render();
    panel.setMessage('Black moves first. Surround enemy stones to capture them; surrounded empty territory counts as points. Two passes in a row ends the game.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'go',
    name:'Go',
    emblem:'●',
    theme: { accent:'#8a5a34', panel:'#241d16', board1:'#e3c896', board2:'#caa76c', p1Light:'#4a3a2c', p1Dark:'#0c0705', p2Light:'#fffaf0', p2Dark:'#d8c8a2' },
    tagline:'Simplified 9×9 Go — capture stones, claim territory.',
    rules:'<strong>Go (simplified 9×9):</strong> place stones on empty intersections; a group of stones with no remaining liberties (empty adjacent points) is captured. A basic ko rule prevents immediately retaking a single stone that just captured you. The game ends after two consecutive passes and is scored by stones plus surrounded territory. The AI here is a one-ply heuristic, not a strong Go engine — full-strength Go AI is genuinely research-grade.',
    start,
  });
})();
