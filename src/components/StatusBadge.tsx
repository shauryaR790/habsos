import type { OrderStatus } from '../../shared/domain';

const LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  OTP_PENDING: 'Verifying',
  CONFIRMED: 'New',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{LABEL[status]}</span>;
}
