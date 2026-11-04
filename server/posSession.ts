import { randomUUID } from 'node:crypto';
import {
  OPEN_STATUSES,
  type FloorPlan,
  type PosCashMove,
  type PosConfig,
  type PosSession,
  type PosSessionStats,
  type TableGeometry,
} from '../shared/domain';
import { AppError } from './appError';
import { all, get, run, tx } from './db';
import { CAFE_ID } from './ids';

const DEFAULT_CONFIG_ID = 'pos_config_restaurant';

function mapSession(row: {
  id: string;
  config_id: string;
  config_name: string;
  sequence?: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  opening_cash: number;
  closing_cash: number | null;
  counted_cash: number | null;
  notes: string;
}): PosSession {
  return {
    id: row.id,
    configId: row.config_id,
    configName: row.config_name,
    sequence: Number(row.sequence) || 0,
    status: row.status as PosSession['status'],
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openedBy: row.opened_by,
    openingCash: row.opening_cash,
    closingCash: row.closing_cash,
    countedCash: row.counted_cash,
    notes: row.notes,
  };
}

function nextSequence(configId: string): number {
  const row = get<{ n: number }>(
    'SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM pos_sessions WHERE config_id = ?',
    [configId],
  );
  return row?.n ?? 1;
}

/** Backfill Odoo-style sequence numbers for older rows (chronological per register). */
function ensureSessionSequences() {
  const configs = all<{ config_id: string }>(
    `SELECT DISTINCT config_id FROM pos_sessions WHERE sequence IS NULL OR sequence = 0`,
  );
  for (const { config_id } of configs) {
    const rows = all<{ id: string }>(
      'SELECT id FROM pos_sessions WHERE config_id = ? ORDER BY opened_at ASC',
      [config_id],
    );
    rows.forEach((row, index) => {
      run('UPDATE pos_sessions SET sequence = ? WHERE id = ?', [index + 1, row.id]);
    });
  }
}

export function ensurePosDefaults() {
  const cafe = get<{ id: string }>('SELECT id FROM cafes WHERE id = ?', [CAFE_ID]);
  if (!cafe) return;

  if (!get('SELECT id FROM pos_configs WHERE id = ?', [DEFAULT_CONFIG_ID])) {
    run('INSERT INTO pos_configs (id, cafe_id, name, is_restaurant) VALUES (?, ?, ?, 1)', [
      DEFAULT_CONFIG_ID,
      CAFE_ID,
      'Restaurant',
    ]);
  }
  // Extra register configs are created on demand via New Register — do not auto-seed a second card.

  const defaultFloors: Array<{ id: string; name: string; sort: number }> = [
    { id: 'floor_main', name: 'Main Floor', sort: 0 },
    { id: 'floor_patio', name: 'Patio', sort: 1 },
    { id: 'floor_terrace', name: 'Terrace', sort: 2 },
    { id: 'floor_rooftop', name: 'Rooftop', sort: 3 },
    { id: 'floor_lounge', name: 'Lounge', sort: 4 },
  ];
  for (const floor of defaultFloors) {
    if (get('SELECT id FROM floors WHERE id = ?', [floor.id])) continue;
    if (get('SELECT id FROM floors WHERE cafe_id = ? AND name = ?', [CAFE_ID, floor.name])) continue;
    run('INSERT INTO floors (id, cafe_id, name, sort_order, background) VALUES (?, ?, ?, ?, ?)', [
      floor.id,
      CAFE_ID,
      floor.name,
      floor.sort,
      'white',
    ]);
  }

  const extraTables: Array<{ name: string; qr: string; area: string }> = [
    ...[21, 22, 23, 24].map((n) => ({ name: `T${String(n).padStart(2, '0')}`, qr: `T${String(n).padStart(2, '0')}`, area: 'Terrace' })),
    ...[25, 26, 27, 28].map((n) => ({ name: `T${String(n).padStart(2, '0')}`, qr: `T${String(n).padStart(2, '0')}`, area: 'Rooftop' })),
    ...[29, 30, 31, 32].map((n) => ({ name: `T${String(n).padStart(2, '0')}`, qr: `T${String(n).padStart(2, '0')}`, area: 'Lounge' })),
  ];
  const nowIso = new Date().toISOString();
  for (const table of extraTables) {
    run(
      `INSERT OR IGNORE INTO tables (id, cafe_id, name, qr_code, status, area, updated_at)
       VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
      [`table_${table.qr.toLowerCase()}`, CAFE_ID, table.name, table.qr, table.area, nowIso],
    );
  }

  const tables = all<{ id: string; name: string; area: string }>(
    'SELECT id, name, COALESCE(area, \'Ground Floor\') AS area FROM tables WHERE cafe_id = ? ORDER BY name',
    [CAFE_ID],
  );
  const floorIdByName = (name: string, fallback: string) =>
    get<{ id: string }>('SELECT id FROM floors WHERE cafe_id = ? AND name = ?', [CAFE_ID, name])?.id ?? fallback;

  const floorForArea = (area: string) => {
    if (/terrace/i.test(area)) return floorIdByName('Terrace', 'floor_terrace');
    if (/rooftop/i.test(area)) return floorIdByName('Rooftop', 'floor_rooftop');
    if (/lounge/i.test(area)) return floorIdByName('Lounge', 'floor_lounge');
    if (/patio|basement|party/i.test(area)) return floorIdByName('Patio', 'floor_patio');
    return floorIdByName('Main Floor', 'floor_main');
  };

  const counters = new Map<string, number>();
  for (const table of tables) {
    if (get('SELECT table_id FROM table_geometry WHERE table_id = ?', [table.id])) continue;
    const floorId = floorForArea(table.area);
    const index = counters.get(floorId) ?? 0;
    counters.set(floorId, index + 1);
    const col = index % 4;
    const row = Math.floor(index / 4);
    const wide = Number.parseInt(table.name.replace(/\D/g, ''), 10) % 3 === 0;
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
        wide ? 'rect' : 'square',
        index < 6 ? '#111111' : index < 10 ? '#666666' : '#999999',
      ],
    );
  }
}

export function getPosConfig(configId?: string): PosConfig {
  ensurePosDefaults();
  const row = configId
    ? get<{ id: string; name: string; is_restaurant: number }>(
        'SELECT id, name, is_restaurant FROM pos_configs WHERE cafe_id = ? AND id = ?',
        [CAFE_ID, configId],
      )
    : get<{ id: string; name: string; is_restaurant: number }>(
        'SELECT id, name, is_restaurant FROM pos_configs WHERE cafe_id = ? ORDER BY id LIMIT 1',
        [CAFE_ID],
      );
  if (!row) throw new AppError(500, 'POS', 'POS config missing.');
  return { id: row.id, name: row.name, isRestaurant: !!row.is_restaurant };
}

export function listPosConfigs(): PosConfig[] {
  ensurePosDefaults();
  return all<{ id: string; name: string; is_restaurant: number }>(
    'SELECT id, name, is_restaurant FROM pos_configs WHERE cafe_id = ? ORDER BY id',
    [CAFE_ID],
  ).map((row) => ({ id: row.id, name: row.name, isRestaurant: !!row.is_restaurant }));
}

export function getOpenSession(configId?: string): PosSession | null {
  ensurePosDefaults();
  const row = configId
    ? get<{
        id: string;
        config_id: string;
        config_name: string;
        sequence: number;
        status: string;
        opened_at: string;
        closed_at: string | null;
        opened_by: string;
        opening_cash: number;
        closing_cash: number | null;
        counted_cash: number | null;
        notes: string;
      }>(
        `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
                s.opening_cash, s.closing_cash, s.counted_cash, s.notes
         FROM pos_sessions s
         JOIN pos_configs c ON c.id = s.config_id
         WHERE c.cafe_id = ? AND s.status = 'OPEN' AND s.config_id = ?
         ORDER BY s.opened_at DESC LIMIT 1`,
        [CAFE_ID, configId],
      )
    : get<{
        id: string;
        config_id: string;
        config_name: string;
        sequence: number;
        status: string;
        opened_at: string;
        closed_at: string | null;
        opened_by: string;
        opening_cash: number;
        closing_cash: number | null;
        counted_cash: number | null;
        notes: string;
      }>(
        `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
                s.opening_cash, s.closing_cash, s.counted_cash, s.notes
         FROM pos_sessions s
         JOIN pos_configs c ON c.id = s.config_id
         WHERE c.cafe_id = ? AND s.status = 'OPEN'
         ORDER BY s.opened_at DESC LIMIT 1`,
        [CAFE_ID],
      );
  return row ? mapSession(row) : null;
}

function salesSeriesForSession(sessionId: string): number[] {
  const rows = all<{ total: number; at: string }>(
    `SELECT total, COALESCE(updated_at, created_at) AS at
     FROM orders
     WHERE session_id = ? AND payment_status = 'PAID' AND status != 'CANCELLED'
     ORDER BY COALESCE(updated_at, created_at) ASC`,
    [sessionId],
  );
  if (!rows.length) return [0];

  const session = get<{ opened_at: string }>('SELECT opened_at FROM pos_sessions WHERE id = ?', [sessionId]);
  const openedAt = session ? Date.parse(session.opened_at) : Date.parse(rows[0].at);
  const now = Date.now();
  const span = Math.max(now - openedAt, 60_000);
  const buckets = 12;
  const series = Array.from({ length: buckets }, () => 0);
  let running = 0;
  let rowIdx = 0;

  for (let i = 0; i < buckets; i += 1) {
    const edge = openedAt + ((i + 1) / buckets) * span;
    while (rowIdx < rows.length && Date.parse(rows[rowIdx].at) <= edge) {
      running += rows[rowIdx].total;
      rowIdx += 1;
    }
    series[i] = running;
  }

  // Ensure final bucket reflects all paid sales even if clocks skew slightly.
  while (rowIdx < rows.length) {
    running += rows[rowIdx].total;
    rowIdx += 1;
  }
  series[buckets - 1] = running;
  return series;
}

export function sessionStats(sessionId: string | null): PosSessionStats {
  const session = sessionId
    ? get<{ opening_cash: number }>('SELECT opening_cash FROM pos_sessions WHERE id = ?', [sessionId])
    : null;
  const openingCash = session?.opening_cash ?? 0;
  if (!sessionId) {
    return {
      openingCash: 0,
      soldTotal: 0,
      soldOrders: 0,
      ongoingTotal: 0,
      ongoingOrders: 0,
      salesSeries: [],
    };
  }

  const sold = get<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM orders WHERE session_id = ? AND payment_status = 'PAID' AND status != 'CANCELLED'`,
    [sessionId],
  );
  const placeholders = OPEN_STATUSES.map(() => '?').join(',');
  const ongoing = get<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
     FROM orders WHERE session_id = ? AND payment_status != 'PAID' AND status IN (${placeholders})`,
    [sessionId, ...OPEN_STATUSES],
  );

  return {
    openingCash,
    soldTotal: sold?.total ?? 0,
    soldOrders: sold?.count ?? 0,
    ongoingTotal: ongoing?.total ?? 0,
    ongoingOrders: ongoing?.count ?? 0,
    salesSeries: salesSeriesForSession(sessionId),
  };
}

export type PosDashboardCard = {
  config: PosConfig;
  session: PosSession | null;
  stats: PosSessionStats;
};

export function posDashboard() {
  const configs = listPosConfigs();
  const cards: PosDashboardCard[] = configs.map((config) => {
    const session = getOpenSession(config.id);
    return { config, session, stats: sessionStats(session?.id ?? null) };
  });
  const primary = cards[0] ?? null;
  return {
    config: primary?.config ?? getPosConfig(),
    session: primary?.session ?? null,
    stats: primary?.stats ?? sessionStats(null),
    cards,
  };
}

export function openSession(input: { openingCash: number; userName: string; configId?: string }): PosSession {
  ensurePosDefaults();
  const config = getPosConfig(input.configId);
  const existing = getOpenSession(config.id);
  if (existing) return existing;

  const openingCash = Math.max(0, Number(input.openingCash) || 0);
  const id = `ps_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const sequence = nextSequence(config.id);
  run(
    `INSERT INTO pos_sessions (id, config_id, status, opened_at, closed_at, opened_by, opening_cash, closing_cash, counted_cash, notes, sequence)
     VALUES (?, ?, 'OPEN', ?, NULL, ?, ?, NULL, NULL, '', ?)`,
    [id, config.id, now, input.userName.slice(0, 80) || 'Staff', openingCash, sequence],
  );
  const session = getOpenSession(config.id);
  if (!session) throw new AppError(500, 'POS', 'Failed to open session.');
  return session;
}

export function closeSession(input: { countedCash: number; notes?: string }): PosSession {
  const open = getOpenSession();
  if (!open) throw new AppError(409, 'POS', 'No open register session.');

  const stats = sessionStats(open.id);
  const cashIn = all<{ amount: number }>(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'IN'`,
    [open.id],
  ).reduce((s, r) => s + r.amount, 0);
  const cashOut = all<{ amount: number }>(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'OUT'`,
    [open.id],
  ).reduce((s, r) => s + r.amount, 0);
  const paidCash = get<{ total: number }>(
    `SELECT COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.session_id = ? AND p.status = 'PAID' AND p.method = 'CASH'`,
    [open.id],
  )?.total ?? 0;
  const expectedCash = open.openingCash + paidCash + cashIn - cashOut;
  const countedCash = Math.max(0, Number(input.countedCash) || 0);
  const now = new Date().toISOString();
  const notes = (input.notes ?? '').trim();

  run(
    `UPDATE pos_sessions SET status = 'CLOSED', closed_at = ?, closing_cash = ?, counted_cash = ?, notes = ?
     WHERE id = ?`,
    [now, expectedCash, countedCash, notes, open.id],
  );

  const row = get<{
    id: string;
    config_id: string;
    config_name: string;
    sequence: number;
    status: string;
    opened_at: string;
    closed_at: string | null;
    opened_by: string;
    opening_cash: number;
    closing_cash: number | null;
    counted_cash: number | null;
    notes: string;
  }>(
    `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
            s.opening_cash, s.closing_cash, s.counted_cash, s.notes
     FROM pos_sessions s JOIN pos_configs c ON c.id = s.config_id WHERE s.id = ?`,
    [open.id],
  );
  if (!row) throw new AppError(500, 'POS', 'Failed to close session.');
  void stats;
  return mapSession(row);
}

export function listSessions(limit = 200): PosSession[] {
  ensurePosDefaults();
  ensureSessionSequences();
  const rows = all<{
    id: string;
    config_id: string;
    config_name: string;
    sequence: number;
    status: string;
    opened_at: string;
    closed_at: string | null;
    opened_by: string;
    opening_cash: number;
    closing_cash: number | null;
    counted_cash: number | null;
    notes: string;
  }>(
    `SELECT s.id, s.config_id, c.name AS config_name, s.sequence, s.status, s.opened_at, s.closed_at, s.opened_by,
            s.opening_cash, s.closing_cash, s.counted_cash, s.notes
     FROM pos_sessions s
     JOIN pos_configs c ON c.id = s.config_id
     WHERE c.cafe_id = ?
     ORDER BY s.opened_at DESC LIMIT ?`,
    [CAFE_ID, limit],
  );
  return rows.map(mapSession);
}

export function cashMove(input: {
  kind: 'IN' | 'OUT';
  amount: number;
  reason: string;
  actor: string;
}): PosCashMove {
  const open = getOpenSession();
  if (!open) throw new AppError(409, 'POS', 'Open the register first.');
  const amount = Math.max(0, Number(input.amount) || 0);
  if (amount <= 0) throw new AppError(400, 'AMOUNT', 'Enter an amount.');
  const id = `cm_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  run(
    `INSERT INTO pos_cash_moves (id, session_id, kind, amount, reason, created_at, actor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, open.id, input.kind, amount, input.reason.trim().slice(0, 240), now, input.actor.slice(0, 80)],
  );
  return {
    id,
    sessionId: open.id,
    kind: input.kind,
    amount,
    reason: input.reason.trim(),
    createdAt: now,
    actor: input.actor,
  };
}

export function listFloors(): { floors: FloorPlan[]; geometry: TableGeometry[] } {
  ensurePosDefaults();
  const floors = all<{ id: string; name: string; sort_order: number; background: string }>(
    'SELECT id, name, sort_order, background FROM floors WHERE cafe_id = ? ORDER BY sort_order, name',
    [CAFE_ID],
  ).map((f) => ({ id: f.id, name: f.name, sortOrder: f.sort_order, background: f.background }));

  const geometry = all<{
    table_id: string;
    floor_id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    seats: number;
    shape: string;
    color: string;
  }>(
    `SELECT g.table_id, g.floor_id, g.x, g.y, g.w, g.h, g.seats, g.shape, g.color
     FROM table_geometry g
     JOIN tables t ON t.id = g.table_id
     WHERE t.cafe_id = ?`,
    [CAFE_ID],
  ).map((g) => ({
    tableId: g.table_id,
    floorId: g.floor_id,
    x: g.x,
    y: g.y,
    w: g.w,
    h: g.h,
    seats: g.seats,
    shape: g.shape as TableGeometry['shape'],
    color: g.color,
  }));

  return { floors, geometry };
}

export function saveFloors(payload: {
  floors: FloorPlan[];
  geometry: TableGeometry[];
}) {
  ensurePosDefaults();
  tx(() => {
    for (const floor of payload.floors) {
      const existing = get('SELECT id FROM floors WHERE id = ? AND cafe_id = ?', [floor.id, CAFE_ID]);
      if (existing) {
        run('UPDATE floors SET name = ?, sort_order = ?, background = ? WHERE id = ?', [
          floor.name,
          floor.sortOrder,
          floor.background,
          floor.id,
        ]);
      } else {
        run('INSERT INTO floors (id, cafe_id, name, sort_order, background) VALUES (?, ?, ?, ?, ?)', [
          floor.id,
          CAFE_ID,
          floor.name,
          floor.sortOrder,
          floor.background,
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
        [g.tableId, g.floorId, g.x, g.y, g.w, g.h, g.seats, g.shape, g.color],
      );
    }
  });
  return listFloors();
}

export function closingPreview() {
  const open = getOpenSession();
  if (!open) throw new AppError(409, 'POS', 'No open register session.');
  const stats = sessionStats(open.id);
  const byMethod = all<{ method: string; total: number }>(
    `SELECT p.method AS method, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.session_id = ? AND p.status = 'PAID'
     GROUP BY p.method`,
    [open.id],
  );
  const cashIn = all<{ amount: number }>(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'IN'`,
    [open.id],
  ).reduce((s, r) => s + r.amount, 0);
  const cashOut = all<{ amount: number }>(
    `SELECT amount FROM pos_cash_moves WHERE session_id = ? AND kind = 'OUT'`,
    [open.id],
  ).reduce((s, r) => s + r.amount, 0);
  const cashPaid = byMethod.find((m) => m.method === 'CASH')?.total ?? 0;
  const expectedCash = open.openingCash + cashPaid + cashIn - cashOut;
  return {
    session: open,
    stats,
    byMethod,
    cashIn,
    cashOut,
    expectedCash,
    durationMs: Date.now() - new Date(open.openedAt).getTime(),
  };
}
