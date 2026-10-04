import type { MenuItem } from '../../shared/domain';
import { formatINR } from '../../shared/domain';
import { Button } from './Button';

export function ProductCard({ item, onSelect }: { item: MenuItem; onSelect: (item: MenuItem) => void }) {
  return (
    <article className={item.isAvailable ? 'product' : 'product sold'}>
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
      <div className="product-top">
        <span className={item.isVeg ? 'veg' : 'veg nonveg'}>
          <i />
          {item.isVeg ? 'Veg' : 'Non-veg'}
        </span>
        {!item.isAvailable ? <span className="badge bad">Sold out</span> : null}
      </div>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <div className="product-foot">
        <span className="price">{formatINR(item.price)}</span>
        <Button disabled={!item.isAvailable} onClick={() => onSelect(item)}>
          {item.isAvailable ? 'Add' : 'Sold out'}
        </Button>
      </div>
    </article>
  );
}
