import { all, get, run } from './db';
import { CAFE_ID } from './ids';

type StockSeed = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  qty: number;
  reorder: number;
  cost: number;
  supplier: string;
};

const STOCK: StockSeed[] = [
  { id: 'inv_coffee_beans', name: 'Arabica Coffee Beans', sku: 'RM-COF-01', category: 'Raw material', unit: 'kg', qty: 8.5, reorder: 2, cost: 850, supplier: 'Blue Tokai' },
  { id: 'inv_milk', name: 'Full Cream Milk', sku: 'RM-MLK-01', category: 'Raw material', unit: 'l', qty: 22, reorder: 8, cost: 62, supplier: 'Local dairy' },
  { id: 'inv_oat_milk', name: 'Oat Milk', sku: 'RM-OAT-01', category: 'Raw material', unit: 'l', qty: 6, reorder: 3, cost: 180, supplier: 'Oatly' },
  { id: 'inv_sugar', name: 'Caster Sugar', sku: 'RM-SUG-01', category: 'Raw material', unit: 'kg', qty: 4, reorder: 1, cost: 55, supplier: 'Metro' },
  { id: 'inv_cups_8oz', name: '8oz Paper Cups', sku: 'PK-CUP-8', category: 'Packaging', unit: 'pcs', qty: 480, reorder: 120, cost: 4, supplier: 'PackPro' },
  { id: 'inv_lids', name: 'Cup Lids', sku: 'PK-LID-01', category: 'Packaging', unit: 'pcs', qty: 90, reorder: 100, cost: 2, supplier: 'PackPro' },
  { id: 'inv_napkins', name: 'Napkins', sku: 'PK-NAP-01', category: 'Packaging', unit: 'pcs', qty: 1200, reorder: 300, cost: 1, supplier: 'PackPro' },
  { id: 'inv_chocolate', name: 'Drinking Chocolate', sku: 'RM-CHO-01', category: 'Raw material', unit: 'kg', qty: 1.2, reorder: 0.5, cost: 420, supplier: 'Metro' },
];

const RECIPES: Array<{ menuItemId: string; lines: Array<{ inv: string; qty: number }> }> = [
  {
    menuItemId: 'item_espresso',
    lines: [{ inv: 'inv_coffee_beans', qty: 0.018 }, { inv: 'inv_cups_8oz', qty: 1 }],
  },
  {
    menuItemId: 'item_cappuccino',
    lines: [
      { inv: 'inv_coffee_beans', qty: 0.018 },
      { inv: 'inv_milk', qty: 0.12 },
      { inv: 'inv_cups_8oz', qty: 1 },
      { inv: 'inv_lids', qty: 1 },
    ],
  },
  {
    menuItemId: 'item_iced_americano',
    lines: [{ inv: 'inv_coffee_beans', qty: 0.02 }, { inv: 'inv_cups_8oz', qty: 1 }, { inv: 'inv_lids', qty: 1 }],
  },
  {
    menuItemId: 'item_mocha',
    lines: [
      { inv: 'inv_coffee_beans', qty: 0.018 },
      { inv: 'inv_milk', qty: 0.1 },
      { inv: 'inv_chocolate', qty: 0.015 },
      { inv: 'inv_cups_8oz', qty: 1 },
      { inv: 'inv_lids', qty: 1 },
    ],
  },
  {
    menuItemId: 'item_latte',
    lines: [{ inv: 'inv_coffee_beans', qty: 0.018 }, { inv: 'inv_milk', qty: 0.18 }, { inv: 'inv_cups_8oz', qty: 1 }],
  },
];

export function ensureInventorySeed() {
  const now = new Date().toISOString();
  for (const row of STOCK) {
    run(
      `INSERT INTO inventory_items (id, cafe_id, name, sku, category, unit, qty, reorder_level, cost_per_unit, supplier, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         sku = excluded.sku,
         category = excluded.category,
         unit = excluded.unit,
         reorder_level = excluded.reorder_level,
         cost_per_unit = excluded.cost_per_unit,
         supplier = excluded.supplier,
         updated_at = excluded.updated_at`,
      [row.id, CAFE_ID, row.name, row.sku, row.category, row.unit, row.qty, row.reorder, row.cost, row.supplier, now],
    );
  }
  for (const recipe of RECIPES) {
    const menu = get<{ id: string }>('SELECT id FROM menu_items WHERE id = ?', [recipe.menuItemId]);
    if (!menu) continue;
    for (const line of recipe.lines) {
      run(
        `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
         ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_per_portion = excluded.qty_per_portion`,
        [recipe.menuItemId, line.inv, line.qty],
      );
    }
  }
  const customDrinks = all<{ id: string }>(
    'SELECT id FROM menu_items WHERE cafe_id = ? AND category_id = ?',
    [CAFE_ID, 'cat_drinks'],
  );
  for (const drink of customDrinks) {
    if (RECIPES.some((entry) => entry.menuItemId === drink.id)) continue;
    for (const line of [
      { inv: 'inv_coffee_beans', qty: 0.018 },
      { inv: 'inv_milk', qty: 0.1 },
      { inv: 'inv_cups_8oz', qty: 1 },
    ]) {
      run(
        `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
         ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_per_portion = excluded.qty_per_portion`,
        [drink.id, line.inv, line.qty],
      );
    }
  }
}
