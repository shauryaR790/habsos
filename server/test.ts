import assert from 'node:assert/strict';
import { applyLineQuantity, buildSalesReport, canTransition, cartLineKey, clampLineQuantity, dueTotal, formatZonedYmd, maskMobile, nextTicketStatus, noteValue, orderChannel, orderFlag, priceCart, registerPath, resolveMenuShortcut, shiftYmd, splitAmounts, tableVisualState, zonedDayStart, type AddonGroup, type MenuItem } from '../shared/domain';

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.OTP_PROVIDER = 'mock';
process.env.OTP_DEV_EXPOSE = 'false';
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'admin@habs.cafe';
process.env.ADMIN_PASSWORD = 'habsos-admin';

const drinks: MenuItem[] = [
  { id: 'item_cappuccino', categoryId: 'cat_drinks', name: 'Cappuccino', description: '', price: 160, imageUrl: null, isVeg: true, isAvailable: true, isFavorite: true, shortcutNum: '4', shortcutAlpha: 'CAP', sortOrder: 3, addonGroupIds: ['group_size', 'group_milk', 'group_extras'], menuLead: '', menuSubtitle: '', kcalLabel: '', ingredients: [] },
  { id: 'item_choc_muffin', categoryId: 'cat_food', name: 'Chocolate Muffin', description: '', price: 130, imageUrl: null, isVeg: true, isAvailable: true, isFavorite: false, shortcutNum: '72', shortcutAlpha: 'GS', sortOrder: 14, addonGroupIds: [], menuLead: '', menuSubtitle: '', kcalLabel: '', ingredients: [] },
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
assert.equal(canTransition('CONFIRMED', 'SERVED'), true);
assert.equal(nextTicketStatus('CONFIRMED', 'kot'), 'READY');
assert.equal(nextTicketStatus('CONFIRMED', 'print'), 'SERVED');
assert.equal(nextTicketStatus('READY', 'kot'), null);
assert.equal(nextTicketStatus('SERVED', 'print'), null);
assert.equal(orderFlag('HOLD\nCOVER:2', 'HOLD'), true);
assert.equal(orderFlag('COVER:2', 'HOLD'), false);
assert.equal(maskMobile('9876500123'), 'XXXXXXX123');
assert.equal(resolveMenuShortcut(drinks, '4')?.id, 'item_cappuccino');
assert.equal(resolveMenuShortcut(drinks, 'cap')?.id, 'item_cappuccino');
assert.equal(resolveMenuShortcut(drinks, '72')?.id, 'item_choc_muffin');
assert.equal(resolveMenuShortcut(drinks, 'GS')?.id, 'item_choc_muffin');
assert.equal(resolveMenuShortcut(drinks, 'nope'), undefined);
assert.equal(clampLineQuantity(0), 1);
assert.equal(clampLineQuantity(21), 20);
assert.equal(applyLineQuantity(18, 5).quantity, 20);
assert.equal(applyLineQuantity(18, 5).capped, true);
assert.equal(registerPath({ tableId: 'table_t01', orderId: 'abc', mode: 'dine' }), '/pos/orders/new?mode=dine&table=table_t01&order=abc');
assert.equal(noteValue('CAPTAIN:Riya\nCOVER:2', 'CAPTAIN'), 'Riya');
assert.deepEqual(splitAmounts(100, 3), [34, 33, 33]);
assert.deepEqual(splitAmounts(101, 2), [51, 50]);
assert.throws(() => splitAmounts(10, 1), /2–8/);
assert.equal(
  cartLineKey({ menuItemId: 'item_cappuccino', addonIds: ['addon_oat', 'addon_large'], notes: '  less ice ' }),
  cartLineKey({ menuItemId: 'item_cappuccino', addonIds: ['addon_large', 'addon_oat'], notes: 'less ice' }),
);
assert.throws(() => priceCart({
  taxBps: 500,
  items: drinks,
  groups,
  lines: [{ menuItemId: 'item_choc_muffin', quantity: 21, addonIds: [] }],
}), /Quantity must be between 1 and 20/);
assert.equal(orderChannel({ tableId: 'table_t01', notes: '' }), 'dine');
assert.equal(orderChannel({ tableId: null, notes: 'MODE:DELIVERY' }), 'delivery');
assert.equal(orderChannel({ tableId: null, notes: 'MODE:PICKUP' }), 'pickup');
assert.equal(shiftYmd('2026-10-06', -1), '2026-10-05');
assert.equal(shiftYmd('2026-01-01', -1), '2025-12-31');
assert.equal(zonedDayStart('Asia/Kolkata', '2026-10-06').toISOString(), '2026-10-05T18:30:00.000Z');
assert.equal(
  buildSalesReport({
    orders: [{
      id: 'o1',
      orderNumber: 9,
      cafeId: 'c',
      tableId: null,
      tableName: null,
      customerId: null,
      customerName: 'Walk-in',
      customerMobile: '',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      subtotal: 150,
      tax: 8,
      discount: 0,
      total: 158,
      source: 'POS',
      notes: 'MODE:PICKUP',
      createdAt: '2026-10-06T05:30:00.000Z',
      updatedAt: '2026-10-06T05:30:00.000Z',
      syncedAt: null,
      items: [{ id: 'i1', menuItemId: 'item_espresso', nameSnapshot: 'Classic Espresso', quantity: 1, unitPrice: 150, total: 150, notes: '', addons: [] }],
      events: [],
      payments: [{ id: 'p1', method: 'CASH', amount: 158, status: 'PAID', createdAt: '2026-10-06T05:31:00.000Z' }],
    }],
    categoryName: () => 'Drinks',
    timeZone: 'Asia/Kolkata',
    from: '2026-10-05T18:30:00.000Z',
    to: '2026-10-06T18:30:00.000Z',
    fromYmd: '2026-10-06',
    toYmd: '2026-10-06',
  }).byChannel.pickup.amount,
  158,
);

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
const printed = logic.createStaffOrder({
  tableCode: 'T09',
  customerName: 'Print skip',
  customerMobile: '',
  items: [{ menuItemId: 'item_cheddar', quantity: 1, addonIds: [] }],
});
assert.equal(printed.status, 'CONFIRMED');
assert.equal(logic.transitionOrder(printed.id, 'SERVED').status, 'SERVED');
const running = logic.createStaffOrder({
  tableCode: 'T08',
  customerName: 'Add on',
  customerMobile: '',
  items: [{ menuItemId: 'item_veg_club', quantity: 1, addonIds: [] }],
});
assert.equal(running.items.length, 1);
const added = logic.replaceStaffOrderItems(running.id, {
  customerName: 'Add on',
  items: [
    { menuItemId: 'item_veg_club', quantity: 1, addonIds: [] },
    { menuItemId: 'item_harvest', quantity: 1, addonIds: [] },
  ],
});
assert.equal(added.items.length, 2);
assert.ok(added.total > running.total);
assert.throws(() => logic.replaceStaffOrderItems(logic.getOrderByNumber(101)!.id, {
  items: [{ menuItemId: 'item_veg_club', quantity: 1, addonIds: [] }],
}), /no longer be edited/);
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

logic.updateMenuItem('item_espresso', { name: 'Espresso', description: 'A short, intense shot of coffee.', price: 150, isAvailable: false });
assert.throws(() => {
  logic.createStaffOrder({
    tableCode: 'T04',
    customerName: 'Test',
    customerMobile: '9876500998',
    items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
  });
}, /sold out/);
logic.updateMenuItem('item_espresso', { name: 'Espresso', description: 'A short, intense shot of coffee.', price: 150, isAvailable: true });

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
assert.equal(paid.status, 'COMPLETED');
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

const catalog = logic.loadCatalog();
const cappuccino = catalog.items.find((item) => item.id === 'item_cappuccino');
assert.equal(cappuccino?.shortcutNum, '4');
assert.equal(cappuccino?.shortcutAlpha, 'CAP');
assert.equal(cappuccino?.isFavorite, true);
assert.equal(resolveMenuShortcut(catalog.items, '4')?.id, 'item_cappuccino');
assert.equal(resolveMenuShortcut(catalog.items, 'MGC')?.id, 'item_paneer');
assert.equal(catalog.items.filter((item) => item.isFavorite).length, 8);
assert.throws(() => logic.updateMenuItem('item_espresso', { shortcutNum: '4' }), /already used/);

const partBill = logic.createStaffOrder({
  tableCode: 'T11',
  customerName: 'Part',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 2, addonIds: [] }],
});
const partPaid = logic.markPaid(partBill.id, 'CASH', 50);
assert.equal(partPaid.paymentStatus, 'UNPAID');
assert.equal(dueTotal(partPaid), partBill.total - 50);
assert.equal(partPaid.payments[0].amount, 50);
assert.throws(() => logic.splitStaffOrder(partBill.id, 2), /part payment/);
const closedPart = logic.markPaid(partBill.id, 'CARD');
assert.equal(closedPart.paymentStatus, 'PAID');
assert.equal(closedPart.status, 'COMPLETED');
assert.equal(closedPart.payments.reduce((sum, payment) => sum + payment.amount, 0), partBill.total);

const splitSrc = logic.createStaffOrder({
  tableCode: 'T12',
  customerName: 'Split',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 2, addonIds: [] }],
});
const kids = logic.splitStaffOrder(splitSrc.id, 2);
assert.equal(kids.length, 2);
assert.equal(kids[0].total + kids[1].total, splitSrc.total);
assert.equal(kids[0].subtotal + kids[1].subtotal, splitSrc.subtotal);
assert.equal(logic.getOrder(splitSrc.id)?.status, 'CANCELLED');
assert.match(kids[0].notes, /SPLIT:1\/2/);
assert.match(kids[1].notes, /PARENT:/);
const tableNine = logic.listTables().find((table) => table.name === 'T12');
assert.equal(tableNine?.status, 'OCCUPIED');
assert.equal(tableNine?.openOrder?.due, splitSrc.total);
assert.equal(tableNine?.openOrder?.total, splitSrc.total);
assert.throws(() => logic.createStaffOrder({
  tableCode: 'T12',
  customerName: 'Blocked',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
}), /already has an open order/);
const extra = logic.createStaffOrder({
  tableCode: 'T12',
  customerName: 'Extra',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
  allowOpenTable: true,
});
assert.equal(extra.tableName, 'T12');
const paidChild = logic.markPaid(kids[0].id, 'UPI');
assert.equal(paidChild.paymentStatus, 'PAID');
const stillOpen = logic.listTables().find((table) => table.name === 'T12');
assert.equal(stillOpen?.status, 'OCCUPIED');
assert.ok((stillOpen?.openOrder?.due ?? 0) > 0);

const dueSync = logic.createStaffOrder({
  tableCode: 'T13',
  customerName: 'Due',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
  notes: 'DUE',
});
const syncedPart = logic.applySyncBatch([
  {
    id: 'q-part',
    operation: 'MARK_PAID',
    entityId: dueSync.id,
    payload: { method: 'CASH', amount: 40 },
  },
]);
assert.equal(syncedPart[0].ok, true);
assert.equal(syncedPart[0].order?.paymentStatus, 'UNPAID');
assert.equal(dueTotal(syncedPart[0].order!), dueSync.total - 40);

const settled = logic.createStaffOrder({
  tableCode: 'T14',
  customerName: 'Paid table',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
logic.markPaid(settled.id, 'CASH');
const paidTable = logic.listTables().find((table) => table.name === 'T14');
assert.equal(paidTable?.status, 'OCCUPIED');
assert.equal(paidTable?.openOrder?.paymentStatus, 'PAID');
assert.equal(paidTable?.openOrder?.due, 0);
logic.setTableStage(paidTable!.id, 'blank');
const clearedPaidTable = logic.listTables().find((table) => table.name === 'T14');
assert.equal(clearedPaidTable?.openOrder, null);
assert.equal(clearedPaidTable?.status, 'AVAILABLE');
assert.equal(tableVisualState(clearedPaidTable!), 'blank');
const reuse = logic.createStaffOrder({
  tableCode: 'T14',
  customerName: 'Next guest',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
assert.equal(reuse.tableName, 'T14');
assert.equal(reuse.paymentStatus, 'UNPAID');
const reused = logic.listTables().find((table) => table.name === 'T14');
assert.equal(reused?.openOrder?.id, reuse.id);
assert.equal(reused?.openOrder?.paymentStatus, 'UNPAID');
logic.transitionOrder(reuse.id, 'READY');
assert.equal(logic.listTables().find((table) => table.name === 'T14')?.openOrder?.status, 'READY');
logic.transitionOrder(reuse.id, 'SERVED');
assert.equal(logic.listTables().find((table) => table.name === 'T14')?.openOrder?.status, 'SERVED');

const todayYmd = formatZonedYmd('Asia/Kolkata');
const beforeReport = logic.reportRange(todayYmd, todayYmd);
const pickupSale = logic.createStaffOrder({
  customerName: 'Report pickup',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
  notes: 'MODE:PICKUP',
});
logic.markPaid(pickupSale.id, 'CASH');
const deliverySale = logic.createStaffOrder({
  customerName: 'Report delivery',
  customerMobile: '',
  items: [{ menuItemId: 'item_veg_club', quantity: 1, addonIds: [] }],
  notes: 'MODE:DELIVERY',
});
logic.markPaid(deliverySale.id, 'UPI');
const ncSale = logic.createStaffOrder({
  tableCode: 'T16',
  customerName: 'NC',
  customerMobile: '',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
  notes: 'COMPLIMENTARY\nMODE:DINE',
});
logic.markPaid(ncSale.id, 'OTHER');
const afterReport = logic.reportRange(todayYmd, todayYmd);
assert.equal(afterReport.bills, beforeReport.bills + 3);
assert.equal(afterReport.complimentary, beforeReport.complimentary + 1);
assert.equal(afterReport.ncAmount, beforeReport.ncAmount + ncSale.total);
assert.equal(afterReport.byChannel.pickup.amount, beforeReport.byChannel.pickup.amount + pickupSale.total);
assert.equal(afterReport.byChannel.delivery.amount, beforeReport.byChannel.delivery.amount + deliverySale.total);
assert.equal(afterReport.byMethod.CASH, beforeReport.byMethod.CASH + pickupSale.total);
assert.equal(afterReport.byMethod.UPI, beforeReport.byMethod.UPI + deliverySale.total);
assert.equal(afterReport.byMethod.OTHER, beforeReport.byMethod.OTHER);
assert.ok(afterReport.tickets.some((row) => row.id === pickupSale.id && row.channel === 'pickup'));
assert.ok(afterReport.tickets.some((row) => row.id === deliverySale.id && row.channel === 'delivery'));
assert.ok(afterReport.tickets.some((row) => row.id === ncSale.id && row.complimentary));
assert.ok(afterReport.items.some((row) => row.name === 'Classic Espresso' && row.qty >= 2));
const yesterdayReport = logic.reportRange(shiftYmd(todayYmd, -1), shiftYmd(todayYmd, -1));
assert.ok(!yesterdayReport.tickets.some((row) => row.id === pickupSale.id || row.id === deliverySale.id || row.id === ncSale.id));

const guest = logic.createCustomer('Riya', '9876500555');
assert.equal(guest.orderCount, 0);
assert.equal(guest.spent, 0);
const t17 = logic.listTables().find((table) => table.name === 'T17');
assert.ok(t17);
const hold = logic.createReservation({ tableId: t17!.id, customerName: 'Riya', customerMobile: '9876500555', covers: 4 });
assert.equal(hold.covers, 4);
const reserved = logic.listTables().find((table) => table.name === 'T17');
assert.equal(tableVisualState(reserved!), 'reserved');
assert.equal(reserved?.reservation?.customerName, 'Riya');
assert.throws(() => logic.createReservation({ tableId: t17!.id, customerName: 'Other', covers: 2 }), /already reserved/);
const seated = logic.createStaffOrder({
  tableCode: 'T17',
  customerName: 'Riya',
  customerMobile: '9876500555',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
assert.equal(seated.tableName, 'T17');
assert.equal(logic.listTables().find((table) => table.name === 'T17')?.reservation, null);
assert.equal(tableVisualState(logic.listTables().find((table) => table.name === 'T17')!), 'running');
const afterVisit = logic.listCustomers().find((customer) => customer.mobile === '9876500555');
assert.ok((afterVisit?.orderCount ?? 0) >= 1);
assert.ok((afterVisit?.spent ?? 0) >= seated.total);
const t19 = logic.listTables().find((table) => table.name === 'T19');
assert.ok(t19);
const holdTwo = logic.createReservation({ tableId: t19!.id, customerName: 'Wait', covers: 2 });
logic.cancelReservation(holdTwo.id);
assert.equal(logic.listTables().find((table) => table.name === 'T19')?.reservation, null);

const firstTableBill = logic.createStaffOrder({
  tableCode: 'T20',
  customerName: 'Michael',
  customerMobile: '9876500777',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
const secondTableBill = logic.placeGuestOrder({
  tableCode: 'T20',
  customerName: 'Olise',
  customerMobile: '9876500778',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
assert.equal(secondTableBill.id, firstTableBill.id);
assert.equal(secondTableBill.items.length, 1);
assert.equal(secondTableBill.items[0].quantity, 2);
const thirdTableBill = logic.placeGuestOrder({
  tableCode: 'T20',
  customerName: 'Olise',
  customerMobile: '9876500778',
  items: [{ menuItemId: 'item_veg_club', quantity: 1, addonIds: [] }],
});
assert.equal(thirdTableBill.id, firstTableBill.id);
assert.equal(thirdTableBill.items.length, 2);
assert.equal(logic.listOrders().filter((order) => order.tableName === 'T20' && ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(order.status)).length, 1);

const otpCombine = await logic.startCheckout({
  tableCode: 'T18',
  customerName: 'Neel',
  customerMobile: '9876500779',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
const otpCombineCode = otp.peekDevCode(otpCombine.challengeId!);
assert.ok(otpCombineCode);
const firstOtpBill = await logic.verifyCheckout(otpCombine.order.id, otpCombineCode);
const otpAgain = await logic.startCheckout({
  tableCode: 'T18',
  customerName: 'Kabir',
  customerMobile: '9876500780',
  items: [{ menuItemId: 'item_veg_club', quantity: 1, addonIds: [] }],
});
const otpAgainCode = otp.peekDevCode(otpAgain.challengeId!);
assert.ok(otpAgainCode);
const combinedOtpBill = await logic.verifyCheckout(otpAgain.order.id, otpAgainCode);
assert.equal(combinedOtpBill.id, firstOtpBill.id);
assert.equal(combinedOtpBill.items.length, 2);
assert.equal(logic.getOrder(otpAgain.order.id)?.status, 'CANCELLED');

logic.markPaid(thirdTableBill.id, 'UPI');
const afterPaid = logic.placeGuestOrder({
  tableCode: 'T20',
  customerName: 'Next',
  customerMobile: '9876500781',
  items: [{ menuItemId: 'item_espresso', quantity: 1, addonIds: [] }],
});
assert.notEqual(afterPaid.id, thirdTableBill.id);
assert.equal(afterPaid.items.length, 1);

console.log('server tests passed');
