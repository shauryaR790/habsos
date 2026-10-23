import { formatINR, type SalesHour, type SalesNamed } from '../../../shared/domain';

export type ReportViewMode = 'charts' | 'tables';

const CHART_COLORS = ['#5d7a2e', '#8a6b3c', '#3d6b8c', '#7a4b6d', '#4a6f5c', '#9a7b4f', '#6b5d8a', '#8c5a3d'];

export function ReportViewToggle({
  mode,
  onChange,
}: {
  mode: ReportViewMode;
  onChange: (mode: ReportViewMode) => void;
}) {
  return (
    <div className="bill-modes rpt-view" role="group" aria-label="Report layout">
      <button type="button" className={mode === 'charts' ? 'on' : ''} onClick={() => onChange('charts')}>
        Charts
      </button>
      <button type="button" className={mode === 'tables' ? 'on' : ''} onClick={() => onChange('tables')}>
        Tables
      </button>
    </div>
  );
}

export function CompareToggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={on ? 'rpt-compare on' : 'rpt-compare'}
      aria-pressed={on}
      onClick={() => onChange(!on)}
    >
      {label}
    </button>
  );
}

function pctDelta(current: number, prior: number) {
  if (prior === 0) return current === 0 ? null : 100;
  return Math.round(((current - prior) / prior) * 100);
}

export function KpiDelta({ current, prior, suffix }: { current: number; prior: number; suffix?: string }) {
  const delta = pctDelta(current, prior);
  if (delta === null) return null;
  const sign = delta > 0 ? '+' : '';
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <small className={`rpt-delta ${tone}`}>
      {sign}{delta}%{suffix ? ` ${suffix}` : ''}
    </small>
  );
}

export function PaymentMixChart({
  cash,
  card,
  upi,
  other,
}: {
  cash: number;
  card: number;
  upi: number;
  other: number;
}) {
  const total = cash + card + upi + other;
  const slices = [
    { label: 'Cash', amount: cash, color: CHART_COLORS[0] },
    { label: 'Card', amount: card, color: CHART_COLORS[1] },
    { label: 'UPI', amount: upi, color: CHART_COLORS[2] },
    { label: 'Other', amount: other, color: CHART_COLORS[3] },
  ].filter((entry) => entry.amount > 0);

  if (total === 0) return <p className="fine">No payments in this range.</p>;

  let cursor = 0;
  const gradient = slices
    .map((slice) => {
      const start = (cursor / total) * 100;
      cursor += slice.amount;
      const end = (cursor / total) * 100;
      return `${slice.color} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <div className="rpt-chart-split">
      <div className="rpt-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Payment mix">
        <div className="rpt-donut-hole">
          <strong>{formatINR(total)}</strong>
          <span>collected</span>
        </div>
      </div>
      <ul className="rpt-legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} aria-hidden="true" />
            <span>{slice.label}</span>
            <strong>{formatINR(slice.amount)}</strong>
            <small>{Math.round((slice.amount / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NamedBarChart({
  rows,
  maxRows = 16,
  selected,
  onPick,
  compareRows,
}: {
  rows: SalesNamed[];
  maxRows?: number;
  selected?: string | null;
  onPick?: (name: string) => void;
  compareRows?: SalesNamed[];
}) {
  const shown = rows.slice(0, maxRows);
  const max = Math.max(1, ...shown.map((row) => row.amount), ...(compareRows?.map((row) => row.amount) ?? []));
  const compareMap = new Map(compareRows?.map((row) => [row.name, row.amount]) ?? []);

  if (shown.length === 0) return null;

  return (
    <div className="rpt-hbars" role="list">
      {shown.map((row, index) => {
        const prior = compareMap.get(row.name) ?? 0;
        const width = Math.max(4, (row.amount / max) * 100);
        const priorWidth = prior > 0 ? Math.max(2, (prior / max) * 100) : 0;
        const interactive = Boolean(onPick);
        return (
          <div
            key={row.name}
            className={selected === row.name ? 'rpt-hbar on' : 'rpt-hbar'}
            role={interactive ? 'button' : 'listitem'}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onPick?.(row.name) : undefined}
            onKeyDown={interactive ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPick?.(row.name);
              }
            } : undefined}
          >
            <span className="rpt-hbar-label" title={row.name}>
              <i className="rpt-swatch" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} aria-hidden="true" />
              {row.name}
            </span>
            <div className="rpt-hbar-track" aria-hidden="true">
              {priorWidth > 0 ? <i className="prior" style={{ width: `${priorWidth}%` }} /> : null}
              <i style={{ width: `${width}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
            </div>
            <span className="rpt-hbar-meta">
              <strong>{formatINR(row.amount)}</strong>
              <small>{row.qty} qty</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HourColumnChart({
  hours,
  peak,
  selected,
  onPick,
  compareHours,
}: {
  hours: SalesHour[];
  peak: number;
  selected?: number | null;
  onPick?: (hour: number) => void;
  compareHours?: SalesHour[];
}) {
  const max = Math.max(1, peak, ...(compareHours?.map((row) => row.amount) ?? []));
  const compareMap = new Map(compareHours?.map((row) => [row.hour, row.amount]) ?? []);
  const active = hours.some((row) => row.bills > 0);

  if (!active) return <p className="fine">No billed hours in this range.</p>;

  return (
    <div className="rpt-vcols-wrap">
      <div className="rpt-vcols" role="list" aria-label="Sales by hour">
        {hours.map((row) => {
          const height = Math.max(4, (row.amount / max) * 100);
          const prior = compareMap.get(row.hour) ?? 0;
          const priorHeight = prior > 0 ? Math.max(3, (prior / max) * 100) : 0;
          const interactive = Boolean(onPick);
          return (
            <button
              key={row.hour}
              type="button"
              className={selected === row.hour ? 'rpt-vcol on' : 'rpt-vcol'}
              title={`${String(row.hour).padStart(2, '0')}:00 · ${formatINR(row.amount)} · ${row.bills} bills`}
              onClick={interactive ? () => onPick?.(row.hour) : undefined}
            >
              <span className="rpt-vcol-stack" aria-hidden="true">
                {priorHeight > 0 ? <i className="prior" style={{ height: `${priorHeight}%` }} /> : null}
                <i style={{ height: `${height}%` }} />
              </span>
              <span className="rpt-vcol-label">{String(row.hour).padStart(2, '0')}</span>
            </button>
          );
        })}
      </div>
      <p className="fine rpt-vcols-note">Tap an hour to drill into bills. Pale bars = prior period when compare is on.</p>
    </div>
  );
}

export function ChannelBarChart({
  rows,
}: {
  rows: Array<{ label: string; amount: number; bills: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <div className="rpt-hbars">
      {rows.map((row, index) => (
        <div key={row.label} className="rpt-hbar">
          <span className="rpt-hbar-label">{row.label}</span>
          <div className="rpt-hbar-track" aria-hidden="true">
            <i style={{ width: `${Math.max(4, (row.amount / max) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
          </div>
          <span className="rpt-hbar-meta">
            <strong>{formatINR(row.amount)}</strong>
            <small>{row.bills} bills</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function HoursTable({
  hours,
  selected,
  onPick,
}: {
  hours: SalesHour[];
  selected: number | null;
  onPick?: (hour: number) => void;
}) {
  const rows = hours.filter((row) => row.bills > 0);
  if (rows.length === 0) return <p className="fine">No billed hours in this range.</p>;
  return (
    <div className="run-wrap">
      <table className="run-table rpt-table">
        <thead>
          <tr>
            <th>Hour</th>
            <th>Bills</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.hour}
              className={selected === row.hour ? 'on' : undefined}
              role={onPick ? 'button' : undefined}
              tabIndex={onPick ? 0 : undefined}
              onClick={onPick ? () => onPick(row.hour) : undefined}
              onKeyDown={onPick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onPick(row.hour);
                }
              } : undefined}
            >
              <td>{String(row.hour).padStart(2, '0')}:00</td>
              <td>{row.bills}</td>
              <td className="price">{formatINR(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
