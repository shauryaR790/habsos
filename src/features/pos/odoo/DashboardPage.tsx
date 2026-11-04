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

function buildSparkLine(series: number[]) {
  const W = 420;
  const H = 88;
  const padX = 8;
  const padTop = 10;
  const padBot = 18;
  const values = series.length ? series : [0];
  const max = Math.max(...values, 1);
  const n = values.length;
  const step = n <= 1 ? 0 : (W - padX * 2) / (n - 1);
  const points = values.map((v, i) => {
    const x = padX + i * step;
    const y = padTop + (1 - v / max) * (H - padTop - padBot);
    return { x, y };
  });
  if (points.length === 1) {
    points.push({ x: W - padX, y: points[0].y });
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
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
  if (!active) {
    return (
      <div className="o-pos-card__chart o-pos-card__chart--empty" aria-hidden>
        <svg viewBox="0 0 420 88" preserveAspectRatio="none">
          <line x1="12" y1="70" x2="408" y2="70" stroke="#ececec" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  const data = series.length ? series : [0, soldTotal || 0];
  const line = buildSparkLine(data);

  return (
    <div
      className="o-pos-card__chart"
      role="img"
      aria-label={`Session sales chart, ${formatOdooINR(soldTotal)} sold`}
      title={`${formatOdooINR(soldTotal)} sold this session`}
    >
      <svg viewBox="0 0 420 88" preserveAspectRatio="none">
        <path d={line} fill="none" stroke="#111111" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
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
