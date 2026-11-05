import { useMemo, useState } from 'react';
import {
  LINE_NOTE_MAX,
  PriceError,
  clampLineQuantity,
  formatOdooINR,
  priceCart,
  type AddonGroup,
  type MenuItem,
} from '../../../shared/domain';

const ACCENT_BY_NAME: Record<string, string> = {
  'Cheese Burger': '#e83e8c',
  'Bacon Burger': '#fd7e14',
  'Coca-Cola': '#20c997',
  Spa: '#0d6efd',
  'Minute Maid': '#20c997',
  Milkshake: '#20c997',
  Espresso: '#20c997',
  'Green Tea': '#0dcaf0',
  Fanta: '#fd7e14',
};

function optionAccent(name: string, index: number, drinkish: boolean) {
  if (ACCENT_BY_NAME[name]) return ACCENT_BY_NAME[name];
  if (drinkish) {
    const drinks = ['#20c997', '#0d6efd', '#20c997', '#0dcaf0', '#fd7e14'];
    return drinks[index % drinks.length];
  }
  const food = ['#e83e8c', '#fd7e14', '#ffc107', '#e83e8c', '#6f42c1'];
  return food[index % food.length];
}

function isCardGroup(group: AddonGroup) {
  return /combo|burger|drink|roll|sushi/i.test(group.id) || /burger|drink|roll|sushi/i.test(group.name);
}

function groupIncludedLabel(group: AddonGroup) {
  if (group.minSelect === group.maxSelect && group.minSelect > 0) {
    return `${group.minSelect} included`;
  }
  if (group.minSelect === 0 && group.maxSelect === 1) return 'optional';
  if (group.minSelect === 0) return `up to ${group.maxSelect}`;
  return `choose ${group.minSelect}–${group.maxSelect}`;
}

function defaultSelection(groups: AddonGroup[], initial?: string[]) {
  if (initial?.length) return initial;
  const picked: string[] = [];
  for (const group of groups) {
    if (group.minSelect <= 0) continue;
    const available = group.addons.filter((a) => a.isAvailable);
    for (let i = 0; i < Math.min(group.minSelect, available.length); i += 1) {
      picked.push(available[i].id);
    }
  }
  return picked;
}

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
  const linked = useMemo(
    () => groups.filter((group) => item.addonGroupIds.includes(group.id)).sort((a, b) => a.sortOrder - b.sortOrder),
    [groups, item.addonGroupIds],
  );
  const comboLayout = /combo/i.test(item.name) || linked.some(isCardGroup);
  const [quantity] = useState(() => clampLineQuantity(initial?.quantity ?? 1));
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(linked, initial?.addonIds));
  const [notes] = useState(initial?.notes ?? '');

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

  function pick(group: AddonGroup, addonId: string) {
    const ids = new Set(group.addons.map((addon) => addon.id));
    setSelected((current) => {
      const rest = current.filter((id) => !ids.has(id));
      if (group.maxSelect === 1) {
        if (current.includes(addonId) && group.minSelect === 0) return rest;
        return [...rest, addonId];
      }
      if (current.includes(addonId)) return current.filter((id) => id !== addonId);
      const count = current.filter((id) => ids.has(id)).length;
      if (count >= group.maxSelect) return current;
      return [...current, addonId];
    });
  }

  const title = comboLayout
    ? item.name
    : `${item.name} | ${formatOdooINR(item.price)}`;

  return (
    <div className="o-modal-backdrop o-mod-backdrop" onClick={onClose} role="presentation">
      <div
        className={`o-modal o-mod${comboLayout ? ' o-mod--combo' : ''}`}
        role="dialog"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="o-mod__head">
          <h2>{title}</h2>
          <button type="button" className="o-mod__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="o-mod__body">
          {linked.map((group) => {
            const chosen = group.addons.filter((addon) => selected.includes(addon.id));
            const cards = comboLayout || isCardGroup(group);
            const drinkish = /drink/i.test(group.name) || /drink/i.test(group.id);
            return (
              <section key={group.id} className="o-mod__section">
                <header className="o-mod__section-head">
                  <h3>{group.name}</h3>
                  {cards ? <em>{groupIncludedLabel(group)}</em> : null}
                </header>
                <div className={cards ? 'o-mod__cards' : 'o-mod__pills'}>
                  {group.addons.map((addon, index) => {
                    const on = selected.includes(addon.id);
                    const blocked = group.maxSelect > 1 && !on && chosen.length >= group.maxSelect;
                    if (cards) {
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          className={`o-mod__card${on ? ' is-on' : ''}`}
                          style={{ borderBottomColor: optionAccent(addon.name, index, drinkish) }}
                          aria-pressed={on}
                          disabled={!addon.isAvailable || blocked}
                          onClick={() => pick(group, addon.id)}
                        >
                          <span className="o-mod__card-name">{addon.name}</span>
                          {addon.price > 0 ? (
                            <span className="o-mod__badge">+ {formatOdooINR(addon.price)}</span>
                          ) : null}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        className={`o-mod__pill${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        disabled={!addon.isAvailable || blocked}
                        onClick={() => pick(group, addon.id)}
                      >
                        {addon.name}
                        {addon.price > 0 ? ` (+${formatOdooINR(addon.price)})` : ''}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {!linked.length ? (
            <p className="o-mod__empty">No customizations for this item.</p>
          ) : null}

          {preview.error ? <p className="o-mod__error" role="alert">{preview.error}</p> : null}
        </div>

        <div className={`o-mod__foot${comboLayout ? ' o-mod__foot--combo' : ''}`}>
          {comboLayout ? (
            <>
              <button
                type="button"
                className="o-mod__add"
                disabled={Boolean(preview.error)}
                onClick={() => onSave({ quantity, addonIds: selected, notes: notes.trim().slice(0, LINE_NOTE_MAX) })}
              >
                {initial ? 'Update order' : 'Add to order'}
              </button>
              <strong className="o-mod__total">
                Total: {preview.total === null ? formatOdooINR(item.price * quantity) : formatOdooINR(preview.total)}
              </strong>
            </>
          ) : (
            <>
              <button
                type="button"
                className="o-mod__add"
                disabled={Boolean(preview.error)}
                onClick={() => onSave({ quantity, addonIds: selected, notes: notes.trim().slice(0, LINE_NOTE_MAX) })}
              >
                {initial ? 'Update' : 'Add'}
              </button>
              <button type="button" className="o-mod__discard" onClick={onClose}>
                Discard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
