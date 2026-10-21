import { Link } from 'react-router-dom';
import { formatINR } from '../../../../shared/domain';

export function AdBottomNav({
  active,
  cartTotal,
  cartCount,
  menuAnchor,
  cartActive = false,
}: {
  active: 'menu';
  cartTotal: number | null;
  cartCount: number;
  /** Same-page anchor (e.g. #order-menu) on the mobile landing. */
  menuAnchor?: string;
  cartActive?: boolean;
}) {
  const totalLabel = cartTotal != null && cartCount > 0 ? formatINR(cartTotal) : formatINR(0);
  const menuClass = `ad-nav-pill${active === 'menu' ? ' is-active' : ''}`;
  const cartClass = `ad-nav-cart${cartActive ? ' is-active' : ''}`;
  return (
    <nav className="ad-bottom-nav" aria-label="Primary">
      {menuAnchor ? (
        <a href={menuAnchor} className={menuClass}>Menu</a>
      ) : (
        <Link to="/menu" className={menuClass}>Menu</Link>
      )}
      <Link className={cartClass} to="/cart" aria-label={`Basket, ${cartCount} items, ${totalLabel}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM6.2 6h14.8l-1.4 7.2a1 1 0 0 1-1 .8H8.5a1 1 0 0 1-1-.9L5.2 3.8A1 1 0 0 0 4.2 3H2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>{totalLabel}</span>
      </Link>
    </nav>
  );
}
