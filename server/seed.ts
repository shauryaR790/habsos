import { hashPassword } from './auth';
import { run, get } from './db';
import { env } from './env';
import { CAFE_ID } from './ids';
import { createStaffOrder, markPaid, retimeOrder, transitionOrder } from './logic';

const DRINKS: [string, string, number, string][] = [
  ['item_espresso', 'Espresso', 120, 'A short, intense shot of coffee.'],
  ['item_americano', 'Americano', 140, 'Espresso lengthened with hot water.'],
  ['item_cappuccino', 'Cappuccino', 160, 'Espresso with steamed milk and a thick foam cap.'],
  ['item_latte', 'Cafe Latte', 170, 'A longer milk coffee with a thin layer of foam.'],
  ['item_mocha', 'Mocha', 190, 'Espresso, cocoa, and steamed milk.'],
  ['item_iced_latte', 'Iced Latte', 190, 'Espresso and cold milk over ice.'],
  ['item_cold_coffee', 'Cold Coffee', 180, 'Blended coffee, milk, and ice.'],
  ['item_matcha', 'Matcha Latte', 210, 'Ceremonial matcha whisked with milk.'],
  ['item_hot_chocolate', 'Hot Chocolate', 180, 'Warm cocoa with steamed milk.'],
  ['item_masala_chai', 'Masala Chai', 100, 'Black tea simmered with milk and spices.'],
];

const FOOD: [string, string, number, string][] = [
  ['item_butter_croissant', 'Butter Croissant', 140, 'Flaky, butter-laminated pastry.'],
  ['item_choc_croissant', 'Chocolate Croissant', 170, 'Croissant with a dark chocolate baton.'],
  ['item_blueberry_muffin', 'Blueberry Muffin', 130, 'Soft muffin with blueberries.'],
  ['item_choc_muffin', 'Chocolate Muffin', 130, 'Cocoa muffin with chocolate chunks.'],
  ['item_garlic_bread', 'Garlic Bread', 160, 'Toasted bread with garlic butter.'],
  ['item_grilled_cheese', 'Grilled Cheese Sandwich', 220, 'Cheese melted in toasted bread.'],
  ['item_veg_club', 'Veg Club Sandwich', 240, 'Toasted triple-layer sandwich with vegetables.'],
  ['item_margherita', 'Margherita Pizza', 280, 'Tomato, mozzarella, and basil on a thin base.'],
  ['item_fries', 'Peri Peri Fries', 190, 'Fries tossed with peri peri salt.'],
  ['item_paneer_wrap', 'Paneer Wrap', 230, 'Grilled paneer, salad, and mint in a wrap.'],
];

const MENU_IMAGES: Record<string, string> = {
  item_espresso: '/items/espresso.jpg',
  item_americano: '/items/americano.jpg',
  item_cappuccino: '/items/cappuccino.jpg',
  item_latte: '/items/latte.jpg',
  item_mocha: '/items/mocha.jpg',
  item_iced_latte: '/items/iced-latte.jpg',
  item_cold_coffee: '/items/cold-coffee.jpg',
  item_matcha: '/items/matcha.jpg',
  item_hot_chocolate: '/items/hot-chocolate.jpg',
  item_masala_chai: '/items/chai.jpg',
  item_butter_croissant: '/items/butter-croissant.jpg',
  item_choc_croissant: '/items/choc-croissant.jpg',
  item_blueberry_muffin: '/items/blueberry-muffin.jpg',
  item_choc_muffin: '/items/choc-muffin.jpg',
  item_garlic_bread: '/items/garlic-bread.jpg',
  item_grilled_cheese: '/items/grilled-cheese.jpg',
  item_veg_club: '/items/veg-club.jpg',
  item_margherita: '/items/pizza.jpg',
  item_fries: '/items/fries.jpg',
  item_paneer_wrap: '/items/paneer-wrap.jpg',
};

function applyMenuImages() {
  for (const [id, url] of Object.entries(MENU_IMAGES)) {
    run(`UPDATE menu_items SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/menu/%')`, [url, id]);
  }
}

export async function seed() {
  if (get('SELECT id FROM cafes WHERE id = ?', [CAFE_ID])) {
    run(`UPDATE cafes SET name = 'After Dunes' WHERE id = ? AND name = 'Habsos'`, [CAFE_ID]);
    applyMenuImages();
    return;
  }
  const now = new Date().toISOString();
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
  run('INSERT INTO menu_categories (id, cafe_id, name, sort_order) VALUES (?, ?, ?, ?)', ['cat_drinks', CAFE_ID, 'Drinks', 1]);
  run('INSERT INTO menu_categories (id, cafe_id, name, sort_order) VALUES (?, ?, ?, ?)', ['cat_food', CAFE_ID, 'Food', 2]);

  DRINKS.forEach((item, index) => insertItem(item, 'cat_drinks', index + 1, now));
  FOOD.forEach((item, index) => insertItem(item, 'cat_food', index + 11, now));

  run('INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 1)', ['group_size', CAFE_ID, 'Size']);
  run('INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 2)', ['group_milk', CAFE_ID, 'Milk']);
  run('INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 3, 3)', ['group_extras', CAFE_ID, 'Extras']);
  insertAddon('addon_large', 'group_size', 'Large', 40, 1);
  insertAddon('addon_oat', 'group_milk', 'Oat Milk', 30, 1);
  insertAddon('addon_almond', 'group_milk', 'Almond Milk', 40, 2);
  insertAddon('addon_extra_shot', 'group_extras', 'Extra Shot', 50, 1);
  insertAddon('addon_caramel', 'group_extras', 'Caramel Syrup', 30, 2);
  insertAddon('addon_cream', 'group_extras', 'Whipped Cream', 30, 3);

  for (const drink of DRINKS) {
    for (const groupId of ['group_size', 'group_milk', 'group_extras']) {
      run('INSERT INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)', [drink[0], groupId]);
    }
  }

  for (let index = 1; index <= 10; index += 1) {
    const name = `T${String(index).padStart(2, '0')}`;
    run('INSERT INTO tables (id, cafe_id, name, qr_code, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [`table_${name.toLowerCase()}`, CAFE_ID, name, name, 'AVAILABLE', now]);
  }

  const ago = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const completed = createStaffOrder({
    tableCode: 'T01',
    customerName: 'Meera',
    customerMobile: '9876500101',
    items: [
      { menuItemId: 'item_masala_chai', quantity: 2, addonIds: [] },
      { menuItemId: 'item_butter_croissant', quantity: 1, addonIds: [] },
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
      { menuItemId: 'item_iced_latte', quantity: 1, addonIds: ['addon_almond'] },
      { menuItemId: 'item_fries', quantity: 1, addonIds: [] },
    ],
  });
  transitionOrder(ready.id, 'READY');
  retimeOrder(ready.id, ago(35));

  const preparing = createStaffOrder({
    tableCode: 'T03',
    customerName: 'Priya',
    customerMobile: '9876500103',
    items: [
      { menuItemId: 'item_latte', quantity: 1, addonIds: ['addon_oat'] },
      { menuItemId: 'item_blueberry_muffin', quantity: 1, addonIds: [] },
    ],
  });
  retimeOrder(preparing.id, ago(18));

  const fresh = createStaffOrder({
    tableCode: 'T05',
    customerName: 'Arjun',
    customerMobile: '9876500104',
    items: [
      { menuItemId: 'item_cappuccino', quantity: 1, addonIds: ['addon_large', 'addon_oat', 'addon_extra_shot'] },
      { menuItemId: 'item_choc_muffin', quantity: 1, addonIds: [] },
    ],
  });
  retimeOrder(fresh.id, ago(6));
  applyMenuImages();
}

function insertItem(item: [string, string, number, string], categoryId: string, sortOrder: number, now: string) {
  run(
    `INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, image_url, is_veg, is_available, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 1, ?, ?)`,
    [item[0], CAFE_ID, categoryId, item[1], item[3], item[2], sortOrder, now],
  );
}

function insertAddon(id: string, groupId: string, name: string, price: number, sortOrder: number) {
  run('INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES (?, ?, ?, ?, 1, ?)', [id, groupId, name, price, sortOrder]);
}
