import { useMemo, useState } from 'react';
import {
  LINE_NOTE_MAX,
  LINE_QTY_MAX,
  LINE_QTY_MIN,
  PriceError,
  clampLineQuantity,
  formatINR,
  priceCart,
  type AddonGroup,
  type MenuItem,
} from '../../../shared/domain';
import { Button } from '../../components/Button';
import { TextArea } from '../../components/Input';
import { Modal } from '../../components/Modal';

export function ModifierDialog({
  item,
  groups,
  taxBps,
  initial,
  onClose,
  onSave,
}: {
  item: MenuItem;
  groups: AddonGroup[];
  taxBps: number;
  initial?: { quantity: number; addonIds: string[]; notes: string };
  onClose: () => void;
  onSave: (value: { quantity: number; addonIds: string[]; notes: string }) => void;
}) {
  const linked = groups.filter((group) => item.addonGroupIds.includes(group.id));
  const [quantity, setQuantity] = useState(() => clampLineQuantity(initial?.quantity ?? 1));
  const [selected, setSelected] = useState<string[]>(() => initial?.addonIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const preview = useMemo(() => {
    try {
      const quote = priceCart({
        lines: [{ menuItemId: item.id, quantity, addonIds: selected, notes }],
        items: [item],
        groups,
        taxBps,
      });
      return { total: quote.lines[0]?.total ?? 0, error: null as string | null };
    } catch (error) {
      return { total: null, error: error instanceof PriceError ? error.message : 'Choose a valid combination.' };
    }
  }, [groups, item, notes, quantity, selected, taxBps]);

  function pick(group: AddonGroup, addonId: string | null) {
    const ids = new Set(group.addons.map((addon) => addon.id));
    setSelected((current) => {
      const rest = current.filter((id) => !ids.has(id));
      if (!addonId) return rest;
      if (group.maxSelect === 1) return [...rest, addonId];
      if (current.includes(addonId)) return current.filter((id) => id !== addonId);
      const count = current.filter((id) => ids.has(id)).length;
      if (count >= group.maxSelect) return current;
      return [...current, addonId];
    });
  }

  function setExactQty(value: number) {
    setQuantity(clampLineQuantity(value));
  }

  return (
    <Modal open className="mod-dialog" title={item.name} onClose={onClose}>
      <div className="mod">
        <p className="mod-meta">
          <span className={item.isVeg ? 'mod-diet veg' : 'mod-diet nveg'} />
          {formatINR(item.price)}
          {item.shortcutNum || item.shortcutAlpha ? (
            <em>{[item.shortcutNum, item.shortcutAlpha].filter(Boolean).join(' · ')}</em>
          ) : null}
        </p>

        <div className="mod-qty">
          <span>Quantity</span>
          <span className="bill-qty">
            <button type="button" onClick={() => setExactQty(quantity - 1)} aria-label="Decrease quantity">−</button>
            <input
              aria-label="Quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                const raw = event.target.value.replace(/\D/g, '');
                if (raw === '') return;
                setExactQty(Number(raw));
              }}
            />
            <button type="button" onClick={() => setExactQty(quantity + 1)} aria-label="Increase quantity">+</button>
          </span>
          <small>{LINE_QTY_MIN}–{LINE_QTY_MAX}</small>
        </div>

        {linked.map((group) => {
          const chosen = group.addons.filter((addon) => selected.includes(addon.id));
          const none = chosen.length === 0;
          return (
            <section key={group.id} className="mod-group">
              <header>
                <h3>{group.name}</h3>
                <span>{groupHint(group)}</span>
              </header>
              <div className="mod-opts">
                {group.maxSelect === 1 ? (
                  <button type="button" className={none ? 'on' : ''} aria-pressed={none} onClick={() => pick(group, null)}>
                    <strong>{group.id.includes('milk') ? 'Cafe milk' : 'Regular'}</strong>
                    <em>{formatINR(0)}</em>
                  </button>
                ) : null}
                {group.addons.map((addon) => {
                  const on = selected.includes(addon.id);
                  const blocked = group.maxSelect > 1 && !on && chosen.length >= group.maxSelect;
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      className={on ? 'on' : ''}
                      aria-pressed={on}
                      disabled={!addon.isAvailable || blocked}
                      onClick={() => pick(group, addon.id)}
                    >
                      <strong>{addon.name}</strong>
                      <em>{addon.price ? `+${formatINR(addon.price)}` : formatINR(0)}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <TextArea
          label="Item comment"
          value={notes}
          maxLength={LINE_NOTE_MAX}
          rows={2}
          onChange={(event) => setNotes(event.target.value.slice(0, LINE_NOTE_MAX))}
        />
        {preview.error ? <p className="field-error" role="alert">{preview.error}</p> : null}
        <div className="mod-foot">
          <strong>{preview.total === null ? formatINR(item.price * quantity) : formatINR(preview.total)}</strong>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={Boolean(preview.error)} onClick={() => onSave({ quantity, addonIds: selected, notes: notes.trim() })}>
            {initial ? 'Update' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function groupHint(group: AddonGroup) {
  if (group.minSelect === 0 && group.maxSelect === 1) return 'Optional · one';
  if (group.minSelect === 0) return `Optional · up to ${group.maxSelect}`;
  if (group.minSelect === group.maxSelect) return `Choose ${group.minSelect}`;
  return `Choose ${group.minSelect}–${group.maxSelect}`;
}
