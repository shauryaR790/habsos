import { useSyncExternalStore } from 'react';

export type Toast = { id: number; message: string; tone: 'ok' | 'err' };

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function pushToast(message: string, tone: Toast['tone'] = 'ok') {
  const toast = { id: Date.now() + Math.random(), message, tone };
  toasts = [...toasts, toast].slice(-3);
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== toast.id);
    emit();
  }, 3400);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts() {
  return useSyncExternalStore(subscribe, () => toasts);
}

export function ToastHost() {
  const items = useToasts();
  if (!items.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((toast) => (
        <p key={toast.id} className={toast.tone === 'err' ? 'toast err' : 'toast'}>
          {toast.message}
        </p>
      ))}
    </div>
  );
}
