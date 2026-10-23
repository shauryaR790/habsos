import type { ReactNode } from 'react';
import { useCart } from './cart';
import { AdGuestHeroNav, type AdGuestNavActive } from './ad/AdGuestHeroNav';

export function GuestPageChrome({
  children,
  active,
  tone = 'surface',
}: {
  children: ReactNode;
  active?: AdGuestNavActive;
  /** Hero = light links on transparent bar; surface = sand bar (cart, checkout). */
  tone?: 'hero' | 'surface';
}) {
  const cart = useCart();
  return (
    <>
      <AdGuestHeroNav
        cartCount={cart.count}
        active={active}
        tone={tone}
        tableCode={cart.tableCode}
      />
      <div className={`ad-guest-page${tone === 'hero' ? ' ad-guest-page--hero-tone' : ''}`}>{children}</div>
    </>
  );
}
