import type { MenuChipId } from './menuFilters';
import { MENU_CHIPS } from './menuFilters';

export function AdCategoryChips({
  active,
  onChange,
  onSearchToggle,
  favoritesOnly,
  onFavoritesToggle,
}: {
  active: MenuChipId;
  onChange: (chip: MenuChipId) => void;
  onSearchToggle: () => void;
  favoritesOnly: boolean;
  onFavoritesToggle: () => void;
}) {
  return (
    <div className="ad-chips-wrap">
      <div className="ad-chips" role="tablist" aria-label="Categories">
        <button type="button" className="ad-chip ad-chip--icon" onClick={onSearchToggle} aria-label="Search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <button
          type="button"
          className={`ad-chip ad-chip--icon${favoritesOnly ? ' is-on' : ''}`}
          onClick={onFavoritesToggle}
          aria-label="Favorites"
          aria-pressed={favoritesOnly}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.5 12.8a5.5 5.5 0 0 1 8-7.3 5.5 5.5 0 0 1 8 7.3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
        </button>
        {MENU_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active === chip.id}
            className={`ad-chip${active === chip.id ? ' is-active' : ''}`}
            onClick={() => onChange(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
