import type { ReactNode } from 'react';

/** Full-width mobile viewport wrapper — not a device mockup. */
export function AdMobileShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ad-viewport${className ? ` ${className}` : ''}`}>{children}</div>;
}
