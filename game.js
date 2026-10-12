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

    this.initialOrder = flat.map((t) => t.content);
    this.order = [...this.initialOrder];
    this.selected = [];
    this.guesses = [];
    this.solved = data.categories.map(() => false);
    this.revealed = data.categories.map(() => false);
    this.solvedOrder = [];
    this.mistakes = this.maxMistakes;
    this.over = false;
    this.outOfMistakes = false;
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
  }

  organize() {
    if (this.over || this.selected.length === 0) return;
    const pinned = this.selected.slice();
    this.order = pinned.concat(this.order.filter((w) => !pinned.includes(w)));
  }

  submit() {
    if (!this.canSubmit()) return { type: 'noop' };

    const words = [...this.selected];
    const key = [...words].sort().join('\u0001');
    const prev = this.guesses.find((g) => [...g].sort().join('\u0001') === key);
    if (prev) {
      return this._isOneAway(prev) ? { type: 'one-away' } : { type: 'already-guessed' };
    }

    const counts = new Map();
    words.forEach((w) => {
      const ci = this.wordCat.get(w);
      counts.set(ci, (counts.get(ci) || 0) + 1);
    });

    let oneAway = false;
    counts.forEach((n, ci) => { if (!this.solved[ci] && n === 3) oneAway = true; });

    const ci = counts.size === 1 ? [...counts.keys()][0] : -1;
    const correct = ci > -1 && !this.solved[ci];
    this.guesses.push(words);
    if (correct) return this._solve(ci);
    return this._wrong(oneAway);
  }

  _isOneAway(words) {
    const counts = new Map();
    words.forEach((w) => {
      const ci = this.wordCat.get(w);
      counts.set(ci, (counts.get(ci) || 0) + 1);
    });
    for (const [ci, n] of counts) {
      if (!this.solved[ci] && n === 3) return true;
    }
    return false;
  }

  _solve(ci) {
    this.solved[ci] = true;
    if (!this.solvedOrder.includes(ci)) {
      this.solvedOrder.push(ci);
    }
    this.order = this.order.filter((w) => this.wordCat.get(w) !== ci);
    this.deselect();
    if (this.solved.every(Boolean)) {
      this.over = true;
      return { type: 'won', category: ci };
    }
    return { type: 'solved', category: ci };
  }

  canGiveUp() { return !this.over && this.mistakes === 0; }

  _revealRemaining() {
    this.over = true;
    this.categories.forEach((_, ci) => {
      if (!this.solved[ci]) {
        this.revealed[ci] = true;
        if (!this.solvedOrder.includes(ci)) {
          this.solvedOrder.push(ci);
        }
      }
    });
    this.order = [];
    this.deselect();
  }

  giveUp() {
    if (!this.canGiveUp()) return { type: 'noop' };
    this._revealRemaining();
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

  serialize() {
    return {
      guesses: this.guesses.map((g) => [...g]),
      over: this.over,
    };
  }

  restore(saved) {
    if (!saved || !Array.isArray(saved.guesses)) return;
    this.reset();
    for (const words of saved.guesses) {
      this._applyGuess(words);
    }
    if (saved.over && !this.over) {
      this._revealRemaining();
    }
  }

  reset() {
    this.order = [...this.initialOrder];
    this.selected = [];
    this.guesses = [];
    this.solved = this.categories.map(() => false);
    this.revealed = this.categories.map(() => false);
    this.solvedOrder = [];
    this.mistakes = this.maxMistakes;
    this.over = false;
    this.outOfMistakes = false;
  }

  _applyGuess(words) {
    this.guesses.push([...words]);
    const counts = new Map();
    words.forEach((w) => {
      const ci = this.wordCat.get(w);
      counts.set(ci, (counts.get(ci) || 0) + 1);
    });
    const ci = counts.size === 1 ? [...counts.keys()][0] : -1;
    if (ci > -1 && !this.solved[ci]) {
      this.solved[ci] = true;
      if (!this.solvedOrder.includes(ci)) {
        this.solvedOrder.push(ci);
      }
      this.order = this.order.filter((w) => this.wordCat.get(w) !== ci);
      if (this.solved.every(Boolean)) {
        this.over = true;
      }
    } else {
      if (this.mistakes > 0) {
        this.mistakes--;
      }
      if (this.mistakes === 0) {
        this.outOfMistakes = true;
      }
    }
  }
}
