import { useMemo, useState } from 'react';
import { formatWhen, maskMobile } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { usePos } from './PosContext';

export function CustomersPage() {
  useTitle('Customers');
  const pos = usePos();
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const customers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pos.customers.filter((customer) => {
      if (!needle) return true;
      return customer.name.toLowerCase().includes(needle) || customer.mobile.endsWith(needle);
    });
  }, [pos.customers, query]);
  return (
    <section className="stack">
      <h1>Customers</h1>
      <label className="field">
        <span>Search name or last digits</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {customers.length === 0 ? <EmptyState title="No customers" /> : null}
      <div className="order-list">
        {customers.map((customer) => (
          <article key={customer.id} className="order-row">
            <strong>{customer.name}</strong>
            <span>{shown === customer.id ? customer.mobile : maskMobile(customer.mobile)}</span>
            <span>{customer.orderCount} orders</span>
            <span>{customer.lastOrderAt ? formatWhen(customer.lastOrderAt) : '—'}</span>
            <Button variant="ghost" onClick={() => setShown((current) => current === customer.id ? null : customer.id)}>
              {shown === customer.id ? 'Hide' : 'Show number'}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
