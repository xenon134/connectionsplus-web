export class ConnectionsGame {
  constructor(data) {
    this.maxMistakes = 4;
    this.categories = data.categories;
    this.printDate = data.print_date;
    this.id = data.id || null;

    this.wordCat = new Map();
    data.categories.forEach((cat, ci) => {
      cat.cards.forEach((card) => this.wordCat.set(card.content, ci));
    });

    const flat = [];
    data.categories.forEach((cat, ci) => {
      cat.cards.forEach((card) => flat.push({ content: card.content, position: card.position, cat: ci }));
    });
    flat.sort((a, b) => a.position - b.position);

    this.order = flat.map((t) => t.content);
    this.selected = [];
    this.guesses = [];
    this.solved = data.categories.map(() => false);
    this.revealed = data.categories.map(() => false);
    this.mistakes = this.maxMistakes;
    this.over = false;
  }

  isSolved(ci) { return this.solved[ci]; }
  isRevealed(ci) { return this.revealed[ci]; }
  isSelected(word) { return this.selected.includes(word); }
  wordsFor(ci) { return this.categories[ci].cards.map((c) => c.content).sort(); }

  canSubmit() { return !this.over && this.selected.length === 4; }
  canDeselect() { return !this.over && this.selected.length > 0; }
  canShuffle() { return !this.over && this.order.length > 1; }
  canOrganize() { return this.selected.length > 0; }

  toggle(word) {
    if (this.over) return;
    const i = this.selected.indexOf(word);
    if (i > -1) {
      this.selected.splice(i, 1);
    } else if (this.selected.length < 4) {
      this.selected.push(word);
    }
  }

  deselect() { this.selected = []; }

  shuffle() {
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    this.deselect();
  }

  organize() {
    if (this.over || this.selected.length === 0) return;
    const pinned = this.selected.slice();
    this.order = pinned.concat(this.order.filter((w) => !pinned.includes(w)));
  }

  submit() {
    if (!this.canSubmit()) return { type: 'noop' };

    const group = [...this.selected].sort();
    const key = group.join('\u0001');
    const prev = this.guesses.find((g) => g.key === key);
    if (prev) {
      return prev.oneAway ? { type: 'one-away' } : { type: 'already-guessed' };
    }

    const counts = new Map();
    this.selected.forEach((w) => {
      const ci = this.wordCat.get(w);
      counts.set(ci, (counts.get(ci) || 0) + 1);
    });

    let oneAway = false;
    counts.forEach((n, ci) => { if (!this.solved[ci] && n === 3) oneAway = true; });

    const ci = counts.size === 1 ? [...counts.keys()][0] : -1;
    const correct = ci > -1 && !this.solved[ci];
    const categories = this.selected.map((w) => this.wordCat.get(w));
    this.guesses.push({
      key,
      words: [...this.selected],
      categories,
      oneAway: !correct && oneAway,
      correct,
    });
    if (correct) return this._solve(ci);
    return this._wrong(oneAway);
  }

  _solve(ci) {
    this.solved[ci] = true;
    this.order = this.order.filter((w) => this.wordCat.get(w) !== ci);
    this.deselect();
    if (this.solved.every(Boolean)) {
      this.over = true;
      return { type: 'won', category: ci };
    }
    return { type: 'solved', category: ci };
  }

  canGiveUp() { return !this.over && this.mistakes === 0; }

  giveUp() {
    if (!this.canGiveUp()) return { type: 'noop' };
    this.over = true;
    this.categories.forEach((_, ci) => { if (!this.solved[ci]) this.revealed[ci] = true; });
    this.order = [];
    this.deselect();
    return { type: 'gave-up' };
  }

  _wrong(oneAway) {
    const wasOut = this.mistakes === 0;
    if (this.mistakes > 0) {
      this.mistakes--;
    }

    if (!wasOut && this.mistakes === 0) {
      this.outOfMistakes = true;
      return { type: 'out-of-mistakes', oneAway };
    }
    return { type: 'wrong', oneAway, outOfMistakes: this.mistakes === 0 };
  }
}
