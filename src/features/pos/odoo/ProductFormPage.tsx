import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { taxLabel, type MenuItem, type ProductSheet } from '../../../../shared/domain';
import { INGREDIENT_IDS, INGREDIENT_LABELS, type IngredientId } from '../../../../shared/menuDisplay';
import { api } from '../../../lib/api';
import { fitProductImage } from '../../../lib/fitProductImage';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';

type Tab = 'general' | 'attributes' | 'sales' | 'pos' | 'inventory';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General Information' },
  { id: 'attributes', label: 'Attributes & Variants' },
  { id: 'sales', label: 'Sales' },
  { id: 'pos', label: 'Point of Sale' },
  { id: 'inventory', label: 'Inventory' },
];

const BLANK_SHEET: ProductSheet = {
  productType: 'goods',
  trackInventory: false,
  sales: true,
  purchase: true,
  pos: true,
  salesTax: '',
  cost: '0.00',
  purchaseTax: '',
  reference: '',
  barcode: '',
  tags: '',
};

function moneyText(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(value: string) {
  const next = Number(value.replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(next) || next < 0 || next > 100000) return null;
  return Math.round(next);
}

function formatMoneyInput(value: string) {
  const next = Number(value.replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(next) || next < 0) return value;
  return next.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortcutsFromReference(value: string) {
  const clean = value.trim().toUpperCase().replace(/[\s./_-]+/g, '');
  if (!clean) return { shortcutNum: null as string | null, shortcutAlpha: null as string | null };
  if (/^\d{1,4}$/.test(clean)) return { shortcutNum: clean, shortcutAlpha: null };
  if (/^[A-Z]{1,8}$/.test(clean)) return { shortcutNum: null, shortcutAlpha: clean };
  return null;
}

function vegFromTags(tags: string, current: boolean) {
  const text = tags.trim().toLowerCase();
  if (!text) return current;
  if (/non[-\s]?veg/.test(text)) return false;
  if (/\bveg\b/.test(text)) return true;
  return current;
}

function ProductPhoto({ src }: { src: string }) {
  const [fitted, setFitted] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setFitted(null);
    fitProductImage(src).then((url) => {
      if (live) setFitted(url);
    });
    return () => {
      live = false;
    };
  }, [src]);
  return <img src={fitted ?? src} alt="" />;
}

async function uploadMenuPhoto(file: File) {
  const mime = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/jpeg'
    ? file.type
    : 'image/jpeg';
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
  const result = await api<{ url: string }>('/api/media/upload', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentBase64: dataUrl.replace(/^data:[^;]+;base64,/, ''), mime }),
  });
  return result.url;
}

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pos = usePos();
  const isNew = id === 'new';
  const [held, setHeld] = useState<MenuItem | null>(null);
  const live = pos.items.find((entry) => entry.id === id) ?? null;
  const item = live ?? (held && held.id === id ? held : null);
  useTitle(isNew ? 'New product' : item?.name ?? 'Product');

  const ordered = pos.items.filter((entry) => entry.isAvailable).slice().sort((a, b) => a.name.localeCompare(b.name));
  const index = item ? ordered.findIndex((entry) => entry.id === item.id) : -1;

  const [tab, setTab] = useState<Tab>('general');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('1.00');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ProductSheet>(BLANK_SHEET);
  const [ingredients, setIngredients] = useState<IngredientId[]>([]);
  const [saving, setSaving] = useState(false);

  const tax = taxLabel(pos.cafe?.taxBps ?? 500);

  useEffect(() => {
    if (isNew) {
      setName('');
      setPrice('1.00');
      setNotes('');
      setFavorite(false);
      setCategoryId('');
      setImageUrl(null);
      setSheet({ ...BLANK_SHEET });
      setIngredients([]);
      setTab('general');
      setHeld(null);
      return;
    }
    if (!item) return;
    const stored = item.sheet ?? BLANK_SHEET;
    setName(item.name);
    setPrice(moneyText(item.price));
    setNotes(item.description);
    setFavorite(item.isFavorite);
    setCategoryId(item.categoryId);
    setImageUrl(item.imageUrl);
    setSheet({
      ...BLANK_SHEET,
      ...stored,
      cost: stored.cost || '0.00',
      reference: stored.reference || item.shortcutAlpha || item.shortcutNum || '',
      tags: stored.tags || (item.isVeg ? 'Veg' : ''),
    });
    setIngredients(item.ingredients.filter((id): id is IngredientId => (INGREDIENT_IDS as readonly string[]).includes(id)));
    setTab('general');
    // Reset the sheet only when a different product is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, item?.id]);

  async function persist(patch: Partial<MenuItem>) {
    if (!item) return;
    const next = { ...item, sheet, categoryId: categoryId || item.categoryId, imageUrl, ...patch };
    setHeld(next);
    await pos.saveItem(next);
  }

  async function createFromDraft(nextName: string) {
    const clean = nextName.trim();
    if (!clean || item || saving) return;
    const category = categoryId || pos.categories[0]?.id;
    if (!category) return;
    const amount = parseMoney(price) ?? 1;
    const codes = shortcutsFromReference(sheet.reference);
    setSaving(true);
    try {
      const created = await pos.createMenuItem({
        categoryId: category,
        name: clean,
        description: notes,
        price: amount,
        imageUrl,
        isVeg: vegFromTags(sheet.tags, true),
        isFavorite: favorite,
        shortcutNum: codes?.shortcutNum,
        shortcutAlpha: codes?.shortcutAlpha,
        ingredients,
        sheet,
      });
      setHeld(created);
      navigate(`/pos/backend/products/${created.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  function updateSheet(patch: Partial<ProductSheet>, extra?: Partial<MenuItem>) {
    const next = { ...sheet, ...patch };
    setSheet(next);
    if (!item) return;
    const codes = patch.reference !== undefined ? shortcutsFromReference(next.reference) : null;
    void persist({
      sheet: next,
      isVeg: vegFromTags(next.tags, item.isVeg),
      ...(codes ? codes : {}),
      ...extra,
    });
  }

  function toggleIngredient(id: IngredientId) {
    const next = ingredients.includes(id)
      ? ingredients.filter((entry) => entry !== id)
      : [...ingredients, id].slice(0, 8);
    setIngredients(next);
    if (item) void persist({ ingredients: next });
  }

  function IngredientPicker() {
    return (
      <div className="o-ings" role="group" aria-label="Ingredients">
        {INGREDIENT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={ingredients.includes(id) ? 'is-on' : ''}
            aria-pressed={ingredients.includes(id)}
            onClick={() => toggleIngredient(id)}
          >
            {INGREDIENT_LABELS[id]}
          </button>
        ))}
      </div>
    );
  }

  if (!isNew && !item) {
    return (
      <div className="o-prod">
        <p className="o-prod__missing">This product is not on the menu.</p>
        <button type="button" className="o-btn" onClick={() => navigate('/pos/backend/products')}>Back to products</button>
      </div>
    );
  }

  const taxOptions = [tax, sheet.salesTax, sheet.purchaseTax].filter((value, i, list) => value && list.indexOf(value) === i);

  return (
    <div className="o-prod">
      <div className="o-prod__top">
        <nav className="o-prod__crumb" aria-label="Breadcrumb">
          <Link to="/pos/backend/products">Products</Link>
          <span>/</span>
          <strong>{isNew ? 'New' : (name || item?.name)}</strong>
        </nav>
        <button type="button" className="o-prod__doc" disabled>
          <span aria-hidden>▤</span> Documents <em>0</em>
        </button>
        <div className="o-prod__pager">
          {isNew ? null : (
            <>
              <span>{index >= 0 ? `${index + 1} / ${ordered.length}` : ''}</span>
              <button
                type="button"
                aria-label="Previous product"
                disabled={index <= 0}
                onClick={() => index > 0 && navigate(`/pos/backend/products/${ordered[index - 1].id}`)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next product"
                disabled={index < 0 || index >= ordered.length - 1}
                onClick={() => index >= 0 && index < ordered.length - 1 && navigate(`/pos/backend/products/${ordered[index + 1].id}`)}
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>

      <div className="o-prod__sheet">
        <section className="o-prod__main">
          <header className="o-prod__head">
            <div className="o-prod__identity">
              <div className="o-prod__title-row">
                <button
                  type="button"
                  className={`o-prod__star${favorite ? ' is-on' : ''}`}
                  aria-label={favorite ? 'Unfavorite' : 'Favorite'}
                  onClick={() => {
                    const next = !favorite;
                    setFavorite(next);
                    if (item) void persist({ isFavorite: next });
                  }}
                >
                  ★
                </button>
                <input
                  className="o-prod__title"
                  value={name}
                  placeholder="e.g. Cheese Burger"
                  aria-label="Product name"
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => {
                    if (!item) {
                      void createFromDraft(name);
                      return;
                    }
                    const next = name.trim();
                    if (next && next !== item.name) void persist({ name: next });
                    else setName(item.name);
                  }}
                />
              </div>
              <div className="o-prod__flags">
                <label><input type="checkbox" checked={sheet.sales} onChange={(e) => updateSheet({ sales: e.target.checked })} /> Sales</label>
                <label><input type="checkbox" checked={sheet.purchase} onChange={(e) => updateSheet({ purchase: e.target.checked })} /> Purchase</label>
                <label><input type="checkbox" checked={sheet.pos} onChange={(e) => updateSheet({ pos: e.target.checked })} /> Point of Sale</label>
              </div>
            </div>
            <label className="o-prod__photo">
              {imageUrl ? <ProductPhoto src={imageUrl} /> : (
                <span className="o-prod__camera" aria-hidden>
                  <svg viewBox="0 0 48 48" width="42" height="42">
                    <path fill="currentColor" d="M16 10h16l3 4h7a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3h7l3-4zm8 8a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />
                  </svg>
                  <i>+</i>
                </span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Product photo"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  void uploadMenuPhoto(file).then((url) => {
                    setImageUrl(url);
                    if (item) void persist({ imageUrl: url });
                  });
                }}
              />
            </label>
          </header>

          <div className="o-prod__tabs" role="tablist">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={tab === entry.id ? 'is-on' : ''}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === 'general' ? (
            <div className="o-prod__grid">
              <div className="o-prod__col">
                <div className="o-prod__field o-prod__field--row">
                  <span>Product Type <i className="o-prod__req">*</i></span>
                  {(['goods', 'service', 'combo'] as const).map((kind) => (
                    <label key={kind}>
                      <input
                        type="radio"
                        name="ptype"
                        checked={sheet.productType === kind}
                        onChange={() => updateSheet({ productType: kind })}
                      />
                      {kind === 'goods' ? 'Goods' : kind === 'service' ? 'Service' : 'Combo'}
                    </label>
                  ))}
                </div>
                <label className="o-prod__field o-prod__field--row">
                  <span>Track Inventory <i className="o-prod__req">*</i></span>
                  <input
                    type="checkbox"
                    checked={sheet.trackInventory}
                    onChange={(e) => updateSheet({ trackInventory: e.target.checked })}
                  />
                </label>
                <div className="o-prod__ings">
                  <span>Ingredients</span>
                  <IngredientPicker />
                  <p>Each selected ingredient is drawn from stock when this item is sold.</p>
                </div>
              </div>
              <div className="o-prod__col">
                <label className="o-prod__field">
                  <span>Sales Price <i className="o-prod__req">*</i></span>
                  <span className="o-prod__money">
                    <b>₹</b>
                    <input
                      value={price}
                      inputMode="decimal"
                      aria-label="Sales price"
                      onChange={(event) => setPrice(event.target.value)}
                      onBlur={() => {
                        const next = parseMoney(price);
                        setPrice(next === null ? (item ? moneyText(item.price) : '1.00') : moneyText(next));
                        if (item && next !== null && next !== item.price) void persist({ price: next });
                      }}
                    />
                  </span>
                  <em>per Units</em>
                </label>
                <label className="o-prod__field">
                  <span>Sales Taxes <i className="o-prod__req">*</i></span>
                  <select
                    value={sheet.salesTax}
                    aria-label="Sales taxes"
                    onChange={(event) => updateSheet({ salesTax: event.target.value })}
                  >
                    <option value="" />
                    {taxOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="o-prod__field">
                  <span>Cost</span>
                  <span className="o-prod__money">
                    <b>₹</b>
                    <input
                      value={sheet.cost}
                      inputMode="decimal"
                      aria-label="Cost"
                      onChange={(event) => setSheet({ ...sheet, cost: event.target.value })}
                      onBlur={() => updateSheet({ cost: formatMoneyInput(sheet.cost) })}
                    />
                  </span>
                </label>
                <label className="o-prod__field">
                  <span>Purchase Taxes <i className="o-prod__req">*</i></span>
                  <select
                    value={sheet.purchaseTax}
                    aria-label="Purchase taxes"
                    onChange={(event) => updateSheet({ purchaseTax: event.target.value })}
                  >
                    <option value="" />
                    {taxOptions.map((option) => <option key={`p-${option}`} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="o-prod__field">
                  <span>Category</span>
                  <select
                    value={categoryId}
                    aria-label="Category"
                    onChange={(event) => {
                      const next = event.target.value;
                      setCategoryId(next);
                      if (item && next) void persist({ categoryId: next });
                    }}
                  >
                    <option value="" />
                    {pos.categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="o-prod__field">
                  <span>Reference</span>
                  <input
                    value={sheet.reference}
                    aria-label="Reference"
                    onChange={(event) => setSheet({ ...sheet, reference: event.target.value })}
                    onBlur={() => updateSheet({ reference: sheet.reference.trim() })}
                  />
                </label>
                <label className="o-prod__field">
                  <span>Barcode</span>
                  <input
                    value={sheet.barcode}
                    aria-label="Barcode"
                    onChange={(event) => setSheet({ ...sheet, barcode: event.target.value })}
                    onBlur={() => updateSheet({ barcode: sheet.barcode.trim() })}
                  />
                </label>
                <label className="o-prod__field">
                  <span>Tags</span>
                  <input
                    value={sheet.tags}
                    aria-label="Tags"
                    onChange={(event) => setSheet({ ...sheet, tags: event.target.value })}
                    onBlur={() => updateSheet({ tags: sheet.tags.trim() })}
                  />
                </label>
              </div>
            </div>
          ) : tab === 'inventory' ? (
            <div className="o-prod__ings o-prod__ings--tab">
              <span>Ingredients</span>
              <IngredientPicker />
              <p>Pick what this dish uses. Sales on the register reduce those stock lines on the inventory page.</p>
            </div>
          ) : (
            <p className="o-prod__empty">Nothing extra on this tab yet.</p>
          )}

          <div className="o-prod__notes">
            <h3>Internal notes</h3>
            <textarea
              value={notes}
              placeholder="This note is only for internal purposes."
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (item && notes !== item.description) void persist({ description: notes });
              }}
            />
          </div>
        </section>

        <aside className="o-prod__chatter" aria-label="Activity">
          <div className="o-prod__chatter-actions">
            <button type="button" className="is-on">Send message</button>
            <button type="button">Log note</button>
            <button type="button">Activity</button>
          </div>
          <article className="o-prod__note">
            <span className="o-prod__avatar">{(pos.user?.name ?? 'S').trim().charAt(0).toUpperCase()}</span>
            <div>
              <header>
                <strong>{pos.user?.name ?? 'Staff'}</strong>
                <time>today</time>
              </header>
              <p>{isNew ? 'Creating a new record...' : 'Product created'}</p>
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
