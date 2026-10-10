export class ConnectionsGame {
  constructor(data) {
    this.maxMistakes = 4;
    this.categories = data.categories;
    this.printDate = data.print_date;

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

  submit() {
    if (!this.canSubmit()) return { type: 'noop' };

    const counts = new Map();
    this.selected.forEach((w) => {
      const ci = this.wordCat.get(w);
      counts.set(ci, (counts.get(ci) || 0) + 1);
    });

    let oneAway = false;
    counts.forEach((n, ci) => { if (!this.solved[ci] && n === 3) oneAway = true; });

    const ci = counts.size === 1 ? [...counts.keys()][0] : -1;
    if (ci > -1 && !this.solved[ci]) return this._solve(ci);
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

  _wrong(oneAway) {
    this.mistakes = Math.max(0, this.mistakes - 1);
    if (this.mistakes === 0) {
      this.over = true;
      this.categories.forEach((_, ci) => { if (!this.solved[ci]) this.revealed[ci] = true; });
      this.order = [];
      this.deselect();
      return { type: 'lost', oneAway };
    }
    return { type: 'wrong', oneAway };
  }
}
