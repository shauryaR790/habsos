import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PriceError, priceCart, type Addon, type AddonGroup, type MenuItem } from '../../../shared/domain';
import { formatINR } from '../../../shared/domain';
import { Drawer } from '../../components/Drawer';
import { TextArea } from '../../components/Input';
import type { Bootstrap } from './cart';
import { menuItemImageProps } from './ad/menuItemImage';
import { atLeastThree, IngredientLine, itemMenuDisplay } from './menuFacts';

type Stage = 'peek' | 'make';

export function ItemSheet({
  item,
  catalog,
  initial,
  onClose,
  onSave,
  mobileAd = false,
}: {
  item: MenuItem;
  catalog: Bootstrap;
  initial?: { quantity: number; addonIds: string[]; notes: string };
  onClose: () => void;
  onSave: (value: { quantity: number; addonIds: string[]; notes: string }) => void;
  /** Guest mobile menu — peek sheet styling + scroll lock. */
  mobileAd?: boolean;
}) {
  const groups = catalog.addonGroups.filter((group) => item.addonGroupIds.includes(group.id));
  const [stage, setStage] = useState<Stage>(() => {
    if (mobileAd && !initial) return 'peek';
    return initial || groups.length ? 'make' : 'peek';
  });
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [selected, setSelected] = useState<string[]>(initial?.addonIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [noteOpen, setNoteOpen] = useState(Boolean(initial?.notes));
  const makeRef = useRef<HTMLElement>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const pending = useRef<{ quantity: number; addonIds: string[]; notes: string } | null>(null);

  const preview = useMemo(() => {
    try {
      const quote = priceCart({
        lines: [{ menuItemId: item.id, quantity, addonIds: selected, notes }],
        items: catalog.items,
        groups: catalog.addonGroups,
        taxBps: catalog.cafe.taxBps,
      });
      return { total: quote.lines[0]?.total ?? 0, error: null as string | null };
    } catch (error) {
      return { total: null, error: error instanceof PriceError ? error.message : 'Choose a valid combination.' };
    }
  }, [catalog, item.id, notes, quantity, selected]);

  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dismiss = useCallback(() => {
    if (leaving) return;
    if (stage === 'make' && !initial) setStage('peek');
    else setLeaving(true);
  }, [initial, leaving, stage]);

  useLayoutEffect(() => {
    if (!leaving) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      const saved = pending.current;
      if (saved) onSaveRef.current(saved);
      else onCloseRef.current();
    }, reduced ? 0 : 340);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const resetDrink = useCallback(() => {
    setSelected([]);
    setQuantity(1);
    setNotes('');
    setNoteOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (stage !== 'make') return;
    const root = makeRef.current;
    const scroller = root?.closest('.sheet-body') as HTMLElement | null;
    if (!root || !scroller) return;
    const minH = 200;
    const cap = parseFloat(getComputedStyle(root).getPropertyValue('--hero-max')) || Infinity;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const square = Math.min(root.clientWidth, cap);
      const range = Math.max(1, square - minH);
      const progress = Math.min(1, Math.max(0, scroller.scrollTop / range));
      const live = square - (square - minH) * progress;
      root.style.setProperty('--live', `${live}px`);
      root.style.setProperty('--fold', progress.toFixed(4));
      root.classList.toggle('is-folded', progress > 0.62);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    scroller.style.overflowAnchor = 'none';
    apply();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(root);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [stage]);

  function toggle(group: AddonGroup, addonId: string) {
    setSelected((current) => {
      const idsInGroup = new Set(group.addons.map((addon) => addon.id));
      const chosen = current.filter((id) => idsInGroup.has(id));
      if (current.includes(addonId)) return current.filter((id) => id !== addonId);
      if (group.maxSelect === 1) return [...current.filter((id) => !idsInGroup.has(id)), addonId];
      if (chosen.length >= group.maxSelect) return current;
      return [...current, addonId];
    });
  }

  function pickOne(group: AddonGroup, addonId: string | null) {
    const idsInGroup = new Set(group.addons.map((addon) => addon.id));
    setSelected((current) => {
      const rest = current.filter((id) => !idsInGroup.has(id));
      return addonId ? [...rest, addonId] : rest;
    });
  }

  function save() {
    if (preview.error || leaving) return;
    pending.current = { quantity, addonIds: selected, notes: notes.trim() };
    setLeaving(true);
  }

  const fact = itemMenuDisplay(item);
  const summary = groups
    .flatMap((group) => group.addons.filter((addon) => selected.includes(addon.id)).map((addon) => addon.name))
    .join(' · ');

  const goFromPeek = () => {
    if (groups.some((group) => group.minSelect > 0)) setStage('make');
    else save();
  };

  const footer = stage === 'peek' ? (
    <button type="button" className="pay-bar" onClick={goFromPeek} disabled={Boolean(preview.error) || leaving}>
      <span>Add Item</span>
      <span>{formatINR(preview.total ?? item.price)}</span>
    </button>
  ) : (
    <button type="button" className="pay-bar" disabled={Boolean(preview.error)} onClick={save}>
      <span>{initial ? 'Update cart' : 'Add to cart'}</span>
      <span>{preview.total === null ? formatINR(item.price) : formatINR(preview.total)}</span>
    </button>
  );

  return (
    <Drawer
      className={`item-flow${mobileAd ? ' ad-item-sheet' : ''} ${stage === 'peek' ? 'peek-sheet' : 'make-sheet'}${leaving ? ' is-leaving' : ''}`}
      open
      chrome={false}
      title={item.name}
      onClose={dismiss}
      footer={footer}
    >
      {stage === 'peek' ? (
        <article className="peek">
          <div className="peek-hero">
            <button type="button" className="peek-cancel" onClick={dismiss}>Cancel</button>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" {...menuItemImageProps(item.id, 'hero')} />
            ) : (
              <span className="peek-fallback" />
            )}
          </div>
          <div className="peek-body">
            <p className={item.isVeg ? 'diet veg' : 'diet nonveg'}>
              <span className={item.isVeg ? 'mark veg' : 'mark nonveg'} aria-hidden="true" />
              {item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
            </p>
            <h2>{item.name}</h2>
            {fact ? (
              <>
                <p className="peek-sub">
                  {fact.lead ? <strong>{fact.lead}</strong> : null}
                  {fact.titled || fact.kcal ? (
                    <span>
                      {fact.lead ? ' ' : ''}({fact.titled || item.name}){fact.kcal ? ` - ${fact.kcal}` : ''}
                    </span>
                  ) : null}
                </p>
                {fact.ingredients.length ? <IngredientLine ids={fact.ingredients} /> : null}
              </>
            ) : null}
            <p className="peek-story">{item.description}</p>
            <p className="peek-price">{formatINR(item.price)}</p>
          </div>
        </article>
      ) : (
        <article className="make" ref={makeRef}>
          <div className="make-pin">
            <div className="make-hero">
              <button type="button" className="make-back" onClick={dismiss} aria-label="Back">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" {...menuItemImageProps(item.id, 'hero')} />
              ) : null}
              <div className="make-veil" />
              <div className="make-copy">
                <div className="make-endrow">
                  <p className={item.isVeg ? 'make-veg' : 'make-veg nonveg'}>
                    <span className={item.isVeg ? 'mark veg' : 'mark nonveg'} aria-hidden="true" />
                    {item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                  </p>
                  {fact ? <span className="make-kcal">{fact.kcal}</span> : null}
                  <button type="button" className="text-reset on-hero" onClick={resetDrink}>Set to default</button>
                </div>
                <div className="make-full">
                  <h2>{item.name}</h2>
                  {fact ? <IngredientLine ids={atLeastThree(fact.ingredients)} className="round" /> : null}
                </div>
              </div>
            </div>
          </div>
          <div className="make-panel">
            <div className="opt-head">
              <h3>{item.categoryId === 'cat_drinks' ? 'Customise your drink' : 'Customise your plate'} <em>{summary || 'Default'}</em></h3>
            </div>
            {groups.map((group) => (
              <OptionBlock
                key={group.id}
                group={group}
                selected={selected}
                onPick={pickOne}
                onToggle={toggle}
              />
            ))}
            <div className="opt-head">
              <h3>Quantity</h3>
            </div>
            <div className="extra-row">
              <span>How many</span>
              <span className="qty-step">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Increase quantity">+</button>
              </span>
            </div>
            {noteOpen ? (
              <TextArea label="Note for the bar" value={notes} maxLength={180} rows={2} onChange={(event) => setNotes(event.target.value)} />
            ) : (
              <button type="button" className="note-toggle" onClick={() => setNoteOpen(true)}>Add a note</button>
            )}
            {preview.error ? <p className="field-error" role="alert">{preview.error}</p> : null}
          </div>
        </article>
      )}
    </Drawer>
  );
}

function OptionBlock({
  group,
  selected,
  onPick,
  onToggle,
}: {
  group: AddonGroup;
  selected: string[];
  onPick: (group: AddonGroup, addonId: string | null) => void;
  onToggle: (group: AddonGroup, addonId: string) => void;
}) {
  const kind = groupKind(group);
  const chosen = group.addons.find((addon) => selected.includes(addon.id)) ?? null;
  if (kind === 'size') {
    return (
      <section className="opt-rule">
        <div className="opt-head">
          <h3>{group.name}</h3>
          <span>Choose one</span>
        </div>
        <div className="size-row">
          <SizeCup label="Small" price={0} pressed={!chosen} onClick={() => onPick(group, null)} />
          {group.addons.filter((addon) => addon.isAvailable).map((addon) => (
            <SizeCup
              key={addon.id}
              label={addon.name}
              price={addon.price}
              pressed={selected.includes(addon.id)}
              disabled={!addon.isAvailable}
              onClick={() => onPick(group, addon.id)}
            />
          ))}
        </div>
      </section>
    );
  }
  if (kind === 'milk') {
    return (
      <section className="opt-rule">
        <div className="opt-head">
          <h3>{group.name}</h3>
          <span>Choose one</span>
        </div>
        <div className="pill-row">
          <MilkPill label="Cafe milk" price={0} pressed={!chosen} onClick={() => onPick(group, null)} />
          {group.addons.map((addon) => (
            <MilkPill
              key={addon.id}
              label={addon.name}
              price={addon.price}
              pressed={selected.includes(addon.id)}
              disabled={!addon.isAvailable}
              onClick={() => onPick(group, addon.id)}
            />
          ))}
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="opt-head amp">
        <h3>Amp up your drink with add-ons</h3>
      </div>
      <div className="opt-head">
        <h3>{group.name}</h3>
        <span>{group.maxSelect === 1 ? 'Select any one' : `Up to ${group.maxSelect}`}</span>
      </div>
      {group.addons.map((addon) => {
        const on = selected.includes(addon.id);
        const chosen = group.addons.filter((item) => selected.includes(item.id)).length;
        return (
          <ExtraRow
            key={addon.id}
            addon={addon}
            on={on}
            blocked={!on && chosen >= group.maxSelect}
            onToggle={() => onToggle(group, addon.id)}
          />
        );
      })}
    </section>
  );
}

function SizeCup({
  label,
  price,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  price: number;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={pressed ? 'size-choice on' : 'size-choice'}
      aria-pressed={pressed}
      aria-label={price > 0 ? `${label}, plus ${formatINR(price)}` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="cup">
        <img src="/ui/size-cup.png" alt="" />
      </span>
      <span className="size-name">{label}</span>
      <span className="size-meta">{price > 0 ? `+${formatINR(price)}` : formatINR(0)}</span>
    </button>
  );
}

function MilkPill({
  label,
  price,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  price: number;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <span className="milk-opt">
      <button type="button" className={pressed ? 'opt-pill on' : 'opt-pill'} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
        {label}
      </button>
      <span className="milk-price">+{formatINR(price)}</span>
    </span>
  );
}

function ExtraRow({ addon, on, blocked, onToggle }: { addon: Addon; on: boolean; blocked: boolean; onToggle: () => void }) {
  return (
    <div className="extra-row">
      <div>
        <strong>{addon.name}</strong>
        <p>+{formatINR(addon.price)}</p>
      </div>
      <span className="qty-step">
        <button type="button" onClick={() => { if (on) onToggle(); }} aria-label={`Remove ${addon.name}`} disabled={!addon.isAvailable || !on}>−</button>
        <span>{on ? 1 : 0}</span>
        <button type="button" onClick={() => { if (!on && !blocked) onToggle(); }} aria-label={`Add ${addon.name}`} disabled={!addon.isAvailable || on || blocked}>+</button>
      </span>
    </div>
  );
}

function groupKind(group: AddonGroup) {
  const name = `${group.id} ${group.name}`.toLowerCase();
  if (name.includes('size')) return 'size';
  if (name.includes('milk')) return 'milk';
  return 'extra';
}
