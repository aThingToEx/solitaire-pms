const SUITS = ['C', 'S', 'H', 'D'];
const SUIT_ROW = { C: 0, S: 1, H: 2, D: 3 };
const SUIT_SYMBOL = { C: '♣', S: '♠', H: '♥', D: '♦' };
const RED_SUITS = new Set(['H', 'D']);

const SHEET_COLS = 13;
const SHEET_ROWS = 4;
const CARD_W = 180;
const CARD_H = 252;

const CARD_SHEET_SRC = (typeof CARD_SHEET_DATA_URI !== 'undefined') ? CARD_SHEET_DATA_URI : 'cards.png';
const CARD_BACK_SRC = (typeof CARD_BACK_DATA_URI !== 'undefined') ? CARD_BACK_DATA_URI : 'cards_back.png';
window.CARD_BACK_READY = false;
(() => {
  const img = new Image();
  img.onload = () => {
    window.CARD_BACK_READY = true;
    if (typeof window.__onCardBackLoaded === 'function') window.__onCardBackLoaded();
  };
  img.onerror = () => { window.CARD_BACK_READY = false; };
  img.src = CARD_BACK_SRC;
})();

const SLOT_SRC = (typeof SLOT_DATA_URI !== 'undefined') ? SLOT_DATA_URI : 'slot.png';
window.SLOT_READY = false;
(() => {
  const img = new Image();
  img.onload = () => {
    window.SLOT_READY = true;
    if (typeof window.__onSlotLoaded === 'function') window.__onSlotLoaded();
  };
  img.onerror = () => { window.SLOT_READY = false; };
  img.src = SLOT_SRC;
})();

window.TILT_ENABLED = false;
function tiltAngleFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 900) / 100) - 4.5;
}

function rankLabel(rank) {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false, id: `${suit}${rank}` });
    }
  }
  return deck;
}

function shuffle(deck, rng) {
  const rand = rng || Math.random;
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function isRed(card) {
  return RED_SUITS.has(card.suit);
}


function renderCard(card) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = card.id;
  el.dataset.suit = card.suit;
  el.dataset.rank = card.rank;

  if (!card.faceUp) {
    el.classList.add('card-back');
    if (window.CARD_BACK_READY) {
      el.style.backgroundImage = `url('${CARD_BACK_SRC}')`;
      el.style.backgroundSize = '100% 100%';
      el.style.backgroundColor = 'transparent';
      el.style.border = 'none';
    }
    return el;
  }

  const col = card.rank - 1;
  const row = SUIT_ROW[card.suit];
  el.style.backgroundImage = `url('${CARD_SHEET_SRC}')`;
  el.style.backgroundSize = `${CARD_W * SHEET_COLS}px ${CARD_H * SHEET_ROWS}px`;
  el.style.backgroundPosition = `-${col * CARD_W}px -${row * CARD_H}px`;
  if (isRed(card)) el.classList.add('red');
  return el;
}

function isValidDescendingAltColor(upper, lower) {

  return lower.rank === upper.rank + 1 && isRed(upper) !== isRed(lower);
}
