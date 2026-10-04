import { formatINR } from '../../shared/domain';
import { Button } from './Button';

export type DisplayLine = {
  lineId: string;
  name: string;
  quantity: number;
  notes: string;
  addons: { name: string; price: number }[];
  total: number | null;
  error?: string;
};

export function CartItem({
  line,
  onInc,
  onDec,
  onRemove,
  onEdit,
}: {
  line: DisplayLine;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="cart-line">
      <header>
        <h3>{line.name}</h3>
        <strong className="price">{line.total === null ? '—' : formatINR(line.total)}</strong>
      </header>
      {line.addons.length ? (
        <ul>
          {line.addons.map((addon) => (
            <li key={addon.name}>{addon.name}</li>
          ))}
        </ul>
      ) : null}
      {line.notes ? <p className="note">Note: {line.notes}</p> : null}
      {line.error ? <p className="field-error">{line.error}</p> : null}
      <div className="line-actions">
        <div className="stepper" aria-label={`Quantity for ${line.name}`}>
          <button type="button" onClick={onDec} aria-label="Decrease quantity">−</button>
          <span>{line.quantity}</span>
          <button type="button" onClick={onInc} aria-label="Increase quantity">+</button>
        </div>
        <Button variant="ghost" onClick={onEdit}>Edit</Button>
        <Button variant="danger" onClick={onRemove}>Remove</Button>
      </div>
    </article>
  );
}
