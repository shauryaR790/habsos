import { formatINR } from '../../shared/domain';

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
  imageUrl,
  onInc,
  onDec,
  onRemove,
  onEdit,
}: {
  line: DisplayLine;
  imageUrl?: string | null;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="cart-row">
      {imageUrl ? <img className="cart-shot" src={imageUrl} alt="" /> : <span className="cart-shot" />}
      <div className="cart-copy">
        <h3>{line.name}</h3>
        {line.addons.length ? <p>{line.addons.map((addon) => addon.name).join(' · ')}</p> : null}
        {line.notes ? <p className="cart-note">Note: {line.notes}</p> : null}
        {line.error ? <p className="field-error">{line.error}</p> : null}
        <button type="button" className="cart-edit" onClick={onEdit}>Edit</button>
      </div>
      <div className="cart-side">
        <strong>{line.total === null ? '—' : formatINR(line.total)}</strong>
        <div className="qty-step" aria-label={`Quantity for ${line.name}`}>
          <button type="button" onClick={onDec} aria-label="Decrease quantity">−</button>
          <span>{line.quantity}</span>
          <button type="button" onClick={onInc} aria-label="Increase quantity">+</button>
        </div>
        <button type="button" className="cart-remove" onClick={onRemove}>Remove</button>
      </div>
    </article>
  );
}
