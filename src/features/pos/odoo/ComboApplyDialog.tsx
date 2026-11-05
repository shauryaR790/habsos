import { formatOdooINR } from '../../../../shared/domain';

export type ComboPack = {
  id: string;
  title: string;
  price: number;
  save: number;
  details: string[];
  addonIds: string[];
};

/** Default Odoo-style combo packs per combo product. */
export const COMBO_PACKS: Record<string, ComboPack[]> = {
  item_burger_combo: [
    {
      id: 'burger_coke',
      title: 'Burger Menu',
      price: 450,
      save: 70,
      details: ['1 x Cheese Burger (Belgian fresh homemade fries)', '1 x Coca-Cola'],
      addonIds: ['addon_combo_cheese', 'addon_combo_coke'],
    },
    {
      id: 'burger_water',
      title: 'Burger Menu',
      price: 450,
      save: 70,
      details: ['1 x Cheese Burger (Belgian fresh homemade fries)', '1 x Spa'],
      addonIds: ['addon_combo_cheese', 'addon_combo_water'],
    },
    {
      id: 'burger_minute',
      title: 'Burger Menu',
      price: 450,
      save: 70,
      details: ['1 x Cheese Burger (Belgian fresh homemade fries)', '1 x Minute Maid'],
      addonIds: ['addon_combo_cheese', 'addon_combo_minute'],
    },
    {
      id: 'burger_shake',
      title: 'Burger Menu',
      price: 490,
      save: 60,
      details: ['1 x Cheese Burger (Belgian fresh homemade fries)', '1 x Milkshake'],
      addonIds: ['addon_combo_cheese', 'addon_combo_milkshake'],
    },
  ],
  item_sushi_combo: [
    {
      id: 'sushi_coke',
      title: 'Sushi Lunch Combo',
      price: 520,
      save: 80,
      details: ['1 x Maki', '1 x Coca-Cola'],
      addonIds: ['addon_combo_cheese', 'addon_combo_coke'],
    },
    {
      id: 'sushi_water',
      title: 'Sushi Lunch Combo',
      price: 520,
      save: 80,
      details: ['1 x Maki', '1 x Spa'],
      addonIds: ['addon_combo_cheese', 'addon_combo_water'],
    },
    {
      id: 'sushi_minute',
      title: 'Sushi Lunch Combo',
      price: 520,
      save: 80,
      details: ['1 x Sashimi Boat', '1 x Minute Maid'],
      addonIds: ['addon_combo_bacon', 'addon_combo_minute'],
    },
    {
      id: 'sushi_shake',
      title: 'Sushi Lunch Combo',
      price: 560,
      save: 70,
      details: ['1 x Salmon and Avocado', '1 x Milkshake'],
      addonIds: ['addon_combo_bacon', 'addon_combo_milkshake'],
    },
  ],
};

export function packsForCombo(menuItemId: string, fallbackTitle: string, fallbackPrice: number): ComboPack[] {
  const known = COMBO_PACKS[menuItemId];
  if (known?.length) return known;
  const drinks = [
    { id: 'coke', label: 'Coca-Cola', addonIds: ['addon_combo_coke'], extra: 0 },
    { id: 'water', label: 'Spa', addonIds: ['addon_combo_water'], extra: 0 },
    { id: 'minute', label: 'Minute Maid', addonIds: ['addon_combo_minute'], extra: 0 },
    { id: 'shake', label: 'Milkshake', addonIds: ['addon_combo_milkshake'], extra: 40 },
  ];
  const saveBase = Math.max(40, Math.round(fallbackPrice * 0.14));
  return drinks.map((drink) => ({
    id: `${menuItemId}_${drink.id}`,
    title: fallbackTitle,
    price: fallbackPrice + drink.extra,
    save: Math.max(20, saveBase - Math.round(drink.extra * 0.25)),
    details: [`1 x Main selection`, `1 x ${drink.label}`],
    addonIds: ['addon_combo_cheese', ...drink.addonIds],
  }));
}

export function ComboApplyDialog({
  title,
  packs,
  onClose,
  onApply,
}: {
  title?: string;
  packs: ComboPack[];
  onClose: () => void;
  onApply: (pack: ComboPack) => void;
}) {
  return (
    <div className="o-modal-backdrop o-combo-backdrop" onClick={onClose} role="presentation">
      <div className="o-modal o-combo-pick" role="dialog" aria-label="Choose a combo to apply" onClick={(e) => e.stopPropagation()}>
        <div className="o-combo-pick__head">
          <h2>{title ?? 'Choose a combo to apply'}</h2>
          <button type="button" className="o-mod__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="o-combo-pick__list">
          {packs.map((pack) => (
            <div key={pack.id} className="o-combo-pick__row">
              <div className="o-combo-pick__info">
                <div className="o-combo-pick__title">
                  {pack.title} {formatOdooINR(pack.price)}
                </div>
                <ul>
                  {pack.details.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </div>
              <div className="o-combo-pick__action">
                <button type="button" className="o-combo-pick__apply" onClick={() => onApply(pack)}>
                  Apply
                </button>
                <span className="o-combo-pick__save">Save {formatOdooINR(pack.save)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
