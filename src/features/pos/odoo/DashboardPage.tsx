import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatOdooINR,
  type PosConfig,
  type PosSession,
  type PosSessionStats,
} from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import { OpeningCashModal } from './OpeningCashModal';

type Card = { config: PosConfig; session: PosSession | null; stats: PosSessionStats };
type Dash = {
  config: PosConfig;
  session: PosSession | null;
  stats: PosSessionStats;
  cards: Card[];
};

const CHART_W = 420;
const CHART_H = 96;

function activitySeries(series: number[]) {
  if (!series.length) return [0, 0, 0];
  const cumulative = series.every((value, index) => index === 0 || value + 0.01 >= series[index - 1]);
  const raw = cumulative
    ? series.map((value, index) => Math.max(0, value - (index ? series[index - 1] : 0)))
    : series.map((value) => Math.max(0, value));
  return [0, ...raw, 0];
}

function smoothSeries(values: number[]) {
  const radius = 2;
  return values.map((_, index) => {
    let acc = 0;
    let weight = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = index + k;
      if (j < 0 || j >= values.length) continue;
      const w = Math.exp(-(k * k) / 2.2);
      acc += values[j] * w;
      weight += w;
    }
    return weight ? acc / weight : 0;
  });
}

function chartGeometry(series: number[]) {
  const values = smoothSeries(activitySeries(series));
  const max = Math.max(...values, 0);
  const base = CHART_H - 1;
  const peak = 10;
  const n = values.length;
  const points = values.map((value, index) => {
    const x = n <= 1 ? 0 : (index / (n - 1)) * CHART_W;
    const y = max <= 0 ? base : base - (value / max) * (base - peak);
    return { x, y };
  });

  let line = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const area = `${line} L${CHART_W},${base} L0,${base} Z`;
  return { line, area, points, base, hasSales: max > 0 };
}

function SessionSparkline({
  active,
  series,
  soldTotal,
}: {
  active: boolean;
  series: number[];
  soldTotal: number;
}) {
  const shapeKey = series.join(',');
  if (!active) {
    return (
      <div className="o-pos-card__chart o-pos-card__chart--empty" aria-hidden>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
          <line x1="0" y1={CHART_H - 1} x2={CHART_W} y2={CHART_H - 1} stroke="#ececec" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  const { line, area, points, base, hasSales } = chartGeometry(series);

  return (
    <div
      className="o-pos-card__chart"
      role="img"
      aria-label={`Session sales chart, ${formatOdooINR(soldTotal)} sold`}
      title={`${formatOdooINR(soldTotal)} sold this session`}
    >
      <svg key={shapeKey} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
        <line x1="0" y1={base} x2={CHART_W} y2={base} className="o-pos-card__baseline" />
        {hasSales ? <path d={area} className="o-pos-card__area" /> : null}
        <path d={line} className={`o-pos-card__line${hasSales ? '' : ' is-flat'}`} />
        {hasSales
          ? points.filter((_, index) => index % 4 === 0).map((point) => (
            <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="2.2" className="o-pos-card__dot" />
          ))
          : null}
      </svg>
    </div>
  );
}

export function DashboardPage() {
  useTitle('Point of Sale');
  const navigate = useNavigate();
  const { user } = usePos();
  const [data, setData] = useState<Dash | null>(null);
  const [openingFor, setOpeningFor] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initial = (user?.name ?? 'S').trim().charAt(0).toUpperCase() || 'S';

  const load = useCallback(async () => {
    const dash = await api<Dash>('/api/pos/dashboard');
    setData(dash);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function goFoH(fromId: string) {
    setLeaving(fromId);
    window.setTimeout(() => navigate('/pos/app/tables'), 220);
  }

  async function openRegister(openingCash: number) {
    if (!openingFor) return;
    const configId = openingFor;
    await api('/api/pos/session/open', {
      method: 'POST',
      body: JSON.stringify({ openingCash, configId }),
    });
    setOpeningFor(null);
    setLeaving(configId);
    window.setTimeout(() => navigate('/pos/app/tables', { replace: true }), 220);
  }

  if (error) return <p className="o-dash-error">{error}</p>;
  if (!data) {
    return (
      <div className="o-loading" style={{ minHeight: 240 }}>
        <div>
          <div className="o-awning" />
          <div className="o-loading-bar"><span /></div>
        </div>
      </div>
    );
  }

  const card = data.cards?.[0] ?? {
    config: data.config,
    session: data.session,
    stats: data.stats,
  };
  const open = Boolean(card.session);
  const dateLabel = new Date(card.session?.openedAt ?? Date.now()).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });

  return (
    <>
      <div className="o-pos-kanban">
        <article
          className={[
            'o-pos-card',
            open ? 'o-pos-card--open' : '',
            leaving === card.config.id ? 'is-leaving' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="o-pos-card__top">
            <h2 className="o-pos-card__title">{card.config.name}</h2>
          </div>

          <div className={`o-pos-card__body${open ? '' : ' o-pos-card__body--closed'}`}>
            <div className="o-pos-card__left">
              <div className="o-pos-card__actions">
                {open ? (
                  <>
                    <button
                      type="button"
                      className="o-btn o-btn--primary o-btn--pos"
                      onClick={() => goFoH(card.config.id)}
                    >
                      Continue Selling
                    </button>
                    <button
                      type="button"
                      className="o-btn o-btn--pos"
                      onClick={() => goFoH(card.config.id)}
                    >
                      Mobile Menu
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="o-btn o-btn--primary o-btn--pos"
                    onClick={() => setOpeningFor(card.config.id)}
                  >
                    Open Register
                  </button>
                )}
              </div>
              {open ? <span className="o-pos-card__avatar" aria-hidden>{initial}</span> : null}
            </div>

            {open ? (
              <div className="o-pos-card__stats">
                <div className="o-pos-card__stat">
                  <span>Date</span>
                  <strong>{dateLabel}</strong>
                </div>
                <div className="o-pos-card__stat">
                  <span>Opening</span>
                  <strong>{formatOdooINR(card.stats.openingCash)}</strong>
                </div>
                <div className="o-pos-card__stat">
                  <span>Sold</span>
                  <strong>
                    {formatOdooINR(card.stats.soldTotal)} ({card.stats.soldOrders} order
                    {card.stats.soldOrders === 1 ? '' : 's'})
                  </strong>
                </div>
                <div className="o-pos-card__stat">
                  <span>Ongoing</span>
                  <strong>
                    {formatOdooINR(card.stats.ongoingTotal)} ({card.stats.ongoingOrders} order
                    {card.stats.ongoingOrders === 1 ? '' : 's'})
                  </strong>
                </div>
              </div>
            ) : null}
          </div>

          <SessionSparkline
            active={open}
            series={card.stats.salesSeries ?? []}
            soldTotal={card.stats.soldTotal}
          />
        </article>

        {open ? (
          <button
            type="button"
            className="o-pos-new"
            onClick={() => goFoH(card.config.id)}
          >
            <span className="o-pos-new__plus" aria-hidden>+</span>
            <span>New Register</span>
          </button>
        ) : null}
      </div>

      {openingFor ? (
        <OpeningCashModal onDiscard={() => setOpeningFor(null)} onOpen={openRegister} />
      ) : null}
    </>
  );
}
