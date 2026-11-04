import { useMemo, useState } from 'react';
import { formatOdooINR } from '../../../../shared/domain';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';

export function ProductsKanbanPage() {
  useTitle('Products');
  const { items } = usePos();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((item) => !needle || item.name.toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button type="button" className="o-btn o-btn--primary">New</button>
        <h2 style={{ margin: 0, flex: 1 }}>Products</h2>
        <label className="o-search" style={{ minWidth: 240 }}>
          <span>⌕</span>
          <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span style={{ color: 'var(--o-muted)' }}>1-{list.length} / {list.length}</span>
      </div>
      <div className="o-kanban">
        {list.map((item) => (
          <article key={item.id} className="o-kanban-card">
            <div>
              <div className="o-kanban-card__name">{item.name}</div>
              <div className="o-kanban-card__price">{formatOdooINR(item.price)}</div>
            </div>
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div style={{ width: 88, height: 72, background: '#f1f3f5', borderRadius: 4 }} />}
          </article>
        ))}
      </div>
    </>
  );
}
