const KEY = 'ad-guest-menu-scroll-y';

export function saveMenuScroll(y = window.scrollY) {
  try {
    sessionStorage.setItem(KEY, String(Math.max(0, Math.round(y))));
  } catch {
    /* ignore */
  }
}

export function readMenuScroll() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}
