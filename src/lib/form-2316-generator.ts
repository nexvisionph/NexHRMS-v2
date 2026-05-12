/**
 * BIR Form 2316 — Certificate of Compensation Payment / Tax Withheld
 * --------------------------------------------------------------
 * Produces a print-ready HTML representation of BIR Form 2316
 * for an `AnnualTaxSummary`.
 *
 * NOT a server-side PDF generator — uses the browser's native print()
 * pattern (same as printable-payslip.tsx) to produce an A4 PDF via
 * "Save as PDF". This keeps the bundle slim and avoids Puppeteer.
 *
 * Reference: BIR Form 2316 (Jan 2018 ENCS), bir_alphalist.md §4
 */

import type {
    AnnualTaxSummary,
    Employee,
    EmployeeTaxProfile,
    PreviousEmployerRecord,
} from "@/types";

export interface Form2316TemplateData {
    summary: AnnualTaxSummary;
    employee: Pick<
        Employee,
        "id" | "name" | "address" | "phone" | "birthday" | "department" | "jobTitle"
    >;
    profile: EmployeeTaxProfile;
    prevEmployers: PreviousEmployerRecord[];
    employer: {
        name: string;
        tin: string;
        address: string;
        rdoCode?: string;
    };
    signatoryName: string;
    signatoryPosition: string;
    signatoryDate: string;
}

/** Render Form 2316 to HTML — caller injects into `printWindow`. */
export function renderForm2316HTML(data: Form2316TemplateData): string {
    const { summary, employee, profile, prevEmployers, employer } = data;
    const fmt = (n: number) =>
        n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const totalGross =
        summary.totalTaxableComp +
        summary.totalNonTaxableComp -
        // back out gov contribs since they're under non-taxable
        summary.totalSSS -
        summary.totalPhilHealth -
        summary.totalPagIBIG;

    return `<!DOCTYPE html>
<html>
<head>
    <title>BIR Form 2316 — ${escapeHtml(employee.name)} — ${summary.year}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; padding: 18px; font-size: 10px; color: #000; }
        h1 { text-align: center; font-size: 14px; letter-spacing: 1px; margin-bottom: 4px; }
        h2 { text-align: center; font-size: 11px; margin-bottom: 10px; }
        .subhead { text-align: center; font-size: 9px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
        .section-title { background: #e5e5e5; font-weight: bold; font-size: 10px; }
        .label { font-size: 8px; color: #333; text-transform: uppercase; }
        .value { font-size: 11px; font-weight: 600; }
        .right { text-align: right; }
        .center { text-align: center; }
        .small { font-size: 8px; }
        .signatures { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .sig-block { border-top: 1px solid #000; padding-top: 4px; text-align: center; margin-top: 60px; }
        .footer { margin-top: 16px; font-size: 8px; text-align: center; color: #555; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h1>BIR FORM No. 2316</h1>
    <h2>Certificate of Compensation Payment / Tax Withheld</h2>
    <p class="subhead">For Compensation Payment With or Without Tax Withheld &mdash; For the Year ${summary.year}</p>

    <table>
        <tr>
            <td colspan="4" class="section-title">Part I — Employee Information</td>
        </tr>
        <tr>
            <td><div class="label">TIN</div><div class="value">${escapeHtml(profile.tin ?? "—")}</div></td>
            <td><div class="label">Employee Name</div><div class="value">${escapeHtml(employee.name)}</div></td>
            <td><div class="label">Tax Status</div><div class="value">${escapeHtml(profile.taxStatus)}</div></td>
            <td><div class="label">Date of Birth</div><div class="value">${escapeHtml(employee.birthday ?? "—")}</div></td>
        </tr>
        <tr>
            <td colspan="2"><div class="label">Registered Address</div><div class="value">${escapeHtml(employee.address ?? "—")}</div></td>
            <td><div class="label">Position</div><div class="value">${escapeHtml(employee.jobTitle ?? employee.department)}</div></td>
            <td><div class="label">Telephone</div><div class="value">${escapeHtml(employee.phone ?? "—")}</div></td>
        </tr>
        <tr>
            <td colspan="2"><div class="label">Classification</div><div class="value">${escapeHtml(profile.employmentClassification)}${profile.isMWE ? " — Minimum Wage Earner (MWE)" : ""}</div></td>
            <td><div class="label">Substituted Filing</div><div class="value">${profile.substitutedFiling ? "Yes" : "No"}</div></td>
            <td><div class="label">Tax Residency</div><div class="value">${escapeHtml(profile.taxResidency)}</div></td>
        </tr>
    </table>

    <table>
        <tr>
            <td colspan="4" class="section-title">Part II — Present Employer</td>
        </tr>
        <tr>
            <td><div class="label">Employer TIN</div><div class="value">${escapeHtml(employer.tin)}</div></td>
            <td colspan="2"><div class="label">Employer Name</div><div class="value">${escapeHtml(employer.name)}</div></td>
            <td><div class="label">RDO Code</div><div class="value">${escapeHtml(employer.rdoCode ?? "—")}</div></td>
        </tr>
        <tr>
            <td colspan="4"><div class="label">Address</div><div class="value">${escapeHtml(employer.address)}</div></td>
        </tr>
    </table>

    ${
        prevEmployers.length > 0
            ? `<table>
        <tr><td colspan="4" class="section-title">Part III — Previous Employer(s) for ${summary.year}</td></tr>
        ${prevEmployers
            .map(
                (p) => `<tr>
            <td><div class="label">TIN</div><div class="value">${escapeHtml(p.employerTin ?? "—")}</div></td>
            <td><div class="label">Employer</div><div class="value">${escapeHtml(p.employerName)}</div></td>
            <td class="right"><div class="label">Gross Compensation</div><div class="value">${fmt(p.totalIncome)}</div></td>
            <td class="right"><div class="label">Tax Withheld</div><div class="value">${fmt(p.totalTaxWithheld)}</div></td>
        </tr>`,
            )
            .join("")}
    </table>`
            : ""
    }

    <table>
        <tr><td colspan="2" class="section-title">Part IV.A — Summary</td></tr>
        <tr>
            <td>21. Gross Compensation Income (Present Employer)</td>
            <td class="right">${fmt(totalGross)}</td>
        </tr>
        <tr>
            <td>22. Less: Non-Taxable / Exempt Compensation Income</td>
            <td class="right">${fmt(summary.totalNonTaxableComp)}</td>
        </tr>
        <tr>
            <td>23. Taxable Compensation Income (Present Employer)</td>
            <td class="right">${fmt(summary.totalTaxableComp)}</td>
        </tr>
        <tr>
            <td>24. Add: Taxable Compensation from Previous Employer(s)</td>
            <td class="right">${fmt(summary.prevEmployerIncome)}</td>
        </tr>
        <tr>
            <td><b>25. Gross Taxable Compensation Income</b></td>
            <td class="right"><b>${fmt(summary.totalTaxableComp + summary.prevEmployerIncome)}</b></td>
        </tr>
        <tr>
            <td>26. Tax Due</td>
            <td class="right">${fmt(summary.annualTaxDue ?? 0)}</td>
        </tr>
        <tr>
            <td>27. Amount of Taxes Withheld (Present Employer)</td>
            <td class="right">${fmt(summary.totalTaxWithheld)}</td>
        </tr>
        <tr>
            <td>28. Amount of Taxes Withheld (Previous Employer)</td>
            <td class="right">${fmt(summary.prevEmployerTax)}</td>
        </tr>
        <tr>
            <td><b>29. Total Amount of Taxes Withheld</b></td>
            <td class="right"><b>${fmt(summary.totalTaxWithheld + summary.prevEmployerTax)}</b></td>
        </tr>
        <tr>
            <td>30. ${
                summary.adjustmentType === "over_withheld"
                    ? "Tax Refund Due to Employee"
                    : summary.adjustmentType === "under_withheld"
                      ? "Tax Still Due / Collectible"
                      : "Balanced (No Adjustment)"
            }</td>
            <td class="right">${fmt(Math.abs(summary.adjustmentAmount ?? 0))}</td>
        </tr>
    </table>

    <table>
        <tr><td colspan="2" class="section-title">Part IV.B — Non-Taxable / Exempt Breakdown</td></tr>
        <tr><td>13th-Month Pay &amp; Other Benefits (within ₱90,000)</td><td class="right">${fmt(summary.total13thNonTaxable)}</td></tr>
        <tr><td>De Minimis Benefits</td><td class="right">${fmt(summary.totalDeMinimis)}</td></tr>
        <tr><td>SSS Contribution</td><td class="right">${fmt(summary.totalSSS)}</td></tr>
        <tr><td>PhilHealth Contribution</td><td class="right">${fmt(summary.totalPhilHealth)}</td></tr>
        <tr><td>Pag-IBIG Contribution</td><td class="right">${fmt(summary.totalPagIBIG)}</td></tr>
        ${profile.isMWE ? `<tr><td>Minimum Wage Earner Exempt Compensation</td><td class="right">included above</td></tr>` : ""}
    </table>

    <div class="signatures">
        <div>
            <div class="sig-block">
                <b>${escapeHtml(data.signatoryName)}</b><br/>
                <span class="small">${escapeHtml(data.signatoryPosition)}<br/>(Authorized Officer / Signature over Printed Name)</span>
            </div>
        </div>
        <div>
            <div class="sig-block">
                <b>${escapeHtml(employee.name)}</b><br/>
                <span class="small">Employee (Signature over Printed Name)<br/>Date: ${escapeHtml(data.signatoryDate)}</span>
            </div>
        </div>
    </div>

    <p class="footer">
        I declare under the penalties of perjury that this certificate has been made in good faith,
        verified by me, and to the best of my knowledge and belief, is true and correct, pursuant to
        the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof.
        ${
            profile.substitutedFiling
                ? `<br/><br/><b>SUBSTITUTED FILING:</b> This Form 2316 is being filed by the present employer in lieu of BIR Form 1700.`
                : ""
        }
    </p>
</body>
</html>`;
}

function escapeHtml(s: string | undefined | null): string {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Compute a deterministic SHA-256 hash of the rendered HTML for tamper detection. */
export async function hashForm2316(html: string): Promise<string> {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(html));
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
