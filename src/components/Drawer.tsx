import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  chrome = true,
  className = '',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  chrome?: boolean;
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
    document.body.classList.add('lock-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('lock-scroll');
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`drawer-root ${className}`.trim()}>
      <button type="button" className="backdrop" aria-label="Close" onClick={onClose} />
      <div ref={ref} className={`drawer ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1}>
        {chrome ? (
          <header className="sheet-head">
            <h2 id="drawer-title">{title}</h2>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </header>
        ) : (
          <h2 id="drawer-title" className="sr-only">{title}</h2>
        )}
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
