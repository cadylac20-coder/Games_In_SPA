(function () {
  const N = 5, CELL = 66, CARRY = 5;
  const BOARD_PX = N * CELL;
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  function key(r,c){ return r+','+c; }
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }
  function opp(s){ return s==='p1' ? 'p2' : 'p1'; }
  const ALL_CELLS = [];
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) ALL_CELLS.push(key(r,c));

  function initState(){
    return {
      board: {}, turn:'p1', moveNumber:0,
      reserves: { p1:{flat:21,cap:1}, p2:{flat:21,cap:1} },
    };
  }

  function topOf(state, k){ const st = state.board[k]; return (st && st.length) ? st[st.length-1] : null; }
  function stackAt(state, k){ return state.board[k] || []; }

  function flatCount(state, color){
    let n=0;
    for(const k of ALL_CELLS){ const t = topOf(state,k); if(t && t.owner===color && (t.type==='flat'||t.type==='cap')) n++; }
    return n;
  }

  function hasRoad(state, color){
    const isRoad = (r,c) => { const t = topOf(state, key(r,c)); return t && t.owner===color && (t.type==='flat'||t.type==='cap'); };
    // Vertical: row 0 to row N-1
    let visited = {};
    let stack = [];
    for(let c=0;c<N;c++) if(isRoad(0,c)){ stack.push([0,c]); visited[key(0,c)]=true; }
    while(stack.length){
      const [r,c] = stack.pop();
      if(r===N-1) return true;
      for(const [dr,dc] of DIRS){
        const nr=r+dr, nc=c+dc;
        if(inBounds(nr,nc) && !visited[key(nr,nc)] && isRoad(nr,nc)){ visited[key(nr,nc)]=true; stack.push([nr,nc]); }
      }
    }
    // Horizontal: col 0 to col N-1
    visited = {}; stack = [];
    for(let r=0;r<N;r++) if(isRoad(r,0)){ stack.push([r,0]); visited[key(r,0)]=true; }
    while(stack.length){
      const [r,c] = stack.pop();
      if(c===N-1) return true;
      for(const [dr,dc] of DIRS){
        const nr=r+dr, nc=c+dc;
        if(inBounds(nr,nc) && !visited[key(nr,nc)] && isRoad(nr,nc)){ visited[key(nr,nc)]=true; stack.push([nr,nc]); }
      }
    }
    return false;
  }

  function winner(state){
    const justMoved = opp(state.turn);
    if(hasRoad(state, justMoved)) return justMoved;
    if(hasRoad(state, state.turn)) return state.turn;
    const p1Out = state.reserves.p1.flat===0 && state.reserves.p1.cap===0;
    const p2Out = state.reserves.p2.flat===0 && state.reserves.p2.cap===0;
    const full = ALL_CELLS.every(k => stackAt(state,k).length>0);
    if(p1Out || p2Out || full){
      const f1 = flatCount(state,'p1'), f2 = flatCount(state,'p2');
      if(f1>f2) return 'p1';
      if(f2>f1) return 'p2';
      return 'draw';
    }
    return null;
  }

  function placementMoves(state){
    const color = state.moveNumber < 2 ? opp(state.turn) : state.turn;
    const out = [];
    if(state.reserves[color].flat <= 0 && state.reserves[color].cap <= 0) return out;
    ALL_CELLS.forEach(at => {
      if(stackAt(state,at).length>0) return;
      if(state.reserves[color].flat>0){
        out.push({ type:'place', at, color, stoneType:'flat' });
        if(state.moveNumber>=2) out.push({ type:'place', at, color, stoneType:'standing' });
      }
      if(state.moveNumber>=2 && state.reserves[color].cap>0) out.push({ type:'place', at, color, stoneType:'cap' });
    });
    return out;
  }

  function moveOptionsFrom(state, r, c){
    const from = key(r,c);
    const stack = stackAt(state, from);
    if(stack.length===0) return [];
    const top = stack[stack.length-1];
    if(top.owner !== state.turn) return [];
    const carryMax = Math.min(CARRY, stack.length);
    const out = [];
    for(const [dr,dc] of DIRS){
      for(let count=1; count<=carryMax; count++){
        const tr = r+dr*count, tc = c+dc*count;
        if(!inBounds(tr,tc)) break;
        const destTop = topOf(state, key(tr,tc));
        if(!destTop){ out.push({ type:'move', from, dir:[dr,dc], count, isFlatten:false }); continue; }
        if(destTop.type==='flat'){ out.push({ type:'move', from, dir:[dr,dc], count, isFlatten:false }); continue; }
        if(destTop.type==='cap') break;
        if(destTop.type==='standing'){
          if(top.type==='cap') out.push({ type:'move', from, dir:[dr,dc], count, isFlatten:true });
          break;
        }
      }
    }
    return out;
  }

  function moveStackMoves(state){
    if(state.moveNumber < 2) return [];
    const out = [];
    for(const k of ALL_CELLS){
      const [r,c] = k.split(',').map(Number);
      out.push(...moveOptionsFrom(state, r, c));
    }
    return out;
  }

  function allMoves(state){
    if(winner(state)) return [];
    return placementMoves(state).concat(moveStackMoves(state));
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    if(move.type==='place'){
      if(move.stoneType==='cap') s.reserves[move.color].cap--; else s.reserves[move.color].flat--;
      s.board[move.at] = [{ owner: move.color, type: move.stoneType }];
      s.turn = opp(s.turn);
      s.moveNumber++;
      return s;
    }
    // move
    const [dr,dc] = move.dir;
    const [r,c] = move.from.split(',').map(Number);
    const srcStack = s.board[move.from];
    const carried = srcStack.splice(srcStack.length - move.count, move.count);
    if(srcStack.length===0) delete s.board[move.from];
    for(let i=1;i<=move.count;i++){
      const tr = r+dr*i, tc = c+dc*i;
      const dk = key(tr,tc);
      if(!s.board[dk]) s.board[dk] = [];
      if(i===move.count && move.isFlatten){
        const destStack = s.board[dk];
        const flattened = destStack[destStack.length-1];
        destStack[destStack.length-1] = { owner: flattened.owner, type:'flat' };
      }
      s.board[dk].push(carried[i-1]);
    }
    s.turn = opp(s.turn);
    s.moveNumber++;
    return s;
  }

  function isTerminal(state){ return !!winner(state); }

  function labelFor(side){ return side==='p1' ? 'Amber' : 'Slate'; }

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
        if(w==='draw') return 0;
        let score = (flatCount(state,aiSide) - flatCount(state,humanSide)) * 3;
        score += (state.reserves[aiSide].flat + state.reserves[aiSide].cap) * 0.05;
        score -= (state.reserves[humanSide].flat + state.reserves[humanSide].cap) * 0.05;
        // reward standing walls slightly less than flats since they don't count for roads yet
        for(const k of ALL_CELLS){
          const t = topOf(state,k);
          if(!t) continue;
          const v = t.type==='cap' ? 2.2 : (t.type==='flat' ? 1.2 : 0.6);
          score += (t.owner===aiSide ? v : -v);
        }
        return score;
      },
    };
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let carryCount = 1;
    let pendingStoneType = 'flat';
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML = '';
    const wrap = Common.el('div', { style:'display:flex;flex-direction:column;align-items:center;gap:14px;' });
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    const controls = Common.el('div', { style:'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;' });
    wrap.appendChild(shell); wrap.appendChild(controls);
    boardEl.appendChild(wrap);

    function px(i){ return i*CELL; }

    function activeColor(){ return state.moveNumber<2 ? opp(state.turn) : state.turn; }

    function render(){
      shell.innerHTML = '';
      const moves = allMoves(state);
      const placeTargets = moves.filter(m => m.type==='place' && m.stoneType===pendingStoneType).map(m=>m.at);
      const moveTargets = selected ? moves.filter(m => m.type==='move' && m.from===selected && m.count===carryCount) : [];
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const k = key(r,c);
        const div = Common.el('div', { class:'cell' });
        div.style.left = px(c)+'px'; div.style.top = px(r)+'px';
        div.style.width = CELL+'px'; div.style.height = CELL+'px';
        const stack = stackAt(state,k);
        if(selected===k) div.style.boxShadow = 'inset 0 0 0 3px #fff';
        if(placeTargets.indexOf(k)!==-1) div.classList.add('movable');
        const mv = moveTargets.find(m => {
          const [dr,dc] = m.dir; const [sr,sc] = m.from.split(',').map(Number);
          return sr+dr*m.count===r && sc+dc*m.count===c;
        });
        if(mv) div.classList.add(mv.isFlatten ? 'capturable' : 'movable');
        div.appendChild(Common.el('div',{class:'hit'}));
        if(stack.length){
          const stackWrap = Common.el('div', { style:'position:relative;width:44px;height:44px;' });
          stack.forEach((piece, i) => {
            const isTop = i===stack.length-1;
            const h = piece.type==='standing' ? '10px' : '38px';
            const w = piece.type==='standing' ? '38px' : '44px';
            const chip = Common.el('div', {
              style:`position:absolute;left:${(44-parseInt(w))/2}px;bottom:${i*3}px;width:${w};height:${h};border-radius:6px;` +
                `background:${piece.owner==='p1' ? 'radial-gradient(circle at 35% 30%,#fffaf0,#d8c8a2 70%)' : 'radial-gradient(circle at 35% 30%,#6a7fa8,#33456b 70%)'};` +
                `box-shadow:0 2px 4px rgba(0,0,0,0.4);${piece.type==='cap' && isTop ? 'outline:2px solid var(--gold,#c99a4a);' : ''}`
            });
            if(piece.type==='cap' && isTop) chip.textContent = '\u25B2';
            chip.style.display='flex'; chip.style.alignItems='center'; chip.style.justifyContent='center'; chip.style.fontSize='0.7rem';
            stackWrap.appendChild(chip);
          });
          div.appendChild(stackWrap);
        }
        div.addEventListener('click', () => onClick(r,c));
        shell.appendChild(div);
      }
      renderControls(moves);
      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#e8dcc0' : '#33456b');
      panel.setStats([
        { label:'Amber flats down', value: flatCount(state,'p1') },
        { label:'Slate flats down', value: flatCount(state,'p2') },
        { label:'Amber reserve', value: `${state.reserves.p1.flat}F ${state.reserves.p1.cap}C` },
        { label:'Slate reserve', value: `${state.reserves.p2.flat}F ${state.reserves.p2.cap}C` },
      ]);
    }

    function renderControls(moves){
      controls.innerHTML = '';
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const color = activeColor();
      const canFlat = state.reserves[color].flat>0;
      const canStanding = state.moveNumber>=2 && state.reserves[color].flat>0;
      const canCap = state.moveNumber>=2 && state.reserves[color].cap>0;
      if(canFlat) controls.appendChild(toggleBtn('Place: Flat', pendingStoneType==='flat', () => { pendingStoneType='flat'; selected=null; render(); }));
      if(canStanding) controls.appendChild(toggleBtn('Place: Wall', pendingStoneType==='standing', () => { pendingStoneType='standing'; selected=null; render(); }));
      if(canCap) controls.appendChild(toggleBtn('Place: Capstone', pendingStoneType==='cap', () => { pendingStoneType='cap'; selected=null; render(); }));
      if(selected){
        const maxCarry = Math.min(CARRY, stackAt(state,selected).length);
        for(let n=1;n<=maxCarry;n++){
          controls.appendChild(toggleBtn(`Carry ${n}`, carryCount===n, () => { carryCount=n; render(); }));
        }
      }
    }

    function toggleBtn(text, active, onClick){
      const b = Common.el('button', { text, style: active ? 'flex:none;box-shadow:0 0 0 2px var(--gold,#c99a4a);' : 'flex:none;' });
      b.addEventListener('click', onClick);
      return b;
    }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const k = key(r,c);
      const moves = allMoves(state);
      if(selected){
        const mv = moves.find(m => m.type==='move' && m.from===selected && m.count===carryCount && (() => {
          const [dr,dc]=m.dir; const [sr,sc]=m.from.split(',').map(Number);
          return sr+dr*m.count===r && sc+dc*m.count===c;
        })());
        if(mv){ state = applyMove(state, mv); selected=null; carryCount=1; afterMove(); return; }
        if(k===selected){ selected=null; render(); return; }
      }
      const stack = stackAt(state,k);
      if(stack.length && stack[stack.length-1].owner===state.turn && state.moveNumber>=2){
        selected = k; carryCount = 1; render(); return;
      }
      const placeMv = moves.find(m => m.type==='place' && m.at===k && m.stoneType===pendingStoneType);
      if(placeMv){ state = applyMove(state, placeMv); selected=null; afterMove(); return; }
    }

    function afterMove(){
      const w = winner(state);
      if(w){
        render();
        panel.setMessage(w==='draw' ? 'Board settled — it\'s a flat-count tie.' : `${labelFor(w)} wins${hasRoad(state,w) ? ' with a completed road!' : ' on flat count.'}`);
        return;
      }
      pendingStoneType = 'flat';
      render();
      panel.setMessage(`${labelFor(state.turn)} to move: place a stone, or click one of your stacks to move it.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 2, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    render();
    panel.setMessage('The first stone each side places is actually the OPPONENT\'s flat stone — a real Tak rule that balances the first move. From move 3 on, place your own flat, standing wall, or capstone, or move a stack you control (top piece is yours) in a straight line. Connect two opposite edges with a road of flats/capstones to win; otherwise the game ends when a reserve runs out or the board fills, and the most flats showing wins.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'tak',
    name:'Tak',
    emblem:'\u25B2',
    theme: { accent:'#7a8f6a', panel:'#20261c', board1:'#efe9d6', board2:'#d9cfa8', p1Light:'#fffaf0', p1Dark:'#d8c8a2', p2Light:'#6a7fa8', p2Dark:'#33456b' },
    tagline:'Build roads with flats, walls, and a capstone on a 5x5 board.',
    rules:'<strong>Tak:</strong> place flat stones, standing walls, or your one capstone, or move a stack you control (its top piece must be yours) in a straight line, dropping stones as you go. Standing walls block movement onto their square; only a capstone can flatten one (and only as the final step of a move). Win by connecting two opposite edges of the board with a continuous road of flats and/or your capstone. If a player runs out of reserve pieces, or the board fills up, the game ends immediately and whoever has more flatstones showing wins. Following the real rule, each player\'s very first placement is a flat stone of the *opponent\'s* color. This version simplifies stack movement to dropping exactly one piece per square as you travel (no uneven multi-piece drops on a single square) for a clean, enumerable move set.',
    start,
  });
})();
