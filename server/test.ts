import assert from 'node:assert/strict';
import { priceCart, canTransition, maskMobile, type AddonGroup, type MenuItem } from '../shared/domain';

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.OTP_PROVIDER = 'mock';
process.env.OTP_DEV_EXPOSE = 'false';
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'admin@habs.cafe';
process.env.ADMIN_PASSWORD = 'habsos-admin';

const drinks: MenuItem[] = [
  { id: 'item_cappuccino', categoryId: 'cat_drinks', name: 'Cappuccino', description: '', price: 160, imageUrl: null, isVeg: true, isAvailable: true, sortOrder: 3, addonGroupIds: ['group_size', 'group_milk', 'group_extras'] },
  { id: 'item_choc_muffin', categoryId: 'cat_food', name: 'Chocolate Muffin', description: '', price: 130, imageUrl: null, isVeg: true, isAvailable: true, sortOrder: 14, addonGroupIds: [] },
];

const groups: AddonGroup[] = [
  { id: 'group_size', name: 'Size', minSelect: 0, maxSelect: 1, sortOrder: 1, addons: [{ id: 'addon_large', groupId: 'group_size', name: 'Large', price: 40, isAvailable: true, sortOrder: 1 }] },
  { id: 'group_milk', name: 'Milk', minSelect: 0, maxSelect: 1, sortOrder: 2, addons: [{ id: 'addon_oat', groupId: 'group_milk', name: 'Oat Milk', price: 30, isAvailable: true, sortOrder: 1 }, { id: 'addon_almond', groupId: 'group_milk', name: 'Almond Milk', price: 40, isAvailable: true, sortOrder: 2 }] },
  { id: 'group_extras', name: 'Extras', minSelect: 0, maxSelect: 3, sortOrder: 3, addons: [{ id: 'addon_extra_shot', groupId: 'group_extras', name: 'Extra Shot', price: 50, isAvailable: true, sortOrder: 1 }] },
];

const quote = priceCart({
  taxBps: 500,
  items: drinks,
  groups,
  lines: [
    { menuItemId: 'item_cappuccino', quantity: 1, addonIds: ['addon_large', 'addon_oat', 'addon_extra_shot'] },
    { menuItemId: 'item_choc_muffin', quantity: 1, addonIds: [] },
  ],
});
assert.equal(quote.lines[0].total, 280);
assert.equal(quote.subtotal, 410);
assert.equal(quote.tax, 21);
assert.equal(quote.total, 431);
assert.equal(canTransition('CONFIRMED', 'PREPARING'), false);
assert.equal(canTransition('CONFIRMED', 'READY'), true);
assert.equal(maskMobile('9876500123'), 'XXXXXXX123');

const logic = await import('./logic');
const seed = await import('./seed');
const otp = await import('./otp');
await seed.seed();

const fresh = logic.getOrderByNumber(104);
assert.ok(fresh);
assert.equal(fresh.status, 'CONFIRMED');
assert.equal(fresh.paymentStatus, 'UNPAID');
assert.equal(fresh.tableName, 'T05');
assert.equal(fresh.customerName, 'Arjun');
assert.equal(fresh.items[0].nameSnapshot, 'Cappuccino');
assert.equal(fresh.items[0].unitPrice, 180);
assert.equal(fresh.items[0].addons.map((addon) => addon.nameSnapshot).join(','), 'Tall,Oat Milk,Extra Shot');
assert.equal(fresh.subtotal, 475);
assert.equal(fresh.tax, 24);
assert.equal(fresh.total, 499);
assert.equal(fresh.events[0].message, 'Order placed');

logic.updateMenuItem('item_cappuccino', { name: 'New Cappuccino', price: 220, description: 'Changed', isAvailable: true });
const historical = logic.getOrderByNumber(104);
assert.equal(historical?.items[0].nameSnapshot, 'Cappuccino');
assert.equal(historical?.items[0].unitPrice, 180);
logic.updateMenuItem('item_cappuccino', { name: 'Cappuccino', price: 180, description: 'Espresso with steamed milk and a thick foam cap.', isAvailable: true });

assert.throws(() => logic.transitionOrder(fresh.id, 'PREPARING'), /Cannot move/);
const readyNow = logic.transitionOrder(fresh.id, 'READY');
assert.equal(readyNow.status, 'READY');
assert.equal(readyNow.events.at(-1)?.message, 'Ready');

assert.throws(() => {
  logic.createStaffOrder({
    tableCode: 'T04',
    customerName: 'Test',
    customerMobile: '9876500999',
    items: [{ menuItemId: 'item_cheddar', quantity: 1, addonIds: ['addon_oat'] }],
  });
}, /not available/);

logic.updateMenuItem('item_espresso', { name: 'Classic Espresso', description: 'A short, intense shot of coffee.', price: 150, isAvailable: false });
assert.throws(() => {
  logic.createStaffOrder({
    tableCode: 'T04',
    customerName: 'Test',
    customerMobile: '9876500998',
    items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
  });
}, /sold out/);
logic.updateMenuItem('item_espresso', { name: 'Classic Espresso', description: 'A short, intense shot of coffee.', price: 150, isAvailable: true });

const clientKey = crypto.randomUUID();
const pending = await logic.startCheckout({
  tableCode: 'T06',
  customerName: 'Neel',
  customerMobile: '+91 98765 43210',
  clientKey,
  items: [{ menuItemId: 'item_iced_americano', quantity: 1, addonIds: ['addon_tall'], notes: 'less ice' }],
});
assert.equal(pending.order.status, 'OTP_PENDING');
assert.equal(pending.order.customerMobile, '9876543210');
const americano = 210 + 40;
assert.equal(pending.order.subtotal, americano);
assert.equal(pending.order.tax, Math.round((americano * 500) / 10000));
assert.equal(pending.order.total, 263);
const code = otp.peekDevCode(pending.challengeId!);
assert.ok(code);
await assert.rejects(logic.verifyCheckout(pending.order.id, '000000'), /not correct/);
const confirmed = await logic.verifyCheckout(pending.order.id, code!);
assert.equal(confirmed.status, 'CONFIRMED');
assert.equal(confirmed.paymentStatus, 'UNPAID');
assert.equal(confirmed.tableName, 'T06');
const paid = logic.markPaid(confirmed.id, 'UPI');
assert.equal(paid.paymentStatus, 'PAID');
assert.equal(paid.status, 'CONFIRMED');
assert.equal(paid.payments[0].method, 'UPI');
assert.equal(paid.payments[0].amount, confirmed.total);

const again = logic.createStaffOrder({
  id: confirmed.id,
  tableCode: 'T06',
  customerName: 'Neel',
  customerMobile: '9876543210',
  items: [{ menuItemId: 'item_iced_americano', quantity: 9, addonIds: [] }],
  clientKey: confirmed.id,
});
assert.equal(again.total, confirmed.total);

const synced = logic.applySyncBatch([
  {
    id: 'q1',
    operation: 'CREATE_ORDER',
    entityId: crypto.randomUUID(),
    payload: {
      id: crypto.randomUUID(),
      tableCode: 'T07',
      customerName: 'Walk in',
      customerMobile: '',
      items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
    },
  },
]);
assert.equal(synced[0].ok, true);
assert.equal(synced[0].order?.total, 158);
assert.equal(synced[0].order?.source, 'POS');

console.log('server tests passed');
