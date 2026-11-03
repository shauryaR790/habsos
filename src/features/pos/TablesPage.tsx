import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  dueTotal,
  formatINR,
  OPEN_STATUSES,
  registerPath,
  TABLE_AREAS,
  tableLabel,
  tableVisualState,
  type TableArea,
  type TableInfo,
  type TableVisualState,
} from '../../../shared/domain';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { pushToast } from '../../components/Toast';
import { printTableQr } from '../../lib/printQr';
import { useTitle } from '../../lib/useTitle';
import { usePos } from './PosContext';
import QRCode from 'qrcode';

function viewportBox(pad = 12) {
  const vv = window.visualViewport;
  const left = (vv?.offsetLeft ?? 0) + pad;
  const top = (vv?.offsetTop ?? 0) + pad;
  const right = (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth) - pad;
  const bottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - pad;
  return { left, top, right, bottom };
}

function nudgeCtxMenu(x: number, y: number, el: HTMLElement) {
  const box = viewportBox();
  const rect = el.getBoundingClientRect();
  let nx = x;
  let ny = y;
  if (rect.right > box.right) nx -= rect.right - box.right;
  if (rect.bottom > box.bottom) ny -= rect.bottom - box.bottom;
  if (rect.left < box.left) nx += box.left - rect.left;
  if (rect.top < box.top) ny += box.top - rect.top;
  return { x: nx, y: ny };
}

const LEGEND: Array<{ id: TableVisualState; label: string }> = [
  { id: 'blank', label: 'Blank Table' },
  { id: 'running', label: 'Running Table' },
  { id: 'printed', label: 'Printed Table' },
  { id: 'paid', label: 'Paid Table' },
  { id: 'running-kot', label: 'Running KOT Table' },
  { id: 'otp-wait', label: 'Guest verifying OTP' },
  { id: 'reserved', label: 'Reserved Table' },
];

function elapsedMin(iso?: string) {
  if (!iso) return 0;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 60000);
}

export function TablesPage() {
  useTitle('Table View');
  const pos = usePos();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<TableVisualState | null>(null);
  const [dialog, setDialog] = useState<'reserve' | 'contactless' | 'move' | 'add' | null>(null);
  const [reserveTable, setReserveTable] = useState('');
  const [reserveName, setReserveName] = useState('');
  const [reserveMobile, setReserveMobile] = useState('');
  const [covers, setCovers] = useState('2');
  const [contactTable, setContactTable] = useState('');
  const [contactQr, setContactQr] = useState('');
  const [moveFrom, setMoveFrom] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [addName, setAddName] = useState('');
  const [addArea, setAddArea] = useState<TableArea>('Ground Floor');
  const [busy, setBusy] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ table: TableInfo; x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const grouped = useMemo(() => {
    return TABLE_AREAS.map((area) => ({
      area,
      tables: pos.tables.filter((table) => (table.area || 'Ground Floor') === area).filter((table) => {
        if (!filter) return true;
        return tableVisualState(table) === filter;
      }),
    }));
  }, [filter, pos.tables, now]);

  const blank = pos.tables.filter((table) => tableVisualState(table) === 'blank');
  const occupied = pos.tables.filter((table) => table.openOrder && table.openOrder.paymentStatus !== 'PAID');
  const held = pos.tables.filter((table) => table.reservation);
  const contact = pos.tables.find((entry) => entry.id === contactTable) ?? null;
  const qrOrders = pos.orders.filter((order) => (
    order.source === 'QR'
    && OPEN_STATUSES.includes(order.status)
    && (!contactTable || order.tableId === contactTable)
  ));
  const dueCount = pos.orders.filter((order) => order.paymentStatus === 'UNPAID' && OPEN_STATUSES.includes(order.status)).length;

  useLayoutEffect(() => {
    if (!ctxMenu || !ctxRef.current) return;
    const next = nudgeCtxMenu(ctxMenu.x, ctxMenu.y, ctxRef.current);
    if (Math.round(next.x) !== Math.round(ctxMenu.x) || Math.round(next.y) !== Math.round(ctxMenu.y)) {
      setCtxMenu((current) => (current ? { ...current, ...next } : current));
    }
  }, [ctxMenu?.table.id, ctxMenu?.x, ctxMenu?.y]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (!contact?.qrCode || dialog !== 'contactless') {
      setContactQr('');
      return;
    }
    const url = `${window.location.origin}/menu?table=${encodeURIComponent(contact.qrCode)}`;
    void QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#2c2218', light: '#fbf6ee' } }).then(setContactQr);
  }, [contact?.qrCode, dialog]);

  function openTable(table: TableInfo) {
    if (table.openOrder?.status === 'OTP_PENDING') {
      pushToast(`${table.openOrder.customerName} is verifying their mobile — order lands when the code is entered.`);
      return;
    }
    if (table.reservation && !table.openOrder) {
      navigate(registerPath({
        tableId: table.id,
        mode: 'dine',
        customerName: table.reservation.customerName,
        customerMobile: table.reservation.mobile,
        covers: table.reservation.covers,
      }));
      return;
    }
    navigate(registerPath({ tableId: table.id, mode: 'dine' }));
  }

  async function holdTable(openOrder: boolean) {
    if (!reserveTable) {
      pushToast('Pick a table', 'err');
      return;
    }
    if (!reserveName.trim()) {
      pushToast('Enter a guest name', 'err');
      return;
    }
    const coversCount = Number(covers);
    if (!Number.isInteger(coversCount) || coversCount < 1) {
      pushToast('Enter covers', 'err');
      return;
    }
    setBusy(true);
    try {
      await pos.createReservation({
        tableId: reserveTable,
        customerName: reserveName.trim(),
        customerMobile: reserveMobile,
        covers: coversCount,
      });
      const tableId = reserveTable;
      const guest = reserveName.trim();
      const phone = reserveMobile;
      setDialog(null);
      setReserveName('');
      setReserveMobile('');
      if (openOrder) {
        navigate(registerPath({
          tableId,
          mode: 'dine',
          customerName: guest,
          customerMobile: phone,
          covers: coversCount,
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyContactless() {
    const table = pos.tables.find((entry) => entry.id === contactTable);
    if (!table) {
      pushToast('Pick a table', 'err');
      return;
    }
    const url = `${window.location.origin}/menu?table=${encodeURIComponent(table.qrCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      pushToast('Contactless menu link copied');
      setDialog(null);
    } catch {
      pushToast(url);
    }
  }

  async function moveItems() {
    const source = pos.tables.find((entry) => entry.id === moveFrom);
    const dest = pos.tables.find((entry) => entry.id === moveTo);
    if (!source?.openOrder || !dest) {
      pushToast('Pick a running table and a free table', 'err');
      return;
    }
    setBusy(true);
    try {
      await pos.moveOrder(source.openOrder.id, dest.id);
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  async function applyStage(stage: 'blank' | 'running' | 'kot' | 'printed' | 'paid') {
    if (!ctxMenu) return;
    setBusy(true);
    try {
      await pos.setTableStage(ctxMenu.table.id, stage);
      setCtxMenu(null);
    } finally {
      setBusy(false);
    }
  }

  async function unreserve() {
    if (!ctxMenu?.table.reservation) return;
    setBusy(true);
    try {
      await pos.cancelReservation(ctxMenu.table.reservation.id);
      setCtxMenu(null);
    } finally {
      setBusy(false);
    }
  }

  async function addTable() {
    if (!addName.trim()) {
      pushToast('Enter a table name', 'err');
      return;
    }
    setBusy(true);
    try {
      await pos.createTable({ name: addName.trim(), area: addArea });
      setAddName('');
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tv">
      <header className="tv-bar">
        <h1>Table View</h1>
        <div className="tv-actions">
          <button type="button" className="tv-red" onClick={() => { setReserveTable(blank[0]?.id ?? ''); setDialog('reserve'); }}>+ Table Reservation</button>
          <button type="button" className="tv-red" onClick={() => { setContactTable(pos.tables[0]?.id ?? ''); setDialog('contactless'); }}>+ Contactless</button>
          <button type="button" className="tv-ghost" onClick={() => { setMoveFrom(occupied[0]?.id ?? ''); setMoveTo(blank[0]?.id ?? ''); setDialog('move'); }}>Move KOT / Items</button>
        </div>
        <div className="tv-modes">
          <button type="button" className="tv-ghost" onClick={() => navigate('/pos/orders/new?mode=delivery')}>Delivery</button>
          <button type="button" className="tv-red" onClick={() => navigate('/pos/orders/new?mode=pickup')}>Pick Up</button>
          <button type="button" className="tv-red" onClick={() => setDialog('add')}>+ Add Table</button>
        </div>
      </header>

      <div className="tv-start">
        <div className="tv-legend" role="group" aria-label="Table status">
          {LEGEND.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`tv-leg tv-leg-${entry.id}${filter === entry.id ? ' on' : ''}`}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter((current) => (current === entry.id ? null : entry.id))}
            >
              <i />
              {entry.label}
            </button>
          ))}
        </div>

      <section className="pos-hub" aria-label="Start an order">
        <button type="button" className="pos-hub-card" onClick={() => navigate(registerPath({ mode: 'dine', customerName: 'Walk-in' }))}>
          <strong>Dine in</strong>
          <span>Pick a table · walk-in or seated</span>
        </button>
        <button type="button" className="pos-hub-card" onClick={() => navigate(registerPath({ mode: 'pickup', customerName: 'Walk-in' }))}>
          <strong>Pick up</strong>
          <span>Takeaway · no table</span>
        </button>
        <button type="button" className="pos-hub-card" onClick={() => navigate(registerPath({ mode: 'delivery', customerName: 'Delivery' }))}>
          <strong>Delivery</strong>
          <span>Address on the bill</span>
        </button>
        <button type="button" className="pos-hub-card" onClick={() => { setReserveTable(blank[0]?.id ?? ''); setDialog('reserve'); }}>
          <strong>Reservation</strong>
          <span>{held.length ? `${held.length} held` : 'Hold a table'}</span>
        </button>
        <button type="button" className="pos-hub-card" onClick={() => navigate('/pos/payments')}>
          <strong>Collect payment</strong>
          <span>{dueCount ? `${dueCount} open · ${formatINR(pos.orders.filter((o) => o.paymentStatus === 'UNPAID' && OPEN_STATUSES.includes(o.status)).reduce((s, o) => s + dueTotal(o), 0))} due` : 'Nothing due'}</span>
        </button>
      </section>
      </div>

      <div className="tv-body">
        {grouped.map((group) => (
          <section key={group.area} className="tv-area">
            <h2>{group.area}</h2>
            <div className="tv-grid">
              {group.tables.map((table) => {
                const state = tableVisualState(table);
                const open = table.openOrder;
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`tv-tbl tv-tbl-${state} motion-card`}
                    onClick={() => openTable(table)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setCtxMenu({ table, x: event.clientX, y: event.clientY });
                    }}
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

      {dialog === 'reserve' ? (
        <Modal open title="Table Reservation" onClose={() => setDialog(null)}>
          <div className="tv-form">
            <label>
              Table
              <select value={reserveTable} onChange={(event) => setReserveTable(event.target.value)}>
                {blank.map((table) => (
                  <option key={table.id} value={table.id}>{tableLabel(table.name)} · {table.area}</option>
                ))}
              </select>
            </label>
            <Input label="Guest name" value={reserveName} onChange={(event) => setReserveName(event.target.value)} />
            <Input label="Mobile" inputMode="tel" value={reserveMobile} onChange={(event) => setReserveMobile(event.target.value)} />
            <Input label="Covers" inputMode="numeric" value={covers} onChange={(event) => setCovers(event.target.value)} />
            <div className="run-acts">
              <Button disabled={busy || !blank.length} onClick={() => void holdTable(false)}>Hold table</Button>
              <Button disabled={busy || !blank.length} onClick={() => void holdTable(true)}>Hold & open</Button>
            </div>
            {held.length ? (
              <div className="held-list">
                <p className="fine">Held now</p>
                {held.map((table) => (
                  <p key={table.id} className="held-row">
                    <span>{tableLabel(table.name)} · {table.reservation?.customerName} · {table.reservation?.covers}</span>
                    <button type="button" disabled={busy} onClick={() => table.reservation && void pos.cancelReservation(table.reservation.id)}>Cancel</button>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {dialog === 'contactless' ? (
        <Modal open title="Contactless" onClose={() => setDialog(null)}>
          <div className="tv-form">
            <label>
              Table
              <select value={contactTable} onChange={(event) => setContactTable(event.target.value)}>
                {pos.tables.map((table) => (
                  <option key={table.id} value={table.id}>{tableLabel(table.name)} · {table.area}</option>
                ))}
              </select>
            </label>
            {contactQr ? <img className="qr" src={contactQr} alt={`QR for ${contact ? tableLabel(contact.name) : 'table'}`} /> : null}
            <p className="fine">{contact ? `${window.location.origin}/menu?table=${encodeURIComponent(contact.qrCode)}` : ''}</p>
            <div className="run-acts">
              <Button onClick={() => void copyContactless()}>Copy link</Button>
              <Button variant="ghost" disabled={!contact} onClick={() => contact && void printTableQr(contact, pos.cafe?.name ?? 'After Dunes')}>Print QR</Button>
            </div>
            {qrOrders.length ? (
              <div className="held-list">
                <p className="fine">Live QR orders</p>
                {qrOrders.map((order) => (
                  <p key={order.id} className="held-row">
                    <button
                      type="button"
                      onClick={() => navigate(registerPath({ tableId: order.tableId, orderId: order.id, mode: 'dine' }))}
                    >
                      #{order.orderNumber} · {order.tableName ?? '—'} · {order.customerName}
                    </button>
                  </p>
                ))}
              </div>
            ) : <p className="fine">No open QR orders for this table.</p>}
          </div>
        </Modal>
      ) : null}

      {dialog === 'move' ? (
        <Modal open title="Move KOT / Items" onClose={() => setDialog(null)}>
          <div className="tv-form">
            <label>
              From
              <select value={moveFrom} onChange={(event) => setMoveFrom(event.target.value)}>
                {occupied.map((table) => (
                  <option key={table.id} value={table.id}>{tableLabel(table.name)} · {formatINR(table.openOrder?.total ?? 0)}</option>
                ))}
              </select>
            </label>
            <label>
              To
              <select value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                {blank.map((table) => (
                  <option key={table.id} value={table.id}>{tableLabel(table.name)} · {table.area}</option>
                ))}
              </select>
            </label>
            <Button disabled={busy || !occupied.length || !blank.length} onClick={() => void moveItems()}>Move</Button>
          </div>
        </Modal>
      ) : null}

      {ctxMenu && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={ctxRef}
            className="tv-ctx"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            role="menu"
            onMouseLeave={() => setCtxMenu(null)}
          >
            <p className="tv-ctx-title">{tableLabel(ctxMenu.table.name)}</p>
            {ctxMenu.table.reservation ? (
              <button type="button" disabled={busy} onClick={() => void unreserve()}>Unreserve</button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => void applyStage('blank')}>Mark blank</button>
            <button type="button" disabled={busy} onClick={() => void applyStage('running')}>Running</button>
            <button type="button" disabled={busy} onClick={() => void applyStage('kot')}>KOT / kitchen</button>
            <button type="button" disabled={busy} onClick={() => void applyStage('printed')}>Bill printed</button>
            <button type="button" disabled={busy} onClick={() => void applyStage('paid')}>Paid</button>
          </div>,
          document.body,
        )
        : null}

      {dialog === 'add' ? (
        <Modal open title="Add Table" onClose={() => setDialog(null)}>
          <div className="tv-form">
            <Input label="Table name" value={addName} onChange={(event) => setAddName(event.target.value)} placeholder="21" />
            <label>
              Area
              <select value={addArea} onChange={(event) => setAddArea(event.target.value as TableArea)}>
                {TABLE_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </label>
            <Button disabled={busy} onClick={() => void addTable()}>Save</Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
