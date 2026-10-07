import { useEffect, useRef, type ReactNode } from 'react';
import { acquireScrollLock } from '../lib/scrollLock';
import { Button } from './Button';

export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const releaseScroll = acquireScrollLock();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScroll();
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-root">
      <button type="button" className="backdrop" aria-label="Close dialog" onClick={onClose} />
      <div ref={ref} className={className ? `modal ${className}` : 'modal'} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
        <header className="sheet-head">
          <h2 id="modal-title">{title}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </header>
        {children}
      </div>
    </div>
  );
}
