import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env';

function openDatabase(file: string) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 4000');
  if (file !== ':memory:' && !file.startsWith('/tmp')) database.exec('PRAGMA journal_mode = WAL');
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

function tableColumns(database: DatabaseSync, table: string) {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((col) => col.name);
}

function addColumn(database: DatabaseSync, table: string, name: string, definition: string) {
  if (!tableColumns(database, table).includes(name)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

function migrate(database: DatabaseSync) {
  addColumn(database, 'tables', 'area', "TEXT NOT NULL DEFAULT 'Ground Floor'");
  addColumn(database, 'menu_items', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(database, 'menu_items', 'shortcut_num', 'TEXT');
  addColumn(database, 'menu_items', 'shortcut_alpha', 'TEXT');
  addColumn(database, 'menu_items', 'menu_lead', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'menu_items', 'menu_subtitle', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'menu_items', 'kcal_label', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'menu_items', 'ingredients_json', "TEXT NOT NULL DEFAULT '[]'");
}

let current: DatabaseSync | null = null;

function live() {
  if (!current) current = openDatabase(env.dbPath);
  return current;
}

export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const database = live();
    const value = database[prop as keyof DatabaseSync];
    if (typeof value === 'function') return (value as (...args: unknown[]) => unknown).bind(database);
    return value;
  },
});

export function adoptIncoming() {
  const incoming = `${env.dbPath}.incoming`;
  if (!existsSync(incoming)) return;
  try {
    current?.close();
  } catch {
    /* already closed */
  }
  current = null;
  rmSync(env.dbPath, { force: true });
  rmSync(`${env.dbPath}-wal`, { force: true });
  rmSync(`${env.dbPath}-shm`, { force: true });
  renameSync(incoming, env.dbPath);
  current = openDatabase(env.dbPath);
}

type SqlValue = string | number | null | bigint;

export function all<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, params: SqlValue[] = []) {
  return db.prepare(sql).run(...params);
}

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* already closed */
    }
    throw error;
  }
}
