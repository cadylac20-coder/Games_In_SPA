// Settings + opt-in leaderboard. Nothing is written to storage unless "save" is switched on.
window.Leaderboard = (function () {
  const SK = 'sb.settings', RK = 'sb.scores', MAX = 300;
  const SIDES = { backgammon:['Ivory','Walnut'], blokus:['Indigo','Terracotta'], catchup:['Amber','Slate'], chess:['White','Black'],
    go:['Black','White'], hex:['Amber','Slate'], hive:['Copper','Slate'], homeworlds:['Copper','Slate'], kamisado:['Black','Gold'],
    kono:['Jade','Coral'], onitama:['Red','Blue'], reversi:['Black','White'], seega:['Amber','Umber'], surakarta:['Ivory','Ebony'],
    tablut:['Attackers','Defenders'], tak:['Amber','Slate'], zertz:['Amber','Slate'] };
  const defaults = { save: false, name: 'Player 1', name2: 'Player 2' };
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const settings = () => Object.assign({}, defaults, read(SK, {}));
  const setSettings = (p) => write(SK, Object.assign(settings(), p));
  const scores = () => read(RK, []);
  const clear = () => { try { localStorage.removeItem(RK); } catch (e) {} };

  // Reads a game-over message and works out who won (index into sides, or null for a draw).
  function detect(msg, sides) {
    if (/moves first|to win\b|to start\b/i.test(msg)) return null;
    const win = /\bwins?\b/i.exec(msg), draw = /\bdraw\b|\btie\b|stalemate/i.test(msg), over = /game over/i.test(msg);
    if (!win && !draw && !over) return null;
    const words = sides.map((s) => s.split(' ')[0]);
    if (win) {
      const before = msg.slice(0, win.index); let best = -1, at = -1;
      words.forEach((w, i) => { const p = before.lastIndexOf(w); if (p > at) { at = p; best = i; } });
      return best >= 0 ? { winner: best } : null;
    }
    if (draw) return { winner: null };
    let best = -1, at = 1e9;
    words.forEach((w, i) => { const p = msg.indexOf(w); if (p >= 0 && p < at) { at = p; best = i; } });
    return best >= 0 ? { winner: best } : null;
  }

  const who = (mode, i) => (i === 0 ? settings().name : mode === 'ai' ? 'Computer' : settings().name2);

  function watch(game, mode, panel) {
    const sides = game.sides || SIDES[game.id] || ['Player 1', 'Player 2'];
    const orig = panel.setMessage; let first = true, done = false;
    panel.setMessage = function (t) {
      orig(t);
      if (first) { first = false; return; }          // first message is the rules intro
      if (done || !settings().save) return;
      const r = detect(String(t), sides);
      if (!r) return;
      done = true;
      const rows = scores();
      rows.unshift({ t: Date.now(), game: game.id, gameName: game.name, mode, p1: who(mode, 0), p2: who(mode, 1),
        winner: r.winner === null ? null : who(mode, r.winner), detail: String(t) });
      write(RK, rows.slice(0, MAX));
    };
  }

  function close() { const m = document.getElementById('sb-modal'); if (m) m.remove(); }
  function modal(title, build) {
    close();
    const body = Common.el('div', { class: 'modal-body' });
    const ov = Common.el('div', { class: 'modal', id: 'sb-modal', onclick: (e) => { if (e.target === ov) close(); } }, [
      Common.el('div', { class: 'modal-box' }, [
        Common.el('div', { class: 'modal-head' }, [Common.el('h3', { text: title }), Common.el('button', { class: 'modal-x', text: '✕', onclick: close })]),
        body ]) ]);
    document.body.appendChild(ov); build(body);
  }
  const hint = (t) => Common.el('p', { class: 'hint', text: t });

  function showSettings() {
    modal('Settings', (b) => {
      const s = settings();
      const cb = Common.el('input', { type: 'checkbox' }); cb.checked = s.save;
      cb.addEventListener('change', () => setSettings({ save: cb.checked }));
      const field = (label, key) => {
        const i = Common.el('input', { type: 'text', maxlength: '20', value: s[key] });
        i.addEventListener('input', () => setSettings({ [key]: i.value.trim() || defaults[key] }));
        return Common.el('label', { class: 'field' }, [Common.el('span', { text: label }), i]);
      };
      b.appendChild(Common.el('label', { class: 'check' }, [cb, Common.el('span', { text: 'Remember scores on this device (leaderboard)' })]));
      b.appendChild(hint('Off by default. Nothing is saved unless you turn this on, and results never leave this browser.'));
      b.appendChild(field('Your name', 'name'));
      b.appendChild(field('Second player name (friend games)', 'name2'));
      b.appendChild(Common.el('button', { class: 'danger', text: 'Clear saved scores', onclick: () => { if (confirm('Delete all saved scores?')) clear(); } }));
    });
  }

  function showBoard(games) {
    modal('Leaderboard', (b) => {
      if (!settings().save) b.appendChild(hint('Score saving is off. Switch it on in Settings to start recording results.'));
      const all = scores();
      if (!all.length) { b.appendChild(hint('No saved results yet.')); return; }
      const sel = Common.el('select', {}, [Common.el('option', { value: '', text: 'All games' })].concat(
        games.map((g) => Common.el('option', { value: g.id, text: g.name }))));
      const out = Common.el('div'); b.appendChild(sel); b.appendChild(out);
      const table = (head, rows) => Common.el('table', {}, [Common.el('tr', {}, head.map((h) => Common.el('th', { text: h })))]
        .concat(rows.map((r) => Common.el('tr', {}, r.map((c) => Common.el('td', { text: String(c) }))))));
      function draw() {
        const rows = all.filter((r) => !sel.value || r.game === sel.value), tally = {};
        rows.forEach((r) => [r.p1, r.p2].forEach((n) => { (tally[n] = tally[n] || { w: 0, p: 0 }).p++; }));
        rows.forEach((r) => { if (r.winner) tally[r.winner].w++; });
        out.innerHTML = '';
        out.appendChild(Common.el('h4', { text: 'Standings' }));
        out.appendChild(table(['Player', 'Wins', 'Played'], Object.keys(tally).sort((a, b2) => tally[b2].w - tally[a].w).map((n) => [n, tally[n].w, tally[n].p])));
        out.appendChild(Common.el('h4', { text: 'Recent results' }));
        out.appendChild(table(['When', 'Game', 'Winner', 'Players', 'Result'], rows.map((r) =>
          [new Date(r.t).toLocaleString(), r.gameName, r.winner || 'Draw', r.p1 + ' vs ' + r.p2, r.detail])));
      }
      sel.addEventListener('change', draw); draw();
    });
  }

  function init(games) {
    document.getElementById('lb-btn').onclick = () => showBoard(games);
    document.getElementById('settings-btn').onclick = showSettings;
  }
  return { init, watch, detect };
})();
