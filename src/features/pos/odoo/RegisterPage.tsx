import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { canTransition, formatOdooINR, priceCart, type CartLineInput } from '../../../../shared/domain';
import { pushToast } from '../../../components/Toast';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import { ModifierDialog } from '../ModifierDialog';
import { ComboApplyDialog, packsForCombo, type ComboPack } from './ComboApplyDialog';

type Mode = 'qty' | 'disc' | 'price';
type PosTab = 'all' | 'food' | 'drinks';

const ACCENT_BY_NAME: Record<string, string> = {
  'Bacon Burger': '#fd7e14',
  'Cheese Burger': '#e83e8c',
  'Pizza Margherita': '#e83e8c',
  'Pizza Vegetarian': '#e83e8c',
  'Pasta 4 Formaggi': '#ffc107',
  Funghi: '#e83e8c',
  'Pasta Bolognese': '#e83e8c',
  'Chicken Sandwich': '#fd7e14',
  'Tuna Sandwich': '#e83e8c',
  Baguette: '#e83e8c',
  'Club Sandwich': '#fd7e14',
  Maki: '#e83e8c',
  'Sashimi Boat': '#fd7e14',
  Temaki: '#fd7e14',
  'Salmon and Avocado': '#e83e8c',
  'Coca-Cola': '#20c997',
  Spa: '#0d6efd',
  'Minute Maid': '#20c997',
  Espresso: '#20c997',
  'Green Tea': '#0dcaf0',
  Milkshake: '#20c997',
  'Lipton Ice Tea': '#20c997',
  'Schweppes Indian Tonic': '#20c997',
  Fanta: '#fd7e14',
  'Burger Menu': '#e83e8c',
  'Salmon Nigiri': '#fd7e14',
};

function productAccent(name: string, isDrink: boolean, index: number) {
  if (ACCENT_BY_NAME[name]) return ACCENT_BY_NAME[name];
  if (/combo/i.test(name)) return index % 2 ? '#6f42c1' : '#e83e8c';
  if (isDrink) {
    const drinks = ['#20c997', '#0d6efd', '#20c997', '#0dcaf0', '#20c997', '#fd7e14'];
    return drinks[index % drinks.length];
  }
  const food = ['#fd7e14', '#e83e8c', '#e83e8c', '#ffc107', '#e83e8c'];
  return food[index % food.length];
}

function isDrinkCategory(name: string) {
  return /drink|beverage|coffee|tea/i.test(name);
}

const COMBO_ITEM_IDS = new Set(['item_burger_combo']);
const CART_WIDTH_KEY = 'habsos-register-cart-width';

function readCartWidth() {
  const saved = Number(localStorage.getItem(CART_WIDTH_KEY));
  if (Number.isFinite(saved) && saved >= 300 && saved <= 960) return saved;
  if (typeof window !== 'undefined' && window.innerWidth >= 1680) return 520;
  return 380;
}

function lineAccent(name: string, index: number) {
  return productAccent(name, /cola|water|tea|maid|fanta|espresso|shake|schweppe|juice|lemonade|sprite|drink/i.test(name), index);
}

export function RegisterPage() {
  useTitle('Register');
  const navigate = useNavigate();
  const registerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const [cartWidth, setCartWidth] = useState(readCartWidth);
  const [dragging, setDragging] = useState(false);
  const [params] = useSearchParams();
  const { categories, items, addonGroups, cafe, createOrder, updateOrder, tables, orders, setStatus } = usePos();
  const tableId = params.get('table');
  const orderId = params.get('order');
  const searchQuery = (params.get('q') ?? '').trim().toLowerCase();
  const tableName = params.get('name') || tables.find((t) => t.id === tableId)?.name || params.get('table') || '';

  const existing = orderId ? orders.find((o) => o.id === orderId) : null;
  const [lines, setLines] = useState<CartLineInput[]>(() =>
    existing
      ? existing.items
          .map((item) => ({
            menuItemId: item.menuItemId ?? '',
            quantity: item.quantity,
            addonIds: item.addons.map((a) => a.addonId).filter((id): id is string => Boolean(id)),
            notes: item.notes,
          }))
          .filter((l) => l.menuItemId)
      : [],
  );
  const [tab, setTab] = useState<PosTab>('all');
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('qty');
  const [buffer, setBuffer] = useState('');
  const [busy, setBusy] = useState(false);
  const [modifierItemId, setModifierItemId] = useState<string | null>(null);
  const [comboItemId, setComboItemId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  const taxBps = cafe?.taxBps ?? 500;
  const quote = useMemo(() => {
    try {
      return priceCart({ lines, items, groups: addonGroups, taxBps, discount: 0 });
    } catch {
      return null;
    }
  }, [items, addonGroups, lines, taxBps]);

  const catalog = useMemo(() => {
    return items
      .filter((item) => item.isAvailable)
      .map((item) => {
        const cat = categories.find((c) => c.id === item.categoryId);
        const drink = isDrinkCategory(cat?.name ?? '');
        return { item, drink, sort: item.sortOrder ?? 999 };
      })
      .sort((a, b) => a.sort - b.sort);
  }, [items, categories]);

  const visible = useMemo(() => {
    let rows = catalog;
    if (tab === 'food') rows = catalog.filter((row) => !row.drink);
    else if (tab === 'drinks') rows = catalog.filter((row) => row.drink);
    if (searchQuery) rows = rows.filter((row) => row.item.name.toLowerCase().includes(searchQuery));
    return rows;
  }, [catalog, tab, searchQuery]);

  const qtyByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) map.set(line.menuItemId, (map.get(line.menuItemId) ?? 0) + line.quantity);
    return map;
  }, [lines]);

  function selectTab(next: PosTab) {
    setTab((prev) => (prev === next && next !== 'all' ? 'all' : next));
  }

  function addProduct(menuItemId: string) {
    const item = items.find((i) => i.id === menuItemId);
    if (!item) return;
    if (/combo/i.test(item.name) || COMBO_ITEM_IDS.has(item.id)) {
      setComboItemId(menuItemId);
      return;
    }
    if (item.addonGroupIds.length) {
      setModifierItemId(menuItemId);
      return;
    }
    setBuffer('');
    setMode('qty');
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.menuItemId === menuItemId && !l.addonIds.length && !l.notes);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        setSelected(idx);
        return next;
      }
      setSelected(prev.length);
      return [...prev, { menuItemId, quantity: 1, addonIds: [], notes: '' }];
    });
  }

  function applyComboPack(pack: ComboPack) {
    if (!comboItemId) return;
    const item = items.find((i) => i.id === comboItemId);
    const allowed = new Set(
      addonGroups
        .filter((group) => item?.addonGroupIds.includes(group.id))
        .flatMap((group) => group.addons.map((addon) => addon.id)),
    );
    const addonIds = pack.addonIds.filter((id) => allowed.has(id));
    const qty = buffer && Number(buffer) > 0 ? Math.min(999, Math.round(Number(buffer))) : 1;
    const note = pack.details.join('\n');
    setLines((prev) => {
      setSelected(prev.length);
      return [...prev, { menuItemId: comboItemId, quantity: qty, addonIds, notes: note }];
    });
    setBuffer('');
    setMode('qty');
    setComboItemId(null);
  }

  function setSelectedQty(raw: string) {
    if (!lines[selected]) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    const qty = Math.min(999, Math.max(1, Math.round(value)));
    setLines((prev) => {
      if (!prev[selected]) return prev;
      const next = [...prev];
      next[selected] = { ...next[selected], quantity: qty };
      return next;
    });
  }

  function deleteSelectedLine() {
    if (!lines.length || selected < 0 || selected >= lines.length) return;
    setLines((prev) => prev.filter((_, index) => index !== selected));
    setSelected((prev) => Math.max(0, Math.min(prev, lines.length - 2)));
    setBuffer('');
  }

  function tapKey(key: string) {
    if (key === 'back') {
      deleteSelectedLine();
      return;
    }
    if (key === '+/-' || key === '.') return;
    if (!lines[selected]) return;
    if (mode !== 'qty') setMode('qty');
    const next = `${buffer}${key}`.replace(/^0+(?=\d)/, '').slice(0, 4);
    if (!next) return;
    setBuffer(next);
    setSelectedQty(next);
  }

  async function persist(goPayment: boolean) {
    if (!quote || !lines.length) {
      pushToast('Add products first.', 'err');
      return;
    }
    setBusy(true);
    try {
      let id = orderId;
      if (existing && id) {
        await updateOrder(id, {
          customerName: existing.customerName || 'Guest',
          customerMobile: existing.customerMobile || '',
          items: lines,
          notes: existing.notes,
        });
      } else {
        const order = await createOrder({
          tableId: tableId && tables.some((t) => t.id === tableId) ? tableId : null,
          customerName: 'Guest',
          customerMobile: '',
          items: lines,
          notes: tableName ? `MODE:dine` : 'MODE:takeout',
        });
        id = order.id;
      }
      if (goPayment) navigate(`/pos/app/payment?order=${id}`);
      else {
        pushToast('Order sent');
        navigate('/pos/app/tables');
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not save order.', 'err');
    } finally {
      setBusy(false);
    }
  }

  function releaseTable() {
    setLines([]);
    pushToast('Table released');
    navigate('/pos/app/tables');
  }

  const foodCount = lines.filter((l) => {
    const item = items.find((i) => i.id === l.menuItemId);
    const cat = categories.find((c) => c.id === item?.categoryId);
    return cat && !isDrinkCategory(cat.name);
  }).reduce((s, l) => s + l.quantity, 0);
  const drinkCount = lines.reduce((s, l) => s + l.quantity, 0) - foodCount;
  const empty = !lines.length;

  function onSplitDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startW: cartWidth };
    setDragging(true);
  }

  function onSplitMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !registerRef.current) return;
    const bounds = registerRef.current.getBoundingClientRect();
    const next = dragRef.current.startW + (event.clientX - dragRef.current.startX);
    const max = Math.max(320, bounds.width - 280);
    setCartWidth(Math.min(max, Math.max(300, next)));
  }

  function onSplitUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    setCartWidth((width) => {
      localStorage.setItem(CART_WIDTH_KEY, String(Math.round(width)));
      return width;
    });
  }

  return (
    <div
      className={`o-register${dragging ? ' is-dragging' : ''}`}
      ref={registerRef}
      style={{ gridTemplateColumns: `${cartWidth}px 12px minmax(0, 1fr)` }}
    >
      <aside className="o-cart">
        <div className={`o-cart__lines${empty ? ' o-cart__lines--empty' : ''}`}>
          {empty ? (
            <div className="o-cart__empty">
              {tableName || tableId ? (
                <button type="button" className="o-cart__release" onClick={releaseTable}>
                  Release table
                </button>
              ) : (
                <p>Tap products to start an order</p>
              )}
            </div>
          ) : (
            quote?.lines.map((line, index) => (
              <div
                key={`${line.menuItemId}-${index}`}
                className={`o-cart-line${index === selected ? ' is-selected' : ''}`}
                style={{ ['--o-line-accent' as string]: lineAccent(line.name, index) }}
                onClick={() => {
                  setSelected(index);
                  setBuffer('');
                }}
                onKeyDown={() => {
                  setSelected(index);
                  setBuffer('');
                }}
                role="button"
                tabIndex={0}
              >
                <span className="o-cart-line__bar" aria-hidden />
                <div className="o-cart-line__body">
                  <div className="o-cart-line__row">
                    <div className="o-cart-line__name">
                      {line.quantity} {line.name}
                    </div>
                    <div>{formatOdooINR(line.total)}</div>
                  </div>
                  {line.notes || line.addons.length ? (
                    <div className="o-cart-line__meta">
                      {line.notes
                        ? line.notes.split('\n').filter(Boolean).map((note) => (
                            <div key={note}>- {note.replace(/^- /, '')}</div>
                          ))
                        : line.addons.map((a) => (
                            <div key={a.addonId}>- {a.name}</div>
                          ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {!empty ? (
          <div className="o-cart__total">
            <span>Total</span>
            <strong>{formatOdooINR(quote?.total ?? 0)}</strong>
          </div>
        ) : null}

        <div className="o-cart__pad">
          {!empty && quote?.lines[selected] ? (
            <div className="o-cart__apply-row">
              <span className="o-cart__apply-label">
                {quote.lines[selected].quantity} {quote.lines[selected].name}
              </span>
              <button
                type="button"
                className="o-cart__apply"
                onClick={() => {
                  if (buffer) setSelectedQty(buffer);
                  setBuffer('');
                }}
              >
                Apply
              </button>
            </div>
          ) : null}

          <div className="o-cart__tools">
            <button type="button" className="o-cart__tool">Cust…</button>
            <button type="button" className="o-cart__tool">Note</button>
            <button type="button" className="o-cart__tool is-on">Din…</button>
            <button type="button" className="o-cart__tool" aria-label="Transfer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 3v12M8 7l4-4 4 4M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="o-cart__tool">Course</button>
            <button type="button" className="o-cart__tool" onClick={() => setActionsOpen(true)} aria-label="More">⋮</button>
          </div>

          {!empty ? (
            <div className="o-numpad">
              {(['1', '2', '3', 'qty', '4', '5', '6', 'disc', '7', '8', '9', 'price', '+/-', '0', '.', 'back'] as const).map((key) => {
                if (key === 'qty' || key === 'disc' || key === 'price') {
                  const m = key === 'qty' ? 'qty' : key === 'disc' ? 'disc' : 'price';
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`o-numpad__key${mode === m ? ' is-mode' : ''}`}
                      onClick={() => {
                        setMode(m);
                        setBuffer('');
                      }}
                    >
                      {key === 'qty' ? 'Qty' : key === 'disc' ? '%' : 'Price'}
                    </button>
                  );
                }
                const className =
                  key === 'back'
                    ? 'o-numpad__key o-numpad__back'
                    : key === '+/-'
                      ? 'o-numpad__key o-numpad__sign'
                      : key === '.'
                        ? 'o-numpad__key o-numpad__dot'
                        : 'o-numpad__key';
                return (
                  <button
                    key={key}
                    type="button"
                    className={className}
                    aria-label={key === 'back' ? 'Delete item' : undefined}
                    onClick={() => tapKey(key === 'back' ? 'back' : key === '+/-' ? '-' : key)}
                  >
                    {key === 'back' ? (
                      <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden>
                        <path d="M10 2h15a2 2 0 012 2v12a2 2 0 01-2 2H10L2 10l8-8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        <path d="M13 7l6 6M19 7l-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    ) : (
                      key
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {!empty ? (
          <div className="o-cart__footer">
            <button type="button" className="o-cart__send" disabled={busy} onClick={() => void persist(false)}>
              <span>Send</span>
              <span className="o-cart__send-meta">
                <span className="o-cart__send-group">
                  Food <em>{foodCount}</em>
                </span>
                <span className="o-cart__send-group">
                  Drinks <em>{drinkCount}</em>
                </span>
              </span>
            </button>
            <button type="button" className="o-cart__pay" disabled={busy} onClick={() => void persist(true)}>
              Payment
            </button>
          </div>
        ) : null}
      </aside>

      <div
        className={`o-register__split${dragging ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize order and products"
        aria-valuenow={Math.round(cartWidth)}
        onPointerDown={onSplitDown}
        onPointerMove={onSplitMove}
        onPointerUp={onSplitUp}
        onPointerCancel={onSplitUp}
      />

      <section className="o-products">
        <div className="o-cats">
          <button
            type="button"
            className={`o-cat o-cat--food${tab === 'food' ? ' is-active' : ''}${tab === 'all' ? ' is-shown' : ''}`}
            onClick={() => selectTab('food')}
          >
            Food
          </button>
          <button
            type="button"
            className={`o-cat o-cat--drinks${tab === 'drinks' ? ' is-active' : ''}${tab === 'all' ? ' is-shown' : ''}`}
            onClick={() => selectTab('drinks')}
          >
            Drinks
          </button>
        </div>
        <div className="o-grid">
          {visible.map(({ item, drink }, index) => (
            <button
              key={item.id}
              type="button"
              className="o-product"
              style={{ borderBottomColor: productAccent(item.name, drink, index) }}
              onClick={() => addProduct(item.id)}
            >
              <div className="o-product__name">{item.name}</div>
              {qtyByItem.get(item.id) ? <span className="o-product__qty">{qtyByItem.get(item.id)}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {comboItemId && items.find((i) => i.id === comboItemId) ? (
        <ComboApplyDialog
          packs={packsForCombo(
            comboItemId,
            items.find((i) => i.id === comboItemId)!.name,
            items.find((i) => i.id === comboItemId)!.price,
          )}
          onClose={() => setComboItemId(null)}
          onApply={applyComboPack}
        />
      ) : null}

      {modifierItemId && items.find((i) => i.id === modifierItemId) ? (
        <ModifierDialog
          item={items.find((i) => i.id === modifierItemId)!}
          groups={addonGroups}
          taxBps={taxBps}
          onClose={() => setModifierItemId(null)}
          onSave={({ quantity, addonIds, notes }) => {
            setLines((prev) => [...prev, { menuItemId: modifierItemId, quantity, addonIds, notes }]);
            setSelected(lines.length);
            setBuffer('');
            setMode('qty');
            setModifierItemId(null);
          }}
        />
      ) : null}

      {actionsOpen ? (
        <div className="o-modal-backdrop" onClick={() => setActionsOpen(false)} role="presentation">
          <div className="o-modal" style={{ width: 'min(520px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="o-modal__head">
              <span>Actions</span>
              <button type="button" className="o-icon-btn" onClick={() => setActionsOpen(false)}>×</button>
            </div>
            <div className="o-modal__body">
              <div className="o-actions-grid">
                {['Customer Note', 'Bill', 'Guests', 'Split', 'Transfer / Merge', 'Transfer Course', 'Pricelist'].map((label) => (
                  <button key={label} type="button" className="o-action" onClick={() => { pushToast(`${label} coming next`); setActionsOpen(false); }}>
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="o-action o-action--danger"
                  onClick={() => {
                    void (async () => {
                      setActionsOpen(false);
                      if (existing && orderId) {
                        if (existing.paymentStatus === 'PAID') {
                          pushToast('Paid orders cannot be cancelled.', 'err');
                          return;
                        }
                        if (!canTransition(existing.status, 'CANCELLED')) {
                          pushToast(`Cannot cancel this order from ${existing.status}.`, 'err');
                          return;
                        }
                        if (!window.confirm('Cancel this order?')) return;
                        try {
                          await setStatus(orderId, 'CANCELLED');
                          pushToast('Order cancelled');
                          setLines([]);
                          navigate('/pos/app/tables');
                        } catch (err) {
                          pushToast(err instanceof Error ? err.message : 'Could not cancel order.', 'err');
                        }
                        return;
                      }
                      setLines([]);
                      pushToast('Order cleared');
                    })();
                  }}
                >
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
