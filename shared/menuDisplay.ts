import type { MenuItem } from './domain';
import { DRINKS_CATEGORY_ID } from './domain';

export const INGREDIENT_IDS = [
  'milk',
  'soy',
  'wheat',
  'coffee',
  'cocoa',
  'egg',
  'tea',
  'potato',
  'cheese',
  'tomato',
  'butter',
  'mint',
  'chilli',
  'paneer',
] as const;

export type IngredientId = (typeof INGREDIENT_IDS)[number];

export type MenuDisplay = {
  lead: string;
  titled: string;
  kcal: string;
  ingredients: IngredientId[];
};

export const INGREDIENT_LABELS: Record<IngredientId, string> = {
  milk: 'Milk',
  soy: 'Soy',
  wheat: 'Wheat',
  coffee: 'Coffee',
  cocoa: 'Cocoa',
  egg: 'Egg',
  tea: 'Tea',
  potato: 'Potato',
  cheese: 'Cheese',
  tomato: 'Tomato',
  butter: 'Butter',
  mint: 'Mint',
  chilli: 'Chilli',
  paneer: 'Paneer',
};

/** Built-in catalog copy until each item is edited in POS Menu. */
export const LEGACY_MENU_DISPLAY: Record<string, MenuDisplay> = {
  item_moroccan: { lead: 'BLENDED', titled: 'Moroccan Avocado Smoothie', kcal: '210 kcal', ingredients: ['milk'] },
  item_berry: { lead: 'BLENDED', titled: 'Berry Blast Shake', kcal: '185 kcal', ingredients: ['milk'] },
  item_nutella: { lead: 'HOT', titled: 'Nutella Hot Chocolate', kcal: '180 kcal', ingredients: ['milk', 'cocoa'] },
  item_hazelnut: { lead: 'HOT', titled: 'Hazelnut Hot Chocolate', kcal: '180 kcal', ingredients: ['milk', 'cocoa'] },
  item_peach: { lead: 'ICED', titled: 'Peach Ice Tea', kcal: '120 kcal', ingredients: ['tea'] },
  item_affogato: { lead: 'CUP', titled: 'Affogato', kcal: '223 kcal', ingredients: ['coffee', 'milk'] },
  item_mint_latte: { lead: 'HOT', titled: 'Mint Latte', kcal: '231 kcal', ingredients: ['coffee', 'milk', 'mint'] },
  item_americano: { lead: 'HOT', titled: 'Cafe Americano', kcal: '25 kcal', ingredients: ['coffee'] },
  item_filter: { lead: 'HOT', titled: 'Filter Coffee', kcal: '28 kcal', ingredients: ['coffee'] },
  item_cardamom: { lead: 'CUP', titled: 'Cardamom Tea', kcal: '92 kcal', ingredients: ['tea', 'milk'] },
  item_ginger_tea: { lead: 'CUP', titled: 'Ginger Tea', kcal: '92 kcal', ingredients: ['tea'] },
  item_espresso: { lead: 'SHORT', titled: 'Classic Espresso', kcal: '5 kcal', ingredients: ['coffee'] },
  item_long_black: { lead: 'LONG', titled: 'Long Black', kcal: '10 kcal', ingredients: ['coffee'] },
  item_cappuccino: { lead: 'CUP', titled: 'Cappuccino', kcal: '120 kcal', ingredients: ['milk', 'coffee'] },
  item_cap_alt: { lead: 'CUP', titled: 'Cappuccino with Almond or Oat', kcal: '90–140 kcal', ingredients: ['milk', 'coffee'] },
  item_latte: { lead: 'CUP', titled: 'Cafe Latte', kcal: '150 kcal', ingredients: ['milk', 'coffee'] },
  item_flat_white: { lead: 'CUP', titled: 'Flat White', kcal: '140 kcal', ingredients: ['milk', 'coffee'] },
  item_cortado: { lead: 'SHORT', titled: 'Spanish Cortado', kcal: '80 kcal', ingredients: ['coffee', 'milk'] },
  item_mocha: { lead: 'CUP', titled: 'Chocolate Mocha', kcal: '220 kcal', ingredients: ['milk', 'cocoa', 'coffee'] },
  item_cold_brew: { lead: 'ICED', titled: 'Cold Brew', kcal: '5 kcal', ingredients: ['coffee'] },
  item_citrus_brew: { lead: 'ICED', titled: 'Citrus Cold Brew', kcal: '40–90 kcal', ingredients: ['coffee'] },
  item_saigon: { lead: 'ICED', titled: 'Saigon Cold Brew', kcal: '60 kcal', ingredients: ['coffee', 'milk'] },
  item_red_john: { lead: 'ICED', titled: 'Red John', kcal: '90 kcal', ingredients: ['coffee'] },
  item_sparkling: { lead: 'ICED', titled: 'Sparkling Espresso', kcal: '180 kcal', ingredients: ['coffee'] },
  item_tonic: { lead: 'ICED', titled: 'Cold Brew Tonic / Ginger Ale', kcal: '40–90 kcal', ingredients: ['coffee'] },
  item_iced_americano: { lead: 'ICED', titled: 'Iced Americano', kcal: '10 kcal', ingredients: ['coffee'] },
  item_halloumi: { lead: 'SWEET', titled: 'Strawberry Waffle', kcal: '310 kcal', ingredients: ['wheat', 'butter'] },
  item_avocado_toast: { lead: 'SWEET', titled: 'Butter Pancakes', kcal: '350 kcal', ingredients: ['wheat', 'butter', 'egg'] },
  item_bruschetta: { lead: 'BOARD', titled: 'Bruschetta Board', kcal: '130 kcal', ingredients: ['wheat', 'tomato'] },
  item_karak_toast: { lead: 'TOAST', titled: 'Karak Chai Toast', kcal: '350 kcal', ingredients: ['wheat', 'tea', 'milk'] },
  item_kebab: { lead: 'SKEWER', titled: 'Gillafi Dahike Kebab', kcal: '220 kcal', ingredients: ['milk'] },
  item_mezze: { lead: 'PLATE', titled: 'Mezze Platter', kcal: '310 kcal', ingredients: ['wheat', 'tomato'] },
  item_quesadilla: { lead: 'FOLDED', titled: 'Mexican Quesadilla', kcal: '320 kcal', ingredients: ['wheat', 'cheese'] },
  item_cheese_balls: { lead: 'FRIED', titled: 'Jalapeño Cheese Balls', kcal: '190 kcal', ingredients: ['cheese', 'wheat'] },
  item_healthy_bowl: { lead: 'BOWL', titled: 'Healthy Bowl', kcal: '320 kcal', ingredients: ['tomato'] },
  item_house_salad: { lead: 'BOWL', titled: 'House Salad', kcal: '170 kcal', ingredients: ['tomato'] },
  item_harvest: { lead: 'SLIDER', titled: 'Green Harvest Burger', kcal: '180 kcal', ingredients: ['wheat', 'tomato'] },
  item_veg_club: { lead: 'STACKED', titled: 'Veg Club Sandwich', kcal: '200 kcal', ingredients: ['wheat', 'cheese', 'tomato'] },
  item_cheddar: { lead: 'BAKED', titled: 'Chocolate Chunk Cookies', kcal: '220 kcal', ingredients: ['wheat', 'butter'] },
  item_bombay: { lead: 'STACKED', titled: 'Bombay Club Sandwich', kcal: '190 kcal', ingredients: ['wheat', 'cheese', 'tomato'] },
  item_penne: { lead: 'PASTA', titled: 'Penne Creme Pesto', kcal: '340 kcal', ingredients: ['wheat', 'cheese'] },
  item_spaghetti: { lead: 'PASTA', titled: 'Spaghetti Aglio e Olio', kcal: '280 kcal', ingredients: ['wheat', 'chilli'] },
  item_risotto: { lead: 'RICE', titled: 'Saffron Risotto', kcal: '330 kcal', ingredients: ['cheese'] },
  item_paneer: { lead: 'GRILL', titled: 'Marinated Grill Cottage Cheese', kcal: '380 kcal', ingredients: ['paneer'] },
};

const LEGACY_COLD_IDS = new Set([
  'item_moroccan',
  'item_berry',
  'item_peach',
  'item_affogato',
  'item_cold_brew',
  'item_citrus_brew',
  'item_saigon',
  'item_red_john',
  'item_sparkling',
  'item_tonic',
  'item_iced_americano',
]);

export function parseIngredientList(raw: string | null | undefined): IngredientId[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<string>(INGREDIENT_IDS);
    return parsed.filter((id): id is IngredientId => typeof id === 'string' && allowed.has(id)).slice(0, 8);
  } catch {
    return [];
  }
}

export function serializeIngredients(ids: string[]): string {
  const allowed = new Set<string>(INGREDIENT_IDS);
  const clean = ids.filter((id) => allowed.has(id)).slice(0, 8);
  return JSON.stringify(clean);
}

function hasStoredDisplay(item: MenuItem) {
  return Boolean(
    item.menuLead?.trim()
    || item.menuSubtitle?.trim()
    || item.kcalLabel?.trim()
    || item.ingredients.length,
  );
}

export function menuDisplayFor(item: MenuItem): MenuDisplay | null {
  if (hasStoredDisplay(item)) {
    return {
      lead: item.menuLead.trim(),
      titled: item.menuSubtitle.trim() || item.name,
      kcal: item.kcalLabel.trim(),
      ingredients: item.ingredients.filter((id): id is IngredientId => INGREDIENT_IDS.includes(id as IngredientId)),
    };
  }
  return LEGACY_MENU_DISPLAY[item.id] ?? null;
}

export function isColdMenuItem(item: MenuItem) {
  if (item.menuLead.trim().toUpperCase() === 'ICED') return true;
  return LEGACY_COLD_IDS.has(item.id);
}

export function defaultGuestMetaForCategory(categoryId: string, name: string): Pick<MenuItem, 'menuLead' | 'menuSubtitle' | 'kcalLabel' | 'ingredients'> {
  if (categoryId === DRINKS_CATEGORY_ID) {
    return {
      menuLead: 'ICED',
      menuSubtitle: name,
      kcalLabel: '',
      ingredients: ['coffee'],
    };
  }
  return { menuLead: '', menuSubtitle: name, kcalLabel: '', ingredients: [] };
}
