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
        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
          <path
            d="M15 5 8 12l7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {backLabel}
      </Link>
      <h1 className="guest-flow-title">{title}</h1>
    </header>
  );
}
