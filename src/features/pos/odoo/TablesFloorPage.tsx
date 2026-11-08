import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatINR,
  TABLE_AREAS,
  tableLabel,
  tableVisualState,
  type FloorPlan,
  type TableGeometry,
  type TableInfo,
} from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import { readFloorView } from './FoHBurgerMenu';
import { JumpTableModal } from './JumpTableModal';

type FloorsPayload = { floors: FloorPlan[]; geometry: TableGeometry[] };

const ALL_FLOORS = '__all__';

function elapsedMin(iso?: string) {
  if (!iso) return 0;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 60000);
}

function HashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 4l-2 16M17 4l-2 16M4 9h16M3 15h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TablesFloorPage() {
  useTitle('Tables');
  const navigate = useNavigate();
  const { tables, ready } = usePos();
  const [floors, setFloors] = useState<FloorPlan[]>([]);
  const [geometry, setGeometry] = useState<TableGeometry[]>([]);
  const [floorId, setFloorId] = useState<string>(ALL_FLOORS);
  const [floorView, setFloorView] = useState(readFloorView);
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpBtnRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void api<FloorsPayload>('/api/pos/floors').then((data) => {
      setFloors(data.floors);
      setGeometry(data.geometry);
      setFloorId((prev) => (prev === ALL_FLOORS || data.floors.some((f) => f.id === prev) ? prev : ALL_FLOORS));
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onView = (event: Event) => {
      const detail = (event as CustomEvent<'boxes' | 'compact'>).detail;
      setFloorView(detail === 'compact' ? 'compact' : 'boxes');
    };
    window.addEventListener('foh-floor-view', onView);
    return () => window.removeEventListener('foh-floor-view', onView);
  }, []);

  const showAllFloors = floorId === ALL_FLOORS;
  const activeFloor = showAllFloors ? floors[0]?.id : floorId;
  const floorTableIds = useMemo(() => {
    if (showAllFloors) return new Set(tables.map((t) => t.id));
    const ids = new Set(
      geometry.filter((g) => g.floorId === floorId).map((g) => g.tableId),
    );
    return ids;
  }, [geometry, floorId, showAllFloors, tables]);

  const seatingTables = useMemo(() => {
    if (showAllFloors) return tables;
    if (!floorTableIds.size) return tables;
    const onFloor = tables.filter((t) => floorTableIds.has(t.id));
    return onFloor.length ? onFloor : tables;
  }, [tables, floorTableIds, showAllFloors]);

  const grouped = useMemo(() => {
    const layers = [...TABLE_AREAS];
    return layers.map((area) => ({
      area,
      tables: seatingTables.filter((table) => (table.area || 'Ground Floor') === area),
    })).filter((group) => group.tables.length > 0);
  }, [seatingTables, now]);

  function openTable(table: TableInfo) {
    if (table.openOrder?.status === 'OTP_PENDING') return;
    const open = table.openOrder;
    const floorIndex = Math.max(1, floors.findIndex((f) => f.id === activeFloor) + 1);
    const tableNum = tableLabel(table.name).replace(/^T0?/, '') || table.name;
    const qs = new URLSearchParams({
      mode: 'dine',
      table: table.id,
      name: table.name,
      floor: String(floorIndex),
      label: `${floorIndex} - ${tableNum}`,
    });
    if (open) qs.set('order', open.id);
    navigate(`/pos/app/register?${qs.toString()}`);
  }

  if (!ready) {
    return (
      <div className="o-loading">
        <div>
          <div className="o-awning" />
          <div className="o-loading-bar"><span /></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="o-floor-bar">
        <button type="button" className="o-btn o-btn--primary" onClick={() => navigate('/pos/app/register')}>
          + New Order
        </button>
        <div className="o-floor-tabs">
          <button
            type="button"
            className={`o-floor-tab${showAllFloors ? ' is-active' : ''}`}
            onClick={() => setFloorId(ALL_FLOORS)}
          >
            All
          </button>
          {floors.map((floor) => (
            <button
              key={floor.id}
              type="button"
              className={`o-floor-tab${!showAllFloors && floor.id === floorId ? ' is-active' : ''}`}
              onClick={() => setFloorId(floor.id)}
            >
              {floor.name}
            </button>
          ))}
        </div>
        <button type="button" className="o-btn" onClick={() => navigate('/pos/settings')}>
          Get QR Codes
        </button>
        <button
          ref={jumpBtnRef}
          type="button"
          className="o-icon-btn"
          title="Jump"
          aria-label="Jump to table"
          onClick={() => setJumpOpen(true)}
        >
          <HashIcon />
        </button>
      </div>

      {jumpOpen ? (
        <JumpTableModal
          tables={tables}
          anchorEl={jumpBtnRef.current}
          onClose={() => setJumpOpen(false)}
          onJump={(table) => {
            setJumpOpen(false);
            openTable(table);
          }}
        />
      ) : null}

      <div className={`o-seat${floorView === 'compact' ? ' o-seat--compact' : ''}`}>
        {(grouped.length ? grouped : [{ area: 'Tables', tables: seatingTables }]).map((group) => (
          <section key={group.area} className="o-seat__area">
            <h2 className="o-seat__area-title">{group.area}</h2>
            <div className="o-seat__grid">
              {group.tables.map((table) => {
                const state = tableVisualState(table);
                const open = table.openOrder;
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`o-seat__tbl o-seat__tbl--${state}`}
                    onClick={() => openTable(table)}
                  >
                    <strong>{tableLabel(table.name)}</strong>
                    {open ? (
                      open.status === 'OTP_PENDING' ? (
                        <>
                          <span>OTP</span>
                          <span>{open.customerName}</span>
                        </>
                      ) : (
                        <>
                          <span>{elapsedMin(open.createdAt)} Min</span>
                          <span>{formatINR(open.total)}</span>
                          {open.due > 0 && open.due < open.total ? <span>Due {formatINR(open.due)}</span> : null}
                        </>
                      )
                    ) : table.reservation ? (
                      <>
                        <span>{table.reservation.customerName}</span>
                        <span>{table.reservation.covers} covers</span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
