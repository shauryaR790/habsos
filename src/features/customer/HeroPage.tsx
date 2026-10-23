import { GuestMobileLanding } from './GuestMobileLanding';
import { useGuestDesktop } from './useGuestDesktop';

export function HeroPage() {
  const desktop = useGuestDesktop();
  if (desktop) return null;
  return <GuestMobileLanding />;
}
