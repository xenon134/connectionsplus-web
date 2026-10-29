const THEME_KEY = 'connections:theme';
const THEMES = ['system', 'light', 'dark'];
const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_ICONS = {
  system: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 20.5h7M12 17v3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  light: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

const el = {
  theme: document.getElementById('theme-btn'),
  toast: document.getElementById('toast'),
  gamesBtn: document.getElementById('games-btn'),
  gamesBackdrop: document.getElementById('games-backdrop'),
  gamesDrawer: document.getElementById('games-drawer'),
  gamesClose: document.getElementById('games-close'),
};

let toastTimer;
let drawerTimer;
let drawerReturnFocus = null;

export function showToast(msg) {
  if (!el.toast) return;
  if (!msg) { el.toast.classList.remove('show'); return; }
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1400);
}

function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return THEMES.includes(t) ? t : 'system';
  } catch { return 'system'; }
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'system';
  document.documentElement.dataset.theme = theme;
  if (el.theme) {
    const label = `Theme: ${THEME_LABELS[theme]}`;
    el.theme.setAttribute('aria-label', label);
    el.theme.setAttribute('title', label);
    el.theme.innerHTML = THEME_ICONS[theme];
  }
}

function setTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { }
  applyTheme(theme);
}

function cycleTheme() {
  const current = document.documentElement.dataset.theme || 'system';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  setTheme(next);
}

function openGamesDrawer() {
  if (!el.gamesDrawer) return;
  if (!el.gamesDrawer.hidden && el.gamesDrawer.classList.contains('is-open')) return;

  clearTimeout(drawerTimer);
  drawerReturnFocus = document.activeElement;
  el.gamesBackdrop.hidden = false;
  el.gamesDrawer.hidden = false;
  void el.gamesDrawer.offsetWidth;
  el.gamesBackdrop.classList.add('is-open');
  el.gamesDrawer.classList.add('is-open');
  el.gamesDrawer.setAttribute('aria-hidden', 'false');
  el.gamesBtn?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('drawer-open');
  el.gamesClose?.focus();
}

function closeGamesDrawer() {
  if (!el.gamesDrawer || el.gamesDrawer.hidden) return;

  el.gamesBackdrop.classList.remove('is-open');
  el.gamesDrawer.classList.remove('is-open');
  el.gamesDrawer.setAttribute('aria-hidden', 'true');
  el.gamesBtn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('drawer-open');

  clearTimeout(drawerTimer);
  drawerTimer = setTimeout(() => {
    if (el.gamesDrawer.classList.contains('is-open')) return;
    el.gamesBackdrop.hidden = true;
    el.gamesDrawer.hidden = true;
  }, 280);

  if (drawerReturnFocus && typeof drawerReturnFocus.focus === 'function') {
    drawerReturnFocus.focus();
    drawerReturnFocus = null;
  }
}

function trapDrawerFocus(e) {
  if (e.key !== 'Tab' || !el.gamesDrawer || el.gamesDrawer.hidden) return;
  const nodes = [...el.gamesDrawer.querySelectorAll('a[href], button:not([disabled])')]
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

function onGameCardClick(card, e) {
  if (card.hasAttribute('aria-current')) {
    e.preventDefault();
    closeGamesDrawer();
    return;
  }
  if (card.hasAttribute('data-coming-soon')) {
    e.preventDefault();
    closeGamesDrawer();
    const title = card.querySelector('.game-card__title')?.textContent || 'This game';
    showToast(`${title} is coming soon`);
    return;
  }
  closeGamesDrawer();
}

export function initShell() {
  applyTheme(getStoredTheme());
  el.theme?.addEventListener('click', cycleTheme);
  el.gamesBtn?.addEventListener('click', openGamesDrawer);
  el.gamesClose?.addEventListener('click', closeGamesDrawer);
  el.gamesBackdrop?.addEventListener('click', closeGamesDrawer);
  el.gamesDrawer?.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', (e) => onGameCardClick(card, e));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.gamesDrawer && !el.gamesDrawer.hidden) {
      closeGamesDrawer();
      return;
    }
    trapDrawerFocus(e);
  });
}
