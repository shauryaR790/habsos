import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · After Dunes`;
  }, [title]);
}
