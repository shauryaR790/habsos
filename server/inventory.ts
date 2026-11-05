import { randomUUID } from 'node:crypto';
import type { InventoryItem, InventoryMovement, InventoryMovementKind, MenuRecipeLine } from '../shared/domain';
import { INGREDIENT_IDS, INGREDIENT_STOCK, type IngredientId } from '../shared/menuDisplay';
import { all, get, run } from './db';
import { AppError } from './appError';
import { CAFE_ID } from './ids';

export const INVENTORY_UNITS = ['kg', 'g', 'l', 'ml', 'pcs'] as const;
export const INVENTORY_CATEGORIES = ['Raw material', 'Packaging', 'Semi-finished', 'Other'] as const;

type ItemRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  qty: number;
  reorder_level: number;
  cost_per_unit: number;
  supplier: string;
  is_active: number;
  updated_at: string;
};

type MovementRow = {
  id: string;
  item_id: string;
  kind: string;
  qty_delta: number;
  unit_cost: number;
  reference: string;
  notes: string;
  supplier: string;
  created_at: string;
  actor: string;
};

function mapItem(row: ItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    qty: row.qty,
    reorderLevel: row.reorder_level,
    costPerUnit: row.cost_per_unit,
    supplier: row.supplier,
    isActive: row.is_active === 1,
    updatedAt: row.updated_at,
    lowStock: row.qty <= row.reorder_level && row.reorder_level > 0,
  };
}

function mapMovement(row: MovementRow, itemName?: string): InventoryMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: itemName ?? '',
    kind: row.kind as InventoryMovementKind,
    qtyDelta: row.qty_delta,
    unitCost: row.unit_cost,
    reference: row.reference,
    notes: row.notes,
    supplier: row.supplier,
    createdAt: row.created_at,
    actor: row.actor,
  };
}

export function listInventoryItems() {
  const rows = all<ItemRow>(
    'SELECT * FROM inventory_items WHERE cafe_id = ? AND is_active = 1 ORDER BY category, name',
    [CAFE_ID],
  );
  return rows.map(mapItem);
}

export function listInventoryMovements(limit = 80) {
  const rows = all<MovementRow & { item_name: string }>(
    `SELECT m.*, i.name AS item_name FROM inventory_movements m
     JOIN inventory_items i ON i.id = m.item_id
     WHERE m.cafe_id = ?
     ORDER BY m.created_at DESC LIMIT ?`,
    [CAFE_ID, limit],
  );
  return rows.map((row) => mapMovement(row, row.item_name));
}

export function inventorySummary() {
  const items = listInventoryItems();
  const low = items.filter((item) => item.lowStock);
  const value = items.reduce((sum, item) => sum + Math.round(item.qty * item.costPerUnit), 0);
  return {
    itemCount: items.length,
    lowStockCount: low.length,
    stockValue: value,
    lowStock: low.slice(0, 8),
  };
}

export function createInventoryItem(input: {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  qty?: number;
  reorderLevel?: number;
  costPerUnit?: number;
  supplier?: string;
}) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, 'INVENTORY', 'Name is required.');
  const unit = input.unit.trim();
  if (!INVENTORY_UNITS.includes(unit as (typeof INVENTORY_UNITS)[number])) {
    throw new AppError(400, 'INVENTORY', 'Pick a valid unit.');
  }
  const now = new Date().toISOString();
  const id = `inv_${randomUUID().slice(0, 8)}`;
  const qty = Math.max(0, input.qty ?? 0);
  run(
    `INSERT INTO inventory_items (id, cafe_id, name, sku, category, unit, qty, reorder_level, cost_per_unit, supplier, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      CAFE_ID,
      name,
      (input.sku ?? '').trim().slice(0, 32),
      (input.category ?? 'Raw material').trim().slice(0, 40),
      unit,
      qty,
      Math.max(0, input.reorderLevel ?? 0),
      Math.max(0, input.costPerUnit ?? 0),
      (input.supplier ?? '').trim().slice(0, 80),
      now,
    ],
  );
  return mapItem(get<ItemRow>('SELECT * FROM inventory_items WHERE id = ?', [id])!);
}

export function updateInventoryItem(id: string, patch: Partial<{
  name: string;
  sku: string;
  category: string;
  unit: string;
  reorderLevel: number;
  costPerUnit: number;
  supplier: string;
}>) {
  const current = get<ItemRow>('SELECT * FROM inventory_items WHERE id = ? AND cafe_id = ?', [id, CAFE_ID]);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Stock item not found.');
  const unit = patch.unit !== undefined ? patch.unit.trim() : current.unit;
  if (patch.unit !== undefined && !INVENTORY_UNITS.includes(unit as (typeof INVENTORY_UNITS)[number])) {
    throw new AppError(400, 'INVENTORY', 'Pick a valid unit.');
  }
  const now = new Date().toISOString();
  run(
    `UPDATE inventory_items SET
      name = ?, sku = ?, category = ?, unit = ?, reorder_level = ?, cost_per_unit = ?, supplier = ?, updated_at = ?
     WHERE id = ?`,
    [
      patch.name !== undefined ? patch.name.trim().slice(0, 80) : current.name,
      patch.sku !== undefined ? patch.sku.trim().slice(0, 32) : current.sku,
      patch.category !== undefined ? patch.category.trim().slice(0, 40) : current.category,
      unit,
      patch.reorderLevel !== undefined ? Math.max(0, patch.reorderLevel) : current.reorder_level,
      patch.costPerUnit !== undefined ? Math.max(0, patch.costPerUnit) : current.cost_per_unit,
      patch.supplier !== undefined ? patch.supplier.trim().slice(0, 80) : current.supplier,
      now,
      id,
    ],
  );
  return mapItem(get<ItemRow>('SELECT * FROM inventory_items WHERE id = ?', [id])!);
}

function recordMovementInternal(input: {
  itemId: string;
  kind: InventoryMovementKind;
  qtyDelta: number;
  unitCost?: number;
  reference?: string;
  notes?: string;
  supplier?: string;
  actor?: string;
}) {
  const item = get<ItemRow>('SELECT * FROM inventory_items WHERE id = ? AND cafe_id = ? AND is_active = 1', [input.itemId, CAFE_ID]);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Stock item not found.');
  const ref = (input.reference ?? '').trim();
  if (ref) {
    const dup = get<{ id: string }>('SELECT id FROM inventory_movements WHERE item_id = ? AND reference = ?', [input.itemId, ref]);
    if (dup) return mapMovement(get<MovementRow>('SELECT * FROM inventory_movements WHERE id = ?', [dup.id])!, item.name);
  }
  const qtyDelta = input.qtyDelta;
  if (!Number.isFinite(qtyDelta) || qtyDelta === 0) throw new AppError(400, 'INVENTORY', 'Quantity must be non-zero.');
  const nextQty = item.qty + qtyDelta;
  if (nextQty < -0.0001) throw new AppError(409, 'INVENTORY', `Not enough ${item.name} on hand (${item.qty} ${item.unit}).`);
  const now = new Date().toISOString();
  const id = randomUUID();
  run(
    `INSERT INTO inventory_movements (id, cafe_id, item_id, kind, qty_delta, unit_cost, reference, notes, supplier, created_at, actor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      CAFE_ID,
      input.itemId,
      input.kind,
      qtyDelta,
      input.unitCost ?? item.cost_per_unit,
      ref,
      (input.notes ?? '').trim().slice(0, 200),
      (input.supplier ?? '').trim().slice(0, 80),
      now,
      input.actor ?? 'staff',
    ],
  );
  run('UPDATE inventory_items SET qty = ?, updated_at = ? WHERE id = ?', [Math.max(0, nextQty), now, input.itemId]);
  return mapMovement(get<MovementRow>('SELECT * FROM inventory_movements WHERE id = ?', [id])!, item.name);
}

export function recordInventoryMovement(input: {
  itemId: string;
  kind: InventoryMovementKind;
  qty: number;
  unitCost?: number;
  notes?: string;
  supplier?: string;
  actor?: string;
}) {
  const qty = Math.abs(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) throw new AppError(400, 'INVENTORY', 'Enter a quantity.');
  let qtyDelta = qty;
  if (input.kind === 'WASTAGE' || input.kind === 'SALE') qtyDelta = -qty;
  if (input.kind === 'PURCHASE' || input.kind === 'RETURN') qtyDelta = qty;
  if (input.kind === 'ADJUSTMENT') qtyDelta = input.qty;
  return recordMovementInternal({
    itemId: input.itemId,
    kind: input.kind,
    qtyDelta,
    unitCost: input.unitCost,
    reference: '',
    notes: input.notes,
    supplier: input.supplier,
    actor: input.actor,
  });
}

export function listRecipesForMenuItem(menuItemId: string): MenuRecipeLine[] {
  const rows = all<{ menu_item_id: string; inventory_item_id: string; qty_per_portion: number; item_name: string; unit: string }>(
    `SELECT r.menu_item_id, r.inventory_item_id, r.qty_per_portion, i.name AS item_name, i.unit
     FROM menu_recipes r JOIN inventory_items i ON i.id = r.inventory_item_id
     WHERE r.menu_item_id = ?`,
    [menuItemId],
  );
  return rows.map((row) => ({
    menuItemId: row.menu_item_id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.item_name,
    unit: row.unit,
    qtyPerPortion: row.qty_per_portion,
  }));
}

export function listAllRecipes() {
  const rows = all<{ menu_item_id: string; inventory_item_id: string; qty_per_portion: number }>(
    'SELECT menu_item_id, inventory_item_id, qty_per_portion FROM menu_recipes',
  );
  return rows.map((row) => ({
    menuItemId: row.menu_item_id,
    inventoryItemId: row.inventory_item_id,
    qtyPerPortion: row.qty_per_portion,
  }));
}

const INGREDIENT_STOCK_IDS = new Set(Object.values(INGREDIENT_STOCK).map((entry) => entry.stockId));

export function syncRecipesFromIngredients(menuItemId: string, ingredients: string[], categoryId?: string) {
  const menu = get<{ id: string }>('SELECT id FROM menu_items WHERE id = ? AND cafe_id = ?', [menuItemId, CAFE_ID]);
  if (!menu) return;
  const chosen = ingredients.filter((id): id is IngredientId => (INGREDIENT_IDS as readonly string[]).includes(id));
  const existing = all<{ inventory_item_id: string }>(
    'SELECT inventory_item_id FROM menu_recipes WHERE menu_item_id = ?',
    [menuItemId],
  );
  for (const row of existing) {
    if (INGREDIENT_STOCK_IDS.has(row.inventory_item_id)) {
      run('DELETE FROM menu_recipes WHERE menu_item_id = ? AND inventory_item_id = ?', [menuItemId, row.inventory_item_id]);
    }
  }
  for (const id of chosen) {
    const stock = INGREDIENT_STOCK[id];
    const item = get<{ id: string }>('SELECT id FROM inventory_items WHERE id = ? AND cafe_id = ?', [stock.stockId, CAFE_ID]);
    if (!item) continue;
    run(
      `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
       ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_per_portion = excluded.qty_per_portion`,
      [menuItemId, stock.stockId, stock.portion],
    );
  }
  if (categoryId === 'cat_drinks') {
    const cup = get<{ id: string }>('SELECT id FROM inventory_items WHERE id = ?', ['inv_cups_8oz']);
    if (cup) {
      run(
        `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
         ON CONFLICT(menu_item_id, inventory_item_id) DO NOTHING`,
        [menuItemId, 'inv_cups_8oz', 1],
      );
    }
  }
}

export function saveMenuRecipes(menuItemId: string, lines: { inventoryItemId: string; qtyPerPortion: number }[]) {
  const menu = get<{ id: string }>('SELECT id FROM menu_items WHERE id = ? AND cafe_id = ?', [menuItemId, CAFE_ID]);
  if (!menu) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  run('DELETE FROM menu_recipes WHERE menu_item_id = ?', [menuItemId]);
  for (const line of lines) {
    if (!line.inventoryItemId || !Number.isFinite(line.qtyPerPortion) || line.qtyPerPortion <= 0) continue;
    const stock = get<{ id: string }>('SELECT id FROM inventory_items WHERE id = ? AND cafe_id = ?', [line.inventoryItemId, CAFE_ID]);
    if (!stock) throw new AppError(400, 'INVENTORY', 'Unknown stock item in recipe.');
    run(
      'INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)',
      [menuItemId, line.inventoryItemId, line.qtyPerPortion],
    );
  }
  return listRecipesForMenuItem(menuItemId);
}

export function consumeInventoryForOrder(orderId: string, actor = 'system') {
  const order = get<{ order_number: number }>('SELECT order_number FROM orders WHERE id = ?', [orderId]);
  if (!order) return;
  const lines = all<{ menu_item_id: string | null; name_snapshot: string; quantity: number }>(
    'SELECT menu_item_id, name_snapshot, quantity FROM order_items WHERE order_id = ?',
    [orderId],
  );
  for (const line of lines) {
    if (!line.menu_item_id) continue;
    const recipes = all<{ inventory_item_id: string; qty_per_portion: number }>(
      'SELECT inventory_item_id, qty_per_portion FROM menu_recipes WHERE menu_item_id = ?',
      [line.menu_item_id],
    );
    for (const recipe of recipes) {
      const qty = recipe.qty_per_portion * line.quantity;
      if (qty <= 0) continue;
      const ref = `sale:${orderId}:${line.menu_item_id}:${recipe.inventory_item_id}`;
      recordMovementInternal({
        itemId: recipe.inventory_item_id,
        kind: 'SALE',
        qtyDelta: -qty,
        reference: ref,
        notes: `Bill #${order.order_number} · ${line.name_snapshot}`,
        actor,
      });
    }
  }
}

export function inventoryBundle() {
  return {
    items: listInventoryItems(),
    movements: listInventoryMovements(),
    recipes: listAllRecipes(),
    summary: inventorySummary(),
  };
}
