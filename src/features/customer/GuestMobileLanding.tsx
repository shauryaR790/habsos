import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTitle } from '../../lib/useTitle';
import { AdMobileShell } from './ad/AdMobileShell';
import { MenuPageMobile } from './MenuPageMobile';

export const GUEST_MENU_SECTION_ID = 'order-menu';

type Props = {
  /** When opening /menu on mobile, scroll down to the menu block. */
  scrollToMenuOnMount?: boolean;
};

export function GuestMobileLanding({ scrollToMenuOnMount = false }: Props) {
  useTitle('After Dunes');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const table = params.get('table');
  const menuTo = table ? `/menu?table=${encodeURIComponent(table)}` : '/menu';

  const scrollToMenu = useCallback(() => {
    document.getElementById(GUEST_MENU_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    if (mq.matches) navigate(menuTo, { replace: true });
    const onChange = () => {
      if (mq.matches) navigate(menuTo, { replace: true });
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [menuTo, navigate]);

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

  return (
    <div className="ad-app ad-guest-landing">
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
      <div className="ad-hero-menu-chequer" aria-hidden="true" />
      <MenuPageMobile landingSection menuSectionId={GUEST_MENU_SECTION_ID} />
    </div>
  );
}
