import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LINE_QTY_MAX,
  OPEN_STATUSES,
  applyLineQuantity,
  cartLineKey,
  clampLineQuantity,
  dueTotal,
  formatINR,
  nextTicketStatus,
  noteValue,
  orderFlag,
  paidTotal,
  priceCart,
  PriceError,
  resolveMenuShortcut,
  splitAmounts,
  tableLabel,
  taxLabel,
  normalizeMobile,
  paymentPreferenceFromNotes,
  type PaymentMethod,
} from '../../../shared/domain';
import { BillMetaBar, type BillMetaPanel } from '../../components/BillMetaBar';
import { Button } from '../../components/Button';
import { Input, TextArea } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { pushToast } from '../../components/Toast';
import { openPrintWindow, printTicket } from '../../lib/printTicket';
import { collectRazorpayPayment } from '../../lib/razorpayCheckout';
import { writeCurrentOrder } from '../../lib/currentOrder';
import { useTitle } from '../../lib/useTitle';
import type { Bootstrap } from '../customer/cart';
import { ModifierDialog } from './ModifierDialog';
import { usePos } from './PosContext';

type Mode = 'dine' | 'pickup' | 'delivery';
type PayKind = 'CASH' | 'CARD' | 'UPI' | 'DUE' | 'OTHER';
type Line = { lineId: string; menuItemId: string; quantity: number; addonIds: string[]; notes: string };
type Dialog = 'covers' | 'customer' | 'assign' | 'note' | 'split' | 'part' | 'other' | 'advance' | 'discount' | null;

export function NewOrderPage() {
  useTitle('New Order');
  const pos = usePos();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryTable = params.get('table');
  const queryMode = params.get('mode');
  const queryCovers = params.get('covers');
  const queryOrder = params.get('order');
  const queryName = params.get('name');
  const queryMobile = params.get('mobile');

  const [mode, setMode] = useState<Mode>(queryMode === 'pickup' || queryMode === 'delivery' ? queryMode : 'dine');
  const [tableId, setTableId] = useState<string | null>(queryTable);
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState(queryName || (queryMode === 'delivery' ? 'Delivery' : 'Walk-in'));
  const [mobile, setMobile] = useState(queryMobile || '');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [metaPanel, setMetaPanel] = useState<BillMetaPanel>(null);
  const [covers, setCovers] = useState(queryCovers || '');
  const [captain, setCaptain] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [search, setSearch] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [categoryId, setCategoryId] = useState('favorites');
  const [itemId, setItemId] = useState<string | null>(null);
  const [editLineId, setEditLineId] = useState<string | null>(null);
  const shortRef = useRef<HTMLInputElement>(null);
  const [payKind, setPayKind] = useState<PayKind>('CASH');
  const [otherLabel, setOtherLabel] = useState('');
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [splitParts, setSplitParts] = useState('2');
  const [partAmount, setPartAmount] = useState('');
  const [advanceAt, setAdvanceAt] = useState('');
  const [loyaltyNote, setLoyaltyNote] = useState(false);
  const [discountInr, setDiscountInr] = useState('');
  const [cashTender, setCashTender] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const catalog = useMemo<Bootstrap | null>(() => {
    if (!pos.cafe) return null;
    return { cafe: pos.cafe, table: null, categories: pos.categories, items: pos.items, addonGroups: pos.addonGroups };
  }, [pos.addonGroups, pos.cafe, pos.categories, pos.items]);

  const table = pos.tables.find((entry) => entry.id === tableId) ?? null;
  const bills = pos.orders
    .filter((entry) => (
      Boolean(tableId)
      && entry.tableId === tableId
      && OPEN_STATUSES.includes(entry.status)
      && entry.paymentStatus !== 'PAID'
    ))
    .sort((a, b) => a.orderNumber - b.orderNumber || a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    const openBills = pos.orders
      .filter((entry) => (
        Boolean(tableId)
        && entry.tableId === tableId
        && OPEN_STATUSES.includes(entry.status)
        && entry.paymentStatus !== 'PAID'
      ))
      .sort((a, b) => a.orderNumber - b.orderNumber || a.createdAt.localeCompare(b.createdAt));
    const preferred = queryOrder && openBills.some((bill) => bill.id === queryOrder) ? queryOrder : null;
    const paidOpen = table?.openOrder?.paymentStatus === 'PAID';
    const openId = preferred ?? openBills[0]?.id ?? (paidOpen ? null : table?.openOrder?.id ?? null);
    if (!openId) {
      if (loadedRef.current) {
        loadedRef.current = null;
        setOrderId(null);
        setLines([]);
        setDiscountInr('');
      }
      if (queryName) setName(queryName);
      if (queryMobile) setMobile(queryMobile);
      if (queryCovers) setCovers(queryCovers);
      return;
    }
    if (loadedRef.current === openId) return;
    const order = pos.orders.find((entry) => entry.id === openId);
    if (!order || order.paymentStatus === 'PAID' || !OPEN_STATUSES.includes(order.status)) {
      loadedRef.current = null;
      setOrderId(null);
      setLines([]);
      setDiscountInr('');
      return;
    }
    loadedRef.current = openId;
    setOrderId(order.id);
    setName(order.customerName || 'Walk-in');
    setMobile(order.customerMobile);
    setLines(order.items.flatMap((item) => (
      item.menuItemId
        ? [{
          lineId: item.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          addonIds: item.addons.map((addon) => addon.addonId).filter((id): id is string => Boolean(id)),
          notes: item.notes,
        }]
        : []
    )));
    let nextCovers = '';
    let nextCaptain = '';
    let nextAddress = '';
    let nextLocality = '';
    let nextExtra = '';
    let nextPay = '';
    let nextAdvance = '';
    let nextLoyalty = false;
    const rest: string[] = [];
    for (const line of order.notes.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'HOLD' || trimmed === 'COMPLIMENTARY' || trimmed === 'DUE' || trimmed === 'SPLIT') continue;
      if (trimmed.startsWith('COVER:')) nextCovers = trimmed.slice(6);
      else if (trimmed.startsWith('CAPTAIN:')) nextCaptain = trimmed.slice(8);
      else if (trimmed.startsWith('ADDR:')) nextAddress = trimmed.slice(5);
      else if (trimmed.startsWith('LOCALITY:')) nextLocality = trimmed.slice(9);
      else if (trimmed.startsWith('EXTRA:')) nextExtra = trimmed.slice(6);
      else if (trimmed.startsWith('PAY:')) nextPay = trimmed.slice(4);
      else if (trimmed.startsWith('ADVANCE:')) nextAdvance = trimmed.slice(8);
      else if (trimmed.startsWith('SPLIT:') || trimmed.startsWith('PARENT:') || trimmed.startsWith('MODE:')) continue;
      else if (trimmed === 'LOYALTY') nextLoyalty = true;
      else rest.push(trimmed);
    }
    if (order.tableId) setMode('dine');
    else setMode(noteValue(order.notes, 'MODE').toUpperCase() === 'DELIVERY' ? 'delivery' : 'pickup');
    setCovers(nextCovers);
    setCaptain(nextCaptain);
    setAddress(nextAddress);
    setLocality(nextLocality);
    setExtraInfo(nextExtra);
    setOtherLabel(nextPay);
    setAdvanceAt(nextAdvance);
    setLoyaltyNote(nextLoyalty);
    setOrderNotes(rest.join('\n'));
    setPayKind(orderFlag(order.notes, 'DUE') ? 'DUE' : 'CASH');
    setPaid(false);
    setPartAmount('');
    setDiscountInr(order.discount > 0 ? String(order.discount) : '');
  }, [pos.orders, queryOrder, table, tableId]);

  useEffect(() => {
    writeCurrentOrder({ tableId, orderId, mode });
  }, [mode, orderId, tableId]);

  useEffect(() => {
    if (!tableId || orderId) return;
    const seated = pos.tables.find((entry) => entry.id === tableId);
    if (!seated?.reservation) return;
    setName(seated.reservation.customerName);
    setMobile(seated.reservation.mobile);
    setCovers(String(seated.reservation.covers));
  }, [orderId, pos.tables, tableId]);

  const discountAmount = useMemo(() => {
    const n = Math.round(Number(discountInr.replace(/\D/g, '') || 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [discountInr]);

  const quote = useMemo(() => {
    if (!catalog || !lines.length) return null;
    try {
      return priceCart({
        lines,
        items: catalog.items,
        groups: catalog.addonGroups,
        taxBps: catalog.cafe.taxBps,
        discount: discountAmount,
      });
    } catch (err) {
      return err instanceof PriceError ? err.message : 'Check the items.';
    }
  }, [catalog, discountAmount, lines]);
  const priced = typeof quote === 'object' ? quote : null;
  const editLine = lines.find((line) => line.lineId === editLineId) ?? null;
  const sheetItem = editLine
    ? pos.items.find((entry) => entry.id === editLine.menuItemId) ?? null
    : catalog?.items.find((entry) => entry.id === itemId) ?? null;

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const code = search.trim().toUpperCase();
    return pos.items
      .filter((entry) => {
        if (!entry.isAvailable) return false;
        if (needle) {
          return (
            entry.name.toLowerCase().includes(needle) ||
            entry.description.toLowerCase().includes(needle) ||
            entry.shortcutNum === code ||
            entry.shortcutAlpha === code
          );
        }
        if (categoryId === 'favorites') return entry.isFavorite;
        return entry.categoryId === categoryId;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categoryId, pos.items, search]);

  function commitLine(incoming: Line, replaceId?: string) {
    setLines((current) => {
      const rest = replaceId ? current.filter((line) => line.lineId !== replaceId) : current;
      const key = cartLineKey(incoming);
      const same = rest.find((line) => cartLineKey(line) === key);
      if (same) {
        const next = applyLineQuantity(same.quantity, incoming.quantity);
        if (next.capped) pushToast('Quantity capped at 20');
        if (next.quantity < 1) return rest.filter((line) => line.lineId !== same.lineId);
        return rest.map((line) => (line.lineId === same.lineId ? { ...line, quantity: next.quantity } : line));
      }
      const next = applyLineQuantity(0, incoming.quantity);
      if (next.capped) pushToast('Quantity capped at 20');
      return [...rest, { ...incoming, quantity: clampLineQuantity(next.quantity || incoming.quantity) }];
    });
  }

  function addItem(menuItemId: string, quantity = 1, addonIds: string[] = [], notes = '', picked = false) {
    const menu = pos.items.find((entry) => entry.id === menuItemId);
    if (!menu?.isAvailable) return;
    if (!picked && menu.addonGroupIds.length && !addonIds.length && !notes) {
      setItemId(menu.id);
      return;
    }
    commitLine({ lineId: crypto.randomUUID(), menuItemId, quantity, addonIds, notes });
  }

  function setQty(lineId: string, quantity: number) {
    if (quantity > LINE_QTY_MAX) pushToast('Quantity capped at 20');
    setLines((current) => {
      if (quantity < 1) return current.filter((line) => line.lineId !== lineId);
      return current.map((line) => (line.lineId === lineId ? { ...line, quantity: clampLineQuantity(quantity) } : line));
    });
  }

  function applyCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const match = resolveMenuShortcut(pos.items, code);
    setShortcut('');
    shortRef.current?.focus();
    if (!match) {
      pushToast(`No item for ${code}`, 'err');
      return;
    }
    addItem(match.id);
  }

  function applyShortcut(event: FormEvent) {
    event.preventDefault();
    applyCode(shortRef.current?.value || shortcut);
  }

  function composeNotes() {
    const parts: string[] = [];
    if (covers.trim()) parts.push(`COVER:${covers.trim()}`);
    if (captain.trim()) parts.push(`CAPTAIN:${captain.trim()}`);
    if (otherLabel.trim()) parts.push(`PAY:${otherLabel.trim()}`);
    if (advanceAt.trim()) parts.push(`ADVANCE:${advanceAt.trim()}`);
    if (address.trim()) parts.push(`ADDR:${address.trim()}`);
    if (locality.trim()) parts.push(`LOCALITY:${locality.trim()}`);
    if (extraInfo.trim()) parts.push(`EXTRA:${extraInfo.trim()}`);
    if (loyaltyNote) parts.push('LOYALTY');
    parts.push(mode === 'delivery' ? 'MODE:DELIVERY' : mode === 'pickup' ? 'MODE:PICKUP' : 'MODE:DINE');
    if (orderNotes.trim()) parts.push(orderNotes.trim());
    return parts.join('\n').slice(0, 400);
  }

  function collectMethod(): PaymentMethod {
    if (payKind === 'CASH' || payKind === 'CARD' || payKind === 'UPI') return payKind;
    const label = otherLabel.trim().toLowerCase();
    if (label === 'google pay' || label === 'phonepe' || label === 'paytm' || label === 'upi' || label.includes('gpay')) return 'UPI';
    return 'OTHER';
  }

  const onlinePayReady = Boolean(pos.payments.razorpayKeyId);

  async function settle(kind: 'save' | 'print' | 'ebill' | 'kot' | 'kot-print' | 'hold' | 'comp' | 'part' | 'split') {
    const current = orderId ? pos.orders.find((entry) => entry.id === orderId) ?? null : null;
    const splitChild = Boolean(current?.notes.split(/\n/).some((line) => line.startsWith('SPLIT:')));
    if (!catalog || (!priced && !splitChild)) {
      pushToast('Add items first', 'err');
      return;
    }
    if (mode === 'dine' && !tableId) {
      pushToast('Pick a table', 'err');
      return;
    }
    if (splitChild && kind === 'split') {
      pushToast('This bill is already split.', 'err');
      return;
    }
    const partsCount = Number(splitParts);
    const take = Number(partAmount);
    if (kind === 'split') {
      if (!Number.isInteger(partsCount) || partsCount < 2 || partsCount > 8) {
        pushToast('Split into 2–8 bills.', 'err');
        return;
      }
    }
    if (kind === 'part') {
      if (!Number.isInteger(take) || take < 1) {
        pushToast('Enter an amount of at least ₹1.', 'err');
        return;
      }
    }
    const customerName = name.trim() || (table ? tableLabel(table.name) : 'Walk-in');
    const notes = [
      kind === 'hold' ? 'HOLD' : '',
      kind === 'comp' ? 'COMPLIMENTARY' : '',
      payKind === 'DUE' && kind !== 'comp' && kind !== 'hold' && kind !== 'part' && kind !== 'split' ? 'DUE' : '',
      composeNotes(),
    ].filter(Boolean).join('\n').slice(0, 400);
    const billPrintWin = kind === 'print' || kind === 'ebill' || kind === 'kot-print' ? openPrintWindow() : null;
    const kotPrintWin = kind === 'kot' ? openPrintWindow() : kind === 'kot-print' ? openPrintWindow() : null;
    setBusy(true);
    setError(null);
    try {
      const order = splitChild && current
        ? current
        : orderId
          ? await pos.updateOrder(orderId, {
            customerName,
            customerMobile: mobile,
            items: lines,
            notes,
            discount: discountAmount,
          })
          : await pos.createOrder({
            tableId: mode === 'dine' ? tableId : null,
            customerName,
            customerMobile: mobile,
            items: lines,
            notes,
            discount: discountAmount,
          });
      const kotTo = nextTicketStatus(order.status, 'kot');
      const printTo = nextTicketStatus(order.status, 'print');
      if (kind === 'kot' || kind === 'kot-print') {
        const kotOk = printTicket(order, 'kot', catalog.cafe.taxBps, pos.cafe?.name ?? 'After Dunes', kotPrintWin);
        if (kotTo) await pos.setStatus(order.id, kotTo);
        if (!kotOk) pushToast('Allow pop-ups to print the KOT.', 'err');
        else pushToast('KOT sent');
      }
      if (kind === 'print' || kind === 'ebill' || kind === 'kot-print') {
        const billOk = printTicket(order, 'bill', catalog.cafe.taxBps, pos.cafe?.name ?? 'After Dunes', billPrintWin);
        if (printTo) await pos.setStatus(order.id, printTo);
        if (!billOk) pushToast('Allow pop-ups to print the bill.', 'err');
        else if (kind === 'ebill') pushToast('eBill uses print until email is wired');
        else if (kind !== 'kot-print') pushToast('Bill printed');
        else pushToast('KOT and bill sent to print');
      }
      if (kind === 'hold') pushToast('Order held — no KOT');
      if (kind === 'comp') {
        await pos.pay(order.id, 'OTHER');
        pushToast('Complimentary');
      } else if (kind === 'part') {
        await pos.pay(order.id, collectMethod(), take);
        pushToast(take >= dueTotal(order) ? 'Paid' : `Part paid · ${formatINR(dueTotal(order) - take)} due`);
      } else if (kind === 'split') {
        const children = await pos.splitOrder(order.id, partsCount);
        navigate(`/pos/orders/new?table=${encodeURIComponent(tableId ?? '')}&mode=dine&order=${encodeURIComponent(children[0]?.id ?? '')}`);
        loadedRef.current = null;
        return;
      } else if (paid && payKind === 'UPI' && onlinePayReady && kind !== 'hold' && kind !== 'kot' && kind !== 'kot-print') {
        try {
          await collectRazorpayPayment({
            orderId: order.id,
            amountInr: dueTotal(order),
            customerName: customerName,
            customerMobile: mobile,
          });
          pushToast('Paid online');
          await pos.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Online payment failed.';
          setError(message);
          pushToast(message, 'err');
          setBusy(false);
          return;
        }
      } else if (paid && payKind !== 'DUE' && kind !== 'hold' && kind !== 'kot' && kind !== 'kot-print') {
        await pos.pay(order.id, collectMethod());
      }
      if (kind === 'kot' || kind === 'kot-print') navigate('/pos/orders');
      else navigate('/pos');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the order.';
      setError(message);
      pushToast(message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function sendSms() {
    if (!mobile.trim()) {
      pushToast('Add a mobile number first', 'err');
      setDialog('customer');
      return;
    }
    const text = `Thank you for visiting ${pos.cafe?.name ?? 'After Dunes'}.`;
    try {
      await navigator.clipboard.writeText(text);
      pushToast('Feedback SMS copied');
    } catch {
      pushToast(text);
    }
  }

  function loyalty() {
    if (!mobile.trim()) {
      setDialog('customer');
      return;
    }
    const found = pos.customers.find((entry) => entry.mobile.replace(/\D/g, '').endsWith(mobile.replace(/\D/g, '').slice(-10)));
    if (found) {
      setName(found.name);
      setLoyaltyNote(true);
      pushToast(`${found.name} · ${found.orderCount} visits · ${formatINR(found.spent)}`);
    } else {
      setLoyaltyNote(true);
      pushToast('Loyalty noted on this order');
    }
  }

  if (!catalog) return <p className="pos-page">Menu is not on this device yet. Connect once to load it.</p>;

  const liveOrder = orderId ? pos.orders.find((entry) => entry.id === orderId) ?? null : null;
  const customerDone = Boolean(normalizeMobile(mobile) && name.trim().length > 1);
  const coversDone = Boolean(covers.trim());
  const noteDone = Boolean(orderNotes.trim());
  const assignDone = Boolean(captain.trim() || pos.user?.name);
  const guestPayPref = liveOrder ? paymentPreferenceFromNotes(liveOrder.notes) : null;
  const splitChild = Boolean(liveOrder?.notes.split(/\n/).some((line) => line.startsWith('SPLIT:')));
  const captured = liveOrder ? paidTotal(liveOrder) : 0;
  const billTotal = splitChild && liveOrder ? liveOrder.total : priced?.total ?? 0;
  const remainder = Math.max(0, billTotal - captured);
  const partTake = Number(partAmount);
  const remaining = Number.isInteger(partTake) && partTake > 0 ? Math.max(0, remainder - partTake) : remainder;
  const canAct = Boolean(priced || splitChild);
  let splitShares: number[] = [];
  try {
    splitShares = !splitChild && priced ? splitAmounts(priced.total, Number(splitParts)) : [];
  } catch {
    splitShares = [];
  }

  return (
    <section className="bill">
      <header className="bill-top">
        <div className="bill-modes" role="tablist" aria-label="Order type">
          <button type="button" className={mode === 'dine' ? 'on' : ''} onClick={() => { setMode('dine'); if (name === 'Delivery' || name === 'Walk-in') setName('Walk-in'); }}>Dine In</button>
          <button type="button" className={mode === 'delivery' ? 'on' : ''} onClick={() => { setMode('delivery'); setTableId(null); if (name === 'Walk-in') setName('Delivery'); }}>Delivery</button>
          <button type="button" className={mode === 'pickup' ? 'on' : ''} onClick={() => { setMode('pickup'); setTableId(null); if (name === 'Delivery') setName('Walk-in'); }}>Pick Up</button>
        </div>
        <form className="bill-search" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span className="sr-only">Search item</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item" autoComplete="off" />
          </label>
        </form>
        <form className="bill-short" onSubmit={applyShortcut}>
          <label>
            <span className="sr-only">Short code</span>
            <input
              ref={shortRef}
              value={shortcut}
              onChange={(event) => setShortcut(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyCode(event.currentTarget.value);
                }
              }}
              placeholder="Short Code"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="sr-only">Add</button>
        </form>
        {mode === 'dine' ? (
          <label className="bill-table">
            <span className="sr-only">Table</span>
            <select value={tableId ?? ''} onChange={(event) => setTableId(event.target.value || null)}>
              <option value="">Table</option>
              {pos.tables.filter((entry) => !entry.openOrder || entry.openOrder.paymentStatus === 'PAID' || entry.id === tableId).map((entry) => (
                <option key={entry.id} value={entry.id}>{tableLabel(entry.name)} · {entry.area}</option>
              ))}
            </select>
          </label>
        ) : (
          <span className="bill-mode-tag">{mode === 'pickup' ? 'Pick Up' : 'Delivery'}</span>
        )}
      </header>

      <div className="bill-body">
        <nav className="bill-cats" aria-label="Categories">
          <button type="button" className={categoryId === 'favorites' ? 'on' : ''} onClick={() => setCategoryId('favorites')}>Favorite Items</button>
          {pos.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={categoryId === category.id ? 'on' : ''}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>

        <div className="bill-grid">
          {visibleItems.length === 0 ? (
            <p className="bill-grid-empty">{search.trim() ? 'No item matches that search.' : categoryId === 'favorites' ? 'Mark items as favorites in Menu.' : 'No items in this category.'}</p>
          ) : visibleItems.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`bill-tile ${entry.isVeg ? 'veg' : 'nveg'}`}
              onClick={() => addItem(entry.id)}
            >
              {entry.name}
              {entry.shortcutNum || entry.shortcutAlpha ? (
                <small>{[entry.shortcutNum, entry.shortcutAlpha].filter(Boolean).join(' · ')}</small>
              ) : null}
            </button>
          ))}
        </div>

        <aside className="bill-cart">
          <div className="bill-meta-wrap">
            <BillMetaBar
              tableName={table?.name ?? null}
              modeLabel={mode === 'pickup' ? 'Pick Up' : mode === 'delivery' ? 'Delivery' : 'Dine In'}
              panel={metaPanel}
              onPanel={setMetaPanel}
              customerDone={customerDone}
              coversDone={coversDone}
              noteDone={noteDone}
              assignDone={assignDone}
            />
            {metaPanel ? (
              <>
                <button type="button" className="bill-meta-backdrop" aria-label="Close panel" onClick={() => setMetaPanel(null)} />
                {metaPanel === 'customer' ? (
                  <div className="bill-meta-popover" role="dialog" aria-label="Customer details">
                    <Input label="Mobile" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
                    <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
                    <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
                    <Input label="Locality" value={locality} onChange={(event) => setLocality(event.target.value)} />
                    <Input label="Extra information" value={extraInfo} onChange={(event) => setExtraInfo(event.target.value)} />
                  </div>
                ) : null}
                {metaPanel === 'covers' ? (
                  <div className="bill-meta-popover" role="dialog" aria-label="Guest count">
                    <Input label="Number of guests" inputMode="numeric" value={covers} onChange={(event) => setCovers(event.target.value)} />
                  </div>
                ) : null}
                {metaPanel === 'note' ? (
                  <div className="bill-meta-popover" role="dialog" aria-label="Order comment">
                    <TextArea label="Order comment" rows={3} maxLength={400} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
                  </div>
                ) : null}
                {metaPanel === 'assign' ? (
                  <div className="bill-meta-popover" role="dialog" aria-label="Captain">
                    <Input label="Captain" value={captain} onChange={(event) => setCaptain(event.target.value)} placeholder={pos.user?.name ?? 'Staff'} />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          {guestPayPref && guestPayPref !== 'DESK' ? (
            <p className="bill-guest-pay">Guest chose {guestPayPref === 'UPI' ? 'UPI online' : 'card online'}{liveOrder?.paymentStatus === 'PAID' ? ' · Paid' : ''}</p>
          ) : guestPayPref === 'DESK' && liveOrder?.source === 'QR' ? (
            <p className="bill-guest-pay">Guest pays at desk</p>
          ) : null}
          {bills.length > 1 ? (
            <div className="bill-bills" role="tablist" aria-label="Open bills">
              {bills.map((bill, index) => (
                <button
                  key={bill.id}
                  type="button"
                  className={bill.id === orderId ? 'on' : ''}
                  onClick={() => {
                    loadedRef.current = null;
                    navigate(`/pos/orders/new?table=${encodeURIComponent(tableId ?? '')}&mode=dine&order=${encodeURIComponent(bill.id)}`);
                  }}
                >
                  Bill {index + 1} {formatINR(dueTotal(bill))}
                </button>
              ))}
            </div>
          ) : null}
          <div className="bill-cart-scroll">
            {lines.length === 0 ? (
              <p className="bill-empty">No Item Selected<br /><span>Please Select Item from Left Menu Item</span></p>
            ) : (
              <ul className="bill-lines">
                {lines.map((line, index) => {
                  const row = priced?.lines[index];
                  return (
                    <li key={line.lineId}>
                      <button type="button" className="bill-x" onClick={() => setLines((current) => current.filter((entry) => entry.lineId !== line.lineId))} aria-label="Remove item">×</button>
                      <button type="button" className="bill-line-name" onClick={() => setEditLineId(line.lineId)}>
                        <strong>{row?.name ?? pos.items.find((entry) => entry.id === line.menuItemId)?.name}</strong>
                        {row?.addons.length ? <i>{row.addons.map((addon) => addon.name).join(', ')}</i> : null}
                        {line.notes ? <i className="bill-note">{line.notes}</i> : null}
                      </button>
                      <span className="bill-qty">
                        <button type="button" onClick={() => setQty(line.lineId, line.quantity - 1)} aria-label="Decrease quantity">−</button>
                        <input
                          aria-label="Quantity"
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/\D/g, '');
                            if (raw === '') return;
                            setQty(line.lineId, Number(raw));
                          }}
                        />
                        <button type="button" onClick={() => setQty(line.lineId, line.quantity + 1)} aria-label="Increase quantity">+</button>
                      </span>
                      <b>{splitChild && liveOrder?.items[index] ? formatINR(liveOrder.items[index].total) : row ? formatINR(row.total) : '—'}</b>
                    </li>
                  );
                })}
              </ul>
            )}
            {typeof quote === 'string' ? <p className="field-error">{quote}</p> : null}
            {error ? <p className="field-error" role="alert">{error}</p> : null}
          </div>

          <footer className="bill-foot">
            <div className="bill-foot-top">
              <div className="bill-offers">
                <button type="button" className={discountAmount > 0 ? 'is-on' : undefined} onClick={() => setDialog('discount')}>
                  Discount{discountAmount > 0 ? ` −${formatINR(discountAmount)}` : ''}
                </button>
                <button type="button" onClick={() => setDialog('split')}>Split</button>
                <button type="button" onClick={() => void settle('comp')} disabled={!canAct || busy}>Complimentary</button>
                <button type="button" onClick={() => setDialog('advance')}>Advance Order</button>
              </div>
              <div className="bill-total">
                <span>{captured ? 'Due' : 'Total'}</span>
                <strong>{formatINR(captured ? remainder : billTotal)}</strong>
              </div>
            </div>
            <div className="bill-pay" role="group" aria-label="Payment">
              {(['CASH', 'CARD', 'UPI', 'DUE', 'OTHER'] as PayKind[]).map((kind) => (
                <label key={kind}>
                  <input
                    type="radio"
                    name="pay"
                    checked={payKind === kind}
                    onChange={() => {
                      setPayKind(kind);
                      if (kind === 'DUE') setPaid(false);
                      if (kind === 'OTHER') setDialog('other');
                    }}
                  />
                  {kind === 'CASH' ? 'Cash' : kind === 'CARD' ? 'Card' : kind === 'UPI' ? (onlinePayReady ? 'UPI online' : 'UPI') : kind === 'DUE' ? 'Due' : 'Other'}
                </label>
              ))}
              <button type="button" onClick={() => setDialog('part')}>Part</button>
            </div>
            {paid && payKind === 'CASH' ? (
              <div className="bill-cash">
                <Input
                  label="Cash received"
                  inputMode="numeric"
                  value={cashTender}
                  onChange={(event) => setCashTender(event.target.value.replace(/\D/g, ''))}
                  placeholder={String(Math.ceil(remainder || billTotal))}
                />
                {Number(cashTender) >= (remainder || billTotal) ? (
                  <p className="fine">Change {formatINR(Number(cashTender) - (remainder || billTotal))}</p>
                ) : null}
              </div>
            ) : null}
            <div className="bill-flags">
              <label><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} /> It's Paid</label>
              <label>
                <input
                  type="checkbox"
                  checked={loyaltyNote}
                  onChange={(event) => {
                    if (event.target.checked) loyalty();
                    else setLoyaltyNote(false);
                  }}
                />
                Loyalty
              </label>
              <button type="button" onClick={() => void sendSms()}>Send Feedback SMS</button>
            </div>
            <div className="bill-acts">
              <button type="button" className="act" disabled={!canAct || busy} onClick={() => void settle('save')}>Save</button>
              <button type="button" className="act" disabled={!canAct || busy} onClick={() => void settle('print')}>Save & Print</button>
              <button type="button" className="act" disabled={!canAct || busy} onClick={() => void settle('ebill')}>Save & eBill</button>
              <button type="button" className="act kot" disabled={!canAct || busy} onClick={() => void settle('kot')}>KOT</button>
              <button type="button" className="act kot" disabled={!canAct || busy} onClick={() => void settle('kot-print')}>KOT & Print</button>
              <button type="button" className="act ghost" disabled={!canAct || busy} onClick={() => void settle('hold')}>Hold</button>
            </div>
            {splitChild && liveOrder ? (
              <p className="bill-tax">Split share · Subtotal {formatINR(liveOrder.subtotal)} · Tax {taxLabel(catalog.cafe.taxBps)} {formatINR(liveOrder.tax)}</p>
            ) : priced ? (
              <p className="bill-tax">
                Subtotal {formatINR(priced.subtotal)}
                {priced.discount > 0 ? (
                  <>
                    {' · '}
                    <span className="bill-tax-discount">Discount −{formatINR(priced.discount)}</span>
                  </>
                ) : null}
                {' · '}
                Tax {taxLabel(catalog.cafe.taxBps)} {formatINR(priced.tax)}
              </p>
            ) : null}
          </footer>
        </aside>
      </div>

      {sheetItem && catalog ? (
        <ModifierDialog
          key={editLine?.lineId ?? sheetItem.id}
          item={sheetItem}
          groups={catalog.addonGroups}
          taxBps={catalog.cafe.taxBps}
          initial={editLine
            ? { quantity: editLine.quantity, addonIds: editLine.addonIds, notes: editLine.notes }
            : undefined}
          onClose={() => {
            setItemId(null);
            setEditLineId(null);
          }}
          onSave={(value) => {
            if (editLine) {
              commitLine({ ...editLine, quantity: value.quantity, addonIds: value.addonIds, notes: value.notes }, editLine.lineId);
              setEditLineId(null);
            } else {
              addItem(sheetItem.id, value.quantity, value.addonIds, value.notes, true);
              setItemId(null);
            }
          }}
        />
      ) : null}

      <Modal open={dialog === 'covers'} title="Covers" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <Input label="Number of guests" inputMode="numeric" value={covers} onChange={(event) => setCovers(event.target.value)} />
          <Button onClick={() => setDialog(null)}>Save</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'customer'} title="Customer" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="Mobile" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
          {mode === 'delivery' ? (
            <TextArea label="Delivery address" rows={3} maxLength={200} value={address} onChange={(event) => setAddress(event.target.value)} />
          ) : null}
          {pos.customers.filter((customer) => {
            const needle = mobile.replace(/\D/g, '');
            const typed = name.trim().toLowerCase();
            if (needle.length >= 3) return customer.mobile.includes(needle) || customer.mobile.endsWith(needle);
            if (typed.length >= 2) return customer.name.toLowerCase().includes(typed);
            return false;
          }).slice(0, 6).map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="held-row"
              onClick={() => {
                setName(customer.name);
                setMobile(customer.mobile);
                setLoyaltyNote(true);
              }}
            >
              {customer.name} · {customer.orderCount} visits · {formatINR(customer.spent)}
            </button>
          ))}
          <Button onClick={() => setDialog(null)}>Save</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'assign'} title="Captain" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <Input label="Assigned to" value={captain} onChange={(event) => setCaptain(event.target.value)} placeholder={pos.user?.name ?? 'Staff'} />
          <Button onClick={() => { if (!captain.trim() && pos.user?.name) setCaptain(pos.user.name); setDialog(null); }}>Save</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'note'} title="Order Wise Comments" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <TextArea label="Comment" rows={4} maxLength={400} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
          <Button onClick={() => setDialog(null)}>Save</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'discount'} title="Bill discount" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <Input
            label="Discount (₹ off subtotal)"
            inputMode="numeric"
            value={discountInr}
            onChange={(event) => setDiscountInr(event.target.value.replace(/\D/g, ''))}
            placeholder="0"
          />
          {priced ? (
            <p className="fine">
              New total {formatINR(priced.total)}
              {priced.discount > 0 ? ` after ${formatINR(priced.discount)} off` : ''}
            </p>
          ) : null}
          <div className="row-actions">
            <Button variant="ghost" onClick={() => { setDiscountInr(''); setDialog(null); }}>Clear</Button>
            <Button onClick={() => setDialog(null)}>Apply</Button>
          </div>
        </div>
      </Modal>
      <Modal open={dialog === 'split'} title="Split" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <Input label="Equal parts" inputMode="numeric" value={splitParts} onChange={(event) => setSplitParts(event.target.value)} />
          <p className="fine">
            {captured > 0
              ? 'Split before taking part payment.'
              : splitShares.length
                ? splitShares.map((share, index) => `Bill ${index + 1} ${formatINR(share)}`).join(' · ')
                : 'Add items and split into 2–8 bills.'}
          </p>
          <Button disabled={!priced || busy || splitShares.length < 2 || captured > 0} onClick={() => { setDialog(null); void settle('split'); }}>Split bills</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'part'} title="Part Payment" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <p className="fine">Bill {formatINR(billTotal)}{captured ? ` · Paid ${formatINR(captured)}` : ''} · Due {formatINR(remainder)}</p>
          <Input label="Captured amount" inputMode="numeric" value={partAmount} onChange={(event) => setPartAmount(event.target.value)} />
          <p className="fine">Remaining {formatINR(remaining)}</p>
          <Button disabled={!canAct || busy} onClick={() => { setDialog(null); void settle('part'); }}>Take part payment</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'other'} title="Other Payment Type" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <label>
            Other Payment Type
            <select value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)}>
              <option value="">Choose</option>
              <option value="Google Pay">Google Pay</option>
              <option value="PhonePe">PhonePe</option>
              <option value="Paytm">Paytm</option>
              <option value="UPI">UPI</option>
            </select>
          </label>
          <Button onClick={() => setDialog(null)}>Yes</Button>
        </div>
      </Modal>
      <Modal open={dialog === 'advance'} title="Advance Order" onClose={() => setDialog(null)}>
        <div className="tv-form">
          <Input label="Date and time" type="datetime-local" value={advanceAt} onChange={(event) => setAdvanceAt(event.target.value)} />
          <Button onClick={() => setDialog(null)}>Save</Button>
        </div>
      </Modal>
    </section>
  );
}
