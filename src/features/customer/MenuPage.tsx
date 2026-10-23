import { GuestMobileLanding } from './GuestMobileLanding';
import { useGuestDesktop } from './useGuestDesktop';

export function MenuPage() {
  const desktop = useGuestDesktop();
  if (desktop) return null;
  return <GuestMobileLanding scrollToMenuOnMount />;
}
