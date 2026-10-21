import type { CSSProperties } from 'react';

/** Items whose PNGs have large transparent padding — scale up per surface. */
const ZOOM: Record<string, { card: number; hero: number }> = {
  item_sparkling: { card: 1.55, hero: 1.9 },
};

export function menuItemImageProps(itemId: string, surface: 'card' | 'hero') {
  const entry = ZOOM[itemId];
  if (!entry) return { className: undefined as string | undefined, style: undefined as CSSProperties | undefined };
  const scale = surface === 'hero' ? entry.hero : entry.card;
  return {
    className: 'menu-item-img--zoom',
    style: { '--menu-item-img-zoom': scale } as CSSProperties,
  };
}
