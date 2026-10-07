let depth = 0;

/** Lock document scroll while overlays are open (ref-counted so nested modals stay safe). */
export function acquireScrollLock() {
  depth += 1;
  if (depth === 1) document.body.classList.add('lock-scroll');
  return () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) document.body.classList.remove('lock-scroll');
  };
}

export function resetScrollLock() {
  depth = 0;
  document.body.classList.remove('lock-scroll');
}
