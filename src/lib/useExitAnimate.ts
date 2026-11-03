import { useCallback, useState } from 'react';

/** Mark ids as leaving, then remove after the exit animation finishes. */
export function useExitAnimate(ms = 280) {
  const [leaving, setLeaving] = useState<Record<string, true>>({});

  const requestRemove = useCallback((id: string, remove: () => void) => {
    setLeaving((current) => (current[id] ? current : { ...current, [id]: true }));
    window.setTimeout(() => {
      remove();
      setLeaving((current) => {
        if (!current[id]) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, ms);
  }, [ms]);

  return { leaving, requestRemove };
}
