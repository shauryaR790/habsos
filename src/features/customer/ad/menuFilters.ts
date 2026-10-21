import type { MenuItem } from '../../../../shared/domain';
import { isColdMenuItem } from '../../../../shared/menuDisplay';

export type MenuChipId = 'all' | 'milk' | 'iced' | 'signature' | 'matcha' | 'desserts';

export const MENU_CHIPS: { id: MenuChipId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'milk', label: 'Coffee with milk' },
  { id: 'iced', label: 'Iced coffee' },
  { id: 'signature', label: 'Signature' },
  { id: 'matcha', label: 'Matcha' },
  { id: 'desserts', label: 'Desserts' },
];

const MILK_RE = /latte|cappuccino|mocha|flat white|cortado|macchiato|hot chocolate|chai|affogato/i;
const FOOD_CATEGORIES = new Set(['cat_canapes', 'cat_appetizers', 'cat_salads', 'cat_sliders', 'cat_mains']);

export function chipHeading(chip: MenuChipId): string {
  return MENU_CHIPS.find((entry) => entry.id === chip)?.label ?? 'Menu';
}

export function filterByChip(items: MenuItem[], chip: MenuChipId, signatureIds: string[]): MenuItem[] {
  const available = items.filter((item) => item.isAvailable);
  switch (chip) {
    case 'all':
      return available.filter((item) => item.categoryId === 'cat_drinks');
    case 'milk':
      return available.filter(
        (item) =>
          item.categoryId === 'cat_drinks'
          && (MILK_RE.test(item.name) || item.ingredients.includes('milk')),
      );
    case 'iced':
      return available.filter((item) => item.categoryId === 'cat_drinks' && isColdMenuItem(item));
    case 'signature':
      return available.filter((item) => signatureIds.includes(item.id));
    case 'matcha':
      return available.filter((item) => /matcha/i.test(item.name) || item.id.includes('matcha'));
    case 'desserts':
      return available.filter((item) => FOOD_CATEGORIES.has(item.categoryId));
    default:
      return available;
  }
}

export function productSubtitle(item: MenuItem, kcal?: string): string {
  if (kcal?.trim()) return kcal.trim();
  if (item.kcalLabel?.trim()) return item.kcalLabel.trim();
  if (item.categoryId === 'cat_drinks') return '350 ml';
  return '';
}
