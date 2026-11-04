import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';

export function ConfigPage() {
  useTitle('Configuration');
  const [posName, setPosName] = useState('Restaurant');

  useEffect(() => {
    void api<{ config: { name: string } }>('/api/pos/dashboard')
      .then((dash) => setPosName(dash.config?.name || 'Restaurant'))
      .catch(() => undefined);
  }, []);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--o-border)', borderRadius: 6, padding: 16, maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>POS Configuration</h2>
      <div className="o-field" style={{ marginBottom: 12 }}>
        <label>Point of Sale</label>
        <input value={posName} readOnly />
      </div>
      <div className="o-field" style={{ marginBottom: 12 }}>
        <label>Restaurant mode</label>
        <input defaultValue="Enabled" readOnly />
      </div>
      <div className="o-field" style={{ marginBottom: 12 }}>
        <label>Payment methods</label>
        <input defaultValue="Cash, Card, Customer Account" readOnly />
      </div>
      <p style={{ color: 'var(--o-muted)' }}>Full Odoo settings panels (tips, bill splitting, printers) land in the parity pass.</p>
    </div>
  );
}
