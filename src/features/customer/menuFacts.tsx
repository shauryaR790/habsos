export type IngredientId =
  | 'milk'
  | 'soy'
  | 'wheat'
  | 'coffee'
  | 'cocoa'
  | 'egg'
  | 'tea'
  | 'potato'
  | 'cheese'
  | 'tomato'
  | 'butter'
  | 'mint'
  | 'chilli'
  | 'paneer';

export type MenuFact = {
  lead: string;
  titled: string;
  kcal: string;
  ingredients: IngredientId[];
};

export const COLD_DRINKS = new Set([
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

export const RECOMMENDED = [
  'item_cappuccino',
  'item_saigon',
  'item_mint_latte',
  'item_moroccan',
  'item_veg_club',
  'item_harvest',
];

const LABEL: Record<IngredientId, string> = {
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

export const MENU_FACTS: Record<string, MenuFact> = {
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
  item_tonic: { lead: 'ICED', titled: 'Cold Brew Tonic', kcal: '40–90 kcal', ingredients: ['coffee'] },
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
  item_penne: { lead: 'PASTA', titled: 'Penne Crème Pesto', kcal: '340 kcal', ingredients: ['wheat', 'cheese'] },
  item_spaghetti: { lead: 'PASTA', titled: 'Spaghetti Aglio e Olio', kcal: '280 kcal', ingredients: ['wheat', 'chilli'] },
  item_risotto: { lead: 'RICE', titled: 'Saffron Risotto', kcal: '330 kcal', ingredients: ['cheese'] },
  item_paneer: { lead: 'GRILL', titled: 'Marinated Grill Cottage Cheese', kcal: '380 kcal', ingredients: ['paneer'] },
};

const ROUND_FILL: IngredientId[] = ['soy', 'wheat', 'milk'];

export function atLeastThree(ids: IngredientId[]) {
  const next = [...ids];
  for (const id of ROUND_FILL) {
    if (next.length >= 3) break;
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

export function IngredientLine({ ids, className = '' }: { ids: IngredientId[]; className?: string }) {
  return (
    <ul className={className ? `ings ${className}` : 'ings'}>
      {ids.map((id) => (
        <li key={id}>
          <IngredientIcon id={id} />
          <span>{LABEL[id]}</span>
        </li>
      ))}
    </ul>
  );
}

function IngredientIcon({ id }: { id: IngredientId }) {
  return (
    <svg className="ing-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths(id)}
    </svg>
  );
}

function paths(id: IngredientId) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'milk') return <path {...common} d="M8 3h8l1 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7zM8 9h8" />;
  if (id === 'soy') return <path {...common} d="M12 20c4-2 6-6 6-10-4 1-7 0-8-3-1 4-4 6-6 7 1 4 4 6 8 6z" />;
  if (id === 'wheat') return <path {...common} d="M12 21V4M12 8c-3 0-4-2-4-3 2 0 4 1 4 3zm0 0c3 0 4-2 4-3-2 0-4 1-4 3zm0 4c-3 0-4-2-4-3 2 0 4 1 4 3zm0 0c3 0 4-2 4-3-2 0-4 1-4 3zm0 4c-3 0-4-2-4-3 2 0 4 1 4 3zm0 0c3 0 4-2 4-3-2 0-4 1-4 3z" />;
  if (id === 'coffee') return <path {...common} d="M6 9h10v5a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 4c.5 1.5.5 1.5 0 3M12 4c.5 1.5.5 1.5 0 3" />;
  if (id === 'cocoa') return <path {...common} d="M12 4c2 3 2 5 0 8-2-3-2-5 0-8zM8 14c2 1 4 1 8 0-1 5-2 7-4 7s-3-2-4-7z" />;
  if (id === 'egg') return <path {...common} d="M12 4c4 4 5 7 5 10a5 5 0 0 1-10 0c0-3 1-6 5-10z" />;
  if (id === 'tea') return <path {...common} d="M12 4c2 3 6 4 6 9a6 6 0 0 1-12 0c0-2 1-3 2-4M8 20h8" />;
  if (id === 'potato') return <path {...common} d="M8 9c0-3 2-5 5-5 2 3 5 3 6 6 1 4-1 8-5 9-4 1-6-3-6-6 0-1-1-2 0-4z" />;
  if (id === 'cheese') return <path {...common} d="M4 18 12 5l8 13zM9 14h.5M13 12h.5M12 16h.5" />;
  if (id === 'tomato') return <path {...common} d="M12 7a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 7c0-2 2-3 3-3" />;
  if (id === 'butter') return <path {...common} d="M5 10h14v7H5zM7 10V8h10v2" />;
  if (id === 'mint') return <path {...common} d="M12 20V10M12 14c-4-1-6-4-6-7 4 0 6 2 6 7zm0 0c4-1 6-4 6-7-4 0-6 2-6 7z" />;
  if (id === 'chilli') return <path {...common} d="M14 4c0 3-2 4-2 7 0 5 3 8 6 8 2 0 3-2 2-4-2-4-1-6-1-8M9 8c-2 2-3 5-2 8" />;
  return <path {...common} d="M7 8h10v10H7zM9 8V6h6v2" />;
}
