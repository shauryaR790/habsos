import type { RefObject } from 'react';

export function AdMenuHeader({
  searchRef,
  search,
  onSearch,
  searchOpen,
  onSearchOpen,
}: {
  searchRef: RefObject<HTMLInputElement | null>;
  search: string;
  onSearch: (value: string) => void;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
}) {
  return (
    <header className={`ad-menu-header${searchOpen ? ' is-search-open' : ' is-collapsed'}`}>
      <input
        ref={searchRef}
        type="search"
        className={`ad-menu-search${searchOpen ? ' is-open' : ''}`}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        onBlur={() => {
          if (!search.trim()) onSearchOpen(false);
        }}
        placeholder="Search menu"
        aria-label="Search menu"
      />
    </header>
  );
}
