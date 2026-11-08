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
  otpProvider: process.env.OTP_PROVIDER || (process.env.FAST2SMS_API_KEY ? "fast2sms" : "mock"),
  fast2smsApiKey: process.env.FAST2SMS_API_KEY || "",
  otpDevExpose: process.env.OTP_DEV_EXPOSE === "true",
  adminEmail: process.env.ADMIN_EMAIL || "admin@habs.cafe",
  adminPassword: process.env.ADMIN_PASSWORD || "habsos-admin",
  dbPath: process.env.DB_PATH || "./data/habsos.db",
  smsAccountSid: process.env.SMS_ACCOUNT_SID || "",
  smsAuthToken: process.env.SMS_AUTH_TOKEN || "",
  smsFrom: process.env.SMS_FROM || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || ""
};
function isProduction() {
  return env.nodeEnv === "production";
}
function exposeDevOtp() {
  if (env.otpDevExpose) return true;
  if (isProduction()) return false;
  return env.otpProvider === "mock";
}
function razorpayEnabled() {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
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
  area TEXT NOT NULL DEFAULT 'Ground Floor',
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
  is_favorite INTEGER NOT NULL DEFAULT 0,
  shortcut_num TEXT,
  shortcut_alpha TEXT,
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

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  table_id TEXT NOT NULL REFERENCES tables(id),
  customer_name TEXT NOT NULL,
  mobile TEXT NOT NULL DEFAULT '',
  covers INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_order ON otp_challenges(order_id, created_at);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Raw material',
  unit TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  cost_per_unit INTEGER NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  item_id TEXT NOT NULL REFERENCES inventory_items(id),
  kind TEXT NOT NULL,
  qty_delta REAL NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'staff'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_mov_ref ON inventory_movements(item_id, reference) WHERE reference != '';

CREATE TABLE IF NOT EXISTS menu_recipes (
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
  qty_per_portion REAL NOT NULL,
  PRIMARY KEY (menu_item_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_items_cafe ON inventory_items(cafe_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_mov_cafe ON inventory_movements(cafe_id, created_at);
`);
  migrate(database);
  return database;
}
function tableColumns(database, table) {
  return database.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}
function addColumn(database, table, name, definition) {
  if (!tableColumns(database, table).includes(name)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}
function migrate(database) {
  addColumn(database, "tables", "area", "TEXT NOT NULL DEFAULT 'Ground Floor'");
  addColumn(database, "menu_items", "is_favorite", "INTEGER NOT NULL DEFAULT 0");
  addColumn(database, "menu_items", "shortcut_num", "TEXT");
  addColumn(database, "menu_items", "shortcut_alpha", "TEXT");
  addColumn(database, "menu_items", "menu_lead", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "menu_items", "menu_subtitle", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "menu_items", "kcal_label", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "menu_items", "ingredients_json", "TEXT NOT NULL DEFAULT '[]'");
  addColumn(database, "menu_items", "sheet_json", "TEXT NOT NULL DEFAULT '{}'");
  addColumn(database, "orders", "session_id", "TEXT");
  addColumn(database, "order_items", "course", "INTEGER NOT NULL DEFAULT 0");
  addColumn(database, "order_items", "sent_at", "TEXT");
  addColumn(database, "customers", "email", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "street", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "street2", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "city", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "zip", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "state", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "country", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "gstin", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "barcode", "TEXT NOT NULL DEFAULT ''");
  addColumn(database, "customers", "tags", "TEXT NOT NULL DEFAULT ''");
  database.exec(`
CREATE TABLE IF NOT EXISTS pos_configs (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  is_restaurant INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pos_sessions (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES pos_configs(id),
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opened_by TEXT NOT NULL,
  opening_cash REAL NOT NULL DEFAULT 0,
  closing_cash REAL,
  counted_cash REAL,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pos_cash_moves (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES pos_sessions(id),
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  cafe_id TEXT NOT NULL REFERENCES cafes(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  background TEXT NOT NULL DEFAULT 'wood'
);
CREATE TABLE IF NOT EXISTS table_geometry (
  table_id TEXT PRIMARY KEY REFERENCES tables(id),
  floor_id TEXT NOT NULL REFERENCES floors(id),
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  w REAL NOT NULL DEFAULT 80,
  h REAL NOT NULL DEFAULT 80,
  seats INTEGER NOT NULL DEFAULT 4,
  shape TEXT NOT NULL DEFAULT 'square',
  color TEXT NOT NULL DEFAULT '#28a745'
);
`);
  addColumn(database, "pos_sessions", "sequence", "INTEGER NOT NULL DEFAULT 0");
  const userVersion = database.prepare("PRAGMA user_version").get().user_version;
  if (userVersion < 2) {
    database.exec("UPDATE orders SET customer_id = NULL");
    database.exec("DELETE FROM customers");
    database.exec("PRAGMA user_version = 2");
  }
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
var blobWritable = null;
function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
function isBlobUnavailable(error) {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : String(error);
  return name === "BlobStoreSuspendedError" || /suspended/i.test(message) || /403 Forbidden/i.test(message) || /Failed to fetch blob/i.test(message);
}
async function pullDatabase(dest) {
  if (!blobEnabled() || blobWritable === false) return "absent";
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
    blobWritable = true;
    return "written";
  } catch (error) {
    if (error instanceof import_blob.BlobNotFoundError) return "absent";
    if (isBlobUnavailable(error)) {
      blobWritable = false;
      console.error("Shared database blob unavailable \u2014 using local SQLite only.", error);
      return "absent";
    }
    console.error("Could not read the shared database.", error);
    return "absent";
  }
}
async function pushDatabase(src) {
  if (!blobEnabled() || blobWritable === false) return;
  try {
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
    blobWritable = true;
  } catch (error) {
    if (isBlobUnavailable(error)) {
      blobWritable = false;
      console.error("Shared database blob unavailable \u2014 writes stay on this instance only.", error);
      return;
    }
    console.error("Could not write the shared database.", error);
  }
}

// server/http.ts
var import_node_crypto8 = require("node:crypto");
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
  CONFIRMED: ["READY", "SERVED", "CANCELLED"],
  ACCEPTED: ["READY", "SERVED", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["CANCELLED"],
  CANCELLED: []
};
function canTransition(from, to) {
  return TRANSITIONS[from].includes(to);
}
function orderFlag(notes, flag) {
  return notes.split(/\n/).some((line) => line.trim() === flag);
}
function paidTotal(order) {
  return order.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + payment.amount, 0);
}
function dueTotal(order) {
  return Math.max(0, order.total - paidTotal(order));
}
function splitAmounts(total, parts) {
  const count = Math.round(parts);
  if (!Number.isInteger(count) || count < 2 || count > 8) {
    throw new Error("Split into 2\u20138 bills.");
  }
  if (!Number.isInteger(total) || total < 1) {
    throw new Error("Nothing to split.");
  }
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
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
var DRINKS_CATEGORY_ID = "cat_drinks";
var DRINK_ADDON_GROUP_IDS = ["group_size", "group_milk", "group_extras"];
function defaultAddonGroupsForCategory(categoryId) {
  return categoryId === DRINKS_CATEGORY_ID ? [...DRINK_ADDON_GROUP_IDS] : [];
}
function normalizeShortcut(value) {
  return value.trim().toUpperCase().replace(/[\s./_-]+/g, "");
}
var LINE_QTY_MIN = 1;
var LINE_QTY_MAX = 20;
var LINE_NOTE_MAX = 180;
function clampLineQuantity(value) {
  if (!Number.isFinite(value)) return LINE_QTY_MIN;
  return Math.min(LINE_QTY_MAX, Math.max(LINE_QTY_MIN, Math.round(value)));
}
function cartLineKey(line) {
  return `${line.menuItemId}|${[...line.addonIds].sort().join(",")}|${(line.notes ?? "").trim()}`;
}
function applyLineQuantity(current2, delta) {
  const raw = current2 + delta;
  if (raw < LINE_QTY_MIN) return { quantity: 0, capped: false };
  if (raw > LINE_QTY_MAX) return { quantity: LINE_QTY_MAX, capped: true };
  return { quantity: raw, capped: false };
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
    if (!Number.isInteger(line.quantity) || line.quantity < LINE_QTY_MIN || line.quantity > LINE_QTY_MAX) {
      throw new PriceError(`Quantity must be between ${LINE_QTY_MIN} and ${LINE_QTY_MAX}.`);
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
    const notes = (line.notes ?? "").trim().slice(0, LINE_NOTE_MAX);
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
function zonedOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return asUtc - date.getTime();
}
function tableLabel(name) {
  const match = /^T(\d+)$/i.exec(name.trim());
  if (match) return String(Number(match[1]));
  return name;
}
function paymentPreferenceFromNotes(notes) {
  const raw = noteValue(notes, "PAY_PREF").toUpperCase();
  if (raw === "UPI" || raw === "CARD") return raw;
  return "DESK";
}
function noteValue(notes, key) {
  const prefix = `${key}:`;
  for (const line of notes.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return "";
}
function orderChannel(order) {
  const mode = noteValue(order.notes, "MODE").toUpperCase();
  if (mode === "DELIVERY") return "delivery";
  if (mode === "PICKUP") return "pickup";
  if (mode === "DINE") return "dine";
  return order.tableId ? "dine" : "pickup";
}
function formatZonedYmd(timeZone, date = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function parseYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use YYYY-MM-DD dates.");
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error("Invalid date.");
  }
  return value;
}
function shiftYmd(ymd, days) {
  const [year, month, day] = parseYmd(ymd).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}
function zonedDayStart(timeZone, ymd) {
  const [year, month, day] = parseYmd(ymd).split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utc = wall;
  for (let i = 0; i < 3; i += 1) {
    utc = wall - zonedOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}
function zonedHour(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  return Number.isFinite(hour) ? hour : 0;
}
function isSplitCancel(notes) {
  return notes.split(/\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed === "SPLIT" || trimmed.startsWith("SPLIT:");
  });
}
function bumpNamed(map, name, qty, amount) {
  const current2 = map.get(name) ?? { name, qty: 0, amount: 0 };
  current2.qty += qty;
  current2.amount += amount;
  map.set(name, current2);
}
function sortNamed(map) {
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}
function buildSalesReport(input) {
  const byMethod = { CASH: 0, UPI: 0, CARD: 0, OTHER: 0 };
  const byChannel = {
    dine: { bills: 0, amount: 0 },
    pickup: { bills: 0, amount: 0 },
    delivery: { bills: 0, amount: 0 }
  };
  const bySource = {
    POS: { bills: 0, amount: 0 },
    QR: { bills: 0, amount: 0 }
  };
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, bills: 0, amount: 0 }));
  const items = /* @__PURE__ */ new Map();
  const categories = /* @__PURE__ */ new Map();
  const tickets = [];
  let bills = 0;
  let cancelled = 0;
  let complimentary = 0;
  let gross = 0;
  let discount = 0;
  let tax = 0;
  let net = 0;
  let due = 0;
  let ncAmount = 0;
  for (const order of input.orders) {
    if (order.status === "DRAFT" || order.status === "OTP_PENDING") continue;
    const splitOff = order.status === "CANCELLED" && isSplitCancel(order.notes);
    if (splitOff) continue;
    const cancelledBill = order.status === "CANCELLED";
    const complimentaryBill = orderFlag(order.notes, "COMPLIMENTARY");
    const channel = orderChannel(order);
    const ticket = {
      id: order.id,
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      customerName: order.customerName,
      channel,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      due: dueTotal(order),
      createdAt: order.createdAt,
      complimentary: complimentaryBill,
      cancelled: cancelledBill,
      items: order.items.map((item) => ({ name: item.nameSnapshot, qty: item.quantity, amount: item.total }))
    };
    tickets.push(ticket);
    if (cancelledBill) {
      cancelled += 1;
      continue;
    }
    bills += 1;
    byChannel[channel].bills += 1;
    bySource[order.source].bills += 1;
    const hour = hours[zonedHour(order.createdAt, input.timeZone)];
    if (hour) hour.bills += 1;
    for (const item of order.items) {
      bumpNamed(items, item.nameSnapshot, item.quantity, item.total);
      bumpNamed(categories, input.categoryName(item.menuItemId), item.quantity, item.total);
    }
    if (complimentaryBill) {
      complimentary += 1;
      ncAmount += order.total;
      continue;
    }
    gross += order.subtotal;
    discount += order.discount;
    tax += order.tax;
    net += order.total;
    due += dueTotal(order);
    byChannel[channel].amount += order.total;
    bySource[order.source].amount += order.total;
    if (hour) hour.amount += order.total;
  }
  const payRows = input.payments ?? input.orders.flatMap((order) => order.payments.map((payment) => ({
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    createdAt: payment.createdAt,
    complimentary: orderFlag(order.notes, "COMPLIMENTARY")
  })));
  let collected = 0;
  for (const payment of payRows) {
    if (payment.status !== "PAID") continue;
    if (payment.createdAt < input.from || payment.createdAt >= input.to) continue;
    if (payment.complimentary) continue;
    if (!PAYMENT_METHODS.includes(payment.method)) continue;
    byMethod[payment.method] += payment.amount;
    collected += payment.amount;
  }
  tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    from: input.from,
    to: input.to,
    fromYmd: input.fromYmd,
    toYmd: input.toYmd,
    bills,
    cancelled,
    complimentary,
    gross,
    discount,
    tax,
    net,
    averageTicket: bills - complimentary > 0 ? Math.round(net / (bills - complimentary)) : 0,
    due,
    collected,
    ncAmount,
    byMethod,
    byChannel,
    bySource,
    hours,
    items: sortNamed(items),
    categories: sortNamed(categories),
    tickets
  };
}
function toPublicOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableName: order.tableName,
    customerName: order.customerName,
    customerMobile: order.customerMobile || void 0,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentPreference: paymentPreferenceFromNotes(order.notes),
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
  clientKey: import_zod.z.string().uuid().optional(),
  paymentPreference: import_zod.z.enum(["DESK", "UPI", "CARD"]).optional().default("DESK"),
  address: import_zod.z.string().trim().max(200).optional(),
  locality: import_zod.z.string().trim().max(120).optional(),
  extraInfo: import_zod.z.string().trim().max(200).optional()
});
var guestMenuFieldsSchema = {
  menuLead: import_zod.z.string().trim().max(24).optional().default(""),
  menuSubtitle: import_zod.z.string().trim().max(80).optional().default(""),
  kcalLabel: import_zod.z.string().trim().max(40).optional().default(""),
  ingredients: import_zod.z.array(import_zod.z.string().trim().min(1).max(24)).max(8).optional().default([])
};
var productSheetSchema = import_zod.z.object({
  productType: import_zod.z.enum(["goods", "service", "combo"]).optional().default("goods"),
  trackInventory: import_zod.z.boolean().optional().default(false),
  sales: import_zod.z.boolean().optional().default(true),
  purchase: import_zod.z.boolean().optional().default(true),
  pos: import_zod.z.boolean().optional().default(true),
  salesTax: import_zod.z.string().trim().max(40).optional().default(""),
  cost: import_zod.z.string().trim().max(16).optional().default(""),
  purchaseTax: import_zod.z.string().trim().max(40).optional().default(""),
  reference: import_zod.z.string().trim().max(40).optional().default(""),
  barcode: import_zod.z.string().trim().max(40).optional().default(""),
  tags: import_zod.z.string().trim().max(80).optional().default("")
});
var menuItemCreateSchema = import_zod.z.object({
  categoryId: import_zod.z.string().trim().min(1).max(80),
  name: import_zod.z.string().trim().min(1).max(80),
  description: import_zod.z.string().trim().max(400).optional().default(""),
  price: import_zod.z.number().int().min(0).max(1e5),
  imageUrl: import_zod.z.string().trim().max(500).nullable().optional(),
  isVeg: import_zod.z.boolean().optional().default(true),
  isFavorite: import_zod.z.boolean().optional().default(false),
  shortcutNum: import_zod.z.string().trim().max(8).nullable().optional(),
  shortcutAlpha: import_zod.z.string().trim().max(8).nullable().optional(),
  addonGroupIds: import_zod.z.array(import_zod.z.string().trim().min(1).max(80)).max(12).optional().default([]),
  sheet: productSheetSchema.optional(),
  ...guestMenuFieldsSchema
});
var tableStageSchema = import_zod.z.object({
  stage: import_zod.z.enum(["blank", "running", "kot", "printed", "paid"])
});
var mediaUploadSchema = import_zod.z.object({
  filename: import_zod.z.string().trim().min(1).max(80),
  contentBase64: import_zod.z.string().min(32).max(25e5),
  mime: import_zod.z.enum(["image/png", "image/jpeg", "image/webp"])
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
  notes: import_zod.z.string().max(400).optional().default(""),
  discount: import_zod.z.number().int().min(0).max(1e5).optional().default(0),
  clientKey: import_zod.z.string().uuid().optional(),
  allowOpenTable: import_zod.z.boolean().optional()
});
var staffOrderPatchSchema = import_zod.z.object({
  customerName: import_zod.z.string().trim().min(1).max(80).optional(),
  customerMobile: import_zod.z.string().trim().max(20).optional(),
  items: import_zod.z.array(cartLineSchema).min(1).max(30),
  notes: import_zod.z.string().max(400).optional(),
  discount: import_zod.z.number().int().min(0).max(1e5).optional()
});
var statusSchema = import_zod.z.object({
  status: import_zod.z.enum(ORDER_STATUSES)
});
var paymentSchema = import_zod.z.object({
  method: import_zod.z.enum(PAYMENT_METHODS),
  amount: import_zod.z.number().int().min(1).max(1e5).optional()
});
var razorpayCreateSchema = import_zod.z.object({
  orderId: import_zod.z.string().uuid(),
  amount: import_zod.z.number().int().min(100).max(1e7).optional()
});
var razorpayVerifySchema = import_zod.z.object({
  orderId: import_zod.z.string().uuid(),
  razorpayOrderId: import_zod.z.string().trim().min(4).max(40),
  razorpayPaymentId: import_zod.z.string().trim().min(4).max(40),
  razorpaySignature: import_zod.z.string().trim().min(8).max(128)
});
var splitSchema = import_zod.z.object({
  parts: import_zod.z.number().int().min(2).max(8)
});
var menuItemPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80),
  description: import_zod.z.string().trim().max(400),
  price: import_zod.z.number().int().min(0).max(1e5),
  isAvailable: import_zod.z.boolean(),
  imageUrl: import_zod.z.string().trim().max(500).nullable().optional(),
  isVeg: import_zod.z.boolean().optional(),
  isFavorite: import_zod.z.boolean().optional(),
  shortcutNum: import_zod.z.string().trim().max(8).nullable().optional(),
  shortcutAlpha: import_zod.z.string().trim().max(8).nullable().optional(),
  categoryId: import_zod.z.string().trim().min(1).max(80).optional(),
  sheet: productSheetSchema.optional(),
  ...guestMenuFieldsSchema
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
var tableCreateSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(40),
  area: import_zod.z.string().trim().min(1).max(40).optional()
});
var orderTableSchema = import_zod.z.object({
  tableId: import_zod.z.string().trim().min(1).max(80)
});
var settingsPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80).optional(),
  taxBps: import_zod.z.number().int().min(0).max(2800).optional()
});
var customerCreateSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80),
  mobile: import_zod.z.string().trim().min(8).max(20)
});
var reservationCreateSchema = import_zod.z.object({
  tableId: import_zod.z.string().trim().min(1).max(80),
  customerName: import_zod.z.string().trim().min(1).max(80),
  customerMobile: import_zod.z.string().trim().max(20).optional().default(""),
  covers: import_zod.z.number().int().min(1).max(20),
  startsAt: import_zod.z.string().trim().max(40).optional()
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
var inventoryItemCreateSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80),
  sku: import_zod.z.string().trim().max(32).optional().default(""),
  category: import_zod.z.string().trim().max(40).optional().default("Raw material"),
  unit: import_zod.z.enum(["kg", "g", "l", "ml", "pcs"]),
  qty: import_zod.z.number().min(0).max(1e6).optional().default(0),
  reorderLevel: import_zod.z.number().min(0).max(1e6).optional().default(0),
  costPerUnit: import_zod.z.number().int().min(0).max(1e7).optional().default(0),
  supplier: import_zod.z.string().trim().max(80).optional().default("")
});
var inventoryItemPatchSchema = import_zod.z.object({
  name: import_zod.z.string().trim().min(1).max(80).optional(),
  sku: import_zod.z.string().trim().max(32).optional(),
  category: import_zod.z.string().trim().max(40).optional(),
  unit: import_zod.z.enum(["kg", "g", "l", "ml", "pcs"]).optional(),
  reorderLevel: import_zod.z.number().min(0).max(1e6).optional(),
  costPerUnit: import_zod.z.number().int().min(0).max(1e7).optional(),
  supplier: import_zod.z.string().trim().max(80).optional()
});
var inventoryMovementSchema = import_zod.z.object({
  itemId: import_zod.z.string().trim().min(1).max(80),
  kind: import_zod.z.enum(["PURCHASE", "WASTAGE", "ADJUSTMENT", "RETURN"]),
  qty: import_zod.z.number().refine((n) => n !== 0 && Math.abs(n) <= 1e6, "Enter a non-zero quantity."),
  unitCost: import_zod.z.number().int().min(0).max(1e7).optional(),
  notes: import_zod.z.string().trim().max(200).optional().default(""),
  supplier: import_zod.z.string().trim().max(80).optional().default("")
});
var menuRecipesSchema = import_zod.z.object({
  lines: import_zod.z.array(import_zod.z.object({
    inventoryItemId: import_zod.z.string().trim().min(1).max(80),
    qtyPerPortion: import_zod.z.number().positive().max(1e4)
  })).max(24)
});

// server/inventory.ts
var import_node_crypto = require("node:crypto");

// shared/menuDisplay.ts
var INGREDIENT_IDS = [
  "milk",
  "soy",
  "wheat",
  "coffee",
  "cocoa",
  "egg",
  "tea",
  "potato",
  "cheese",
  "tomato",
  "butter",
  "mint",
  "chilli",
  "paneer"
];
var INGREDIENT_STOCK = {
  milk: { stockId: "inv_milk", portion: 0.12 },
  soy: { stockId: "inv_soy", portion: 0.1 },
  wheat: { stockId: "inv_flour", portion: 0.08 },
  coffee: { stockId: "inv_coffee_beans", portion: 0.018 },
  cocoa: { stockId: "inv_chocolate", portion: 0.015 },
  egg: { stockId: "inv_egg", portion: 1 },
  tea: { stockId: "inv_tea", portion: 4e-3 },
  potato: { stockId: "inv_potato", portion: 0.1 },
  cheese: { stockId: "inv_cheese", portion: 0.04 },
  tomato: { stockId: "inv_tomato", portion: 0.05 },
  butter: { stockId: "inv_butter", portion: 0.02 },
  mint: { stockId: "inv_mint", portion: 5e-3 },
  chilli: { stockId: "inv_chilli", portion: 5e-3 },
  paneer: { stockId: "inv_paneer", portion: 0.08 }
};
var BASIC_ITEM_INGREDIENTS = {
  item_bacon_burger: ["wheat", "cheese", "tomato"],
  item_cheese_burger: ["wheat", "cheese", "tomato"],
  item_pizza_margherita: ["wheat", "cheese", "tomato"],
  item_pizza_veg: ["wheat", "cheese", "tomato", "chilli"],
  item_pasta_4formaggi: ["wheat", "cheese", "butter"],
  item_funghi: ["butter"],
  item_pasta_bolo: ["wheat", "tomato"],
  item_chicken_curry_sandwich: ["wheat", "chilli"],
  item_spicy_tuna_sandwich: ["wheat", "chilli"],
  item_mozzarella_sandwich: ["wheat", "cheese", "tomato"],
  item_club_sandwich: ["wheat", "egg", "cheese"],
  item_salmon_avocado: ["butter"],
  item_espresso: ["coffee"],
  item_green_tea: ["tea", "mint"],
  item_milkshake_banana: ["milk", "cocoa"],
  item_ice_tea: ["tea"],
  item_burger_combo: ["wheat", "cheese", "tomato", "potato"],
  item_sushi_combo: ["chilli"],
  item_lunch_maki: ["chilli"],
  item_lunch_salmon: ["chilli"],
  item_lunch_temaki: ["chilli"],
  item_caesar: ["wheat", "cheese", "egg"],
  item_chicken_wings: ["chilli"],
  item_onion_rings: ["wheat", "potato"],
  item_greek_salad: ["tomato", "cheese"],
  item_fish_chips: ["potato", "wheat"],
  item_chicken_salad: ["tomato"],
  item_tiramisu: ["coffee", "egg", "cocoa"]
};
function basicIngredientsFor(id, name, categoryId) {
  if (BASIC_ITEM_INGREDIENTS[id]) return BASIC_ITEM_INGREDIENTS[id];
  const legacy = LEGACY_MENU_DISPLAY[id]?.ingredients;
  if (legacy?.length) return legacy;
  const text = name.toLowerCase();
  const found = /* @__PURE__ */ new Set();
  if (/espresso|americano|latte|cappuccino|mocha|coffee|brew|affogato/.test(text)) found.add("coffee");
  if (/tea|chai/.test(text)) found.add("tea");
  if (/mint/.test(text)) found.add("mint");
  if (/milk|shake|latte|cappuccino|mocha/.test(text)) found.add("milk");
  if (/choc|mocha|cocoa|nutella/.test(text)) found.add("cocoa");
  if (/burger|pizza|sandwich|baguette|pasta|bread|club|toast|waffle|quesadilla/.test(text)) found.add("wheat");
  if (/cheese|margherita|formaggi|burger|pizza|quesadilla/.test(text)) found.add("cheese");
  if (/tomato|margherita|burger|baguette|bolo|bruschetta/.test(text)) found.add("tomato");
  if (/egg|club/.test(text)) found.add("egg");
  if (/potato|fries|menu/.test(text)) found.add("potato");
  if (/paneer|cottage/.test(text)) found.add("paneer");
  if (/chilli|spicy|jalape/.test(text)) found.add("chilli");
  if (/butter|pancake|cookie/.test(text)) found.add("butter");
  if (!found.size && categoryId === DRINKS_CATEGORY_ID && /coffee|espresso|latte|mocha|brew|americano|cappuccino/.test(text)) {
    found.add("coffee");
  }
  return [...found].slice(0, 8);
}
var LEGACY_MENU_DISPLAY = {
  item_moroccan: { lead: "BLENDED", titled: "Moroccan Avocado Smoothie", kcal: "210 kcal", ingredients: ["milk"] },
  item_berry: { lead: "BLENDED", titled: "Berry Blast Shake", kcal: "185 kcal", ingredients: ["milk"] },
  item_nutella: { lead: "HOT", titled: "Nutella Hot Chocolate", kcal: "180 kcal", ingredients: ["milk", "cocoa"] },
  item_hazelnut: { lead: "HOT", titled: "Hazelnut Hot Chocolate", kcal: "180 kcal", ingredients: ["milk", "cocoa"] },
  item_peach: { lead: "ICED", titled: "Peach Ice Tea", kcal: "120 kcal", ingredients: ["tea"] },
  item_affogato: { lead: "CUP", titled: "Affogato", kcal: "223 kcal", ingredients: ["coffee", "milk"] },
  item_mint_latte: { lead: "HOT", titled: "Mint Latte", kcal: "231 kcal", ingredients: ["coffee", "milk", "mint"] },
  item_americano: { lead: "HOT", titled: "Cafe Americano", kcal: "25 kcal", ingredients: ["coffee"] },
  item_filter: { lead: "HOT", titled: "Filter Coffee", kcal: "28 kcal", ingredients: ["coffee"] },
  item_cardamom: { lead: "CUP", titled: "Cardamom Tea", kcal: "92 kcal", ingredients: ["tea", "milk"] },
  item_ginger_tea: { lead: "CUP", titled: "Ginger Tea", kcal: "92 kcal", ingredients: ["tea"] },
  item_espresso: { lead: "SHORT", titled: "Classic Espresso", kcal: "5 kcal", ingredients: ["coffee"] },
  item_long_black: { lead: "LONG", titled: "Long Black", kcal: "10 kcal", ingredients: ["coffee"] },
  item_cappuccino: { lead: "CUP", titled: "Cappuccino", kcal: "120 kcal", ingredients: ["milk", "coffee"] },
  item_cap_alt: { lead: "CUP", titled: "Cappuccino with Almond or Oat", kcal: "90\u2013140 kcal", ingredients: ["milk", "coffee"] },
  item_latte: { lead: "CUP", titled: "Cafe Latte", kcal: "150 kcal", ingredients: ["milk", "coffee"] },
  item_flat_white: { lead: "CUP", titled: "Flat White", kcal: "140 kcal", ingredients: ["milk", "coffee"] },
  item_cortado: { lead: "SHORT", titled: "Spanish Cortado", kcal: "80 kcal", ingredients: ["coffee", "milk"] },
  item_mocha: { lead: "CUP", titled: "Chocolate Mocha", kcal: "220 kcal", ingredients: ["milk", "cocoa", "coffee"] },
  item_cold_brew: { lead: "ICED", titled: "Cold Brew", kcal: "5 kcal", ingredients: ["coffee"] },
  item_citrus_brew: { lead: "ICED", titled: "Citrus Cold Brew", kcal: "40\u201390 kcal", ingredients: ["coffee"] },
  item_saigon: { lead: "ICED", titled: "Saigon Cold Brew", kcal: "60 kcal", ingredients: ["coffee", "milk"] },
  item_red_john: { lead: "ICED", titled: "Red John", kcal: "90 kcal", ingredients: ["coffee"] },
  item_sparkling: { lead: "ICED", titled: "Sparkling Espresso", kcal: "180 kcal", ingredients: ["coffee"] },
  item_tonic: { lead: "ICED", titled: "Cold Brew Tonic / Ginger Ale", kcal: "40\u201390 kcal", ingredients: ["coffee"] },
  item_iced_americano: { lead: "ICED", titled: "Iced Americano", kcal: "10 kcal", ingredients: ["coffee"] },
  item_halloumi: { lead: "SWEET", titled: "Strawberry Waffle", kcal: "310 kcal", ingredients: ["wheat", "butter"] },
  item_avocado_toast: { lead: "SWEET", titled: "Butter Pancakes", kcal: "350 kcal", ingredients: ["wheat", "butter", "egg"] },
  item_bruschetta: { lead: "BOARD", titled: "Bruschetta Board", kcal: "130 kcal", ingredients: ["wheat", "tomato"] },
  item_karak_toast: { lead: "TOAST", titled: "Karak Chai Toast", kcal: "350 kcal", ingredients: ["wheat", "tea", "milk"] },
  item_kebab: { lead: "SKEWER", titled: "Gillafi Dahike Kebab", kcal: "220 kcal", ingredients: ["milk"] },
  item_mezze: { lead: "PLATE", titled: "Mezze Platter", kcal: "310 kcal", ingredients: ["wheat", "tomato"] },
  item_quesadilla: { lead: "FOLDED", titled: "Mexican Quesadilla", kcal: "320 kcal", ingredients: ["wheat", "cheese"] },
  item_cheese_balls: { lead: "FRIED", titled: "Jalape\xF1o Cheese Balls", kcal: "190 kcal", ingredients: ["cheese", "wheat"] },
  item_healthy_bowl: { lead: "BOWL", titled: "Healthy Bowl", kcal: "320 kcal", ingredients: ["tomato"] },
  item_house_salad: { lead: "BOWL", titled: "House Salad", kcal: "170 kcal", ingredients: ["tomato"] },
  item_harvest: { lead: "SLIDER", titled: "Green Harvest Burger", kcal: "180 kcal", ingredients: ["wheat", "tomato"] },
  item_veg_club: { lead: "STACKED", titled: "Veg Club Sandwich", kcal: "200 kcal", ingredients: ["wheat", "cheese", "tomato"] },
  item_cheddar: { lead: "BAKED", titled: "Chocolate Chunk Cookies", kcal: "220 kcal", ingredients: ["wheat", "butter"] },
  item_bombay: { lead: "STACKED", titled: "Bombay Club Sandwich", kcal: "190 kcal", ingredients: ["wheat", "cheese", "tomato"] },
  item_penne: { lead: "PASTA", titled: "Penne Creme Pesto", kcal: "340 kcal", ingredients: ["wheat", "cheese"] },
  item_spaghetti: { lead: "PASTA", titled: "Spaghetti Aglio e Olio", kcal: "280 kcal", ingredients: ["wheat", "chilli"] },
  item_risotto: { lead: "RICE", titled: "Saffron Risotto", kcal: "330 kcal", ingredients: ["cheese"] },
  item_paneer: { lead: "GRILL", titled: "Marinated Grill Cottage Cheese", kcal: "380 kcal", ingredients: ["paneer"] }
};
function parseIngredientList(raw) {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(INGREDIENT_IDS);
    return parsed.filter((id) => typeof id === "string" && allowed.has(id)).slice(0, 8);
  } catch {
    return [];
  }
}
function serializeIngredients(ids) {
  const allowed = new Set(INGREDIENT_IDS);
  const clean = ids.filter((id) => allowed.has(id)).slice(0, 8);
  return JSON.stringify(clean);
}
function defaultGuestMetaForCategory(categoryId, name) {
  if (categoryId === DRINKS_CATEGORY_ID) {
    return {
      menuLead: "ICED",
      menuSubtitle: name,
      kcalLabel: "",
      ingredients: ["coffee"]
    };
  }
  return { menuLead: "", menuSubtitle: name, kcalLabel: "", ingredients: [] };
}

// server/appError.ts
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

// server/ids.ts
var CAFE_ID = "cafe_habsos";

// server/inventory.ts
var INVENTORY_UNITS = ["kg", "g", "l", "ml", "pcs"];
function mapItem(row) {
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
    lowStock: row.qty <= row.reorder_level && row.reorder_level > 0
  };
}
function mapMovement(row, itemName) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: itemName ?? "",
    kind: row.kind,
    qtyDelta: row.qty_delta,
    unitCost: row.unit_cost,
    reference: row.reference,
    notes: row.notes,
    supplier: row.supplier,
    createdAt: row.created_at,
    actor: row.actor
  };
}
function listInventoryItems() {
  const rows = all(
    "SELECT * FROM inventory_items WHERE cafe_id = ? AND is_active = 1 ORDER BY category, name",
    [CAFE_ID]
  );
  return rows.map(mapItem);
}
function listInventoryMovements(limit = 80) {
  const rows = all(
    `SELECT m.*, i.name AS item_name FROM inventory_movements m
     JOIN inventory_items i ON i.id = m.item_id
     WHERE m.cafe_id = ?
     ORDER BY m.created_at DESC LIMIT ?`,
    [CAFE_ID, limit]
  );
  return rows.map((row) => mapMovement(row, row.item_name));
}
function inventorySummary() {
  const items = listInventoryItems();
  const low = items.filter((item) => item.lowStock);
  const value = items.reduce((sum, item) => sum + Math.round(item.qty * item.costPerUnit), 0);
  return {
    itemCount: items.length,
    lowStockCount: low.length,
    stockValue: value,
    lowStock: low.slice(0, 8)
  };
}
function createInventoryItem(input) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "INVENTORY", "Name is required.");
  const unit = input.unit.trim();
  if (!INVENTORY_UNITS.includes(unit)) {
    throw new AppError(400, "INVENTORY", "Pick a valid unit.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = `inv_${(0, import_node_crypto.randomUUID)().slice(0, 8)}`;
  const qty = Math.max(0, input.qty ?? 0);
  run(
    `INSERT INTO inventory_items (id, cafe_id, name, sku, category, unit, qty, reorder_level, cost_per_unit, supplier, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      CAFE_ID,
      name,
      (input.sku ?? "").trim().slice(0, 32),
      (input.category ?? "Raw material").trim().slice(0, 40),
      unit,
      qty,
      Math.max(0, input.reorderLevel ?? 0),
      Math.max(0, input.costPerUnit ?? 0),
      (input.supplier ?? "").trim().slice(0, 80),
      now
    ]
  );
  return mapItem(get("SELECT * FROM inventory_items WHERE id = ?", [id]));
}
function updateInventoryItem(id, patch) {
  const current2 = get("SELECT * FROM inventory_items WHERE id = ? AND cafe_id = ?", [id, CAFE_ID]);
  if (!current2) throw new AppError(404, "NOT_FOUND", "Stock item not found.");
  const unit = patch.unit !== void 0 ? patch.unit.trim() : current2.unit;
  if (patch.unit !== void 0 && !INVENTORY_UNITS.includes(unit)) {
    throw new AppError(400, "INVENTORY", "Pick a valid unit.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `UPDATE inventory_items SET
      name = ?, sku = ?, category = ?, unit = ?, reorder_level = ?, cost_per_unit = ?, supplier = ?, updated_at = ?
     WHERE id = ?`,
    [
      patch.name !== void 0 ? patch.name.trim().slice(0, 80) : current2.name,
      patch.sku !== void 0 ? patch.sku.trim().slice(0, 32) : current2.sku,
      patch.category !== void 0 ? patch.category.trim().slice(0, 40) : current2.category,
      unit,
      patch.reorderLevel !== void 0 ? Math.max(0, patch.reorderLevel) : current2.reorder_level,
      patch.costPerUnit !== void 0 ? Math.max(0, patch.costPerUnit) : current2.cost_per_unit,
      patch.supplier !== void 0 ? patch.supplier.trim().slice(0, 80) : current2.supplier,
      now,
      id
    ]
  );
  return mapItem(get("SELECT * FROM inventory_items WHERE id = ?", [id]));
}
function recordMovementInternal(input) {
  const item = get("SELECT * FROM inventory_items WHERE id = ? AND cafe_id = ? AND is_active = 1", [input.itemId, CAFE_ID]);
  if (!item) throw new AppError(404, "NOT_FOUND", "Stock item not found.");
  const ref = (input.reference ?? "").trim();
  if (ref) {
    const dup = get("SELECT id FROM inventory_movements WHERE item_id = ? AND reference = ?", [input.itemId, ref]);
    if (dup) return mapMovement(get("SELECT * FROM inventory_movements WHERE id = ?", [dup.id]), item.name);
  }
  const qtyDelta = input.qtyDelta;
  if (!Number.isFinite(qtyDelta) || qtyDelta === 0) throw new AppError(400, "INVENTORY", "Quantity must be non-zero.");
  const nextQty = item.qty + qtyDelta;
  if (nextQty < -1e-4) throw new AppError(409, "INVENTORY", `Not enough ${item.name} on hand (${item.qty} ${item.unit}).`);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = (0, import_node_crypto.randomUUID)();
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
      (input.notes ?? "").trim().slice(0, 200),
      (input.supplier ?? "").trim().slice(0, 80),
      now,
      input.actor ?? "staff"
    ]
  );
  run("UPDATE inventory_items SET qty = ?, updated_at = ? WHERE id = ?", [Math.max(0, nextQty), now, input.itemId]);
  return mapMovement(get("SELECT * FROM inventory_movements WHERE id = ?", [id]), item.name);
}
function recordInventoryMovement(input) {
  const qty = Math.abs(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) throw new AppError(400, "INVENTORY", "Enter a quantity.");
  let qtyDelta = qty;
  if (input.kind === "WASTAGE" || input.kind === "SALE") qtyDelta = -qty;
  if (input.kind === "PURCHASE" || input.kind === "RETURN") qtyDelta = qty;
  if (input.kind === "ADJUSTMENT") qtyDelta = input.qty;
  return recordMovementInternal({
    itemId: input.itemId,
    kind: input.kind,
    qtyDelta,
    unitCost: input.unitCost,
    reference: "",
    notes: input.notes,
    supplier: input.supplier,
    actor: input.actor
  });
}
function listRecipesForMenuItem(menuItemId) {
  const rows = all(
    `SELECT r.menu_item_id, r.inventory_item_id, r.qty_per_portion, i.name AS item_name, i.unit
     FROM menu_recipes r JOIN inventory_items i ON i.id = r.inventory_item_id
     WHERE r.menu_item_id = ?`,
    [menuItemId]
  );
  return rows.map((row) => ({
    menuItemId: row.menu_item_id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.item_name,
    unit: row.unit,
    qtyPerPortion: row.qty_per_portion
  }));
}
function listAllRecipes() {
  const rows = all(
    "SELECT menu_item_id, inventory_item_id, qty_per_portion FROM menu_recipes"
  );
  return rows.map((row) => ({
    menuItemId: row.menu_item_id,
    inventoryItemId: row.inventory_item_id,
    qtyPerPortion: row.qty_per_portion
  }));
}
var INGREDIENT_STOCK_IDS = new Set(Object.values(INGREDIENT_STOCK).map((entry) => entry.stockId));
function syncRecipesFromIngredients(menuItemId, ingredients, categoryId) {
  const menu = get("SELECT id FROM menu_items WHERE id = ? AND cafe_id = ?", [menuItemId, CAFE_ID]);
  if (!menu) return;
  const chosen = ingredients.filter((id) => INGREDIENT_IDS.includes(id));
  const existing = all(
    "SELECT inventory_item_id FROM menu_recipes WHERE menu_item_id = ?",
    [menuItemId]
  );
  for (const row of existing) {
    if (INGREDIENT_STOCK_IDS.has(row.inventory_item_id)) {
      run("DELETE FROM menu_recipes WHERE menu_item_id = ? AND inventory_item_id = ?", [menuItemId, row.inventory_item_id]);
    }
  }
  for (const id of chosen) {
    const stock = INGREDIENT_STOCK[id];
    const item = get("SELECT id FROM inventory_items WHERE id = ? AND cafe_id = ?", [stock.stockId, CAFE_ID]);
    if (!item) continue;
    run(
      `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
       ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_per_portion = excluded.qty_per_portion`,
      [menuItemId, stock.stockId, stock.portion]
    );
  }
  if (categoryId === "cat_drinks") {
    const cup = get("SELECT id FROM inventory_items WHERE id = ?", ["inv_cups_8oz"]);
    if (cup) {
      run(
        `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
         ON CONFLICT(menu_item_id, inventory_item_id) DO NOTHING`,
        [menuItemId, "inv_cups_8oz", 1]
      );
    }
  }
}
function saveMenuRecipes(menuItemId, lines) {
  const menu = get("SELECT id FROM menu_items WHERE id = ? AND cafe_id = ?", [menuItemId, CAFE_ID]);
  if (!menu) throw new AppError(404, "NOT_FOUND", "Menu item not found.");
  run("DELETE FROM menu_recipes WHERE menu_item_id = ?", [menuItemId]);
  for (const line of lines) {
    if (!line.inventoryItemId || !Number.isFinite(line.qtyPerPortion) || line.qtyPerPortion <= 0) continue;
    const stock = get("SELECT id FROM inventory_items WHERE id = ? AND cafe_id = ?", [line.inventoryItemId, CAFE_ID]);
    if (!stock) throw new AppError(400, "INVENTORY", "Unknown stock item in recipe.");
    run(
      "INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)",
      [menuItemId, line.inventoryItemId, line.qtyPerPortion]
    );
  }
  return listRecipesForMenuItem(menuItemId);
}
function consumeInventoryForOrder(orderId, actor = "system") {
  const order = get("SELECT order_number FROM orders WHERE id = ?", [orderId]);
  if (!order) return;
  const lines = all(
    "SELECT menu_item_id, name_snapshot, quantity FROM order_items WHERE order_id = ?",
    [orderId]
  );
  for (const line of lines) {
    if (!line.menu_item_id) continue;
    const recipes = all(
      "SELECT inventory_item_id, qty_per_portion FROM menu_recipes WHERE menu_item_id = ?",
      [line.menu_item_id]
    );
    for (const recipe of recipes) {
      const qty = recipe.qty_per_portion * line.quantity;
      if (qty <= 0) continue;
      const ref = `sale:${orderId}:${line.menu_item_id}:${recipe.inventory_item_id}`;
      recordMovementInternal({
        itemId: recipe.inventory_item_id,
        kind: "SALE",
        qtyDelta: -qty,
        reference: ref,
        notes: `Bill #${order.order_number} \xB7 ${line.name_snapshot}`,
        actor
      });
    }
  }
}
function inventoryBundle() {
  return {
    items: listInventoryItems(),
    movements: listInventoryMovements(),
    recipes: listAllRecipes(),
    summary: inventorySummary()
  };
}

// server/auth.ts
var import_node_crypto2 = require("node:crypto");
var import_node_util = require("node:util");
var scryptAsync = (0, import_node_util.promisify)(import_node_crypto2.scrypt);
var SESSION_MS = 16 * 60 * 60 * 1e3;
async function hashPassword(password) {
  const salt = (0, import_node_crypto2.randomBytes)(16).toString("hex");
  const derived = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const derived = await scryptAsync(password, salt, 32);
  const actual = Buffer.from(hex, "hex");
  if (actual.length !== derived.length) return false;
  return (0, import_node_crypto2.timingSafeEqual)(actual, derived);
}
function sign(body) {
  return (0, import_node_crypto2.createHmac)("sha256", env.sessionSecret).update(body).digest("base64url");
}
function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return (0, import_node_crypto2.timingSafeEqual)(left, right);
}
function loadUser(userId) {
  const row = get("SELECT id, name, email, role FROM users WHERE id = ?", [userId]);
  return row ?? null;
}
function createSession(userId) {
  const exp = Date.now() + SESSION_MS;
  const body = `v1.${userId}.${exp}`;
  const id = `${body}.${sign(body)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    run(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      [`sig_${userId}_${exp}`, userId, new Date(exp).toISOString(), now]
    );
  } catch {
  }
  return { id, maxAge: Math.floor(SESSION_MS / 1e3) };
}
function destroySession(id) {
  try {
    run("DELETE FROM sessions WHERE id = ?", [id]);
  } catch {
  }
  const parsed = parseSigned(id);
  if (parsed) {
    try {
      run("DELETE FROM sessions WHERE user_id = ? AND id LIKE ?", [parsed.userId, "sig_%"]);
    } catch {
    }
  }
}
function parseSigned(token) {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, userId, expStr, sig] = parts;
  if (!userId || !expStr || !sig) return null;
  const body = `v1.${userId}.${expStr}`;
  if (!safeEqual(sign(body), sig)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { userId, exp };
}
function legacySessionUser(token) {
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
function getSessionUser(token) {
  const signed = parseSigned(token);
  if (signed) return loadUser(signed.userId);
  return legacySessionUser(token);
}
function touchSession(token) {
  const user = getSessionUser(token);
  if (!user) return null;
  const next = createSession(user.id);
  return { user, token: next.id, maxAge: next.maxAge };
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
var import_node_crypto6 = require("node:crypto");

// server/otp.ts
var import_node_crypto3 = require("node:crypto");
var devCodes = /* @__PURE__ */ new Map();
function rememberDevCode(challengeId, code) {
  if (!isProduction() || env.otpDevExpose) devCodes.set(challengeId, code);
}
function peekDevCode(challengeId) {
  return devCodes.get(challengeId);
}
function hashCode(challengeId, code) {
  return (0, import_node_crypto3.createHash)("sha256").update(`${env.sessionSecret}:${challengeId}:${code}`).digest("hex");
}
function makeOtpCode() {
  return String((0, import_node_crypto3.randomInt)(0, 1e6)).padStart(6, "0");
}
function hashOtp(challengeId, code) {
  return hashCode(challengeId, code);
}
function hashesMatch(expected, actual) {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return (0, import_node_crypto3.timingSafeEqual)(left, right);
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
var Fast2SmsOtpProvider = class {
  name = "fast2sms";
  async sendOtp(input) {
    if (!env.fast2smsApiKey) throw new Error("FAST2SMS_API_KEY is not configured");
    const body = new URLSearchParams({
      route: "q",
      message: `Your After Dunes verification code is ${input.code}`,
      language: "english",
      flash: "0",
      numbers: input.mobile
    });
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: env.fast2smsApiKey,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const json = await response.json();
    const detail = Array.isArray(json.message) ? json.message.join(" ") : json.message;
    if (!response.ok || json.return === false) {
      throw new Error(detail?.trim() || "SMS provider rejected the message");
    }
    return { providerRef: json.request_id ?? "fast2sms" };
  }
  async verifyOtp(input) {
    const actual = hashCode(input.challengeId, input.code);
    return hashesMatch(input.codeHash, actual) ? "VERIFIED" : "FAILED";
  }
};
function createOtpProvider() {
  if (env.otpDevExpose) {
    return new MockOtpProvider();
  }
  if (env.otpProvider === "fast2sms" || env.fast2smsApiKey && env.otpProvider !== "sms" && env.otpProvider !== "mock") {
    return new Fast2SmsOtpProvider();
  }
  if (env.otpProvider === "sms") return new SmsOtpProvider();
  if (env.otpProvider !== "mock" && isProduction()) {
    throw new Error(`Unknown OTP provider: ${env.otpProvider}`);
  }
  return new MockOtpProvider();
}
var otpProvider = createOtpProvider();

// server/realtime.ts
var import_node_crypto4 = require("node:crypto");
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
  const id = (0, import_node_crypto4.randomUUID)();
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

// server/razorpay.ts
var import_node_crypto5 = require("node:crypto");
var RazorpayError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RazorpayError";
  }
};
function publicRazorpayKey() {
  return razorpayEnabled() ? env.razorpayKeyId : "";
}
function authHeader() {
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`;
}
async function createRazorpayOrder(amountPaise, receipt) {
  if (!razorpayEnabled()) throw new RazorpayError("Online payments are not configured.");
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new RazorpayError("Amount must be at least \u20B91.");
  }
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: receipt.slice(0, 40)
    })
  });
  if (!response.ok) {
    throw new RazorpayError("Could not start the online payment.");
  }
  return await response.json();
}
function verifyRazorpayPayment(razorpayOrderId, razorpayPaymentId, signature) {
  if (!razorpayEnabled()) throw new RazorpayError("Online payments are not configured.");
  const expected = (0, import_node_crypto5.createHmac)("sha256", env.razorpayKeySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !(0, import_node_crypto5.timingSafeEqual)(left, right)) {
    throw new RazorpayError("Payment verification failed.");
  }
}

// server/logic.ts
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
    throw new AppError(400, "IMAGE", "Image must be a URL or /uploads/ path.");
  }
  return value;
}
function guestCheckoutNotes(input) {
  const parts = [];
  const pref = (input.paymentPreference ?? "DESK").toUpperCase();
  if (pref === "UPI" || pref === "CARD") parts.push(`PAY_PREF:${pref}`);
  else parts.push("PAY_PREF:DESK");
  if (input.address?.trim()) parts.push(`ADDR:${input.address.trim()}`);
  if (input.locality?.trim()) parts.push(`LOCALITY:${input.locality.trim()}`);
  if (input.extraInfo?.trim()) parts.push(`EXTRA:${input.extraInfo.trim()}`);
  parts.push("MODE:DINE");
  return parts.join("\n");
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
  const items = all(
    "SELECT id, category_id, name, description, price, image_url, is_veg, is_available, is_favorite, shortcut_num, shortcut_alpha, sort_order, menu_lead, menu_subtitle, kcal_label, ingredients_json, sheet_json FROM menu_items WHERE cafe_id = ? ORDER BY sort_order, name",
    [CAFE_ID]
  ).map(
    (row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: row.price,
      imageUrl: row.image_url,
      isVeg: row.is_veg === 1,
      isAvailable: row.is_available === 1,
      isFavorite: row.is_favorite === 1,
      shortcutNum: row.shortcut_num,
      shortcutAlpha: row.shortcut_alpha,
      sortOrder: row.sort_order,
      menuLead: row.menu_lead ?? "",
      menuSubtitle: row.menu_subtitle ?? "",
      kcalLabel: row.kcal_label ?? "",
      ingredients: parseIngredientList(row.ingredients_json),
      addonGroupIds: links.filter((link) => link.menu_item_id === row.id).map((link) => link.addon_group_id),
      sheet: parseProductSheet(row.sheet_json)
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
  const openSessionId = get(`SELECT id FROM pos_sessions WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1`)?.id ?? null;
  run(
    `INSERT INTO orders (
      id, order_number, cafe_id, table_id, table_name, customer_id, customer_name, customer_mobile,
      status, payment_status, subtotal, tax, discount, total, source, notes, client_key, created_at, updated_at, synced_at, session_id
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.notes ?? "",
      input.clientKey,
      now,
      now,
      now,
      openSessionId
    ]
  );
  writeQuoteLines(input.id, input.quote);
  if (input.eventMessage) {
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      [(0, import_node_crypto6.randomUUID)(), input.id, "status", input.eventMessage, input.status, now, input.actor]
    );
  }
  if (OPEN_STATUSES.includes(input.status)) refreshTable(input.tableId);
  return getOrder(input.id);
}
function writeQuoteLines(orderId, quote) {
  for (const line of quote.lines) {
    const itemId = (0, import_node_crypto6.randomUUID)();
    run(
      `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, orderId, line.menuItemId, line.name, line.quantity, line.unitPrice, line.total, line.notes]
    );
    for (const addon of line.addons) {
      run(
        `INSERT INTO order_item_addons (id, order_item_id, addon_id, name_snapshot, price_snapshot) VALUES (?, ?, ?, ?, ?)`,
        [(0, import_node_crypto6.randomUUID)(), itemId, addon.addonId, addon.name, addon.price]
      );
    }
  }
}
function isSplitTicket(notes) {
  return notes.split(/\n/).some((line) => /^(SPLIT(:.*)?|PARENT:)/.test(line.trim()));
}
function mergedIntoId(order) {
  const line = order.notes.split(/\n/).map((entry) => entry.trim()).find((entry) => entry.startsWith("MERGED:"));
  return line ? line.slice(7).trim() || null : null;
}
function cartLinesFromOrder(order) {
  return order.items.map((item) => {
    if (!item.menuItemId) throw new AppError(400, "CART", "An item in the cart is no longer on the menu.");
    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      addonIds: item.addons.map((addon) => addon.addonId).filter((id) => Boolean(id)),
      notes: item.notes
    };
  });
}
function mergeCartLines(current2, incoming) {
  const next = current2.map((line) => ({
    menuItemId: line.menuItemId,
    quantity: line.quantity,
    addonIds: [...line.addonIds],
    notes: line.notes
  }));
  for (const line of incoming) {
    const key = cartLineKey(line);
    const match = next.find((candidate) => cartLineKey(candidate) === key);
    if (match) {
      const applied = applyLineQuantity(match.quantity, line.quantity);
      match.quantity = applied.capped ? LINE_QTY_MAX : Math.max(match.quantity, applied.quantity);
    } else {
      next.push({
        menuItemId: line.menuItemId,
        quantity: clampLineQuantity(line.quantity),
        addonIds: [...line.addonIds],
        notes: line.notes
      });
    }
  }
  return next;
}
function unpaidOpenOrdersOnTable(tableId, exceptId) {
  const rows = all(
    `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') AND o.payment_status != 'PAID'${exceptId ? " AND o.id != ?" : ""} ORDER BY o.created_at ASC, o.order_number ASC`,
    exceptId ? [tableId, exceptId] : [tableId]
  );
  return rows.length ? hydrate(rows) : [];
}
function unpaidOpenOnTable(tableId, exceptId) {
  const opens = unpaidOpenOrdersOnTable(tableId, exceptId);
  if (!opens.length) return null;
  return opens.find((order) => !isSplitTicket(order.notes)) ?? opens[0];
}
function markMergedInto(orderId, targetId) {
  const current2 = getOrder(orderId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const notes = [`MERGED:${targetId}`, current2?.notes ?? ""].filter(Boolean).join("\n").slice(0, 400);
  run(`UPDATE orders SET status = 'CANCELLED', notes = ?, updated_at = ?, synced_at = ? WHERE id = ?`, [notes, now, now, orderId]);
}
function appendItemsToOpenOrder(orderId, incoming, actor) {
  const current2 = getOrder(orderId);
  if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
  if (current2.paymentStatus === "PAID" || current2.status === "COMPLETED" || current2.status === "CANCELLED" || current2.status === "OTP_PENDING") {
    throw new AppError(409, "STATE", "This order can no longer be edited.");
  }
  const merged = mergeCartLines(cartLinesFromOrder(current2), incoming);
  const quote = quoteOrThrow(merged, current2.discount);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const reopen = current2.status === "SERVED" || current2.status === "READY" ? "CONFIRMED" : current2.status;
  run(`DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)`, [orderId]);
  run("DELETE FROM order_items WHERE order_id = ?", [orderId]);
  writeQuoteLines(orderId, quote);
  run(
    `UPDATE orders SET subtotal = ?, tax = ?, discount = ?, total = ?, status = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
    [quote.subtotal, quote.tax, quote.discount, quote.total, reopen, now, now, orderId]
  );
  run(
    `INSERT INTO order_events (id, order_id, type, message, created_at, actor) VALUES (?, ?, 'items', 'Items added', ?, ?)`,
    [(0, import_node_crypto6.randomUUID)(), orderId, now, actor]
  );
  if (reopen !== current2.status) {
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, ?, ?, ?)`,
      [(0, import_node_crypto6.randomUUID)(), orderId, statusMessage(reopen), current2.status, reopen, now, actor]
    );
  }
  refreshTable(current2.tableId);
  return getOrder(orderId);
}
function foldUnpaidTicketsOnTable(tableId, exceptId) {
  const target = unpaidOpenOnTable(tableId, exceptId);
  if (!target) return null;
  const siblings = unpaidOpenOrdersOnTable(tableId, exceptId).filter((order) => {
    if (order.id === target.id) return false;
    if (isSplitTicket(order.notes)) return false;
    if (paidTotal(order) > 0) return false;
    return order.source === "QR";
  });
  for (const sibling of siblings) {
    appendItemsToOpenOrder(target.id, cartLinesFromOrder(sibling), "system");
    markMergedInto(sibling.id, target.id);
  }
  return getOrder(target.id);
}
function replaceStaffOrderItems(orderId, input) {
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current2.paymentStatus === "PAID" || current2.status === "COMPLETED" || current2.status === "CANCELLED" || current2.status === "OTP_PENDING") {
      throw new AppError(409, "STATE", "This order can no longer be edited.");
    }
    const mobile = input.customerMobile?.trim() ? normalizeMobile(input.customerMobile) : current2.customerMobile;
    if (input.customerMobile?.trim() && !mobile) throw new AppError(400, "MOBILE", "Enter a valid 10-digit mobile number.");
    const name = input.customerName?.trim() ? cleanName(input.customerName) : current2.customerName;
    const quote = quoteOrThrow(input.items, input.discount ?? current2.discount);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run(`DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)`, [orderId]);
    run("DELETE FROM order_items WHERE order_id = ?", [orderId]);
    writeQuoteLines(orderId, quote);
    run(
      `UPDATE orders SET customer_name = ?, customer_mobile = ?, subtotal = ?, tax = ?, discount = ?, total = ?, notes = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
      [name, mobile || "", quote.subtotal, quote.tax, quote.discount, quote.total, input.notes ?? current2.notes, now, now, orderId]
    );
    run(
      `INSERT INTO order_events (id, order_id, type, message, created_at, actor) VALUES (?, ?, 'items', 'Items updated', ?, 'staff')`,
      [(0, import_node_crypto6.randomUUID)(), orderId, now]
    );
    if (mobile) {
      const customerId = upsertCustomer(name, mobile, now);
      run("UPDATE orders SET customer_id = ? WHERE id = ?", [customerId, orderId]);
    }
    refreshTable(current2.tableId);
    return getOrder(orderId);
  });
  notify(order);
  return order;
}
function takeNumber() {
  const row = get("SELECT next_number FROM order_counters WHERE cafe_id = ?", [CAFE_ID]);
  if (!row) throw new AppError(500, "COUNTER", "Order counter is missing.");
  const issued = Math.max(100, row.next_number);
  run("UPDATE order_counters SET next_number = ? WHERE cafe_id = ?", [issued + 1, CAFE_ID]);
  return issued;
}
function refreshTable(tableId) {
  if (!tableId) return;
  const open = get(
    `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
    [tableId]
  );
  if ((open?.n ?? 0) > 0) {
    run("UPDATE tables SET status = ?, updated_at = ? WHERE id = ?", ["OCCUPIED", (/* @__PURE__ */ new Date()).toISOString(), tableId]);
    return;
  }
  const latest = get(
    `SELECT status, payment_status FROM orders WHERE table_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [tableId]
  );
  const paid = latest?.status === "COMPLETED" && latest.payment_status === "PAID";
  run("UPDATE tables SET status = ?, updated_at = ? WHERE id = ?", [paid ? "OCCUPIED" : "AVAILABLE", (/* @__PURE__ */ new Date()).toISOString(), tableId]);
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
    const id = (0, import_node_crypto6.randomUUID)();
    run("INSERT INTO customers (id, cafe_id, name, mobile, order_count, last_order_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)", [id, CAFE_ID, name, mobile, when, when]);
    return id;
  }
  run("UPDATE customers SET name = ?, order_count = order_count + 1, last_order_at = ? WHERE id = ?", [name, when, existing.id]);
  return existing.id;
}
function seatHeldReservation(tableId) {
  if (!tableId) return;
  run(`UPDATE reservations SET status = 'SEATED' WHERE cafe_id = ? AND table_id = ? AND status = 'HELD'`, [CAFE_ID, tableId]);
}
function heldReservation(tableId) {
  const row = get(
    `SELECT id, table_id, customer_name, mobile, covers, starts_at FROM reservations WHERE cafe_id = ? AND table_id = ? AND status = 'HELD'`,
    [CAFE_ID, tableId]
  );
  if (!row) return null;
  return {
    id: row.id,
    tableId: row.table_id,
    customerName: row.customer_name,
    mobile: row.mobile,
    covers: row.covers,
    startsAt: row.starts_at
  };
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
  if (!order || order.status === "DRAFT") return;
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
  const id = (0, import_node_crypto6.randomUUID)();
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
    if (existing) {
      const mergedId = mergedIntoId(existing);
      if (mergedId) {
        const combined = getOrder(mergedId);
        if (combined && !["CANCELLED", "OTP_PENDING", "DRAFT"].includes(combined.status)) return combined;
      }
      if (!["CANCELLED", "OTP_PENDING", "DRAFT"].includes(existing.status)) return existing;
    }
  }
  const id = input.clientKey ?? (0, import_node_crypto6.randomUUID)();
  const order = tx(() => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const customerId = upsertCustomer(name, mobile, now);
    foldUnpaidTicketsOnTable(table.id);
    const open = unpaidOpenOnTable(table.id);
    if (open) {
      const combined = appendItemsToOpenOrder(open.id, input.items, "customer");
      seatHeldReservation(table.id);
      return combined;
    }
    const quote = quoteOrThrow(input.items);
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
    seatHeldReservation(table.id);
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
    if (existing && (existing.status === "CANCELLED" || existing.status === "DRAFT")) {
      run(`UPDATE orders SET client_key = NULL WHERE id = ?`, [existing.id]);
    } else if (existing && existing.status !== "CANCELLED" && existing.status !== "DRAFT") {
      const mergedId = mergedIntoId(existing);
      if (mergedId) {
        const combined = getOrder(mergedId);
        if (combined && combined.status !== "CANCELLED" && combined.status !== "DRAFT") return { order: combined };
      }
      if (existing.status === "OTP_PENDING" || existing.status === "CONFIRMED" || OPEN_STATUSES.includes(existing.status)) {
        const otp = existing.status === "OTP_PENDING" ? await currentOtp(existing.id, existing.customerMobile) : null;
        return { order: existing, ...otp };
      }
    }
  }
  const id = (0, import_node_crypto6.randomUUID)();
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
      eventMessage: null,
      notes: guestCheckoutNotes(input)
    });
  });
  try {
    const otp = await issueOtp(order.id, mobile);
    notify(getOrder(order.id));
    return { order, ...otp };
  } catch (error) {
    tx(() => {
      run(
        `UPDATE orders SET status = 'CANCELLED', client_key = NULL, updated_at = ? WHERE id = ? AND status = 'OTP_PENDING'`,
        [(/* @__PURE__ */ new Date()).toISOString(), order.id]
      );
    });
    const message = error instanceof Error ? error.message : "Could not send the verification code.";
    throw new AppError(502, "OTP", message);
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
  const alreadyMerged = mergedIntoId(existing);
  if (alreadyMerged) {
    const combined = getOrder(alreadyMerged);
    if (combined && combined.status !== "CANCELLED" && combined.status !== "DRAFT") return combined;
  }
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
    run(`UPDATE otp_challenges SET status = 'VERIFIED' WHERE id = ?`, [challenge.id]);
    if (current2.tableId) {
      foldUnpaidTicketsOnTable(current2.tableId, current2.id);
      const open = unpaidOpenOnTable(current2.tableId, current2.id);
      if (open) {
        const combined = appendItemsToOpenOrder(open.id, cartLinesFromOrder(current2), "customer");
        markMergedInto(current2.id, combined.id);
        refreshTable(current2.tableId);
        seatHeldReservation(current2.tableId);
        return combined;
      }
    }
    run(
      `UPDATE orders SET status = 'CONFIRMED', customer_id = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
      [customerId, now, now, orderId]
    );
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, 'OTP_PENDING', 'CONFIRMED', ?, 'customer')`,
      [(0, import_node_crypto6.randomUUID)(), orderId, statusMessage("CONFIRMED"), now]
    );
    refreshTable(current2.tableId);
    seatHeldReservation(current2.tableId);
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
    run(`UPDATE orders SET status = 'CANCELLED', client_key = NULL, updated_at = ? WHERE id = ?`, [now, orderId]);
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
  const id = input.id ?? (0, import_node_crypto6.randomUUID)();
  const order = tx(() => {
    if (table && !input.allowOpenTable) {
      const busy = get(
        `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
        [table.id]
      );
      if ((busy?.n ?? 0) > 0) throw new AppError(409, "TABLE_BUSY", "This table already has an open order.");
    }
    const quote = quoteOrThrow(input.items, input.discount ?? 0);
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
      eventMessage: statusMessage("CONFIRMED"),
      notes: input.notes ?? ""
    });
    if (mobile) {
      const customerId = upsertCustomer(name, mobile, created.createdAt);
      run("UPDATE orders SET customer_id = ? WHERE id = ?", [customerId, id]);
    }
    if (table) seatHeldReservation(table.id);
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
      [(0, import_node_crypto6.randomUUID)(), orderId, statusMessage(to), current2.status, to, now, actor]
    );
    refreshTable(current2.tableId);
    return getOrder(orderId);
  });
  notify(order);
  return order;
}
function markPaid(orderId, method, amount) {
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current2.status === "CANCELLED" || current2.status === "DRAFT" || current2.status === "OTP_PENDING") {
      throw new AppError(409, "PAYMENT", "This order cannot be marked paid.");
    }
    if (!PAYMENT_METHODS.includes(method)) throw new AppError(400, "PAYMENT", "Unknown payment method.");
    if (current2.paymentStatus === "PAID") return current2;
    const remaining = dueTotal(current2);
    const take = amount ?? remaining;
    if (!Number.isInteger(take) || take < 1) throw new AppError(400, "PAYMENT", "Enter an amount of at least \u20B91.");
    if (take > remaining) throw new AppError(400, "PAYMENT", "Amount is more than the remainder.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run("INSERT INTO payments (id, order_id, method, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", [(0, import_node_crypto6.randomUUID)(), orderId, method, take, "PAID", now]);
    const closed = take === remaining;
    if (closed) {
      run(`UPDATE orders SET payment_status = 'PAID', status = 'COMPLETED', updated_at = ? WHERE id = ?`, [now, orderId]);
      run(
        `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'payment', 'Paid', ?, 'PAID', ?, 'staff')`,
        [(0, import_node_crypto6.randomUUID)(), orderId, current2.paymentStatus, now]
      );
      if (current2.status !== "COMPLETED") {
        run(
          `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, 'COMPLETED', ?, 'staff')`,
          [(0, import_node_crypto6.randomUUID)(), orderId, statusMessage("COMPLETED"), current2.status, now]
        );
      }
    } else {
      run("UPDATE orders SET updated_at = ? WHERE id = ?", [now, orderId]);
      run(
        `INSERT INTO order_events (id, order_id, type, message, created_at, actor) VALUES (?, ?, 'payment', ?, ?, 'staff')`,
        [(0, import_node_crypto6.randomUUID)(), orderId, `Part paid (${take})`, now]
      );
    }
    refreshTable(current2.tableId);
    const updated = getOrder(orderId);
    if (closed) consumeInventoryForOrder(orderId, "staff");
    return updated;
  });
  notify(order);
  return order;
}
function splitStaffOrder(orderId, parts) {
  const current2 = getOrder(orderId);
  if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
  let amounts;
  try {
    amounts = splitAmounts(current2.total, parts);
  } catch (error) {
    throw new AppError(400, "SPLIT", error instanceof Error ? error.message : "Cannot split this bill.");
  }
  const children = tx(() => {
    const current3 = getOrder(orderId);
    if (!current3) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current3.paymentStatus === "PAID" || current3.status === "CANCELLED" || current3.status === "OTP_PENDING" || current3.status === "DRAFT") {
      throw new AppError(409, "SPLIT", "This order can no longer be split.");
    }
    if (dueTotal(current3) !== current3.total) {
      throw new AppError(409, "SPLIT", "Split before taking part payment.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const created = [];
    const subtotals = current3.subtotal < 1 ? amounts.map(() => 0) : splitAmounts(current3.subtotal, amounts.length);
    const taxes = current3.tax < 1 ? amounts.map(() => 0) : splitAmounts(current3.tax, amounts.length);
    const discounts = current3.discount < 1 ? amounts.map(() => 0) : splitAmounts(current3.discount, amounts.length);
    for (let index = 0; index < amounts.length; index += 1) {
      const id = (0, import_node_crypto6.randomUUID)();
      const notes = [`SPLIT:${index + 1}/${amounts.length}`, `PARENT:${current3.id}`, current3.notes].filter(Boolean).join("\n").slice(0, 400);
      run(
        `INSERT INTO orders (
          id, order_number, cafe_id, table_id, table_name, customer_id, customer_name, customer_mobile,
          status, payment_status, subtotal, tax, discount, total, source, notes, client_key, created_at, updated_at, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          takeNumber(),
          CAFE_ID,
          current3.tableId,
          current3.tableName ?? "",
          current3.customerId,
          current3.customerName,
          current3.customerMobile,
          current3.status,
          subtotals[index],
          taxes[index],
          discounts[index],
          amounts[index],
          current3.source,
          notes,
          id,
          now,
          now,
          now
        ]
      );
      for (const item of current3.items) {
        const shares = item.total < 1 ? amounts.map(() => 0) : splitAmounts(item.total, amounts.length);
        const itemId = (0, import_node_crypto6.randomUUID)();
        run(
          `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, total, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, item.menuItemId, item.nameSnapshot, item.quantity, item.unitPrice, shares[index], item.notes]
        );
        for (const addon of item.addons) {
          run(
            `INSERT INTO order_item_addons (id, order_item_id, addon_id, name_snapshot, price_snapshot) VALUES (?, ?, ?, ?, ?)`,
            [(0, import_node_crypto6.randomUUID)(), itemId, addon.addonId, addon.nameSnapshot, addon.priceSnapshot]
          );
        }
      }
      run(
        `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, NULL, ?, ?, 'staff')`,
        [(0, import_node_crypto6.randomUUID)(), id, `Split bill ${index + 1}/${amounts.length}`, current3.status, now]
      );
      created.push(getOrder(id));
    }
    run(`UPDATE orders SET status = 'CANCELLED', notes = ?, updated_at = ? WHERE id = ?`, [
      [`SPLIT`, current3.notes].filter(Boolean).join("\n").slice(0, 400),
      now,
      orderId
    ]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, 'CANCELLED', ?, 'staff')`,
      [(0, import_node_crypto6.randomUUID)(), orderId, `Split into ${amounts.length} bills`, current3.status, now]
    );
    refreshTable(current3.tableId);
    return created;
  });
  for (const child of children) notify(child);
  const parent = getOrder(orderId);
  if (parent) notify(parent);
  return children;
}
function parseProductSheet(raw) {
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const productType = data.productType === "service" || data.productType === "combo" ? data.productType : "goods";
  return {
    productType,
    trackInventory: Boolean(data.trackInventory),
    sales: data.sales !== false,
    purchase: data.purchase !== false,
    pos: data.pos !== false,
    salesTax: typeof data.salesTax === "string" ? data.salesTax.slice(0, 40) : "",
    cost: typeof data.cost === "string" ? data.cost.slice(0, 16) : "",
    purchaseTax: typeof data.purchaseTax === "string" ? data.purchaseTax.slice(0, 40) : "",
    reference: typeof data.reference === "string" ? data.reference.slice(0, 40) : "",
    barcode: typeof data.barcode === "string" ? data.barcode.slice(0, 40) : "",
    tags: typeof data.tags === "string" ? data.tags.slice(0, 80) : ""
  };
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
    isFavorite: item.isFavorite,
    shortcutNum: item.shortcutNum,
    shortcutAlpha: item.shortcutAlpha,
    sortOrder: item.sortOrder,
    addonGroupIds: item.addonGroupIds,
    menuLead: item.menuLead,
    menuSubtitle: item.menuSubtitle,
    kcalLabel: item.kcalLabel,
    ingredients: item.ingredients,
    sheet: item.sheet
  };
}
function cleanNumericShortcut(value) {
  const clean = normalizeShortcut(value ?? "");
  if (!clean) return null;
  if (!/^\d{1,4}$/.test(clean)) throw new AppError(400, "SHORTCUT", "Numeric shortcut must be 1\u20134 digits.");
  return clean;
}
function cleanAlphaShortcut(value) {
  const clean = normalizeShortcut(value ?? "");
  if (!clean) return null;
  if (!/^[A-Z]{1,8}$/.test(clean)) throw new AppError(400, "SHORTCUT", "Alphabetic shortcut must be 1\u20138 letters.");
  return clean;
}
function assertShortcutFree(itemId, num, alpha) {
  const codes = [num, alpha].filter((code) => Boolean(code));
  if (!codes.length) return;
  const rows = all(
    "SELECT id, name, shortcut_num, shortcut_alpha FROM menu_items WHERE cafe_id = ? AND id != ?",
    [CAFE_ID, itemId]
  );
  for (const row of rows) {
    const taken = [row.shortcut_num, row.shortcut_alpha].filter(Boolean).map((code) => normalizeShortcut(code ?? ""));
    for (const code of codes) {
      if (taken.includes(code)) throw new AppError(400, "SHORTCUT", `Shortcut ${code} is already used on ${row.name}.`);
    }
  }
}
function updateMenuItem(id, patch) {
  const current2 = loadCatalog().items.find((item2) => item2.id === id);
  if (!current2) throw new AppError(404, "NOT_FOUND", "Menu item not found.");
  const categoryId = patch.categoryId !== void 0 ? patch.categoryId : current2.categoryId;
  if (!loadCatalog().categories.some((entry) => entry.id === categoryId)) {
    throw new AppError(404, "NOT_FOUND", "Category not found.");
  }
  const next = {
    name: patch.name !== void 0 ? cleanName(patch.name) : current2.name,
    description: patch.description !== void 0 ? patch.description.trim().slice(0, 400) : current2.description,
    price: patch.price !== void 0 ? patch.price : current2.price,
    isAvailable: patch.isAvailable !== void 0 ? patch.isAvailable : current2.isAvailable,
    imageUrl: patch.imageUrl !== void 0 ? cleanImage(patch.imageUrl) : current2.imageUrl,
    isVeg: patch.isVeg !== void 0 ? patch.isVeg : current2.isVeg,
    isFavorite: patch.isFavorite !== void 0 ? patch.isFavorite : current2.isFavorite,
    shortcutNum: patch.shortcutNum !== void 0 ? cleanNumericShortcut(patch.shortcutNum) : current2.shortcutNum,
    shortcutAlpha: patch.shortcutAlpha !== void 0 ? cleanAlphaShortcut(patch.shortcutAlpha) : current2.shortcutAlpha,
    menuLead: patch.menuLead !== void 0 ? patch.menuLead.trim().slice(0, 24) : current2.menuLead,
    menuSubtitle: patch.menuSubtitle !== void 0 ? patch.menuSubtitle.trim().slice(0, 80) : current2.menuSubtitle,
    kcalLabel: patch.kcalLabel !== void 0 ? patch.kcalLabel.trim().slice(0, 40) : current2.kcalLabel,
    ingredients: patch.ingredients !== void 0 ? parseIngredientList(serializeIngredients(patch.ingredients)) : current2.ingredients,
    categoryId,
    sheet: patch.sheet !== void 0 ? parseProductSheet(JSON.stringify(patch.sheet)) : current2.sheet ?? parseProductSheet(null)
  };
  if (!Number.isInteger(next.price) || next.price < 0 || next.price > 1e5) throw new AppError(400, "PRICE", "Enter a valid price.");
  if (next.shortcutNum && next.shortcutAlpha && next.shortcutNum === next.shortcutAlpha) {
    throw new AppError(400, "SHORTCUT", "Numeric and alphabetic shortcuts on one item must differ.");
  }
  assertShortcutFree(id, next.shortcutNum, next.shortcutAlpha);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `UPDATE menu_items SET name = ?, description = ?, price = ?, is_available = ?, image_url = ?, is_veg = ?, is_favorite = ?, shortcut_num = ?, shortcut_alpha = ?, menu_lead = ?, menu_subtitle = ?, kcal_label = ?, ingredients_json = ?, category_id = ?, sheet_json = ?, updated_at = ? WHERE id = ?`,
    [
      next.name,
      next.description,
      next.price,
      next.isAvailable ? 1 : 0,
      next.imageUrl,
      next.isVeg ? 1 : 0,
      next.isFavorite ? 1 : 0,
      next.shortcutNum,
      next.shortcutAlpha,
      next.menuLead,
      next.menuSubtitle,
      next.kcalLabel,
      serializeIngredients(next.ingredients),
      next.categoryId,
      JSON.stringify(next.sheet),
      now,
      id
    ]
  );
  const item = loadCatalog().items.find((entry) => entry.id === id);
  syncRecipesFromIngredients(id, item.ingredients, item.categoryId);
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
function latestOpenOrderOnTable(tableId) {
  const row = get(
    `${ORDER_SELECT} WHERE o.table_id = ? AND o.payment_status != 'PAID' AND o.status IN ('OTP_PENDING','CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.updated_at DESC LIMIT 1`,
    [tableId]
  );
  return row ? hydrate([row])[0] : null;
}
function setTableStage(tableId, stage) {
  const table = listTables().find((entry) => entry.id === tableId);
  if (!table) throw new AppError(404, "TABLE", "Table not found.");
  const open = latestOpenOrderOnTable(tableId);
  if (stage === "blank") {
    const activeRows = all(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('OTP_PENDING','CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.updated_at DESC`,
      [tableId]
    );
    for (const row of activeRows) {
      const order = hydrate([row])[0];
      if (order.status === "OTP_PENDING") cancelCheckout(order.id);
      else if (canTransition(order.status, "CANCELLED")) transitionOrder(order.id, "CANCELLED");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run("UPDATE tables SET status = ?, updated_at = ? WHERE id = ?", ["AVAILABLE", now, tableId]);
    publish({ type: "table.updated", tableId });
    return listTables().find((entry) => entry.id === tableId);
  }
  if (!open) throw new AppError(409, "TABLE", "No open order on this table.");
  if (stage === "running") transitionOrder(open.id, "CONFIRMED");
  else if (stage === "kot") transitionOrder(open.id, "PREPARING");
  else if (stage === "printed") transitionOrder(open.id, "SERVED");
  else if (stage === "paid") {
    const pref = paymentPreferenceFromNotes(open.notes);
    markPaid(open.id, pref === "CARD" ? "CARD" : pref === "UPI" ? "UPI" : "CASH");
  }
  refreshTable(tableId);
  return listTables().find((entry) => entry.id === tableId);
}
function createMenuItem(input) {
  const category = loadCatalog().categories.find((entry) => entry.id === input.categoryId);
  if (!category) throw new AppError(404, "NOT_FOUND", "Category not found.");
  const id = `item_${(0, import_node_crypto6.randomUUID)().replace(/-/g, "").slice(0, 10)}`;
  const name = cleanName(input.name);
  const guestDefaults = defaultGuestMetaForCategory(input.categoryId, name);
  if (!Number.isInteger(input.price) || input.price < 0 || input.price > 1e5) throw new AppError(400, "PRICE", "Enter a valid price.");
  const shortcutNum = cleanNumericShortcut(input.shortcutNum);
  const shortcutAlpha = cleanAlphaShortcut(input.shortcutAlpha);
  assertShortcutFree(id, shortcutNum, shortcutAlpha);
  const siblings = loadCatalog().items.filter((item2) => item2.categoryId === input.categoryId);
  const sortOrder = siblings.reduce((max, item2) => Math.max(max, item2.sortOrder), 0) + 1;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const imageUrl = cleanImage(input.imageUrl ?? null);
  const menuLead = (input.menuLead ?? guestDefaults.menuLead).trim().slice(0, 24);
  const menuSubtitle = (input.menuSubtitle ?? guestDefaults.menuSubtitle).trim().slice(0, 80);
  const kcalLabel = (input.kcalLabel ?? guestDefaults.kcalLabel).trim().slice(0, 40);
  const ingredients = parseIngredientList(
    serializeIngredients(input.ingredients?.length ? input.ingredients : guestDefaults.ingredients)
  );
  run(
    `INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, image_url, is_veg, is_available, is_favorite, shortcut_num, shortcut_alpha, sort_order, menu_lead, menu_subtitle, kcal_label, ingredients_json, sheet_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      CAFE_ID,
      input.categoryId,
      name,
      (input.description ?? "").trim().slice(0, 400),
      input.price,
      imageUrl,
      input.isVeg === false ? 0 : 1,
      input.isFavorite ? 1 : 0,
      shortcutNum,
      shortcutAlpha,
      sortOrder,
      menuLead,
      menuSubtitle,
      kcalLabel,
      serializeIngredients(ingredients),
      JSON.stringify(parseProductSheet(JSON.stringify(input.sheet ?? {}))),
      now
    ]
  );
  const addonGroupIds = input.addonGroupIds?.length ? input.addonGroupIds : defaultAddonGroupsForCategory(input.categoryId);
  if (addonGroupIds.length) setItemGroups(id, addonGroupIds);
  const item = loadCatalog().items.find((entry) => entry.id === id);
  syncRecipesFromIngredients(id, item.ingredients, item.categoryId);
  publish({ type: "menu.updated", item: itemEvent(item) });
  return item;
}
function createTable(input) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "TABLE", "Enter a table name.");
  const area = input.area?.trim() || "Ground Floor";
  const qr = name.replace(/\s+/g, "").toUpperCase();
  const clash = get("SELECT id FROM tables WHERE cafe_id = ? AND (name = ? OR qr_code = ?)", [CAFE_ID, name, qr]);
  if (clash) throw new AppError(409, "TABLE", "A table with that name already exists.");
  const label = tableLabel(name);
  const labelClash = all(
    "SELECT name FROM tables WHERE cafe_id = ? AND COALESCE(area, 'Ground Floor') = ?",
    [CAFE_ID, area]
  ).find((entry) => tableLabel(entry.name) === label);
  if (labelClash) throw new AppError(409, "TABLE", `Table ${label} already exists on ${area}.`);
  const id = `table_${qr.toLowerCase()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `INSERT INTO tables (id, cafe_id, name, qr_code, status, area, updated_at) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
    [id, CAFE_ID, name, qr, area, now]
  );
  publish({ type: "table.updated", tableId: id });
  const created = listTables().find((entry) => entry.id === id);
  if (!created) throw new AppError(500, "TABLE", "Could not create the table.");
  return created;
}
function reassignOrderTable(orderId, tableId) {
  const order = tx(() => {
    const current2 = getOrder(orderId);
    if (!current2) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (!OPEN_STATUSES.includes(current2.status) || current2.paymentStatus === "PAID") {
      throw new AppError(409, "ORDER", "Only an open unpaid order can move.");
    }
    const dest = findTable(tableId);
    if (!dest) throw new AppError(404, "TABLE", "Table not found.");
    if (current2.tableId === dest.id) return current2;
    const busy = get(
      `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND id != ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
      [dest.id, orderId]
    );
    if ((busy?.n ?? 0) > 0) throw new AppError(409, "TABLE_BUSY", "That table already has an open order.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    run("UPDATE orders SET table_id = ?, table_name = ?, updated_at = ? WHERE id = ?", [dest.id, dest.name, now, orderId]);
    refreshTable(current2.tableId);
    refreshTable(dest.id);
    return getOrder(orderId);
  });
  notify(order);
  return order;
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
  const tables = all(
    `SELECT id, name, qr_code, status, COALESCE(area, 'Ground Floor') AS area
     FROM tables WHERE cafe_id = ?
     ORDER BY CASE COALESCE(area, 'Ground Floor')
       WHEN 'Ground Floor' THEN 1
       WHEN 'Basement' THEN 2
       WHEN 'Party Hall' THEN 3
       ELSE 4
     END, name`,
    [CAFE_ID]
  );
  return tables.map((table) => {
    const opens = all(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.updated_at DESC`,
      [table.id]
    );
    let hydrated = opens.length ? hydrate(opens) : [];
    let latest = hydrated[0] ?? null;
    if (!latest) {
      const pending = all(
        `${ORDER_SELECT} WHERE o.table_id = ? AND o.status = 'OTP_PENDING' ORDER BY o.updated_at DESC LIMIT 1`,
        [table.id]
      );
      if (pending.length) {
        hydrated = hydrate(pending);
        latest = hydrated[0] ?? null;
      }
    }
    const due = hydrated.reduce((sum, order) => sum + dueTotal(order), 0);
    const paidRows = latest || table.status !== "OCCUPIED" ? [] : all(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status = 'COMPLETED' AND o.payment_status = 'PAID' ORDER BY o.updated_at DESC LIMIT 1`,
      [table.id]
    );
    const paid = paidRows.length ? hydrate(paidRows)[0] ?? null : null;
    const shown = latest ?? paid;
    const hold = heldReservation(table.id);
    return {
      id: table.id,
      name: table.name,
      qrCode: table.qr_code,
      status: shown ? "OCCUPIED" : table.status,
      area: table.area || "Ground Floor",
      openOrder: shown ? {
        id: shown.id,
        orderNumber: shown.orderNumber,
        customerName: shown.customerName,
        total: latest ? hydrated.reduce((sum, order) => sum + order.total, 0) : shown.total,
        paymentStatus: shown.paymentStatus,
        status: shown.status,
        createdAt: shown.createdAt,
        due: latest ? due : 0
      } : null,
      reservation: shown ? null : hold
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
function clearAllCustomers() {
  run("UPDATE orders SET customer_id = NULL WHERE cafe_id = ?", [CAFE_ID]);
  run("DELETE FROM customers WHERE cafe_id = ?", [CAFE_ID]);
}
function deleteCustomer(customerId) {
  const row = get("SELECT id FROM customers WHERE id = ? AND cafe_id = ?", [customerId, CAFE_ID]);
  if (!row) throw new AppError(404, "CUSTOMER", "Customer not found.");
  run("UPDATE orders SET customer_id = NULL WHERE customer_id = ?", [customerId]);
  run("DELETE FROM customers WHERE id = ?", [customerId]);
}
function listCustomers() {
  return all(
    `SELECT c.id, c.name, c.mobile, c.last_order_at,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('DRAFT','OTP_PENDING','CANCELLED')) AS order_count,
      (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('DRAFT','OTP_PENDING','CANCELLED')) AS spent
     FROM customers c WHERE c.cafe_id = ? ORDER BY c.last_order_at DESC`,
    [CAFE_ID]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    orderCount: row.order_count,
    spent: row.spent,
    lastOrderAt: row.last_order_at
  }));
}
function createCustomer(name, mobile) {
  const digits = normalizeMobile(mobile);
  if (!digits) throw new AppError(400, "MOBILE", "Enter a valid 10-digit mobile number.");
  const label = cleanName(name);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = get("SELECT id FROM customers WHERE cafe_id = ? AND mobile = ?", [CAFE_ID, digits]);
  if (existing) {
    run("UPDATE customers SET name = ? WHERE id = ?", [label, existing.id]);
  } else {
    run(
      "INSERT INTO customers (id, cafe_id, name, mobile, order_count, last_order_at, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      [(0, import_node_crypto6.randomUUID)(), CAFE_ID, label, digits, now]
    );
  }
  const row = listCustomers().find((customer) => customer.mobile === digits);
  if (!row) throw new AppError(500, "CUSTOMER", "Could not save the customer.");
  return row;
}
function listCustomerOrders(customerId) {
  const rows = all(
    `${ORDER_SELECT} WHERE o.cafe_id = ? AND o.customer_id = ? AND o.status != 'DRAFT' ORDER BY o.created_at DESC LIMIT 80`,
    [CAFE_ID, customerId]
  );
  return hydrate(rows);
}
function createReservation(input) {
  const table = get("SELECT id FROM tables WHERE cafe_id = ? AND id = ?", [CAFE_ID, input.tableId]);
  if (!table) throw new AppError(404, "TABLE", "Table not found.");
  const current2 = listTables().find((entry) => entry.id === input.tableId);
  if (current2?.openOrder) throw new AppError(409, "TABLE_BUSY", "This table is occupied.");
  if (heldReservation(input.tableId)) throw new AppError(409, "RESERVED", "This table is already reserved.");
  let mobile = "";
  if (input.customerMobile?.trim()) {
    const digits = normalizeMobile(input.customerMobile);
    if (!digits) throw new AppError(400, "MOBILE", "Enter a valid 10-digit mobile number.");
    mobile = digits;
  }
  let startsAt = (/* @__PURE__ */ new Date()).toISOString();
  if (input.startsAt?.trim()) {
    const parsed = new Date(input.startsAt);
    if (Number.isNaN(parsed.getTime())) throw new AppError(400, "TIME", "Enter a valid reservation time.");
    startsAt = parsed.toISOString();
  }
  const id = (0, import_node_crypto6.randomUUID)();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `INSERT INTO reservations (id, cafe_id, table_id, customer_name, mobile, covers, starts_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?)`,
    [id, CAFE_ID, input.tableId, cleanName(input.customerName), mobile, input.covers, startsAt, now]
  );
  publish({ type: "table.updated", tableId: input.tableId });
  return heldReservation(input.tableId);
}
function cancelReservation(id) {
  const row = get("SELECT id, table_id, status FROM reservations WHERE id = ? AND cafe_id = ?", [id, CAFE_ID]);
  if (!row) throw new AppError(404, "NOT_FOUND", "Reservation not found.");
  if (row.status !== "HELD") throw new AppError(409, "STATE", "That reservation is no longer held.");
  run(`UPDATE reservations SET status = 'CANCELLED' WHERE id = ?`, [id]);
  publish({ type: "table.updated", tableId: row.table_id });
  return listTables().find((entry) => entry.id === row.table_id);
}
function listOrdersCreatedBetween(fromIso, toIso) {
  const rows = all(
    `${ORDER_SELECT} WHERE o.cafe_id = ? AND o.created_at >= ? AND o.created_at < ? AND o.status != 'DRAFT' ORDER BY o.created_at ASC`,
    [CAFE_ID, fromIso, toIso]
  );
  return hydrate(rows);
}
function reportRange(fromYmd, toYmd) {
  const catalog = loadCatalog();
  const zone = catalog.cafe.timezone;
  const today = formatZonedYmd(zone);
  let startDay;
  let endDay;
  try {
    startDay = parseYmd(fromYmd || today);
    endDay = parseYmd(toYmd || fromYmd || today);
  } catch (error) {
    throw new AppError(400, "RANGE", error instanceof Error ? error.message : "Invalid date.");
  }
  if (endDay < startDay) throw new AppError(400, "RANGE", "End date must be on or after start date.");
  const from = zonedDayStart(zone, startDay);
  const to = zonedDayStart(zone, shiftYmd(endDay, 1));
  const days = Math.round((to.getTime() - from.getTime()) / 864e5);
  if (days > 62) throw new AppError(400, "RANGE", "Pick a range of 62 days or less.");
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const orders = listOrdersCreatedBetween(fromIso, toIso);
  const payRows = all(
    `SELECT p.method, p.amount, p.status, p.created_at, o.notes
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.cafe_id = ? AND p.created_at >= ? AND p.created_at < ? AND p.status = 'PAID'`,
    [CAFE_ID, fromIso, toIso]
  );
  const categoryByItem = new Map(catalog.items.map((item) => [
    item.id,
    catalog.categories.find((category) => category.id === item.categoryId)?.name ?? "Other"
  ]));
  return buildSalesReport({
    orders,
    payments: payRows.map((row) => ({
      method: row.method,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
      complimentary: orderFlag(row.notes, "COMPLIMENTARY")
    })),
    categoryName: (menuItemId) => menuItemId ? categoryByItem.get(menuItemId) ?? "Other" : "Other",
    timeZone: zone,
    from: fromIso,
    to: toIso,
    fromYmd: startDay,
    toYmd: endDay
  });
}
function reportToday() {
  return reportRange();
}
function snapshot() {
  const catalog = loadCatalog();
  const folded = tx(() => {
    const tables = all("SELECT id FROM tables WHERE cafe_id = ?", [CAFE_ID]);
    const changed = [];
    for (const table of tables) {
      const before = unpaidOpenOrdersOnTable(table.id).map((order) => order.id).join(",");
      const combined = foldUnpaidTicketsOnTable(table.id);
      const after = unpaidOpenOrdersOnTable(table.id).map((order) => order.id).join(",");
      if (combined && before !== after) changed.push(combined);
    }
    return changed;
  });
  for (const order of folded) notify(order);
  return {
    cafe: catalog.cafe,
    categories: catalog.categories,
    items: catalog.items,
    addonGroups: catalog.addonGroups,
    tables: listTables(),
    orders: listOrders(),
    customers: listCustomers(),
    payments: { razorpayKeyId: publicRazorpayKey() },
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
          clientKey: String(payload.id || op.entityId),
          notes: String(payload.notes || ""),
          discount: typeof payload.discount === "number" ? payload.discount : 0,
          allowOpenTable: Boolean(payload.allowOpenTable)
        });
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === "UPDATE_ORDER" || op.operation === "MARK_PREPARING" || op.operation === "MARK_READY") {
        let order;
        if (op.operation === "UPDATE_ORDER" && Array.isArray(payload.items)) {
          order = replaceStaffOrderItems(op.entityId, {
            customerName: payload.customerName,
            customerMobile: payload.customerMobile,
            items: payload.items,
            notes: payload.notes,
            discount: typeof payload.discount === "number" ? payload.discount : void 0
          });
        }
        const status = op.operation === "MARK_PREPARING" ? "PREPARING" : op.operation === "MARK_READY" ? "READY" : payload.status;
        if (status) order = transitionOrder(op.entityId, status);
        results.push({ id: op.id, ok: true, order: order ?? getOrder(op.entityId) ?? void 0 });
        continue;
      }
      if (op.operation === "MARK_PAID") {
        const order = markPaid(op.entityId, payload.method, typeof payload.amount === "number" ? payload.amount : void 0);
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
          isVeg: payload.isVeg,
          isFavorite: payload.isFavorite,
          shortcutNum: payload.shortcutNum,
          shortcutAlpha: payload.shortcutAlpha,
          menuLead: payload.menuLead,
          menuSubtitle: payload.menuSubtitle,
          kcalLabel: payload.kcalLabel,
          ingredients: payload.ingredients,
          categoryId: payload.categoryId,
          sheet: payload.sheet
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

// server/posSession.ts
var import_node_crypto7 = require("node:crypto");
var DEFAULT_CONFIG_ID = "pos_config_restaurant";
function mapSession(row) {
  return {
    id: row.id,
    configId: row.config_id,
    configName: row.config_name,
    sequence: Number(row.sequence) || 0,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openedBy: row.opened_by,
    openingCash: row.opening_cash,
    closingCash: row.closing_cash,
    countedCash: row.counted_cash,
    notes: row.notes
  };
}
function nextSequence(configId) {
  const row = get(
    "SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM pos_sessions WHERE config_id = ?",
    [configId]
  );
  return row?.n ?? 1;
}
function ensureSessionSequences() {
  const configs = all(
    `SELECT DISTINCT config_id FROM pos_sessions WHERE sequence IS NULL OR sequence = 0`
  );
  for (const { config_id } of configs) {
    const rows = all(
      "SELECT id FROM pos_sessions WHERE config_id = ? ORDER BY opened_at ASC",
      [config_id]
    );
    rows.forEach((row, index) => {
      run("UPDATE pos_sessions SET sequence = ? WHERE id = ?", [index + 1, row.id]);
    });
  }
}
function ensurePosDefaults() {
  const cafe = get("SELECT id FROM cafes WHERE id = ?", [CAFE_ID]);
  if (!cafe) return;
  if (!get("SELECT id FROM pos_configs WHERE id = ?", [DEFAULT_CONFIG_ID])) {
    run("INSERT INTO pos_configs (id, cafe_id, name, is_restaurant) VALUES (?, ?, ?, 1)", [
      DEFAULT_CONFIG_ID,
      CAFE_ID,
      "Restaurant"
    ]);
  }
  const defaultFloors = [
    { id: "floor_main", name: "Main Floor", sort: 0 },
    { id: "floor_patio", name: "Patio", sort: 1 },
    { id: "floor_terrace", name: "Terrace", sort: 2 },
    { id: "floor_rooftop", name: "Rooftop", sort: 3 },
    { id: "floor_lounge", name: "Lounge", sort: 4 }
  ];
  for (const floor of defaultFloors) {
    if (get("SELECT id FROM floors WHERE id = ?", [floor.id])) continue;
    if (get("SELECT id FROM floors WHERE cafe_id = ? AND name = ?", [CAFE_ID, floor.name])) continue;
    run("INSERT INTO floors (id, cafe_id, name, sort_order, background) VALUES (?, ?, ?, ?, ?)", [
      floor.id,
      CAFE_ID,
      floor.name,
      floor.sort,
      "white"
    ]);
  }
  const extraTables = [
    ...[21, 22, 23, 24].map((n) => ({ name: `T${String(n).padStart(2, "0")}`, qr: `T${String(n).padStart(2, "0")}`, area: "Terrace" })),
    ...[25, 26, 27, 28].map((n) => ({ name: `T${String(n).padStart(2, "0")}`, qr: `T${String(n).padStart(2, "0")}`, area: "Rooftop" })),
    ...[29, 30, 31, 32].map((n) => ({ name: `T${String(n).padStart(2, "0")}`, qr: `T${String(n).padStart(2, "0")}`, area: "Lounge" }))
  ];
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  for (const table of extraTables) {
    run(
      `INSERT OR IGNORE INTO tables (id, cafe_id, name, qr_code, status, area, updated_at)
       VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
      [`table_${table.qr.toLowerCase()}`, CAFE_ID, table.name, table.qr, table.area, nowIso]
    );
  }
  const tables = all(
    "SELECT id, name, COALESCE(area, 'Ground Floor') AS area FROM tables WHERE cafe_id = ? ORDER BY name",
    [CAFE_ID]
  );
  const floorIdByName = (name, fallback) => get("SELECT id FROM floors WHERE cafe_id = ? AND name = ?", [CAFE_ID, name])?.id ?? fallback;
  const floorForArea = (area) => {
    if (/terrace/i.test(area)) return floorIdByName("Terrace", "floor_terrace");
    if (/rooftop/i.test(area)) return floorIdByName("Rooftop", "floor_rooftop");
    if (/lounge/i.test(area)) return floorIdByName("Lounge", "floor_lounge");
    if (/patio|basement|party/i.test(area)) return floorIdByName("Patio", "floor_patio");
    return floorIdByName("Main Floor", "floor_main");
  };
  const counters = /* @__PURE__ */ new Map();
  for (const table of tables) {
    if (get("SELECT table_id FROM table_geometry WHERE table_id = ?", [table.id])) continue;
    const floorId = floorForArea(table.area);
    const index = counters.get(floorId) ?? 0;
    counters.set(floorId, index + 1);
    const col = index % 4;
    const row = Math.floor(index / 4);
    const wide = Number.parseInt(table.name.replace(/\D/g, ""), 10) % 3 === 0;
    run(
      `INSERT INTO table_geometry (table_id, floor_id, x, y, w, h, seats, shape, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        table.id,
        floorId,
        40 + col * 140,
        40 + row * 120,
        wide ? 160 : 90,
        90,
        wide ? 6 : 4,
        wide ? "rect" : "square",
        index < 6 ? "#111111" : index < 10 ? "#666666" : "#999999"
      ]
    );
  }
}
function getPosConfig(configId) {
  ensurePosDefaults();
  const row = configId ? get(
    "SELECT id, name, is_restaurant FROM pos_configs WHERE cafe_id = ? AND id = ?",
    [CAFE_ID, configId]
  ) : get(
    "SELECT id, name, is_restaurant FROM pos_configs WHERE cafe_id = ? ORDER BY id LIMIT 1",
    [CAFE_ID]
  );
  if (!row) throw new AppError(500, "POS", "POS config missing.");
  return { id: row.id, name: row.name, isRestaurant: !!row.is_restaurant };
}
function listPosConfigs() {
  ensurePosDefaults();
  return all(
    "SELECT id, name, is_restaurant FROM pos_configs WHERE cafe_id = ? ORDER BY id",
    [CAFE_ID]
  ).map((row) => ({ id: row.id, name: row.name, isRestaurant: !!row.is_restaurant }));
}
function getOpenSession(configId) {
  ensurePosDefaults();
  const row = configId ? get(
    `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
                s.opening_cash, s.closing_cash, s.counted_cash, s.notes
         FROM pos_sessions s
         JOIN pos_configs c ON c.id = s.config_id
         WHERE c.cafe_id = ? AND s.status = 'OPEN' AND s.config_id = ?
         ORDER BY s.opened_at DESC LIMIT 1`,
    [CAFE_ID, configId]
  ) : get(
    `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
                s.opening_cash, s.closing_cash, s.counted_cash, s.notes
         FROM pos_sessions s
         JOIN pos_configs c ON c.id = s.config_id
         WHERE c.cafe_id = ? AND s.status = 'OPEN'
         ORDER BY s.opened_at DESC LIMIT 1`,
    [CAFE_ID]
  );
  return row ? mapSession(row) : null;
}
function salesSeriesForSession(sessionId) {
  const rows = all(
    `SELECT total, COALESCE(updated_at, created_at) AS at
     FROM orders
     WHERE session_id = ? AND payment_status = 'PAID' AND status != 'CANCELLED'
     ORDER BY COALESCE(updated_at, created_at) ASC`,
    [sessionId]
  );
  const buckets = 32;
  const series = Array.from({ length: buckets }, () => 0);
  if (!rows.length) return series;
  const session = get("SELECT opened_at FROM pos_sessions WHERE id = ?", [sessionId]);
  const openedAt = session ? Date.parse(session.opened_at) : Date.parse(rows[0].at);
  const now = Date.now();
  const span = Math.max(now - openedAt, 6e4);
  for (const row of rows) {
    const t = Date.parse(row.at);
    const frac = Number.isFinite(t) ? (t - openedAt) / span : 1;
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(frac * buckets)));
    series[idx] += row.total;
  }
  return series;
}
function sessionStats(sessionId) {
  const session = sessionId ? get("SELECT opening_cash FROM pos_sessions WHERE id = ?", [sessionId]) : null;
  const openingCash = session?.opening_cash ?? 0;
  if (!sessionId) {
    return {
      openingCash: 0,
      soldTotal: 0,
      soldOrders: 0,
      ongoingTotal: 0,
      ongoingOrders: 0,
      salesSeries: []
    };
  }
  const sold = get(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM orders WHERE session_id = ? AND payment_status = 'PAID' AND status != 'CANCELLED'`,
    [sessionId]
  );
  const placeholders = OPEN_STATUSES.map(() => "?").join(",");
  const ongoing = get(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM orders WHERE session_id = ? AND payment_status != 'PAID' AND status IN (${placeholders})`,
    [sessionId, ...OPEN_STATUSES]
  );
  return {
    openingCash,
    soldTotal: sold?.total ?? 0,
    soldOrders: sold?.count ?? 0,
    ongoingTotal: ongoing?.total ?? 0,
    ongoingOrders: ongoing?.count ?? 0,
    salesSeries: salesSeriesForSession(sessionId)
  };
}
function posDashboard() {
  const configs = listPosConfigs();
  const cards = configs.map((config) => {
    const session = getOpenSession(config.id);
    return { config, session, stats: sessionStats(session?.id ?? null) };
  });
  const primary = cards[0] ?? null;
  return {
    config: primary?.config ?? getPosConfig(),
    session: primary?.session ?? null,
    stats: primary?.stats ?? sessionStats(null),
    cards
  };
}
function openSession(input) {
  ensurePosDefaults();
  const config = getPosConfig(input.configId);
  const existing = getOpenSession(config.id);
  if (existing) return existing;
  const openingCash = Math.max(0, Number(input.openingCash) || 0);
  const id = `ps_${(0, import_node_crypto7.randomUUID)().replace(/-/g, "").slice(0, 16)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const sequence = nextSequence(config.id);
  run(
    `INSERT INTO pos_sessions (id, config_id, status, opened_at, closed_at, opened_by, opening_cash, closing_cash, counted_cash, notes, sequence)
     VALUES (?, ?, 'OPEN', ?, NULL, ?, ?, NULL, NULL, '', ?)`,
    [id, config.id, now, input.userName.slice(0, 80) || "Staff", openingCash, sequence]
  );
  const session = getOpenSession(config.id);
  if (!session) throw new AppError(500, "POS", "Failed to open session.");
  return session;
}
function closeSession(input) {
  const open = getOpenSession();
  if (!open) throw new AppError(409, "POS", "No open register session.");
  const stats = sessionStats(open.id);
  const cashIn = all(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'IN'`,
    [open.id]
  ).reduce((s, r) => s + r.amount, 0);
  const cashOut = all(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'OUT'`,
    [open.id]
  ).reduce((s, r) => s + r.amount, 0);
  const paidCash = get(
    `SELECT COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.session_id = ? AND p.status = 'PAID' AND p.method = 'CASH'`,
    [open.id]
  )?.total ?? 0;
  const expectedCash = open.openingCash + paidCash + cashIn - cashOut;
  const countedCash = Math.max(0, Number(input.countedCash) || 0);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const notes = (input.notes ?? "").trim();
  run(
    `UPDATE pos_sessions SET status = 'CLOSED', closed_at = ?, closing_cash = ?, counted_cash = ?, notes = ?
     WHERE id = ?`,
    [now, expectedCash, countedCash, notes, open.id]
  );
  const row = get(
    `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
            s.opening_cash, s.closing_cash, s.counted_cash, s.notes
     FROM pos_sessions s JOIN pos_configs c ON c.id = s.config_id WHERE s.id = ?`,
    [open.id]
  );
  if (!row) throw new AppError(500, "POS", "Failed to close session.");
  void stats;
  return mapSession(row);
}
function listSessions(limit = 200) {
  ensurePosDefaults();
  ensureSessionSequences();
  const rows = all(
    `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
            s.opening_cash, s.closing_cash, s.counted_cash, s.notes
     FROM pos_sessions s
     JOIN pos_configs c ON c.id = s.config_id
     WHERE c.cafe_id = ?
     ORDER BY s.opened_at DESC LIMIT ?`,
    [CAFE_ID, limit]
  );
  return rows.map(mapSession);
}
function cashMove(input) {
  const open = getOpenSession();
  if (!open) throw new AppError(409, "POS", "Open the register first.");
  const amount = Math.max(0, Number(input.amount) || 0);
  if (amount <= 0) throw new AppError(400, "AMOUNT", "Enter an amount.");
  const id = `cm_${(0, import_node_crypto7.randomUUID)().replace(/-/g, "").slice(0, 16)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  run(
    `INSERT INTO pos_cash_moves (id, session_id, kind, amount, reason, created_at, actor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, open.id, input.kind, amount, input.reason.trim().slice(0, 240), now, input.actor.slice(0, 80)]
  );
  return {
    id,
    sessionId: open.id,
    kind: input.kind,
    amount,
    reason: input.reason.trim(),
    createdAt: now,
    actor: input.actor
  };
}
function listFloors() {
  ensurePosDefaults();
  const floors = all(
    "SELECT id, name, sort_order, background FROM floors WHERE cafe_id = ? ORDER BY sort_order, name",
    [CAFE_ID]
  ).map((f) => ({ id: f.id, name: f.name, sortOrder: f.sort_order, background: f.background }));
  const geometry = all(
    `SELECT g.table_id, g.floor_id, g.x, g.y, g.w, g.h, g.seats, g.shape, g.color
     FROM table_geometry g
     JOIN tables t ON t.id = g.table_id
     WHERE t.cafe_id = ?`,
    [CAFE_ID]
  ).map((g) => ({
    tableId: g.table_id,
    floorId: g.floor_id,
    x: g.x,
    y: g.y,
    w: g.w,
    h: g.h,
    seats: g.seats,
    shape: g.shape,
    color: g.color
  }));
  return { floors, geometry };
}
function saveFloors(payload) {
  ensurePosDefaults();
  tx(() => {
    for (const floor of payload.floors) {
      const existing = get("SELECT id FROM floors WHERE id = ? AND cafe_id = ?", [floor.id, CAFE_ID]);
      if (existing) {
        run("UPDATE floors SET name = ?, sort_order = ?, background = ? WHERE id = ?", [
          floor.name,
          floor.sortOrder,
          floor.background,
          floor.id
        ]);
      } else {
        run("INSERT INTO floors (id, cafe_id, name, sort_order, background) VALUES (?, ?, ?, ?, ?)", [
          floor.id,
          CAFE_ID,
          floor.name,
          floor.sortOrder,
          floor.background
        ]);
      }
    }
    for (const g of payload.geometry) {
      run(
        `INSERT INTO table_geometry (table_id, floor_id, x, y, w, h, seats, shape, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(table_id) DO UPDATE SET
           floor_id = excluded.floor_id, x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
           seats = excluded.seats, shape = excluded.shape, color = excluded.color`,
        [g.tableId, g.floorId, g.x, g.y, g.w, g.h, g.seats, g.shape, g.color]
      );
    }
  });
  return listFloors();
}
function closingPreview() {
  const open = getOpenSession();
  if (!open) throw new AppError(409, "POS", "No open register session.");
  const stats = sessionStats(open.id);
  const byMethod = all(
    `SELECT p.method AS method, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.session_id = ? AND p.status = 'PAID'
     GROUP BY p.method`,
    [open.id]
  );
  const cashIn = all(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'IN'`,
    [open.id]
  ).reduce((s, r) => s + r.amount, 0);
  const cashOut = all(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'OUT'`,
    [open.id]
  ).reduce((s, r) => s + r.amount, 0);
  const cashPaid = byMethod.find((m) => m.method === "CASH")?.total ?? 0;
  const expectedCash = open.openingCash + cashPaid + cashIn - cashOut;
  return {
    session: open,
    stats,
    byMethod,
    cashIn,
    cashOut,
    expectedCash,
    durationMs: Date.now() - new Date(open.openedAt).getTime()
  };
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
    addonGroups: catalog.addonGroups,
    payments: { razorpayKeyId: publicRazorpayKey() }
  });
}));
app.get("/api/payments/config", wrap((_req, res) => {
  res.json({ razorpayKeyId: publicRazorpayKey() });
}));
async function startRazorpayForOrder(orderId, amountPaise) {
  const order = getOrder(orderId);
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  if (order.paymentStatus === "PAID") throw new AppError(409, "PAYMENT", "This order is already paid.");
  if (!OPEN_STATUSES.includes(order.status)) {
    throw new AppError(409, "PAYMENT", "This order cannot be paid online yet.");
  }
  const duePaise = dueTotal(order) * 100;
  const take = amountPaise ?? duePaise;
  if (!Number.isInteger(take) || take < 100 || take > duePaise) {
    throw new AppError(400, "PAYMENT", "Enter an amount up to the amount due.");
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
      cafeName: loadCatalog().cafe.name
    };
  } catch (error) {
    if (error instanceof RazorpayError) throw new AppError(503, "PAYMENTS", error.message);
    throw error;
  }
}
function finishRazorpayForOrder(orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const order = getOrder(orderId);
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  try {
    verifyRazorpayPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  } catch (error) {
    if (error instanceof RazorpayError) throw new AppError(422, "PAYMENTS", error.message);
    throw error;
  }
  const paid = markPaid(orderId, "UPI");
  return paid;
}
app.post("/api/payments/razorpay/create", wrap(async (req, res) => {
  const body = razorpayCreateSchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, "PAYMENTS", "Online payments are not configured.");
  res.json(await startRazorpayForOrder(body.orderId, body.amount));
}));
app.post("/api/payments/razorpay/verify", wrap(async (req, res) => {
  const body = razorpayVerifySchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, "PAYMENTS", "Online payments are not configured.");
  const order = finishRazorpayForOrder(body.orderId, body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature);
  res.json({ order });
}));
app.post("/api/payments/razorpay/create-public", wrap(async (req, res) => {
  const body = razorpayCreateSchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, "PAYMENTS", "Online payments are not configured.");
  res.json(await startRazorpayForOrder(body.orderId, body.amount));
}));
app.post("/api/payments/razorpay/verify-public", wrap(async (req, res) => {
  const body = razorpayVerifySchema.parse(req.body);
  if (!razorpayEnabled()) throw new AppError(503, "PAYMENTS", "Online payments are not configured.");
  const order = finishRazorpayForOrder(body.orderId, body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature);
  res.json({ order: toPublicOrder(order) });
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
  if (!token) {
    res.status(401).json({ error: "Sign in required.", code: "AUTH" });
    return;
  }
  const touched = touchSession(token);
  if (!touched) {
    res.status(401).json({ error: "Sign in required.", code: "AUTH" });
    return;
  }
  res.setHeader("Set-Cookie", sessionCookie(touched.token, touched.maxAge));
  res.json({ user: touched.user });
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
app.patch("/api/orders/:id", requireAuth, wrap((req, res) => {
  const body = staffOrderPatchSchema.parse(req.body);
  const order = replaceStaffOrderItems(idOf(req.params.id), body);
  res.json({ order });
}));
app.post("/api/orders/:id/status", requireAuth, wrap((req, res) => {
  const body = statusSchema.parse(req.body);
  const order = transitionOrder(idOf(req.params.id), body.status);
  res.json({ order });
}));
app.post("/api/orders/:id/payments", requireAuth, wrap((req, res) => {
  const body = paymentSchema.parse(req.body);
  const order = markPaid(idOf(req.params.id), body.method, body.amount);
  res.json({ order });
}));
app.post("/api/orders/:id/split", requireAuth, wrap((req, res) => {
  const body = splitSchema.parse(req.body);
  const orders = splitStaffOrder(idOf(req.params.id), body.parts);
  res.json({ orders });
}));
app.post("/api/menu/items", requireAuth, wrap((req, res) => {
  const body = menuItemCreateSchema.parse(req.body);
  const item = createMenuItem(body);
  res.status(201).json({ item });
}));
app.post("/api/media/upload", requireAuth, wrap((req, res) => {
  const body = mediaUploadSchema.parse(req.body);
  const ext = body.mime === "image/png" ? "png" : body.mime === "image/webp" ? "webp" : "jpg";
  const safe = body.filename.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 40) || "photo";
  const name = `${Date.now()}-${(0, import_node_crypto8.randomUUID)().slice(0, 8)}-${safe}.${ext}`;
  const dir = import_node_path2.default.join(process.cwd(), "public", "uploads");
  (0, import_node_fs4.mkdirSync)(dir, { recursive: true });
  const raw = body.contentBase64.replace(/^data:[^;]+;base64,/, "");
  (0, import_node_fs4.writeFileSync)(import_node_path2.default.join(dir, name), Buffer.from(raw, "base64"));
  res.json({ url: `/uploads/${name}` });
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
app.post("/api/tables", requireAuth, wrap((req, res) => {
  const body = tableCreateSchema.parse(req.body);
  res.status(201).json({ table: createTable(body) });
}));
app.patch("/api/tables/:id", requireAuth, wrap((req, res) => {
  const body = tablePatchSchema.parse(req.body);
  const table = updateTable(idOf(req.params.id), body.status);
  res.json({ table });
}));
app.post("/api/tables/:id/stage", requireAuth, wrap((req, res) => {
  const body = tableStageSchema.parse(req.body);
  const table = setTableStage(idOf(req.params.id), body.stage);
  res.json({ table });
}));
app.patch("/api/orders/:id/table", requireAuth, wrap((req, res) => {
  const body = orderTableSchema.parse(req.body);
  res.json({ order: reassignOrderTable(idOf(req.params.id), body.tableId) });
}));
app.get("/api/customers", requireAuth, wrap((_req, res) => {
  res.json({ customers: listCustomers() });
}));
app.delete("/api/customers", requireAuth, wrap((_req, res) => {
  clearAllCustomers();
  res.json({ ok: true, customers: listCustomers() });
}));
app.delete("/api/customers/:id", requireAuth, wrap((req, res) => {
  deleteCustomer(idOf(req.params.id));
  res.json({ ok: true, customers: listCustomers() });
}));
app.post("/api/customers", requireAuth, wrap((req, res) => {
  const body = customerCreateSchema.parse(req.body);
  res.status(201).json({ customer: createCustomer(body.name, body.mobile) });
}));
app.get("/api/customers/:id/orders", requireAuth, wrap((req, res) => {
  res.json({ orders: listCustomerOrders(idOf(req.params.id)) });
}));
app.post("/api/reservations", requireAuth, wrap((req, res) => {
  const body = reservationCreateSchema.parse(req.body);
  res.status(201).json({ reservation: createReservation(body) });
}));
app.post("/api/reservations/:id/cancel", requireAuth, wrap((req, res) => {
  res.json({ table: cancelReservation(idOf(req.params.id)) });
}));
app.get("/api/reports", requireAuth, wrap((req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : void 0;
  const to = typeof req.query.to === "string" ? req.query.to : void 0;
  res.json(reportRange(from, to));
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
app.get("/api/inventory", requireAuth, wrap((_req, res) => {
  res.json(inventoryBundle());
}));
app.post("/api/inventory/items", requireAuth, wrap((req, res) => {
  const body = inventoryItemCreateSchema.parse(req.body);
  res.json({ item: createInventoryItem(body) });
}));
app.patch("/api/inventory/items/:id", requireAuth, wrap((req, res) => {
  const body = inventoryItemPatchSchema.parse(req.body);
  res.json({ item: updateInventoryItem(idOf(req.params.id), body) });
}));
app.post("/api/inventory/movements", requireAuth, wrap((req, res) => {
  const body = inventoryMovementSchema.parse(req.body);
  res.json({
    movement: recordInventoryMovement({
      ...body,
      actor: req.user?.name ?? "staff"
    })
  });
}));
app.get("/api/inventory/recipes/:menuItemId", requireAuth, wrap((req, res) => {
  res.json({ lines: listRecipesForMenuItem(idOf(req.params.menuItemId)) });
}));
app.put("/api/inventory/recipes/:menuItemId", requireAuth, wrap((req, res) => {
  const body = menuRecipesSchema.parse(req.body);
  res.json({ lines: saveMenuRecipes(idOf(req.params.menuItemId), body.lines) });
}));
app.get("/api/pos/dashboard", requireAuth, wrap((_req, res) => {
  res.json(posDashboard());
}));
app.post("/api/pos/session/open", requireAuth, wrap((req, res) => {
  const openingCash = typeof req.body?.openingCash === "number" ? req.body.openingCash : Number(req.body?.openingCash ?? 0);
  const configId = typeof req.body?.configId === "string" ? req.body.configId : void 0;
  const session = openSession({ openingCash, userName: req.user?.name ?? "Staff", configId });
  res.json({ session, stats: sessionStats(session.id), config: getPosConfig(session.configId) });
}));
app.post("/api/pos/session/close", requireAuth, wrap((req, res) => {
  const countedCash = typeof req.body?.countedCash === "number" ? req.body.countedCash : Number(req.body?.countedCash ?? 0);
  const notes = typeof req.body?.notes === "string" ? req.body.notes : "";
  const session = closeSession({ countedCash, notes });
  res.json({ session });
}));
app.get("/api/pos/session/closing", requireAuth, wrap((_req, res) => {
  res.json(closingPreview());
}));
app.post("/api/pos/cash-move", requireAuth, wrap((req, res) => {
  const kind = req.body?.kind === "OUT" ? "OUT" : "IN";
  const amount = typeof req.body?.amount === "number" ? req.body.amount : Number(req.body?.amount ?? 0);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
  res.json({
    move: cashMove({ kind, amount, reason, actor: req.user?.name ?? "Staff" })
  });
}));
app.get("/api/pos/sessions", requireAuth, wrap((_req, res) => {
  res.json({ sessions: listSessions() });
}));
app.get("/api/pos/floors", requireAuth, wrap((_req, res) => {
  res.json(listFloors());
}));
app.put("/api/pos/floors", requireAuth, wrap((req, res) => {
  const floors = Array.isArray(req.body?.floors) ? req.body.floors : [];
  const geometry = Array.isArray(req.body?.geometry) ? req.body.geometry : [];
  res.json(saveFloors({ floors, geometry }));
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

// server/catalog.ts
var CATEGORIES = [
  ["cat_drinks", "Drinks", 1],
  ["cat_canapes", "Canap\xE9s", 2],
  ["cat_appetizers", "Appetizers", 3],
  ["cat_salads", "Salads", 4],
  ["cat_sliders", "Sliders", 5],
  ["cat_mains", "Mains", 6]
];
var drink = (id, name, price, description, image, coffee = true) => ({
  id,
  name,
  price,
  description,
  categoryId: "cat_drinks",
  image,
  coffee
});
var plate = (id, name, price, description, categoryId, image) => ({
  id,
  name,
  price,
  description,
  categoryId,
  image,
  coffee: false
});
var MENU = [
  // POS register catalogue — Food (screenshot order first)
  plate("item_bacon_burger", "Bacon Burger", 320, "Beef patty, smoked bacon, cheddar, pickles, and house sauce on a toasted bun.", "cat_sliders", "/items/cut/burger.png"),
  plate("item_cheese_burger", "Cheese Burger", 290, "Classic beef burger with melted cheese, lettuce, tomato, and ketchup.", "cat_sliders", "/items/photos/cheese-burger.png"),
  plate("item_pizza_margherita", "Pizza Margherita", 350, "Tomato, mozzarella, and basil on a thin crust.", "cat_mains", "/items/photos/pizza-margherita.png"),
  plate("item_pizza_veg", "Pizza Vegetarian", 380, "Vegetable pizza with peppers, mushrooms, and olives.", "cat_mains", "/items/photos/pizza-vegetarian.png"),
  plate("item_pasta_4formaggi", "Pasta 4 Formaggi", 340, "Creamy four-cheese pasta, finished with cracked pepper.", "cat_mains", "/items/photos/pasta-4-formaggi.png"),
  plate("item_funghi", "Funghi", 320, "Saut\xE9ed mushrooms with garlic and herbs.", "cat_appetizers", "/items/cut/paneer.png"),
  plate("item_pasta_bolo", "Pasta Bolognese", 330, "Slow-cooked meat sauce over pasta.", "cat_mains", "/items/photos/pasta-bolognese.png"),
  plate("item_chicken_curry_sandwich", "Chicken Sandwich", 280, "Crispy chicken sandwich on a soft roll.", "cat_sliders", "/items/photos/chicken-sandwich.png"),
  plate("item_spicy_tuna_sandwich", "Tuna Sandwich", 290, "Tuna sandwich on a baguette.", "cat_sliders", "/items/photos/tuna-sandwich.png"),
  plate("item_mozzarella_sandwich", "Baguette", 260, "Baguette with tomato, cheese, and greens.", "cat_sliders", "/items/photos/baguette.png"),
  plate("item_club_sandwich", "Club Sandwich", 300, "Triple-decker club with chicken, egg, and salad.", "cat_sliders", "/items/cut/club.png"),
  plate("item_lunch_maki", "Maki", 420, "Maki rolls with salmon and avocado.", "cat_mains", "/items/photos/maki.png"),
  plate("item_lunch_salmon", "Sashimi Boat", 480, "Assorted sashimi served in a wooden boat.", "cat_mains", "/items/photos/sashimi-boat.png"),
  plate("item_lunch_temaki", "Temaki", 360, "Salmon temaki hand roll.", "cat_mains", "/items/photos/temaki.png"),
  plate("item_salmon_avocado", "Salmon and Avocado", 390, "Salmon and avocado on toast.", "cat_mains", "/items/photos/salmon-avocado.png"),
  // Screenshot drink row interleaved with food
  drink("item_coca_cola", "Coca-Cola", 80, "Chilled Coca-Cola in a glass.", "/items/cut/sparkling.png", false),
  drink("item_water", "Spa", 50, "Spa still water.", "/items/photos/spa.png", false),
  drink("item_minute_maid", "Minute Maid", 90, "Chilled Minute Maid.", "/items/photos/minute-maid.png", false),
  drink("item_espresso", "Espresso", 150, "A short espresso in a white cup.", "/items/photos/espresso.png", false),
  drink("item_green_tea", "Green Tea", 120, "Green tea with fresh mint.", "/items/photos/green-tea.png", false),
  drink("item_milkshake_banana", "Milkshake", 180, "Milkshake with whipped cream and chocolate.", "/items/photos/milkshake.png", false),
  drink("item_ice_tea", "Lipton Ice Tea", 110, "Lipton sparkling ice tea.", "/items/photos/lipton-ice-tea.png", false),
  drink("item_schweppes", "Schweppes Indian Tonic", 90, "Schweppes Indian Tonic.", "/items/photos/schweppes-indian-tonic.png", false),
  drink("item_fanta", "Fanta", 80, "Chilled Fanta orange.", "/items/photos/fanta.png", false),
  plate("item_burger_combo", "Burger Menu", 450, "Cheese burger, fries, and a soft drink.", "cat_mains", "/items/photos/burger-menu.png"),
  plate("item_sushi_combo", "Salmon Nigiri", 520, "Salmon nigiri on a platter.", "cat_mains", "/items/photos/salmon-nigiri.png")
];
var ITEM_POS = {
  item_bacon_burger: { num: "1", alpha: "BB", favorite: true },
  item_cheese_burger: { num: "2", alpha: "CHB", favorite: true },
  item_pizza_margherita: { num: "3", alpha: "PM", favorite: true },
  item_pizza_veg: { num: "4", alpha: "PV", favorite: true },
  item_pasta_4formaggi: { num: "5", alpha: "P4F", favorite: true },
  item_funghi: { num: "6", alpha: "FUN", favorite: true },
  item_pasta_bolo: { num: "7", alpha: "PBO", favorite: true },
  item_chicken_curry_sandwich: { num: "8", alpha: "CCS", favorite: true },
  item_spicy_tuna_sandwich: { num: "9", alpha: "STS", favorite: true },
  item_mozzarella_sandwich: { num: "10", alpha: "MS", favorite: true },
  item_club_sandwich: { num: "11", alpha: "CS", favorite: true },
  item_lunch_maki: { num: "12", alpha: "LM", favorite: true },
  item_lunch_salmon: { num: "13", alpha: "LS", favorite: true },
  item_lunch_temaki: { num: "14", alpha: "LT", favorite: true },
  item_salmon_avocado: { num: "15", alpha: "SA", favorite: true },
  item_burger_combo: { num: "16", alpha: "BMC", favorite: true },
  item_sushi_combo: { num: "17", alpha: "SLC", favorite: true },
  item_fries: { num: "18", alpha: "FF", favorite: false },
  item_garlic_bread: { num: "19", alpha: "GB", favorite: false },
  item_caesar: { num: "20", alpha: "CAE", favorite: false },
  item_chicken_wings: { num: "21", alpha: "CW", favorite: false },
  item_onion_rings: { num: "22", alpha: "OR", favorite: false },
  item_greek_salad: { num: "23", alpha: "GS", favorite: false },
  item_fish_chips: { num: "24", alpha: "FC", favorite: false },
  item_steak_frites: { num: "25", alpha: "SF", favorite: false },
  item_veg_wrap: { num: "26", alpha: "VW", favorite: false },
  item_chicken_salad: { num: "27", alpha: "CSA", favorite: false },
  item_tiramisu: { num: "28", alpha: "TIR", favorite: false },
  item_cheesecake: { num: "29", alpha: "CHC", favorite: false },
  item_brownie: { num: "30", alpha: "BRW", favorite: false },
  item_coca_cola: { num: "31", alpha: "COK", favorite: true },
  item_water: { num: "32", alpha: "WAT", favorite: true },
  item_minute_maid: { num: "33", alpha: "MM", favorite: true },
  item_espresso: { num: "34", alpha: "ESP", favorite: true },
  item_green_tea: { num: "35", alpha: "GT", favorite: true },
  item_milkshake_banana: { num: "36", alpha: "MSB", favorite: true },
  item_ice_tea: { num: "37", alpha: "IT", favorite: true },
  item_schweppes: { num: "38", alpha: "SCH", favorite: true },
  item_fanta: { num: "39", alpha: "FAN", favorite: true }
};

// server/dedupeTables.ts
function dedupeTableLabels() {
  const rows = all(
    "SELECT id, name, COALESCE(area, 'Ground Floor') AS area FROM tables WHERE cafe_id = ?",
    [CAFE_ID]
  );
  const keep = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = `${row.area}::${tableLabel(row.name)}`;
    const canonical = /^T\d+$/i.test(row.name.trim());
    const prev = keep.get(key);
    if (!prev) {
      keep.set(key, row.id);
      continue;
    }
    const prevRow = rows.find((entry) => entry.id === prev);
    const prevCanonical = prevRow ? /^T\d+$/i.test(prevRow.name.trim()) : false;
    if (canonical && !prevCanonical) keep.set(key, row.id);
  }
  for (const row of rows) {
    const key = `${row.area}::${tableLabel(row.name)}`;
    if (keep.get(key) === row.id) continue;
    const target = keep.get(key);
    if (!target) continue;
    const targetName = rows.find((entry) => entry.id === target)?.name ?? row.name;
    run("UPDATE orders SET table_id = ?, table_name = ? WHERE table_id = ?", [target, targetName, row.id]);
    run("UPDATE reservations SET table_id = ? WHERE table_id = ?", [target, row.id]);
    run("DELETE FROM tables WHERE id = ?", [row.id]);
  }
}

// server/purgeCustomers.ts
var BLOCKED_NAME = /nigga/i;
function purgeBlockedCustomers() {
  const rows = all(
    "SELECT id, name FROM customers WHERE cafe_id = ?",
    [CAFE_ID]
  );
  for (const row of rows) {
    if (!BLOCKED_NAME.test(row.name)) continue;
    run("UPDATE orders SET customer_id = NULL WHERE customer_id = ?", [row.id]);
    run("DELETE FROM customers WHERE id = ?", [row.id]);
  }
}

// server/seed-inventory.ts
var STOCK = [
  { id: "inv_coffee_beans", name: "Arabica Coffee Beans", sku: "RM-COF-01", category: "Raw material", unit: "kg", qty: 8.5, reorder: 2, cost: 850, supplier: "Blue Tokai" },
  { id: "inv_milk", name: "Full Cream Milk", sku: "RM-MLK-01", category: "Raw material", unit: "l", qty: 22, reorder: 8, cost: 62, supplier: "Local dairy" },
  { id: "inv_oat_milk", name: "Oat Milk", sku: "RM-OAT-01", category: "Raw material", unit: "l", qty: 6, reorder: 3, cost: 180, supplier: "Oatly" },
  { id: "inv_sugar", name: "Caster Sugar", sku: "RM-SUG-01", category: "Raw material", unit: "kg", qty: 4, reorder: 1, cost: 55, supplier: "Metro" },
  { id: "inv_cups_8oz", name: "8oz Paper Cups", sku: "PK-CUP-8", category: "Packaging", unit: "pcs", qty: 480, reorder: 120, cost: 4, supplier: "PackPro" },
  { id: "inv_lids", name: "Cup Lids", sku: "PK-LID-01", category: "Packaging", unit: "pcs", qty: 90, reorder: 100, cost: 2, supplier: "PackPro" },
  { id: "inv_napkins", name: "Napkins", sku: "PK-NAP-01", category: "Packaging", unit: "pcs", qty: 1200, reorder: 300, cost: 1, supplier: "PackPro" },
  { id: "inv_chocolate", name: "Drinking Chocolate", sku: "RM-CHO-01", category: "Raw material", unit: "kg", qty: 1.2, reorder: 0.5, cost: 420, supplier: "Metro" },
  { id: "inv_flour", name: "Flour", sku: "RM-WHT-01", category: "Raw material", unit: "kg", qty: 12, reorder: 3, cost: 48, supplier: "Metro" },
  { id: "inv_cheese", name: "Cheese", sku: "RM-CHS-01", category: "Raw material", unit: "kg", qty: 4, reorder: 1, cost: 520, supplier: "Local dairy" },
  { id: "inv_tomato", name: "Tomato", sku: "RM-TOM-01", category: "Raw material", unit: "kg", qty: 6, reorder: 2, cost: 40, supplier: "Market" },
  { id: "inv_butter", name: "Butter", sku: "RM-BTR-01", category: "Raw material", unit: "kg", qty: 2.5, reorder: 0.8, cost: 480, supplier: "Local dairy" },
  { id: "inv_egg", name: "Eggs", sku: "RM-EGG-01", category: "Raw material", unit: "pcs", qty: 90, reorder: 24, cost: 8, supplier: "Market" },
  { id: "inv_tea", name: "Tea Leaves", sku: "RM-TEA-01", category: "Raw material", unit: "kg", qty: 1.4, reorder: 0.4, cost: 360, supplier: "Metro" },
  { id: "inv_potato", name: "Potato", sku: "RM-POT-01", category: "Raw material", unit: "kg", qty: 15, reorder: 4, cost: 28, supplier: "Market" },
  { id: "inv_mint", name: "Mint", sku: "RM-MNT-01", category: "Raw material", unit: "kg", qty: 0.6, reorder: 0.2, cost: 180, supplier: "Market" },
  { id: "inv_chilli", name: "Chilli", sku: "RM-CHL-01", category: "Raw material", unit: "kg", qty: 1.1, reorder: 0.3, cost: 140, supplier: "Market" },
  { id: "inv_paneer", name: "Paneer", sku: "RM-PNR-01", category: "Raw material", unit: "kg", qty: 3, reorder: 1, cost: 380, supplier: "Local dairy" },
  { id: "inv_soy", name: "Soy Milk", sku: "RM-SOY-01", category: "Raw material", unit: "l", qty: 4, reorder: 1.5, cost: 120, supplier: "Oatly" }
];
var RECIPES = [
  {
    menuItemId: "item_espresso",
    lines: [{ inv: "inv_coffee_beans", qty: 0.018 }, { inv: "inv_cups_8oz", qty: 1 }]
  },
  {
    menuItemId: "item_cappuccino",
    lines: [
      { inv: "inv_coffee_beans", qty: 0.018 },
      { inv: "inv_milk", qty: 0.12 },
      { inv: "inv_cups_8oz", qty: 1 },
      { inv: "inv_lids", qty: 1 }
    ]
  },
  {
    menuItemId: "item_iced_americano",
    lines: [{ inv: "inv_coffee_beans", qty: 0.02 }, { inv: "inv_cups_8oz", qty: 1 }, { inv: "inv_lids", qty: 1 }]
  },
  {
    menuItemId: "item_mocha",
    lines: [
      { inv: "inv_coffee_beans", qty: 0.018 },
      { inv: "inv_milk", qty: 0.1 },
      { inv: "inv_chocolate", qty: 0.015 },
      { inv: "inv_cups_8oz", qty: 1 },
      { inv: "inv_lids", qty: 1 }
    ]
  },
  {
    menuItemId: "item_latte",
    lines: [{ inv: "inv_coffee_beans", qty: 0.018 }, { inv: "inv_milk", qty: 0.18 }, { inv: "inv_cups_8oz", qty: 1 }]
  }
];
function ensureInventorySeed() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      [row.id, CAFE_ID, row.name, row.sku, row.category, row.unit, row.qty, row.reorder, row.cost, row.supplier, now]
    );
  }
  for (const recipe of RECIPES) {
    const menu = get("SELECT id FROM menu_items WHERE id = ?", [recipe.menuItemId]);
    if (!menu) continue;
    for (const line of recipe.lines) {
      run(
        `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
         ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_per_portion = excluded.qty_per_portion`,
        [recipe.menuItemId, line.inv, line.qty]
      );
    }
  }
  const customDrinks = all(
    "SELECT id FROM menu_items WHERE cafe_id = ? AND category_id = ?",
    [CAFE_ID, "cat_drinks"]
  );
  for (const drink2 of customDrinks) {
    if (RECIPES.some((entry) => entry.menuItemId === drink2.id)) continue;
    for (const line of [
      { inv: "inv_coffee_beans", qty: 0.018 },
      { inv: "inv_milk", qty: 0.1 },
      { inv: "inv_cups_8oz", qty: 1 }
    ]) {
      run(
        `INSERT INTO menu_recipes (menu_item_id, inventory_item_id, qty_per_portion) VALUES (?, ?, ?)
         ON CONFLICT(menu_item_id, inventory_item_id) DO UPDATE SET qty_per_portion = excluded.qty_per_portion`,
        [drink2.id, line.inv, line.qty]
      );
    }
  }
}

// server/seed.ts
function ensureMenuDisplayMeta() {
  for (const [itemId, display] of Object.entries(LEGACY_MENU_DISPLAY)) {
    const row = get(
      "SELECT menu_lead, kcal_label, ingredients_json FROM menu_items WHERE id = ?",
      [itemId]
    );
    if (!row) continue;
    if (row.menu_lead?.trim() || row.kcal_label?.trim() || row.ingredients_json && row.ingredients_json !== "[]") continue;
    run(
      "UPDATE menu_items SET menu_lead = ?, menu_subtitle = ?, kcal_label = ?, ingredients_json = ? WHERE id = ?",
      [display.lead, display.titled, display.kcal, serializeIngredients(display.ingredients), itemId]
    );
  }
}
function ensureBasicIngredients() {
  const rows = all(
    "SELECT id, name, category_id, ingredients_json FROM menu_items WHERE cafe_id = ?",
    [CAFE_ID]
  );
  for (const row of rows) {
    const current2 = parseIngredientList(row.ingredients_json);
    const next = basicIngredientsFor(row.id, row.name, row.category_id);
    const stampedCoffee = current2.length === 1 && current2[0] === "coffee" && !next.includes("coffee");
    if (!current2.length || stampedCoffee) {
      run("UPDATE menu_items SET ingredients_json = ? WHERE id = ?", [serializeIngredients(next), row.id]);
    }
  }
  const fresh = all(
    "SELECT id, category_id, ingredients_json FROM menu_items WHERE cafe_id = ?",
    [CAFE_ID]
  );
  for (const row of fresh) {
    syncRecipesFromIngredients(row.id, parseIngredientList(row.ingredients_json), row.category_id);
  }
}
function ensureDrinkAddonGroups() {
  const drinks = all(
    "SELECT id FROM menu_items WHERE cafe_id = ? AND category_id = ?",
    [CAFE_ID, DRINKS_CATEGORY_ID]
  );
  for (const drink2 of drinks) {
    const linked = get(
      "SELECT COUNT(*) AS n FROM menu_item_addon_groups WHERE menu_item_id = ?",
      [drink2.id]
    );
    if ((linked?.n ?? 0) > 0) continue;
    for (const groupId of DRINK_ADDON_GROUP_IDS) {
      run("INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)", [drink2.id, groupId]);
    }
  }
}
function upsertAddonGroup(id, name, minSelect, maxSelect, sortOrder) {
  run(
    `INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       min_select = excluded.min_select,
       max_select = excluded.max_select,
       sort_order = excluded.sort_order`,
    [id, CAFE_ID, name, minSelect, maxSelect, sortOrder]
  );
}
function upsertAddon(id, groupId, name, price, sortOrder) {
  run(
    `INSERT INTO addons (id, group_id, name, price, is_available, sort_order)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       group_id = excluded.group_id,
       name = excluded.name,
       price = excluded.price,
       is_available = 1,
       sort_order = excluded.sort_order`,
    [id, groupId, name, price, sortOrder]
  );
}
function ensurePosCustomizeGroups() {
  upsertAddonGroup("group_sides", "Sides", 0, 1, 10);
  upsertAddon("addon_belgian_fries", "group_sides", "Belgian fresh homemade fries", 0, 1);
  upsertAddon("addon_sweet_potato_fries", "group_sides", "Sweet potato fries", 0, 2);
  upsertAddon("addon_smashed_sweet", "group_sides", "Smashed sweet potatoes", 0, 3);
  upsertAddon("addon_thyme_potatoes", "group_sides", "Potatoes with thyme", 0, 4);
  upsertAddon("addon_grilled_veg", "group_sides", "Grilled vegetables", 0, 5);
  upsertAddonGroup("group_combo_burgers", "Burgers", 1, 1, 20);
  upsertAddon("addon_combo_cheese", "group_combo_burgers", "Cheese Burger", 0, 1);
  upsertAddon("addon_combo_bacon", "group_combo_burgers", "Bacon Burger", 0, 2);
  upsertAddonGroup("group_combo_drinks", "Drinks", 1, 1, 21);
  upsertAddon("addon_combo_coke", "group_combo_drinks", "Coca-Cola", 0, 1);
  upsertAddon("addon_combo_water", "group_combo_drinks", "Spa", 0, 2);
  upsertAddon("addon_combo_minute", "group_combo_drinks", "Minute Maid", 0, 3);
  upsertAddon("addon_combo_milkshake", "group_combo_drinks", "Milkshake", 40, 4);
  const sideItems = [
    "item_bacon_burger",
    "item_cheese_burger",
    "item_club_sandwich",
    "item_chicken_curry_sandwich",
    "item_spicy_tuna_sandwich",
    "item_mozzarella_sandwich"
  ];
  for (const itemId of sideItems) linkAddonGroup(itemId, "group_sides");
  for (const itemId of ["item_burger_combo", "item_sushi_combo"]) {
    linkAddonGroup(itemId, "group_combo_burgers");
    linkAddonGroup(itemId, "group_combo_drinks");
  }
}
function linkAddonGroup(itemId, groupId) {
  const item = get("SELECT id FROM menu_items WHERE id = ?", [itemId]);
  if (!item) return;
  run("INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)", [itemId, groupId]);
}
function ensureDemoScenarios() {
  const table = get("SELECT id FROM tables WHERE cafe_id = ? AND qr_code = ?", [CAFE_ID, "T10"]);
  if (table) {
    setTableStage(table.id, "blank");
    const reserved = get("SELECT COUNT(*) AS n FROM reservations WHERE table_id = ? AND status = ?", [table.id, "HELD"]);
    if (!(reserved?.n ?? 0)) {
      createReservation({
        tableId: table.id,
        customerName: "Neha Kapoor",
        customerMobile: "9876500199",
        covers: 4
      });
    }
  }
  const hasDelivery = get(
    `SELECT id FROM orders WHERE cafe_id = ? AND notes LIKE '%MODE:DELIVERY%' AND status NOT IN ('CANCELLED','DRAFT') LIMIT 1`,
    [CAFE_ID]
  );
  if (!hasDelivery) {
    createStaffOrder({
      customerName: "Delivery \xB7 Rahul",
      customerMobile: "9876500888",
      items: [{ menuItemId: "item_pasta_bolo", quantity: 1, addonIds: [] }],
      notes: "MODE:DELIVERY\nADDR:12 Beach Road, Calangute"
    });
  }
}
function syncSizes() {
  run(
    `INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES ('addon_grande', 'group_size', 'Grande', 20, 1, 1)
     ON CONFLICT(id) DO UPDATE SET name = 'Grande', price = 20, is_available = 1, sort_order = 1, group_id = 'group_size'`
  );
  run(
    `INSERT INTO addons (id, group_id, name, price, is_available, sort_order) VALUES ('addon_tall', 'group_size', 'Tall', 40, 1, 2)
     ON CONFLICT(id) DO UPDATE SET name = 'Tall', price = 40, is_available = 1, sort_order = 2, group_id = 'group_size'`
  );
  run(`UPDATE addons SET is_available = 0 WHERE group_id = 'group_size' AND id NOT IN ('addon_grande', 'addon_tall')`);
}
function syncMenu(now) {
  for (const [id, name, sort] of CATEGORIES) {
    run(
      `INSERT INTO menu_categories (id, cafe_id, name, sort_order) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order`,
      [id, CAFE_ID, name, sort]
    );
  }
  MENU.forEach((dish, index) => {
    const pos = ITEM_POS[dish.id] ?? { num: String(index + 1), alpha: dish.name.replace(/[^A-Za-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map((word) => word[0]).join("").toUpperCase(), favorite: false };
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
      [dish.id, CAFE_ID, dish.categoryId, dish.name, dish.description, dish.price, dish.image, pos.favorite ? 1 : 0, pos.num, pos.alpha, index + 1, now]
    );
    run("DELETE FROM menu_item_addon_groups WHERE menu_item_id = ?", [dish.id]);
    if (dish.coffee) {
      for (const groupId of ["group_size", "group_milk", "group_extras"]) {
        run("INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)", [dish.id, groupId]);
      }
    }
  });
  ensurePosCustomizeGroups();
  const ids = MENU.map((dish) => dish.id);
  run(
    `UPDATE menu_items SET is_available = 0 WHERE cafe_id = ? AND id NOT IN (${ids.map(() => "?").join(",")})`,
    [CAFE_ID, ...ids]
  );
}
function ensureTables(now) {
  const floor = [];
  for (let index = 1; index <= 10; index += 1) {
    const name = `T${String(index).padStart(2, "0")}`;
    floor.push({ name, qr: name, area: "Ground Floor" });
  }
  for (let index = 11; index <= 20; index += 1) {
    const name = `T${String(index).padStart(2, "0")}`;
    floor.push({ name, qr: name, area: "Basement" });
  }
  floor.push({ name: "Hall 1", qr: "HALL1", area: "Party Hall" });
  floor.push({ name: "Hall 2", qr: "HALL2", area: "Party Hall" });
  for (let index = 21; index <= 24; index += 1) {
    const name = `T${String(index).padStart(2, "0")}`;
    floor.push({ name, qr: name, area: "Terrace" });
  }
  for (let index = 25; index <= 28; index += 1) {
    const name = `T${String(index).padStart(2, "0")}`;
    floor.push({ name, qr: name, area: "Rooftop" });
  }
  for (let index = 29; index <= 32; index += 1) {
    const name = `T${String(index).padStart(2, "0")}`;
    floor.push({ name, qr: name, area: "Lounge" });
  }
  for (const table of floor) {
    run(
      `INSERT OR IGNORE INTO tables (id, cafe_id, name, qr_code, status, area, updated_at)
       VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
      [`table_${table.qr.toLowerCase()}`, CAFE_ID, table.name, table.qr, table.area, now]
    );
    run("UPDATE tables SET area = ? WHERE cafe_id = ? AND qr_code = ?", [table.area, CAFE_ID, table.qr]);
  }
  dedupeTableLabels();
}
async function seed() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (get("SELECT id FROM cafes WHERE id = ?", [CAFE_ID])) {
    run(`UPDATE cafes SET name = 'After Dunes' WHERE id = ? AND name = 'Habsos'`, [CAFE_ID]);
    syncSizes();
    syncMenu(now);
    ensureTables(now);
    ensureDrinkAddonGroups();
    ensureMenuDisplayMeta();
    ensureDemoScenarios();
    ensureInventorySeed();
    ensureBasicIngredients();
    purgeBlockedCustomers();
    return;
  }
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
  run("INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 1)", ["group_size", CAFE_ID, "Size"]);
  run("INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 1, 2)", ["group_milk", CAFE_ID, "Milk"]);
  run("INSERT INTO addon_groups (id, cafe_id, name, min_select, max_select, sort_order) VALUES (?, ?, ?, 0, 3, 3)", ["group_extras", CAFE_ID, "Extras"]);
  syncSizes();
  insertAddon("addon_oat", "group_milk", "Oat Milk", 30, 1);
  insertAddon("addon_almond", "group_milk", "Almond Milk", 40, 2);
  insertAddon("addon_extra_shot", "group_extras", "Extra Shot", 50, 1);
  insertAddon("addon_caramel", "group_extras", "Caramel Syrup", 30, 2);
  insertAddon("addon_cream", "group_extras", "Whipped Cream", 30, 3);
  syncMenu(now);
  ensureTables(now);
  const ago = (minutes) => new Date(Date.now() - minutes * 60 * 1e3).toISOString();
  const completed = createStaffOrder({
    tableCode: "T01",
    customerName: "Meera",
    customerMobile: "9876500101",
    items: [
      { menuItemId: "item_espresso", quantity: 2, addonIds: [] },
      { menuItemId: "item_club_sandwich", quantity: 1, addonIds: [] }
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
      { menuItemId: "item_green_tea", quantity: 1, addonIds: [] },
      { menuItemId: "item_cheese_burger", quantity: 1, addonIds: [] }
    ]
  });
  transitionOrder(ready.id, "READY");
  retimeOrder(ready.id, ago(35));
  const preparing = createStaffOrder({
    tableCode: "T03",
    customerName: "Priya",
    customerMobile: "9876500103",
    items: [
      { menuItemId: "item_milkshake_banana", quantity: 1, addonIds: [] },
      { menuItemId: "item_pasta_bolo", quantity: 1, addonIds: [] }
    ]
  });
  retimeOrder(preparing.id, ago(18));
  const fresh = createStaffOrder({
    tableCode: "T05",
    customerName: "Arjun",
    customerMobile: "9876500104",
    items: [
      { menuItemId: "item_espresso", quantity: 1, addonIds: [] },
      { menuItemId: "item_bacon_burger", quantity: 1, addonIds: [] }
    ]
  });
  retimeOrder(fresh.id, ago(6));
  ensureDrinkAddonGroups();
  ensureMenuDisplayMeta();
  ensureDemoScenarios();
  ensureInventorySeed();
  ensureBasicIngredients();
  purgeBlockedCustomers();
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
    try {
      await pushDatabase(dest);
    } catch (error) {
      console.error("Initial database push failed \u2014 continuing with local SQLite.", error);
    }
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
