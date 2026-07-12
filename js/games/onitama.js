(function () {
  const N = 5, CELL = 66;
  const BOARD_PX = N * CELL;
  const P1_TARGET = { r: 0, c: 2 }; // p1 (Red) wins by reaching here
  const P2_TARGET = { r: 4, c: 2 }; // p2 (Blue) wins by reaching here

  // Card deltas given from p1's (Red, moving "up"/-row) point of view.
  // p2 (Blue) uses the same card rotated 180 degrees: (dr,dc) -> (-dr,-dc).
  const CARDS = {
    Tiger:    [[-2,0],[1,0]],
    Dragon:   [[-1,-2],[-1,2],[1,-1],[1,1]],
    Frog:     [[-1,-1],[0,-2],[1,1]],
    Rabbit:   [[-1,1],[0,2],[1,-1]],
    Crab:     [[-1,0],[0,-2],[0,2]],
    Elephant: [[-1,-1],[-1,1],[0,-1],[0,1]],
    Goose:    [[-1,-1],[0,-1],[0,1],[1,1]],
    Rooster:  [[-1,1],[0,-1],[0,1],[1,-1]],
    Monkey:   [[-1,-1],[-1,1],[1,-1],[1,1]],
    Mantis:   [[-1,-1],[-1,1],[1,0]],
    Horse:    [[-1,0],[0,-1],[1,0]],
    Ox:       [[-1,0],[0,1],[1,0]],
    Crane:    [[-1,0],[1,-1],[1,1]],
    Boar:     [[-1,0],[0,-1],[0,1]],
    Eel:      [[-1,-1],[0,1],[1,-1]],
    Cobra:    [[-1,1],[0,-1],[1,1]],
  };
  const CARD_NAMES = Object.keys(CARDS);

  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }
  function opp(p){ return p==='p1' ? 'p2' : 'p1'; }

  function deltasFor(card, side){
    const base = CARDS[card];
    if(side==='p1') return base;
    return base.map(([dr,dc]) => [-dr,-dc]);
  }

  function shuffledDeck(){
    const deck = CARD_NAMES.slice();
    for(let i=deck.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    return deck;
  }

  function initState(){
    const board = Array.from({length:N}, () => Array(N).fill(null));
    for(let c=0;c<N;c++) board[4][c] = { side:'p1', role: c===2?'master':'student' };
    for(let c=0;c<N;c++) board[0][c] = { side:'p2', role: c===2?'master':'student' };
    const deck = shuffledDeck();
    const hands = { p1:[deck[0],deck[1]], p2:[deck[2],deck[3]] };
    const spare = deck[4];
    const turn = Math.random() < 0.5 ? 'p1' : 'p2';
    return { board, turn, hands, spare };
  }

  function findMaster(board, side){
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const p=board[r][c]; if(p && p.side===side && p.role==='master') return {r,c}; }
    return null;
  }

  function winner(state){
    const m1 = findMaster(state.board,'p1');
    const m2 = findMaster(state.board,'p2');
    if(!m2) return 'p1';
    if(!m1) return 'p2';
    const atP2Target = state.board[P2_TARGET.r][P2_TARGET.c];
    if(atP2Target && atP2Target.side==='p2' && atP2Target.role==='master') return 'p2';
    const atP1Target = state.board[P1_TARGET.r][P1_TARGET.c];
    if(atP1Target && atP1Target.side==='p1' && atP1Target.role==='master') return 'p1';
    return null;
  }

  function allMoves(state){
    if(winner(state)) return [];
    const side = state.turn;
    const out = [];
    state.hands[side].forEach((card, cardIdx) => {
      const deltas = deltasFor(card, side);
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const p = state.board[r][c];
        if(!p || p.side!==side) continue;
        for(const [dr,dc] of deltas){
          const nr=r+dr, nc=c+dc;
          if(!inBounds(nr,nc)) continue;
          const target = state.board[nr][nc];
          if(target && target.side===side) continue;
          out.push({ card, cardIdx, from:{r,c}, to:{r:nr,c:nc}, capture: !!target });
        }
      }
    });
    return out;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    const mover = s.board[move.from.r][move.from.c];
    s.board[move.to.r][move.to.c] = mover;
    s.board[move.from.r][move.from.c] = null;
    const hand = s.hands[s.turn];
    const usedIdx = hand.indexOf(move.card);
    const oldSpare = s.spare;
    hand[usedIdx] = oldSpare;
    s.spare = move.card;
    s.turn = opp(s.turn);
    return s;
  }

  function isTerminal(state){ return !!winner(state) || allMoves(state).length===0; }

  function labelFor(side){ return side==='p1' ? 'Red' : 'Blue'; }

  function makeApi(aiSide){
    const humanSide = opp(aiSide);
    const target = aiSide==='p1' ? P1_TARGET : P2_TARGET;
    return {
      getMoves: allMoves,
      applyMove,
      isTerminal,
      evaluate(state){
        const w = winner(state);
        if(w===aiSide) return 2000;
        if(w===humanSide) return -2000;
        let score = 0;
        for(let r=0;r<N;r++) for(let c=0;c<N;c++){
          const p = state.board[r][c];
          if(!p) continue;
          const val = p.role==='master' ? 100 : 20;
          score += (p.side===aiSide ? val : -val);
        }
        const m = findMaster(state.board, aiSide);
        if(m) score += (8 - (Math.abs(m.r-target.r)+Math.abs(m.c-target.c))) * 2;
        score += (allMoves({...state, turn:aiSide}).length - allMoves({...state, turn:humanSide}).length) * 0.5;
        return score;
      },
    };
  }

  function cardGrid(card, side, small){
    const deltas = deltasFor(card, side);
    const size = small ? 14 : 18;
    let s = `<div style="display:grid;grid-template-columns:repeat(5,${size}px);grid-template-rows:repeat(5,${size}px);gap:2px;">`;
    for(let r=0;r<5;r++) for(let c=0;c<5;c++){
      const dr = r-2, dc = c-2;
      const isCenter = dr===0 && dc===0;
      const isMove = deltas.some(([mdr,mdc]) => mdr===dr && mdc===dc);
      let bg = 'rgba(255,255,255,0.06)';
      if(isCenter) bg = 'var(--gold, #c99a4a)';
      else if(isMove) bg = 'rgba(201,154,74,0.55)';
      s += `<div style="width:${size}px;height:${size}px;border-radius:3px;background:${bg};"></div>`;
    }
    s += `</div>`;
    return s;
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let selectedCard = null;
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML = '';
    const wrap = Common.el('div', { style:'display:flex;flex-direction:column;align-items:center;gap:16px;' });
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    const cellsLayer = Common.el('div', { style:'position:absolute;left:0;top:0;width:100%;height:100%;' });
    shell.appendChild(cellsLayer);
    const cardsRow = Common.el('div', { style:'display:flex;gap:24px;flex-wrap:wrap;justify-content:center;' });
    wrap.appendChild(shell);
    wrap.appendChild(cardsRow);
    boardEl.appendChild(wrap);

    function px(i){ return i*CELL; }

    function cardButton(card, side, isSpare, clickable){
      const box = Common.el('div', {
        style:`padding:8px;border-radius:10px;background:rgba(0,0,0,0.18);text-align:center;cursor:${clickable?'pointer':'default'};` +
          (selectedCard===card ? 'box-shadow:0 0 0 2px var(--gold,#c99a4a);' : '')
      });
      const title = Common.el('div', { text: card + (isSpare ? ' (spare)' : ''), style:'font-size:0.75rem;margin-bottom:4px;color:#cdd6ea;' });
      box.appendChild(title);
      box.innerHTML += cardGrid(card, isSpare ? 'p1' : side, true);
      if(clickable) box.addEventListener('click', () => { selectedCard = (selectedCard===card ? null : card); selected=null; render(); });
      return box;
    }

    function render(){
      cellsLayer.innerHTML = '';
      const legal = (selected && selectedCard) ? allMoves(state).filter(m => m.card===selectedCard && m.from.r===selected.r && m.from.c===selected.c) : [];
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const div = Common.el('div', { class:'cell' });
        div.style.left = px(c)+'px'; div.style.top = px(r)+'px';
        div.style.width = CELL+'px'; div.style.height = CELL+'px';
        const piece = state.board[r][c];
        const mv = legal.find(m => m.to.r===r && m.to.c===c);
        if(selected && selected.r===r && selected.c===c) div.classList.add('selected');
        if(mv) div.classList.add(mv.capture ? 'capturable' : 'movable');
        if(r===P1_TARGET.r && c===P1_TARGET.c) div.style.boxShadow = 'inset 0 0 0 2px rgba(232,220,192,0.5)';
        if(r===P2_TARGET.r && c===P2_TARGET.c) div.style.boxShadow = 'inset 0 0 0 2px rgba(58,42,30,0.5)';
        div.appendChild(Common.el('div',{class:'hit'}));
        if(piece){
          const pt = Common.el('div', { class:`point ${piece.side}${piece.role==='master'?' king':''}`, style:'position:static;margin:0;' });
          pt.appendChild(Common.el('div', { class:`piece ${piece.side}` }));
          div.appendChild(pt);
        }
        div.addEventListener('click', () => onClick(r,c));
        cellsLayer.appendChild(div);
      }
      cardsRow.innerHTML = '';
      const p1Box = Common.el('div', { style:'display:flex;flex-direction:column;gap:8px;align-items:center;' });
      p1Box.appendChild(Common.el('div', { text:'Red cards', style:'font-size:0.8rem;color:#b7c1d9;' }));
      const p1Cards = Common.el('div', { style:'display:flex;gap:8px;' });
      state.hands.p1.forEach(c => p1Cards.appendChild(cardButton(c, 'p1', false, mode!=='ai' || state.turn==='p1')));
      p1Box.appendChild(p1Cards);
      const spareBox = Common.el('div', { style:'display:flex;flex-direction:column;gap:8px;align-items:center;' });
      spareBox.appendChild(Common.el('div', { text:'Spare', style:'font-size:0.8rem;color:#b7c1d9;' }));
      spareBox.appendChild(cardButton(state.spare, 'p1', true, false));
      const p2Box = Common.el('div', { style:'display:flex;flex-direction:column;gap:8px;align-items:center;' });
      p2Box.appendChild(Common.el('div', { text:'Blue cards', style:'font-size:0.8rem;color:#b7c1d9;' }));
      const p2Cards = Common.el('div', { style:'display:flex;gap:8px;' });
      state.hands.p2.forEach(c => p2Cards.appendChild(cardButton(c, 'p2', false, mode!=='ai' && state.turn==='p2')));
      p2Box.appendChild(p2Cards);
      cardsRow.appendChild(p1Box); cardsRow.appendChild(spareBox); cardsRow.appendChild(p2Box);

      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#e8dcc0' : '#3a2a1e');
      panel.setStats([
        { label:'Red pieces', value: countSide(state.board,'p1') },
        { label:'Blue pieces', value: countSide(state.board,'p2') },
      ]);
    }

    function countSide(board, side){ let n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(board[r][c] && board[r][c].side===side) n++; return n; }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(!selectedCard) return;
      const piece = state.board[r][c];
      if(selected){
        const legal = allMoves(state).filter(m => m.card===selectedCard && m.from.r===selected.r && m.from.c===selected.c);
        const mv = legal.find(m => m.to.r===r && m.to.c===c);
        if(mv){ state = applyMove(state, mv); selected=null; selectedCard=null; afterMove(); return; }
      }
      if(piece && piece.side===state.turn) selected = {r,c};
      else selected = null;
      render();
    }

    function afterMove(){
      const w = winner(state);
      if(w){ render(); panel.setMessage(`${labelFor(w)} wins!`); return; }
      render();
      panel.setMessage(`${labelFor(state.turn)} to move: pick a card, then a piece.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 2, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    render();
    panel.setMessage(`${labelFor(state.turn)} moves first. Pick one of your two cards, then move a pawn matching one of the highlighted squares on it. Capture the enemy Master, or walk your own Master onto the opponent's shrine (the faint outlined square), to win.`);
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'onitama',
    name:'Onitama',
    emblem:'⛩',
    theme: { accent:'#8fa8d6', panel:'#1e2c47', board1:'#eef1f8', board2:'#dbe2f2', p1Light:'#f2a08a', p1Dark:'#c1502e', p2Light:'#8fc4e0', p2Dark:'#2c6f96' },
    tagline:'5x5 card-driven movement duel — capture the Master or reach their shrine.',
    rules:'<strong>Onitama:</strong> each player has a Master (crowned) and four Students on a 5x5 board. On your turn, choose one of your two movement cards and move a pawn according to one of the patterns shown on it, then pass that card to the shared spare pile and take the previous spare into your hand. Win by capturing the opponent\'s Master, or by moving your own Master onto the square where the opponent\'s Master started (their shrine). This version deals cards and decides who starts at random rather than by the card\'s printed starting-color stamp — a deliberate simplification, and card names/patterns are reproduced from memory of the published design rather than the official card set.',
    start,
  });
})();
