export function AdLoyaltyToast({ points, visible }: { points: number; visible: boolean }) {
  if (!visible || points <= 0) return null;
  return (
    <p className="ad-loyalty-toast" role="status">
      <span className="ad-loyalty-toast-icon" aria-hidden="true">☼</span>
      You&apos;ll earn {points} bonus points!
    </p>
  );
}
