import { hashPassword } from './auth';
import { run, get } from './db';
import { env } from './env';
import { CAFE_ID } from './ids';
import { createStaffOrder, markPaid, retimeOrder, transitionOrder } from './logic';

const DRINKS: [string, string, number, string][] = [
  ['item_espresso', 'Espresso', 120, 'A short, intense shot of coffee. Pulled at 30ml so the crema stays thick and the finish turns sweet before it goes sharp. Medium-dark roast, stopped while the shot is still syrupy, served in a warm cup. The crema should cover the surface and smell like toasted cocoa.'],
  ['item_americano', 'Americano', 140, 'Espresso lengthened with hot water. A double shot opened with hot water, so it drinks long and clean without the bitterness of an over-extracted brew. Dark, hot, and meant to be sat with. Water goes in first, then the shot, so the crema stays on top.'],
  ['item_cappuccino', 'Cappuccino', 160, 'Espresso with steamed milk and a thick foam cap. The shot sits under a dry foam tall enough to hold a spoon, not a thin latte swirl. Milk is stretched until glossy, then poured so the cap stays high. The cup is warmed before the pour, and the foam should reach the rim.'],
  ['item_latte', 'Cafe Latte', 170, 'A longer milk coffee with a thin layer of foam. More milk than a cappuccino, with the espresso folded through so every sip is soft and even. The foam is a short lid, not a mound. The milk is steamed sweet, not scalded, and the shot is buried so the first sip is already mixed.'],
  ['item_mocha', 'Mocha', 190, 'Espresso, cocoa, and steamed milk. Dutch cocoa melted into the shot, then milk poured through it so the chocolate stays a little bitter rather than candy-sweet. A short cocoa dust on top. The cocoa is mixed into the espresso before the milk, so it does not sit as a powder at the bottom.'],
  ['item_iced_latte', 'Iced Latte', 190, 'Espresso and cold milk over ice. The shot is pulled hot and poured straight over ice and cold milk, so it chills without a blender watering it down. Drink it before the ice gives up. The glass is filled with ice first, then milk, then the shot, so the coffee ribbons through instead of sinking in one lump.'],
  ['item_cold_coffee', 'Cold Coffee', 180, 'Blended coffee, milk, and ice. Whipped until it is thick enough to hold a straw upright, with the coffee still tasting like coffee under the milk. Not a milkshake, and not a watery iced coffee. It comes out pale and frothy, with the ice broken fine so the cup stays cold to the last sip.'],
  ['item_matcha', 'Matcha Latte', 210, 'Ceremonial matcha whisked with milk. The tea is sifted and whisked before the milk goes in, so it stays grassy and vivid green instead of turning chalky. Ask if you want it lightly sweet. The bowl is whisked until the surface is even, then the milk is poured through.'],
  ['item_hot_chocolate', 'Hot Chocolate', 180, 'Warm cocoa with steamed milk. Real cocoa melted into hot milk until it is dense and a little bitter, not a powder packet. Served hot enough that the cup needs a minute in your hands. There is no espresso in it. The cocoa is dark, and the milk is steamed until the cup needs a minute in your hands.'],
  ['item_masala_chai', 'Masala Chai', 100, 'Black tea simmered with milk and spices. Ginger, cardamom, and a little black pepper boiled with the tea and milk, then strained. Spice comes first. Sugar, if you want it, comes second. It is boiled, not steeped, so the cup is strong and a little thick.'],
];

const FOOD: [string, string, number, string][] = [
  ['item_butter_croissant', 'Butter Croissant', 140, 'Flaky, butter-laminated pastry. Folded so the layers shatter, with enough butter that the crumb stays tender instead of dry. Baked the same morning, and served warm if you are here early. The outside should crack when you tear it, and the inside should pull into thin sheets.'],
  ['item_choc_croissant', 'Chocolate Croissant', 170, 'Croissant with a dark chocolate baton. The same laminated dough, with a bar of dark chocolate baked into the centre so it stays soft in the middle and set at the ends. The chocolate is bitter enough to cut the butter.'],
  ['item_blueberry_muffin', 'Blueberry Muffin', 130, 'Soft muffin with blueberries. A tall dome, a tender crumb, and berries that burst instead of sinking into a wet streak. Sweet, but not so sweet that you lose the fruit. The top is baked until it just colours, and the berries are folded in whole.'],
  ['item_choc_muffin', 'Chocolate Muffin', 130, 'Cocoa muffin with chocolate chunks. Dark cocoa in the batter and chunks that stay soft in the middle. Dense rather than cakey, and still warm if the tray just came out. The crumb should be damp, not dry, and the chocolate should stretch a little when the muffin is split.'],
  ['item_garlic_bread', 'Garlic Bread', 160, 'Toasted bread with garlic butter. A split loaf brushed with butter, garlic, and parsley, then toasted until the edges crisp and the middle stays soft enough to pull apart. The garlic is cooked into the butter so it is sweet, not raw.'],
  ['item_grilled_cheese', 'Grilled Cheese Sandwich', 220, 'Cheese melted in toasted bread. Mature cheddar between bread buttered on the outside and cooked until the crumb is crisp and the cheese still stretches when you pull it. Pressed flat so the middle melts before the crust burns.'],
  ['item_veg_club', 'Veg Club Sandwich', 240, 'Toasted triple-layer sandwich with vegetables. Three slices of toast with cucumber, tomato, lettuce, and a little cheese, cut so the quarters stand up instead of sliding apart. The toast is dry enough to hold the tomato, and the layers are stacked even so each bite has bread, cheese, and salad.'],
  ['item_margherita', 'Margherita Pizza', 280, 'Tomato, mozzarella, and basil on a thin base. A personal pie with a blistered rim, crushed tomato, and mozzarella that pools instead of baking into a hard crust. Basil goes on after the oven. The centre stays soft, the rim should have a little chew, and it is cut into four.'],
  ['item_fries', 'Peri Peri Fries', 190, 'Fries tossed with peri peri salt. Twice-cooked until the edges shatter, then tossed with peri peri so the heat sits on the crust. No wet sauce drowning them. They come out hot and dry, with the spice on the surface rather than mixed into a powder pile at the bottom of the tray.'],
  ['item_paneer_wrap', 'Paneer Wrap', 230, 'Grilled paneer, salad, and mint in a wrap. Paneer seared until the edges brown, rolled with onion, cucumber, and mint. Built so it eats clean, not soggy. The bread is warmed, the salad is dried, and the mint is mixed through so it is not a puddle at one end.'],
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

function applyMenuCopy() {
  for (const item of [...DRINKS, ...FOOD]) {
    run('UPDATE menu_items SET description = ? WHERE id = ?', [item[3], item[0]]);
  }
}

export async function seed() {
  if (get('SELECT id FROM cafes WHERE id = ?', [CAFE_ID])) {
    run(`UPDATE cafes SET name = 'After Dunes' WHERE id = ? AND name = 'Habsos'`, [CAFE_ID]);
    applyMenuImages();
    applyMenuCopy();
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
  applyMenuCopy();
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
