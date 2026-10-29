import { ConnectionsGame } from './game.js';
import { fetchPuzzle, loadProgress, formatPuzzleDate } from './data.js';

const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;

const el = {
  date: document.getElementById('date'),
  modal: document.getElementById('puzzles-modal'),
  list: document.getElementById('puzzles-list'),
  close: document.getElementById('puzzles-close'),
};

let getCurrentDate = () => null;
let isBusy = () => false;
let onSelect = async () => {};
let onOpen = () => {};
let request = 0;

const metaCache = new Map();

async function listPuzzleDates() {
  const dates = new Set();

  try {
    const res = await fetch('puzzle/', { cache: 'no-store' });
    if (res.ok) {
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      doc.querySelectorAll('a[href]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(DATE_FILE_RE);
        if (m) dates.add(m[1]);
      });
    }
  } catch { }

  const current = getCurrentDate();
  if (current) dates.add(current);

  return [...dates].sort((a, b) => b.localeCompare(a));
}

async function getPuzzleMeta(date) {
  if (metaCache.has(date)) return metaCache.get(date);
  const data = await fetchPuzzle(date);
  if (data) metaCache.set(date, data);
  return data;
}

function getPuzzleStatus(date, data) {
  const saved = loadProgress(date);
  if (!saved || !Array.isArray(saved.guesses) || saved.guesses.length === 0) {
    return { kind: 'none', text: '', label: 'Not played' };
  }

  const state = new ConnectionsGame(data);
  state.restore(saved);
  const solved = state.solved.filter(Boolean).length;

  if (state.over && solved === state.categories.length) {
    return {
      kind: 'solved',
      text: `${state.guesses.length}/4`,
      label: `Solved in ${state.guesses.length} guesses`,
    };
  }

  return {
    kind: 'attempted',
    text: `${solved}/4`,
    label: `${solved} of 4 categories solved`,
  };
}

function makeRow({ date, data, status }) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'puzzle-row';
  row.dataset.date = date;
  if (date === getCurrentDate()) row.setAttribute('aria-current', 'date');

  const copy = document.createElement('span');
  copy.className = 'puzzle-row__text';

  const dateEl = document.createElement('span');
  dateEl.className = 'puzzle-row__date';
  dateEl.textContent = formatPuzzleDate(date);

  const numText = data && data.id != null ? `Connections #${data.id}` : 'Connections';
  const numEl = document.createElement('span');
  numEl.className = 'puzzle-row__num';
  numEl.textContent = numText;

  copy.append(dateEl, numEl);
  row.appendChild(copy);

  if (status.text) {
    const score = document.createElement('span');
    score.className = `puzzle-row__score puzzle-row__score--${status.kind}`;
    score.textContent = status.text;
    score.setAttribute('aria-hidden', 'true');
    row.appendChild(score);
  }

  row.setAttribute('aria-label', `${formatPuzzleDate(date)}, ${numText}, ${status.label}`);
  row.addEventListener('click', async () => {
    close();
    await onSelect(date);
  });

  return row;
}

function render(entries, emptyMessage) {
  el.list.innerHTML = '';

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'puzzles-empty';
    empty.textContent = emptyMessage;
    el.list.appendChild(empty);
    return;
  }

  entries.forEach((entry) => el.list.appendChild(makeRow(entry)));
}

async function open() {
  if (!el.modal || isBusy()) return;

  onOpen();
  el.modal.hidden = false;
  el.modal.setAttribute('aria-hidden', 'false');
  el.date?.setAttribute('aria-expanded', 'true');
  el.list.innerHTML = '<div class="puzzles-loading">Loading puzzles…</div>';
  el.close?.focus();

  const token = ++request;
  const dates = await listPuzzleDates();
  const metas = await Promise.all(dates.map((date) => getPuzzleMeta(date)));

  if (token !== request || el.modal.hidden) return;

  const entries = dates
    .map((date, i) => (metas[i] ? { date, data: metas[i], status: getPuzzleStatus(date, metas[i]) } : null))
    .filter(Boolean);

  render(
    entries,
    dates.length ? 'Could not load the puzzle list.' : 'No puzzles available.',
  );
}

export function closePuzzlesModal() {
  if (!el.modal || el.modal.hidden) return;

  request++;
  el.modal.hidden = true;
  el.modal.setAttribute('aria-hidden', 'true');
  el.date?.setAttribute('aria-expanded', 'false');

  if (el.modal.contains(document.activeElement)) el.date?.focus();
}

function trapFocus(e) {
  if (e.key !== 'Tab' || !el.modal || el.modal.hidden) return;

  const nodes = [...el.modal.querySelectorAll('button:not([disabled])')]
    .filter((node) => node.offsetParent !== null);
  if (!nodes.length) return;

  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function initPuzzlesList(options = {}) {
  getCurrentDate = options.getCurrentDate || getCurrentDate;
  isBusy = options.isBusy || isBusy;
  onSelect = options.onSelect || onSelect;
  onOpen = options.onOpen || onOpen;

  el.date?.addEventListener('click', open);
  el.close?.addEventListener('click', closePuzzlesModal);
  el.modal?.addEventListener('click', (e) => {
    if (e.target === el.modal) closePuzzlesModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.modal && !el.modal.hidden) {
      closePuzzlesModal();
      return;
    }
    trapFocus(e);
  });
}
