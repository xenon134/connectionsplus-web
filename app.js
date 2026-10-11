import { ConnectionsGame } from './game.js';

const COLORS = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'];
const CATEGORY_EMOJIS = ['🟨', '🟩', '🟦', '🟪'];

const el = {
  tiles: document.getElementById('tiles'),
  solved: document.getElementById('solved'),
  dots: document.getElementById('dots'),
  shuffle: document.getElementById('shuffle'),
  deselect: document.getElementById('deselect'),
  organize: document.getElementById('organize'),
  submit: document.getElementById('submit'),
  giveup: document.getElementById('giveup'),
  stats: document.getElementById('stats-btn'),
  date: document.getElementById('date'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  toast: document.getElementById('toast'),
  modal: document.getElementById('results-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalClose: document.getElementById('modal-close'),
  modalGrid: document.getElementById('modal-grid'),
  modalShare: document.getElementById('modal-share'),
  modalContinue: document.getElementById('modal-continue'),
};

let game = null;
let toastTimer;

function showToast(msg) {
  if (!msg) { el.toast.classList.remove('show'); return; }
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1400);
}

const CACHE_PREFIX = 'connections:v1:';

function pad(n) { return String(n).padStart(2, '0'); }
function dateString(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayString() { return dateString(new Date()); }
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return dateString(d);
}
const cacheKey = (dateStr) => CACHE_PREFIX + dateStr;

function cacheGet(dateStr) {
  try {
    const raw = localStorage.getItem(cacheKey(dateStr));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheSet(dateStr, data) {
  try { localStorage.setItem(cacheKey(dateStr), JSON.stringify(data)); } catch { }
}

async function fetchPuzzle(dateStr) {
  const cached = cacheGet(dateStr);
  if (cached) return cached;

  const urls = [`puzzle/${dateStr}.json`];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !Array.isArray(data.categories)) continue;
      cacheSet(dateStr, data);
      return data;
    } catch { }
  }
  return null;
}

let currentDate = null;

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
  const d = new Date(game.printDate + 'T00:00:00');
  el.date.textContent = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  closeResultsModal();
  render();
}

function render() {
  renderSolved();
  renderTiles();
  renderDots();
  updateControls();
  fitTiles();
}

function fits(node) {
  return node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1;
}

function shrinkToFit(node, base) {
  node.style.fontSize = '';
  for (let fs = base; fs >= 9; fs -= 0.5) {
    node.style.fontSize = fs + 'px';
    if (fits(node)) break;
  }
}

function fitTiles() {
  el.tiles.querySelectorAll('.tile').forEach((t) => shrinkToFit(t, 20));
  el.solved.querySelectorAll('.solved__words').forEach((w) => shrinkToFit(w, 20));
}

function renderSolved() {
  el.solved.innerHTML = '';
  game.categories.forEach((cat, ci) => {
    if (game.isSolved(ci) || game.isRevealed(ci)) {
      el.solved.appendChild(solvedBar(ci, cat, game.isRevealed(ci)));
    }
  });
}

function solvedBar(ci, cat, reveal) {
  const bar = document.createElement('div');
  bar.className = 'solved' + (reveal ? ' solved--reveal' : '');
  bar.style.background = COLORS[ci];

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
  el.giveup.hidden = !canGiveUp;
  el.giveup.disabled = !canGiveUp;
  el.giveup.classList.toggle('is-active', canGiveUp);
}

function onTileClick(word, tile) {
  game.toggle(word);
  tile.classList.toggle('is-selected', game.isSelected(word));
  updateControls();
}

function onShuffle() {
  if (!game.canShuffle()) return;
  game.shuffle();
  render();
}

function onDeselect() {
  if (!game.canDeselect()) return;
  game.deselect();
  render();
}

function onOrganize() {
  if (!game.canOrganize()) return;
  game.organize();
  render();
}

function onGiveUp() {
  if (!game.canGiveUp()) return;
  game.giveUp();
  render();
  setTimeout(() => openResultsModal(), 400);
}

function onSubmit() {
  if (!game.canSubmit()) return;
  const result = game.submit();

  if (result.type === 'wrong') {
    render();
    if (result.oneAway) showToast('One away');
    shake();
  } else if (result.type === 'out-of-mistakes') {
    render();
    if (result.oneAway) showToast('One away');
    shake();
    setTimeout(() => openResultsModal(), 700);
  } else if (result.type === 'one-away') {
    showToast('One away');
  } else if (result.type === 'already-guessed') {
    showToast('Already Guessed');
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
  el.modalTitle.textContent = getOutcomeTitle();
  renderModalGrid();
  el.modal.hidden = false;
  el.modal.setAttribute('aria-hidden', 'false');
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

function renderModalGrid() {
  el.modalGrid.innerHTML = '';
  if (!game || !game.guesses) return;
  game.guesses.forEach((guess) => {
    guess.categories.forEach((catIndex) => {
      const cell = document.createElement('div');
      cell.className = `modal__cell modal__cell--${catIndex}`;
      el.modalGrid.appendChild(cell);
    });
  });
}

function getShareText() {
  const titleLine = `Connections\n${game.id ? `Puzzle #${game.id}` : game.printDate}`;
  const gridText = game.guesses
    .map((g) => g.categories.map((c) => CATEGORY_EMOJIS[c]).join(''))
    .join('\n');
  return `${titleLine}\n${gridText}`;
}

function shareResults() {
  const text = getShareText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied to clipboard'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Copied to clipboard');
  } catch {
    showToast('Failed to copy');
  }
  document.body.removeChild(ta);
}

el.shuffle.addEventListener('click', onShuffle);
el.deselect.addEventListener('click', onDeselect);
el.organize.addEventListener('click', onOrganize);
el.giveup.addEventListener('click', onGiveUp);
el.submit.addEventListener('click', onSubmit);
el.modalClose.addEventListener('click', closeResultsModal);
el.modalContinue.addEventListener('click', closeResultsModal);
el.modalShare.addEventListener('click', shareResults);
el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal) closeResultsModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.modal.hidden) closeResultsModal();
});
el.stats?.addEventListener('click', () => {
  if (game && (game.over || game.guesses.length > 0)) {
    openResultsModal();
  }
});

el.prev.addEventListener('click', () => goTo(shiftDate(currentDate || todayString(), -1)));
el.next.addEventListener('click', () => goTo(shiftDate(currentDate || todayString(), 1)));

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (game) fitTiles(); });
}

loadDate(todayString()).then((ok) => {
  if (!ok) {
    el.tiles.innerHTML =
      '<div class="load-error">Could not load the puzzle. Put it at <code>puzzle/&lt;date&gt;.json</code> or check that the NYT service is reachable, then reload.</div>';
  }
});
