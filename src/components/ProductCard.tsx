import type { MenuItem } from '../../shared/domain';
import { formatINR } from '../../shared/domain';
import { menuDisplayFor } from '../../shared/menuDisplay';

export function ProductCard({
  item,
  onSelect,
  compact = false,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${compact ? 'rec-card' : 'sb-card'}${item.isAvailable ? '' : ' sold'}`}
      disabled={!item.isAvailable}
      onClick={() => onSelect(item)}
    >
      {item.imageUrl ? <img className="sb-photo" src={item.imageUrl} alt="" loading="lazy" /> : <span className="sb-photo" />}
      <span className="sb-copy">
        {compact ? null : <span className={item.isVeg ? 'mark veg' : 'mark nonveg'} aria-label={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'} />}
        <span className="sb-name">{item.name}</span>
        {item.isAvailable ? <span className="sb-meta">{menuDisplayFor(item)?.kcal || item.kcalLabel || item.description}</span> : <span className="sb-meta">Currently not available</span>}
        <span className="sb-price">{formatINR(item.price)}</span>
      </span>
      {item.isAvailable ? <span className="sb-plus" aria-hidden="true">+</span> : null}
    </button>
  );
}
