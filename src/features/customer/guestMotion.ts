export const GUEST_DRAWER_CLOSE_MS = 360;
export const GUEST_DRAWER_OPEN_MS = 420;

export function guestMotionMs(ms: number) {
  if (typeof window === 'undefined') return ms;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}
