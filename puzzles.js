import { ConnectionsGame } from './game.js';
import {
  fetchPuzzle,
  loadProgress,
  formatPuzzleDate,
  shiftDate,
  todayString,
} from './data.js';

// Connections #1 was published on June 12, 2023.
const LAUNCH_DATE = '2023-06-12';
const DAY_MS = 24 * 60 * 60 * 1000;

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

function puzzleNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  const [ly, lm, ld] = LAUNCH_DATE.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ly, lm - 1, ld)) / DAY_MS) + 1;
}

function listPuzzleDates() {
  const end = shiftDate(todayString(), 1);
  const [sy, sm, sd] = LAUNCH_DATE.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const dates = [];

  for (let t = Date.UTC(ey, em - 1, ed); t >= Date.UTC(sy, sm - 1, sd); t -= DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }

  return dates;
}

async function getPuzzleMeta(date) {
  if (metaCache.has(date)) return metaCache.get(date);
  const data = await fetchPuzzle(date);
  if (data) metaCache.set(date, data);
  return data;
}

function getPuzzleStatus(saved, data) {
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

function makeRow({ date, number, status }) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'puzzle-row';
  row.dataset.date = date;
  if (date === getCurrentDate()) row.setAttribute('aria-current', 'date');

  const copy = document.createElement('span');
  copy.className = 'puzzle-row__text';

  const dateText = formatPuzzleDate(date);
  const dateEl = document.createElement('span');
  dateEl.className = 'puzzle-row__date';
  dateEl.textContent = dateText;

  const numText = `Connections #${number}`;
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

  row.setAttribute('aria-label', `${dateText}, ${numText}, ${status.label}`);
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

  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => fragment.appendChild(makeRow(entry)));
  el.list.appendChild(fragment);
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
  const dates = listPuzzleDates();

  const savedByDate = new Map();
  for (const date of dates) {
    const saved = loadProgress(date);
    if (saved && Array.isArray(saved.guesses) && saved.guesses.length) {
      savedByDate.set(date, saved);
    }
  }

  const dataByDate = new Map();
  await Promise.all([...savedByDate.keys()].map(async (date) => {
    const data = await getPuzzleMeta(date);
    if (data) dataByDate.set(date, data);
  }));

  if (token !== request || el.modal.hidden) return;

  const entries = dates.map((date) => {
    const saved = savedByDate.get(date);
    let status = { kind: 'none', text: '', label: 'Not played' };

    if (saved) {
      const data = dataByDate.get(date);
      status = data
        ? getPuzzleStatus(saved, data)
        : { kind: 'attempted', text: '?/4', label: 'Attempted, status unavailable' };
    }

    return { date, number: puzzleNumber(date), status };
  });

  render(entries, 'No puzzles available.');
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
