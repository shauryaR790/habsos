import { dueTotal, formatINR, orderFlag, paidTotal, taxLabel, type Order } from '../../shared/domain';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openPrintWindow() {
  return window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
}

function ticketHtml(order: Order, kind: 'kot' | 'bill', taxBps: number, cafeName: string) {
  const held = orderFlag(order.notes, 'HOLD');
  const comp = orderFlag(order.notes, 'COMPLIMENTARY');
  const due = dueTotal(order);
  const captured = paidTotal(order);
  const title = kind === 'kot'
    ? `KOT #${order.orderNumber || '—'}`
    : `${comp ? 'Complimentary bill' : 'Bill'} #${order.orderNumber || '—'}`;
  const rows = order.items
    .map((item) => {
      const addons = item.addons.length ? ` (${item.addons.map((addon) => addon.nameSnapshot).join(', ')})` : '';
      const note = item.notes ? `<div class="note">${escapeHtml(item.notes)}</div>` : '';
      const amount = kind === 'bill' ? `<td class="amt">${escapeHtml(formatINR(item.total))}</td>` : '<td></td>';
      return `<tr><td>${item.quantity}× ${escapeHtml(item.nameSnapshot)}${escapeHtml(addons)}${note}</td>${amount}</tr>`;
    })
    .join('');
  const totals = kind === 'bill'
    ? `<p>Subtotal ${escapeHtml(formatINR(order.subtotal))}</p>
       ${order.discount ? `<p>Discount ${escapeHtml(formatINR(order.discount))}</p>` : ''}
       <p>Tax ${escapeHtml(taxLabel(taxBps))} ${escapeHtml(formatINR(order.tax))}</p>
       <p class="grand">${comp ? 'Complimentary' : 'Total'} ${escapeHtml(formatINR(comp ? 0 : order.total))}</p>
       ${!comp && captured ? `<p>Paid ${escapeHtml(formatINR(captured))}</p>` : ''}
       ${!comp && due > 0 && captured ? `<p class="grand">Due ${escapeHtml(formatINR(due))}</p>` : ''}
       ${!comp && due > 0 && !captured && orderFlag(order.notes, 'DUE') ? '<p class="flag">DUE</p>' : ''}`
    : '<p>Kitchen copy — no prices</p>';
  const flags = [held ? 'HOLD' : '', comp ? 'COMPLIMENTARY' : ''].filter(Boolean).join(' · ');
  const note = order.notes ? `<p class="note">${escapeHtml(order.notes)}</p>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body { font: 13px/1.35 -apple-system, Segoe UI, sans-serif; color: #111; padding: 16px; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 4px 0; vertical-align: top; border-bottom: 1px solid #ddd; }
      .amt { text-align: right; white-space: nowrap; }
      .note { color: #444; font-size: 12px; }
      .grand { font-weight: 700; font-size: 15px; }
      .flag { font-weight: 700; }
    </style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(cafeName)}</p>
      <p>${escapeHtml(order.tableName || 'Pick Up / Delivery')} · ${escapeHtml(order.customerName || 'Walk-in')}</p>
      ${flags ? `<p class="flag">${escapeHtml(flags)}</p>` : ''}
      <table>${rows}</table>
      ${note}
      ${totals}
    </body></html>`;
}

function printHtml(html: string, target?: Window | null) {
  const popup = target ?? openPrintWindow();
  if (!popup) {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return false;
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
    return true;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    popup.print();
    popup.onafterprint = () => popup.close();
  }, 50);
  return true;
}

/** Pass `target` from a synchronous click handler when print runs after async work (e.g. save). */
export function printTicket(
  order: Order,
  kind: 'kot' | 'bill',
  taxBps: number,
  cafeName = 'After Dunes',
  target?: Window | null,
) {
  return printHtml(ticketHtml(order, kind, taxBps, cafeName), target);
}
