/**
 * BIR Export — CSV / XLSX / DAT
 * --------------------------------------------------------------
 * Serializes Alphalist rows into the export formats accepted by
 * the BIR eFPS Alphalist Data Entry / eBIRForms package.
 *
 * - CSV / XLSX: human-friendly preview format (column headers).
 * - DAT       : pipe-delimited stub matching BIR's text layout.
 *               This is a starter template — actual BIR DAT spec
 *               varies by RR; review the active eBIRForms guide
 *               before submission.
 */

import type {
    AlphalistRow,
    AlphalistScheduleType,
} from "@/types";

export interface ExportOptions {
    year: number;
    schedule: AlphalistScheduleType;
    employerTin: string;
    employerName: string;
}

/** CSV — RFC 4180 compliant, with header row. */
export function exportAlphalistCsv(
    rows: AlphalistRow[],
    opts: ExportOptions,
): string {
    const header = [
        "Sequence",
        "TIN",
        "LastName",
        "FirstName",
        "MiddleName",
        "Classification",
        "TaxStatus",
        "IsMWE",
        "GrossCompensation",
        "NonTaxableCompensation",
        "TaxableCompensation",
        "TaxWithheld",
        "TaxDue",
        "OverUnderWithheld",
        "PrevEmployerIncome",
        "PrevEmployerTax",
        "SeparationDate",
        "SeparationType",
    ];

    const meta = [
        `# BIR Alphalist — ${opts.schedule}`,
        `# Year: ${opts.year}`,
        `# Employer TIN: ${opts.employerTin}`,
        `# Employer Name: ${opts.employerName}`,
        `# Generated: ${new Date().toISOString()}`,
    ];

    const lines = [
        ...meta,
        header.join(","),
        ...rows.map((r) =>
            [
                r.sequenceNumber,
                csv(r.tin),
                csv(r.lastName),
                csv(r.firstName),
                csv(r.middleName),
                r.employmentClassification,
                r.taxStatus,
                r.isMWE ? "Y" : "N",
                r.grossCompensation.toFixed(2),
                r.nonTaxableCompensation.toFixed(2),
                r.taxableCompensation.toFixed(2),
                r.taxWithheld.toFixed(2),
                r.taxDue.toFixed(2),
                r.overUnderWithheld.toFixed(2),
                r.prevEmployerIncome.toFixed(2),
                r.prevEmployerTax.toFixed(2),
                r.separationDate ?? "",
                r.separationType ?? "",
            ].join(","),
        ),
    ];

    return lines.join("\r\n") + "\r\n";
}

/** XLSX — minimal SpreadsheetML 2003 (.xls) compatible XML. Excel & LibreOffice open it. */
export function exportAlphalistXlsx(
    rows: AlphalistRow[],
    opts: ExportOptions,
): string {
    // Use XML Spreadsheet 2003 to avoid xlsx library dependency.
    const xmlRows = rows
        .map(
            (r) => `
   <Row>
    <Cell><Data ss:Type="Number">${r.sequenceNumber}</Data></Cell>
    <Cell><Data ss:Type="String">${xml(r.tin)}</Data></Cell>
    <Cell><Data ss:Type="String">${xml(r.lastName)}</Data></Cell>
    <Cell><Data ss:Type="String">${xml(r.firstName)}</Data></Cell>
    <Cell><Data ss:Type="String">${xml(r.middleName)}</Data></Cell>
    <Cell><Data ss:Type="String">${r.employmentClassification}</Data></Cell>
    <Cell><Data ss:Type="String">${r.taxStatus}</Data></Cell>
    <Cell><Data ss:Type="String">${r.isMWE ? "Y" : "N"}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.grossCompensation.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.nonTaxableCompensation.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.taxableCompensation.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.taxWithheld.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.taxDue.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.overUnderWithheld.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.prevEmployerIncome.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.prevEmployerTax.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">${xml(r.separationDate ?? "")}</Data></Cell>
    <Cell><Data ss:Type="String">${xml(r.separationType ?? "")}</Data></Cell>
   </Row>`,
        )
        .join("");

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Alphalist">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Sequence</Data></Cell>
    <Cell><Data ss:Type="String">TIN</Data></Cell>
    <Cell><Data ss:Type="String">LastName</Data></Cell>
    <Cell><Data ss:Type="String">FirstName</Data></Cell>
    <Cell><Data ss:Type="String">MiddleName</Data></Cell>
    <Cell><Data ss:Type="String">Classification</Data></Cell>
    <Cell><Data ss:Type="String">TaxStatus</Data></Cell>
    <Cell><Data ss:Type="String">IsMWE</Data></Cell>
    <Cell><Data ss:Type="String">GrossCompensation</Data></Cell>
    <Cell><Data ss:Type="String">NonTaxableCompensation</Data></Cell>
    <Cell><Data ss:Type="String">TaxableCompensation</Data></Cell>
    <Cell><Data ss:Type="String">TaxWithheld</Data></Cell>
    <Cell><Data ss:Type="String">TaxDue</Data></Cell>
    <Cell><Data ss:Type="String">OverUnderWithheld</Data></Cell>
    <Cell><Data ss:Type="String">PrevEmployerIncome</Data></Cell>
    <Cell><Data ss:Type="String">PrevEmployerTax</Data></Cell>
    <Cell><Data ss:Type="String">SeparationDate</Data></Cell>
    <Cell><Data ss:Type="String">SeparationType</Data></Cell>
   </Row>${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

/**
 * BIR DAT — pipe-delimited starter layout.
 * NOTE: The actual BIR Alphalist DAT format is governed by the eFPS
 * Alphalist Data Entry module. This implementation produces a
 * pipe-delimited file with the most common fields. Verify alignment
 * with the current BIR spec before production submission.
 */
export function exportAlphalistDat(
    rows: AlphalistRow[],
    opts: ExportOptions,
): string {
    const scheduleCode =
        opts.schedule === "schedule_1" ? "S1" : opts.schedule === "schedule_2" ? "S2" : "BO";
    const header =
        `H1|${opts.employerTin}|${opts.employerName}|${opts.year}|${opts.schedule}|${rows.length}`;
    const detail = rows.map((r) =>
        [
            scheduleCode,
            r.sequenceNumber,
            r.tin,
            r.lastName,
            r.firstName,
            r.middleName,
            r.employmentClassification,
            r.taxStatus,
            r.isMWE ? "Y" : "N",
            r.grossCompensation.toFixed(2),
            r.nonTaxableCompensation.toFixed(2),
            r.taxableCompensation.toFixed(2),
            r.taxWithheld.toFixed(2),
            r.taxDue.toFixed(2),
            r.overUnderWithheld.toFixed(2),
            r.prevEmployerIncome.toFixed(2),
            r.prevEmployerTax.toFixed(2),
            r.separationDate ?? "",
            r.separationType ?? "",
        ].join("|"),
    );
    return [header, ...detail].join("\r\n") + "\r\n";
}

/** Trigger a browser download of the given content. */
export function downloadFile(
    content: string,
    filename: string,
    mime: string,
): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── helpers ─────────────────────────────────────────────────
function csv(s: string): string {
    if (s == null) return "";
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}
function xml(s: string): string {
    if (s == null) return "";
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
