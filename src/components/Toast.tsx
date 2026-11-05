import { useSyncExternalStore } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export type Toast = { id: number; message: string; tone: 'ok' | 'err' };

let toasts: Toast[] = [];
const timers = new Map<number, number>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function pushToast(message: string, tone: Toast['tone'] = 'ok') {
  const toast = { id: Date.now() + Math.random(), message, tone };
  toasts = [...toasts, toast].slice(-3);
  emit();
  const timer = window.setTimeout(() => dismissToast(toast.id), 3400);
  timers.set(toast.id, timer);
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
    <div className="toasts notify-stack" aria-live="polite">
      {items.map((toast) => (
        <div key={toast.id} className="notify-in pointer-events-auto w-full">
          <Alert
            className="w-full min-w-0 bg-white"
            layout="row"
            isNotification
            size="lg"
            variant={toast.tone === 'err' ? 'error' : 'success'}
            icon={toast.tone === 'err'
              ? <CircleAlert size={16} strokeWidth={2} />
              : <CircleCheck size={16} strokeWidth={2} />}
            action={
              <Button
                variant="ghost"
                className="group -my-1.5 -me-2 size-8 p-0 hover:bg-transparent"
                aria-label="Close notification"
                onClick={() => dismissToast(toast.id)}
              >
                <X
                  size={16}
                  strokeWidth={2}
                  className="text-black opacity-100"
                />
              </Button>
            }
          >
            <p className="text-sm font-medium text-foreground">{toast.message}</p>
          </Alert>
        </div>
      ))}
    </div>
  );
}
