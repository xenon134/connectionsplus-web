const CATEGORY_EMOJIS = ['🟨', '🟩', '🟦', '🟪'];

export function titleCase(str) {
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function getGuessesShareText(game) {
  return game.guesses
    .map((words) => words.map(titleCase).join(' '))
    .join('\n');
}

export function getShareText(game) {
  const titleLine = `Connections\n${game.id ? `Puzzle #${game.id}` : game.printDate}`;
  const gridText = game.guesses
    .map((words) => words.map((w) => CATEGORY_EMOJIS[game.wordCat.get(w)]).join(''))
    .join('\n');
  return `${titleLine}\n${gridText}`;
}

export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall back below */ }
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}
