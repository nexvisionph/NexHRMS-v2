import * as XLSX from "xlsx";

export type ExportFormat = "xlsx" | "csv";

interface ExportOptions {
  filename: string;
  format: ExportFormat;
  sheets: { name: string; data: Record<string, unknown>[] }[];
}

/**
 * Export data as an Excel workbook or CSV file.
 * Supports multiple sheets (XLSX only; CSV uses first sheet).
 */
export function exportToFile({ filename, format, sheets }: ExportOptions) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (sheet.data.length === 0) {
      // Add empty sheet with headers placeholder
      const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
      continue;
    }

    const ws = XLSX.utils.json_to_sheet(sheet.data);

    // Auto-size columns based on header + content widths
    const headers = Object.keys(sheet.data[0]);
    ws["!cols"] = headers.map((h) => {
      let maxLen = h.length;
      for (const row of sheet.data) {
        const val = row[h];
        const len = val != null ? String(val).length : 0;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(maxLen + 2, 50) };
    });

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  if (format === "csv") {
    const csvContent = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    downloadBlob(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
  } else {
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      buf,
      `${filename}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }
}

function downloadBlob(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
