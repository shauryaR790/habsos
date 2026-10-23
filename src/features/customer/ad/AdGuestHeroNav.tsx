import { Link, useLocation } from 'react-router-dom';
import { saveMenuScroll } from '../guestMenuScroll';

export type AdGuestNavActive = 'home' | 'menu' | 'cart';

export function AdGuestHeroNav({
  cartCount,
  active,
  tone = 'hero',
  tableCode,
}: {
  cartCount: number;
  active?: AdGuestNavActive;
  tone?: 'hero' | 'surface';
  tableCode?: string | null;
}) {
  const { pathname } = useLocation();
  const tableQ = tableCode ? `?table=${encodeURIComponent(tableCode)}` : '';
  const homeHref = tableCode ? `/?table=${encodeURIComponent(tableCode)}` : '/';
  const menuHref = `/menu${tableQ}`;

  let resolvedActive = active;
  if (!resolvedActive) {
    if (pathname === '/') resolvedActive = 'home';
    else if (pathname.startsWith('/menu')) resolvedActive = 'menu';
    else if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) resolvedActive = 'cart';
  }

  const linkClass = (key: AdGuestNavActive) =>
    `ad-guest-hero-nav-link${resolvedActive === key ? ' is-active' : ''}`;

  return (
    <header className={`ad-guest-hero-nav ad-guest-hero-nav--${tone}`} aria-label="Site">
      <Link className="ad-guest-hero-nav-brand" to={homeHref}>
        After Dunes
      </Link>
      <nav className="ad-guest-hero-nav-links" aria-label="Primary">
        <Link to={homeHref} className={linkClass('home')}>
          Home
        </Link>
        <Link to={menuHref} className={linkClass('menu')}>
          Menu
        </Link>
        <Link to="/cart" className={linkClass('cart')} onClick={() => saveMenuScroll()}>
          Cart{cartCount > 0 ? ` (${cartCount})` : ''}
        </Link>
      </nav>
    </header>
  );
}
