(function () {
  const AXIAL_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const HEXSIZE = 24;
  const HEX_STEP_X = HEXSIZE * Math.sqrt(3);
  const HEX_STEP_Y = HEXSIZE * 1.5;
  const RANGE = 6;
  const CENTER = 300;
  const CONTAINER_PX = CENTER * 2;
  const TYPE_NAME = { Q:'Queen Bee', S:'Spider', B:'Beetle', G:'Grasshopper', A:'Soldier Ant' };
  const START_HAND = { Q:1, S:2, B:2, G:3, A:3 };

  function key(q,r){ return `${q},${r}`; }
  function parseKey(k){ const [q,r] = k.split(',').map(Number); return {q,r}; }
  function neighborsOf(q,r){ return AXIAL_DIRS.map(([dq,dr]) => ({q:q+dq, r:r+dr})); }
  function axialDist(q,r){ return (Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2; }
  function isOccupied(stacks,k){ return stacks[k] && stacks[k].length>0; }

  function initState(){
    return {
      stacks: {},
      hands: { p1: {...START_HAND}, p2: {...START_HAND} },
      turnCounts: { p1:0, p2:0 },
      turn: 'p1',
      gameOver: false,
      winner: null,
    };
  }

  function cloneStacks(stacks){
    const out = {};
    for(const k in stacks) out[k] = stacks[k].map(p => ({...p}));
    return out;
  }

  function perimeterGraphNodes(stacks){
    const nodes = new Set();
    for(const k in stacks){
      if(!stacks[k].length) continue;
      const {q,r} = parseKey(k);
      neighborsOf(q,r).forEach(n => { const nk = key(n.q,n.r); if(!isOccupied(stacks,nk)) nodes.add(nk); });
    }
    return nodes;
  }

  function hiveFullyConnected(stacks){
    const keys = Object.keys(stacks).filter(k => stacks[k].length>0);
    if(keys.length<=1) return true;
    const visited = new Set([keys[0]]);
    const queue = [keys[0]];
    while(queue.length){
      const cur = queue.shift();
      const {q,r} = parseKey(cur);
      neighborsOf(q,r).forEach(n => {
        const nk = key(n.q,n.r);
        if(isOccupied(stacks,nk) && !visited.has(nk)){ visited.add(nk); queue.push(nk); }
      });
    }
    return visited.size === keys.length;
  }

  function queenDests(nodes, fromKey){
    const {q,r} = parseKey(fromKey);
    return neighborsOf(q,r).map(n => key(n.q,n.r)).filter(k => nodes.has(k));
  }
  function beetleDests(stacksAfter, nodes, fromKey){
    const {q,r} = parseKey(fromKey);
    const dests = [];
    neighborsOf(q,r).forEach(n => {
      const nk = key(n.q,n.r);
      if(isOccupied(stacksAfter, nk)) dests.push(nk);
      else if(nodes.has(nk)) dests.push(nk);
    });
    return dests;
  }
  function grasshopperDests(stacksAfter, fromKey){
    const {q:q0, r:r0} = parseKey(fromKey);
    const dests = [];
    for(const [dq,dr] of AXIAL_DIRS){
      let q=q0+dq, r=r0+dr, jumped=false;
      while(isOccupied(stacksAfter, key(q,r))){ jumped=true; q+=dq; r+=dr; }
      if(jumped) dests.push(key(q,r));
    }
    return dests;
  }
  function spiderDests(nodes, fromKey){
    const results = new Set();
    (function dfs(cur, visited, depth){
      if(depth===3){ results.add(cur); return; }
      const {q,r} = parseKey(cur);
      neighborsOf(q,r).forEach(n => {
        const nk = key(n.q,n.r);
        if(nodes.has(nk) && !visited.has(nk)){
          visited.add(nk);
          dfs(nk, visited, depth+1);
          visited.delete(nk);
        }
      });
    })(fromKey, new Set([fromKey]), 0);
    results.delete(fromKey);
    return [...results];
  }
  function antDests(nodes, fromKey){
    const visited = new Set([fromKey]);
    const queue = [fromKey];
    const results = new Set();
    while(queue.length){
      const cur = queue.shift();
      const {q,r} = parseKey(cur);
      neighborsOf(q,r).forEach(n => {
        const nk = key(n.q,n.r);
        if(nodes.has(nk) && !visited.has(nk)){ visited.add(nk); results.add(nk); queue.push(nk); }
      });
    }
    return [...results];
  }

  function legalMovesForPiece(state, fromKey){
    const stacksAfter = cloneStacks(state.stacks);
    const piece = stacksAfter[fromKey].pop();
    if(stacksAfter[fromKey].length===0) delete stacksAfter[fromKey];
    const nodes = perimeterGraphNodes(stacksAfter);
    let raw;
    if(piece.type==='Q') raw = queenDests(nodes, fromKey);
    else if(piece.type==='B') raw = beetleDests(stacksAfter, nodes, fromKey);
    else if(piece.type==='G') raw = grasshopperDests(stacksAfter, fromKey);
    else if(piece.type==='S') raw = spiderDests(nodes, fromKey);
    else raw = antDests(nodes, fromKey);

    const legal = [];
    for(const destKey of new Set(raw)){
      if(destKey===fromKey) continue;
      const finalStacks = cloneStacks(stacksAfter);
      if(!finalStacks[destKey]) finalStacks[destKey] = [];
      finalStacks[destKey].push(piece);
      if(hiveFullyConnected(finalStacks)) legal.push(destKey);
    }
    return legal;
  }

  function placementCells(state, player){
    const occupiedKeys = Object.keys(state.stacks).filter(k => state.stacks[k].length>0);
    if(occupiedKeys.length===0) return ['0,0'];
    const candidates = new Set();
    occupiedKeys.forEach(k => {
      const {q,r} = parseKey(k);
      neighborsOf(q,r).forEach(n => { const nk = key(n.q,n.r); if(!isOccupied(state.stacks,nk)) candidates.add(nk); });
    });
    const playerOnBoard = occupiedKeys.some(k => state.stacks[k].some(p => p.player===player));
    if(!playerOnBoard) return [...candidates];
    return [...candidates].filter(k => {
      const {q,r} = parseKey(k);
      return neighborsOf(q,r).every(n => {
        const nk = key(n.q,n.r);
        if(!isOccupied(state.stacks,nk)) return true;
        return state.stacks[nk].every(p => p.player===player);
      });
    });
  }

  function getMoves(state){
    if(state.gameOver) return [];
    const player = state.turn;
    const hand = state.hands[player];
    const ownTurnCount = state.turnCounts[player];
    const mustPlaceQueen = ownTurnCount>=3 && hand.Q>0;
    const moves = [];
    const cells = placementCells(state, player);
    const types = mustPlaceQueen ? ['Q'] : Object.keys(hand).filter(t => hand[t]>0 && !(t==='Q' && ownTurnCount===0));
    types.forEach(t => cells.forEach(ck => {
      const {q,r} = parseKey(ck);
      moves.push({ kind:'place', pieceType:t, q, r });
    }));
    if(hand.Q===0){
      for(const k in state.stacks){
        const stack = state.stacks[k];
        if(!stack.length) continue;
        const top = stack[stack.length-1];
        if(top.player!==player) continue;
        legalMovesForPiece(state, k).forEach(dk => {
          const {q,r} = parseKey(dk);
          moves.push({ kind:'move', from:k, pieceType:top.type, q, r });
        });
      }
    }
    return moves;
  }

  function findQueenKey(state, player){
    for(const k in state.stacks){
      if(state.stacks[k].some(p => p.player===player && p.type==='Q')) return k;
    }
    return null;
  }
  function countOccupiedNeighbors(state, k){
    const {q,r} = parseKey(k);
    return neighborsOf(q,r).filter(n => isOccupied(state.stacks, key(n.q,n.r))).length;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    if(move.kind==='place'){
      const k = key(move.q, move.r);
      if(!s.stacks[k]) s.stacks[k] = [];
      s.stacks[k].push({ player:s.turn, type:move.pieceType });
      s.hands[s.turn][move.pieceType]--;
    } else {
      const stack = s.stacks[move.from];
      const piece = stack.pop();
      if(stack.length===0) delete s.stacks[move.from];
      const k = key(move.q, move.r);
      if(!s.stacks[k]) s.stacks[k] = [];
      s.stacks[k].push(piece);
    }
    s.turnCounts[s.turn] = (s.turnCounts[s.turn]||0) + 1;
    const p1S = findQueenKey(s,'p1') && countOccupiedNeighbors(s, findQueenKey(s,'p1'))===6;
    const p2S = findQueenKey(s,'p2') && countOccupiedNeighbors(s, findQueenKey(s,'p2'))===6;
    if(p1S && p2S){ s.gameOver=true; s.winner='draw'; }
    else if(p1S){ s.gameOver=true; s.winner='p2'; }
    else if(p2S){ s.gameOver=true; s.winner='p1'; }
    s.turn = s.turn==='p1' ? 'p2' : 'p1';
    return s;
  }

  function isTerminal(state){ return state.gameOver; }

  function advancePasses(state){
    let s = state, guard = 0;
    while(!s.gameOver && getMoves(s).length===0 && guard<4){
      s = Common.clone(s);
      s.turn = s.turn==='p1' ? 'p2' : 'p1';
      guard++;
    }
    return s;
  }

  function makeApi(aiSide){
    const humanSide = aiSide==='p1' ? 'p2' : 'p1';
    return {
      getMoves, applyMove, isTerminal,
      evaluate(state){
        if(state.gameOver){
          if(state.winner===aiSide) return 1000;
          if(state.winner==='draw') return 0;
          return -1000;
        }
        const aiQ = findQueenKey(state, aiSide);
        const huQ = findQueenKey(state, humanSide);
        const aiSurround = aiQ ? countOccupiedNeighbors(state, aiQ) : 0;
        const huSurround = huQ ? countOccupiedNeighbors(state, huQ) : 0;
        return (huSurround - aiSurround) * 15 + (aiQ ? 0 : -3);
      },
    };
  }

  function labelFor(side){ return side==='p1' ? 'Copper' : 'Slate'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let destroyed = false;
    let selectedHandType = null;
    let selectedBoardKey = null;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML='';
    const wrapDiv = Common.el('div', { style:'display:flex;flex-direction:column;gap:8px;align-items:center;' });
    const handTopEl = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;' });
    const boardShell = Common.el('div', { style:`position:relative;width:${CONTAINER_PX}px;height:${CONTAINER_PX}px;overflow:hidden;` });
    const handBottomEl = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;' });
    wrapDiv.appendChild(handTopEl);
    wrapDiv.appendChild(boardShell);
    wrapDiv.appendChild(handBottomEl);
    boardEl.appendChild(wrapDiv);

    function hexPixel(q,r){
      const x = HEX_STEP_X * (q + r/2) + CENTER;
      const y = HEX_STEP_Y * r + CENTER;
      return {x,y};
    }

    function pieceColor(player){
      return player==='p1'
        ? 'radial-gradient(circle at 35% 30%, #e8c98a, #8a5a34 70%)'
        : 'radial-gradient(circle at 35% 30%, #8fa3c9, #33456b 70%)';
    }

    function renderHand(container, player, isHumanTurn){
      container.innerHTML='';
      const hand = state.hands[player];
      Object.keys(START_HAND).forEach(t => {
        const count = hand[t];
        const btn = Common.el('button', {
          text: `${TYPE_NAME[t]} ×${count}`,
          style: `flex:none;padding:6px 10px;font-size:0.72rem;${selectedHandType===t && state.turn===player ? 'background:var(--gold);color:var(--indigo-deep);' : ''}`,
        });
        btn.disabled = count===0 || !isHumanTurn || state.turn!==player;
        btn.addEventListener('click', () => {
          if(state.turn!==player) return;
          selectedHandType = (selectedHandType===t) ? null : t;
          selectedBoardKey = null;
          render();
        });
        container.appendChild(btn);
      });
    }

    function render(){
      boardShell.innerHTML='';
      const moves = getMoves(state);
      let highlightDests = new Set();
      if(selectedHandType){
        highlightDests = new Set(moves.filter(m => m.kind==='place' && m.pieceType===selectedHandType).map(m => key(m.q,m.r)));
      } else if(selectedBoardKey){
        highlightDests = new Set(moves.filter(m => m.kind==='move' && m.from===selectedBoardKey).map(m => key(m.q,m.r)));
      }

      for(let q=-RANGE; q<=RANGE; q++){
        for(let r=-RANGE; r<=RANGE; r++){
          if(axialDist(q,r) > RANGE) continue;
          const k = key(q,r);
          const {x,y} = hexPixel(q,r);
          const div = Common.el('div');
          div.style.position='absolute';
          div.style.left = (x-HEXSIZE)+'px'; div.style.top = (y-HEXSIZE*0.87)+'px';
          div.style.width = (HEXSIZE*2)+'px'; div.style.height=(HEXSIZE*1.74)+'px';
          div.style.clipPath='polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
          div.style.border='1px solid rgba(138,90,52,0.3)';
          div.style.background = highlightDests.has(k) ? 'rgba(111,156,141,0.35)' : 'rgba(138,90,52,0.08)';
          div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center';
          div.style.cursor='pointer';
          const stack = state.stacks[k];
          if(stack && stack.length){
            const top = stack[stack.length-1];
            const dot = Common.el('div', { text: top.type, style:`width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;color:#fff;box-shadow:0 3px 6px rgba(0,0,0,0.35);background:${pieceColor(top.player)};` });
            if(selectedBoardKey===k) dot.style.boxShadow = '0 0 0 3px var(--gold)';
            div.appendChild(dot);
            if(stack.length>1){
              div.appendChild(Common.el('div', { text:`×${stack.length}`, style:'position:absolute;bottom:0;right:6px;font-size:0.65rem;color:#c99a4a;' }));
            }
          }
          div.addEventListener('click', () => onClick(k));
          boardShell.appendChild(div);
        }
      }

      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#8a5a34' : '#33456b');
      panel.setStats([
        { label:'Copper queen exposed sides', value: sidesOf('p1') },
        { label:'Slate queen exposed sides', value: sidesOf('p2') },
      ]);
      renderHand(handTopEl, mode==='ai' ? 'p2' : 'p2', mode!=='ai');
      renderHand(handBottomEl, 'p1', true);
    }

    function sidesOf(player){
      const qk = findQueenKey(state, player);
      if(!qk) return 'not placed';
      return `${6-countOccupiedNeighbors(state, qk)} / 6`;
    }

    function onClick(k){
      if(destroyed || state.gameOver) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const moves = getMoves(state);

      if(selectedHandType){
        const mv = moves.find(m => m.kind==='place' && m.pieceType===selectedHandType && key(m.q,m.r)===k);
        if(mv){ commit(mv); return; }
        selectedHandType=null; render(); return;
      }
      if(selectedBoardKey){
        const mv = moves.find(m => m.kind==='move' && m.from===selectedBoardKey && key(m.q,m.r)===k);
        if(mv){ commit(mv); return; }
      }
      const stack = state.stacks[k];
      if(stack && stack.length && stack[stack.length-1].player===state.turn && state.hands[state.turn].Q===0){
        selectedBoardKey = k; selectedHandType=null; render(); return;
      }
      selectedBoardKey = null; render();
    }

    function commit(mv){
      state = applyMove(state, mv);
      selectedHandType = null; selectedBoardKey = null;
      afterMove();
    }

    function afterMove(){
      state = advancePasses(state);
      render();
      if(state.gameOver){
        const msg = state.winner==='draw' ? "Both queens are fully surrounded at once — it's a draw."
          : `${labelFor(state.winner)}'s queen survives — ${labelFor(state.winner)} wins!`;
        panel.setMessage(msg);
        return;
      }
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 450);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.greedyMove(state, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    render();
    panel.setMessage('Copper moves first. Surround either queen bee completely to win. Select a piece from your hand to place it, or tap one of your pieces on the board to move it.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'hive',
    name:'Hive',
    emblem:'⬢',
    theme: { accent:'#a9743a', panel:'#1c2a3d', board1:'#f2ede0', board2:'#e6dcc6' },
    tagline:'Tile-laying insect game on an open hex grid — no board, no dice.',
    rules:"<strong>Hive:</strong> place insects from your hand touching the growing hive (never touching an enemy tile once you already have a piece down), or move a piece you've already placed. Neither player may move any piece until their queen bee is on the table, and the queen must be placed by each player's fourth turn. Surround a queen bee on all six sides — either player's — and its owner loses. One simplification from official rules: this version doesn't model the physical 'gate' rule that can block a piece from squeezing between two tightly packed neighbours.",
    start,
  });
})();
