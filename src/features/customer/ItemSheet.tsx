import { useMemo, useState } from 'react';
import { PriceError, priceCart, type AddonGroup, type MenuItem } from '../../../shared/domain';
import { formatINR, taxLabel } from '../../../shared/domain';
import { AddonSelector } from '../../components/AddonSelector';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { TextArea } from '../../components/Input';
import type { Bootstrap } from './cart';

export function ItemSheet({
  item,
  catalog,
  initial,
  onClose,
  onSave,
}: {
  item: MenuItem;
  catalog: Bootstrap;
  initial?: { quantity: number; addonIds: string[]; notes: string };
  onClose: () => void;
  onSave: (value: { quantity: number; addonIds: string[]; notes: string }) => void;
}) {
  const groups = catalog.addonGroups.filter((group) => item.addonGroupIds.includes(group.id));
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [selected, setSelected] = useState<string[]>(initial?.addonIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const preview = useMemo(() => {
    try {
      const quote = priceCart({
        lines: [{ menuItemId: item.id, quantity, addonIds: selected, notes }],
        items: catalog.items,
        groups: catalog.addonGroups,
        taxBps: catalog.cafe.taxBps,
      });
      return { total: quote.lines[0]?.total ?? 0, error: null as string | null };
    } catch (error) {
      return { total: null, error: error instanceof PriceError ? error.message : 'Choose a valid combination.' };
    }
  }, [catalog, item.id, notes, quantity, selected]);

  function toggle(group: AddonGroup, addonId: string) {
    setSelected((current) => {
      const idsInGroup = new Set(group.addons.map((addon) => addon.id));
      const chosen = current.filter((id) => idsInGroup.has(id));
      if (current.includes(addonId)) return current.filter((id) => id !== addonId);
      if (group.maxSelect === 1) return [...current.filter((id) => !idsInGroup.has(id)), addonId];
      if (chosen.length >= group.maxSelect) return current;
      return [...current, addonId];
    });
  }

  return (
    <Drawer open title={item.name} onClose={onClose}>
      <p className="sheet-copy">{item.description}</p>
      <p className="price">{formatINR(item.price)}</p>
      {groups.map((group) => (
        <AddonSelector key={group.id} group={group} selected={selected} onToggle={toggle} />
      ))}
      <TextArea label="Note for the bar" value={notes} maxLength={180} rows={3} onChange={(event) => setNotes(event.target.value)} />
      <div className="stepper" aria-label="Quantity">
        <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
        <span>{quantity}</span>
        <button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Increase quantity">+</button>
      </div>
      {preview.error ? <p className="field-error" role="alert">{preview.error}</p> : null}
      <Button
        full
        disabled={Boolean(preview.error)}
        onClick={() => onSave({ quantity, addonIds: selected, notes: notes.trim() })}
      >
        {initial ? 'Update item' : 'Add to cart'}
        {preview.total !== null ? ` · ${formatINR(preview.total)}` : ''}
      </Button>
      <p className="fine">Tax {taxLabel(catalog.cafe.taxBps)} is added at checkout.</p>
    </Drawer>
  );
}
