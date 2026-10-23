import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Bootstrap } from './cart';

export function guestOpenItemPath(itemId: string, tableCode?: string | null) {
  const search = new URLSearchParams();
  if (tableCode) search.set('table', tableCode);
  search.set('item', itemId);
  return `/?${search.toString()}`;
}

export function useGuestMenuItemDeepLink(
  catalog: Bootstrap | null | undefined,
  setSheet: (value: { itemId: string } | null) => void,
) {
  const [params, setSearchParams] = useSearchParams();
  const pendingItemId = params.get('item');

  useEffect(() => {
    if (!pendingItemId || !catalog) return;
    const found = catalog.items.find((item) => item.id === pendingItemId);
    if (found) setSheet({ itemId: found.id });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        return next;
      },
      { replace: true },
    );
  }, [pendingItemId, catalog, setSearchParams, setSheet]);
}
