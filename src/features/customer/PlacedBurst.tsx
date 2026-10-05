import { useEffect, useRef } from 'react';
import { formatINR, type PublicOrder } from '../../../shared/domain';

export function PlacedBurst({ order, onDone }: { order: PublicOrder; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => done.current(), reduced ? 700 : 2200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="placed" role="status" aria-live="assertive">
      <div className="placed-mark" aria-hidden="true">
        <svg viewBox="0 0 72 72">
          <circle className="placed-ring" cx="36" cy="36" r="32" />
          <path className="placed-check" d="M22 37.5 32 47.5 51 26" />
        </svg>
      </div>
      <p className="placed-kicker">Order placed</p>
      <p className="placed-num">#{order.orderNumber}</p>
      <p className="placed-meta">
        {formatINR(order.total)}
      </p>
    </div>
  );
}
