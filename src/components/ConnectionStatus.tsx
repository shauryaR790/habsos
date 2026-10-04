import { Link } from 'react-router-dom';

export type ConnState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR';

export function OfflineIndicator({ pending }: { pending: number }) {
  return (
    <p className="conn off">
      <i />
      Offline
      <span>{pending ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync` : 'Orders are being saved locally'}</span>
    </p>
  );
}

export function SyncIndicator({ pending, error }: { pending: number; error?: string | null }) {
  if (error) {
    return (
      <Link to="/pos/settings" className="conn err">
        <i />
        Sync error
        <span>Tap to inspect</span>
      </Link>
    );
  }
  return (
    <p className="conn sync">
      <i />
      Syncing
      <span>{pending} {pending === 1 ? 'change' : 'changes'}</span>
    </p>
  );
}

export function ConnectionStatus({ state, pending }: { state: ConnState; pending: number }) {
  if (state === 'OFFLINE') return <OfflineIndicator pending={pending} />;
  if (state === 'SYNCING') return <SyncIndicator pending={pending} />;
  if (state === 'SYNC_ERROR') return <SyncIndicator pending={pending} error="sync" />;
  return (
    <p className="conn ok">
      <i />
      Online
    </p>
  );
}
