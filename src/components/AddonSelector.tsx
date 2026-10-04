import type { AddonGroup } from '../../shared/domain';
import { formatINR } from '../../shared/domain';

export function AddonSelector({
  group,
  selected,
  onToggle,
}: {
  group: AddonGroup;
  selected: string[];
  onToggle: (group: AddonGroup, addonId: string) => void;
}) {
  return (
    <fieldset className="addon-group">
      <legend>
        {group.name}
        <span>{group.maxSelect === 1 ? 'Choose one' : `Up to ${group.maxSelect}`}</span>
      </legend>
      <div className="addon-list">
        {group.addons.map((addon) => {
          const pressed = selected.includes(addon.id);
          return (
            <button
              key={addon.id}
              type="button"
              className="addon-btn"
              aria-pressed={pressed}
              disabled={!addon.isAvailable}
              onClick={() => onToggle(group, addon.id)}
            >
              <span>{addon.name}</span>
              <span className="price">{addon.price > 0 ? `+${formatINR(addon.price)}` : formatINR(0)}</span>
              {!addon.isAvailable ? <span className="badge bad">Sold out</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
