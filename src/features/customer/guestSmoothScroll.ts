function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function smoothScrollToY(top: number) {
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
}

export function smoothScrollToId(id: string, block: ScrollLogicalPosition = 'start') {
  document.getElementById(id)?.scrollIntoView({
    behavior: reducedMotion() ? 'auto' : 'smooth',
    block,
  });
}
