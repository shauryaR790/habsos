import { hashPassword } from './auth';
import { CATEGORIES, ITEM_POS, MENU } from './catalog';
import { all, run, get } from './db';
import { DRINK_ADDON_GROUP_IDS, DRINKS_CATEGORY_ID } from '../shared/domain';
import { LEGACY_MENU_DISPLAY, serializeIngredients } from '../shared/menuDisplay';
import { env } from './env';
import { CAFE_ID } from './ids';
import { createReservation, createStaffOrder, markPaid, retimeOrder, setTableStage, transitionOrder } from './logic';
import { ensureInventorySeed } from './seed-inventory';

function ensureMenuDisplayMeta() {
  for (const [itemId, display] of Object.entries(LEGACY_MENU_DISPLAY)) {
    const row = get<{ menu_lead: string; kcal_label: string; ingredients_json: string }>(
      'SELECT menu_lead, kcal_label, ingredients_json FROM menu_items WHERE id = ?',
      [itemId],
    );
    if (!row) continue;
    if (row.menu_lead?.trim() || row.kcal_label?.trim() || (row.ingredients_json && row.ingredients_json !== '[]')) continue;
    run(
      'UPDATE menu_items SET menu_lead = ?, menu_subtitle = ?, kcal_label = ?, ingredients_json = ? WHERE id = ?',
      [display.lead, display.titled, display.kcal, serializeIngredients(display.ingredients), itemId],
    );
  }
  const customDrinks = all<{ id: string; name: string; menu_lead: string; kcal_label: string; ingredients_json: string }>(
    `SELECT id, name, menu_lead, kcal_label, ingredients_json FROM menu_items WHERE cafe_id = ? AND category_id = ?`,
    [CAFE_ID, DRINKS_CATEGORY_ID],
  );
  for (const row of customDrinks) {
    if (LEGACY_MENU_DISPLAY[row.id]) continue;
    if (row.menu_lead?.trim() || row.kcal_label?.trim() || (row.ingredients_json && row.ingredients_json !== '[]')) continue;
    run(
      'UPDATE menu_items SET menu_lead = ?, menu_subtitle = ?, ingredients_json = ? WHERE id = ?',
      ['ICED', row.name, serializeIngredients(['coffee']), row.id],
    );
  }
}

function ensureDrinkAddonGroups() {
  const drinks = all<{ id: string }>(
    'SELECT id FROM menu_items WHERE cafe_id = ? AND category_id = ?',
    [CAFE_ID, DRINKS_CATEGORY_ID],
  );
  for (const drink of drinks) {
    const linked = get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM menu_item_addon_groups WHERE menu_item_id = ?',
      [drink.id],
    );
    if ((linked?.n ?? 0) > 0) continue;
    for (const groupId of DRINK_ADDON_GROUP_IDS) {
      run('INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)', [drink.id, groupId]);
    }
  }
}

function ensureDemoScenarios() {
  const table = get<{ id: string }>('SELECT id FROM tables WHERE cafe_id = ? AND qr_code = ?', [CAFE_ID, 'T10']);
  if (table) {
    setTableStage(table.id, 'blank');
    const reserved = get<{ n: number }>('SELECT COUNT(*) AS n FROM reservations WHERE table_id = ? AND status = ?', [table.id, 'HELD']);
    if (!(reserved?.n ?? 0)) {
      createReservation({
        tableId: table.id,
        customerName: 'Neha Kapoor',
        customerMobile: '9876500199',
        covers: 4,
      });
    }
  }
  const hasDelivery = get<{ id: string }>(
    `SELECT id FROM orders WHERE cafe_id = ? AND notes LIKE '%MODE:DELIVERY%' AND status NOT IN ('CANCELLED','DRAFT') LIMIT 1`,
    [CAFE_ID],
  );
  if (!hasDelivery) {
    createStaffOrder({
      customerName: 'Delivery · Rahul',
      customerMobile: '9876500888',
      items: [{ menuItemId: 'item_penne', quantity: 1, addonIds: [] }],
      notes: 'MODE:DELIVERY\nADDR:12 Beach Road, Calangute',
    });
  }
  const hasPickup = get<{ id: string }>(
    `SELECT id FROM orders WHERE cafe_id = ? AND notes LIKE '%MODE:PICKUP%' AND table_id IS NULL AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') LIMIT 1`,
    [CAFE_ID],
  );
  if (!hasPickup) {
    createStaffOrder({
      customerName: 'Walk-in · Sam',
      customerMobile: '9876500777',
      items: [{ menuItemId: 'item_iced_americano', quantity: 2, addonIds: [] }],
      notes: 'MODE:PICKUP',
    });
  }
}

function syncSizes() {
  run(
    `INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES ('addon_grande', 'group_size', 'Grande', 20, 1, 1)
     ON CONFLICT(id) DO UPDATE SET name = 'Grande', price = 20, is_available = 1, sort_order = 1, group_id = 'group_size'`,
  );
  run(
    `INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES ('addon_tall', 'group_size', 'Tall', 40, 1, 2)
     ON CONFLICT(id) DO UPDATE SET name = 'Tall', price = 40, is_available = 1, sort_order = 2, group_id = 'group_size'`,
  );
  run(`UPDATE addons SET is_available = 0 WHERE group_id = 'group_size' AND id NOT IN ('addon_grande', 'addon_tall')`);
}

function syncMenu(now: string) {
  for (const [id, name, sort] of CATEGORIES) {
    run(
      `INSERT INTO menu_categories (id, cafe_id, name, sort_order) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order`,
      [id, CAFE_ID, name, sort],
    );
  }
  MENU.forEach((dish, index) => {
    const pos = ITEM_POS[dish.id] ?? { num: String(index + 1), alpha: dish.name.replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map((word) => word[0]).join('').toUpperCase(), favorite: false };
    run(
      `INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, image_url, is_veg, is_available, is_favorite, shortcut_num, shortcut_alpha, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category_id = excluded.category_id,
         name = excluded.name,
         description = excluded.description,
         price = excluded.price,
         image_url = excluded.image_url,
         is_veg = 1,
         is_available = 1,
         is_favorite = excluded.is_favorite,
         shortcut_num = excluded.shortcut_num,
         shortcut_alpha = excluded.shortcut_alpha,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [dish.id, CAFE_ID, dish.categoryId, dish.name, dish.description, dish.price, dish.image, pos.favorite ? 1 : 0, pos.num, pos.alpha, index + 1, now],
    );
    run('DELETE FROM menu_item_addon_groups WHERE menu_item_id = ?', [dish.id]);
    if (dish.coffee) {
      for (const groupId of ['group_size', 'group_milk', 'group_extras']) {
        run('INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)', [dish.id, groupId]);
      }
    }
  });
  const ids = MENU.map((dish) => dish.id);
  run(
    `UPDATE menu_items SET is_available = 0 WHERE cafe_id = ? AND id NOT IN (${ids.map(() => '?').join(',')})`,
    [CAFE_ID, ...ids],
  );
}

function ensureTables(now: string) {
  const floor: Array<{ name: string; qr: string; area: string }> = [];
  for (let index = 1; index <= 10; index += 1) {
    const name = `T${String(index).padStart(2, '0')}`;
    floor.push({ name, qr: name, area: 'Ground Floor' });
  }
  for (let index = 11; index <= 20; index += 1) {
    const name = `T${String(index).padStart(2, '0')}`;
    floor.push({ name, qr: name, area: 'Basement' });
  }
  floor.push({ name: 'Hall 1', qr: 'HALL1', area: 'Party Hall' });
  floor.push({ name: 'Hall 2', qr: 'HALL2', area: 'Party Hall' });
  for (const table of floor) {
    run(
      `INSERT OR IGNORE INTO tables (id, cafe_id, name, qr_code, status, area, updated_at)
       VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
      [`table_${table.qr.toLowerCase()}`, CAFE_ID, table.name, table.qr, table.area, now],
    );
    run('UPDATE tables SET area = ? WHERE cafe_id = ? AND qr_code = ?', [table.area, CAFE_ID, table.qr]);
  }
}

export async function seed() {
  const now = new Date().toISOString();
  if (get('SELECT id FROM cafes WHERE id = ?', [CAFE_ID])) {
    run(`UPDATE cafes SET name = 'After Dunes' WHERE id = ? AND name = 'Habsos'`, [CAFE_ID]);
    syncSizes();
    syncMenu(now);
    ensureTables(now);
    ensureDrinkAddonGroups();
    ensureMenuDisplayMeta();
    ensureDemoScenarios();
    ensureInventorySeed();
    return;
  }
  run('INSERT INTO cafes (id, name, tax_bps, currency, timezone, created_at) VALUES (?, ?, 500, ?, ?, ?)', [CAFE_ID, 'After Dunes', 'INR', 'Asia/Kolkata', now]);
  run('INSERT INTO order_counters (cafe_id, next_number) VALUES (?, 101)', [CAFE_ID]);
  const password = await hashPassword(env.adminPassword);
  run('INSERT INTO users (id, cafe_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    'user_staff',
    CAFE_ID,
    'Staff',
    env.adminEmail.toLowerCase(),
    password,
    'staff',
    now,
  ]);
  run('INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 1)', ['group_size', CAFE_ID, 'Size']);
  run('INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 2)', ['group_milk', CAFE_ID, 'Milk']);
  run('INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 3, 3)', ['group_extras', CAFE_ID, 'Extras']);
  syncSizes();
  insertAddon('addon_oat', 'group_milk', 'Oat Milk', 30, 1);
  insertAddon('addon_almond', 'group_milk', 'Almond Milk', 40, 2);
  insertAddon('addon_extra_shot', 'group_extras', 'Extra Shot', 50, 1);
  insertAddon('addon_caramel', 'group_extras', 'Caramel Syrup', 30, 2);
  insertAddon('addon_cream', 'group_extras', 'Whipped Cream', 30, 3);
  syncMenu(now);

  ensureTables(now);

  const ago = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const completed = createStaffOrder({
    tableCode: 'T01',
    customerName: 'Meera',
    customerMobile: '9876500101',
    items: [
      { menuItemId: 'item_espresso', quantity: 2, addonIds: [] },
      { menuItemId: 'item_halloumi', quantity: 1, addonIds: [] },
    ],
  });
  for (const status of ['READY', 'SERVED', 'COMPLETED'] as const) transitionOrder(completed.id, status);
  markPaid(completed.id, 'CASH');
  retimeOrder(completed.id, ago(120));

  const ready = createStaffOrder({
    tableCode: 'T02',
    customerName: 'Rohan',
    customerMobile: '9876500102',
    items: [
      { menuItemId: 'item_iced_americano', quantity: 1, addonIds: ['addon_almond'] },
      { menuItemId: 'item_veg_club', quantity: 1, addonIds: [] },
    ],
  });
  transitionOrder(ready.id, 'READY');
  retimeOrder(ready.id, ago(35));

  const preparing = createStaffOrder({
    tableCode: 'T03',
    customerName: 'Priya',
    customerMobile: '9876500103',
    items: [
      { menuItemId: 'item_mocha', quantity: 1, addonIds: ['addon_oat'] },
      { menuItemId: 'item_penne', quantity: 1, addonIds: [] },
    ],
  });
  retimeOrder(preparing.id, ago(18));

  const fresh = createStaffOrder({
    tableCode: 'T05',
    customerName: 'Arjun',
    customerMobile: '9876500104',
    items: [
      { menuItemId: 'item_cappuccino', quantity: 1, addonIds: ['addon_tall', 'addon_oat', 'addon_extra_shot'] },
      { menuItemId: 'item_cheddar', quantity: 1, addonIds: [] },
    ],
  });
  retimeOrder(fresh.id, ago(6));
  ensureDrinkAddonGroups();
  ensureMenuDisplayMeta();
  ensureDemoScenarios();
  ensureInventorySeed();
}

function insertAddon(id: string, groupId: string, name: string, price: number, sortOrder: number) {
  run('INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES (?, ?, ?, ?, 1, ?)', [id, groupId, name, price, sortOrder]);
}
