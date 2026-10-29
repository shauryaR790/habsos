let activeFrame = 0;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Soft deceleration — reads slower than browser default smooth scroll. */
function easeOutQuint(t: number) {
  return 1 - (1 - t) ** 5;
}

function scrollMarginTop(el: HTMLElement) {
  const raw = getComputedStyle(el).scrollMarginTop;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function cancelGuestSmoothScroll() {
  if (activeFrame) {
    cancelAnimationFrame(activeFrame);
    activeFrame = 0;
  }
}

export function smoothScrollToY(targetTop: number) {
  cancelGuestSmoothScroll();
  const end = Math.max(0, targetTop);
  if (reducedMotion()) {
    window.scrollTo(0, end);
    return;
  }

  const start = window.scrollY;
  const delta = end - start;
  if (Math.abs(delta) < 3) return;

  const distance = Math.abs(delta);
  const duration = Math.min(1650, Math.max(920, distance * 0.72));
  const t0 = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + delta * easeOutQuint(t));
    if (t < 1) activeFrame = requestAnimationFrame(step);
    else activeFrame = 0;
  };
  activeFrame = requestAnimationFrame(step);
}

export function smoothScrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = window.scrollY + el.getBoundingClientRect().top - scrollMarginTop(el);
  smoothScrollToY(top);
}
