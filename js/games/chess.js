(function () {
  const N = 8, CELL = 52;
  const BOARD_PX = N * CELL;
  const BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  const QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);
  const KNIGHT_JUMPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const GLYPH = {
    p1: { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' },
    p2: { K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' },
  };

  function inB(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
  function opp(p){ return p==='p1' ? 'p2' : 'p1'; }

  function initState(){
    const board = Array.from({length:8}, () => Array(8).fill(null));
    const backRank = ['R','N','B','Q','K','B','N','R'];
    for(let c=0;c<8;c++){
      board[0][c] = { type: backRank[c], player:'p2' };
      board[1][c] = { type:'P', player:'p2' };
      board[6][c] = { type:'P', player:'p1' };
      board[7][c] = { type: backRank[c], player:'p1' };
    }
    return {
      board, turn:'p1',
      castling: { p1:{K:true,Q:true}, p2:{K:true,Q:true} },
      enPassant: null,
      capturedByP1: 0, capturedByP2: 0,
    };
  }

  function findKing(board, player){
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c] && board[r][c].type==='K' && board[r][c].player===player) return {r,c};
    return null;
  }

  function slideAttack(board, r, c, dirs, types, byPlayer){
    for(const [dr,dc] of dirs){
      let nr=r+dr, nc=c+dc;
      while(inB(nr,nc)){
        const p = board[nr][nc];
        if(p){ if(p.player===byPlayer && types.includes(p.type)) return true; break; }
        nr+=dr; nc+=dc;
      }
    }
    return false;
  }

  function squareAttackedBy(board, r, c, byPlayer){
    const dir = byPlayer==='p1' ? -1 : 1;
    const srcRow = r - dir;
    for(const srcCol of [c-1, c+1]){
      if(inB(srcRow,srcCol)){
        const p = board[srcRow][srcCol];
        if(p && p.type==='P' && p.player===byPlayer) return true;
      }
    }
    for(const [dr,dc] of KNIGHT_JUMPS){
      const nr=r+dr, nc=c+dc;
      if(inB(nr,nc)){
        const p = board[nr][nc];
        if(p && p.type==='N' && p.player===byPlayer) return true;
      }
    }
    for(const [dr,dc] of QUEEN_DIRS){
      const nr=r+dr, nc=c+dc;
      if(inB(nr,nc)){
        const p = board[nr][nc];
        if(p && p.type==='K' && p.player===byPlayer) return true;
      }
    }
    if(slideAttack(board,r,c,BISHOP_DIRS,['B','Q'],byPlayer)) return true;
    if(slideAttack(board,r,c,ROOK_DIRS,['R','Q'],byPlayer)) return true;
    return false;
  }

  function isInCheck(board, player){
    const k = findKing(board, player);
    if(!k) return false;
    return squareAttackedBy(board, k.r, k.c, opp(player));
  }

  function pseudoMovesForPiece(state, r, c){
    const board = state.board;
    const piece = board[r][c];
    const moves = [];
    if(!piece) return moves;
    const player = piece.player;

    if(piece.type==='P'){
      const dir = player==='p1' ? -1 : 1;
      const startRow = player==='p1' ? 6 : 1;
      const promoRow = player==='p1' ? 0 : 7;
      const oneR = r+dir;
      if(inB(oneR,c) && !board[oneR][c]){
        moves.push({ from:{r,c}, to:{r:oneR,c}, promotion: oneR===promoRow ? 'Q' : null });
        const twoR = r+2*dir;
        if(r===startRow && !board[twoR][c]) moves.push({ from:{r,c}, to:{r:twoR,c}, isDoubleStep:true });
      }
      for(const dc of [-1,1]){
        const nr=r+dir, nc=c+dc;
        if(!inB(nr,nc)) continue;
        const target = board[nr][nc];
        if(target && target.player!==player){
          moves.push({ from:{r,c}, to:{r:nr,c:nc}, promotion: nr===promoRow ? 'Q' : null });
        } else if(!target && state.enPassant && state.enPassant.r===nr && state.enPassant.c===nc){
          moves.push({ from:{r,c}, to:{r:nr,c:nc}, enPassantCapture:true });
        }
      }
      return moves;
    }

    if(piece.type==='N'){
      for(const [dr,dc] of KNIGHT_JUMPS){
        const nr=r+dr, nc=c+dc;
        if(!inB(nr,nc)) continue;
        const target = board[nr][nc];
        if(!target || target.player!==player) moves.push({ from:{r,c}, to:{r:nr,c:nc} });
      }
      return moves;
    }

    if(piece.type==='K'){
      for(const [dr,dc] of QUEEN_DIRS){
        const nr=r+dr, nc=c+dc;
        if(!inB(nr,nc)) continue;
        const target = board[nr][nc];
        if(!target || target.player!==player) moves.push({ from:{r,c}, to:{r:nr,c:nc} });
      }
      const rights = state.castling[player];
      if(!isInCheck(board, player)){
        if(rights.K && !board[r][5] && !board[r][6] && board[r][7] && board[r][7].type==='R' && board[r][7].player===player){
          if(!squareAttackedBy(board,r,5,opp(player)) && !squareAttackedBy(board,r,6,opp(player))){
            moves.push({ from:{r,c}, to:{r,c:6}, castle:'K' });
          }
        }
        if(rights.Q && !board[r][1] && !board[r][2] && !board[r][3] && board[r][0] && board[r][0].type==='R' && board[r][0].player===player){
          if(!squareAttackedBy(board,r,2,opp(player)) && !squareAttackedBy(board,r,3,opp(player))){
            moves.push({ from:{r,c}, to:{r,c:2}, castle:'Q' });
          }
        }
      }
      return moves;
    }

    const dirs = piece.type==='B' ? BISHOP_DIRS : piece.type==='R' ? ROOK_DIRS : QUEEN_DIRS;
    for(const [dr,dc] of dirs){
      let nr=r+dr, nc=c+dc;
      while(inB(nr,nc)){
        const target = board[nr][nc];
        if(!target){ moves.push({ from:{r,c}, to:{r:nr,c:nc} }); }
        else { if(target.player!==player) moves.push({ from:{r,c}, to:{r:nr,c:nc} }); break; }
        nr+=dr; nc+=dc;
      }
    }
    return moves;
  }

  function applyMove(state, move){
    const s = Common.clone(state);
    const board = s.board;
    const mover = board[move.from.r][move.from.c];
    const player = mover.player;
    let capturedPiece = null;

    if(move.castle){
      board[move.to.r][move.to.c] = mover;
      board[move.from.r][move.from.c] = null;
      if(move.castle==='K'){
        board[move.from.r][5] = board[move.from.r][7];
        board[move.from.r][7] = null;
      } else {
        board[move.from.r][3] = board[move.from.r][0];
        board[move.from.r][0] = null;
      }
    } else if(move.enPassantCapture){
      capturedPiece = board[move.from.r][move.to.c];
      board[move.from.r][move.to.c] = null;
      board[move.to.r][move.to.c] = mover;
      board[move.from.r][move.from.c] = null;
    } else {
      capturedPiece = board[move.to.r][move.to.c];
      board[move.to.r][move.to.c] = mover;
      board[move.from.r][move.from.c] = null;
    }
    if(move.promotion) board[move.to.r][move.to.c] = { type: move.promotion, player };
    if(capturedPiece){ if(player==='p1') s.capturedByP1++; else s.capturedByP2++; }

    if(mover.type==='K'){ s.castling[player].K=false; s.castling[player].Q=false; }
    if(mover.type==='R'){
      if(move.from.c===0) s.castling[player].Q=false;
      if(move.from.c===7) s.castling[player].K=false;
    }
    if(move.to.r===0 && move.to.c===0) s.castling.p2.Q=false;
    if(move.to.r===0 && move.to.c===7) s.castling.p2.K=false;
    if(move.to.r===7 && move.to.c===0) s.castling.p1.Q=false;
    if(move.to.r===7 && move.to.c===7) s.castling.p1.K=false;

    s.enPassant = move.isDoubleStep ? { r:(move.from.r+move.to.r)/2, c: move.from.c } : null;
    s.turn = opp(player);
    return s;
  }

  function getMoves(state){
    const pseudo = [];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p = state.board[r][c];
      if(p && p.player===state.turn) pseudo.push(...pseudoMovesForPiece(state, r, c));
    }
    return pseudo.filter(mv => {
      const next = applyMove(state, mv);
      return !isInCheck(next.board, state.turn);
    });
  }

  function isTerminal(state){ return getMoves(state).length === 0; }

  function centerBonus(type, r, c){
    if(type==='K') return 0;
    const dist = Math.max(Math.abs(r-3.5), Math.abs(c-3.5));
    const bonus = (3.5-dist)*6;
    return type==='P' ? bonus*0.5 : bonus;
  }

  const VALUES = { P:100, N:320, B:330, R:500, Q:900, K:0 };

  function makeApi(aiSide){
    return {
      getMoves, applyMove, isTerminal,
      evaluate(state){
        const moves = getMoves(state);
        if(moves.length===0){
          if(isInCheck(state.board, state.turn)){
            const winner = opp(state.turn);
            return winner===aiSide ? 100000 : -100000;
          }
          return 0;
        }
        let score = 0;
        for(let r=0;r<8;r++) for(let c=0;c<8;c++){
          const p = state.board[r][c];
          if(!p) continue;
          const val = VALUES[p.type] + centerBonus(p.type, r, c);
          score += p.player===aiSide ? val : -val;
        }
        return score;
      },
    };
  }

  function labelFor(side){ return side==='p1' ? 'White' : 'Black'; }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let selected = null;
    let destroyed = false;
    const AI_SIDE = mode==='ai' ? 'p2' : null;
    const api = makeApi('p2');

    boardEl.innerHTML='';
    const shell = Common.el('div', { style:`position:relative;width:${BOARD_PX}px;height:${BOARD_PX}px;` });
    boardEl.appendChild(shell);

    function render(){
      shell.innerHTML='';
      const legalAll = selected ? getMoves(state).filter(m => m.from.r===selected.r && m.from.c===selected.c) : [];
      for(let r=0;r<8;r++) for(let c=0;c<8;c++){
        const div = Common.el('div', { class:'cell' });
        div.style.left=(c*CELL)+'px'; div.style.top=(r*CELL)+'px';
        div.style.width=CELL+'px'; div.style.height=CELL+'px';
        div.style.background = (r+c)%2===0 ? '#ebe0c8' : '#8a6642';
        const piece = state.board[r][c];
        const mv = legalAll.find(m => m.to.r===r && m.to.c===c);
        if(selected && selected.r===r && selected.c===c) div.style.boxShadow='inset 0 0 0 3px var(--t-accent, var(--gold))';
        if(mv) div.classList.add(piece ? 'capturable' : 'movable');
        div.appendChild(Common.el('div',{class:'hit'}));
        if(piece){
          div.appendChild(Common.el('div', {
            text: GLYPH[piece.player][piece.type],
            style: `font-size:${CELL*0.72}px;line-height:${CELL}px;width:100%;text-align:center;color:${piece.player==='p1' ? '#fdfdfd':'#141414'};text-shadow:${piece.player==='p1' ? '0 1px 2px rgba(0,0,0,0.6)':'0 1px 1px rgba(255,255,255,0.25)'};`
          }));
        }
        div.addEventListener('click', () => onClick(r,c));
        shell.appendChild(div);
      }
      const check = isInCheck(state.board, state.turn);
      panel.setTurn(labelFor(state.turn)+(check?' (in check)':'')+' to move', state.turn==='p1' ? '#eee' : '#222');
      panel.setStats([
        { label:'White captures', value: state.capturedByP1 },
        { label:'Black captures', value: state.capturedByP2 },
      ]);
    }

    function onClick(r,c){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      const piece = state.board[r][c];
      if(selected){
        const legal = getMoves(state).filter(m => m.from.r===selected.r && m.from.c===selected.c);
        const mv = legal.find(m => m.to.r===r && m.to.c===c);
        if(mv){ state = applyMove(state, mv); selected=null; afterMove(); return; }
      }
      selected = (piece && piece.player===state.turn) ? {r,c} : null;
      render();
    }

    function afterMove(){
      render();
      if(isTerminal(state)){
        if(isInCheck(state.board, state.turn)){
          panel.setMessage(`Checkmate — ${labelFor(opp(state.turn))} wins.`);
        } else {
          panel.setMessage("Stalemate — it's a draw.");
        }
        return;
      }
      panel.setMessage(`${labelFor(state.turn)} to move${isInCheck(state.board,state.turn) ? ' — check!' : '.'}`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);
    }

    function aiTurn(){
      if(destroyed) return;
      const mv = Common.bestMove(state, 3, api);
      if(mv) state = applyMove(state, mv);
      afterMove();
    }

    render();
    panel.setMessage('White moves first. Standard chess rules apply, including castling and en passant. Pawns reaching the last rank auto-promote to a queen.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 400);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'chess',
    name:'Chess',
    emblem:'♞',
    theme: { accent:'#b08d57', panel:'#241f1a', board1:'#ebe0c8', board2:'#8a6642', p1Light:'#fdfdfd', p1Dark:'#cfcfcf', p2Light:'#3a3a3a', p2Dark:'#0a0a0a' },
    tagline:'The classic — full rules, castling, en passant.',
    rules:'<strong>Chess:</strong> standard rules, including castling, en passant, and check/checkmate detection. Pawns reaching the last rank auto-promote to a queen (no under-promotion choice in this version). The AI searches 3 plies ahead with material and basic positional evaluation — a solid casual opponent, not a tournament-strength engine.',
    start,
  });
})();
