import { Link } from 'react-router-dom';
import { useCart } from './cart';

const MAX_SHOTS = 3;

export function CartPill({ hidden = false }: { hidden?: boolean }) {
  const cart = useCart();
  if (!cart.count) return null;

  const shots = cart.lines.slice(-MAX_SHOTS).map((line) => ({
    lineId: line.lineId,
    imageUrl: cart.catalog?.items.find((item) => item.id === line.menuItemId)?.imageUrl ?? null,
  }));

  return (
    <div className={`bag-dock${hidden ? ' is-down' : ''}`} aria-hidden={hidden || undefined}>
      <Link className="bag-pill" to="/cart" aria-label={`View cart, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`}>
        <span className="bag-stack">
          {shots.map((shot, index) => (
            <span key={shot.lineId} className="bag-chip" style={{ zIndex: index + 1 }}>
              {shot.imageUrl ? <img src={shot.imageUrl} alt="" /> : null}
            </span>
          ))}
        </span>
        <span className="bag-tail">
          <span className="bag-copy">
            <strong>View cart</strong>
            <small>{cart.count} {cart.count === 1 ? 'item' : 'items'}</small>
          </span>
          <span className="bag-go" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </span>
      </Link>
    </div>
  );
}
