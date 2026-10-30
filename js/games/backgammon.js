(function () {
  const POINT_W = 40, POINT_H = 150, GAP = 26;
  const BOARD_W = POINT_W*12 + GAP;
  const BOARD_H = POINT_H*2 + 50;

  function pipValue(player,i){ return player==='p1' ? i+1 : 24-i; }
  function opp(p){ return p==='p1' ? 'p2':'p1'; }

  function initState(){
    const points = Array(24).fill(null);
    points[23] = { player:'p1', count:2 };
    points[12] = { player:'p1', count:5 };
    points[7]  = { player:'p1', count:3 };
    points[5]  = { player:'p1', count:5 };
    points[0]  = { player:'p2', count:2 };
    points[11] = { player:'p2', count:5 };
    points[16] = { player:'p2', count:3 };
    points[18] = { player:'p2', count:5 };
    return { points, bar:{p1:0,p2:0}, off:{p1:0,p2:0}, turn:'p1', dice:[], rolled:false };
  }

  function allCheckersHome(state, player){
    if(state.bar[player]>0) return false;
    for(let i=0;i<24;i++){
      const p = state.points[i];
      if(p && p.player===player && pipValue(player,i)>6) return false;
    }
    return true;
  }

  function movesForDie(state, die){
    const player = state.turn;
    if(state.bar[player]>0){
      const entry = player==='p1' ? 24-die : die-1;
      const target = state.points[entry];
      if(target && target.player!==player && target.count>=2) return [];
      return [{ kind:'enter', to:entry, die }];
    }
    const moves=[];
    const home = allCheckersHome(state, player);
    for(let i=0;i<24;i++){
      const pt = state.points[i];
      if(!pt || pt.player!==player) continue;
      const dest = player==='p1' ? i-die : i+die;
      if(dest>=0 && dest<=23){
        const target = state.points[dest];
        if(!(target && target.player!==player && target.count>=2)) moves.push({ kind:'move', from:i, to:dest, die });
      } else if(home){
        const needed = pipValue(player,i);
        if(die===needed) moves.push({ kind:'bearoff', from:i, die });
        else if(die>needed){
          const fartherExists = state.points.some((p,j) => p && p.player===player && pipValue(player,j) > needed);
          if(!fartherExists) moves.push({ kind:'bearoff', from:i, die });
        }
      }
    }
    return moves;
  }

  function anyLegalMove(state){
    const seen = new Set();
    for(const d of state.dice){
      if(seen.has(d)) continue; seen.add(d);
      if(movesForDie(state,d).length>0) return true;
    }
    return false;
  }

  function applyDieMove(state, move){
    const s = Common.clone(state);
    const player = s.turn;
    function place(idx){
      const target = s.points[idx];
      if(target && target.player!==player){
        s.bar[target.player]++;
        s.points[idx] = { player, count:1 };
      } else if(target){
        target.count++;
      } else {
        s.points[idx] = { player, count:1 };
      }
    }
    function removeFrom(idx){
      const p = s.points[idx];
      p.count--;
      if(p.count<=0) s.points[idx] = null;
    }
    if(move.kind==='enter'){ s.bar[player]--; place(move.to); }
    else if(move.kind==='move'){ removeFrom(move.from); place(move.to); }
    else if(move.kind==='bearoff'){ removeFrom(move.from); s.off[player]++; }

    const idx = s.dice.indexOf(move.die);
    if(idx>=0) s.dice.splice(idx,1);
    return s;
  }

  function rollDice(){
    const a = 1+Math.floor(Math.random()*6);
    const b = 1+Math.floor(Math.random()*6);
    return a===b ? [a,a,a,a] : [a,b];
  }

  function labelFor(side){ return side==='p1' ? 'Ivory' : 'Walnut'; }

  function aiPickMove(state){
    const seen=new Set(); const candidates=[];
    for(const d of state.dice){
      if(seen.has(d)) continue; seen.add(d);
      candidates.push(...movesForDie(state,d));
    }
    if(candidates.length===0) return null;
    const player = state.turn;
    function score(m){
      let s=0;
      if(m.kind==='enter') s+=50;
      if(m.kind==='bearoff') s+=40;
      if(m.kind==='move'){
        const target = state.points[m.to];
        if(target && target.player!==player && target.count===1) s+=30; // hits a blot
        const after = state.points[m.to];
        // mild preference for stacking safety / advancing
        s += (player==='p1' ? (23-m.to) : m.to) * 0.2;
      }
      return s + Math.random()*5;
    }
    candidates.sort((a,b) => score(b)-score(a));
    return candidates[0];
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let destroyed = false;
    let activeDie = null;
    const AI_SIDE = mode==='ai' ? 'p2' : null;

    boardEl.innerHTML='';
    const wrap = Common.el('div', { style:'display:flex;flex-direction:column;gap:12px;align-items:center;' });
    const diceRow = Common.el('div', { style:'display:flex;gap:10px;align-items:center;min-height:40px;' });
    const boardDiv = Common.el('div', { style:`position:relative;width:${BOARD_W}px;height:${BOARD_H}px;background:#3b2417;border-radius:8px;` });
    const controlsRow = Common.el('div', { style:'display:flex;gap:10px;' });
    wrap.appendChild(diceRow); wrap.appendChild(boardDiv); wrap.appendChild(controlsRow);
    boardEl.appendChild(wrap);

    const rollBtn = Common.el('button', { text:'Roll dice', onclick: onRoll });
    const endBtn = Common.el('button', { text:'End turn', onclick: onEndTurn });
    controlsRow.appendChild(rollBtn); controlsRow.appendChild(endBtn);

    function pointX(i){
      // top row: idx 12..23 left->right ; bottom row idx 11..0 left->right (mirrored)
      if(i>=12){
        const col = i-12;
        return col<6 ? col*POINT_W : col*POINT_W+GAP;
      } else {
        const col = 11-i;
        return col<6 ? col*POINT_W : col*POINT_W+GAP;
      }
    }
    function pointSide(i){ return i>=12 ? 'top' : 'bottom'; }

    function render(){
      boardDiv.innerHTML='';
      // bar divider
      boardDiv.appendChild(Common.el('div', { style:`position:absolute;left:${6*POINT_W}px;top:0;width:${GAP}px;height:100%;background:#241810;` }));

      const dieAvailable = new Set(state.dice);
      const legalDestsForActive = (activeDie!=null) ? movesForDie(state, activeDie) : [];

      for(let i=0;i<24;i++){
        const x = pointX(i);
        const side = pointSide(i);
        const triHeight = POINT_H;
        const y = side==='top' ? 0 : BOARD_H - triHeight;
        const div = Common.el('div');
        div.style.position='absolute'; div.style.left=x+'px'; div.style.top=y+'px';
        div.style.width=POINT_W+'px'; div.style.height=triHeight+'px';
        div.style.display='flex'; div.style.flexDirection = side==='top' ? 'column' : 'column-reverse';
        div.style.alignItems='center'; div.style.cursor='pointer';
        const shade = (i%2===0) ? 'rgba(201,154,74,0.25)' : 'rgba(239,230,211,0.12)';
        div.style.background = `linear-gradient(${side==='top'?'180deg':'0deg'}, ${shade}, transparent 85%)`;

        const isDest = legalDestsForActive.some(m => (m.kind==='move'||m.kind==='enter') && (m.to===i));
        if(isDest) div.style.boxShadow = 'inset 0 0 0 2px var(--move-dot)';

        const pt = state.points[i];
        if(pt){
          const shown = Math.min(pt.count,5);
          for(let k=0;k<shown;k++){
            const c = Common.el('div', { style:`width:32px;height:32px;border-radius:50%;margin:2px 0;box-shadow:0 2px 4px rgba(0,0,0,0.4);background:${pt.player==='p1' ? 'radial-gradient(circle at 35% 30%,#fffaf0,#d8c8a2 70%)' : 'radial-gradient(circle at 35% 30%,#5a3a24,#2a1810 70%)'};` });
            div.appendChild(c);
          }
          if(pt.count>5) div.appendChild(Common.el('div', { text:`+${pt.count-5}`, style:'font-size:0.7rem;color:#c99a4a;' }));
        }
        div.addEventListener('click', () => onPointClick(i));
        boardDiv.appendChild(div);
      }

      // bar checkers
      ['p1','p2'].forEach((pl) => {
        if(state.bar[pl]>0){
          const div = Common.el('div', { text:`⛒ ${state.bar[pl]}`, style:`position:absolute;left:${6*POINT_W+4}px;top:${pl==='p1' ? 10 : BOARD_H-34}px;width:${GAP-8}px;text-align:center;color:#c99a4a;font-size:0.75rem;cursor:pointer;` });
          div.addEventListener('click', () => onBarClick(pl));
          boardDiv.appendChild(div);
        }
      });

      diceRow.innerHTML='';
      state.dice.forEach((d) => {
        const btn = Common.el('button', {
          text: String(d),
          style: `flex:none;width:36px;height:36px;padding:0;font-size:1rem;${activeDie===d ? 'background:var(--gold);color:var(--indigo-deep);' : ''}`,
          onclick: () => { activeDie = (activeDie===d) ? null : d; render(); },
        });
        diceRow.appendChild(btn);
      });
      if(state.dice.length===0) diceRow.appendChild(Common.el('div', { text:'—', style:'color:#8899b5;' }));

      rollBtn.style.display = (!state.rolled && !(mode==='ai' && state.turn===AI_SIDE)) ? 'block' : 'none';
      endBtn.style.display = (state.rolled && mode!=='ai' ) || (state.rolled && mode==='ai' && state.turn!==AI_SIDE) ? 'block' : 'none';

      panel.setTurn(labelFor(state.turn)+' to move', state.turn==='p1' ? '#e8dcc0' : '#3a2a1e');
      panel.setStats([
        { label:'Ivory borne off', value: `${state.off.p1}/15` },
        { label:'Walnut borne off', value: `${state.off.p2}/15` },
        { label:'Ivory on bar', value: state.bar.p1 },
        { label:'Walnut on bar', value: state.bar.p2 },
      ]);
    }

    function onRoll(){
      if(destroyed || state.rolled) return;
      state.dice = rollDice();
      state.rolled = true;
      activeDie = null;
      if(!anyLegalMove(state)){
        panel.setMessage(`${labelFor(state.turn)} rolled ${state.dice.join(', ')} but has no legal move — turn passes.`);
        render();
        setTimeout(onEndTurn, 900);
        return;
      }
      panel.setMessage(`${labelFor(state.turn)} rolled ${state.dice.join(', ')}. Pick a die, then a checker (or the bar) to move it.`);
      render();
    }

    function onBarClick(pl){
      if(destroyed || pl!==state.turn) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(activeDie==null){ panel.setMessage('Select a die first.'); return; }
      const legal = movesForDie(state, activeDie).filter(m => m.kind==='enter');
      if(legal.length===0){ panel.setMessage('That die cannot enter from the bar right now.'); return; }
      commit(legal[0]);
    }

    function onPointClick(i){
      if(destroyed) return;
      if(mode==='ai' && state.turn===AI_SIDE) return;
      if(state.bar[state.turn]>0){ panel.setMessage('You must enter from the bar before making other moves.'); return; }
      if(activeDie==null){ panel.setMessage('Select a die first.'); return; }
      const legal = movesForDie(state, activeDie);
      const mv = legal.find(m => (m.kind==='move' && m.from===i) || (m.kind==='bearoff' && m.from===i));
      if(!mv){ panel.setMessage('No legal move for that die from there.'); return; }
      commit(mv);
    }

    function commit(mv){
      state = applyDieMove(state, mv);
      activeDie = null;
      checkWinAndContinue();
    }

    function checkWinAndContinue(){
      if(state.off.p1===15 || state.off.p2===15){
        render();
        panel.setMessage(`${labelFor(state.off.p1===15?'p1':'p2')} has borne off all 15 checkers and wins!`);
        rollBtn.style.display='none'; endBtn.style.display='none';
        return;
      }
      if(state.dice.length===0){ onEndTurn(); return; }
      if(!anyLegalMove(state)){
        panel.setMessage('No more legal moves this turn.');
        render();
        setTimeout(onEndTurn, 700);
        return;
      }
      render();
      panel.setMessage(`${labelFor(state.turn)}: dice left ${state.dice.join(', ')}.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiStep, 500);
    }

    function onEndTurn(){
      if(destroyed) return;
      if(state.off.p1===15 || state.off.p2===15) return;
      state.turn = opp(state.turn);
      state.dice = [];
      state.rolled = false;
      activeDie = null;
      render();
      panel.setMessage(`${labelFor(state.turn)} to roll.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);
    }

    function aiTurn(){
      if(destroyed) return;
      state.dice = rollDice();
      state.rolled = true;
      if(!anyLegalMove(state)){
        panel.setMessage(`${labelFor(state.turn)} rolled ${state.dice.join(', ')} — no legal move.`);
        render();
        setTimeout(onEndTurn, 700);
        return;
      }
      render();
      setTimeout(aiStep, 500);
    }

    function aiStep(){
      if(destroyed) return;
      if(state.dice.length===0 || !anyLegalMove(state)){ checkWinAndContinue(); return; }
      const mv = aiPickMove(state);
      if(mv) state = applyDieMove(state, mv);
      render();
      if(state.off.p1===15 || state.off.p2===15){ checkWinAndContinue(); return; }
      if(state.dice.length>0 && anyLegalMove(state)) setTimeout(aiStep, 450);
      else checkWinAndContinue();
    }

    render();
    panel.setMessage('Ivory moves first (traveling toward the lower-right home board). Roll, pick a die, then click a checker or the bar to move it.');
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'backgammon',
    name:'Backgammon',
    emblem:'⚀',
    theme: { accent:'#c9a24a', panel:'#2a1810', board1:'#3b2417', board2:'#2a1810', p1Light:'#fffaf0', p1Dark:'#d8c8a2', p2Light:'#5a3a24', p2Dark:'#2a1810' },
    tagline:'Classic dice race game — bear off all 15 checkers first.',
    rules:"<strong>Backgammon:</strong> roll two dice and move checkers that many pips toward your home board (doubles give four moves of that value). A point held by two or more enemy checkers is blocked; a single enemy checker (a blot) is hit and sent to the bar, and must re-enter before its owner can make any other move. Bear off once all 15 of your checkers are in your home board. This version simplifies tournament play by not enforcing the strict 'use the maximum number of dice possible' rule — you can skip a die with no legal move.",
    start,
  });
})();
