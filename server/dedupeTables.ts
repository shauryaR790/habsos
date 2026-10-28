import { tableLabel } from '../shared/domain';
import { all, run } from './db';
import { CAFE_ID } from './ids';

/** One table per area + display label; prefer T01-style names over stray "1" / "No 1". */
export function dedupeTableLabels() {
  const rows = all<{ id: string; name: string; area: string }>(
    'SELECT id, name, COALESCE(area, \'Ground Floor\') AS area FROM tables WHERE cafe_id = ?',
    [CAFE_ID],
  );
  const keep = new Map<string, string>();
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
    run('UPDATE orders SET table_id = ?, table_name = ? WHERE table_id = ?', [target, targetName, row.id]);
    run('UPDATE reservations SET table_id = ? WHERE table_id = ?', [target, row.id]);
    run('DELETE FROM tables WHERE id = ?', [row.id]);
  }
}
