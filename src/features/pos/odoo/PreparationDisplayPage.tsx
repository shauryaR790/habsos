import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orderChannel, type Order, type OrderStatus } from '../../../../shared/domain';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import type { BackendChromeContext } from './OdooBackendLayout';

const COOK: OrderStatus[] = ['CONFIRMED', 'ACCEPTED', 'PREPARING'];

function stageOf(order: Order): 'cook' | 'ready' | 'done' | null {
  if (COOK.includes(order.status)) return 'cook';
  if (order.status === 'READY') return 'ready';
  if (order.status === 'SERVED' || order.status === 'COMPLETED') return 'done';
  return null;
}

export function PreparationDisplayPage() {
  useTitle('Preparation Display');
  const navigate = useNavigate();
  const { orders } = usePos();
  const { setPagerLabel } = useOutletContext<BackendChromeContext>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setPagerLabel('1-1 / 1');
  }, [setPagerLabel]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const live = useMemo(
    () => orders.filter((order) => stageOf(order) === 'cook' || stageOf(order) === 'ready'),
    [orders],
  );

  const averageMin = live.length
    ? Math.round(live.reduce((sum, order) => sum + Math.max(0, now - Date.parse(order.createdAt)), 0) / live.length / 60_000)
    : 0;

  return (
    <div className="o-prep-home">
      <article className="o-prep-card">
        <header className="o-prep-card__head">
          <h2>Kitchen Display</h2>
          <button
            type="button"
            className="o-prep-card__gear"
            aria-label="Configure"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          {menuOpen ? (
            <div className="o-prep-card__menu" role="menu">
              <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>Configure</button>
            </div>
          ) : null}
        </header>

        <div className="o-prep-card__stages">
          <span>To cook</span>
          <span>Ready</span>
          <span>Completed</span>
        </div>

        <div className="o-prep-card__body">
          <div className="o-prep-card__actions">
            <button type="button" className="o-prep-card__go" onClick={() => navigate('/pos/prep')}>
              Preparation Screen
            </button>
            <button type="button" className="o-prep-card__alt" onClick={() => navigate('/pos/prep/status')}>
              Order Status Screen
            </button>
          </div>
          <dl className="o-prep-card__stats">
            <div>
              <dt>In progress</dt>
              <dd>{live.length}</dd>
            </div>
            <div>
              <dt>Average time</dt>
              <dd>{averageMin}&apos;</dd>
            </div>
          </dl>
        </div>
      </article>
    </div>
  );
}

export function channelLabel(order: Order) {
  const channel = orderChannel(order);
  if (channel === 'dine') return 'Dine In';
  if (channel === 'delivery') return 'Delivery';
  const mode = order.notes.toLowerCase();
  if (mode.includes('takeout') || mode.includes('pickup')) return 'Takeout';
  return order.tableId ? 'Dine In' : 'Takeout';
}

export { stageOf, COOK };
