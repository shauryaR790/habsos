import { useEffect, useState } from 'react';
import { GuestMobileLanding } from './GuestMobileLanding';
import { MenuPageClassic } from './MenuPageClassic';

function useDesktopGuest() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

export function MenuPage() {
  const desktop = useDesktopGuest();
  if (desktop) return <MenuPageClassic />;
  return <GuestMobileLanding scrollToMenuOnMount />;
}
