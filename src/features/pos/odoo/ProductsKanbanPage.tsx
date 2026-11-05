import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatOdooINR } from '../../../../shared/domain';
import { fitProductImage } from '../../../lib/fitProductImage';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';

function ProductThumb({ src }: { src: string }) {
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
  return <img src={fitted ?? src} alt="" data-fit={fitted ? 'ready' : 'pending'} />;
}

export function ProductsKanbanPage() {
  useTitle('Products');
  const navigate = useNavigate();
  const { items } = usePos();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const seen = new Set<string>();
    return items
      .filter((item) => item.isAvailable)
      .filter((item) => {
        const img = item.imageUrl ?? '';
        if (/\.(jpe?g|webp)(\?|$)/i.test(img) || img.includes('/studio/')) return false;
        if (img && seen.has(img)) return false;
        if (img) seen.add(img);
        return !needle || item.name.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, q]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button type="button" className="o-btn o-btn--primary" onClick={() => navigate('/pos/backend/products/new')}>New</button>
        <h2 style={{ margin: 0, flex: 1 }}>Products</h2>
        <label className="o-search" style={{ minWidth: 240 }}>
          <span>⌕</span>
          <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span style={{ color: 'var(--o-muted)' }}>1-{list.length} / {list.length}</span>
      </div>
      <div className="o-kanban">
        {list.map((item) => (
          <button
            key={item.id}
            type="button"
            className="o-kanban-card"
            onClick={() => navigate(`/pos/backend/products/${item.id}`)}
          >
            <div className="o-kanban-card__copy">
              <div className="o-kanban-card__name">{item.name}</div>
              <div className="o-kanban-card__price">{formatOdooINR(item.price)}</div>
            </div>
            {item.imageUrl ? <ProductThumb src={item.imageUrl} /> : <span className="o-kanban-card__photo" />}
          </button>
        ))}
      </div>
    </>
  );
}
