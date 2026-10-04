import { useEffect, useState } from 'react';
import { useTitle } from '../../lib/useTitle';
import { api } from '../../lib/api';
import { habdb } from '../../db/idb';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { pushToast } from '../../components/Toast';
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

  return (
    <section className="stack">
      <h1>Settings</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const taxBps = Math.round(Number(tax) * 100);
          void pos.saveSettings({ name, taxBps });
        }}
      >
        <Input label="Cafe name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Tax percent" type="number" min={0} max={28} step={0.01} value={tax} onChange={(event) => setTax(event.target.value)} />
        <Button type="submit">Save</Button>
      </form>
      <section className="stack">
        <h2>This device</h2>
        <p>Connection: {pos.conn}</p>
        {provider ? <p>OTP provider: {provider}</p> : null}
        {prompt ? <Button onClick={() => void prompt.prompt()}>Install app</Button> : <p>Use the browser menu to install After Dunes for a full-screen register.</p>}
        {ios ? <p>On iPhone or iPad: Share, then Add to Home Screen.</p> : null}
        <Button variant="ghost" onClick={() => void pos.signOut()}>Sign out</Button>
        <Button variant="danger" onClick={() => setWipe(true)}>Clear local data</Button>
      </section>
      <section className="stack">
        <h2>Sync queue</h2>
        {pos.queue.length === 0 ? <p>Nothing waiting.</p> : null}
        {pos.queue.map((op) => (
          <article key={op.id} className="admin-row">
            <div>
              <strong>{op.operation}</strong>
              <span>{op.entityId}</span>
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
