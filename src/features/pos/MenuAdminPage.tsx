import { useState } from 'react';
import type { MenuItem } from '../../../shared/domain';
import { formatINR } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Input, TextArea } from '../../components/Input';
import { usePos } from './PosContext';

export function MenuAdminPage() {
  useTitle('Menu');
  const pos = usePos();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  function open(item: MenuItem) {
    setEditing(item);
    setGroups(item.addonGroupIds);
  }

  return (
    <section className="stack">
      <h1>Menu</h1>
      {pos.categories.map((category) => (
        <section key={category.id} className="stack">
          <h2>{category.name}</h2>
          {pos.items.filter((item) => item.categoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
            <article key={item.id} className="admin-row">
              <div>
                <strong>{item.name}</strong>
                <span className="price">{formatINR(item.price)}</span>
                {!item.isAvailable ? <span className="badge bad">Sold out</span> : null}
              </div>
              <div className="row-actions">
                <Button variant={item.isAvailable ? 'danger' : 'primary'} onClick={() => void pos.saveItem({ ...item, isAvailable: !item.isAvailable })}>
                  {item.isAvailable ? 'Mark sold out' : 'Mark available'}
                </Button>
                <Button variant="ghost" onClick={() => open(item)}>Edit</Button>
              </div>
            </article>
          ))}
        </section>
      ))}
      <section className="stack">
        <h2>Add-ons</h2>
        {pos.addonGroups.map((group) => (
          <div key={group.id}>
            <h3>{group.name}</h3>
            {group.addons.map((addon) => (
              <article key={addon.id} className="admin-row">
                <div>
                  <strong>{addon.name}</strong>
                  <span className="price">+{formatINR(addon.price)}</span>
                </div>
                <Button variant="ghost" onClick={() => void pos.saveAddon({ ...addon, isAvailable: !addon.isAvailable })}>
                  {addon.isAvailable ? 'Available' : 'Sold out'}
                </Button>
              </article>
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
                addonGroupIds: groups,
              };
              void pos.saveItem(next).then(() => pos.saveGroups(next.id, groups));
              setEditing(null);
            }}
          >
            <Input name="name" label="Name" defaultValue={editing.name} required />
            <TextArea name="description" label="Description" defaultValue={editing.description} rows={3} />
            <Input name="price" label="Price (₹)" type="number" min={0} step={1} defaultValue={editing.price} required />
            <Input name="imageUrl" label="Image URL" defaultValue={editing.imageUrl ?? ''} />
            <label className="check"><input type="checkbox" name="isVeg" defaultChecked={editing.isVeg} /> Vegetarian</label>
            <label className="check"><input type="checkbox" name="isAvailable" defaultChecked={editing.isAvailable} /> Available</label>
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
    </section>
  );
}
