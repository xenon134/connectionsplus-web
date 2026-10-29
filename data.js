const CACHE_PREFIX = 'connections:v1:';
const PROGRESS_PREFIX = 'connections:progress:';

const cacheKey = (dateStr) => CACHE_PREFIX + dateStr;
const progressKey = (key) => PROGRESS_PREFIX + key;

export function saveProgress(key, state) {
  if (!key) return;
  try { localStorage.setItem(progressKey(key), JSON.stringify(state)); } catch { }
}

export function loadProgress(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(progressKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function pad(n) { return String(n).padStart(2, '0'); }
function dateString(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function todayString() { return dateString(new Date()); }

export function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return dateString(d);
}

export function formatPuzzleDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function cacheGet(dateStr) {
  try {
    const raw = localStorage.getItem(cacheKey(dateStr));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheSet(dateStr, data) {
  try { localStorage.setItem(cacheKey(dateStr), JSON.stringify(data)); } catch { }
}

export async function fetchPuzzle(dateStr) {
  const cached = cacheGet(dateStr);
  if (cached) return cached;

  try {
    const res = await fetch(`puzzle/${dateStr}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.categories)) {
        cacheSet(dateStr, data);
        return data;
      }
    }
  } catch { }

  try {
    const res = await fetch('puzzletoday.json');
    if (res.ok) {
      const data = await res.json();
      if (data && (data.print_date === dateStr || !dateStr)) {
        cacheSet(dateStr, data);
        return data;
      }
    }
  } catch { }

  return null;
}

export async function fetchPuzzletoday() {
  try {
    const res = await fetch('puzzletoday.json');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.categories)) return null;
    if (data.print_date) cacheSet(data.print_date, data);
    return data;
  } catch { return null; }
}
