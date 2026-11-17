import { initShell } from './shell.js';

const COLORS = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'];
const COLOR_NAMES = ['yellow', 'green', 'blue', 'purple'];

const el = {
  board: document.getElementById('odd-board'),
  band: document.getElementById('odd-band'),
  words: document.getElementById('odd-words'),
  submit: document.getElementById('odd-submit'),
  next: document.getElementById('odd-next'),
  result: document.getElementById('odd-result'),
  verdict: document.getElementById('odd-verdict'),
  category: document.getElementById('odd-category'),
  error: document.getElementById('odd-error'),
};

let round = null;
let selected = null;
let lastDate = null;
let busy = false;
let answered = false;

function setLoading() {
  busy = true;
  round = null;
  selected = null;
  answered = false;

  el.board.dataset.color = '';
  el.band.hidden = true;
  el.band.style.background = '';
  el.words.innerHTML = '<div class="odd-loading">Loading…</div>';

  el.submit.hidden = true;
  el.submit.disabled = true;
  el.submit.classList.remove('is-active');

  el.next.hidden = true;
  el.next.disabled = true;
  el.result.hidden = true;
  el.error.hidden = true;
}

function showError(message) {
  busy = false;
  round = null;
  selected = null;
  answered = false;

  el.board.dataset.color = '';
  el.band.hidden = true;
  el.band.style.background = '';
  el.words.innerHTML = '';

  el.submit.hidden = true;
  el.submit.disabled = true;
  el.submit.classList.remove('is-active');

  el.result.hidden = true;
  el.error.textContent = message;
  el.error.hidden = false;

  el.next.hidden = false;
  el.next.disabled = false;
  el.next.textContent = 'Try again';
  el.next.focus();
}

function renderRound(data, { focus = false } = {}) {
  const words = Array.isArray(data?.words)
    ? data.words.filter((word) => typeof word === 'string' && word.trim())
    : [];
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));

  if (
    words.length !== 5 ||
    uniqueWords.size !== 5 ||
    typeof data?.answer !== 'string' ||
    !words.includes(data.answer)
  ) {
    showError('The server sent an invalid round. Try again.');
    return;
  }

  const colorIndex =
    Number.isInteger(data.colorIndex) && data.colorIndex >= 0 && data.colorIndex < COLORS.length
      ? data.colorIndex
      : 0;

  round = data;
  selected = null;
  answered = false;
  busy = false;
  if (typeof data.date === 'string') lastDate = data.date;

  el.board.dataset.color = String(colorIndex);
  el.band.style.background = COLORS[colorIndex];
  el.band.setAttribute('aria-label', `Category color: ${COLOR_NAMES[colorIndex]}`);
  el.band.hidden = false;

  el.words.innerHTML = '';
  for (const word of words) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'odd-word';
    button.textContent = word;
    button.dataset.word = word;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectWord(button));
    el.words.appendChild(button);
  }

  el.result.hidden = true;
  el.error.hidden = true;
  el.error.textContent = '';

  el.submit.hidden = false;
  el.submit.disabled = true;
  el.submit.classList.remove('is-active');

  el.next.hidden = true;
  el.next.disabled = false;
  el.next.textContent = 'Next';

  if (focus) {
    el.words.querySelector('.odd-word')?.focus();
  }
}

function selectWord(button) {
  if (!round || answered || busy) return;

  selected = button.dataset.word;
  for (const word of el.words.querySelectorAll('.odd-word')) {
    const isSelected = word === button;
    word.classList.toggle('is-selected', isSelected);
    word.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }

  el.submit.disabled = false;
  el.submit.classList.add('is-active');
}

function submitAnswer() {
  if (!round || !selected || answered || busy) return;

  answered = true;
  const isCorrect = selected === round.answer;

  for (const word of el.words.querySelectorAll('.odd-word')) {
    word.disabled = true;
    word.classList.remove('is-selected');
    word.setAttribute('aria-pressed', 'false');

    if (word.dataset.word === round.answer) {
      word.classList.add('is-correct');
    }
    if (!isCorrect && word.dataset.word === selected) {
      word.classList.add('is-wrong');
    }
  }

  el.verdict.textContent = isCorrect
    ? 'Correct!'
    : `Not quite — the odd word was “${round.answer}”.`;
  el.verdict.classList.toggle('is-correct', isCorrect);
  el.verdict.classList.toggle('is-wrong', !isCorrect);
  el.category.textContent = round.category || 'Category';

  el.result.hidden = false;
  el.submit.hidden = true;
  el.submit.disabled = true;
  el.submit.classList.remove('is-active');

  el.next.hidden = false;
  el.next.disabled = false;
  el.next.textContent = 'Next';
  el.next.focus();
}

async function loadRound({ focus = false, exclude = null } = {}) {
  if (busy) return;
  setLoading();

  const url = new URL('api/odd-one', window.location.href);
  if (exclude) url.searchParams.set('exclude', exclude);

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderRound(data, { focus });
  } catch {
    showError('Could not load a round. Make sure the local server is running, then try again.');
  }
}

function nextRound() {
  loadRound({ focus: true, exclude: lastDate });
}

el.submit.addEventListener('click', submitAnswer);
el.next.addEventListener('click', nextRound);

initShell();
loadRound();
