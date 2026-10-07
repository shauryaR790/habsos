import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../shared/domain';

export type OrderAlertItem = {
  id: number;
  orderId: string;
  orderNumber: number;
  tableName: string | null;
  customerName: string;
  total: number;
};

let alerts: OrderAlertItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pushOrderAlert(input: Omit<OrderAlertItem, 'id'>) {
  const item: OrderAlertItem = { ...input, id: Date.now() + Math.random() };
  alerts = [...alerts, item].slice(-4);
  emit();
  window.setTimeout(() => {
    alerts = alerts.filter((entry) => entry.id !== item.id);
    emit();
  }, 6500);
}

function dismissAlert(id: number) {
  alerts = alerts.filter((entry) => entry.id !== id);
  emit();
}

export function useOrderAlerts() {
  return useSyncExternalStore(subscribe, () => alerts);
}

export function OrderAlertHost() {
  const items = useOrderAlerts();
  const navigate = useNavigate();
  if (!items.length) return null;

  return (
    <div className="order-alerts no-print" aria-live="assertive">
      {items.map((alert) => (
        <button
          key={alert.id}
          type="button"
          className="order-alert"
          onClick={() => {
            dismissAlert(alert.id);
            navigate(`/pos/orders/${alert.orderId}`);
          }}
        >
          <span className="order-alert-kicker">New order</span>
          <span className="order-alert-num">#{alert.orderNumber}</span>
          <span className="order-alert-meta">
            {alert.tableName ? `Table ${alert.tableName}` : 'Pickup'} · {alert.customerName}
          </span>
          <span className="order-alert-total">{formatINR(alert.total)}</span>
        </button>
      ))}
    </div>
  );
}
