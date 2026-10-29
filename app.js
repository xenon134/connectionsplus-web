import { ConnectionsGame } from './game.js';
import {
  fetchPuzzle,
  fetchPuzzletoday,
  loadProgress,
  saveProgress as writeProgress,
  todayString,
  shiftDate,
  formatPuzzleDate,
} from './data.js';
import { initShell, showToast } from './shell.js';
import { getShareText, getGuessesShareText, copyText } from './share.js';

const COLORS = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'];

const el = {
  tiles: document.getElementById('tiles'),
  solved: document.getElementById('solved'),
  dots: document.getElementById('dots'),
  shuffle: document.getElementById('shuffle'),
  deselect: document.getElementById('deselect'),
  organize: document.getElementById('organize'),
  submit: document.getElementById('submit'),
  giveup: document.getElementById('giveup'),
  giveupRow: document.getElementById('giveup-row'),
  stats: document.getElementById('stats-btn'),
  date: document.getElementById('date'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  modal: document.getElementById('results-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalClose: document.getElementById('modal-close'),
  modalGrid: document.getElementById('modal-grid'),
  modalShare: document.getElementById('modal-share'),
  modalShareGuesses: document.getElementById('modal-share-guesses'),
  modalContinue: document.getElementById('modal-continue'),
};

let game = null;
let currentDate = null;
let animating = false;

const BOUNCE_CLASSES = ['bounce1', 'bounce2', 'bounce3', 'bounce4'];

function saveProgress() {
  if (!game) return;
  const key = currentDate || game.printDate;
  if (key) writeProgress(key, game.serialize());
}


async function loadDate(dateStr) {
  const data = await fetchPuzzle(dateStr);
  if (!data) return false;
  currentDate = dateStr;
  init(data);
  return true;
}

async function goTo(dateStr) {
  const ok = await loadDate(dateStr);
  if (!ok) showToast('No puzzle available for that date');
}

function init(data) {
  game = new ConnectionsGame(data);
  const key = currentDate || game.printDate;
  const saved = loadProgress(key);
  if (saved) {
    game.restore(saved);
  }
  el.date.textContent = formatPuzzleDate(game.printDate);
  closeResultsModal();
  render();
}

function render() {
  renderSolved();
  renderTiles();
  renderDots();
  updateControls();
  fitTiles();
  saveProgress();
}

let measureCtx = null;

function longestWordWidth(node, fontSize) {
  const text = (node.textContent || '').trim();
  if (!text) return 0;
  const cs = getComputedStyle(node);
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
  const upper = cs.textTransform === 'uppercase';
  let max = 0;
  text.split(/\s+/).forEach((word) => {
    const w = upper ? word.toUpperCase() : word;
    const width = measureCtx.measureText(w).width;
    if (width > max) max = width;
  });
  return max;
}

function contentWidth(node) {
  const cs = getComputedStyle(node);
  const pad = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
  return Math.max(0, node.clientWidth - pad);
}

// Shrink only until the longest single word fits; spaces still wrap normally.
function shrinkToFit(node, base, min = 5) {
  node.style.fontSize = base + 'px';
  const avail = contentWidth(node);
  const wordWidth = longestWordWidth(node, base);
  let fs = base;
  let guard = 0;

  if (avail > 0 && wordWidth > avail) {
    fs = Math.max(min, (base * avail) / wordWidth);
    node.style.fontSize = fs + 'px';
  }

  while (node.scrollHeight > node.clientHeight + 1 && fs > min && guard++ < 200) {
    fs = Math.max(min, fs - 0.5);
    node.style.fontSize = fs + 'px';
  }
}

function fitTiles() {
  el.tiles.querySelectorAll('.tile').forEach((t) => shrinkToFit(t, 20));
  el.solved.querySelectorAll('.solved__title').forEach((t) => shrinkToFit(t, 20));
  el.solved.querySelectorAll('.solved__words').forEach((w) => shrinkToFit(w, 20));
}

function fitModal() {
  el.modalGrid.querySelectorAll('.modal__cell').forEach((c) => shrinkToFit(c, 12));
  el.modalGrid.querySelectorAll('.modal__guess-title').forEach((t) => shrinkToFit(t, 13));
  el.modalGrid.querySelectorAll('.modal__guess-words').forEach((w) => shrinkToFit(w, 13));
}

function renderSolved() {
  const currentBars = new Map();
  el.solved.querySelectorAll('.solved').forEach((bar) => {
    currentBars.set(Number(bar.dataset.ci), bar);
  });

  const order = game.solvedOrder || [];
  order.forEach((ci) => {
    let bar = currentBars.get(ci);
    if (!bar) {
      const cat = game.categories[ci];
      bar = solvedBar(ci, cat, game.isRevealed(ci), true);
      el.solved.appendChild(bar);
    } else {
      bar.classList.remove('pop');
      el.solved.appendChild(bar);
    }
  });

  currentBars.forEach((bar, ci) => {
    if (!order.includes(ci)) {
      bar.remove();
    }
  });
}

function solvedBar(ci, cat, reveal, pop = false) {
  const bar = document.createElement('div');
  bar.dataset.ci = String(ci);
  bar.className = 'solved' + (reveal ? ' solved--reveal' : '') + (pop ? ' pop' : '');
  bar.style.background = COLORS[ci];
  if (pop) {
    bar.addEventListener('animationend', () => bar.classList.remove('pop'), { once: true });
  }

  const title = document.createElement('div');
  title.className = 'solved__title';
  title.textContent = cat.title;

  const list = document.createElement('div');
  list.className = 'solved__words';
  list.textContent = game.wordsFor(ci).join(', ');

  bar.append(title, list);
  return bar;
}

function renderTiles() {
  el.tiles.innerHTML = '';
  game.order.forEach((word) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile' + (game.isSelected(word) ? ' is-selected' : '');
    tile.textContent = word;
    tile.addEventListener('click', () => onTileClick(word, tile));
    el.tiles.appendChild(tile);
  });
}

function renderDots() {
  el.dots.innerHTML = '';
  for (let i = 0; i < game.mistakes; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    el.dots.appendChild(dot);
  }
}

function updateControls() {
  el.deselect.disabled = !game.canDeselect();
  el.submit.disabled = !game.canSubmit();
  el.shuffle.disabled = !game.canShuffle();
  el.organize.disabled = !game.canOrganize();
  el.deselect.classList.toggle('is-active', !el.deselect.disabled);
  el.submit.classList.toggle('is-active', !el.submit.disabled);
  el.shuffle.classList.toggle('is-active', !el.shuffle.disabled);
  el.organize.classList.toggle('is-active', !el.organize.disabled);

  const canGiveUp = game.canGiveUp();
  if (el.giveupRow) {
    el.giveupRow.hidden = !canGiveUp;
  }
  el.giveup.disabled = !canGiveUp;
  el.giveup.classList.toggle('is-active', canGiveUp);
}

function onTileClick(word, tile) {
  if (animating) return;
  game.toggle(word);
  tile.classList.toggle('is-selected', game.isSelected(word));
  updateControls();
  saveProgress();
}

function onShuffle() {
  if (animating || !game.canShuffle()) return;
  game.shuffle();
  render();
}

function onDeselect() {
  if (animating || !game.canDeselect()) return;
  game.deselect();
  render();
}

function onOrganize() {
  if (animating || !game.canOrganize()) return;
  game.organize();
  render();
}

function onGiveUp() {
  if (animating || !game.canGiveUp()) return;
  game.giveUp();
  render();
  setTimeout(() => openResultsModal(), 400);
}

function playBounce(tiles) {
  tiles.forEach((tile, i) => {
    const cls = BOUNCE_CLASSES[Math.min(i, BOUNCE_CLASSES.length - 1)];
    tile.classList.remove(...BOUNCE_CLASSES);
    void tile.offsetWidth;
    tile.classList.add(cls);
    tile.addEventListener('animationend', () => tile.classList.remove(cls), { once: true });
  });
}

function onSubmit() {
  if (animating || !game.canSubmit()) return;

  const selectedTiles = [...el.tiles.querySelectorAll('.tile.is-selected')];
  const result = game.submit();

  if (result.type === 'one-away') {
    showToast('One away');
    return;
  }
  if (result.type === 'already-guessed') {
    showToast('Already Guessed');
    return;
  }
  if (result.type === 'noop') return;

  // Same flow as NYT: bounce the selected cards first, then resolve.
  const correct = result.type === 'won' || result.type === 'solved';
  const wait = correct ? 1200 : 1000;

  animating = true;
  playBounce(selectedTiles);
  setTimeout(() => {
    animating = false;
    finishSubmit(result);
  }, wait);
}

function finishSubmit(result) {
  if (result.type === 'wrong') {
    render();
    if (result.oneAway) showToast('One away');
    shake();
  } else if (result.type === 'out-of-mistakes') {
    render();
    if (result.oneAway) showToast('One away');
    shake();
    setTimeout(() => openResultsModal(), 700);
  } else if (result.type === 'won') {
    render();
    setTimeout(() => openResultsModal(), 700);
  } else {
    render();
  }
}

function shake() {
  el.tiles.querySelectorAll('.tile.is-selected').forEach((t) => {
    t.classList.add('shake');
    t.addEventListener('animationend', () => t.classList.remove('shake'), { once: true });
  });
}

function openResultsModal() {
  if (!game) return;
  const finished = game.over;
  el.modalTitle.textContent = getOutcomeTitle();
  renderModalGuesses();
  if (el.modalShareGuesses) el.modalShareGuesses.hidden = !finished;
  if (el.modalContinue) el.modalContinue.hidden = finished;
  el.modal.hidden = false;
  el.modal.setAttribute('aria-hidden', 'false');
  fitModal();
}

function closeResultsModal() {
  el.modal.hidden = true;
  el.modal.setAttribute('aria-hidden', 'true');
}

function getOutcomeTitle() {
  if (game.over) {
    if (game.mistakes === 0) return 'Nice try!';
    const mistakesUsed = game.maxMistakes - game.mistakes;
    const titles = ['Perfect!', 'Great!', 'Solid!', 'Phew!'];
    return titles[mistakesUsed] || 'Great!';
  }
  if (game.mistakes === 0) return 'Nice try!';
  return 'Connections';
}

function renderModalGuesses() {
  el.modalGrid.innerHTML = '';
  if (!game || !game.guesses) return;

  game.guesses.forEach((words) => {
    const cats = new Set(words.map((w) => game.wordCat.get(w)));
    const guessCat = cats.size === 1 ? [...cats][0] : -1;

    if (guessCat > -1) {
      // Correct guess: render like a solved-category bar.
      const bar = document.createElement('div');
      bar.className = 'modal__guess modal__guess--category';
      bar.style.background = COLORS[guessCat];

      const title = document.createElement('div');
      title.className = 'modal__guess-title';
      title.textContent = game.categories[guessCat].title;
      bar.appendChild(title);

      const list = document.createElement('div');
      list.className = 'modal__guess-words';
      list.textContent = words.join(', ');
      bar.appendChild(list);

      el.modalGrid.appendChild(bar);
      return;
    }

    // Incorrect guess: four word segments. They stay neutral until the game
    // is finished, then each word shows its category colour.
    const row = document.createElement('div');
    row.className = 'modal__guess modal__guess--split';
    words.forEach((w) => {
      const ci = game.wordCat.get(w);
      const cell = document.createElement('div');
      cell.className = 'modal__cell' + (game.over ? '' : ' modal__cell--neutral');
      if (game.over) cell.style.background = COLORS[ci];
      cell.textContent = w;
      row.appendChild(cell);
    });
    el.modalGrid.appendChild(row);
  });
}

async function copyAndToast(text) {
  if (await copyText(text)) {
    showToast('Copied to clipboard');
  } else {
    window.prompt('Copy your results:', text);
  }
}

function shareResults() {
  copyAndToast(getShareText(game));
}

function shareGuesses() {
  copyAndToast(getGuessesShareText(game));
}

el.shuffle.addEventListener('click', onShuffle);
el.deselect.addEventListener('click', onDeselect);
el.organize.addEventListener('click', onOrganize);
el.giveup.addEventListener('click', onGiveUp);
el.submit.addEventListener('click', onSubmit);
el.modalClose.addEventListener('click', closeResultsModal);
el.modalContinue.addEventListener('click', closeResultsModal);
el.modalShare.addEventListener('click', shareResults);
el.modalShareGuesses?.addEventListener('click', shareGuesses);
el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal) closeResultsModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.modal.hidden) closeResultsModal();
});
el.stats?.addEventListener('click', () => {
  if (animating) return;
  if (game && (game.over || game.guesses.length > 0)) {
    openResultsModal();
  }
});

initShell();

el.prev.addEventListener('click', () => {
  if (animating) return;
  goTo(shiftDate(currentDate || todayString(), -1));
});
el.next.addEventListener('click', () => {
  if (animating) return;
  goTo(shiftDate(currentDate || todayString(), 1));
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (game) fitTiles();
    if (!el.modal.hidden) fitModal();
  });
}

async function start() {
  if (await loadDate(todayString())) return;

  const data = await fetchPuzzletoday();
  if (data) {
    currentDate = data.print_date || '2026-10-10';
    init(data);
    return;
  }

  el.tiles.innerHTML =
    '<div class="load-error">Could not load the puzzle. Put it at <code>puzzle/&lt;date&gt;.json</code> or check that the NYT service is reachable, then reload.</div>';
}

start();
