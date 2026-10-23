import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { toPublicOrder } from '../shared/domain';
import {
  addonPatchSchema,
  categoryPatchSchema,
  checkoutStartSchema,
  checkoutVerifySchema,
  customerCreateSchema,
  itemGroupsSchema,
  loginSchema,
  mediaUploadSchema,
  menuItemCreateSchema,
  menuItemPatchSchema,
  moveSchema,
  tableStageSchema,
  orderTableSchema,
  paymentSchema,
  reservationCreateSchema,
  resendSchema,
  razorpayCreateSchema,
  razorpayVerifySchema,
  settingsPatchSchema,
  splitSchema,
  staffOrderPatchSchema,
  staffOrderSchema,
  statusSchema,
  syncBatchSchema,
  tableCreateSchema,
  tablePatchSchema,
  inventoryItemCreateSchema,
  inventoryItemPatchSchema,
  inventoryMovementSchema,
  menuRecipesSchema,
} from '../shared/schemas';
import {
  createInventoryItem,
  inventoryBundle,
  listRecipesForMenuItem,
  recordInventoryMovement,
  saveMenuRecipes,
  updateInventoryItem,
} from './inventory';
import { clearSessionCookie, createSession, destroySession, getSessionUser, readCookie, sessionCookie, verifyPassword } from './auth';
import { get } from './db';
import { dueTotal, OPEN_STATUSES } from '../shared/domain';
import { exposeDevOtp, isProduction, razorpayEnabled } from './env';
import { AppError, applySyncBatch, cancelCheckout, cancelReservation, clearAllCustomers, createCustomer, createMenuItem, createReservation, createStaffOrder, createTable, getOrder, listCustomerOrders, listCustomers, listOrders, listTables, loadCatalog, markPaid, moveMenuItem, placeGuestOrder, reassignOrderTable, replaceStaffOrderItems, reportRange, reportToday, resendOtp, setItemGroups, setTableStage, snapshot, splitStaffOrder, startCheckout, transitionOrder, updateAddon, updateCategory, updateMenuItem, updateSettings, updateTable, verifyCheckout } from './logic';
import { createRazorpayOrder, publicRazorpayKey, RazorpayError, verifyRazorpayPayment } from './razorpay';
import { otpProvider } from './otp';
import { openStream, touchDevice } from './realtime';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string; role: string };
    }
  }
}

const failures = new Map<string, { count: number; until: number }>();

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req.headers.cookie, 'habsos_session');
  const user = token ? getSessionUser(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Sign in required.', code: 'AUTH' });
    return;
  }
  req.user = user;
  next();
}

function idOf(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    next();
    return;
  }
  express.json({ limit: '256kb' })(req, res, next);
});
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/bootstrap', wrap((req, res) => {
  const catalog = loadCatalog();
  const tableCode = typeof req.query.table === 'string' ? req.query.table : '';
  const table = tableCode ? listTables().find((entry) => entry.qrCode.toUpperCase() === tableCode.toUpperCase() || entry.name.toUpperCase() === tableCode.toUpperCase()) : null;
  if (tableCode && !table) throw new AppError(404, 'TABLE', 'This table is not recognized. Scan the QR code on your table.');
  res.json({
    cafe: catalog.cafe,
    table: table ? { id: table.id, name: table.name, status: table.status } : null,
    categories: catalog.categories,
    items: catalog.items,
    addonGroups: catalog.addonGroups,
    payments: { razorpayKeyId: publicRazorpayKey() },
  });
}));

app.get('/api/payments/config', wrap((_req, res) => {
  res.json({ razorpayKeyId: publicRazorpayKey() });
}));

async function startRazorpayForOrder(orderId: string, amountPaise?: number) {
  const order = getOrder(orderId);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  if (order.paymentStatus === 'PAID') throw new AppError(409, 'PAYMENT', 'This order is already paid.');
  if (!OPEN_STATUSES.includes(order.status)) {
    throw new AppError(409, 'PAYMENT', 'This order cannot be paid online yet.');
  }
  const duePaise = dueTotal(order) * 100;
  const take = amountPaise ?? duePaise;
  if (!Number.isInteger(take) || take < 100 || take > duePaise) {
    throw new AppError(400, 'PAYMENT', 'Enter an amount up to the amount due.');
  }
  try {
    const receipt = order.orderNumber ? `bill-${order.orderNumber}` : order.id.slice(0, 8);
    const rzp = await createRazorpayOrder(take, receipt);
    return {
      orderId: order.id,
      amount: rzp.amount,
      currency: rzp.currency,
      razorpayOrderId: rzp.id,
      razorpayKeyId: publicRazorpayKey(),
      cafeName: loadCatalog().cafe.name,
    };
  } catch (error) {
    if (error instanceof RazorpayError) throw new AppError(503, 'PAYMENTS', error.message);
    throw error;
  }
}

function finishRazorpayForOrder(
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  const order = getOrder(orderId);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  try {
    verifyRazorpayPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  } catch (error) {
    if (error instanceof RazorpayError) throw new AppError(422, 'PAYMENTS', error.message);
    throw error;
  }
  const paid = markPaid(orderId, 'UPI');
  return paid;
}

app.post('/api/payments/razorpay/create', wrap(async (req, res) => {
  const body = razorpayCreateSchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, 'PAYMENTS', 'Online payments are not configured.');
  res.json(await startRazorpayForOrder(body.orderId, body.amount));
}));

app.post('/api/payments/razorpay/verify', wrap(async (req, res) => {
  const body = razorpayVerifySchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, 'PAYMENTS', 'Online payments are not configured.');
  const order = finishRazorpayForOrder(body.orderId, body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature);
  res.json({ order });
}));

app.post('/api/payments/razorpay/create-public', wrap(async (req, res) => {
  const body = razorpayCreateSchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, 'PAYMENTS', 'Online payments are not configured.');
  res.json(await startRazorpayForOrder(body.orderId, body.amount));
}));

app.post('/api/payments/razorpay/verify-public', wrap(async (req, res) => {
  const body = razorpayVerifySchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, 'PAYMENTS', 'Online payments are not configured.');
  const order = finishRazorpayForOrder(body.orderId, body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature);
  res.json({ order: toPublicOrder(order) });
}));

app.post('/api/checkout/place', wrap((req, res) => {
  const body = checkoutStartSchema.parse(req.body);
  const order = placeGuestOrder(body);
  res.status(201).json({ order: toPublicOrder(order) });
}));

app.post('/api/checkout/start', wrap(async (req, res) => {
  const body = checkoutStartSchema.parse(req.body);
  const result = await startCheckout(body);
  res.status(201).json({
    order: toPublicOrder(result.order),
    challengeId: result.challengeId,
    expiresAt: result.expiresAt,
    resendAfter: result.resendAfter ?? 30,
    ...(exposeDevOtp() && result.devCode ? { devCode: result.devCode } : {}),
  });
}));

app.post('/api/checkout/verify', wrap(async (req, res) => {
  const body = checkoutVerifySchema.parse(req.body);
  const order = await verifyCheckout(body.orderId, body.code);
  res.json({ order: toPublicOrder(order) });
}));

app.post('/api/checkout/resend', wrap(async (req, res) => {
  const body = resendSchema.parse(req.body);
  const result = await resendOtp(body.orderId);
  res.json({
    challengeId: result.challengeId,
    expiresAt: result.expiresAt,
    resendAfter: result.resendAfter,
    ...(exposeDevOtp() && result.devCode ? { devCode: result.devCode } : {}),
  });
}));

app.post('/api/checkout/cancel', wrap((req, res) => {
  const body = resendSchema.parse(req.body);
  cancelCheckout(body.orderId);
  res.json({ ok: true });
}));

app.get('/api/orders/:id/public', wrap((req, res) => {
  const order = getOrder(idOf(req.params.id));
  if (!order || order.status === 'DRAFT') throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  res.json({ order: toPublicOrder(order) });
}));

app.get('/api/orders/:id/events', wrap((req, res) => {
  const order = getOrder(idOf(req.params.id));
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  openStream(res, 'order', order.id);
}));

app.get('/api/menu/events', (_req, res) => {
  openStream(res, 'menu');
});

app.post('/api/auth/login', wrap(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const email = body.email.toLowerCase();
  const locked = failures.get(email);
  if (locked && locked.until > Date.now() && locked.count >= 8) {
    throw new AppError(429, 'LOCKED', 'Too many sign-in attempts. Wait a few minutes.');
  }
  const user = get<{ id: string; name: string; email: string; role: string; password_hash: string }>('SELECT id, name, email, role, password_hash FROM users WHERE email = ?', [email]);
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    const next = { count: (locked?.count ?? 0) + 1, until: Date.now() + 5 * 60 * 1000 };
    failures.set(email, next);
    throw new AppError(401, 'AUTH', 'Email or password is incorrect.');
  }
  failures.delete(email);
  const session = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(session.id, session.maxAge));
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}));

app.post('/api/auth/logout', (req, res) => {
  const token = readCookie(req.headers.cookie, 'habsos_session');
  if (token) destroySession(token);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = readCookie(req.headers.cookie, 'habsos_session');
  const user = token ? getSessionUser(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Sign in required.', code: 'AUTH' });
    return;
  }
  res.json({ user });
});

app.get('/api/sync/snapshot', requireAuth, wrap((_req, res) => {
  res.json(snapshot());
}));

app.post('/api/sync', requireAuth, wrap((req, res) => {
  const body = syncBatchSchema.parse(req.body);
  res.json({ results: applySyncBatch(body.operations) });
}));

app.get('/api/events', requireAuth, (req, res) => {
  const device = typeof req.query.device === 'string' ? req.query.device : '';
  if (device) touchDevice(device, 'POS');
  openStream(res, 'admin');
});

app.get('/api/orders', requireAuth, wrap((_req, res) => {
  res.json({ orders: listOrders() });
}));

app.get('/api/orders/:id', requireAuth, wrap((req, res) => {
  const order = getOrder(idOf(req.params.id));
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  res.json({ order });
}));

app.post('/api/orders', requireAuth, wrap((req, res) => {
  const body = staffOrderSchema.parse(req.body);
  const order = createStaffOrder(body);
  res.status(201).json({ order });
}));

app.patch('/api/orders/:id', requireAuth, wrap((req, res) => {
  const body = staffOrderPatchSchema.parse(req.body);
  const order = replaceStaffOrderItems(idOf(req.params.id), body);
  res.json({ order });
}));

app.post('/api/orders/:id/status', requireAuth, wrap((req, res) => {
  const body = statusSchema.parse(req.body);
  const order = transitionOrder(idOf(req.params.id), body.status);
  res.json({ order });
}));

app.post('/api/orders/:id/payments', requireAuth, wrap((req, res) => {
  const body = paymentSchema.parse(req.body);
  const order = markPaid(idOf(req.params.id), body.method, body.amount);
  res.json({ order });
}));

app.post('/api/orders/:id/split', requireAuth, wrap((req, res) => {
  const body = splitSchema.parse(req.body);
  const orders = splitStaffOrder(idOf(req.params.id), body.parts);
  res.json({ orders });
}));

app.post('/api/menu/items', requireAuth, wrap((req, res) => {
  const body = menuItemCreateSchema.parse(req.body);
  const item = createMenuItem(body);
  res.status(201).json({ item });
}));

app.post('/api/media/upload', requireAuth, wrap((req, res) => {
  const body = mediaUploadSchema.parse(req.body);
  const ext = body.mime === 'image/png' ? 'png' : body.mime === 'image/webp' ? 'webp' : 'jpg';
  const safe = body.filename.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'photo';
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}-${safe}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads');
  mkdirSync(dir, { recursive: true });
  const raw = body.contentBase64.replace(/^data:[^;]+;base64,/, '');
  writeFileSync(path.join(dir, name), Buffer.from(raw, 'base64'));
  res.json({ url: `/uploads/${name}` });
}));

app.patch('/api/menu/items/:id', requireAuth, wrap((req, res) => {
  const body = menuItemPatchSchema.parse(req.body);
  const item = updateMenuItem(idOf(req.params.id), body);
  res.json({ item });
}));

app.post('/api/menu/items/:id/move', requireAuth, wrap((req, res) => {
  const body = moveSchema.parse(req.body);
  const item = moveMenuItem(idOf(req.params.id), body.direction);
  res.json({ item });
}));

app.put('/api/menu/items/:id/groups', requireAuth, wrap((req, res) => {
  const body = itemGroupsSchema.parse(req.body);
  const item = setItemGroups(idOf(req.params.id), body.addonGroupIds);
  res.json({ item });
}));

app.patch('/api/menu/categories/:id', requireAuth, wrap((req, res) => {
  const body = categoryPatchSchema.parse(req.body);
  const category = updateCategory(idOf(req.params.id), body.name);
  res.json({ category });
}));

app.patch('/api/addons/:id', requireAuth, wrap((req, res) => {
  const body = addonPatchSchema.parse(req.body);
  const addon = updateAddon(idOf(req.params.id), body);
  res.json({ addon });
}));

app.get('/api/tables', requireAuth, wrap((_req, res) => {
  res.json({ tables: listTables() });
}));

app.post('/api/tables', requireAuth, wrap((req, res) => {
  const body = tableCreateSchema.parse(req.body);
  res.status(201).json({ table: createTable(body) });
}));

app.patch('/api/tables/:id', requireAuth, wrap((req, res) => {
  const body = tablePatchSchema.parse(req.body);
  const table = updateTable(idOf(req.params.id), body.status);
  res.json({ table });
}));

app.post('/api/tables/:id/stage', requireAuth, wrap((req, res) => {
  const body = tableStageSchema.parse(req.body);
  const table = setTableStage(idOf(req.params.id), body.stage);
  res.json({ table });
}));

app.patch('/api/orders/:id/table', requireAuth, wrap((req, res) => {
  const body = orderTableSchema.parse(req.body);
  res.json({ order: reassignOrderTable(idOf(req.params.id), body.tableId) });
}));

app.get('/api/customers', requireAuth, wrap((_req, res) => {
  res.json({ customers: listCustomers() });
}));

app.delete('/api/customers', requireAuth, wrap((_req, res) => {
  clearAllCustomers();
  res.json({ ok: true, customers: listCustomers() });
}));

app.post('/api/customers', requireAuth, wrap((req, res) => {
  const body = customerCreateSchema.parse(req.body);
  res.status(201).json({ customer: createCustomer(body.name, body.mobile) });
}));

app.get('/api/customers/:id/orders', requireAuth, wrap((req, res) => {
  res.json({ orders: listCustomerOrders(idOf(req.params.id)) });
}));

app.post('/api/reservations', requireAuth, wrap((req, res) => {
  const body = reservationCreateSchema.parse(req.body);
  res.status(201).json({ reservation: createReservation(body) });
}));

app.post('/api/reservations/:id/cancel', requireAuth, wrap((req, res) => {
  res.json({ table: cancelReservation(idOf(req.params.id)) });
}));

app.get('/api/reports', requireAuth, wrap((req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(reportRange(from, to));
}));

app.get('/api/reports/today', requireAuth, wrap((_req, res) => {
  res.json(reportToday());
}));

app.get('/api/settings', requireAuth, wrap((_req, res) => {
  const catalog = loadCatalog();
  res.json({ cafe: catalog.cafe, otpProvider: otpProvider.name, devOtp: exposeDevOtp() });
}));

app.patch('/api/settings', requireAuth, wrap((req, res) => {
  const body = settingsPatchSchema.parse(req.body);
  const cafe = updateSettings(body);
  res.json({ cafe });
}));

app.get('/api/inventory', requireAuth, wrap((_req, res) => {
  res.json(inventoryBundle());
}));

app.post('/api/inventory/items', requireAuth, wrap((req, res) => {
  const body = inventoryItemCreateSchema.parse(req.body);
  res.json({ item: createInventoryItem(body) });
}));

app.patch('/api/inventory/items/:id', requireAuth, wrap((req, res) => {
  const body = inventoryItemPatchSchema.parse(req.body);
  res.json({ item: updateInventoryItem(idOf(req.params.id), body) });
}));

app.post('/api/inventory/movements', requireAuth, wrap((req, res) => {
  const body = inventoryMovementSchema.parse(req.body);
  res.json({
    movement: recordInventoryMovement({
      ...body,
      actor: req.user?.name ?? 'staff',
    }),
  });
}));

app.get('/api/inventory/recipes/:menuItemId', requireAuth, wrap((req, res) => {
  res.json({ lines: listRecipesForMenuItem(idOf(req.params.menuItemId)) });
}));

app.put('/api/inventory/recipes/:menuItemId', requireAuth, wrap((req, res) => {
  const body = menuRecipesSchema.parse(req.body);
  res.json({ lines: saveMenuRecipes(idOf(req.params.menuItemId), body.lines) });
}));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.', code: 'NOT_FOUND' });
});

if (isProduction()) {
  const dist = path.resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message, code: error.code, details: error.details ?? null });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Check the form and try again.', code: 'VALIDATION' });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Invalid request.', code: 'JSON' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong.', code: 'SERVER' });
});
