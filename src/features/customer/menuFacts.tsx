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
  kcal: number;
  ingredients: IngredientId[];
};

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
  item_espresso: { lead: 'SHORT', titled: 'Short Espresso', kcal: 15, ingredients: ['coffee'] },
  item_americano: { lead: 'LONG', titled: 'Long Americano', kcal: 15, ingredients: ['coffee'] },
  item_cappuccino: { lead: 'REGULAR', titled: 'Regular Cappuccino', kcal: 140, ingredients: ['milk', 'coffee'] },
  item_latte: { lead: 'REGULAR', titled: 'Regular Cafe Latte', kcal: 180, ingredients: ['milk', 'coffee'] },
  item_mocha: { lead: 'REGULAR', titled: 'Regular Mocha', kcal: 260, ingredients: ['milk', 'cocoa', 'coffee'] },
  item_iced_latte: { lead: 'REGULAR', titled: 'Regular Iced Latte', kcal: 170, ingredients: ['milk', 'coffee'] },
  item_cold_coffee: { lead: 'BLENDED', titled: 'Blended Cold Coffee', kcal: 280, ingredients: ['milk', 'coffee'] },
  item_matcha: { lead: 'REGULAR', titled: 'Regular Matcha Latte', kcal: 190, ingredients: ['milk', 'tea'] },
  item_hot_chocolate: { lead: 'REGULAR', titled: 'Regular Hot Chocolate', kcal: 280, ingredients: ['milk', 'cocoa'] },
  item_masala_chai: { lead: 'CUP', titled: 'Masala Chai', kcal: 120, ingredients: ['milk', 'tea'] },
  item_butter_croissant: { lead: 'FLAKY', titled: 'Butter Croissant', kcal: 340, ingredients: ['wheat', 'milk', 'butter'] },
  item_choc_croissant: { lead: 'FLAKY', titled: 'Chocolate Croissant', kcal: 390, ingredients: ['wheat', 'milk', 'cocoa'] },
  item_blueberry_muffin: { lead: 'BAKED', titled: 'Blueberry Muffin', kcal: 360, ingredients: ['wheat', 'egg', 'milk'] },
  item_choc_muffin: { lead: 'BAKED', titled: 'Chocolate Muffin', kcal: 420, ingredients: ['wheat', 'cocoa', 'egg'] },
  item_garlic_bread: { lead: 'TOASTED', titled: 'Garlic Bread', kcal: 310, ingredients: ['wheat', 'butter', 'milk'] },
  item_grilled_cheese: { lead: 'TOASTED', titled: 'Grilled Cheese Sandwich', kcal: 480, ingredients: ['wheat', 'milk', 'cheese'] },
  item_veg_club: { lead: 'STACKED', titled: 'Veg Club Sandwich', kcal: 520, ingredients: ['wheat', 'cheese', 'tomato'] },
  item_margherita: { lead: 'THIN', titled: 'Margherita Pizza', kcal: 740, ingredients: ['wheat', 'cheese', 'tomato'] },
  item_fries: { lead: 'CRISP', titled: 'Peri Peri Fries', kcal: 420, ingredients: ['potato', 'chilli'] },
  item_paneer_wrap: { lead: 'ROLLED', titled: 'Paneer Wrap', kcal: 560, ingredients: ['wheat', 'paneer', 'mint'] },
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
