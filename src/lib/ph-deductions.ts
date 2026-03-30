/**
 * Philippine Government Deduction Calculators — 2026
 * All functions take MONTHLY gross and return the EMPLOYEE share.
 *
 * Sources:
 *   SSS   — RA 11199 (SSS Act of 2018), 2025-2026 contribution schedule
 *            Total rate 15%, MSC range ₱4,000–₱35,000
 *   PhilHealth — RA 11223 (UHC Act), 5% premium, ceiling ₱100,000
 *   Pag-IBIG — RA 9679, employee cap ₱100
 *   BIR   — RA 10963 (TRAIN Law), revised tax table 2023 onwards
 */

// ─── SSS 2026 Contribution Table ─────────────────────────────
// Total rate 15% (EE 4.5%, ER 9.5%, EC 1%)
// MSC range: ₱4,000 (min) – ₱35,000 (max)
// EE min ₱180, max ₱1,575
export function computeSSS(monthlyGross: number): number {
    if (monthlyGross <= 4250) return 180;          // MSC ₱4,000
    if (monthlyGross >= 34750) return 1575;         // MSC ₱35,000
    // Approximate: 4.5% of salary credit rounded to nearest ₱500 bracket
    const credit = Math.min(35000, Math.max(4000, Math.round(monthlyGross / 500) * 500));
    return Math.round(credit * 0.045 * 100) / 100;
}

// ─── PhilHealth 2026 ─────────────────────────────────────────
// 5% of basic salary, split equally → employee share = 2.5%
// Floor ₱10,000 (min EE ₱250), ceiling ₱100,000 (max EE ₱2,500)
export function computePhilHealth(monthlyGross: number): number {
    if (monthlyGross <= 10000) return 250;
    if (monthlyGross >= 100000) return 2500;
    return Math.round(monthlyGross * 0.025 * 100) / 100;
}

// ─── Pag-IBIG 2026 ──────────────────────────────────────────
// Employee share: 2% if salary > ₱1,500, capped at ₱100/month
export function computePagIBIG(monthlyGross: number): number {
    if (monthlyGross <= 1500) return Math.round(monthlyGross * 0.01);
    return 100; // max ₱100 employee share
}

// ─── BIR Withholding Tax (TRAIN Law — RA 10963, 2023+) ──────
// Monthly tax table based on taxable income (gross − SSS − PhilHealth − Pag-IBIG)
export function computeWithholdingTax(taxableIncome: number): number {
    if (taxableIncome <= 20833) return 0;                                          // ≤250K/yr exempt
    if (taxableIncome <= 33333) return Math.round((taxableIncome - 20833) * 0.15); // 15%
    if (taxableIncome <= 66667) return 1875 + Math.round((taxableIncome - 33333) * 0.20); // 20%
    if (taxableIncome <= 166667) return 8542 + Math.round((taxableIncome - 66667) * 0.25); // 25%
    if (taxableIncome <= 666667) return 33542 + Math.round((taxableIncome - 166667) * 0.30); // 30%
    return 183542 + Math.round((taxableIncome - 666667) * 0.35); // 35%
}

// ─── All-in-one helper ───────────────────────────────────────
export interface PHDeductions {
    sss: number;
    philHealth: number;
    pagIBIG: number;
    withholdingTax: number;
    totalDeductions: number;
}

export function computeAllPHDeductions(monthlyGross: number): PHDeductions {
    const sss = computeSSS(monthlyGross);
    const philHealth = computePhilHealth(monthlyGross);
    const pagIBIG = computePagIBIG(monthlyGross);
    const taxableIncome = monthlyGross - sss - philHealth - pagIBIG;
    const withholdingTax = computeWithholdingTax(Math.max(0, taxableIncome));
    return {
        sss,
        philHealth,
        pagIBIG,
        withholdingTax,
        totalDeductions: sss + philHealth + pagIBIG + withholdingTax,
    };
}
