import { Link } from 'react-router-dom';
import { saveMenuScroll } from './guestMenuScroll';
import { useGuestDesktop } from './useGuestDesktop';

export function GuestFlowHeader({
  title,
  backTo,
  backLabel = 'Back',
}: {
  title: string;
  backTo: string;
  backLabel?: string;
}) {
  const desktop = useGuestDesktop();
  if (desktop) return null;

  return (
    <header className="guest-flow-head">
      <Link
        className="guest-flow-back"
        to={backTo}
        onClick={() => saveMenuScroll()}
      >
        ‹ {backLabel}
      </Link>
      <h1 className="guest-flow-title">{title}</h1>
    </header>
  );
}
