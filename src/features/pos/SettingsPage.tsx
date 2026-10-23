import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { TableInfo } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { api } from '../../lib/api';
import { habdb } from '../../db/idb';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { pushToast } from '../../components/Toast';
import { printAllTableQr } from '../../lib/printQr';
import { usePos } from './PosContext';

type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function SettingsPage() {
  useTitle('Settings');
  const pos = usePos();
  const [name, setName] = useState(pos.cafe?.name ?? 'After Dunes');
  const [tax, setTax] = useState(String((pos.cafe?.taxBps ?? 500) / 100));
  const [prompt, setPrompt] = useState<BeforeInstall | null>(null);
  const [wipe, setWipe] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const [qrTable, setQrTable] = useState<TableInfo | null>(null);

  useEffect(() => {
    setName(pos.cafe?.name ?? 'After Dunes');
    setTax(String((pos.cafe?.taxBps ?? 500) / 100));
  }, [pos.cafe]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstall);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (pos.conn !== 'OFFLINE') {
      void api<{ otpProvider: string }>('/api/settings').then((data) => setProvider(data.otpProvider)).catch(() => undefined);
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [pos.conn]);

  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const tables = useMemo(
    () => [...pos.tables].sort((a, b) => a.qrCode.localeCompare(b.qrCode, undefined, { numeric: true })),
    [pos.tables],
  );

  return (
    <section className="pos-page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <div className="settings-grid">
      <section className="panel">
        <h2>Cafe</h2>
        <form
          className="stack settings-cafe-form"
          onSubmit={(event) => {
            event.preventDefault();
            void pos.saveSettings({ name, taxBps: Math.round(Number(tax) * 100) });
          }}
        >
          <div className="settings-form-row">
            <Input label="Cafe name" value={name} onChange={(event) => setName(event.target.value)} />
            <Input label="Tax percent" type="number" min={0} max={28} step={0.01} value={tax} onChange={(event) => setTax(event.target.value)} />
          </div>
          <p className="fine">Timezone {pos.cafe?.timezone ?? 'Asia/Kolkata'} · integer rupees. Guest menu names and prices stay as published.</p>
          <Button type="submit" className="settings-save">Save</Button>
        </form>
      </section>

      <section className="panel">
        <h2>Staff</h2>
        <p className="fine">{pos.user?.name ?? 'Staff'} · {pos.user?.email ?? ''} · {pos.user?.role ?? ''}</p>
      </section>

      <section className="panel">
        <h2>Loyalty</h2>
        <p className="fine">
          Visits and spend follow the customer mobile on saved bills. Two or more visits mark loyalty.
          The register Loyalty button attaches that guest to the current ticket.
        </p>
      </section>

      <section className="panel">
        <h2>This device</h2>
        <p className="fine">
          Connection: {pos.conn === 'ONLINE' ? 'Online' : pos.conn === 'OFFLINE' ? 'Offline' : pos.conn === 'SYNCING' ? 'Syncing' : 'Sync error'}
          {provider ? ` · OTP by ${provider}` : ''}
        </p>
        {prompt ? (
          <Button className="settings-save" onClick={() => void prompt.prompt()}>Install app</Button>
        ) : (
          <p className="fine">{ios ? 'On iPhone or iPad: Share, then Add to Home Screen.' : 'Use the browser menu to install After Dunes for a full-screen register.'}</p>
        )}
        <div className="row-actions">
          <Button variant="ghost" onClick={() => void pos.signOut()}>Sign out</Button>
          <Button variant="danger" onClick={() => setWipe(true)}>Clear local data</Button>
        </div>
      </section>

      <section className="panel settings-panel-wide">
        <h2>Table QR codes</h2>
        <p className="fine">Print one per table. Scanning it opens the guest menu for that table.</p>
        <div className="settings-qr-grid">
          {tables.map((table) => (
            <button key={table.id} type="button" className="chip" onClick={() => setQrTable(table)}>
              {table.name}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="settings-save" onClick={() => void printAllTableQr(pos.tables, pos.cafe?.name ?? 'After Dunes')}>
          Print all QR codes
        </Button>
      </section>

      <section className="panel settings-panel-wide">
        <h2>Sync queue</h2>
        {pos.queue.length === 0 ? <p className="fine">Nothing waiting.</p> : null}
        {pos.queue.map((op) => (
          <article key={op.id} className="admin-row">
            <div className="name-row">
              <strong>{op.operation}</strong>
              <span className="fine">{op.entityId}</span>
              {op.lastError ? <span className="field-error">{op.lastError}</span> : null}
            </div>
            <div className="row-actions">
              <Button variant="ghost" onClick={() => void pos.flush()}>Retry</Button>
              <Button variant="danger" onClick={() => void pos.discard(op.id)}>Discard</Button>
            </div>
          </article>
        ))}
        {pos.syncError ? <p className="field-error">{pos.syncError}</p> : null}
      </section>
      </div>

      <Drawer open={Boolean(qrTable)} title={qrTable ? `${qrTable.name} QR code` : 'QR code'} onClose={() => setQrTable(null)}>
        {qrTable ? <TableQr table={qrTable} /> : null}
      </Drawer>

      <Modal open={wipe} title="Clear this device?" onClose={() => setWipe(false)}>
        <p>Unsynced orders on this device will be removed. Orders already on the server stay there.</p>
        <div className="row-actions">
          <Button variant="ghost" onClick={() => setWipe(false)}>Keep data</Button>
          <Button
            variant="danger"
            onClick={() => {
              void habdb.delete().then(() => {
                pushToast('Local data cleared');
                window.location.reload();
              });
            }}
          >
            Clear
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function TableQr({ table }: { table: TableInfo }) {
  const [src, setSrc] = useState('');
  const url = `${window.location.origin}/menu?table=${encodeURIComponent(table.qrCode)}`;
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#2c2218', light: '#fbf6ee' } }).then(setSrc);
  }, [url]);
  return (
    <div className="stack">
      {src ? <img className="qr" src={src} alt={`QR code for ${table.name}`} /> : <p className="fine">Drawing the code…</p>}
      <p className="fine">{url}</p>
      <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(url).then(() => pushToast('Link copied'))}>
        Copy customer link
      </Button>
      <Button variant="ghost" onClick={() => window.open(`/qr/${table.qrCode}`, '_blank')}>
        Open printable sheet
      </Button>
    </div>
  );
}
