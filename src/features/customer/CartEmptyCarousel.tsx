import { useMemo } from 'react';
import { formatINR, type MenuItem } from '../../../shared/domain';
import { menuItemImageProps } from './ad/menuItemImage';

export function CartEmptyCarousel({
  items,
  onOpenItem,
  onAddItem,
}: {
  items: MenuItem[];
  onOpenItem: (item: MenuItem) => void;
  onAddItem: (item: MenuItem) => void;
}) {
  const sorted = useMemo(
    () => [...items].filter((item) => item.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  if (!sorted.length) return null;

  const loop = [...sorted, ...sorted];

  return (
    <section className="cart-empty-carousel" aria-label="Pick something from the menu">
      <p className="cart-empty-carousel-kicker">Swipe or tap to add</p>
      <div className="cart-empty-carousel-viewport">
        <div className="cart-empty-carousel-track">
          {loop.map((item, index) => (
            <article key={`${item.id}-${index}`} className="cart-empty-carousel-card">
              <button
                type="button"
                className="cart-empty-carousel-photo"
                onClick={() => onOpenItem(item)}
                aria-label={`View ${item.name}`}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    {...menuItemImageProps(item.id, 'card')}
                  />
                ) : (
                  <span className="cart-empty-carousel-photo-fallback" aria-hidden="true" />
                )}
              </button>
              <div className="cart-empty-carousel-meta">
                <button type="button" className="cart-empty-carousel-name" onClick={() => onOpenItem(item)}>
                  {item.name}
                </button>
                <div className="cart-empty-carousel-foot">
                  <span className="cart-empty-carousel-price">{formatINR(item.price)}</span>
                  <button
                    type="button"
                    className="cart-empty-carousel-add"
                    onClick={() => onAddItem(item)}
                  >
                    Add
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
