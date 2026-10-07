import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR, formatWhen, maskMobile, registerPath, type CustomerSummary, type Order } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { usePos } from './PosContext';

export function CustomersPage() {
  useTitle('Customers');
  const pos = usePos();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [loyaltyOnly, setLoyaltyOnly] = useState(false);
  const [add, setAdd] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ customer: CustomerSummary; orders: Order[] } | null>(null);

  const customers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pos.customers
      .filter((customer) => {
        if (loyaltyOnly && customer.orderCount < 2) return false;
        if (!needle) return true;
        return customer.name.toLowerCase().includes(needle) || customer.mobile.endsWith(needle) || customer.mobile.includes(needle);
      })
      .sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''));
  }, [loyaltyOnly, pos.customers, query]);

  async function saveCustomer() {
    setBusy(true);
    try {
      await pos.createCustomer({ name, mobile });
      setName('');
      setMobile('');
      setAdd(false);
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(customer: CustomerSummary) {
    const local = pos.orders.filter((order) => (
      (customer.mobile && order.customerMobile.replace(/\D/g, '').endsWith(customer.mobile.slice(-10)))
      || order.customerName === customer.name
    )).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setHistory({ customer, orders: local });
    if (pos.conn === 'OFFLINE') return;
    try {
      const result = await api<{ orders: Order[] }>(`/api/customers/${customer.id}/orders`);
      setHistory({ customer, orders: result.orders });
    } catch {
      /* keep local */
    }
  }

  return (
    <section className="pos-page">
      <header className="page-head">
        <h1>Customers</h1>
        <p className="fine">{pos.customers.length} on file · {pos.customers.filter((row) => row.orderCount >= 2).length} loyalty</p>
      </header>

      <div className="rpt-tools">
        <label className="search">
          <span className="sr-only">Search customers</span>
          <input value={query} placeholder="Name or mobile" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="bill-modes" role="group" aria-label="Customer filter">
          <button type="button" className={loyaltyOnly ? '' : 'on'} onClick={() => setLoyaltyOnly(false)}>All</button>
          <button type="button" className={loyaltyOnly ? 'on' : ''} onClick={() => setLoyaltyOnly(true)}>Loyalty</button>
        </div>
        <Button variant="ghost" onClick={() => setAdd(true)}>Add customer</Button>
      </div>

      {customers.length === 0 ? (
        <EmptyState title="No customers" body={query || loyaltyOnly ? 'Nobody matches that filter.' : 'Save a mobile on an order, or add one here.'} />
      ) : (
        <div className="people-list">
          <p className="people-head" aria-hidden="true">
            <span>Name</span>
            <span>Mobile</span>
            <span>Visits</span>
            <span>Spent</span>
            <span>Last</span>
            <span />
          </p>
          {customers.map((customer) => (
            <article key={customer.id} className="people-row people-row-wide">
              <strong>{customer.name}{customer.orderCount >= 2 ? <small> Loyalty</small> : null}</strong>
              <span className="people-no">{shown === customer.id ? customer.mobile : maskMobile(customer.mobile)}</span>
              <span className="people-count">{customer.orderCount}</span>
              <span className="price">{formatINR(customer.spent)}</span>
              <time dateTime={customer.lastOrderAt ?? undefined}>
                {customer.lastOrderAt ? formatWhen(customer.lastOrderAt) : '—'}
              </time>
              <div className="run-acts">
                <button type="button" onClick={() => setShown((current) => (current === customer.id ? null : customer.id))}>
                  {shown === customer.id ? 'Hide' : 'Show'}
                </button>
                <button type="button" onClick={() => void openHistory(customer)}>Bills</button>
                <button
                  type="button"
                  onClick={() => navigate(registerPath({
                    mode: 'pickup',
                    customerName: customer.name,
                    customerMobile: customer.mobile,
                  }))}
                >
                  Order
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {add ? (
        <Modal open title="Add customer" onClose={() => setAdd(false)}>
          <div className="tv-form">
            <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <Input label="Mobile" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
            <Button disabled={busy || !name.trim() || !mobile.trim()} onClick={() => void saveCustomer()}>Save</Button>
          </div>
        </Modal>
      ) : null}

      {history ? (
        <Modal open title={history.customer.name} onClose={() => setHistory(null)}>
          <p className="fine">{history.customer.orderCount} visits · {formatINR(history.customer.spent)} · {shown === history.customer.id ? history.customer.mobile : maskMobile(history.customer.mobile)}</p>
          {history.orders.length === 0 ? (
            <p className="fine">No bills on file yet.</p>
          ) : (
            <div className="run-wrap">
              <table className="run-table rpt-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>When</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.orders.map((order) => (
                    <tr
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/pos/orders/${order.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') navigate(`/pos/orders/${order.id}`);
                      }}
                    >
                      <td>#{order.orderNumber || '—'}</td>
                      <td>{formatWhen(order.createdAt)}</td>
                      <td className="price">{formatINR(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      ) : null}
    </section>
  );
}
