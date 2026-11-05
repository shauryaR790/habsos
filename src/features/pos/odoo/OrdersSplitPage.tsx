import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  canTransition,
  formatOdooINR,
  formatTime,
  OPEN_STATUSES,
  orderChannel,
  type Order,
  type OrderItem,
} from '../../../../shared/domain';
import { pushToast } from '../../../components/Toast';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';

type StatusFilter = 'active' | 'all' | 'paid' | 'cancelled';
type ChannelFilter = 'all' | 'dine' | 'takeout' | 'delivery';

const PAGE_SIZE = 12;

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CartEmptyIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 5h2l2.2 10.2a2 2 0 001.96 1.6H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" />
      <circle cx="16.5" cy="20" r="1.3" fill="currentColor" />
      <path d="M7 7h13l-1.4 7H8.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function channelLabel(order: Order) {
  const channel = orderChannel(order);
  if (channel === 'delivery') return 'Delivery';
  if (channel === 'pickup') return 'Takeout';
  return 'Dine In';
}

function channelBadgeClass(order: Order) {
  const channel = orderChannel(order);
  if (channel === 'delivery') return 'o-badge o-badge--pink';
  if (channel === 'pickup') return 'o-badge o-badge--yellow';
  return 'o-badge o-badge--blue';
}

function orderRef(order: Order) {
  const n = String(order.orderNumber).padStart(6, '0');
  return `261-1-${n}`;
}

function displayTitle(order: Order) {
  if (order.tableName) return `T ${order.tableName} - ${order.orderNumber}`;
  return String(order.orderNumber);
}

function orderWhenParts(iso: string, timeZone = 'Asia/Kolkata') {
  const date = new Date(iso);
  const sameDay =
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    === new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = sameDay
    ? 'Today'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone });
  const time = formatTime(iso, timeZone).toLowerCase().replace(/\s+/g, '');
  return { day, time };
}

function BagMark() {
  return (
    <span className="o-order-row__bag" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M6 8h12l-1 12H7L6 8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 8V7a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function itemExtras(item: OrderItem) {
  const fromNotes = item.notes
    ? item.notes.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  const fromAddons = item.addons.map((addon) => addon.nameSnapshot);
  // Prefer notes for combo packs; otherwise show addons as modifiers.
  if (fromNotes.length) return fromNotes.map((line) => line.replace(/^- /, ''));
  return fromAddons;
}

function isComboItem(item: OrderItem) {
  return /combo/i.test(item.nameSnapshot) || item.notes.split('\n').filter(Boolean).length > 1;
}

export function OrdersSplitPage() {
  useTitle('Orders');
  const navigate = useNavigate();
  const { orders, setStatus } = usePos();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [statusOpen, setStatusOpen] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function cancelOrder(order: Order) {
    if (order.paymentStatus === 'PAID') {
      pushToast('Paid orders cannot be cancelled.', 'err');
      return;
    }
    if (order.status === 'CANCELLED') {
      pushToast('Order is already cancelled.');
      return;
    }
    if (!canTransition(order.status, 'CANCELLED')) {
      pushToast(`Cannot cancel this order from ${order.status}.`, 'err');
      return;
    }
    if (!window.confirm(`Cancel order ${displayTitle(order)}?`)) return;
    setCancellingId(order.id);
    try {
      await setStatus(order.id, 'CANCELLED');
      pushToast('Order cancelled');
      if (selectedId === order.id) setSelectedId(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not cancel order.', 'err');
    } finally {
      setCancellingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (statusFilter === 'active') {
          return OPEN_STATUSES.includes(o.status) || (o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED');
        }
        if (statusFilter === 'paid') return o.paymentStatus === 'PAID';
        if (statusFilter === 'cancelled') return o.status === 'CANCELLED';
        return true;
      })
      .filter((o) => {
        const ch = orderChannel(o);
        if (channel === 'dine') return ch === 'dine';
        if (channel === 'takeout') return ch === 'pickup';
        if (channel === 'delivery') return ch === 'delivery';
        return true;
      })
      .filter((o) => {
        if (!q) return true;
        return (
          String(o.orderNumber).includes(q)
          || o.id.toLowerCase().includes(q)
          || (o.tableName ?? '').toLowerCase().includes(q)
          || o.customerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, statusFilter, channel, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);
  const selected = filtered.find((o) => o.id === selectedId) ?? null;

  function toggleChannel(next: ChannelFilter) {
    setChannel((prev) => (prev === next ? 'all' : next));
    setPage(0);
  }

  const statusLabel =
    statusFilter === 'active' ? 'Active'
      : statusFilter === 'paid' ? 'Paid'
        : statusFilter === 'cancelled' ? 'Cancelled'
          : 'All';

  return (
    <div className="o-orders">
      <div className="o-orders-list">
        <div className="o-orders-filters">
          <div className="o-orders-searchbar">
            <label className="o-orders-search">
              <SearchIcon />
              <input
                placeholder="Search Orders..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <div className="o-orders-status">
              <button
                type="button"
                className="o-orders-status__btn"
                aria-expanded={statusOpen}
                onClick={() => setStatusOpen((v) => !v)}
              >
                {statusLabel}
                <span aria-hidden>▾</span>
              </button>
              {statusOpen ? (
                <div className="o-orders-status__menu" role="listbox">
                  {([
                    ['active', 'Active'],
                    ['all', 'All'],
                    ['paid', 'Paid'],
                    ['cancelled', 'Cancelled'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={statusFilter === id ? 'is-on' : undefined}
                      onClick={() => {
                        setStatusFilter(id);
                        setStatusOpen(false);
                        setPage(0);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="o-orders-filters__row">
            <div className="o-orders-pills">
              <button
                type="button"
                className={`o-orders-pill${channel === 'dine' ? ' is-on' : ''}`}
                aria-pressed={channel === 'dine'}
                onClick={() => toggleChannel('dine')}
              >
                Dine In
              </button>
              <button
                type="button"
                className={`o-orders-pill${channel === 'takeout' ? ' is-on' : ''}`}
                aria-pressed={channel === 'takeout'}
                onClick={() => toggleChannel('takeout')}
              >
                Takeout
              </button>
              <button
                type="button"
                className={`o-orders-pill${channel === 'delivery' ? ' is-on' : ''}`}
                aria-pressed={channel === 'delivery'}
                onClick={() => toggleChannel('delivery')}
              >
                Delivery
              </button>
            </div>

            <div className="o-orders-pager">
              <span>
                {rangeStart}-{rangeEnd} / {filtered.length}
              </span>
              <button
                type="button"
                className="o-orders-pager__btn"
                disabled={safePage <= 0}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ‹
              </button>
              <button
                type="button"
                className="o-orders-pager__btn"
                disabled={safePage >= pageCount - 1}
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        <div className="o-orders-rows">
          {pageRows.map((order) => {
            const ongoing = order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';
            const when = orderWhenParts(order.createdAt);
            return (
              <div
                key={order.id}
                className={`o-order-row${selectedId === order.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(order.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedId(order.id);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="o-order-row__when">
                  <div className="o-order-row__day">{when.day}</div>
                  <div className="o-order-row__clock">{when.time}</div>
                </div>
                <div className="o-order-row__main">
                  <div className="o-order-row__title">{displayTitle(order)}</div>
                  <div className="o-order-row__ref">{orderRef(order)}</div>
                </div>
                <div className="o-order-row__tags">
                  <span className={channelBadgeClass(order)}>{channelLabel(order)}</span>
                  {order.tableName ? (
                    <span className="o-badge o-badge--table">Table {order.tableName}</span>
                  ) : null}
                </div>
                <div className="o-order-row__end">
                  {selectedId === order.id ? <BagMark /> : null}
                  <div className="o-order-row__amount">{formatOdooINR(order.total)}</div>
                  <span className={`o-badge ${ongoing ? 'o-badge--ongoing' : 'o-badge--muted'}`}>
                    {order.status === 'CANCELLED' ? 'Cancelled' : order.paymentStatus === 'PAID' ? 'Paid' : 'Ongoing'}
                  </span>
                  <div className="o-order-row__actions">
                    <button
                      type="button"
                      className="o-order-row__icon"
                      title="Open"
                      aria-label="Open order"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/pos/app/register?order=${order.id}&table=${encodeURIComponent(order.tableName || '')}`);
                      }}
                    >
                      i
                    </button>
                    <button
                      type="button"
                      className="o-order-row__icon o-order-row__icon--danger"
                      title="Cancel"
                      aria-label="Cancel order"
                      disabled={cancellingId === order.id || order.status === 'CANCELLED' || order.paymentStatus === 'PAID'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void cancelOrder(order);
                      }}
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!pageRows.length ? <div className="o-orders-none">No orders</div> : null}
        </div>
      </div>

      <div className="o-orders-detail">
        {selected ? (
          <div className={`o-ticket${selected.items.length < 3 ? ' o-ticket--short' : ''}`}>
            <div className="o-ticket__lines">
              {selected.items.map((item) => {
                const extras = itemExtras(item);
                const combo = isComboItem(item);
                return (
                  <div key={item.id} className={`o-ticket__block${combo ? ' o-ticket__block--combo' : ''}`}>
                    <div className="o-ticket__line">
                      <strong className="o-ticket__qty">{item.quantity}</strong>
                      <div className="o-ticket__name">{item.nameSnapshot}</div>
                      <div className="o-ticket__price">{formatOdooINR(item.total)}</div>
                    </div>
                    {combo && extras.length ? (
                      <div className="o-ticket__children">
                        {extras.map((extra) => {
                          const nested = extra.match(/^(?:\d+\s*[x×]\s*)?(.+)$/i);
                          const label = nested?.[1]?.trim() || extra;
                          return (
                            <div key={extra} className="o-ticket__child">
                              <strong className="o-ticket__qty">1</strong>
                              <div className="o-ticket__name">{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      extras.map((extra) => (
                        <div key={extra} className="o-ticket__mod">
                          - {extra}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
            <div className="o-ticket__foot">
              <div className="o-ticket__total">
                <span>Total</span>
                <strong>{formatOdooINR(selected.total)}</strong>
              </div>
              <button
                type="button"
                className="o-ticket__load"
                onClick={() => navigate(`/pos/app/register?order=${selected.id}&table=${encodeURIComponent(selected.tableName || '')}`)}
              >
                Load Order
              </button>
            </div>
          </div>
        ) : (
          <div className="o-orders-empty">
            <CartEmptyIcon />
            <div>Select an order or scan QR code</div>
          </div>
        )}
      </div>
    </div>
  );
}
