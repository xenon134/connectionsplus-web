const COLORS = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'];

const el = {
  tiles: document.getElementById('tiles'),
  solved: document.getElementById('solved'),
  dots: document.getElementById('dots'),
  shuffle: document.getElementById('shuffle'),
  deselect: document.getElementById('deselect'),
  submit: document.getElementById('submit'),
  date: document.getElementById('date'),
  toast: document.getElementById('toast'),
};

const state = {
  categories: [],
  wordCat: new Map(),
  order: [],
  selected: [],
  solved: [false, false, false, false],
  revealed: [false, false, false, false],
  mistakes: 4,
  over: false,
};

const MAX_MISTAKES = 4;
let toastTimer;

function showToast(msg) {
  if (!msg) { el.toast.classList.remove('show'); return; }
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1400);
}

function load() {
  fetch('puzzletoday.json')
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(init)
    .catch(() => {
      el.tiles.innerHTML =
        '<div class="load-error">Could not load puzzletoday.json. Serve this folder over HTTP (e.g. <code>python -m http.server</code>) and reload.</div>';
    });
}

function init(data) {
  state.categories = data.categories;
  data.categories.forEach((cat, ci) => {
    cat.cards.forEach((card) => state.wordCat.set(card.content, ci));
  });

  const flat = [];
  data.categories.forEach((cat, ci) =>
    cat.cards.forEach((card) => flat.push({ content: card.content, position: card.position, cat: ci }))
  );
  flat.sort((a, b) => a.position - b.position);
  state.order = flat.map((t) => t.content);

  const d = new Date(data.print_date + 'T00:00:00');
  el.date.textContent = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  render();
}

function render() {
  renderSolved();
  renderTiles();
  renderDots();
  updateControls();
  fitTiles();
}

function fits(tile) {
  return tile.scrollWidth <= tile.clientWidth + 1 && tile.scrollHeight <= tile.clientHeight + 1;
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
  state.categories.forEach((cat, ci) => {
    if (state.solved[ci] || state.revealed[ci]) {
      el.solved.appendChild(solvedBar(ci, cat, !state.solved[ci]));
    }
  });
}

function solvedBar(ci, cat, reveal) {
  const words = cat.cards.map((c) => c.content).sort();
  const bar = document.createElement('div');
  bar.className = 'solved' + (reveal ? ' solved--reveal' : '');
  bar.style.background = COLORS[ci];

  const title = document.createElement('div');
  title.className = 'solved__title';
  title.textContent = cat.title;

  const list = document.createElement('div');
  list.className = 'solved__words';
  list.textContent = words.join(', ');

  bar.append(title, list);
  return bar;
}

function renderTiles() {
  el.tiles.innerHTML = '';
  state.order.forEach((word) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile' + (state.selected.includes(word) ? ' is-selected' : '');
    tile.textContent = word;
    tile.addEventListener('click', () => toggle(word, tile));
    el.tiles.appendChild(tile);
  });
}

function renderDots() {
  const used = MAX_MISTAKES - state.mistakes;
  el.dots.innerHTML = '';
  for (let i = 0; i < MAX_MISTAKES; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i < used ? ' is-used' : '');
    el.dots.appendChild(dot);
  }
}

function updateControls() {
  const n = state.selected.length;
  el.deselect.disabled = n === 0 || state.over;
  el.submit.disabled = n !== 4 || state.over;
  el.shuffle.disabled = state.over || state.order.length < 2;
  el.deselect.classList.toggle('is-active', !el.deselect.disabled);
  el.submit.classList.toggle('is-active', !el.submit.disabled);
  el.shuffle.classList.toggle('is-active', !el.shuffle.disabled);
}

function toggle(word, tile) {
  if (state.over) return;
  const i = state.selected.indexOf(word);
  if (i > -1) {
    state.selected.splice(i, 1);
  } else if (state.selected.length < 4) {
    state.selected.push(word);
  } else {
    return;
  }
  tile.classList.toggle('is-selected');
  updateControls();
}

function clearSelection() {
  state.selected = [];
}

function shuffle() {
  if (el.shuffle.disabled) return;
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }
  clearSelection();
  render();
}

function submit() {
  if (el.submit.disabled) return;
  const sel = state.selected;
  const counts = new Map();
  sel.forEach((w) => {
    const ci = state.wordCat.get(w);
    counts.set(ci, (counts.get(ci) || 0) + 1);
  });

  let oneAway = false;
  counts.forEach((n, ci) => { if (!state.solved[ci] && n === 3) oneAway = true; });

  if (counts.size === 1 && !state.solved[singleCat(counts)]) {
    solve(singleCat(counts));
  } else {
    wrong(oneAway);
  }
}

function singleCat(counts) {
  return [...counts.keys()][0];
}

function solve(ci) {
  state.solved[ci] = true;
  state.order = state.order.filter((w) => state.wordCat.get(w) !== ci);
  clearSelection();
  render();
  if (state.solved.every(Boolean)) {
    state.over = true;
    render();
  }
}

function wrong(oneAway) {
  state.mistakes = Math.max(0, state.mistakes - 1);

  if (state.mistakes === 0) {
    state.over = true;
    state.categories.forEach((_, ci) => { if (!state.solved[ci]) state.revealed[ci] = true; });
    state.order = [];
    clearSelection();
    render();
  } else {
    if (oneAway) showToast('One away');
    render();
    shake();
  }
}

function shake() {
  el.tiles.querySelectorAll('.tile.is-selected').forEach((t) => {
    t.classList.add('shake');
    t.addEventListener('animationend', () => t.classList.remove('shake'), { once: true });
  });
}

el.shuffle.addEventListener('click', shuffle);
el.deselect.addEventListener('click', () => { clearSelection(); render(); });
el.submit.addEventListener('click', submit);

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitTiles);
}

load();
