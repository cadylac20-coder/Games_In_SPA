(function () {
  const N = 7;
  const HEX_W = 46, HEX_H = 40;
  const NEIGH = [[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]];
  function inBounds(r,c){ return r>=0 && r<N && c>=0 && c<N; }

  function initState(){
    return { board: Array.from({length:N}, () => Array(N).fill(null)), turn:'p1' };
  }

  function allMoves(state){
    const out=[];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(!state.board[r][c]) out.push({r,c});
    return out;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    s.board[move.r][move.c] = s.turn;
    s.turn = s.turn==='p1' ? 'p2' : 'p1';
    return s;
  }

  function isConnected(board, player){
    const visited = Array.from({length:N}, () => Array(N).fill(false));
    const stack = [];
    if(player==='p1'){
      for(let r=0;r<N;r++) if(board[r][0]===player){ stack.push([r,0]); visited[r][0]=true; }
    } else {
      for(let c=0;c<N;c++) if(board[0][c]===player){ stack.push([0,c]); visited[0][c]=true; }
    }
    while(stack.length){
      const [r,c] = stack.pop();
      if(player==='p1' && c===N-1) return true;
      if(player==='p2' && r===N-1) return true;
      for(const [dr,dc] of NEIGH){
        const nr=r+dr, nc=c+dc;
        if(inBounds(nr,nc) && !visited[nr][nc] && board[nr][nc]===player){
          visited[nr][nc]=true; stack.push([nr,nc]);
        }
      }
    }
    return false;
  }

  function winnerOf(state){
    if(isConnected(state.board,'p1')) return 'p1';
    if(isConnected(state.board,'p2')) return 'p2';
    return null;
  }

  // Flat Monte Carlo: for each empty cell, run random rollouts to the end and
  // measure the AI's win rate. Good enough for a small 7x7 board.
  function monteCarloMove(state, aiSide, rolloutsPerMove){
    const moves = allMoves(state);
    if(moves.length===0) return null;
    let bestMove = moves[0], bestRate = -1;
    for(const mv of moves){
      let wins = 0;
      const afterMove = applyMove(state, mv);
      for(let i=0;i<rolloutsPerMove;i++){
        if(rollout(afterMove) === aiSide) wins++;
      }
      const rate = wins / rolloutsPerMove;
      if(rate > bestRate){ bestRate = rate; bestMove = mv; }
    }
    return bestMove;
  }

  function rollout(state){
    const board = state.board.map(row => row.slice());
    let turn = state.turn;
    const empties = [];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(!board[r][c]) empties.push([r,c]);
    for(let i=empties.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [empties[i], empties[j]] = [empties[j], empties[i]];
    }
    for(const [r,c] of empties){ board[r][c] = turn; turn = turn==='p1' ? 'p2':'p1'; }
    return isConnected(board,'p1') ? 'p1' : 'p2';
  }

  function labelFor(side){ return side==='p1' ? 'Amber (left ↔ right)' : 'Slate (top ↔ bottom)'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let destroyed = false;
    let gameOver = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;

    const boardWidth = (N + (N-1)/2) * (HEX_W*0.82) + HEX_W;
    const boardHeight = N * (HEX_H*0.82) + HEX_H;

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${boardWidth}px;height:${boardHeight}px;` });
    boardEl.appendChild(shell);

    function hexPos(r,c){
      const x = c*(HEX_W*0.82) + r*(HEX_W*0.41) + 10;
      const y = r*(HEX_H*0.82) + 10;
      return {x,y};
    }

    function render(){
      shell.innerHTML='';
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const {x,y} = hexPos(r,c);
        const div = Common.el('div');
        div.style.position='absolute'; div.style.left=x+'px'; div.style.top=y+'px';
        div.style.width=HEX_W+'px'; div.style.height=HEX_H+'px';
        div.style.clipPath='polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
        div.style.background = state.board[r][c] ? '' : 'rgba(138,90,52,0.16)';
        div.style.border = '1px solid rgba(138,90,52,0.4)';
        div.style.cursor='pointer';
        div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center';
        const piece = state.board[r][c];
        if(piece){
          const dot = Common.el('div', { style:'width:26px;height:26px;border-radius:50%;box-shadow:0 3px 6px rgba(0,0,0,0.35), inset 0 -3px 6px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.25);' });
          dot.style.background = piece==='p1'
            ? 'radial-gradient(circle at 35% 30%, #fffaf0, #d8c8a2 70%)'
            : 'radial-gradient(circle at 35% 30%, #6a7fa8, #33456b 70%)';
          div.appendChild(dot);
        }
        div.addEventListener('click', () => onClick(r,c));
        shell.appendChild(div);
      }
      panel.setTurn(labelFor(state.turn), state.turn==='p1' ? '#e8dcc0' : '#33456b');
      panel.setStats([
        { label:'Amber goal', value:'left edge ↔ right edge' },
        { label:'Slate goal', value:'top edge ↔ bottom edge' },
      ]);
    }

    function onClick(r,c){
      if(destroyed || gameOver) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(state.board[r][c]) return;
      state = applyMove(state, {r,c});
      afterMove();
    }

    function afterMove(){
      const w = winnerOf(state);
      if(w){
        gameOver = true;
        render();
        panel.setMessage(`${labelFor(w)} connects their two sides — game over.`);
        return;
      }
      render();
      panel.setMessage(`${labelFor(state.turn)} to move.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 250);
    }

    function aiTurn(){
      if(destroyed) return;
      panel.setMessage('Slate is thinking…');
      setTimeout(() => {
        if(destroyed) return;
        const mv = monteCarloMove(state, AI_SIDE, 60);
        if(mv) state = applyMove(state, mv);
        afterMove();
      }, 30);
    }

    render();
    panel.setMessage('Amber moves first. Amber connects left↔right, Slate connects top↔bottom. No captures — just claim a path.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 300);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'hex',
    name:'Hex',
    emblem:'⬡',
    theme: { accent:'#5b8cae', panel:'#1b2e42', board1:'#eef3f7', board2:'#dbe6ee' },
    tagline:'Pure connection game on a 7×7 hex grid.',
    rules:'<strong>Hex:</strong> take turns placing one stone on any empty cell. Amber wins by forming a connected chain from the left edge to the right edge; Slate wins by connecting top to bottom. There are no captures and draws are impossible. The AI here uses random-rollout (Monte Carlo) evaluation rather than deep search.',
    start,
  });
})();
