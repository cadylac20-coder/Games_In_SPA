(function () {
  const RADIUS = 3; // standard hexagon board, side 4 (37 rings)
  const SIZE = 28;
  const NEIGH = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const COLORS = ['w','g','b'];
  const COLOR_HEX = { w:'#f4ecd8', g:'#8a8a8a', b:'#221d1a' };
  const COLOR_NAME = { w:'White', g:'Gray', b:'Black' };
  const WIN_THRESH = { w:4, g:5, b:6 };

  function cellsList(){
    const out = [];
    for(let q=-RADIUS; q<=RADIUS; q++){
      const r1 = Math.max(-RADIUS, -q-RADIUS), r2 = Math.min(RADIUS, -q+RADIUS);
      for(let r=r1; r<=r2; r++) out.push(q+','+r);
    }
    return out;
  }
  const ALL_CELLS = cellsList();
  const CELL_SET = new Set(ALL_CELLS);

  function opp(s){ return s==='p1' ? 'p2' : 'p1'; }

  function initState(){
    const rings = {}; ALL_CELLS.forEach(k => rings[k] = true);
    return {
      rings, marbles: {}, pool: { w:6, g:8, b:10 },
      captured: { p1:{w:0,g:0,b:0}, p2:{w:0,g:0,b:0} },
      turn: 'p1', phase:'jumpOrPlace', chainKey: null,
    };
  }

  function hopsFrom(state, key){
    if(!state.marbles[key]) return [];
    const [q,r] = key.split(',').map(Number);
    const out = [];
    for(const [dq,dr] of NEIGH){
      const midKey = (q+dq)+','+(r+dr);
      const landKey = (q+2*dq)+','+(r+2*dr);
      if(!state.rings[midKey] || !state.marbles[midKey]) continue;
      if(!CELL_SET.has(landKey) || !state.rings[landKey] || state.marbles[landKey]) continue;
      out.push({ from:key, mid:midKey, to:landKey, capturedColor: state.marbles[midKey] });
    }
    return out;
  }

  function allJumps(state){
    const out = [];
    for(const k of ALL_CELLS) if(state.marbles[k]) out.push(...hopsFrom(state,k).map(h => ({ type:'jump', ...h })));
    return out;
  }

  function ringNeighborsExist(key){
    const [q,r] = key.split(',').map(Number);
    return NEIGH.map(([dq,dr]) => {
      const nk = (q+dq)+','+(r+dr);
      return CELL_SET.has(nk);
    });
  }
  const NEIGH_EXIST_CACHE = {};
  ALL_CELLS.forEach(k => NEIGH_EXIST_CACHE[k] = ringNeighborsExist(k));

  function isRemovable(state, key){
    if(!state.rings[key] || state.marbles[key]) return false;
    const [q,r] = key.split(',').map(Number);
    const flags = NEIGH.map(([dq,dr]) => {
      const nk = (q+dq)+','+(r+dr);
      return !(CELL_SET.has(nk) && state.rings[nk]); // true = missing/off-board
    });
    for(let i=0;i<6;i++) if(flags[i] && flags[(i+1)%6]) return true;
    return false;
  }

  function removableRings(state){ return ALL_CELLS.filter(k => isRemovable(state,k)); }

  function placementMoves(state){
    const poolSum = COLORS.reduce((a,c) => a+state.pool[c], 0);
    let colors;
    if(poolSum > 0) colors = COLORS.filter(c => state.pool[c] > 0);
    else colors = COLORS.filter(c => state.captured[state.turn][c] > 0);
    const empties = ALL_CELLS.filter(k => state.rings[k] && !state.marbles[k]);
    const out = [];
    colors.forEach(color => empties.forEach(at => out.push({ type:'place', color, at })));
    return out;
  }

  function connectedComponents(state){
    const seen = new Set();
    const comps = [];
    for(const k of ALL_CELLS){
      if(!state.rings[k] || seen.has(k)) continue;
      const stack = [k]; seen.add(k);
      const comp = [];
      while(stack.length){
        const cur = stack.pop();
        comp.push(cur);
        const [q,r] = cur.split(',').map(Number);
        for(const [dq,dr] of NEIGH){
          const nk = (q+dq)+','+(r+dr);
          if(state.rings[nk] && !seen.has(nk)){ seen.add(nk); stack.push(nk); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

  function checkIsolationCaptures(state, mover){
    const comps = connectedComponents(state);
    for(const comp of comps){
      if(comp.length === 0) continue;
      if(comp.every(k => state.marbles[k])){
        comp.forEach(k => {
          const c = state.marbles[k];
          state.captured[mover][c]++;
          delete state.marbles[k];
          delete state.rings[k];
        });
      }
    }
  }

  function winner(state){
    for(const side of ['p1','p2']){
      const c = state.captured[side];
      if(c.w>=WIN_THRESH.w || c.g>=WIN_THRESH.g || c.b>=WIN_THRESH.b) return side;
      if(c.w>=3 && c.g>=3 && c.b>=3) return side;
    }
    return null;
  }

  function allMoves(state){
    if(winner(state)) return [];
    if(state.phase==='mustRemove') return removableRings(state).map(at => ({ type:'remove', at }));
    if(state.phase==='continueJump') return hopsFrom(state, state.chainKey).map(h => ({ type:'jump', ...h }));
    const jumps = allJumps(state);
    if(jumps.length>0) return jumps;
    return placementMoves(state);
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    if(move.type==='jump'){
      const color = s.marbles[move.from];
      s.captured[s.turn][move.capturedColor]++;
      delete s.marbles[move.mid];
      s.marbles[move.to] = color;
      delete s.marbles[move.from];
      if(winner(s)){ s.phase='jumpOrPlace'; s.chainKey=null; return s; }
      const further = hopsFrom(s, move.to);
      if(further.length>0){ s.phase='continueJump'; s.chainKey=move.to; }
      else { s.phase='jumpOrPlace'; s.chainKey=null; s.turn = opp(s.turn); }
      return s;
    }
    if(move.type==='place'){
      s.marbles[move.at] = move.color;
      if(s.pool[move.color] > 0) s.pool[move.color]--;
      else s.captured[s.turn][move.color]--;
      checkIsolationCaptures(s, s.turn);
      if(winner(s)) return s;
      const removable = removableRings(s);
      if(removable.length>0) s.phase = 'mustRemove';
      else { s.phase='jumpOrPlace'; s.turn = opp(s.turn); }
      return s;
    }
    if(move.type==='remove'){
      delete s.rings[move.at];
      checkIsolationCaptures(s, s.turn);
      s.phase='jumpOrPlace';
      s.turn = opp(s.turn);
      return s;
    }
    return s;
  }

  function isTerminal(state){ return !!winner(state) || allMoves(state).length===0; }

  function labelFor(side){ return side==='p1' ? 'Amber' : 'Slate'; }

  function makeApi(aiSide){
    const humanSide = opp(aiSide);
    const weight = { w:3, g:2.4, b:2 };
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        const w = winner(state);
        if(w===aiSide) return 1000;
        if(w===humanSide) return -1000;
        let score = 0;
        COLORS.forEach(c => {
          score += weight[c] * (state.captured[aiSide][c] - state.captured[humanSide][c]);
        });
        const myMarbles = ALL_CELLS.filter(k => state.marbles[k]).length;
        score += (state.turn===aiSide ? 1 : -1) * 0.1 * myMarbles;
        return score;
      },
    };
  }

  function axialToPixel(key){
    const [q,r] = key.split(',').map(Number);
    return { x: SIZE*Math.sqrt(3)*(q + r/2), y: SIZE*1.5*r };
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let selectedColor = 'w';
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    const xs = ALL_CELLS.map(k => axialToPixel(k).x);
    const ys = ALL_CELLS.map(k => axialToPixel(k).y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padding = SIZE*1.3;
    const boardW = (maxX-minX) + padding*2;
    const boardH = (maxY-minY) + padding*2;

    boardEl.innerHTML='';
    const wrap = Common.el('div', { style:'display:flex;flex-direction:column;align-items:center;gap:14px;' });
    const shell = Common.el('div', { style:`position:relative;width:${boardW}px;height:${boardH}px;` });
    const swatchRow = Common.el('div', { style:'display:flex;gap:10px;' });
    wrap.appendChild(shell); wrap.appendChild(swatchRow);
    boardEl.appendChild(wrap);

    function offset(key){
      const {x,y} = axialToPixel(key);
      return { left: x-minX+padding, top: y-minY+padding };
    }

    function currentMoves(){ return allMoves(state); }

    function render(){
      shell.innerHTML = '';
      const moves = currentMoves();
      const isPlacePhase = moves.length && moves[0].type==='place';
      const placeTargets = isPlacePhase ? moves.filter(m => m.color===selectedColor).map(m=>m.at) : [];
      const jumpTargets = moves.filter(m => m.type==='jump' && (!selected || m.from===selected));
      const removeTargets = moves.filter(m => m.type==='remove').map(m=>m.at);

      ALL_CELLS.forEach(key => {
        if(!state.rings[key]) return;
        const { left, top } = offset(key);
        const div = Common.el('div');
        div.style.position='absolute';
        div.style.left = (left - SIZE) + 'px';
        div.style.top = (top - SIZE*0.87) + 'px';
        div.style.width = (SIZE*2)+'px'; div.style.height=(SIZE*1.74)+'px';
        div.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
        div.style.background = 'rgba(138,90,52,0.16)';
        div.style.border = '1px solid rgba(138,90,52,0.4)';
        div.style.cursor='pointer';
        div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center';
        if(removeTargets.indexOf(key)!==-1) div.style.boxShadow = 'inset 0 0 0 3px var(--capture-glow,#c1502e)';
        if(placeTargets.indexOf(key)!==-1) div.style.boxShadow = 'inset 0 0 0 3px var(--move-dot,#6f9c8d)';
        if(jumpTargets.some(m=>m.to===key)) div.style.boxShadow = 'inset 0 0 0 3px var(--move-dot,#6f9c8d)';
        const marble = state.marbles[key];
        if(marble){
          const dot = Common.el('div', { style:`width:34px;height:34px;border-radius:50%;background:${COLOR_HEX[marble]};box-shadow:0 3px 6px rgba(0,0,0,0.4), inset 0 -3px 6px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.3);` });
          if(selected===key) dot.style.outline = '3px solid var(--gold,#c99a4a)';
          div.appendChild(dot);
        }
        div.addEventListener('click', () => onClick(key));
        shell.appendChild(div);
      });

      swatchRow.innerHTML = '';
      if(isPlacePhase){
        const availColors = Array.from(new Set(moves.map(m=>m.color)));
        availColors.forEach(c => {
          const btn = Common.el('button', {
            text: `${COLOR_NAME[c]} (${state.pool[c]>0 ? state.pool[c]+' in pool' : state.captured[state.turn][c]+' in hand'})`,
            style: c===selectedColor ? 'flex:none;box-shadow:0 0 0 2px var(--gold,#c99a4a);' : 'flex:none;',
          });
          btn.addEventListener('click', () => { selectedColor = c; render(); });
          swatchRow.appendChild(btn);
        });
      }

      panel.setTurn(labelFor(state.turn)+"'s turn", state.turn==='p1' ? '#e8dcc0' : '#33456b');
      panel.setStats([
        { label:'Amber captured', value: `W${state.captured.p1.w} G${state.captured.p1.g} B${state.captured.p1.b}` },
        { label:'Slate captured', value: `W${state.captured.p2.w} G${state.captured.p2.g} B${state.captured.p2.b}` },
        { label:'Pool left', value: `W${state.pool.w} G${state.pool.g} B${state.pool.b}` },
      ]);
    }

    function onClick(key){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const moves = currentMoves();
      if(moves.length===0) return;
      const kind = moves[0].type;
      if(kind==='remove'){
        const mv = moves.find(m => m.at===key);
        if(mv){ state = applyMove(state, mv); selected=null; afterMove(); }
        return;
      }
      if(kind==='jump'){
        if(selected){
          const mv = moves.find(m => m.from===selected && m.to===key);
          if(mv){ state = applyMove(state, mv); selected = (state.phase==='continueJump') ? state.chainKey : null; afterMove(); return; }
        }
        if(moves.some(m => m.from===key)) selected = key;
        render();
        return;
      }
      // placement
      const mv = moves.find(m => m.at===key && m.color===selectedColor);
      if(mv){ state = applyMove(state, mv); afterMove(); }
    }

    function afterMove(){
      const w = winner(state);
      if(w){ render(); panel.setMessage(`${labelFor(w)} wins by capturing enough marbles!`); return; }
      if(allMoves(state).length===0){ render(); panel.setMessage('No legal moves remain — game ends in a stalemate.'); return; }
      const moves = allMoves(state);
      if(moves.length && moves[0].color) selectedColor = moves.some(m=>m.color===selectedColor) ? selectedColor : moves[0].color;
      render();
      if(state.phase==='mustRemove') panel.setMessage(`${labelFor(state.turn)} must remove a free ring (highlighted).`);
      else if(state.phase==='continueJump') panel.setMessage(`${labelFor(state.turn)} must continue jumping with the same marble.`);
      else if(moves[0] && moves[0].type==='jump') panel.setMessage(`${labelFor(state.turn)} must jump — select a marble with a highlighted destination.`);
      else panel.setMessage(`${labelFor(state.turn)} places a marble, then removes a free ring.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiStep, 400);
    }

    function aiStep(){
      if(destroyed) return;
      if(state.turn!==AI_SIDE){ afterMove(); return; }
      const w = winner(state);
      if(w || allMoves(state).length===0){ afterMove(); return; }
      const mv = Common.greedyMove(state, api);
      if(mv) state = applyMove(state, mv);
      if(!winner(state) && state.turn===AI_SIDE && allMoves(state).length>0){
        render();
        setTimeout(aiStep, 350);
      } else {
        afterMove();
      }
    }

    render();
    panel.setMessage('No captures are mandatory-jump situations yet — place a marble of any available color onto an empty ring, then remove a free ring (one you could slide out without disturbing others). If a jump is ever available you must take it.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiStep, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'zertz',
    name:'ZÈRTZ',
    emblem:'⬡',
    theme: { accent:'#8a8a8a', panel:'#232323', board1:'#eee9de', board2:'#d8cfba', p1Light:'#fdfdfd', p1Dark:'#cfcfcf', p2Light:'#6a7fa8', p2Dark:'#33456b' },
    tagline:'GIPF-project marble capture game on a shrinking hexagon.',
    rules:'<strong>ZÈRTZ:</strong> neither player owns the marbles on the board — on your turn, if any jump-capture is available anywhere on the board you must take it (and keep jumping with that same marble as long as further jumps are possible). Otherwise, place a marble of any available color from the shared pool onto an empty ring, then remove any ring that could be slid out of the layout without disturbing its neighbors. If removing a ring cuts off a section of the board that\'s entirely full of marbles, you capture all of them. Win by capturing 4 white, 5 gray, or 6 black marbles, or 3 of each color. Played on the standard 37-ring board; the AI evaluates one move at a time (no deep search) given how differently-shaped each turn can be.',
    start,
  });
})();
