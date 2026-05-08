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

// ─── Import Template Definitions ──────────────────────────────────────────────

export const PAYROLL_TEMPLATE_HEADERS = [
  "Employee Name",
  "Email",
  "Department",
  "Job Title",
  "Period Start",
  "Period End",
  "Pay Frequency",
  "Gross Pay",
  "Allowances",
  "Holiday Pay",
  "SSS",
  "PhilHealth",
  "Pag-IBIG",
  "Tax",
  "Loan Deduction",
  "Custom Deductions",
  "Other Deductions",
  "Net Pay",
  "Payment Method",
  "Bank Reference",
  "Notes",
] as const;

export const ATTENDANCE_TEMPLATE_HEADERS = [
  "Employee Name",
  "Email",
  "Event Type",
  "Date",
  "Time",
  "Project ID",
  "Device ID",
  "GPS Lat",
  "GPS Lng",
  "GPS Accuracy (m)",
  "Geofence Pass",
  "Face Verified",
  "Device Integrity",
  "Mock Location",
] as const;

export const EMPLOYEES_TEMPLATE_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Birthday",
  "Address",
] as const;

const PAYROLL_SAMPLE_ROWS: Record<string, string>[] = [
  {
    "Employee Name": "Juan Dela Cruz",
    Email: "juan@company.com",
    Department: "Engineering",
    "Job Title": "Developer",
    "Period Start": "2026-04-01",
    "Period End": "2026-04-15",
    "Pay Frequency": "semi_monthly",
    "Gross Pay": "25000",
    Allowances: "2000",
    "Holiday Pay": "0",
    SSS: "900",
    PhilHealth: "500",
    "Pag-IBIG": "200",
    Tax: "1500",
    "Loan Deduction": "0",
    "Custom Deductions": "0",
    "Other Deductions": "0",
    "Net Pay": "19900",
    "Payment Method": "bank_transfer",
    "Bank Reference": "",
    Notes: "",
  },
];

const ATTENDANCE_SAMPLE_ROWS: Record<string, string>[] = [
  {
    "Employee Name": "Juan Dela Cruz",
    Email: "juan@company.com",
    "Event Type": "IN",
    Date: "2026-04-20",
    Time: "08:00:00",
    "Project ID": "",
    "Device ID": "",
    "GPS Lat": "14.5995",
    "GPS Lng": "120.9842",
    "GPS Accuracy (m)": "10",
    "Geofence Pass": "Yes",
    "Face Verified": "Yes",
    "Device Integrity": "pass",
    "Mock Location": "No",
  },
  {
    "Employee Name": "Juan Dela Cruz",
    Email: "juan@company.com",
    "Event Type": "OUT",
    Date: "2026-04-20",
    Time: "17:00:00",
    "Project ID": "",
    "Device ID": "",
    "GPS Lat": "14.5995",
    "GPS Lng": "120.9842",
    "GPS Accuracy (m)": "10",
    "Geofence Pass": "Yes",
    "Face Verified": "Yes",
    "Device Integrity": "pass",
    "Mock Location": "No",
  },
];

const EMPLOYEES_SAMPLE_ROWS: Record<string, string>[] = [
  {
    Name: "Juan Dela Cruz",
    Email: "juan@example.com",
    Phone: "+63 917 123 4567",
    Birthday: "1990-05-20",
    Address: "Manila, Philippines",
  },
  {
    Name: "Maria Santos",
    Email: "maria@example.com",
    Phone: "+63 918 234 5678",
    Birthday: "1993-11-15",
    Address: "Quezon City, Philippines",
  },
];

/**
 * Download an import template file (XLSX or CSV) for payroll, attendance, or employees.
 * Includes headers + 1-2 sample rows so users know the expected format.
 */
export function downloadImportTemplate(
  module: "payroll" | "attendance" | "employees",
  format: ExportFormat
) {
  const headers =
    module === "payroll"
      ? PAYROLL_TEMPLATE_HEADERS
      : module === "attendance"
      ? ATTENDANCE_TEMPLATE_HEADERS
      : EMPLOYEES_TEMPLATE_HEADERS;
  const sampleRows =
    module === "payroll"
      ? PAYROLL_SAMPLE_ROWS
      : module === "attendance"
      ? ATTENDANCE_SAMPLE_ROWS
      : EMPLOYEES_SAMPLE_ROWS;

  exportToFile({
    filename: `${module}-import-template`,
    format,
    sheets: [
      {
        name:
          module === "payroll"
            ? "Payroll Import"
            : module === "attendance"
            ? "Attendance Import"
            : "Employees Import",
        data: sampleRows.map((row) => {
          const ordered: Record<string, unknown> = {};
          for (const h of headers) {
            ordered[h] = row[h] ?? "";
          }
          return ordered;
        }),
      },
    ],
  });
}

/**
 * Parse an uploaded XLSX or CSV file into an array of row objects.
 * The first row is treated as headers.
 */
export function parseImportFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
