import { all, run } from './db';
import { CAFE_ID } from './ids';

const BLOCKED_NAME = /nigga/i;

export function purgeBlockedCustomers() {
  const rows = all<{ id: string; name: string }>(
    'SELECT id, name FROM customers WHERE cafe_id = ?',
    [CAFE_ID],
  );
  for (const row of rows) {
    if (!BLOCKED_NAME.test(row.name)) continue;
    run('UPDATE orders SET customer_id = NULL WHERE customer_id = ?', [row.id]);
    run('DELETE FROM customers WHERE id = ?', [row.id]);
  }
}
