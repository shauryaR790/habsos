import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useTitle } from '../../lib/useTitle';

export function TableQrPage() {
  const { code = 'T01' } = useParams();
  const table = code.toUpperCase();
  const url = `${window.location.origin}/menu?table=${encodeURIComponent(table)}`;
  const [src, setSrc] = useState('');
  useTitle(`Table ${table}`);
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#2c2218', light: '#fbf6ee' } }).then(setSrc);
  }, [url]);

  return (
    <main className="qr-sheet">
      <p className="eyebrow">After Dunes</p>
      <h1>Table <span className="code">{table}</span></h1>
      <p>Scan to open the menu.</p>
      {src ? <img src={src} alt={`QR code for table ${table}`} /> : <p>Preparing the code…</p>}
      <p className="fine">{url}</p>
    </main>
  );
}
