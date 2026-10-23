import { useCallback, useEffect } from 'react';
import { useTitle } from '../../lib/useTitle';
import { useCart } from './cart';
import { AdGuestHeroNav } from './ad/AdGuestHeroNav';
import { AdMobileShell } from './ad/AdMobileShell';
import { MenuPageMobile } from './MenuPageMobile';

import { GUEST_MENU_SECTION_ID } from './guestLandingConstants';
import { readMenuScroll, saveMenuScroll } from './guestMenuScroll';

export { GUEST_MENU_SECTION_ID };

type Props = {
  /** When opening /menu on mobile, scroll down to the menu block. */
  scrollToMenuOnMount?: boolean;
  /** Persist scroll position while browsing (off when landing is frozen under a drawer). */
  trackScroll?: boolean;
};

export function GuestMobileLanding({ scrollToMenuOnMount = false, trackScroll = true }: Props) {
  useTitle('After Dunes');
  const cart = useCart();

  const scrollToMenu = useCallback(() => {
    document.getElementById(GUEST_MENU_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!scrollToMenuOnMount) return;
    const id = window.requestAnimationFrame(() => scrollToMenu());
    return () => window.cancelAnimationFrame(id);
  }, [scrollToMenuOnMount, scrollToMenu]);

  useEffect(() => {
    if (window.location.hash !== `#${GUEST_MENU_SECTION_ID}`) return;
    const id = window.requestAnimationFrame(() => scrollToMenu());
    return () => window.cancelAnimationFrame(id);
  }, [scrollToMenu]);

  useEffect(() => {
    if (scrollToMenuOnMount || !trackScroll) return;
    const y = readMenuScroll();
    if (y <= 0) return;
    const id = window.requestAnimationFrame(() => window.scrollTo(0, y));
    return () => window.cancelAnimationFrame(id);
  }, [scrollToMenuOnMount, trackScroll]);

  useEffect(() => {
    if (!trackScroll) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        saveMenuScroll();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [trackScroll]);

  return (
    <>
      <AdGuestHeroNav
        cartCount={cart.count}
        tone="hero"
        tableCode={cart.tableCode}
      />
      <div className="ad-app ad-guest-landing ad-guest-page">
      <a className="skip" href={`#${GUEST_MENU_SECTION_ID}`}>Skip to menu</a>
      <section className="ad-hero-panel" aria-label="Welcome">
        <AdMobileShell className="ad-viewport--hero">
          <div className="ad-hero">
            <div className="ad-hero-sky" aria-hidden="true" />
            <div className="ad-hero-copy">
              <p className="ad-hero-kicker">It&apos;s time for</p>
              <h1 className="ad-hero-title">
                <span className="ad-hero-title-row">After Dunes</span>
                <span className="ad-hero-title-line">Coffee Experience</span>
              </h1>
            </div>
            <div className="ad-hero-stage">
              <div className="ad-hero-product">
                <img
                  src="/ad/hero-coffee.png"
                  alt=""
                  width={480}
                  height={640}
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
              <div className="ad-hero-stickers ad-hero-stickers--over-cup" aria-hidden="true">
                <img
                  className="ad-hero-sticker ad-hero-sticker--nametag"
                  src="/ad/hero-sticker-nametag.png"
                  alt=""
                  width={320}
                  height={200}
                  decoding="async"
                />
                <img
                  className="ad-hero-sticker ad-hero-sticker--heart"
                  src="/ad/hero-sticker-heart.png"
                  alt=""
                  width={280}
                  height={280}
                  decoding="async"
                />
              </div>
              <button type="button" className="ad-hero-cta" onClick={scrollToMenu}>
                <span className="ad-hero-cta-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="m10 7 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className="ad-hero-cta-label">Order now</span>
                <span className="ad-hero-cta-hint" aria-hidden="true">&gt;&gt;&gt;</span>
              </button>
            </div>
          </div>
        </AdMobileShell>
      </section>
      <MenuPageMobile landingSection menuSectionId={GUEST_MENU_SECTION_ID} />
    </div>
    </>
  );
}
