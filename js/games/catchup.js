(function () {
  const RADIUS = 4; // hexhex board, side 5 (61 cells)
  const SIZE = 26;
  const NEIGH = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

  function cellsList(){
    const out = [];
    for(let q=-RADIUS; q<=RADIUS; q++){
      const r1 = Math.max(-RADIUS, -q-RADIUS), r2 = Math.min(RADIUS, -q+RADIUS);
      for(let r=r1; r<=r2; r++) out.push(q+','+r);
    }
    return out;
  }
  const ALL_CELLS = cellsList();

  function neighborsOf(key){
    const [q,r] = key.split(',').map(Number);
    const out = [];
    for(const [dq,dr] of NEIGH){
      const k = (q+dq)+','+(r+dr);
      if(ALL_CELLS.indexOf(k) !== -1) out.push(k);
    }
    return out;
  }
  const NEIGHBOR_CACHE = {};
  ALL_CELLS.forEach(k => { NEIGHBOR_CACHE[k] = neighborsOf(k); });

  function initState(){
    const board = {};
    ALL_CELLS.forEach(k => board[k] = null);
    return { board, turn:'p1', moveNumber:0, scores:{p1:1,p2:1}, lastIncreased:false, lastMover:null };
  }

  // Returns { groups: [sizes desc], best: number } for a player.
  function groupInfo(board, player){
    const seen = new Set();
    const sizes = [];
    for(const k of ALL_CELLS){
      if(board[k]!==player || seen.has(k)) continue;
      let size = 0;
      const stack = [k];
      seen.add(k);
      while(stack.length){
        const cur = stack.pop();
        size++;
        for(const nb of NEIGHBOR_CACHE[cur]){
          if(board[nb]===player && !seen.has(nb)){ seen.add(nb); stack.push(nb); }
        }
      }
      sizes.push(size);
    }
    sizes.sort((a,b)=>b-a);
    return { groups: sizes, best: sizes[0] || 0 };
  }

  function emptyCells(board){ return ALL_CELLS.filter(k => !board[k]); }

  function allowedCount(state){
    if(state.moveNumber===0) return 1;
    const opponent = state.turn==='p1' ? 'p2' : 'p1';
    if(state.lastIncreased && state.scores[opponent] >= state.scores[state.turn]) return 3;
    return 2;
  }

  // A "move" is a set of 1..k empty cells to fill with the current player's color.
  function isTerminal(state){ return emptyCells(state.board).length === 0; }

  function winner(state){
    if(!isTerminal(state)) return null;
    const a = groupInfo(state.board,'p1').groups;
    const b = groupInfo(state.board,'p2').groups;
    const n = Math.max(a.length,b.length);
    for(let i=0;i<n;i++){
      const av = a[i]||0, bv = b[i]||0;
      if(av>bv) return 'p1';
      if(bv>av) return 'p2';
    }
    return null; // true ties are not supposed to happen on an odd-cell board
  }

  function applyPlacement(state, cells){
    const s = { board: Object.assign({}, state.board), turn: state.turn, moveNumber: state.moveNumber+1,
      scores: Object.assign({}, state.scores), lastIncreased:false, lastMover: state.turn };
    cells.forEach(k => { s.board[k] = state.turn; });
    const newBest = groupInfo(s.board, state.turn).best;
    s.lastIncreased = newBest > state.scores[state.turn];
    s.scores[state.turn] = newBest;
    s.turn = state.turn==='p1' ? 'p2' : 'p1';
    return s;
  }

  function labelFor(side){ return side==='p1' ? 'Amber' : 'Slate'; }

  // Heuristic: score a hypothetical placement of `key` for `side` by how much it
  // helps side's best group while hurting the opponent's adjacency options.
  function cellScore(board, key, side){
    const opp = side==='p1' ? 'p2' : 'p1';
    const trial = Object.assign({}, board);
    trial[key] = side;
    const mine = groupInfo(trial, side).best;
    let oppAdj = 0;
    for(const nb of NEIGHBOR_CACHE[key]) if(board[nb]===opp) oppAdj++;
    let ownAdj = 0;
    for(const nb of NEIGHBOR_CACHE[key]) if(board[nb]===side) ownAdj++;
    return mine*3 + ownAdj*1.5 - oppAdj*0.5;
  }

  // Greedy multi-cell pick: choose the best `count` cells one at a time.
  function aiPickCells(state, count){
    const board = Object.assign({}, state.board);
    const side = state.turn;
    const chosen = [];
    for(let i=0;i<count;i++){
      const empties = emptyCells(board);
      if(empties.length===0) break;
      let best = null, bestVal = -Infinity;
      for(const k of empties){
        const val = cellScore(board, k, side) + Math.random()*0.05;
        if(val > bestVal){ bestVal = val; best = k; }
      }
      chosen.push(best);
      board[best] = side;
    }
    return chosen;
  }

  function axialToPixel(key){
    const [q,r] = key.split(',').map(Number);
    const x = SIZE*Math.sqrt(3)*(q + r/2);
    const y = SIZE*1.5*r;
    return {x,y};
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let pending = []; // cells chosen so far this turn (human)
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;

    const xs = ALL_CELLS.map(k => axialToPixel(k).x);
    const ys = ALL_CELLS.map(k => axialToPixel(k).y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padding = SIZE*1.2;
    const boardW = (maxX-minX) + padding*2;
    const boardH = (maxY-minY) + padding*2;

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${boardW}px;height:${boardH}px;` });
    boardEl.appendChild(shell);

    function offset(key){
      const {x,y} = axialToPixel(key);
      return { left: x-minX+padding, top: y-minY+padding };
    }

    function render(){
      shell.innerHTML = '';
      ALL_CELLS.forEach(key => {
        const { left, top } = offset(key);
        const div = Common.el('div');
        div.style.position='absolute';
        div.style.left = (left - SIZE) + 'px';
        div.style.top = (top - SIZE*0.87) + 'px';
        div.style.width = (SIZE*2)+'px'; div.style.height=(SIZE*1.74)+'px';
        div.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
        div.style.cursor = 'pointer';
        div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center';
        const owner = state.board[key];
        const isPending = pending.indexOf(key) !== -1;
        div.style.background = owner ? 'transparent' : (isPending ? 'rgba(201,154,74,0.35)' : 'rgba(138,90,52,0.14)');
        div.style.border = '1px solid rgba(138,90,52,0.35)';
        if(!owner){
          div.addEventListener('click', () => onClick(key));
        }
        if(owner){
          const dot = Common.el('div', { class:`piece ${owner}`, style:'width:34px;height:34px;' });
          div.appendChild(dot);
        } else if(isPending){
          div.appendChild(Common.el('div', { class:`piece ${state.turn}`, style:'width:34px;height:34px;opacity:0.55;' }));
        }
        shell.appendChild(div);
      });
      const a = groupInfo(state.board,'p1'), b = groupInfo(state.board,'p2');
      panel.setTurn(labelFor(state.turn)+' to place', state.turn==='p1' ? '#e8dcc0' : '#33456b');
      const allowed = allowedCount(state);
      panel.setStats([
        { label:'Amber largest group', value: a.best },
        { label:'Slate largest group', value: b.best },
        { label:'Empty cells left', value: emptyCells(state.board).length },
        { label:'Stones to place this turn', value: `${pending.length}/${Math.min(allowed, pending.length + emptyCells(state.board).length)}` },
      ]);
    }

    function onClick(key){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(state.board[key]) return;
      if(pending.indexOf(key) !== -1){
        pending = pending.filter(k => k!==key);
        render();
        return;
      }
      const allowed = allowedCount(state);
      pending.push(key);
      render();
      if(pending.length >= allowed || pending.length >= emptyCells(state.board).length){
        commitTurn();
      }
    }

    function commitTurn(){
      state = applyPlacement(state, pending);
      pending = [];
      afterMove();
    }

    function afterMove(){
      if(isTerminal(state)){
        render();
        const w = winner(state);
        panel.setMessage(w ? `Board is full — ${labelFor(w)} wins with the largest group!` : `Board is full — remarkably, it's a dead-even tie.`);
        return;
      }
      render();
      const allowed = allowedCount(state);
      panel.setMessage(`${labelFor(state.turn)} to place ${allowed} stone${allowed>1?'s':''}.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 350);
    }

    function aiTurn(){
      if(destroyed) return;
      const allowed = allowedCount(state);
      const cells = aiPickCells(state, allowed);
      state = applyPlacement(state, cells);
      afterMove();
    }

    render();
    panel.setMessage('Amber places a single stone to start. From then on, each player places 1 or 2 stones (3 if you were just caught up to or passed) — the player with the largest connected group when the board fills wins.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'catchup',
    name:'Catchup',
    emblem:'⬢',
    theme: { accent:'#c9a24a', panel:'#2a2418', board1:'#f3ecd8', board2:'#e2d5ad', p1Light:'#fffaf0', p1Dark:'#d8c8a2', p2Light:'#6a7fa8', p2Dark:'#33456b' },
    tagline:'Nick Bentley\'s timing-based territory game on a hexagonal board.',
    rules:'<strong>Catchup:</strong> Amber places one stone to open the game. After that, players alternate placing 1 or 2 stones per turn — but if your opponent\'s largest group just grew to match or pass yours, you get to place 3 instead. When the 61-cell board fills up, whoever owns the single largest connected group of stones wins (ties are broken by comparing each side\'s next-largest group, and so on). This version always places the maximum number of stones you\'re entitled to each turn rather than letting you optionally place fewer.',
    start,
  });
})();
