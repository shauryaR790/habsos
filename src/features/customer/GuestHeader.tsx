import { Link } from 'react-router-dom';

type Pane = 'drinks' | 'food';

export function GuestHeader({
  brand = 'After Dunes',
  active = 'menu',
  pane,
  onPane,
  search,
  onSearch,
  onScan,
  cartCount,
  showMenuNav = true,
}: {
  brand?: string;
  active?: 'menu' | 'cart' | 'checkout' | 'order';
  pane?: Pane;
  onPane?: (pane: Pane) => void;
  search?: string;
  onSearch?: (value: string) => void;
  onScan?: () => void;
  cartCount: number;
  showMenuNav?: boolean;
}) {
  return (
    <header className="guest-bar">
      <div className="guest-bar-inner">
      <Link className="wordmark guest-brand" to="/menu">{brand}</Link>

      {showMenuNav ? (
        <nav className="guest-nav-desktop" aria-label="Menu sections">
          {onPane ? (
            <button type="button" className={active === 'menu' && pane === 'drinks' ? 'active' : undefined} onClick={() => onPane('drinks')}>
              Drinks
            </button>
          ) : (
            <Link className={active === 'menu' ? 'active' : undefined} to="/menu">Drinks</Link>
          )}
          {onPane ? (
            <button type="button" className={active === 'menu' && pane === 'food' ? 'active' : undefined} onClick={() => onPane('food')}>
              Food
            </button>
          ) : (
            <Link to="/menu">Food</Link>
          )}
          <Link className={active === 'cart' ? 'active' : undefined} to="/cart">Cart</Link>
          {onScan ? (
            <button type="button" className="guest-nav-scan" onClick={onScan}>Scan table</button>
          ) : null}
        </nav>
      ) : (
        <nav className="guest-nav-desktop guest-nav-desktop-short" aria-label="Order">
          <Link className={active === 'menu' ? 'active' : undefined} to="/menu">Menu</Link>
          <Link className={active === 'cart' ? 'active' : undefined} to="/cart">Cart</Link>
          <Link className={active === 'checkout' ? 'active' : undefined} to="/checkout">Checkout</Link>
        </nav>
      )}

      <div className="guest-tools">
        {onSearch ? (
          <label className="guest-search-desktop">
            <span className="sr-only">Search menu</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input
              value={search ?? ''}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Looking for something specific?"
              autoComplete="off"
            />
          </label>
        ) : null}
        <Link className="guest-account" to="/cart" aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
          </svg>
          {cartCount ? <span className="guest-account-badge">{cartCount}</span> : null}
        </Link>
        <Link className="bag-btn guest-bag-mobile" to="/cart" aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}>
          <img src="/ui/cart.png" alt="" />
          {cartCount ? <span>{cartCount}</span> : null}
        </Link>
      </div>
      </div>
    </header>
  );
}
