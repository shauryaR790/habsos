import type { PaymentStatus } from '../../shared/domain';

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`badge pay-${status.toLowerCase()}`}>{status}</span>;
}
