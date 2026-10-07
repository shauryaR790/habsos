import { formatINR, type SalesReport } from '../../shared/domain';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyRow(label: string, amount: number) {
  return `<tr><td>${escapeHtml(label)}</td><td class="amt">${escapeHtml(formatINR(amount))}</td></tr>`;
}

export function printSalesReport(report: SalesReport, cafeName = 'After Dunes') {
  const range = report.fromYmd === report.toYmd ? report.fromYmd : `${report.fromYmd} – ${report.toYmd}`;
  const items = report.items
    .map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.qty}</td><td class="amt">${escapeHtml(formatINR(row.amount))}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Day report ${escapeHtml(range)}</title>
    <style>
      body { font: 13px/1.35 -apple-system, Segoe UI, sans-serif; color: #111; padding: 16px; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      h2 { font-size: 13px; margin: 16px 0 6px; }
      table { width: 100%; border-collapse: collapse; }
      td, th { padding: 4px 0; border-bottom: 1px solid #ddd; text-align: left; }
      .amt { text-align: right; white-space: nowrap; }
      .kpis td { font-size: 14px; }
    </style></head><body>
      <h1>${escapeHtml(cafeName)} · Sales report</h1>
      <p>${escapeHtml(range)} · ${report.bills} bills · Avg ${escapeHtml(formatINR(report.averageTicket))}</p>
      <table class="kpis">
        ${moneyRow('Gross', report.gross)}
        ${moneyRow('Discount', report.discount)}
        ${moneyRow('Tax', report.tax)}
        ${moneyRow('Net', report.net)}
        ${moneyRow('Collected', report.collected)}
        ${moneyRow('Due', report.due)}
        ${moneyRow('Complimentary', report.ncAmount)}
        ${moneyRow('Cash', report.byMethod.CASH)}
        ${moneyRow('Card', report.byMethod.CARD)}
        ${moneyRow('UPI', report.byMethod.UPI)}
        ${moneyRow('Other', report.byMethod.OTHER)}
      </table>
      <h2>Item wise</h2>
      <table>
        <tr><th>Item</th><th>Qty</th><th class="amt">Amount</th></tr>
        ${items || '<tr><td colspan="3">No items</td></tr>'}
      </table>
    </body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720');
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
