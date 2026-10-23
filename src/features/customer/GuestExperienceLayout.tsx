import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GuestFlowOutlet } from './GuestFlowOutlet';
import { GuestMobileLanding } from './GuestMobileLanding';
import { readMenuScroll } from './guestMenuScroll';
import { useGuestDesktop } from './useGuestDesktop';

type GuestScrollState = { preserveScroll?: boolean };

/** Desktop: keep the real landing mounted under cart/checkout drawers (no duplicate backdrop). */
export function GuestExperienceLayout() {
  const desktop = useGuestDesktop();
  const { pathname, state } = useLocation();
  const drawer = desktop && (pathname === '/cart' || pathname === '/checkout');
  const onLanding = pathname === '/' || pathname === '/menu';
  const preserveScroll = Boolean((state as GuestScrollState | null)?.preserveScroll);

  useLayoutEffect(() => {
    if (!desktop || drawer) return;
    const y = readMenuScroll();
    if (y > 0) window.scrollTo(0, y);
  }, [desktop, drawer]);

  if (!desktop) {
    return <GuestFlowOutlet />;
  }

  if (!onLanding && !drawer) {
    return <GuestFlowOutlet />;
  }

  const scrollToMenuOnMount = pathname === '/menu' && !drawer && !preserveScroll;

  return (
    <>
      <div
        className={`ad-guest-landing-persist${drawer ? ' ad-guest-landing-persist--frozen ad-guest-landing-persist--drawer-open' : ''}`}
        style={
          drawer
            ? { ['--ad-menu-backdrop-scroll' as string]: `${readMenuScroll()}px` }
            : undefined
        }
      >
        <div className={drawer ? 'ad-guest-landing-persist-shift' : undefined}>
          <GuestMobileLanding scrollToMenuOnMount={scrollToMenuOnMount} trackScroll={!drawer} />
        </div>
      </div>
      {drawer ? <GuestFlowOutlet /> : null}
    </>
  );
}
