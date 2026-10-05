"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/vercel.ts
var vercel_exports = {};
__export(vercel_exports, {
  default: () => handler,
  maxDuration: () => maxDuration
});
module.exports = __toCommonJS(vercel_exports);
var import_node_fs5 = require("node:fs");

// server/blobfile.ts
var import_node_fs3 = require("node:fs");
var import_blob = require("@vercel/blob");

// server/db.ts
var import_node_fs2 = require("node:fs");
var import_node_path = require("node:path");
var import_node_sqlite = require("node:sqlite");

// server/env.ts
var import_node_fs = require("node:fs");
if (process.env.VERCEL) {
  process.env.NODE_ENV = "production";
  process.env.DB_PATH = "/tmp/habsos.db";
}
if (process.argv.includes("--prod")) {
  process.env.NODE_ENV = "production";
}
function applyFile(file) {
  if (!(0, import_node_fs.existsSync)(file)) return;
  const text = (0, import_node_fs.readFileSync)(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === void 0) process.env[key] = value;
  }
}
applyFile(".env");
if (!(0, import_node_fs.existsSync)(".env")) applyFile(".env.example");
var env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8787),
  sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me",
  otpProvider: process.env.OTP_PROVIDER || "mock",
  otpDevExpose: process.env.OTP_DEV_EXPOSE === "true",
  adminEmail: process.env.ADMIN_EMAIL || "admin@habs.cafe",
  adminPassword: process.env.ADMIN_PASSWORD || "habsos-admin",
  dbPath: process.env.DB_PATH || "./data/habsos.db",
  smsAccountSid: process.env.SMS_ACCOUNT_SID || "",
  smsAuthToken: process.env.SMS_AUTH_TOKEN || "",
  smsFrom: process.env.SMS_FROM || ""
};
function isProduction() {
  return env.nodeEnv === "production";
}
function exposeDevOtp() {
  return !isProduction() && env.nodeEnv === "development" && env.otpDevExpose;
}

// server/db.ts
function openDatabase(file) {
  if (file !== ":memory:") (0, import_node_fs2.mkdirSync)((0, import_node_path.dirname)(file), { recursive: true });
  const database = new import_node_sqlite.DatabaseSync(file);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 4000");
  if (file !== ":memory:" && !file.startsWith("/tmp")) database.exec("PRAGMA journal_mode = WAL");
  database.exec(`
CREATE TABLE IF NOT EXISTS cafes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_bps INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  qr_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  image_url TEXT,
  is_veg INTEGER NOT NULL,
  is_available INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addon_groups (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  min_select INTEGER NOT NULL,
  max_select INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS addons (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES addon_groups(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  is_available INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_item_addon_groups (
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  addon_group_id TEXT NOT NULL REFERENCES addon_groups(id),
  PRIMARY KEY (menu_item_id, addon_group_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  last_order_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(cafe_id, mobile)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number INTEGER NOT NULL,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  table_id TEXT REFERENCES tables(id),
  table_name TEXT NOT NULL DEFAULT '',
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  total INTEGER NOT NULL,
  source TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  client_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE(cafe_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  menu_item_id TEXT,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS order_item_addons (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  addon_id TEXT,
  name_snapshot TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  order_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_counters (
  cafe_id TEXT PRIMARY KEY REFERENCES cafes(id),
  next_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_order ON otp_challenges(order_id, created_at);
`);
  return database;
}
var current = null;
function live() {
  if (!current) current = openDatabase(env.dbPath);
  return current;
}
var db = new Proxy({}, {
  get(_target, prop) {
    const database = live();
    const value = database[prop];
    if (typeof value === "function") return value.bind(database);
    return value;
  }
});
function adoptIncoming() {
  const incoming = `${env.dbPath}.incoming`;
  if (!(0, import_node_fs2.existsSync)(incoming)) return;
  try {
    current?.close();
  } catch {
  }
  current = null;
  (0, import_node_fs2.rmSync)(env.dbPath, { force: true });
  (0, import_node_fs2.rmSync)(`${env.dbPath}-wal`, { force: true });
  (0, import_node_fs2.rmSync)(`${env.dbPath}-shm`, { force: true });
  (0, import_node_fs2.renameSync)(incoming, env.dbPath);
  current = openDatabase(env.dbPath);
}
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
    }
    throw error;
  }
}

// server/blobfile.ts
var KEY = "habsos.db";
var seen = "";
function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
async function pullDatabase(dest) {
  if (!blobEnabled()) return "absent";
  try {
    const meta = await (0, import_blob.head)(KEY);
    if (meta.etag && meta.etag === seen) return "current";
    const downloaded = await (0, import_blob.get)(KEY, { access: "private", useCache: false, ifNoneMatch: seen || void 0 });
    if (!downloaded) return "absent";
    if (downloaded.statusCode === 304) {
      seen = meta.etag;
      return "current";
    }
    const bytes = Buffer.from(await new Response(downloaded.stream).arrayBuffer());
    (0, import_node_fs3.writeFileSync)(`${dest}.incoming`, bytes);
    seen = downloaded.blob.etag || meta.etag;
    return "written";
  } catch (error) {
    if (error instanceof import_blob.BlobNotFoundError) return "absent";
    console.error("Could not read the shared database.", error);
    return "absent";
  }
}
async function pushDatabase(src) {
  if (!blobEnabled()) return;
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
  }
  const saved = await (0, import_blob.put)(KEY, (0, import_node_fs3.readFileSync)(src), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
    cacheControlMaxAge: 60
  });
  if (saved.etag) seen = saved.etag;
}

// server/http.ts
var import_node_fs4 = require("node:fs");
var import_node_path2 = __toESM(require("node:path"), 1);
var import_express = __toESM(require("express"), 1);
var import_zod2 = require("zod");

// shared/domain.ts
var ORDER_STATUSES = [
  "DRAFT",
  "OTP_PENDING",
  "CONFIRMED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED"
];
var PAYMENT_METHODS = ["CASH", "UPI", "CARD", "OTHER"];
var OPEN_STATUSES = ["CONFIRMED", "ACCEPTED", "PREPARING", "READY", "SERVED"];
var TRANSITIONS = {
  DRAFT: ["OTP_PENDING", "CANCELLED"],
  OTP_PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["READY", "CANCELLED"],
  ACCEPTED: ["READY", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};
function canTransition(from, to) {
  return TRANSITIONS[from].includes(to);
}
function statusMessage(status) {
  switch (status) {
    case "CONFIRMED":
      return "Order placed";
    case "ACCEPTED":
      return "Accepted";
    case "PREPARING":
      return "Preparing";
    case "READY":
      return "Ready";
    case "SERVED":
      return "Served";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "OTP_PENDING":
      return "Waiting for verification";
    default:
      return status;
  }
}
var PriceError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PriceError";
  }
};
function computeTotals(subtotal, taxBps, discount = 0) {
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const taxable = subtotal - safeDiscount;
  const tax = Math.round(taxable * taxBps / 1e4);
  return { subtotal, discount: safeDiscount, tax, total: taxable + tax };
}
function priceCart(input) {
  if (!input.lines.length) throw new PriceError("Add at least one item.");
  if (input.lines.length > 30) throw new PriceError("Too many lines in one order.");
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  const lines = [];
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      throw new PriceError("Quantity must be between 1 and 20.");
    }
    const item = itemById.get(line.menuItemId);
    if (!item) throw new PriceError("An item in the cart is no longer on the menu.");
    if (!item.isAvailable) throw new PriceError(`${item.name} is sold out.`);
    const addonIds = line.addonIds ?? [];
    if (new Set(addonIds).size !== addonIds.length) throw new PriceError("Duplicate add-ons are not allowed.");
    const linked = item.addonGroupIds.map((id) => groupById.get(id)).filter((group) => Boolean(group));
    const allowed = /* @__PURE__ */ new Map();
    for (const group of linked) {
      for (const addon of group.addons) allowed.set(addon.id, { addon, group });
    }
    const chosen = [];
    for (const addonId of addonIds) {
      const found = allowed.get(addonId);
      if (!found) throw new PriceError(`That add-on is not available on ${item.name}.`);
      if (!found.addon.isAvailable) throw new PriceError(`${found.addon.name} is sold out.`);
      chosen.push({ addonId: found.addon.id, name: found.addon.name, price: found.addon.price });
    }
    for (const group of linked) {
      const count = chosen.filter((addon) => group.addons.some((candidate) => candidate.id === addon.addonId)).length;
      if (count < group.minSelect || count > group.maxSelect) {
        throw new PriceError(
          count > group.maxSelect ? `Choose at most ${group.maxSelect} in ${group.name}.` : `Choose at least ${group.minSelect} in ${group.name}.`
        );
      }
    }
    const addonSum = chosen.reduce((sum, addon) => sum + addon.price, 0);
    const notes = (line.notes ?? "").trim().slice(0, 180);
    lines.push({
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      quantity: line.quantity,
      notes,
      addons: chosen,
      total: (item.price + addonSum) * line.quantity
    });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  return { lines, ...computeTotals(subtotal, input.taxBps, input.discount ?? 0) };
}
function normalizeMobile(input) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
function startOfZonedDay(timeZone, now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const utcGuess = /* @__PURE__ */ new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const zoned = new Date(utcGuess.toLocaleString("en-US", { timeZone }));
  return new Date(utcGuess.getTime() + (utcGuess.getTime() - zoned.getTime()));
}
function toPublicOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableName: order.tableName,
    customerName: order.customerName,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items,
    events: order.events
  };
}

// shared/schemas.ts
var import_zod = require("zod");
var cartLineSchema = import_zod.z.object({
  menuItemId: import_zod.z.string().trim().min(1).max(80),
  quantity: import_zod.z.number().int().min(1).max(20),
  addonIds: import_zod.z.array(import_zod.z.string().trim().min(1).max(80)).max(12).default([]),
  notes: import_zod.z.string().max(180).optional().default("")
});
var checkoutStartSchema = import_zod.z.object({
  tableCode: import_zod.z.string().trim().min(2).max(12),
  customerName: import_zod.z.string().trim().min(1).max(80),
  customerMobile: import_zod.z.string().trim().min(8).max(20),
  items: import_zod.z.array(cartLineSchema).min(1).max(30),
  clientKey: import_zod.z.string().uuid().optional()
});
var checkoutVerifySchema = import_zod.z.object({
  orderId: import_zod.z.string().uuid(),
  code: import_zod.z.string().regex(/^\d{6}$/)
});
var resendSchema = import_zod.z.object({
  orderId: import_zod.z.string().uuid()
});
var staffOrderSchema = import_zod.z.object({
  id: import_zod.z.string().uuid().optional(),
  tableId: import_zod.z.string().trim().min(1).max(80).nullable().optional(),
  tableCode: import_zod.z.string().trim().min(2).max(12).optional(),
  customerName: import_zod.z.string().trim().min(1).max(80),
  customerMobile: import_zod.z.string().trim().max(20).optional().default(""),
  items: import_zod.z.array(cartLineSchema).min(1).max(30),
  clientKey: import_zod.z.string().uuid().optional()
});
var statusSchema = import_zod.z.object({
  status: import_zod.z.enum(ORDER_STATUSES)
});
var paymentSchema = import_zod.z.object({
  method: import_zod.z.enum(PAYMENT_METHODS)
});
var menuItemPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80),
  description: import_zod.z.string().trim().max(400),
  price: import_zod.z.number().int().min(0).max(1e5),
  isAvailable: import_zod.z.boolean(),
  imageUrl: import_zod.z.string().trim().max(500).nullable().optional(),
  isVeg: import_zod.z.boolean().optional()
});
var addonPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80),
  price: import_zod.z.number().int().min(0).max(1e5),
  isAvailable: import_zod.z.boolean()
});
var itemGroupsSchema = import_zod.z.object({
  addonGroupIds: import_zod.z.array(import_zod.z.string().trim().min(1).max(80)).max(12)
});
var categoryPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(40)
});
var moveSchema = import_zod.z.object({
  direction: import_zod.z.enum(["up", "down"])
});
var tablePatchSchema = import_zod.z.object({
  status: import_zod.z.enum(["AVAILABLE", "OCCUPIED"])
});
var settingsPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80).optional(),
  taxBps: import_zod.z.number().int().min(0).max(2800).optional()
});
var syncOpSchema = import_zod.z.object({
  id: import_zod.z.string().min(1).max(80),
  operation: import_zod.z.enum([
    "CREATE_ORDER",
    "UPDATE_ORDER",
    "MARK_PREPARING",
    "MARK_READY",
    "MARK_PAID",
    "UPDATE_MENU",
    "UPDATE_ADDON",
    "UPDATE_TABLE"
  ]),
  entity: import_zod.z.string().min(1).max(40),
  entityId: import_zod.z.string().min(1).max(80),
  payload: import_zod.z.unknown(),
  createdAt: import_zod.z.string().min(4).max(40)
});
var syncBatchSchema = import_zod.z.object({
  operations: import_zod.z.array(syncOpSchema).max(50)
});
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().trim().email().max(120),
  password: import_zod.z.string().min(4).max(120)
});

// server/auth.ts
var import_node_crypto = require("node:crypto");
var import_node_util = require("node:util");
var scryptAsync = (0, import_node_util.promisify)(import_node_crypto.scrypt);
var SESSION_MS = 16 * 60 * 60 * 1e3;
async function hashPassword(password) {
  const salt = (0, import_node_crypto.randomBytes)(16).toString("hex");
  const derived = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const derived = await scryptAsync(password, salt, 32);
  const actual = Buffer.from(hex, "hex");
  if (actual.length !== derived.length) return false;
  return (0, import_node_crypto.timingSafeEqual)(actual, derived);
}
function createSession(userId) {
  const id = (0, import_node_crypto.randomUUID)();
  const now = /* @__PURE__ */ new Date();
  const expires = new Date(now.getTime() + SESSION_MS).toISOString();
  run("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [id, userId, expires, now.toISOString()]);
  return { id, maxAge: Math.floor(SESSION_MS / 1e3) };
}
function destroySession(id) {
  run("DELETE FROM sessions WHERE id = ?", [id]);
}
function getSessionUser(token) {
  const row = get(
    `SELECT u.id, u.name, u.email, u.role, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [token]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}
function sessionCookie(token, maxAge) {
  const secure = isProduction() ? "; Secure" : "";
  return `habsos_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
function clearSessionCookie() {
  const secure = isProduction() ? "; Secure" : "";
  return `habsos_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

// server/logic.ts
var import_node_crypto4 = require("node:crypto");

// server/ids.ts
var CAFE_ID = "cafe_habsos";

// server/otp.ts
var import_node_crypto2 = require("node:crypto");
var devCodes = /* @__PURE__ */ new Map();
function rememberDevCode(challengeId, code) {
  if (!isProduction()) devCodes.set(challengeId, code);
}
function peekDevCode(challengeId) {
  return devCodes.get(challengeId);
}
function hashCode(challengeId, code) {
  return (0, import_node_crypto2.createHash)("sha256").update(`${env.sessionSecret}:${challengeId}:${code}`).digest("hex");
}
function makeOtpCode() {
  return String((0, import_node_crypto2.randomInt)(0, 1e6)).padStart(6, "0");
}
function hashOtp(challengeId, code) {
  return hashCode(challengeId, code);
}
function hashesMatch(expected, actual) {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return (0, import_node_crypto2.timingSafeEqual)(left, right);
}
var MockOtpProvider = class {
  name = "mock";
  async sendOtp(input) {
    if (!isProduction() && env.otpDevExpose && env.nodeEnv === "development") {
      console.info(`[otp:dev] ${input.mobile} ${input.code}`);
    }
    return { providerRef: `mock:${input.mobile}` };
  }
  async verifyOtp(input) {
    const actual = hashCode(input.challengeId, input.code);
    return hashesMatch(input.codeHash, actual) ? "VERIFIED" : "FAILED";
  }
};
var SmsOtpProvider = class {
  name = "sms";
  async sendOtp(input) {
    if (!env.smsAccountSid || !env.smsAuthToken || !env.smsFrom) {
      throw new Error("SMS provider is not configured");
    }
    const body = new URLSearchParams({
      To: `+91${input.mobile}`,
      From: env.smsFrom,
      Body: `Your After Dunes code is ${input.code}`
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.smsAccountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.smsAccountSid}:${env.smsAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) {
      throw new Error("SMS provider rejected the message");
    }
    const json = await response.json();
    return { providerRef: json.sid || "sms" };
  }
  async verifyOtp(input) {
    const actual = hashCode(input.challengeId, input.code);
    return hashesMatch(input.codeHash, actual) ? "VERIFIED" : "FAILED";
  }
};
function createOtpProvider() {
  if (env.otpProvider === "sms") return new SmsOtpProvider();
  if (env.otpProvider !== "mock" && isProduction()) {
    throw new Error(`Unknown OTP provider: ${env.otpProvider}`);
  }
  return new MockOtpProvider();
}
var otpProvider = createOtpProvider();

// server/realtime.ts
var import_node_crypto3 = require("node:crypto");
var clients = /* @__PURE__ */ new Set();
function addClient(client) {
  clients.add(client);
  return () => clients.delete(client);
}
function write(client, payload) {
  client.res.write(`data: ${JSON.stringify(payload)}

`);
}
function publish(event) {
  for (const client of clients) {
    try {
      if (client.kind === "menu") {
        if (event.type === "menu.updated" || event.type === "addon.updated") write(client, event);
        continue;
      }
      if (client.kind === "order") {
        if (event.type === "order.upsert" && event.order.id === client.orderId) {
          write(client, { type: "order.upsert", order: toPublicOrder(event.order) });
        }
        continue;
      }
      write(client, event);
    } catch {
      clients.delete(client);
    }
  }
}
function openStream(res, kind, orderId) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write("\n");
  const id = (0, import_node_crypto3.randomUUID)();
  const remove = addClient({ id, res, kind, orderId });
  res.on("close", () => remove());
  return id;
}
function touchDevice(deviceId, name = "POS") {
  const clean = deviceId.replace(/[^\w-]/g, "").slice(0, 80);
  if (!clean) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `INSERT INTO devices (id, cafe_id, name, last_seen_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, name = excluded.name`,
    [clean, CAFE_ID, name.slice(0, 80), now]
  );
}
var timer = setInterval(() => {
  for (const client of clients) {
    try {
      write(client, { type: "ping" });
    } catch {
      clients.delete(client);
    }
  }
}, 2e4);
timer.unref?.();

// server/logic.ts
var AppError = class extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
  status;
  code;
  details;
};
var OTP_TTL_MS = 5 * 60 * 1e3;
var OTP_COOLDOWN_MS = 30 * 1e3;
var OTP_MAX_ATTEMPTS = 5;
var OTP_WINDOW_MS = 15 * 60 * 1e3;
function cleanName(name) {
  const value = name.trim().replace(/\s+/g, " ");
  if (!value || value.length > 80 || /[\u0000-\u001F]/.test(value)) {
    throw new AppError(400, "NAME", "Enter a valid name.");
  }
  return value;
}
function cleanImage(url) {
  if (!url || !url.trim()) return null;
  const value = url.trim();
  if (value.length > 500 || !/^https?:\/\//i.test(value) && !value.startsWith("/")) {
    throw new AppError(400, "IMAGE", "Image must be an http(s) URL.");
  }
  return value;
}
function quoteOrThrow(lines, discount = 0) {
  const catalog = loadCatalog();
  try {
    return priceCart({
      lines,
      items: catalog.items,
      groups: catalog.addonGroups,
      taxBps: catalog.cafe.taxBps,
      discount
    });
  } catch (error) {
    if (error instanceof PriceError) throw new AppError(400, "CART", error.message);
    throw error;
  }
}
function loadCatalog() {
  const cafeRow = get("SELECT id, name, tax_bps, timezone FROM cafes WHERE id = ?", [CAFE_ID]);
  if (!cafeRow) throw new AppError(500, "CAFE", "Cafe is not set up.");
  const cafe = {
    id: cafeRow.id,
    name: cafeRow.name,
    taxBps: cafeRow.tax_bps,
    timezone: cafeRow.timezone
  };
  const categories = all("SELECT id, name, sort_order FROM menu_categories WHERE cafe_id = ? ORDER BY sort_order, name", [CAFE_ID]).map(
    (row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order })
  );
  const groupRows = all(
    "SELECT id, name, min_select, max_select, sort_order FROM addon_groups WHERE cafe_id = ? ORDER BY sort_order, name",
    [CAFE_ID]
  );
  const addonRows = all(
    `SELECT a.id, a.group_id, a.name, a.price, a.is_available, a.sort_order
     FROM addons a JOIN addon_groups g ON g.id = a.group_id
     WHERE g.cafe_id = ? ORDER BY a.sort_order, a.name`,
    [CAFE_ID]
  );
  const addonGroups = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    minSelect: group.min_select,
    maxSelect: group.max_select,
    sortOrder: group.sort_order,
    addons: addonRows.filter((addon) => addon.group_id === group.id).map(
      (addon) => ({
        id: addon.id,
        groupId: addon.group_id,
        name: addon.name,
        price: addon.price,
        isAvailable: addon.is_available === 1,
        sortOrder: addon.sort_order
      })
    )
  }));
  const links = all("SELECT menu_item_id, addon_group_id FROM menu_item_addon_groups");
  const items = all("SELECT id, category_id, name, description, price, image_url, is_veg, is_available, sort_order FROM menu_items WHERE cafe_id = ? ORDER BY sort_order, name", [CAFE_ID]).map(
    (row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: row.price,
      imageUrl: row.image_url,
      isVeg: row.is_veg === 1,
      isAvailable: row.is_available === 1,
      sortOrder: row.sort_order,
      addonGroupIds: links.filter((link) => link.menu_item_id === row.id).map((link) => link.addon_group_id)
    })
  );
  return { cafe, categories, items, addonGroups };
}
function hydrate(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const marks = ids.map(() => "?").join(",");
  const itemRows = all(`SELECT * FROM order_items WHERE order_id IN (${marks})`, ids);
  const itemIds = itemRows.map((row) => row.id);
  const addonRows = itemIds.length ? all(`SELECT * FROM order_item_addons WHERE order_item_id IN (${itemIds.map(() => "?").join(",")})`, itemIds) : [];
  const eventRows = all(`SELECT id, order_id, type, message, created_at, actor FROM order_events WHERE order_id IN (${marks}) ORDER BY created_at ASC`, ids);
  const paymentRows = all(`SELECT id, order_id, method, amount, status, created_at FROM payments WHERE order_id IN (${marks}) ORDER BY created_at ASC`, ids);
  return rows.map((row) => {
    const items = itemRows.filter((item) => item.order_id === row.id).map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      nameSnapshot: item.name_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
      notes: item.notes,
      addons: addonRows.filter((addon) => addon.order_item_id === item.id).map(
        (addon) => ({
          id: addon.id,
          addonId: addon.addon_id,
          nameSnapshot: addon.name_snapshot,
          priceSnapshot: addon.price_snapshot
        })
      )
    }));
    const events = eventRows.filter((event) => event.order_id === row.id).map((event) => ({ id: event.id, type: event.type, message: event.message, createdAt: event.created_at, actor: event.actor }));
    const payments = paymentRows.filter((payment) => payment.order_id === row.id).map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.created_at
    }));
    return {
      id: row.id,
      orderNumber: row.order_number,
      cafeId: row.cafe_id,
      tableId: row.table_id,
      tableName: row.table_name || null,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerMobile: row.customer_mobile,
      status: row.status,
      paymentStatus: row.payment_status,
      subtotal: row.subtotal,
      tax: row.tax,
      discount: row.discount,
      total: row.total,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
      items,
      events,
      payments
    };
  });
}
var ORDER_SELECT = `SELECT o.id, o.order_number, o.cafe_id, o.table_id, o.table_name, o.customer_id, o.customer_name, o.customer_mobile,
  o.status, o.payment_status, o.subtotal, o.tax, o.discount, o.total, o.source, o.notes, o.created_at, o.updated_at, o.synced_at
  FROM orders o`;
function getOrder(id) {
  const row = get(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  return row ? hydrate([row])[0] : null;
}
function getOrderByClientKey(clientKey) {
  const row = get(`${ORDER_SELECT} WHERE o.client_key = ?`, [clientKey]);
  return row ? hydrate([row])[0] : null;
}
function insertPricedOrder(input) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const orderNumber = takeNumber();
  run(
    `INSERT INTO orders (
      id, order_number, cafe_id, table_id, table_name, customer_id, customer_name, customer_mobile,
      status, payment_status, subtotal, tax, discount, total, source, notes, client_key, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
    [
      input.id,
      orderNumber,
      CAFE_ID,
      input.tableId,
      input.tableName,
      input.customerName,
      input.customerMobile,
      input.status,
      input.quote.subtotal,
      input.quote.tax,
      input.quote.discount,
      input.quote.total,
      input.source,
      input.clientKey,
      now,
      now,
      now
    ]
  );
  for (const line of input.quote.lines) {
    const itemId = (0, import_node_crypto4.randomUUID)();
    run(
      `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, input.id, line.menuItemId, line.name, line.quantity, line.unitPrice, line.total, line.notes]
    );
    for (const addon of line.addons) {
      run(
        `INSERT INTO order_item_addons (id, order_item_id, addon_id, name_snapshot, price_snapshot) VALUES (?, ?, ?, ?, ?)`,
        [(0, import_node_crypto4.randomUUID)(), itemId, addon.addonId, addon.name, addon.price]
      );
    }
  }
  if (input.eventMessage) {
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      [(0, import_node_crypto4.randomUUID)(), input.id, "status", input.eventMessage, input.status, now, input.actor]
    );
  }
  if (OPEN_STATUSES.includes(input.status)) refreshTable(input.tableId);
  return getOrder(input.id);
}
function takeNumber() {
  const row = get("SELECT next_number FROM order_counters WHERE cafe_id = ?", [CAFE_ID]);
  if (!row) throw new AppError(500, "COUNTER", "Order counter is missing.");
  run("UPDATE order_counters SET next_number = ? WHERE cafe_id = ?", [row.next_number + 1, CAFE_ID]);
  return row.next_number;
}
function refreshTable(tableId) {
  if (!tableId) return;
  const open = get(
    `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
    [tableId]
  );
  run("UPDATE tables SET status = ?, updated_at = ? WHERE id = ?", [(open?.n ?? 0) > 0 ? "OCCUPIED" : "AVAILABLE", (/* @__PURE__ */ new Date()).toISOString(), tableId]);
}
function findTable(tableId, tableCode) {
  if (tableId) {
    const byId = get("SELECT id, name, qr_code, status FROM tables WHERE id = ? AND cafe_id = ?", [tableId, CAFE_ID]);
    if (byId) return byId;
  }
  if (tableCode) {
    const code = tableCode.trim().toUpperCase();
    const byCode = get("SELECT id, name, qr_code, status FROM tables WHERE cafe_id = ? AND (qr_code = ? OR name = ?)", [CAFE_ID, code, code]);
    if (byCode) return byCode;
  }
  return null;
}
function upsertCustomer(name, mobile, when) {
  const existing = get("SELECT id FROM customers WHERE cafe_id = ? AND mobile = ?", [CAFE_ID, mobile]);
  if (!existing) {
    const id = (0, import_node_crypto4.randomUUID)();
    run("INSERT INTO customers (id, cafe_id, name, mobile, order_count, last_order_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)", [id, CAFE_ID, name, mobile, when, when]);
    return id;
  }
  run("UPDATE customers SET name = ?, order_count = order_count + 1, last_order_at = ? WHERE id = ?", [name, when, existing.id]);
  return existing.id;
}
function assertStillAvailable(order) {
  for (const item of order.items) {
    if (!item.menuItemId) continue;
    const row = get("SELECT is_available, name FROM menu_items WHERE id = ?", [item.menuItemId]);
    if (!row || row.is_available !== 1) {
      throw new AppError(409, "SOLD_OUT", `${item.nameSnapshot} is sold out.`);
    }
    for (const addon of item.addons) {
      if (!addon.addonId) continue;
      const addonRow = get("SELECT is_available, name FROM addons WHERE id = ?", [addon.addonId]);
      if (!addonRow || addonRow.is_available !== 1) {
        throw new AppError(409, "SOLD_OUT", `${addon.nameSnapshot} is sold out.`);
      }
    }
  }
}
function notify(order) {
  if (!order || order.status === "OTP_PENDING" || order.status === "DRAFT") return;
  publish({ type: "order.upsert", order });
  if (order.tableId) publish({ type: "table.updated", tableId: order.tableId });
}
function latestChallenge(orderId) {
  return get("SELECT id, mobile, code_hash, status, expires_at, attempts, provider_ref, created_at FROM otp_challenges WHERE order_id = ? ORDER BY created_at DESC LIMIT 1", [orderId]);
}
async function issueOtp(orderId, mobile) {
  const since = new Date(Date.now() - OTP_WINDOW_MS).toISOString();
  const burst = get("SELECT COUNT(*) AS n FROM otp_challenges WHERE mobile = ? AND created_at >= ?", [mobile, since]);
  if ((burst?.n ?? 0) >= 5) throw new AppError(429, "OTP_LIMIT", "Too many codes sent. Wait a few minutes.");
  const last = latestChallenge(orderId);
  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const retryAfter = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1e3);
      throw new AppError(429, "OTP_COOLDOWN", `Wait ${retryAfter}s before resending.`, { retryAfter });
    }
  }
  const id = (0, import_node_crypto4.randomUUID)();
  const code = makeOtpCode();
  const sent = await otpProvider.sendOtp({ mobile, code });
  rememberDevCode(id, code);
  const now = /* @__PURE__ */ new Date();
  const expires = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  run(
    `INSERT INTO otp_challenges (id, mobile, code_hash, status, expires_at, attempts, provider, provider_ref, order_id, created_at)
     VALUES (?, ?, ?, 'OTP_PENDING', ?, 0, ?, ?, ?, ?)`,
    [id, mobile, hashOtp(id, code), expires, otpProvider.name, sent.providerRef, orderId, now.toISOString()]
  );
  if (last && last.status === "OTP_PENDING") {
    run(`UPDATE otp_challenges SET status = 'EXPIRED' WHERE id = ?`, [last.id]);
  }
  return {
    challengeId: id,
    expiresAt: expires,
    resendAfter: 30,
    devCode: peekDevCode(id)
  };
}
async function currentOtp(orderId, mobile) {
  const last = latestChallenge(orderId);
  if (last && last.status === "OTP_PENDING" && new Date(last.expires_at).getTime() > Date.now() && last.attempts < OTP_MAX_ATTEMPTS) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    return {
      challengeId: last.id,
      expiresAt: last.expires_at,
      resendAfter: Math.max(0, Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1e3)),
      devCode: peekDevCode(last.id)
    };
  }
  return issueOtp(orderId, mobile);
}
function placeGuestOrder(input) {
  const mobile = normalizeMobile(input.customerMobile);
  if (!mobile) throw new AppError(400, "MOBILE", "Enter a valid 10-digit mobile number.");
  const name = cleanName(input.customerName);
  const table = findTable(null, input.tableCode);
  if (!table) throw new AppError(404, "TABLE", "This table is not recognized. Scan the QR code on your table.");
  if (input.clientKey) {
    const existing = getOrderByClientKey(input.clientKey);
    if (existing && !["CANCELLED", "OTP_PENDING", "DRAFT"].includes(existing.status)) return existing;
  }
  const id = input.clientKey ?? (0, import_node_crypto4.randomUUID)();
  const order = tx(() => {
    const quote = quoteOrThrow(input.items);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const customerId = upsertCustomer(name, mobile, now);
    const created = insertPricedOrder({
      id,
      clientKey: input.clientKey ?? id,
      tableId: table.id,
      tableName: table.name,
      customerName: name,
      customerMobile: mobile,
      status: "CONFIRMED",
      source: "QR",
      quote,
      actor: "customer",
      eventMessage: statusMessage("CONFIRMED")
    });
    run(`UPDATE orders SET customer_id = ? WHERE id = ?`, [customerId, created.id]);
    return getOrder(created.id);
  });
  notify(order);
  return order;
}
async function startCheckout(input) {
  const mobile = normalizeMobile(input.customerMobile);
  if (!mobile) throw new AppError(400, "MOBILE", "Enter a valid 10-digit mobile number.");
  const name = cleanName(input.customerName);
  const table = findTable(null, input.tableCode);
  if (!table) throw new AppError(404, "TABLE", "This table is not recognized. Scan the QR code on your table.");
  if (input.clientKey) {
    const existing = getOrderByClientKey(input.clientKey);
    if (existing && (existing.status === "OTP_PENDING" || existing.status === "CONFIRMED")) {
      const otp = existing.status === "OTP_PENDING" ? await currentOtp(existing.id, existing.customerMobile) : null;
      return { order: existing, ...otp };
    }
  }
  const id = input.clientKey ?? (0, import_node_crypto4.randomUUID)();
  const order = tx(() => {
    const quote = quoteOrThrow(input.items);
    return insertPricedOrder({
      id,
      clientKey: input.clientKey ?? id,
      tableId: table.id,
      tableName: table.name,
      customerName: name,
      customerMobile: mobile,
      status: "OTP_PENDING",
      source: "QR",
      quote,
      actor: "customer",
      eventMessage: null
    });
  });
  try {
    const otp = await issueOtp(order.id, mobile);
    return { order, ...otp };
  } catch (error) {
    tx(() => {
      run(`UPDATE orders SET status = 'CANCELLED', updated_at = ? WHERE id = ? AND status = 'OTP_PENDING'`, [(/* @__PURE__ */ new Date()).toISOString(), order.id]);
    });
    throw error;
  }
}
async function resendOtp(orderId) {
  const order = getOrder(orderId);
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  if (order.status !== "OTP_PENDING") throw new AppError(409, "STATE", "This order is no longer waiting for a code.");
  const otp = await issueOtp(order.id, order.customerMobile);
  return { order, ...otp };
}
async function verifyCheckout(orderId, code) {
  const existing = getOrder(orderId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Order not found.");
  if (existing.status === "CONFIRMED" || OPEN_STATUSES.includes(existing.status)) return existing;
  if (existing.status !== "OTP_PENDING") throw new AppError(409, "STATE", "This order can no longer be verified.");
  const challenge = latestChallenge(orderId);
  if (!challenge) throw new AppError(400, "OTP", "Request a code first.");
  if (new Date(challenge.expires_at).getTime() <= Date.now() || challenge.status === "EXPIRED") {
    run(`UPDATE otp_challenges SET status = 'EXPIRED' WHERE id = ?`, [challenge.id]);
    throw new AppError(422, "OTP_EXPIRED", "That code has expired. Request a new one.");
  }
  if (challenge.status === "FAILED" || challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(422, "OTP_FAILED", "Too many attempts. Request a new code.");
  }
  const result = await otpProvider.verifyOtp({
    mobile: challenge.mobile,
    code,
    challengeId: challenge.id,
    providerRef: challenge.provider_ref,
    codeHash: challenge.code_hash
  });
  if (result !== "VERIFIED") {
    const attempts = challenge.attempts + 1;
    run(`UPDATE otp_challenges SET attempts = ?, status = ? WHERE id = ?`, [attempts, attempts >= OTP_MAX_ATTEMPTS ? "FAILED" : "OTP_PENDING", challenge.id]);
    if (attempts >= OTP_MAX_ATTEMPTS) throw new AppError(422, "OTP_FAILED", "Too many attempts. Request a new code.");
    throw new AppError(422, "OTP_INVALID", "That code is not correct.");
  }
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current2.status === "CONFIRMED") return current2;
    if (current2.status !== "OTP_PENDING") throw new AppError(409, "STATE", "This order can no longer be verified.");
    assertStillAvailable(current2);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const customerId = current2.customerMobile ? upsertCustomer(current2.customerName, current2.customerMobile, now) : null;
    run(
      `UPDATE orders SET status = 'CONFIRMED', customer_id = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
      [customerId, now, now, orderId]
    );
    run(`UPDATE otp_challenges SET status = 'VERIFIED' WHERE id = ?`, [challenge.id]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, 'OTP_PENDING', 'CONFIRMED', ?, 'customer')`,
      [(0, import_node_crypto4.randomUUID)(), orderId, statusMessage("CONFIRMED"), now]
    );
    refreshTable(current2.tableId);
    return getOrder(orderId);
  });
  notify(order);
  return order;
}
function cancelCheckout(orderId) {
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) return null;
    if (current2.status !== "OTP_PENDING") return current2;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run(`UPDATE orders SET status = 'CANCELLED', updated_at = ? WHERE id = ?`, [now, orderId]);
    run(`UPDATE otp_challenges SET status = 'EXPIRED' WHERE order_id = ? AND status = 'OTP_PENDING'`, [orderId]);
    return getOrder(orderId);
  });
  return order;
}
function createStaffOrder(input) {
  const key = input.clientKey ?? input.id ?? null;
  if (key) {
    const existing = getOrder(key) ?? getOrderByClientKey(key);
    if (existing) return existing;
  }
  const mobile = input.customerMobile?.trim() ? normalizeMobile(input.customerMobile) : "";
  if (input.customerMobile?.trim() && !mobile) throw new AppError(400, "MOBILE", "Enter a valid 10-digit mobile number.");
  const name = cleanName(input.customerName);
  const table = findTable(input.tableId, input.tableCode);
  if ((input.tableId || input.tableCode) && !table) throw new AppError(404, "TABLE", "Table not found.");
  const id = input.id ?? (0, import_node_crypto4.randomUUID)();
  const order = tx(() => {
    const quote = quoteOrThrow(input.items);
    const created = insertPricedOrder({
      id,
      clientKey: key ?? id,
      tableId: table?.id ?? null,
      tableName: table?.name ?? "",
      customerName: name,
      customerMobile: mobile || "",
      status: "CONFIRMED",
      source: "POS",
      quote,
      actor: "staff",
      eventMessage: statusMessage("CONFIRMED")
    });
    if (mobile) {
      const customerId = upsertCustomer(name, mobile, created.createdAt);
      run("UPDATE orders SET customer_id = ? WHERE id = ?", [customerId, id]);
    }
    return getOrder(id);
  });
  notify(order);
  return order;
}
function transitionOrder(orderId, to, actor = "staff") {
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current2.status === to) return current2;
    if (!canTransition(current2.status, to)) {
      throw new AppError(409, "TRANSITION", `Cannot move an order from ${current2.status} to ${to}.`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", [to, now, orderId]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, ?, ?, ?)`,
      [(0, import_node_crypto4.randomUUID)(), orderId, statusMessage(to), current2.status, to, now, actor]
    );
    refreshTable(current2.tableId);
    return getOrder(orderId);
  });
  notify(order);
  return order;
}
function markPaid(orderId, method) {
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current2.status === "CANCELLED" || current2.status === "DRAFT" || current2.status === "OTP_PENDING") {
      throw new AppError(409, "PAYMENT", "This order cannot be marked paid.");
    }
    if (!PAYMENT_METHODS.includes(method)) throw new AppError(400, "PAYMENT", "Unknown payment method.");
    if (current2.paymentStatus === "PAID") return current2;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run("INSERT INTO payments (id, order_id, method, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", [(0, import_node_crypto4.randomUUID)(), orderId, method, current2.total, "PAID", now]);
    run(`UPDATE orders SET payment_status = 'PAID', updated_at = ? WHERE id = ?`, [now, orderId]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'payment', 'Paid', ?, 'PAID', ?, 'staff')`,
      [(0, import_node_crypto4.randomUUID)(), orderId, current2.paymentStatus, now]
    );
    return getOrder(orderId);
  });
  notify(order);
  return order;
}
function itemEvent(item) {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    isVeg: item.isVeg,
    isAvailable: item.isAvailable,
    sortOrder: item.sortOrder,
    addonGroupIds: item.addonGroupIds
  };
}
function updateMenuItem(id, patch) {
  const current2 = loadCatalog().items.find((item2) => item2.id === id);
  if (!current2) throw new AppError(404, "NOT_FOUND", "Menu item not found.");
  const next = {
    name: patch.name !== void 0 ? cleanName(patch.name) : current2.name,
    description: patch.description !== void 0 ? patch.description.trim().slice(0, 400) : current2.description,
    price: patch.price !== void 0 ? patch.price : current2.price,
    isAvailable: patch.isAvailable !== void 0 ? patch.isAvailable : current2.isAvailable,
    imageUrl: patch.imageUrl !== void 0 ? cleanImage(patch.imageUrl) : current2.imageUrl,
    isVeg: patch.isVeg !== void 0 ? patch.isVeg : current2.isVeg
  };
  if (!Number.isInteger(next.price) || next.price < 0 || next.price > 1e5) throw new AppError(400, "PRICE", "Enter a valid price.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `UPDATE menu_items SET name = ?, description = ?, price = ?, is_available = ?, image_url = ?, is_veg = ?, updated_at = ? WHERE id = ?`,
    [next.name, next.description, next.price, next.isAvailable ? 1 : 0, next.imageUrl, next.isVeg ? 1 : 0, now, id]
  );
  const item = loadCatalog().items.find((entry) => entry.id === id);
  publish({ type: "menu.updated", item: itemEvent(item) });
  return item;
}
function moveMenuItem(id, direction) {
  const catalog = loadCatalog();
  const item = catalog.items.find((entry) => entry.id === id);
  if (!item) throw new AppError(404, "NOT_FOUND", "Menu item not found.");
  const siblings = catalog.items.filter((entry) => entry.categoryId === item.categoryId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const index = siblings.findIndex((entry) => entry.id === id);
  const target = siblings[index + (direction === "up" ? -1 : 1)];
  if (!target) return item;
  tx(() => {
    run("UPDATE menu_items SET sort_order = ? WHERE id = ?", [target.sortOrder, item.id]);
    run("UPDATE menu_items SET sort_order = ? WHERE id = ?", [item.sortOrder, target.id]);
  });
  const updated = loadCatalog().items.find((entry) => entry.id === id);
  publish({ type: "menu.updated", item: itemEvent(updated) });
  publish({ type: "menu.updated", item: itemEvent(loadCatalog().items.find((entry) => entry.id === target.id)) });
  return updated;
}
function updateCategory(id, name) {
  const clean = cleanName(name);
  const row = get("SELECT id FROM menu_categories WHERE id = ? AND cafe_id = ?", [id, CAFE_ID]);
  if (!row) throw new AppError(404, "NOT_FOUND", "Category not found.");
  run("UPDATE menu_categories SET name = ? WHERE id = ?", [clean, id]);
  return loadCatalog().categories.find((category) => category.id === id);
}
function setItemGroups(itemId, addonGroupIds) {
  const item = loadCatalog().items.find((entry) => entry.id === itemId);
  if (!item) throw new AppError(404, "NOT_FOUND", "Menu item not found.");
  const known = new Set(loadCatalog().addonGroups.map((group) => group.id));
  if (addonGroupIds.some((id) => !known.has(id))) throw new AppError(400, "ADDON", "Unknown add-on group.");
  tx(() => {
    run("DELETE FROM menu_item_addon_groups WHERE menu_item_id = ?", [itemId]);
    for (const groupId of addonGroupIds) {
      run("INSERT INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)", [itemId, groupId]);
    }
  });
  const updated = loadCatalog().items.find((entry) => entry.id === itemId);
  publish({ type: "menu.updated", item: itemEvent(updated) });
  return updated;
}
function updateAddon(id, patch) {
  const row = get("SELECT id, name, price, is_available FROM addons WHERE id = ?", [id]);
  if (!row) throw new AppError(404, "NOT_FOUND", "Add-on not found.");
  const name = patch.name !== void 0 ? cleanName(patch.name) : row.name;
  const price = patch.price !== void 0 ? patch.price : row.price;
  const isAvailable = patch.isAvailable !== void 0 ? patch.isAvailable : row.is_available === 1;
  if (!Number.isInteger(price) || price < 0) throw new AppError(400, "PRICE", "Enter a valid price.");
  run("UPDATE addons SET name = ?, price = ?, is_available = ? WHERE id = ?", [name, price, isAvailable ? 1 : 0, id]);
  const addon = { id, name, price, isAvailable };
  publish({ type: "addon.updated", addon });
  return addon;
}
function updateTable(id, status) {
  const table = get("SELECT id FROM tables WHERE id = ? AND cafe_id = ?", [id, CAFE_ID]);
  if (!table) throw new AppError(404, "NOT_FOUND", "Table not found.");
  if (status === "AVAILABLE") {
    const open = get(
      `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
      [id]
    );
    if ((open?.n ?? 0) > 0) throw new AppError(409, "TABLE_BUSY", "This table still has an open order.");
  }
  run("UPDATE tables SET status = ?, updated_at = ? WHERE id = ?", [status, (/* @__PURE__ */ new Date()).toISOString(), id]);
  publish({ type: "table.updated", tableId: id });
  return listTables().find((entry) => entry.id === id);
}
function updateSettings(patch) {
  if (patch.name) run("UPDATE cafes SET name = ? WHERE id = ?", [cleanName(patch.name), CAFE_ID]);
  if (patch.taxBps !== void 0) {
    if (!Number.isInteger(patch.taxBps) || patch.taxBps < 0 || patch.taxBps > 2800) throw new AppError(400, "TAX", "Tax rate is out of range.");
    run("UPDATE cafes SET tax_bps = ? WHERE id = ?", [patch.taxBps, CAFE_ID]);
  }
  return loadCatalog().cafe;
}
function listTables() {
  const tables = all("SELECT id, name, qr_code, status FROM tables WHERE cafe_id = ? ORDER BY name", [CAFE_ID]);
  return tables.map((table) => {
    const open = get(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.created_at DESC LIMIT 1`,
      [table.id]
    );
    return {
      id: table.id,
      name: table.name,
      qrCode: table.qr_code,
      status: open ? "OCCUPIED" : table.status,
      openOrder: open ? {
        id: open.id,
        orderNumber: open.order_number,
        customerName: open.customer_name,
        total: open.total,
        paymentStatus: open.payment_status,
        status: open.status
      } : null
    };
  });
}
function listOrders() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  const rows = all(
    `${ORDER_SELECT} WHERE o.cafe_id = ? AND o.status != 'DRAFT' AND (
      o.status IN ('OTP_PENDING','CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') OR o.created_at >= ?
    ) ORDER BY o.created_at DESC LIMIT 300`,
    [CAFE_ID, since]
  );
  return hydrate(rows);
}
function listCustomers() {
  return all(
    "SELECT id, name, mobile, order_count, last_order_at FROM customers WHERE cafe_id = ? ORDER BY last_order_at DESC",
    [CAFE_ID]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    orderCount: row.order_count,
    lastOrderAt: row.last_order_at
  }));
}
function reportToday() {
  const cafe = loadCatalog().cafe;
  const start = startOfZonedDay(cafe.timezone).toISOString();
  const rows = all(
    `SELECT status, payment_status, total FROM orders WHERE cafe_id = ? AND created_at >= ? AND status NOT IN ('DRAFT','OTP_PENDING','CANCELLED')`,
    [CAFE_ID, start]
  );
  const byStatus = {};
  let paidTotal = 0;
  let unpaidTotal = 0;
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.payment_status === "PAID") paidTotal += row.total;
    if (row.payment_status === "UNPAID") unpaidTotal += row.total;
  }
  const gross = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    from: start,
    ordersToday: rows.length,
    paidTotal,
    unpaidTotal,
    gross,
    averageTicket: rows.length ? Math.round(gross / rows.length) : 0,
    byStatus
  };
}
function snapshot() {
  const catalog = loadCatalog();
  return {
    cafe: catalog.cafe,
    categories: catalog.categories,
    items: catalog.items,
    addonGroups: catalog.addonGroups,
    tables: listTables(),
    orders: listOrders().filter((order) => order.status !== "OTP_PENDING"),
    customers: listCustomers(),
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function retimeOrder(orderId, startIso) {
  const events = all("SELECT id FROM order_events WHERE order_id = ? ORDER BY created_at ASC", [orderId]);
  events.forEach((event, index) => {
    const at = new Date(new Date(startIso).getTime() + index * 2 * 60 * 1e3).toISOString();
    run("UPDATE order_events SET created_at = ? WHERE id = ?", [at, event.id]);
  });
  const end = new Date(new Date(startIso).getTime() + Math.max(0, events.length - 1) * 2 * 60 * 1e3).toISOString();
  run("UPDATE orders SET created_at = ?, updated_at = ? WHERE id = ?", [startIso, end, orderId]);
  run("UPDATE payments SET created_at = ? WHERE order_id = ?", [end, orderId]);
}
function applySyncBatch(operations) {
  const results = [];
  for (const op of operations) {
    try {
      const payload = op.payload ?? {};
      if (op.operation === "CREATE_ORDER") {
        const items = payload.items;
        const order = createStaffOrder({
          id: String(payload.id || op.entityId),
          tableId: payload.tableId ?? null,
          tableCode: payload.tableCode,
          customerName: String(payload.customerName || ""),
          customerMobile: String(payload.customerMobile || ""),
          items,
          clientKey: String(payload.id || op.entityId)
        });
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === "UPDATE_ORDER" || op.operation === "MARK_PREPARING" || op.operation === "MARK_READY") {
        const status = op.operation === "MARK_PREPARING" ? "PREPARING" : op.operation === "MARK_READY" ? "READY" : payload.status;
        const order = transitionOrder(op.entityId, status);
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === "MARK_PAID") {
        const order = markPaid(op.entityId, payload.method);
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === "UPDATE_MENU") {
        const item = updateMenuItem(op.entityId, {
          name: payload.name,
          description: payload.description,
          price: payload.price,
          isAvailable: payload.isAvailable,
          imageUrl: payload.imageUrl,
          isVeg: payload.isVeg
        });
        results.push({ id: op.id, ok: true, item });
        continue;
      }
      if (op.operation === "UPDATE_ADDON") {
        const addon = updateAddon(op.entityId, {
          name: payload.name,
          price: payload.price,
          isAvailable: payload.isAvailable
        });
        results.push({ id: op.id, ok: true, addon });
        continue;
      }
      if (op.operation === "UPDATE_TABLE") {
        const table = updateTable(op.entityId, payload.status);
        results.push({ id: op.id, ok: true, table });
        continue;
      }
      results.push({ id: op.id, ok: false, error: "Unknown operation." });
      break;
    } catch (error) {
      results.push({ id: op.id, ok: false, error: error instanceof Error ? error.message : "Sync failed" });
      break;
    }
  }
  return results;
}

// server/http.ts
var failures = /* @__PURE__ */ new Map();
function wrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function requireAuth(req, res, next) {
  const token = readCookie(req.headers.cookie, "habsos_session");
  const user = token ? getSessionUser(token) : null;
  if (!user) {
    res.status(401).json({ error: "Sign in required.", code: "AUTH" });
    return;
  }
  req.user = user;
  next();
}
function idOf(value) {
  return Array.isArray(value) ? value[0] : value;
}
var app = (0, import_express.default)();
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    next();
    return;
  }
  import_express.default.json({ limit: "256kb" })(req, res, next);
});
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/bootstrap", wrap((req, res) => {
  const catalog = loadCatalog();
  const tableCode = typeof req.query.table === "string" ? req.query.table : "";
  const table = tableCode ? listTables().find((entry) => entry.qrCode.toUpperCase() === tableCode.toUpperCase() || entry.name.toUpperCase() === tableCode.toUpperCase()) : null;
  if (tableCode && !table) throw new AppError(404, "TABLE", "This table is not recognized. Scan the QR code on your table.");
  res.json({
    cafe: catalog.cafe,
    table: table ? { id: table.id, name: table.name, status: table.status } : null,
    categories: catalog.categories,
    items: catalog.items,
    addonGroups: catalog.addonGroups
  });
}));
app.post("/api/checkout/place", wrap((req, res) => {
  const body = checkoutStartSchema.parse(req.body);
  const order = placeGuestOrder(body);
  res.status(201).json({ order: toPublicOrder(order) });
}));
app.post("/api/checkout/start", wrap(async (req, res) => {
  const body = checkoutStartSchema.parse(req.body);
  const result = await startCheckout(body);
  res.status(201).json({
    order: toPublicOrder(result.order),
    challengeId: result.challengeId,
    expiresAt: result.expiresAt,
    resendAfter: result.resendAfter ?? 30,
    ...exposeDevOtp() && result.devCode ? { devCode: result.devCode } : {}
  });
}));
app.post("/api/checkout/verify", wrap(async (req, res) => {
  const body = checkoutVerifySchema.parse(req.body);
  const order = await verifyCheckout(body.orderId, body.code);
  res.json({ order: toPublicOrder(order) });
}));
app.post("/api/checkout/resend", wrap(async (req, res) => {
  const body = resendSchema.parse(req.body);
  const result = await resendOtp(body.orderId);
  res.json({
    challengeId: result.challengeId,
    expiresAt: result.expiresAt,
    resendAfter: result.resendAfter,
    ...exposeDevOtp() && result.devCode ? { devCode: result.devCode } : {}
  });
}));
app.post("/api/checkout/cancel", wrap((req, res) => {
  const body = resendSchema.parse(req.body);
  cancelCheckout(body.orderId);
  res.json({ ok: true });
}));
app.get("/api/orders/:id/public", wrap((req, res) => {
  const order = getOrder(idOf(req.params.id));
  if (!order || order.status === "DRAFT") throw new AppError(404, "NOT_FOUND", "Order not found.");
  res.json({ order: toPublicOrder(order) });
}));
app.get("/api/orders/:id/events", wrap((req, res) => {
  const order = getOrder(idOf(req.params.id));
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  openStream(res, "order", order.id);
}));
app.get("/api/menu/events", (_req, res) => {
  openStream(res, "menu");
});
app.post("/api/auth/login", wrap(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const email = body.email.toLowerCase();
  const locked = failures.get(email);
  if (locked && locked.until > Date.now() && locked.count >= 8) {
    throw new AppError(429, "LOCKED", "Too many sign-in attempts. Wait a few minutes.");
  }
  const user = get("SELECT id, name, email, role, password_hash FROM users WHERE email = ?", [email]);
  if (!user || !await verifyPassword(body.password, user.password_hash)) {
    const next = { count: (locked?.count ?? 0) + 1, until: Date.now() + 5 * 60 * 1e3 };
    failures.set(email, next);
    throw new AppError(401, "AUTH", "Email or password is incorrect.");
  }
  failures.delete(email);
  const session = createSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(session.id, session.maxAge));
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}));
app.post("/api/auth/logout", (req, res) => {
  const token = readCookie(req.headers.cookie, "habsos_session");
  if (token) destroySession(token);
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});
app.get("/api/auth/me", (req, res) => {
  const token = readCookie(req.headers.cookie, "habsos_session");
  const user = token ? getSessionUser(token) : null;
  if (!user) {
    res.status(401).json({ error: "Sign in required.", code: "AUTH" });
    return;
  }
  res.json({ user });
});
app.get("/api/sync/snapshot", requireAuth, wrap((_req, res) => {
  res.json(snapshot());
}));
app.post("/api/sync", requireAuth, wrap((req, res) => {
  const body = syncBatchSchema.parse(req.body);
  res.json({ results: applySyncBatch(body.operations) });
}));
app.get("/api/events", requireAuth, (req, res) => {
  const device = typeof req.query.device === "string" ? req.query.device : "";
  if (device) touchDevice(device, "POS");
  openStream(res, "admin");
});
app.get("/api/orders", requireAuth, wrap((_req, res) => {
  res.json({ orders: listOrders() });
}));
app.get("/api/orders/:id", requireAuth, wrap((req, res) => {
  const order = getOrder(idOf(req.params.id));
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  res.json({ order });
}));
app.post("/api/orders", requireAuth, wrap((req, res) => {
  const body = staffOrderSchema.parse(req.body);
  const order = createStaffOrder(body);
  res.status(201).json({ order });
}));
app.post("/api/orders/:id/status", requireAuth, wrap((req, res) => {
  const body = statusSchema.parse(req.body);
  const order = transitionOrder(idOf(req.params.id), body.status);
  res.json({ order });
}));
app.post("/api/orders/:id/payments", requireAuth, wrap((req, res) => {
  const body = paymentSchema.parse(req.body);
  const order = markPaid(idOf(req.params.id), body.method);
  res.json({ order });
}));
app.patch("/api/menu/items/:id", requireAuth, wrap((req, res) => {
  const body = menuItemPatchSchema.parse(req.body);
  const item = updateMenuItem(idOf(req.params.id), body);
  res.json({ item });
}));
app.post("/api/menu/items/:id/move", requireAuth, wrap((req, res) => {
  const body = moveSchema.parse(req.body);
  const item = moveMenuItem(idOf(req.params.id), body.direction);
  res.json({ item });
}));
app.put("/api/menu/items/:id/groups", requireAuth, wrap((req, res) => {
  const body = itemGroupsSchema.parse(req.body);
  const item = setItemGroups(idOf(req.params.id), body.addonGroupIds);
  res.json({ item });
}));
app.patch("/api/menu/categories/:id", requireAuth, wrap((req, res) => {
  const body = categoryPatchSchema.parse(req.body);
  const category = updateCategory(idOf(req.params.id), body.name);
  res.json({ category });
}));
app.patch("/api/addons/:id", requireAuth, wrap((req, res) => {
  const body = addonPatchSchema.parse(req.body);
  const addon = updateAddon(idOf(req.params.id), body);
  res.json({ addon });
}));
app.get("/api/tables", requireAuth, wrap((_req, res) => {
  res.json({ tables: listTables() });
}));
app.patch("/api/tables/:id", requireAuth, wrap((req, res) => {
  const body = tablePatchSchema.parse(req.body);
  const table = updateTable(idOf(req.params.id), body.status);
  res.json({ table });
}));
app.get("/api/customers", requireAuth, wrap((_req, res) => {
  res.json({ customers: listCustomers() });
}));
app.get("/api/reports/today", requireAuth, wrap((_req, res) => {
  res.json(reportToday());
}));
app.get("/api/settings", requireAuth, wrap((_req, res) => {
  const catalog = loadCatalog();
  res.json({ cafe: catalog.cafe, otpProvider: otpProvider.name, devOtp: exposeDevOtp() });
}));
app.patch("/api/settings", requireAuth, wrap((req, res) => {
  const body = settingsPatchSchema.parse(req.body);
  const cafe = updateSettings(body);
  res.json({ cafe });
}));
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found.", code: "NOT_FOUND" });
});
if (isProduction()) {
  const dist = import_node_path2.default.resolve("dist");
  if ((0, import_node_fs4.existsSync)(dist)) {
    app.use(import_express.default.static(dist, { index: false, maxAge: "1h" }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(import_node_path2.default.join(dist, "index.html"));
    });
  }
}
app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message, code: error.code, details: error.details ?? null });
    return;
  }
  if (error instanceof import_zod2.ZodError) {
    res.status(400).json({ error: "Check the form and try again.", code: "VALIDATION" });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid request.", code: "JSON" });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong.", code: "SERVER" });
});

// server/seed.ts
var DRINKS = [
  ["item_espresso", "Espresso", 120, "A short, intense shot of coffee. Pulled at 30ml so the crema stays thick and the finish turns sweet before it goes sharp. Medium-dark roast, stopped while the shot is still syrupy, served in a warm cup. The crema should cover the surface and smell like toasted cocoa."],
  ["item_americano", "Americano", 140, "Espresso lengthened with hot water. A double shot opened with hot water, so it drinks long and clean without the bitterness of an over-extracted brew. Dark, hot, and meant to be sat with. Water goes in first, then the shot, so the crema stays on top."],
  ["item_cappuccino", "Cappuccino", 160, "Espresso with steamed milk and a thick foam cap. The shot sits under a dry foam tall enough to hold a spoon, not a thin latte swirl. Milk is stretched until glossy, then poured so the cap stays high. The cup is warmed before the pour, and the foam should reach the rim."],
  ["item_latte", "Cafe Latte", 170, "A longer milk coffee with a thin layer of foam. More milk than a cappuccino, with the espresso folded through so every sip is soft and even. The foam is a short lid, not a mound. The milk is steamed sweet, not scalded, and the shot is buried so the first sip is already mixed."],
  ["item_mocha", "Mocha", 190, "Espresso, cocoa, and steamed milk. Dutch cocoa melted into the shot, then milk poured through it so the chocolate stays a little bitter rather than candy-sweet. A short cocoa dust on top. The cocoa is mixed into the espresso before the milk, so it does not sit as a powder at the bottom."],
  ["item_iced_latte", "Iced Latte", 190, "Espresso and cold milk over ice. The shot is pulled hot and poured straight over ice and cold milk, so it chills without a blender watering it down. Drink it before the ice gives up. The glass is filled with ice first, then milk, then the shot, so the coffee ribbons through instead of sinking in one lump."],
  ["item_cold_coffee", "Cold Coffee", 180, "Blended coffee, milk, and ice. Whipped until it is thick enough to hold a straw upright, with the coffee still tasting like coffee under the milk. Not a milkshake, and not a watery iced coffee. It comes out pale and frothy, with the ice broken fine so the cup stays cold to the last sip."],
  ["item_matcha", "Matcha Latte", 210, "Ceremonial matcha whisked with milk. The tea is sifted and whisked before the milk goes in, so it stays grassy and vivid green instead of turning chalky. Ask if you want it lightly sweet. The bowl is whisked until the surface is even, then the milk is poured through."],
  ["item_hot_chocolate", "Hot Chocolate", 180, "Warm cocoa with steamed milk. Real cocoa melted into hot milk until it is dense and a little bitter, not a powder packet. Served hot enough that the cup needs a minute in your hands. There is no espresso in it. The cocoa is dark, and the milk is steamed until the cup needs a minute in your hands."],
  ["item_masala_chai", "Masala Chai", 100, "Black tea simmered with milk and spices. Ginger, cardamom, and a little black pepper boiled with the tea and milk, then strained. Spice comes first. Sugar, if you want it, comes second. It is boiled, not steeped, so the cup is strong and a little thick."]
];
var FOOD = [
  ["item_butter_croissant", "Butter Croissant", 140, "Flaky, butter-laminated pastry. Folded so the layers shatter, with enough butter that the crumb stays tender instead of dry. Baked the same morning, and served warm if you are here early. The outside should crack when you tear it, and the inside should pull into thin sheets."],
  ["item_choc_croissant", "Chocolate Croissant", 170, "Croissant with a dark chocolate baton. The same laminated dough, with a bar of dark chocolate baked into the centre so it stays soft in the middle and set at the ends. The chocolate is bitter enough to cut the butter."],
  ["item_blueberry_muffin", "Blueberry Muffin", 130, "Soft muffin with blueberries. A tall dome, a tender crumb, and berries that burst instead of sinking into a wet streak. Sweet, but not so sweet that you lose the fruit. The top is baked until it just colours, and the berries are folded in whole."],
  ["item_choc_muffin", "Chocolate Muffin", 130, "Cocoa muffin with chocolate chunks. Dark cocoa in the batter and chunks that stay soft in the middle. Dense rather than cakey, and still warm if the tray just came out. The crumb should be damp, not dry, and the chocolate should stretch a little when the muffin is split."],
  ["item_garlic_bread", "Garlic Bread", 160, "Toasted bread with garlic butter. A split loaf brushed with butter, garlic, and parsley, then toasted until the edges crisp and the middle stays soft enough to pull apart. The garlic is cooked into the butter so it is sweet, not raw."],
  ["item_grilled_cheese", "Grilled Cheese Sandwich", 220, "Cheese melted in toasted bread. Mature cheddar between bread buttered on the outside and cooked until the crumb is crisp and the cheese still stretches when you pull it. Pressed flat so the middle melts before the crust burns."],
  ["item_veg_club", "Veg Club Sandwich", 240, "Toasted triple-layer sandwich with vegetables. Three slices of toast with cucumber, tomato, lettuce, and a little cheese, cut so the quarters stand up instead of sliding apart. The toast is dry enough to hold the tomato, and the layers are stacked even so each bite has bread, cheese, and salad."],
  ["item_margherita", "Margherita Pizza", 280, "Tomato, mozzarella, and basil on a thin base. A personal pie with a blistered rim, crushed tomato, and mozzarella that pools instead of baking into a hard crust. Basil goes on after the oven. The centre stays soft, the rim should have a little chew, and it is cut into four."],
  ["item_fries", "Peri Peri Fries", 190, "Fries tossed with peri peri salt. Twice-cooked until the edges shatter, then tossed with peri peri so the heat sits on the crust. No wet sauce drowning them. They come out hot and dry, with the spice on the surface rather than mixed into a powder pile at the bottom of the tray."],
  ["item_paneer_wrap", "Paneer Wrap", 230, "Grilled paneer, salad, and mint in a wrap. Paneer seared until the edges brown, rolled with onion, cucumber, and mint. Built so it eats clean, not soggy. The bread is warmed, the salad is dried, and the mint is mixed through so it is not a puddle at one end."]
];
var MENU_IMAGES = {
  item_espresso: "/items/espresso.jpg",
  item_americano: "/items/americano.jpg",
  item_cappuccino: "/items/cappuccino.jpg",
  item_latte: "/items/latte.jpg",
  item_mocha: "/items/mocha.jpg",
  item_iced_latte: "/items/iced-latte.jpg",
  item_cold_coffee: "/items/cold-coffee.jpg",
  item_matcha: "/items/matcha.jpg",
  item_hot_chocolate: "/items/hot-chocolate.jpg",
  item_masala_chai: "/items/chai.jpg",
  item_butter_croissant: "/items/butter-croissant.jpg",
  item_choc_croissant: "/items/choc-croissant.jpg",
  item_blueberry_muffin: "/items/blueberry-muffin.jpg",
  item_choc_muffin: "/items/choc-muffin.jpg",
  item_garlic_bread: "/items/garlic-bread.jpg",
  item_grilled_cheese: "/items/grilled-cheese.jpg",
  item_veg_club: "/items/veg-club.jpg",
  item_margherita: "/items/pizza.jpg",
  item_fries: "/items/fries.jpg",
  item_paneer_wrap: "/items/paneer-wrap.jpg"
};
function applyMenuImages() {
  for (const [id, url] of Object.entries(MENU_IMAGES)) {
    run(`UPDATE menu_items SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/menu/%')`, [url, id]);
  }
}
function applyMenuCopy() {
  for (const item of [...DRINKS, ...FOOD]) {
    run("UPDATE menu_items SET description = ? WHERE id = ?", [item[3], item[0]]);
  }
}
async function seed() {
  if (get("SELECT id FROM cafes WHERE id = ?", [CAFE_ID])) {
    run(`UPDATE cafes SET name = 'After Dunes' WHERE id = ? AND name = 'Habsos'`, [CAFE_ID]);
    applyMenuImages();
    applyMenuCopy();
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run("INSERT INTO cafes (id, name, tax_bps, currency, timezone, created_at) VALUES (?, ?, 500, ?, ?, ?)", [CAFE_ID, "After Dunes", "INR", "Asia/Kolkata", now]);
  run("INSERT INTO order_counters (cafe_id, next_number) VALUES (?, 101)", [CAFE_ID]);
  const password = await hashPassword(env.adminPassword);
  run("INSERT INTO users (id, cafe_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    "user_staff",
    CAFE_ID,
    "Staff",
    env.adminEmail.toLowerCase(),
    password,
    "staff",
    now
  ]);
  run("INSERT INTO menu_categories (id, cafe_id, name, sort_order) VALUES (?, ?, ?, ?)", ["cat_drinks", CAFE_ID, "Drinks", 1]);
  run("INSERT INTO menu_categories (id, cafe_id, name, sort_order) VALUES (?, ?, ?, ?)", ["cat_food", CAFE_ID, "Food", 2]);
  DRINKS.forEach((item, index) => insertItem(item, "cat_drinks", index + 1, now));
  FOOD.forEach((item, index) => insertItem(item, "cat_food", index + 11, now));
  run("INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 1)", ["group_size", CAFE_ID, "Size"]);
  run("INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 2)", ["group_milk", CAFE_ID, "Milk"]);
  run("INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 3, 3)", ["group_extras", CAFE_ID, "Extras"]);
  insertAddon("addon_large", "group_size", "Large", 40, 1);
  insertAddon("addon_oat", "group_milk", "Oat Milk", 30, 1);
  insertAddon("addon_almond", "group_milk", "Almond Milk", 40, 2);
  insertAddon("addon_extra_shot", "group_extras", "Extra Shot", 50, 1);
  insertAddon("addon_caramel", "group_extras", "Caramel Syrup", 30, 2);
  insertAddon("addon_cream", "group_extras", "Whipped Cream", 30, 3);
  for (const drink of DRINKS) {
    for (const groupId of ["group_size", "group_milk", "group_extras"]) {
      run("INSERT INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)", [drink[0], groupId]);
    }
  }
  for (let index = 1; index <= 10; index += 1) {
    const name = `T${String(index).padStart(2, "0")}`;
    run("INSERT INTO tables (id, cafe_id, name, qr_code, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [`table_${name.toLowerCase()}`, CAFE_ID, name, name, "AVAILABLE", now]);
  }
  const ago = (minutes) => new Date(Date.now() - minutes * 60 * 1e3).toISOString();
  const completed = createStaffOrder({
    tableCode: "T01",
    customerName: "Meera",
    customerMobile: "9876500101",
    items: [
      { menuItemId: "item_masala_chai", quantity: 2, addonIds: [] },
      { menuItemId: "item_butter_croissant", quantity: 1, addonIds: [] }
    ]
  });
  for (const status of ["READY", "SERVED", "COMPLETED"]) transitionOrder(completed.id, status);
  markPaid(completed.id, "CASH");
  retimeOrder(completed.id, ago(120));
  const ready = createStaffOrder({
    tableCode: "T02",
    customerName: "Rohan",
    customerMobile: "9876500102",
    items: [
      { menuItemId: "item_iced_latte", quantity: 1, addonIds: ["addon_almond"] },
      { menuItemId: "item_fries", quantity: 1, addonIds: [] }
    ]
  });
  transitionOrder(ready.id, "READY");
  retimeOrder(ready.id, ago(35));
  const preparing = createStaffOrder({
    tableCode: "T03",
    customerName: "Priya",
    customerMobile: "9876500103",
    items: [
      { menuItemId: "item_latte", quantity: 1, addonIds: ["addon_oat"] },
      { menuItemId: "item_blueberry_muffin", quantity: 1, addonIds: [] }
    ]
  });
  retimeOrder(preparing.id, ago(18));
  const fresh = createStaffOrder({
    tableCode: "T05",
    customerName: "Arjun",
    customerMobile: "9876500104",
    items: [
      { menuItemId: "item_cappuccino", quantity: 1, addonIds: ["addon_large", "addon_oat", "addon_extra_shot"] },
      { menuItemId: "item_choc_muffin", quantity: 1, addonIds: [] }
    ]
  });
  retimeOrder(fresh.id, ago(6));
  applyMenuImages();
  applyMenuCopy();
}
function insertItem(item, categoryId, sortOrder, now) {
  run(
    `INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, image_url, is_veg, is_available, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 1, ?, ?)`,
    [item[0], CAFE_ID, categoryId, item[1], item[3], item[2], sortOrder, now]
  );
}
function insertAddon(id, groupId, name, price, sortOrder) {
  run("INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES (?, ?, ?, ?, 1, ?)", [id, groupId, name, price, sortOrder]);
}

// server/vercel.ts
var booted = false;
var tail = Promise.resolve();
function lock(fn) {
  const run2 = tail.then(fn, fn);
  tail = run2.then(() => void 0, () => void 0);
  return run2;
}
function incomingUrl(req) {
  const current2 = req.url || "/";
  const pathOnly = current2.split("?")[0];
  const collapsed = pathOnly === "/api/index" || pathOnly === "/index" || pathOnly === "/api";
  if (!collapsed) return current2;
  const names = ["x-forwarded-uri", "x-vercel-original-url", "x-original-url", "x-invoke-path", "x-matched-path", "x-forwarded-url"];
  for (const name of names) {
    const value = req.headers[name];
    const header = Array.isArray(value) ? value[0] : value;
    if (typeof header === "string" && header.startsWith("/api/") && !header.startsWith("/api/index")) return header;
  }
  return current2;
}
function apiUrl(req) {
  const raw = incomingUrl(req);
  if (raw === "/api" || raw.startsWith("/api/")) return raw;
  const queryAt = raw.indexOf("?");
  const path2 = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const query = queryAt === -1 ? "" : raw.slice(queryAt);
  const suffix = path2.startsWith("/") ? path2 : `/${path2}`;
  return `/api${suffix === "/" ? "" : suffix}${query}`;
}
async function refresh() {
  const dest = process.env.DB_PATH || "/tmp/habsos.db";
  const status = await pullDatabase(dest);
  if (!booted) {
    if (status === "written") (0, import_node_fs5.renameSync)(`${dest}.incoming`, dest);
    await seed();
    booted = true;
    await pushDatabase(dest);
    return;
  }
  if (status === "written") adoptIncoming();
}
function isLive(req) {
  return (req.url || "").includes("/events");
}
var maxDuration = 60;
function handler(req, res) {
  return lock(async () => {
    try {
      await refresh();
      req.url = apiUrl(req);
      if (isLive(req)) {
        app(req, res);
        return;
      }
      await new Promise((resolve, reject) => {
        res.once("finish", () => resolve());
        res.once("error", reject);
        try {
          app(req, res);
        } catch (error) {
          reject(error);
        }
      });
      const method = req.method || "GET";
      if (method !== "GET" && method !== "HEAD") await pushDatabase(process.env.DB_PATH || "/tmp/habsos.db");
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Menu could not be loaded.", code: "SERVER" }));
      }
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  maxDuration
});
module.exports = handler; module.exports.maxDuration = maxDuration;
