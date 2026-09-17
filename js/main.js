(() => {
  const statusEl = document.getElementById('status');
  const setStatus = (msg) => { statusEl.textContent = msg; };

  Solitaire.mount(document.getElementById('solitaire'), setStatus);
  window.__onCardBackLoaded = () => Solitaire.refresh();
  window.__onSlotLoaded = () => Solitaire.refresh();

  document.getElementById('newGameBtn').addEventListener('click', () => {
    Solitaire.newGame();
    setStatus('');
  });

  document.getElementById('dealSeedBtn').addEventListener('click', () => {
    const seedVal = document.getElementById('seedInput').value;
    Solitaire.newGame(seedVal);
    setStatus('');
  });

  document.getElementById('undoBtn').addEventListener('click', () => {
    Solitaire.undo();
  });

  document.getElementById('tiltToggle').addEventListener('change', (e) => {
    window.TILT_ENABLED = e.target.checked;
    Solitaire.refresh();
  });

  const TABLE_BG_SRC = (typeof TABLE_BG_DATA_URI !== 'undefined') ? TABLE_BG_DATA_URI : 'table_bg.png';
  const bgImg = new Image();
  bgImg.onload = () => {
    const main = document.querySelector('main');
    main.style.backgroundImage =
      `url('${TABLE_BG_SRC}'), radial-gradient(ellipse at top, var(--felt) 0%, var(--felt-dark) 75%)`;
    main.style.backgroundSize = 'cover, cover';
    main.style.backgroundPosition = 'top center, top center';
    main.style.backgroundRepeat = 'no-repeat, no-repeat';
  };
  bgImg.src = TABLE_BG_SRC;
})();
