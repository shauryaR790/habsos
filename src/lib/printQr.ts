import QRCode from 'qrcode';
import { tableLabel, type TableInfo } from '../../shared/domain';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function printTableQr(table: TableInfo, cafeName = 'After Dunes') {
  const url = `${window.location.origin}/menu?table=${encodeURIComponent(table.qrCode)}`;
  const src = await QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#2c2218', light: '#fbf6ee' } });
  writeQrSheet(`<article><h1>${escapeHtml(cafeName)}</h1><p>Table ${escapeHtml(tableLabel(table.name))}</p><img src="${src}" alt=""><p>${escapeHtml(url)}</p></article>`, `QR ${tableLabel(table.name)}`);
}

export async function printAllTableQr(tables: TableInfo[], cafeName = 'After Dunes') {
  const cards = await Promise.all(tables.map(async (table) => {
    const url = `${window.location.origin}/menu?table=${encodeURIComponent(table.qrCode)}`;
    const src = await QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#2c2218', light: '#fbf6ee' } });
    return `<article><h1>${escapeHtml(cafeName)}</h1><p>Table ${escapeHtml(tableLabel(table.name))}</p><img src="${src}" alt=""><p>${escapeHtml(url)}</p></article>`;
  }));
  writeQrSheet(cards.join(''), 'Table QR codes');
}

function writeQrSheet(body: string, title: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body { font: 14px/1.35 -apple-system, Segoe UI, sans-serif; color: #2c2218; padding: 16px; }
      article { break-inside: avoid; page-break-inside: avoid; text-align: center; margin: 0 0 32px; }
      img { width: 240px; height: 240px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
    </style></head><body>${body}</body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=520,height=720');
  if (!popup) {
    window.print();
    return;
  }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.onafterprint = () => popup.close();
  popup.print();
}
