(function () {
  const COLORS = ['R','Y','G','B'];
  const COLOR_HEX = { R:'#c1502e', Y:'#d9b23c', G:'#4fae8b', B:'#5b8cae' };
  const COLOR_NAME = { R:'Red (Attack)', Y:'Yellow (Build)', G:'Green (Move)', B:'Blue (Trade)' };
  const SIZE_PX = { 1:16, 2:22, 3:28 };

  function freshBank(){
    const bank = {};
    COLORS.forEach(c => { bank[c] = { 1:3, 2:3, 3:3 }; });
    return bank;
  }
  function smallestAvailable(bank, color){
    for(const size of [1,2,3]) if(bank[color][size]>0) return size;
    return null;
  }

  function initState(){
    const bank = freshBank();
    let nextId = 1;
    function takeShip(player, color, size){
      bank[color][size]--;
      return { id:`ship${nextId++}`, player, color, size };
    }
    bank.G[3] -= 2; // stars
    const p1Ships = [takeShip('p1','Y',1), takeShip('p1','G',1), takeShip('p1','B',1)];
    const p2Ships = [takeShip('p2','Y',1), takeShip('p2','G',1), takeShip('p2','B',1)];
    return {
      bank,
      nextId,
      systems: [
        { id:'home-p1', name:"Copper's Homeworld", star:{color:'G',size:3}, isHomeworld:'p1', ships:p1Ships },
        { id:'home-p2', name:"Slate's Homeworld", star:{color:'G',size:3}, isHomeworld:'p2', ships:p2Ships },
      ],
      turn:'p1',
      gameOver:false,
      winner:null,
    };
  }

  function opp(p){ return p==='p1' ? 'p2':'p1'; }
  function playerColorsPresent(system, player){
    return new Set(system.ships.filter(s => s.player===player).map(s => s.color));
  }

  function getAvailableActions(system, player){
    const colors = playerColorsPresent(system, player);
    const actions = [];
    if(colors.has('Y')) actions.push('build');
    if(colors.has('B')) actions.push('trade');
    if(colors.has('G')) actions.push('move');
    if(colors.has('R')) actions.push('attack');
    return actions;
  }

  function checkCatastrophes(state){
    let destroyedHomeworldFor = null;
    state.systems = state.systems.filter(system => {
      let starDestroyed = false;
      for(const color of COLORS){
        const total = (system.star.color===color ? 1:0) + system.ships.filter(s => s.color===color).length;
        if(total>=4){
          if(system.star.color===color){ state.bank[color][system.star.size]++; starDestroyed = true; }
          system.ships.filter(s => s.color===color).forEach(s => { state.bank[color][s.size]++; });
          system.ships = system.ships.filter(s => s.color!==color);
        }
      }
      if(starDestroyed){
        system.ships.forEach(s => { state.bank[s.color][s.size]++; });
        if(system.isHomeworld) destroyedHomeworldFor = system.isHomeworld;
        return false;
      }
      return true;
    });
    if(destroyedHomeworldFor){
      state.gameOver = true;
      state.winner = opp(destroyedHomeworldFor);
    }
  }

  function checkWipeout(state){
    if(state.gameOver) return;
    ['p1','p2'].forEach(pl => {
      const hasShips = state.systems.some(sys => sys.ships.some(s => s.player===pl));
      if(!hasShips){ state.gameOver = true; state.winner = opp(pl); }
    });
  }

  function getAllPossibleActions(state, player){
    const actions = [];
    state.systems.forEach(system => {
      const colors = playerColorsPresent(system, player);
      if(colors.has('Y')){
        COLORS.forEach(color => { if(smallestAvailable(state.bank,color)) actions.push({ type:'build', systemId:system.id, color }); });
      }
      if(colors.has('B')){
        system.ships.filter(s => s.player===player).forEach(ship => {
          COLORS.filter(c => c!==ship.color).forEach(newColor => {
            if(state.bank[newColor][ship.size]>0) actions.push({ type:'trade', systemId:system.id, shipId:ship.id, newColor });
          });
        });
      }
      if(colors.has('G')){
        system.ships.filter(s => s.player===player).forEach(ship => {
          state.systems.filter(s2 => s2.id!==system.id).forEach(dest => {
            actions.push({ type:'move', systemId:system.id, shipId:ship.id, destSystemId:dest.id });
          });
          COLORS.forEach(color => {
            const size = smallestAvailable(state.bank, color);
            if(size) actions.push({ type:'discover', systemId:system.id, shipId:ship.id, starColor:color, starSize:size });
          });
        });
      }
      if(colors.has('R')){
        system.ships.filter(s => s.player===player && s.color==='R').forEach(ship => {
          system.ships.filter(s2 => s2.player!==player && s2.size<=ship.size).forEach(target => {
            actions.push({ type:'attack', systemId:system.id, shipId:ship.id, targetId:target.id });
          });
        });
      }
    });
    return actions;
  }

  function applyAction(state, action){
    const s = Common.clone(state);
    const system = s.systems.find(sys => sys.id===action.systemId);
    if(action.type==='build'){
      const size = smallestAvailable(s.bank, action.color);
      s.bank[action.color][size]--;
      system.ships.push({ id:`ship${s.nextId++}`, player:s.turn, color:action.color, size });
    } else if(action.type==='trade'){
      const ship = system.ships.find(sh => sh.id===action.shipId);
      s.bank[ship.color][ship.size]++;
      s.bank[action.newColor][ship.size]--;
      ship.color = action.newColor;
    } else if(action.type==='attack'){
      const idx = system.ships.findIndex(sh => sh.id===action.targetId);
      const target = system.ships[idx];
      s.bank[target.color][target.size]++;
      system.ships.splice(idx,1);
    } else if(action.type==='move'){
      const idx = system.ships.findIndex(sh => sh.id===action.shipId);
      const ship = system.ships[idx];
      system.ships.splice(idx,1);
      s.systems.find(sys => sys.id===action.destSystemId).ships.push(ship);
    } else if(action.type==='discover'){
      const idx = system.ships.findIndex(sh => sh.id===action.shipId);
      const ship = system.ships[idx];
      system.ships.splice(idx,1);
      s.bank[action.starColor][action.starSize]--;
      s.systems.push({ id:`sys${s.nextId++}`, name:`Uncharted ${action.starColor}${action.starSize}`, star:{color:action.starColor, size:action.starSize}, isHomeworld:null, ships:[ship] });
    }
    checkCatastrophes(s);
    checkWipeout(s);
    if(!s.gameOver) s.turn = opp(s.turn);
    return s;
  }

  function labelFor(side){ return side==='p1' ? 'Copper' : 'Slate'; }

  function aiChooseAction(state){
    const player = state.turn;
    const options = getAllPossibleActions(state, player);
    if(options.length===0) return null;
    function score(a){
      if(a.type==='attack'){
        const system = state.systems.find(s => s.id===a.systemId);
        const target = system.ships.find(s => s.id===a.targetId);
        return 100 + target.size*10;
      }
      if(a.type==='build'){
        const already = new Set();
        state.systems.forEach(s => s.ships.filter(sh=>sh.player===player).forEach(sh=>already.add(sh.color)));
        return already.has('R') ? 20 : 60; // prioritize getting a Red ship online
      }
      if(a.type==='trade') return 15;
      if(a.type==='move') return 5;
      if(a.type==='discover') return 2;
      return 0;
    }
    return options.map(a => ({ a, s:score(a)+Math.random()*8 })).sort((x,y) => y.s-x.s)[0].a;
  }

  function start(ctx){
    const { boardEl, panel, mode } = ctx;
    let state = initState();
    let destroyed = false;
    let uiSystem = null, uiAction = null, uiShip = null;
    const AI_SIDE = mode==='ai' ? 'p2' : null;

    boardEl.innerHTML='';
    const wrap = Common.el('div', { style:'display:flex;flex-direction:column;gap:12px;width:560px;max-width:90vw;' });
    const bankRow = Common.el('div', { style:'display:flex;gap:10px;justify-content:center;font-size:0.75rem;color:#cdd6ea;' });
    const systemsRow = Common.el('div', { style:'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;' });
    const actionPanel = Common.el('div', { style:'min-height:70px;background:rgba(0,0,0,0.18);border-radius:10px;padding:10px;font-size:0.8rem;' });
    wrap.appendChild(bankRow);
    wrap.appendChild(systemsRow);
    wrap.appendChild(actionPanel);
    boardEl.appendChild(wrap);

    function shipDot(ship, extraStyle){
      return Common.el('div', {
        text: ship.size, title: `${COLOR_NAME[ship.color]} size ${ship.size} — ${labelFor(ship.player)}`,
        style: `width:${SIZE_PX[ship.size]+8}px;height:${SIZE_PX[ship.size]+8}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff;background:${COLOR_HEX[ship.color]};box-shadow:0 0 0 2px ${ship.player==='p1' ? '#c99a4a' : '#5b8cae'}, 0 2px 4px rgba(0,0,0,0.4);${extraStyle||''}`,
      });
    }

    function render(){
      bankRow.innerHTML='';
      COLORS.forEach(c => {
        bankRow.appendChild(Common.el('div', { text:`${COLOR_NAME[c]}: ${[1,2,3].map(sz=>state.bank[c][sz]).join('/')}`, style:`color:${COLOR_HEX[c]};` }));
      });

      systemsRow.innerHTML='';
      state.systems.forEach(system => {
        const card = Common.el('div', {
          style: `border-radius:10px;padding:10px;min-width:150px;cursor:pointer;background:${uiSystem===system.id ? 'rgba(201,154,74,0.25)':'rgba(255,255,255,0.05)'};border:1px solid rgba(201,154,74,0.35);`,
          onclick: () => { uiSystem = system.id; uiAction=null; uiShip=null; render(); },
        });
        card.appendChild(Common.el('div', { text: system.name || system.id, style:'font-size:0.7rem;color:#b7c1d9;margin-bottom:4px;' }));
        const starRow = Common.el('div', { style:'display:flex;gap:4px;align-items:center;margin-bottom:6px;' });
        starRow.appendChild(Common.el('div', { text:'★', style:`color:${COLOR_HEX[system.star.color]};font-size:${SIZE_PX[system.star.size]}px;` }));
        starRow.appendChild(Common.el('div', { text:`${system.star.color}${system.star.size}`, style:'font-size:0.65rem;color:#8899b5;' }));
        card.appendChild(starRow);
        const shipsRow = Common.el('div', { style:'display:flex;gap:4px;flex-wrap:wrap;' });
        system.ships.forEach(ship => shipsRow.appendChild(shipDot(ship)));
        card.appendChild(shipsRow);
        systemsRow.appendChild(card);
      });

      renderActionPanel();

      panel.setTurn(labelFor(state.turn)+' to act', state.turn==='p1' ? '#c99a4a' : '#5b8cae');
      panel.setStats([
        { label:'Copper ships', value: state.systems.reduce((n,s)=>n+s.ships.filter(sh=>sh.player==='p1').length,0) },
        { label:'Slate ships', value: state.systems.reduce((n,s)=>n+s.ships.filter(sh=>sh.player==='p2').length,0) },
      ]);
    }

    function renderActionPanel(){
      actionPanel.innerHTML='';
      if(destroyed || state.gameOver) return;
      if(mode==='ai' && state.turn===AI_SIDE){ actionPanel.appendChild(Common.el('div', { text:`${labelFor(state.turn)} is thinking…` })); return; }
      if(!uiSystem){ actionPanel.appendChild(Common.el('div', { text:'Click a system above to see what actions your ships there can power.' })); return; }
      const system = state.systems.find(s => s.id===uiSystem);
      const available = getAvailableActions(system, state.turn);
      if(!uiAction){
        if(available.length===0){ actionPanel.appendChild(Common.el('div', { text:"You have no ship color here that powers an action." })); return; }
        const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
        available.forEach(act => row.appendChild(Common.el('button', { text: act[0].toUpperCase()+act.slice(1), onclick: () => { uiAction=act; uiShip=null; render(); } })));
        actionPanel.appendChild(row);
        return;
      }
      if(uiAction==='build'){
        const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;align-items:center;' });
        row.appendChild(Common.el('div', { text:'Build which color?', style:'width:100%;margin-bottom:4px;' }));
        COLORS.forEach(c => {
          const size = smallestAvailable(state.bank, c);
          const btn = Common.el('button', { text:`${c} (${size||'—'})`, style:`color:${COLOR_HEX[c]};`, onclick: () => commit({ type:'build', systemId:uiSystem, color:c }) });
          btn.disabled = !size;
          row.appendChild(btn);
        });
        actionPanel.appendChild(row);
        return;
      }
      if(uiAction==='trade'){
        if(!uiShip){
          const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          row.appendChild(Common.el('div', { text:'Trade which of your ships?', style:'width:100%;margin-bottom:4px;' }));
          system.ships.filter(s => s.player===state.turn).forEach(ship => row.appendChild(Common.el('div', { onclick:()=>{ uiShip=ship.id; render(); } }, [shipDot(ship,'cursor:pointer;')])));
          actionPanel.appendChild(row);
        } else {
          const ship = system.ships.find(s => s.id===uiShip);
          const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          row.appendChild(Common.el('div', { text:`New color for this size-${ship.size} ship:`, style:'width:100%;margin-bottom:4px;' }));
          COLORS.filter(c => c!==ship.color).forEach(c => {
            const btn = Common.el('button', { text:c, style:`color:${COLOR_HEX[c]};`, onclick: () => commit({ type:'trade', systemId:uiSystem, shipId:ship.id, newColor:c }) });
            btn.disabled = state.bank[c][ship.size]<=0;
            row.appendChild(btn);
          });
          actionPanel.appendChild(row);
        }
        return;
      }
      if(uiAction==='attack'){
        if(!uiShip){
          const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          row.appendChild(Common.el('div', { text:'Attack with which Red ship?', style:'width:100%;margin-bottom:4px;' }));
          system.ships.filter(s => s.player===state.turn && s.color==='R').forEach(ship => row.appendChild(Common.el('div', { onclick:()=>{ uiShip=ship.id; render(); } }, [shipDot(ship,'cursor:pointer;')])));
          actionPanel.appendChild(row);
        } else {
          const ship = system.ships.find(s => s.id===uiShip);
          const targets = system.ships.filter(s => s.player!==state.turn && s.size<=ship.size);
          const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          row.appendChild(Common.el('div', { text: targets.length ? 'Destroy which enemy ship?' : 'No enemy ship here is small enough to destroy.', style:'width:100%;margin-bottom:4px;' }));
          targets.forEach(t => row.appendChild(Common.el('div', { onclick:()=>commit({ type:'attack', systemId:uiSystem, shipId:ship.id, targetId:t.id }) }, [shipDot(t,'cursor:pointer;')])));
          actionPanel.appendChild(row);
        }
        return;
      }
      if(uiAction==='move'){
        if(!uiShip){
          const row = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          row.appendChild(Common.el('div', { text:'Move which of your ships?', style:'width:100%;margin-bottom:4px;' }));
          system.ships.filter(s => s.player===state.turn).forEach(ship => row.appendChild(Common.el('div', { onclick:()=>{ uiShip=ship.id; render(); } }, [shipDot(ship,'cursor:pointer;')])));
          actionPanel.appendChild(row);
        } else {
          const row = Common.el('div', { style:'display:flex;flex-direction:column;gap:6px;' });
          row.appendChild(Common.el('div', { text:'Move to which system?' }));
          const destRow = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          state.systems.filter(s => s.id!==uiSystem).forEach(dest => destRow.appendChild(Common.el('button', { text: dest.name || dest.id, onclick: () => commit({ type:'move', systemId:uiSystem, shipId:uiShip, destSystemId:dest.id }) })));
          row.appendChild(destRow);
          row.appendChild(Common.el('div', { text:'…or discover a new system with star:' }));
          const discRow = Common.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;' });
          COLORS.forEach(c => {
            const size = smallestAvailable(state.bank, c);
            const btn = Common.el('button', { text:`${c}${size||''}`, style:`color:${COLOR_HEX[c]};`, onclick: () => commit({ type:'discover', systemId:uiSystem, shipId:uiShip, starColor:c, starSize:size }) });
            btn.disabled = !size;
            discRow.appendChild(btn);
          });
          row.appendChild(discRow);
          actionPanel.appendChild(row);
        }
        return;
      }
    }

    function commit(action){
      state = applyAction(state, action);
      uiSystem = null; uiAction = null; uiShip = null;
      afterMove();
    }

    function afterMove(){
      render();
      if(state.gameOver){ panel.setMessage(`${labelFor(state.winner)} wins!`); return; }
      panel.setMessage(`${labelFor(state.turn)}'s turn — one action.`);
      if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);
    }

    function aiTurn(){
      if(destroyed) return;
      const action = aiChooseAction(state);
      if(action) state = applyAction(state, action);
      else state.turn = opp(state.turn);
      afterMove();
    }

    render();
    panel.setMessage("Copper moves first. This is a simplified interpretation of Homeworlds — see the note below the board. Click a system, then an action powered by a ship color you have there.");
    if(mode==='ai' && state.turn===AI_SIDE) setTimeout(aiTurn, 500);

    return { destroy(){ destroyed = true; } };
  }

  GAMES.push({
    id:'homeworlds',
    name:'Homeworlds',
    emblem:'✦',
    theme: { accent:'#8a4fbf', panel:'#1a1430', board1:'#120a24', board2:'#1a1430' },
    tagline:'Pyramid-piece space strategy — a simplified interpretation.',
    rules:"<strong>Homeworlds (simplified):</strong> ships come in 4 colors (Red=Attack, Yellow=Build, Green=Move, Blue=Trade) and 3 sizes, drawn from a shared bank. Each turn, take one action powered by a matching-color ship you have in that system: Build adds a new ship there; Trade swaps one of your ships to a different color; Move relocates a ship to another system (or founds a brand-new one); Attack destroys a smaller-or-equal enemy ship sharing the system. Four or more same-colored pieces in one system trigger a catastrophe, wiping that color out — and destroy a system's star this way and the whole system, everyone's ships included, is gone. Lose all your ships anywhere and you lose the game. <strong>This is a deliberately simplified interpretation</strong> of the original Looney Labs game: it drops star-size connectivity requirements between systems, the multiple-actions-per-turn structure, and the initial sacrifice-based setup, in favor of one action per turn and unrestricted movement between existing systems.",
    start,
  });
})();
