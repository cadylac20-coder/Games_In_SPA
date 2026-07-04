window.GAMES = window.GAMES || [];

(function () {
  const menuScreen = document.getElementById("menu-screen");
  const gameScreen = document.getElementById("game-screen");
  const gameGrid = document.getElementById("game-grid");
  const boardArea = document.getElementById("board-area");
  const panelArea = document.getElementById("panel-area");
  const gameTitle = document.getElementById("game-title");
  const gameTagline = document.getElementById("game-tagline");
  const backBtn = document.getElementById("back-btn");

  let activeController = null;

  const THEME_KEYS = {
    accent: '--t-accent', panel: '--t-panel', board1: '--t-board-1', board2: '--t-board-2',
    p1Light: '--t-p1-light', p1Dark: '--t-p1-dark', p2Light: '--t-p2-light', p2Dark: '--t-p2-dark',
  };

  function applyTheme(theme) {
    const root = document.documentElement.style;
    Object.keys(THEME_KEYS).forEach((k) => {
      if (theme && theme[k]) root.setProperty(THEME_KEYS[k], theme[k]);
      else root.removeProperty(THEME_KEYS[k]);
    });
  }

  function resetTheme() { applyTheme(null); }

  function buildPanel() {
    panelArea.innerHTML = `
      <div class="turn-row">
        <div class="turn-dot" id="turn-dot"></div>
        <div class="turn-label" id="turn-label">—</div>
      </div>
      <div id="stats-container"></div>
      <div class="msg" id="msg"></div>
      <button id="restart-btn">Restart game</button>
    `;
    const turnDot = document.getElementById("turn-dot");
    const turnLabel = document.getElementById("turn-label");
    const statsContainer = document.getElementById("stats-container");
    const msg = document.getElementById("msg");
    const restartBtn = document.getElementById("restart-btn");

    const statEls = {};

    const panel = {
      setTurn(text, colorHex) {
        turnLabel.textContent = text;
        turnDot.style.background = colorHex || "#c99a4a";
      },
      setMessage(text) {
        msg.textContent = text;
      },
      setStats(rows) {
        statsContainer.innerHTML = "";
        statEls_clear();
        rows.forEach(({ label, value }) => {
          const row = Common.el("div", { class: "stat" }, [
            Common.el("span", { text: label }),
            Common.el("span", { text: String(value) }),
          ]);
          statsContainer.appendChild(row);
          statEls[label] = row.lastChild;
        });
      },
      updateStat(label, value) {
        if (statEls[label]) statEls[label].textContent = String(value);
      },
      onRestart(cb) {
        restartBtn.onclick = cb;
      },
    };
    function statEls_clear() {
      for (const k in statEls) delete statEls[k];
    }
    return panel;
  }

  function renderMenu() {
    gameGrid.innerHTML = "";
    GAMES.forEach((game) => {
      const card = Common.el("div", { class: "game-card", style: game.theme && game.theme.accent ? `--card-accent:${game.theme.accent};` : "" }, [
        Common.el("div", { class: "game-card-emblem", text: game.emblem || "◆" }),
        Common.el("h3", { text: game.name }),
        Common.el("p", { text: game.tagline }),
        Common.el("div", { class: "game-card-actions" }, [
          Common.el("button", {
            class: "btn-secondary",
            text: "Play vs Friend",
            onclick: () => launchGame(game, "friend"),
          }),
          Common.el("button", {
            class: "btn-primary",
            text: "Play vs AI",
            onclick: () => launchGame(game, "ai"),
          }),
        ]),
      ]);
      gameGrid.appendChild(card);
    });
  }

  function launchGame(game, mode) {
    menuScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    applyTheme(game.theme);
    gameTitle.textContent = game.name;
    gameTagline.textContent = game.tagline;
    document.getElementById("rules-note").innerHTML = game.rules || "";
    boardArea.innerHTML = "";
    const panel = buildPanel();
    startController(game, mode, panel);
  }

  function startController(game, mode, panel) {
    if (activeController && activeController.destroy) activeController.destroy();
    activeController = game.start({
      boardEl: boardArea,
      panel,
      mode,
      humanSide: game.firstPlayerKey || "p1",
      aiSide: game.secondPlayerKey || "p2",
    });
    panel.onRestart(() => {
      boardArea.innerHTML = "";
      const freshPanel = buildPanel();
      startController(game, mode, freshPanel);
    });
  }

  backBtn.addEventListener("click", () => {
    if (activeController && activeController.destroy) activeController.destroy();
    activeController = null;
    boardArea.innerHTML = "";
    gameScreen.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    resetTheme();
  });

  renderMenu();
})();
