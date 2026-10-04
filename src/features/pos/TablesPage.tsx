import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import type { TableInfo } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { TableCard } from '../../components/TableCard';
import { pushToast } from '../../components/Toast';
import { usePos } from './PosContext';

export function TablesPage() {
  useTitle('Tables');
  const pos = usePos();
  const [table, setTable] = useState<TableInfo | null>(null);
  const current = pos.tables.find((entry) => entry.id === table?.id) ?? table;
  return (
    <section className="stack">
      <h1>Tables</h1>
      <div className="table-grid">
        {pos.tables.map((entry) => (
          <TableCard key={entry.id} table={entry} onOpen={setTable} />
        ))}
      </div>
      <Drawer open={Boolean(current)} title={current?.name ?? 'Table'} onClose={() => setTable(null)}>
        {current ? <TableDetail table={current} onStatus={(status) => void pos.saveTable(current.id, status)} /> : null}
      </Drawer>
    </section>
  );
}

function TableDetail({ table, onStatus }: { table: TableInfo; onStatus: (status: 'AVAILABLE' | 'OCCUPIED') => void }) {
  const [src, setSrc] = useState('');
  const url = `${window.location.origin}/menu?table=${encodeURIComponent(table.qrCode)}`;
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#111111', light: '#fffdf8' } }).then(setSrc);
  }, [url]);
  return (
    <div className="stack">
      <p>{table.status === 'OCCUPIED' ? 'Occupied' : 'Available'}</p>
      {table.openOrder ? (
        <p>
          Current order #{table.openOrder.orderNumber} · {table.openOrder.customerName}
          <br />
          <Link to={`/pos/orders/${table.openOrder.id}`}>Open ticket</Link>
        </p>
      ) : <p>No open order.</p>}
      {src ? <img className="qr" src={src} alt={`QR code for table ${table.name}`} /> : null}
      <p className="fine">{url}</p>
      <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(url).then(() => pushToast('Link copied'))}>Copy customer link</Button>
      <Button onClick={() => onStatus(table.status === 'OCCUPIED' ? 'AVAILABLE' : 'OCCUPIED')}>
        Mark {table.status === 'OCCUPIED' ? 'available' : 'occupied'}
      </Button>
    </div>
  );
}
