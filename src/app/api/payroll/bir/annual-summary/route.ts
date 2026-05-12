/**
 * GET  /api/payroll/bir/annual-summary?year=2025[&employeeId=]
 * POST /api/payroll/bir/annual-summary
 *   body: { employeeId, year, action: 'rebuild' | 'finalize' | 'reopen' }
 *
 * Auth: admin / finance / payroll_admin
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBIRRole, logBIRAudit } from "../_helpers";
import { buildAnnualSummary } from "@/lib/annual-tax-engine";
import type { Payslip, PreviousEmployerRecord, AnnualTaxSummary } from "@/types";

export async function GET(req: NextRequest) {
    const auth = await requireBIRRole();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const employeeId = searchParams.get("employeeId");

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
        return NextResponse.json(
            { ok: false, message: "Invalid year" },
            { status: 400 },
        );
    }

    let q = auth.adminClient
        .from("annual_tax_summaries")
        .select("*")
        .eq("year", year);
    if (employeeId) q = q.eq("employee_id", employeeId);

    const { data, error } = await q;
    if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
    const auth = await requireBIRRole();
    if (!auth.ok) return auth.response;

    let body: { employeeId?: string; year?: number; action?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
    }

    const { employeeId, year, action } = body;
    if (!employeeId || !year || !action) {
        return NextResponse.json(
            { ok: false, message: "employeeId, year, action are required" },
            { status: 400 },
        );
    }

    if (action === "rebuild") {
        // Pull all payslips for that employee+year
        const { data: payslips, error: psErr } = await auth.adminClient
            .from("payslips")
            .select(
                "id, employee_id, period_start, period_end, gross_pay, net_pay, status, " +
                    "tax_categories, taxable_compensation, non_taxable_compensation, " +
                    "sss_deduction, philhealth_deduction, pagibig_deduction, tax_deduction",
            )
            .eq("employee_id", employeeId)
            .gte("period_start", `${year}-01-01`)
            .lte("period_end", `${year}-12-31`);
        if (psErr) {
            return NextResponse.json({ ok: false, message: psErr.message }, { status: 500 });
        }

        // Pull previous-employer records for that year
        const { data: prev } = await auth.adminClient
            .from("previous_employer_records")
            .select("*")
            .eq("employee_id", employeeId)
            .eq("year", year);

        const summary = buildAnnualSummary({
            employeeId,
            year,
            payslips: ((payslips ?? []) as unknown as DbPayslipRow[]).map(rowToPayslip),
            prevEmployerRecords: ((prev ?? []) as unknown as DbPrevRow[]).map(rowToPrev),
        });

        const dbRow = summaryToRow(summary);
        const { data: existing } = await auth.adminClient
            .from("annual_tax_summaries")
            .select("id, status")
            .eq("employee_id", employeeId)
            .eq("year", year)
            .maybeSingle();

        if (existing && (existing.status === "finalized" || existing.status === "exported")) {
            return NextResponse.json(
                { ok: false, message: "Cannot rebuild a finalized summary. Reopen first." },
                { status: 409 },
            );
        }

        const upsert = await auth.adminClient
            .from("annual_tax_summaries")
            .upsert(
                { ...dbRow, id: existing?.id ?? dbRow.id },
                { onConflict: "employee_id,year" },
            )
            .select()
            .single();

        if (upsert.error) {
            return NextResponse.json(
                { ok: false, message: upsert.error.message },
                { status: 500 },
            );
        }

        await logBIRAudit(auth.adminClient, auth.employee.id, "annual_summary.rebuild", {
            employeeId,
            year,
            adjustment: summary.adjustmentAmount,
        });
        return NextResponse.json({ ok: true, data: upsert.data });
    }

    if (action === "finalize") {
        const { data, error } = await auth.adminClient
            .from("annual_tax_summaries")
            .update({
                status: "finalized",
                finalized_at: new Date().toISOString(),
                finalized_by: auth.employee.id,
                updated_at: new Date().toISOString(),
            })
            .eq("employee_id", employeeId)
            .eq("year", year)
            .eq("status", "reconciled")
            .select()
            .maybeSingle();

        if (error) {
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json(
                { ok: false, message: "No reconciled summary to finalize" },
                { status: 404 },
            );
        }
        await logBIRAudit(auth.adminClient, auth.employee.id, "annual_summary.finalize", {
            employeeId,
            year,
        });
        return NextResponse.json({ ok: true, data });
    }

    if (action === "reopen") {
        const { data, error } = await auth.adminClient
            .from("annual_tax_summaries")
            .update({
                status: "open",
                finalized_at: null,
                finalized_by: null,
                updated_at: new Date().toISOString(),
            })
            .eq("employee_id", employeeId)
            .eq("year", year)
            .neq("status", "exported")
            .select()
            .maybeSingle();
        if (error) {
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Cannot reopen — already exported, or summary not found",
                },
                { status: 409 },
            );
        }
        await logBIRAudit(auth.adminClient, auth.employee.id, "annual_summary.reopen", {
            employeeId,
            year,
        });
        return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
        { ok: false, message: `Unknown action: ${action}` },
        { status: 400 },
    );
}

// ── Mappers ──────────────────────────────────────────────────
type DbPayslipRow = {
    id: string;
    employee_id: string;
    period_start: string;
    period_end: string;
    gross_pay: number;
    net_pay: number;
    status: string;
    tax_categories: unknown;
    taxable_compensation: number | null;
    non_taxable_compensation: number | null;
    sss_deduction: number;
    philhealth_deduction: number;
    pagibig_deduction: number;
    tax_deduction: number;
};

function rowToPayslip(r: DbPayslipRow): Payslip {
    return {
        id: r.id,
        employeeId: r.employee_id,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        grossPay: Number(r.gross_pay),
        allowances: 0,
        sssDeduction: Number(r.sss_deduction),
        philhealthDeduction: Number(r.philhealth_deduction),
        pagibigDeduction: Number(r.pagibig_deduction),
        taxDeduction: Number(r.tax_deduction),
        otherDeductions: 0,
        loanDeduction: 0,
        netPay: Number(r.net_pay),
        issuedAt: r.period_end,
        status: r.status as Payslip["status"],
        taxCategories: (r.tax_categories ?? undefined) as Payslip["taxCategories"],
        taxableCompensation: r.taxable_compensation ?? undefined,
        nonTaxableCompensation: r.non_taxable_compensation ?? undefined,
    };
}

type DbPrevRow = {
    id: string;
    employee_id: string;
    year: number;
    employer_name: string;
    employer_tin: string | null;
    employer_address: string | null;
    total_income: number;
    total_tax_withheld: number;
    reference_2316: string | null;
    submitted_at: string;
    submitted_by: string | null;
    created_at: string;
};

function rowToPrev(r: DbPrevRow): PreviousEmployerRecord {
    return {
        id: r.id,
        employeeId: r.employee_id,
        year: r.year,
        employerName: r.employer_name,
        employerTin: r.employer_tin ?? undefined,
        employerAddress: r.employer_address ?? undefined,
        totalIncome: Number(r.total_income),
        totalTaxWithheld: Number(r.total_tax_withheld),
        reference2316: r.reference_2316 ?? undefined,
        submittedAt: r.submitted_at,
        submittedBy: r.submitted_by ?? undefined,
        createdAt: r.created_at,
    };
}

function summaryToRow(s: AnnualTaxSummary) {
    return {
        id: s.id,
        employee_id: s.employeeId,
        year: s.year,
        total_taxable_comp: s.totalTaxableComp,
        total_non_taxable_comp: s.totalNonTaxableComp,
        total_de_minimis: s.totalDeMinimis,
        total_sss: s.totalSSS,
        total_philhealth: s.totalPhilHealth,
        total_pagibig: s.totalPagIBIG,
        total_13th_non_taxable: s.total13thNonTaxable,
        total_13th_taxable: s.total13thTaxable,
        total_other_benefits: s.totalOtherBenefits,
        total_tax_withheld: s.totalTaxWithheld,
        prev_employer_income: s.prevEmployerIncome,
        prev_employer_tax: s.prevEmployerTax,
        annual_tax_due: s.annualTaxDue,
        adjustment_type: s.adjustmentType,
        adjustment_amount: s.adjustmentAmount,
        status: s.status,
        updated_at: new Date().toISOString(),
    };
}
