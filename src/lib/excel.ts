export type ExcelSheet = {
  name: string;
  rows: (string | number | null | undefined)[][];
};

function escapeCell(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadExcel(filename: string, sheets: ExcelSheet[]) {
  const workbook = sheets.map((sheet) => {
    const name = escapeCell(sheet.name.replace(/[\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet');
    const rows = sheet.rows.map((row) => {
      const cells = row.map((cell) => {
        if (typeof cell === 'number' && Number.isFinite(cell)) {
          return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
        }
        return `<Cell><Data ss:Type="String">${escapeCell(cell == null ? '' : String(cell))}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('');
    return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
  }).join('');
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${workbook}
</Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.toLowerCase().endsWith('.xls') ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}
