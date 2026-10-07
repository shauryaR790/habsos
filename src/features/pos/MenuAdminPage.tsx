import { useMemo, useState } from 'react';
import { defaultAddonGroupsForCategory, formatINR, type MenuItem } from '../../../shared/domain';
import { defaultGuestMetaForCategory, INGREDIENT_IDS, INGREDIENT_LABELS } from '../../../shared/menuDisplay';
import { useTitle } from '../../lib/useTitle';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Input, TextArea } from '../../components/Input';
import { pushToast } from '../../components/Toast';
import { usePos } from './PosContext';

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
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
  const result = await api<{ url: string }>('/api/media/upload', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentBase64: base64, mime }),
  });
  return result.url;
}

export function MenuAdminPage() {
  useTitle('Menu');
  const pos = usePos();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [soldOnly, setSoldOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newGroups, setNewGroups] = useState<string[]>([]);
  const [newCategoryId, setNewCategoryId] = useState(pos.categories[0]?.id ?? 'cat_drinks');
  const [guestLead, setGuestLead] = useState('');
  const [guestSubtitle, setGuestSubtitle] = useState('');
  const [guestKcal, setGuestKcal] = useState('');
  const [guestIngredients, setGuestIngredients] = useState<string[]>([]);
  const [newGuestLead, setNewGuestLead] = useState('');
  const [newGuestSubtitle, setNewGuestSubtitle] = useState('');
  const [newGuestKcal, setNewGuestKcal] = useState('');
  const [newGuestIngredients, setNewGuestIngredients] = useState<string[]>([]);

  function openCreate() {
    const categoryId = pos.categories[0]?.id ?? 'cat_drinks';
    setNewCategoryId(categoryId);
    setNewImage(null);
    setNewGroups(defaultAddonGroupsForCategory(categoryId));
    const guest = defaultGuestMetaForCategory(categoryId, '');
    setNewGuestLead(guest.menuLead);
    setNewGuestSubtitle('');
    setNewGuestKcal(guest.kcalLabel);
    setNewGuestIngredients([...guest.ingredients]);
    setCreating(true);
  }

  function onNewCategoryChange(categoryId: string) {
    setNewCategoryId(categoryId);
    setNewGroups(defaultAddonGroupsForCategory(categoryId));
    const guest = defaultGuestMetaForCategory(categoryId, '');
    setNewGuestLead(guest.menuLead);
    setNewGuestKcal(guest.kcalLabel);
    setNewGuestIngredients([...guest.ingredients]);
  }

  const soldOut = pos.items.filter((item) => !item.isAvailable).length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pos.items.filter((item) => {
      if (soldOnly && item.isAvailable) return false;
      return !needle || item.name.toLowerCase().includes(needle);
    });
  }, [pos.items, query, soldOnly]);

  function open(item: MenuItem) {
    setEditing(item);
    setGroups(item.addonGroupIds);
    setGuestLead(item.menuLead);
    setGuestSubtitle(item.menuSubtitle);
    setGuestKcal(item.kcalLabel);
    setGuestIngredients(item.ingredients);
  }

  function guestFields(
    lead: string,
    setLead: (value: string) => void,
    subtitle: string,
    setSubtitle: (value: string) => void,
    kcal: string,
    setKcal: (value: string) => void,
    ingredients: string[],
    setIngredients: (value: string[] | ((current: string[]) => string[])) => void,
  ) {
    return (
      <fieldset className="addon-group">
        <legend>Guest menu card</legend>
        <Input label="Style tag (e.g. ICED, HOT, CUP)" value={lead} onChange={(event) => setLead(event.target.value)} placeholder="ICED" />
        <Input label="Display name on card" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Red John" />
        <Input label="Calories" value={kcal} onChange={(event) => setKcal(event.target.value)} placeholder="90 kcal" />
        <p className="fine">Ingredient icons</p>
        {INGREDIENT_IDS.map((id) => (
          <label key={id} className="check">
            <input
              type="checkbox"
              checked={ingredients.includes(id)}
              onChange={(event) => {
                setIngredients((current) => (
                  event.target.checked ? [...current, id] : current.filter((entry) => entry !== id)
                ));
              }}
            />
            {INGREDIENT_LABELS[id]}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <section className="pos-page">
      <header className="page-head">
        <h1>Menu</h1>
        <p className="fine">{pos.items.length} items · {soldOut} sold out</p>
      </header>

      <div className="list-tools">
        <label className="search">
          <span className="sr-only">Search the menu</span>
          <input value={query} placeholder="Search an item" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Button onClick={openCreate}>Add item</Button>
        <div className="seg" role="group" aria-label="Filter the menu">
          <button type="button" className={soldOnly ? 'seg-btn' : 'seg-btn active'} aria-pressed={!soldOnly} onClick={() => setSoldOnly(false)}>
            All
          </button>
          <button type="button" className={soldOnly ? 'seg-btn active' : 'seg-btn'} aria-pressed={soldOnly} onClick={() => setSoldOnly(true)}>
            Sold out
          </button>
        </div>
      </div>

      {pos.categories.map((category) => {
        const items = visible
          .filter((item) => item.categoryId === category.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (!items.length) return null;
        return (
          <section key={category.id} className="menu-cat">
            <header>
              <h2>{category.name}</h2>
              <span>{items.length}</span>
            </header>
            <div className="menu-admin">
              {items.map((item) => (
                <article key={item.id} className={item.isAvailable ? 'menu-row' : 'menu-row sold'}>
                  <span className="menu-thumb">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
                  </span>
                  <div className="menu-copy">
                    <strong>{item.name}</strong>
                    <span className="fine">
                      {item.isVeg ? 'Veg' : 'Non-veg'}
                      {item.isFavorite ? ' · Favorite' : ''}
                      {item.shortcutNum || item.shortcutAlpha ? ` · ${[item.shortcutNum, item.shortcutAlpha].filter(Boolean).join(' / ')}` : ''}
                      {item.addonGroupIds.length ? ` · ${item.addonGroupIds.length} add-on ${item.addonGroupIds.length === 1 ? 'group' : 'groups'}` : ''}
                      {item.isAvailable ? '' : ' · Sold out'}
                    </span>
                  </div>
                  <strong className="menu-price price">{formatINR(item.price)}</strong>
                  <div className="menu-acts">
                    <Button
                      variant={item.isAvailable ? 'danger' : 'primary'}
                      onClick={() => void pos.saveItem({ ...item, isAvailable: !item.isAvailable })}
                    >
                      {item.isAvailable ? 'Sold out' : 'Put back'}
                    </Button>
                    <Button variant="ghost" onClick={() => open(item)}>Edit</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className="menu-cat">
        <header>
          <h2>Add-ons</h2>
          <span>{pos.addonGroups.reduce((sum, group) => sum + group.addons.length, 0)}</span>
        </header>
        {pos.addonGroups.map((group) => (
          <div key={group.id} className="addon-admin">
            <h3>{group.name}</h3>
            {group.addons.map((addon) => (
              <p key={addon.id} className="addon-admin-row">
                <strong>{addon.name}</strong>
                <span className="price">+{formatINR(addon.price)}</span>
                <Button variant="ghost" onClick={() => void pos.saveAddon({ ...addon, isAvailable: !addon.isAvailable })}>
                  {addon.isAvailable ? 'On' : 'Off'}
                </Button>
              </p>
            ))}
          </div>
        ))}
      </section>

      <Drawer open={Boolean(editing)} title={editing?.name ?? 'Item'} onClose={() => setEditing(null)}>
        {editing ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const next: MenuItem = {
                ...editing,
                name: String(form.get('name') || ''),
                description: String(form.get('description') || ''),
                price: Number(form.get('price') || 0),
                imageUrl: String(form.get('imageUrl') || '') || null,
                isVeg: form.get('isVeg') === 'on',
                isAvailable: form.get('isAvailable') === 'on',
                isFavorite: form.get('isFavorite') === 'on',
                shortcutNum: String(form.get('shortcutNum') || '').trim() || null,
                shortcutAlpha: String(form.get('shortcutAlpha') || '').trim().toUpperCase() || null,
                addonGroupIds: groups,
                menuLead: guestLead,
                menuSubtitle: guestSubtitle,
                kcalLabel: guestKcal,
                ingredients: guestIngredients,
              };
              void pos.saveItem(next).then(() => pos.saveGroups(next.id, groups));
              setEditing(null);
            }}
          >
            {editing.imageUrl ? (
              <span className="menu-thumb is-big">
                <img src={editing.imageUrl} alt="" />
              </span>
            ) : null}
            <Input name="name" label="Name" defaultValue={editing.name} required />
            <TextArea name="description" label="Description" defaultValue={editing.description} rows={3} />
            <Input name="price" label="Price (₹)" type="number" min={0} step={1} defaultValue={editing.price} required />
            <Input name="imageUrl" label="Photo URL" defaultValue={editing.imageUrl ?? ''} />
            <label className="menu-upload">
              Upload photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void uploadMenuPhoto(file).then((url) => {
                    setEditing({ ...editing, imageUrl: url });
                    pushToast('Photo uploaded');
                  }).catch((err) => pushToast(err instanceof Error ? err.message : 'Upload failed', 'err'));
                }}
              />
            </label>
            <label className="check"><input type="checkbox" name="isVeg" defaultChecked={editing.isVeg} /> Vegetarian</label>
            <label className="check"><input type="checkbox" name="isAvailable" defaultChecked={editing.isAvailable} /> Available</label>
            <label className="check"><input type="checkbox" name="isFavorite" defaultChecked={editing.isFavorite} /> Favorite item</label>
            <Input name="shortcutNum" label="Numeric shortcut" defaultValue={editing.shortcutNum ?? ''} placeholder="4" />
            <Input name="shortcutAlpha" label="Alphabetic shortcut" defaultValue={editing.shortcutAlpha ?? ''} placeholder="CAP" />
            {guestFields(guestLead, setGuestLead, guestSubtitle, setGuestSubtitle, guestKcal, setGuestKcal, guestIngredients, setGuestIngredients)}
            <fieldset className="addon-group">
              <legend>Add-on groups</legend>
              {pos.addonGroups.map((group) => (
                <label key={group.id} className="check">
                  <input
                    type="checkbox"
                    checked={groups.includes(group.id)}
                    onChange={(event) => setGroups((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))}
                  />
                  {group.name}
                </label>
              ))}
            </fieldset>
            <div className="row-actions">
              <Button variant="ghost" onClick={() => void pos.moveItem(editing.id, 'up')}>Move up</Button>
              <Button variant="ghost" onClick={() => void pos.moveItem(editing.id, 'down')}>Move down</Button>
            </div>
            <Button type="submit" full>Save item</Button>
          </form>
        ) : null}
      </Drawer>

      <Drawer open={creating} title="New menu item" onClose={() => setCreating(false)}>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const categoryId = newCategoryId || String(form.get('categoryId') || '');
            void pos.createMenuItem({
              categoryId,
              name: String(form.get('name') || ''),
              description: String(form.get('description') || ''),
              price: Number(form.get('price') || 0),
              imageUrl: newImage,
              isVeg: form.get('isVeg') === 'on',
              isFavorite: form.get('isFavorite') === 'on',
              shortcutNum: String(form.get('shortcutNum') || '').trim() || null,
              shortcutAlpha: String(form.get('shortcutAlpha') || '').trim().toUpperCase() || null,
              addonGroupIds: newGroups,
              menuLead: newGuestLead,
              menuSubtitle: newGuestSubtitle,
              kcalLabel: newGuestKcal,
              ingredients: newGuestIngredients,
            }).then(() => setCreating(false));
          }}
        >
          {newImage ? <span className="menu-thumb is-big"><img src={newImage} alt="" /></span> : null}
          <label>
            Category
            <select
              name="categoryId"
              required
              value={newCategoryId}
              onChange={(event) => onNewCategoryChange(event.target.value)}
            >
              {pos.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <Input name="name" label="Name" required />
          <TextArea name="description" label="Description" rows={2} />
          <Input name="price" label="Price (₹)" type="number" min={0} step={1} required />
          <label className="menu-upload">
            Upload photo (PNG with transparent bg uses menu orange circle)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void uploadMenuPhoto(file).then(setNewImage).catch((err) => pushToast(err instanceof Error ? err.message : 'Upload failed', 'err'));
              }}
            />
          </label>
          <label className="check"><input type="checkbox" name="isVeg" defaultChecked /> Vegetarian</label>
          <label className="check"><input type="checkbox" name="isFavorite" /> Favorite item</label>
          <Input name="shortcutNum" label="Numeric shortcut" placeholder="4" />
          <Input name="shortcutAlpha" label="Alphabetic shortcut" placeholder="CAP" />
          {guestFields(newGuestLead, setNewGuestLead, newGuestSubtitle, setNewGuestSubtitle, newGuestKcal, setNewGuestKcal, newGuestIngredients, setNewGuestIngredients)}
          <fieldset className="addon-group">
            <legend>Add-on groups</legend>
            {pos.addonGroups.map((group) => (
              <label key={group.id} className="check">
                <input
                  type="checkbox"
                  checked={newGroups.includes(group.id)}
                  onChange={(event) => setNewGroups((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))}
                />
                {group.name}
              </label>
            ))}
          </fieldset>
          <Button type="submit" full>Add to guest menu</Button>
        </form>
      </Drawer>
    </section>
  );
}
