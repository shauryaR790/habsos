import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canTransition, noteValue, type Order, type OrderStatus } from '../../../../shared/domain';
import { pushToast } from '../../../components/Toast';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import { channelLabel, stageOf } from './PreparationDisplayPage';

type Filter = 'all' | 'cook' | 'ready' | 'done';
type ChannelFilter = 'all' | 'Dine In' | 'Takeout' | 'Delivery';

function timerTone(iso: string, now: number) {
  const mins = (now - Date.parse(iso)) / 60_000;
  if (mins >= 30) return 'is-late';
  if (mins >= 15) return 'is-warn';
  return 'is-fresh';
}

function ticketTitle(order: Order) {
  if (order.tableName) return order.tableName;
  if (order.customerName.trim()) return order.customerName.trim().toUpperCase();
  return String(order.orderNumber);
}

function coversOf(order: Order) {
  const raw = noteValue(order.notes, 'GUESTS') || noteValue(order.notes, 'COVERS');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

function formatTimer(iso: string, now: number) {
  const sec = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

export function PrepScreenPage() {
  useTitle('Preparation Screen');
  const navigate = useNavigate();
  const { orders, setStatus } = usePos();
  const [filter, setFilter] = useState<Filter>('all');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [now, setNow] = useState(() => Date.now());
  const [recallId, setRecallId] = useState<string | null>(null);
  const [servedIds, setServedIds] = useState<Set<string>>(() => new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(4);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      const styles = getComputedStyle(el);
      const pad = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const width = Math.max(0, el.clientWidth - pad);
      const gap = 18;
      const minCard = width < 640 ? width : width < 1100 ? 340 : width < 1500 ? 420 : 480;
      setPerRow(Math.max(1, Math.floor((width + gap) / (minCard + gap))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const board = useMemo(
    () => orders
      .filter((order) => stageOf(order))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders],
  );

  const typed = board.filter((order) => channel === 'all' || channelLabel(order) === channel);

  const counts = {
    cook: typed.filter((order) => stageOf(order) === 'cook').length,
    ready: typed.filter((order) => stageOf(order) === 'ready').length,
    done: typed.filter((order) => stageOf(order) === 'done').length,
  };

  const visible = typed.filter((order) => filter === 'all' || stageOf(order) === filter);
  const layers: Order[][] = [];
  for (let i = 0; i < visible.length; i += perRow) layers.push(visible.slice(i, i + perRow));

  async function markReady(order: Order) {
    if (servedIds.has(order.id)) return;
    setServedIds((current) => new Set(current).add(order.id));
    const next: OrderStatus | null = canTransition(order.status, 'READY')
      ? 'READY'
      : canTransition(order.status, 'SERVED')
        ? 'SERVED'
        : canTransition(order.status, 'COMPLETED')
          ? 'COMPLETED'
          : null;
    if (!next) return;
    setRecallId(order.id);
    await setStatus(order.id, next);
    pushToast('Served from kitchen');
  }

  async function cancelOrder(order: Order) {
    if (order.status === 'CANCELLED') {
      pushToast('This order is already cancelled.');
      return;
    }
    if (!canTransition(order.status, 'CANCELLED')) {
      pushToast('This order cannot be cancelled.', 'err');
      return;
    }
    await setStatus(order.id, 'CANCELLED');
    pushToast('Order cancelled');
  }

  async function recall() {
    const order = orders.find((entry) => entry.id === recallId) ?? board.filter((entry) => stageOf(entry) === 'done').at(-1);
    if (!order) return;
    const back: OrderStatus = order.status === 'COMPLETED' ? 'SERVED' : 'READY';
    if (!canTransition(order.status, back)) return;
    await setStatus(order.id, back);
    setFilter('all');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  return (
    <div className="odoo-pos o-kds">
      <header className="o-kds__bar">
        <div className="o-kds__side">
          <button type="button" className="o-kds__icon" aria-label="Fullscreen" onClick={toggleFullscreen}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="o-kds__icon" aria-label="Completed" onClick={() => setFilter('done')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
              <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="o-kds__filters">
          <label className="o-kds__type">
            <span className="sr-only">Filter orders</span>
            <select value={channel} onChange={(event) => setChannel(event.target.value as ChannelFilter)} aria-label="Filter orders">
              <option value="all">All types</option>
              <option value="Dine In">Dine In</option>
              <option value="Takeout">Takeout</option>
              <option value="Delivery">Delivery</option>
            </select>
          </label>
          <button type="button" className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'cook' ? 'is-on' : ''} onClick={() => setFilter('cook')}>
            To cook <em className="is-cook">{counts.cook}</em>
          </button>
          <button type="button" className={filter === 'ready' ? 'is-on' : ''} onClick={() => setFilter('ready')}>
            Ready <em className="is-ready">{counts.ready}</em>
          </button>
          <button type="button" className={filter === 'done' ? 'is-on' : ''} onClick={() => setFilter('done')}>
            Completed <em className="is-ready">{counts.done}</em>
          </button>
        </div>

        <div className="o-kds__side o-kds__side--end">
          <button type="button" className="o-kds__recall" onClick={() => void recall()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 12a8 8 0 101.2-4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M4 5v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Recall
          </button>
          <button type="button" className="o-kds__close" onClick={() => navigate('/pos/backend/preparation')}>
            Close
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="o-kds__board" ref={boardRef}>
        {!visible.length ? <p className="o-kds__empty">No orders yet</p> : null}
        {layers.map((layer, layerIndex) => (
          <div key={layer.map((order) => order.id).join('-')} className="o-kds__layer">
            {layerIndex > 0 ? <div className="o-kds__layer-line" /> : null}
            <div className="o-kds__row" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
        {layer.map((order) => {
          const channel = channelLabel(order);
          const servedFromKitchen = servedIds.has(order.id);
          return (
            <article key={order.id} className="o-kds__card">
              <header>
                <strong>{ticketTitle(order)}</strong>
                <span className="o-kds__guests">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="12" cy="8" r="3.2" />
                    <path d="M5.5 19.2c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5" />
                  </svg>
                  {coversOf(order)}
                </span>
              </header>
              <div className="o-kds__meta">
                <span className={`o-kds__channel${channel === 'Takeout' ? ' is-takeout' : ''}${channel === 'Delivery' ? ' is-delivery' : ''}`}>
                  {channel}
                </span>
                <span className={`o-kds__timer ${timerTone(order.createdAt, now)}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 10v3.5l2 1.2M9 4h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {formatTimer(order.createdAt, now)}
                </span>
              </div>
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>
                    <div>{item.quantity}x {item.nameSnapshot}</div>
                    {item.addons.map((addon) => (
                      <div key={addon.id} className="o-kds__mod">- {addon.nameSnapshot}</div>
                    ))}
                    {item.notes ? <div className="o-kds__mod">- {item.notes}</div> : null}
                  </li>
                ))}
              </ul>
              <div className="o-kds__actions">
                <button
                  type="button"
                  className={servedFromKitchen ? 'o-kds__ready is-served' : 'o-kds__ready'}
                  onClick={(event) => {
                    event.stopPropagation();
                    void markReady(order);
                  }}
                >
                  {servedFromKitchen ? 'SERVED FROM KITCHEN' : 'ORDER READY TO SERVE'}
                </button>
                <button
                  type="button"
                  className="o-kds__cancel"
                  onClick={(event) => {
                    event.stopPropagation();
                    void cancelOrder(order);
                  }}
                >
                  CANCEL ORDER
                </button>
              </div>
            </article>
          );
        })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderStatusScreenPage() {
  useTitle('Order Status');
  const navigate = useNavigate();
  const { orders } = usePos();
  const cooking = orders.filter((order) => stageOf(order) === 'cook');
  const ready = orders.filter((order) => stageOf(order) === 'ready');

  return (
    <div className="odoo-pos o-kds o-kds--status">
      <header className="o-kds__bar">
        <strong>Order status</strong>
        <button type="button" className="o-kds__close" onClick={() => navigate('/pos/backend/preparation')}>
          Close
        </button>
      </header>
      <div className="o-status-board">
        <section>
          <h2>Preparing</h2>
          {cooking.map((order) => <div key={order.id}>{ticketTitle(order)}</div>)}
        </section>
        <section>
          <h2>Ready</h2>
          {ready.map((order) => <div key={order.id}>{ticketTitle(order)}</div>)}
        </section>
      </div>
    </div>
  );
}
