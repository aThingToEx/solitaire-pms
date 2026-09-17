const Solitaire = (() => {
  let root, statusFn;
  let stock, waste, foundations, tableau, selection;
  let prevState = new Map();
  let dealMode = false;
  let undoStack = [];
  let moveCount = 0;
  let currentSeed = 0;
  let currentSeedLabel = '';
  let lastClickId = null;
  let lastClickTime = 0;

  function cloneCard(c) { return { suit: c.suit, rank: c.rank, faceUp: c.faceUp, id: c.id }; }

  function snapshot() {
    return {
      stock: stock.map(cloneCard),
      waste: waste.map(cloneCard),
      foundations: {
        C: foundations.C.map(cloneCard),
        S: foundations.S.map(cloneCard),
        H: foundations.H.map(cloneCard),
        D: foundations.D.map(cloneCard),
      },
      tableau: tableau.map(pile => pile.map(cloneCard)),
    };
  }

  function restoreSnapshot(s) {
    stock = s.stock.map(cloneCard);
    waste = s.waste.map(cloneCard);
    foundations = {
      C: s.foundations.C.map(cloneCard),
      S: s.foundations.S.map(cloneCard),
      H: s.foundations.H.map(cloneCard),
      D: s.foundations.D.map(cloneCard),
    };
    tableau = s.tableau.map(pile => pile.map(cloneCard));
  }

  function pushUndo() {
    undoStack.push(snapshot());
    moveCount++;
  }

  function undo() {
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    restoreSnapshot(snap);
    selection = null;
    moveCount = Math.max(0, moveCount - 1);
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.classList.remove('win');
    if (statusFn) statusFn('');
    render();
  }

  function newGame(seedStr) {
    const trimmed = seedStr && String(seedStr).trim();
    const seed = trimmed ? hashSeed(trimmed) : Math.floor(Math.random() * 1e9);
    currentSeed = seed;
    currentSeedLabel = trimmed || String(seed);
    const rng = mulberry32(seed);
    const deck = shuffle(makeDeck(), rng);
    stock = [];
    waste = [];
    foundations = { C: [], S: [], H: [], D: [] };
    tableau = [[], [], [], [], [], [], []];
    selection = null;
    undoStack = [];
    moveCount = 0;

    let i = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[i++];
        card.faceUp = row === col;
        tableau[col].push(card);
      }
    }
    while (i < deck.length) {
      const card = deck[i++];
      card.faceUp = false;
      stock.push(card);
    }
    prevState = new Map();
    dealMode = true;
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.classList.remove('win');
    render();
  }

  function foundationTop(suit) {
    const pile = foundations[suit];
    return pile.length ? pile[pile.length - 1] : null;
  }

  function clearSelection() { selection = null; }

  function selectableRun(col, idx) {
    const pile = tableau[col];
    if (idx < 0 || idx >= pile.length || !pile[idx].faceUp) return null;
    for (let k = idx; k < pile.length - 1; k++) {
      if (!isValidDescendingAltColor(pile[k + 1], pile[k])) {

        if (idx !== pile.length - 1) return null;
      }
    }
    return pile.slice(idx);
  }

  function tryMoveToFoundation(cards) {
    if (cards.length !== 1) return false;
    const card = cards[0];
    const top = foundationTop(card.suit);
    const need = top ? top.rank + 1 : 1;
    return card.rank === need;
  }

  function tryMoveToTableau(cards, col) {
    const dest = tableau[col];
    const moving = cards[0];
    if (dest.length === 0) return moving.rank === 13;
    const destTop = dest[dest.length - 1];
    return destTop.faceUp && isValidDescendingAltColor(moving, destTop);
  }

  function hasAnyMove() {
    const tops = [];
    tableau.forEach((pile) => { if (pile.length) tops.push(pile[pile.length - 1]); });
    if (waste.length) tops.push(waste[waste.length - 1]);
    for (const card of tops) {
      if (tryMoveToFoundation([card])) return true;
    }

    for (let col = 0; col < 7; col++) {
      const pile = tableau[col];
      for (let idx = 0; idx < pile.length; idx++) {
        if (!pile[idx].faceUp) continue;
        const run = selectableRun(col, idx);
        if (!run) continue;
        for (let dest = 0; dest < 7; dest++) {
          if (dest === col) continue;
          if (tryMoveToTableau(run, dest)) return true;
        }
      }
    }

    if (waste.length) {
      const card = waste[waste.length - 1];
      for (let dest = 0; dest < 7; dest++) {
        if (tryMoveToTableau([card], dest)) return true;
      }
    }

    for (const card of stock) {
      if (tryMoveToFoundation([card])) return true;
      for (let dest = 0; dest < 7; dest++) {
        if (tryMoveToTableau([card], dest)) return true;
      }
    }

    return false;
  }

  function updateStuckStatus() {
    const total = Object.values(foundations).reduce((s, p) => s + p.length, 0);
    const statusEl = document.getElementById('status');
    if (total === 52) return;
    if (!hasAnyMove()) {
      if (statusFn) statusFn('No moves left — try Undo or New Game');
      if (statusEl) statusEl.classList.add('stuck');
    } else if (statusEl && statusEl.classList.contains('stuck')) {
      statusEl.classList.remove('stuck');
      if (statusFn) statusFn('');
    }
  }

  function removeFromSource() {
    const { zone, col } = selection;
    if (zone === 'waste') waste.pop();
    else if (zone === 'tableau') {
      tableau[col] = tableau[col].slice(0, tableau[col].length - selection.cards.length);
      const pile = tableau[col];
      if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
    } else if (zone === 'foundation') {
      foundations[col].pop();
    }
  }

  function placeOnFoundation(card) { foundations[card.suit].push(card); }
  function placeOnTableau(cards, col) { tableau[col].push(...cards); }

  function attemptMoveToFoundationSuit(suit) {
    if (!selection) return;
    if (tryMoveToFoundation(selection.cards) && selection.cards[0].suit === suit) {
      const card = selection.cards[0];
      pushUndo();
      removeFromSource();
      placeOnFoundation(card);
      clearSelection();
      render();
      checkWin();
    } else {
      clearSelection();
      render();
    }
  }

  function attemptMoveToTableauCol(col) {
    if (!selection) return;
    if (selection.zone === 'tableau' && selection.col === col) { clearSelection(); render(); return; }
    if (tryMoveToTableau(selection.cards, col)) {
      const cards = selection.cards;
      pushUndo();
      removeFromSource();
      placeOnTableau(cards, col);
      clearSelection();
      render();
    } else {
      clearSelection();
      render();
    }
  }

  function autoSendToFoundation(zone, col, card) {
    const top = foundationTop(card.suit);
    const need = top ? top.rank + 1 : 1;
    if (card.rank !== need) return false;
    if (zone === 'waste') {
      if (!waste.length || waste[waste.length - 1].id !== card.id) return false;
      pushUndo();
      waste.pop();
    } else if (zone === 'tableau') {
      const pile = tableau[col];
      if (!pile.length || pile[pile.length - 1].id !== card.id) return false;
      pushUndo();
      pile.pop();
      if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
    } else {
      return false;
    }
    foundations[card.suit].push(card);
    clearSelection();
    render();
    checkWin();
    return true;
  }

  function isDoubleClick(card) {
    const now = Date.now();
    const dbl = lastClickId === card.id && (now - lastClickTime) < 350;
    lastClickId = dbl ? null : card.id;
    lastClickTime = dbl ? 0 : now;
    return dbl;
  }

  function drawStock() {
    clearSelection();
    pushUndo();
    if (stock.length === 0) {
      while (waste.length) {
        const c = waste.pop();
        c.faceUp = false;
        stock.push(c);
      }
    } else {
      const c = stock.pop();
      c.faceUp = true;
      waste.push(c);
    }
    render();
  }

  function onWasteClick() {
    if (waste.length === 0) return;
    const card = waste[waste.length - 1];
    if (isDoubleClick(card)) {
      if (autoSendToFoundation('waste', null, card)) return;
    }
    if (selection && selection.zone === 'waste') { clearSelection(); render(); return; }
    selection = { zone: 'waste', col: null, cards: [card] };
    render();
  }

  function onTableauCardClick(col, idx) {
    const pile = tableau[col];
    const card = pile[idx];
    if (idx === pile.length - 1 && isDoubleClick(card)) {
      if (autoSendToFoundation('tableau', col, card)) return;
    }
    if (selection) {
      attemptMoveToTableauCol(col);
      return;
    }
    const run = selectableRun(col, idx);
    if (run) {
      selection = { zone: 'tableau', col, cards: run };
      render();
    }
  }

  function onTableauEmptyClick(col) {
    if (selection) attemptMoveToTableauCol(col);
  }

  function onFoundationClick(suit) {
    if (selection) { attemptMoveToFoundationSuit(suit); return; }
    const top = foundationTop(suit);
    if (top) {
      selection = { zone: 'foundation', col: suit, cards: [top] };
      render();
    }
  }

  function checkWin() {
    const total = Object.values(foundations).reduce((s, p) => s + p.length, 0);
    if (total === 52) {
      statusFn('You win! 🎉');
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.classList.add('win');
    }
  }

  function isSelected(card) {
    return selection && selection.cards.some(c => c.id === card.id);
  }

  function styleCard(el, card) {
    const selected = isSelected(card);
    const tilt = window.TILT_ENABLED ? tiltAngleFor(card.id) : 0;
    el.style.transform = `${selected ? 'translateY(-6px) ' : ''}rotate(${tilt}deg)`;
    if (selected) el.classList.add('selected');
  }

  function styleSlot(el) {
    if (window.SLOT_READY) {
      el.classList.add('sprite-slot');
      el.style.backgroundImage = `url('${SLOT_SRC}')`;
      el.style.backgroundSize = '100% 100%';
    }
  }

  function render() {
    if (!root) return;
    root.innerHTML = '';

    const cardEls = [];
    let dealCounter = 0;

    const top = document.createElement('div');
    top.className = 'row';


    const stockPile = document.createElement('div');
    stockPile.className = 'pile' + (stock.length === 0 ? ' empty' : '');
    stockPile.dataset.label = 'Reset';
    styleSlot(stockPile);
    if (stock.length) {
      const back = renderCard({ faceUp: false });
      stockPile.appendChild(back);
    }
    const stockCount = document.createElement('div');
    stockCount.className = 'stock-count';
    stockCount.textContent = stock.length;
    stockPile.appendChild(stockCount);
    stockPile.addEventListener('click', drawStock);
    top.appendChild(stockPile);


    const wastePile = document.createElement('div');
    wastePile.className = 'pile' + (waste.length === 0 ? ' empty' : '');
    wastePile.dataset.label = 'Waste';
    styleSlot(wastePile);
    if (waste.length) {
      const card = waste[waste.length - 1];
      const el = renderCard(card);
      styleCard(el, card);
      el.addEventListener('click', (e) => { e.stopPropagation(); onWasteClick(); });
      wastePile.appendChild(el);
      cardEls.push({ el, id: card.id, faceUp: true });
    } else {
      wastePile.addEventListener('click', () => { if (selection) { clearSelection(); render(); } });
    }
    top.appendChild(wastePile);


    const spacer = document.createElement('div');
    spacer.style.width = '90px';
    top.appendChild(spacer);


    for (const suit of SUITS) {
      const f = document.createElement('div');
      f.className = 'pile foundation' + (foundations[suit].length === 0 ? ' empty' : '');
      f.dataset.label = SUIT_SYMBOL[suit];
      styleSlot(f);
      if (foundations[suit].length) {
        const card = foundations[suit][foundations[suit].length - 1];
        const el = renderCard(card);
        styleCard(el, card);
        el.addEventListener('click', (e) => { e.stopPropagation(); onFoundationClick(suit); });
        f.appendChild(el);
        cardEls.push({ el, id: card.id, faceUp: true });
      }
      f.addEventListener('click', () => onFoundationClick(suit));
      top.appendChild(f);
    }

    root.appendChild(top);


    const tableauRow = document.createElement('div');
    tableauRow.className = 'tableau';
    tableau.forEach((pile, col) => {
      const colEl = document.createElement('div');
      colEl.className = 'tableau-col';
      if (pile.length === 0) {
        colEl.classList.add('pile', 'empty');
        colEl.dataset.label = 'K';
        styleSlot(colEl);
      }
      const overlap = 52;
      colEl.style.height = `calc(var(--card-h) + ${Math.max(0, pile.length - 1) * overlap}px)`;
      pile.forEach((card, idx) => {
        const el = renderCard(card);
        el.style.top = `${idx * overlap}px`;
        styleCard(el, card);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onTableauCardClick(col, idx);
        });
        colEl.appendChild(el);
        cardEls.push({ el, id: card.id, faceUp: card.faceUp, dealIndex: dealCounter++ });
      });
      colEl.addEventListener('click', () => onTableauEmptyClick(col));
      tableauRow.appendChild(colEl);
    });
    root.appendChild(tableauRow);




    const containerRect = root.getBoundingClientRect();
    const stockRect = stockPile.getBoundingClientRect();
    const stockOrigin = {
      left: stockRect.left - containerRect.left,
      top: stockRect.top - containerRect.top,
      faceUp: false,
    };
    const newState = new Map();

    cardEls.forEach(({ el, id, faceUp, dealIndex }) => {
      const r = el.getBoundingClientRect();
      const left = r.left - containerRect.left;
      const top = r.top - containerRect.top;
      newState.set(id, { left, top, faceUp });

      const base = el.style.transform;



      const prev = prevState.get(id) || (!dealMode ? stockOrigin : null);

      if (dealMode && !prev) {
        el.classList.add('deal-in');
        el.style.animationDelay = `${dealIndex * 35}ms`;
        el.addEventListener('animationend', () => {
          el.classList.remove('deal-in');
          el.style.animationDelay = '';
        }, { once: true });
        return;
      }

      if (!prev) return;

      const moved = Math.abs(prev.left - left) > 0.5 || Math.abs(prev.top - top) > 0.5;
      const flipped = prev.faceUp !== faceUp;

      if (moved) {
        const dx = prev.left - left;
        const dy = prev.top - top;
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px) ${base}`;
        el.offsetWidth;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.28s cubic-bezier(.2,.8,.2,1)';
          el.style.transform = base;
          el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
        });
      } else if (flipped) {
        el.classList.add('flip-in');
        el.addEventListener('animationend', () => el.classList.remove('flip-in'), { once: true });
      }
    });

    prevState = newState;
    dealMode = false;

    const moveCounterEl = document.getElementById('moveCounter');
    if (moveCounterEl) moveCounterEl.textContent = `Moves: ${moveCount}`;
    const seedEl = document.getElementById('seedInput');
    if (seedEl && document.activeElement !== seedEl) seedEl.value = currentSeedLabel;
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    updateStuckStatus();
  }

  function mount(container, setStatus) {
    root = container;
    statusFn = setStatus;
    newGame();
  }

  return { mount, newGame, refresh: render, undo };
})();
