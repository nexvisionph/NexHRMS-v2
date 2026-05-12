/**
 * GET  /api/payroll/bir/alphalist?year=&schedule=
 *      → builds & returns Alphalist rows (in-memory, not stored)
 * POST /api/payroll/bir/alphalist
 *      body: { year, schedule, exportFormat, employerTin, employerName }
 *      → records the export in alphalist_exports and returns metadata
 *
 * The actual file generation/download happens client-side via lib/bir-export.
 *
 * Auth: admin / finance / payroll_admin
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBIRRole, logBIRAudit } from "../_helpers";
import { buildAlphalist } from "@/lib/alphalist-generator";
import { validateAlphalist, summarize } from "@/lib/bir-validation";
import type {
    AlphalistScheduleType,
    Employee,
    EmployeeTaxProfile,
    AnnualTaxSummary,
} from "@/types";

export async function GET(req: NextRequest) {
    const auth = await requireBIRRole();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const schedule = (searchParams.get("schedule") ?? "both") as AlphalistScheduleType;
    if (!Number.isFinite(year) || year < 2000) {
        return NextResponse.json({ ok: false, message: "Invalid year" }, { status: 400 });
    }

    const [employees, profiles, summaries] = await Promise.all([
        auth.adminClient.from("employees").select("*"),
        auth.adminClient.from("employee_tax_profiles").select("*"),
        auth.adminClient.from("annual_tax_summaries").select("*").eq("year", year),
    ]);

    if (employees.error || profiles.error || summaries.error) {
        return NextResponse.json(
            {
                ok: false,
                message:
                    employees.error?.message ??
                    profiles.error?.message ??
                    summaries.error?.message,
            },
            { status: 500 },
        );
    }

    const empRows = (employees.data ?? []).map(rowToEmployee);
    const profRows = (profiles.data ?? []).map(rowToProfile);
    const sumRows = (summaries.data ?? []).map(rowToSummary);

    const built = buildAlphalist({
        year,
        schedule,
        employees: empRows,
        profiles: profRows,
        summaries: sumRows,
    });

    const issues = validateAlphalist({
        employees: empRows,
        profiles: profRows,
        summaries: sumRows,
        year,
    });
    const validation = summarize(issues);

    return NextResponse.json({
        ok: true,
        data: { ...built, issues, validation },
    });
}

export async function POST(req: NextRequest) {
    const auth = await requireBIRRole();
    if (!auth.ok) return auth.response;

    let body: {
        year?: number;
        schedule?: AlphalistScheduleType;
        exportFormat?: "csv" | "xlsx" | "dat";
        employerTin?: string;
        employerName?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
    }

    const { year, schedule, exportFormat } = body;
    if (!year || !schedule || !exportFormat) {
        return NextResponse.json(
            { ok: false, message: "year, schedule, exportFormat required" },
            { status: 400 },
        );
    }

    const [employees, profiles, summaries] = await Promise.all([
        auth.adminClient.from("employees").select("*"),
        auth.adminClient.from("employee_tax_profiles").select("*"),
        auth.adminClient.from("annual_tax_summaries").select("*").eq("year", year),
    ]);

    if (employees.error || profiles.error || summaries.error) {
        return NextResponse.json(
            { ok: false, message: "Failed to fetch source rows" },
            { status: 500 },
        );
    }

    const empRows = (employees.data ?? []).map(rowToEmployee);
    const profRows = (profiles.data ?? []).map(rowToProfile);
    const sumRows = (summaries.data ?? []).map(rowToSummary);

    const built = buildAlphalist({
        year,
        schedule,
        employees: empRows,
        profiles: profRows,
        summaries: sumRows,
    });
    const issues = validateAlphalist({
        employees: empRows,
        profiles: profRows,
        summaries: sumRows,
        year,
    });
    const validation = summarize(issues);

    if (validation.status === "has_errors") {
        return NextResponse.json(
            {
                ok: false,
                message: "Cannot export — validation errors must be fixed first.",
                issues,
            },
            { status: 422 },
        );
    }

    // Persist export record (no file storage — file is generated client-side)
    const { data: record, error } = await auth.adminClient
        .from("alphalist_exports")
        .insert({
            year,
            schedule_type: schedule,
            generated_by: auth.employee.id,
            employee_count: built.totals.employeeCount,
            total_taxable_comp: built.totals.totalTaxableComp,
            total_tax_withheld: built.totals.totalTaxWithheld,
            validation_status: validation.status,
            validation_errors: issues.length > 0 ? issues : null,
            export_format: exportFormat,
            efps_status: "ready",
        })
        .select()
        .single();
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    // Mark related summaries as 'exported'
    await auth.adminClient
        .from("annual_tax_summaries")
        .update({ status: "exported", updated_at: new Date().toISOString() })
        .eq("year", year)
        .eq("status", "finalized");

    await logBIRAudit(auth.adminClient, auth.employee.id, "alphalist.export", {
        year,
        schedule,
        format: exportFormat,
        employees: built.totals.employeeCount,
    });

    return NextResponse.json({
        ok: true,
        data: { record, rows: built, issues, validation },
    });
}

// ── Mappers ──────────────────────────────────────────────────
type EmpRow = {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    status: string;
    work_type: string;
    salary: number;
    join_date: string;
    productivity: number;
    location: string;
    tin: string | null;
    employment_classification: string | null;
    is_mwe: boolean | null;
    mwe_daily_rate: number | null;
    substituted_filing: boolean | null;
    tax_status: string | null;
    tax_residency: string | null;
    separation_date: string | null;
    separation_type: string | null;
};
function rowToEmployee(r: EmpRow): Employee {
    return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        department: r.department,
        status: r.status as Employee["status"],
        workType: r.work_type as Employee["workType"],
        salary: Number(r.salary),
        joinDate: r.join_date,
        productivity: Number(r.productivity ?? 0),
        location: r.location,
        tin: r.tin ?? undefined,
        employmentClassification:
            (r.employment_classification as Employee["employmentClassification"]) ?? undefined,
        isMWE: r.is_mwe ?? undefined,
        mweDailyRate: r.mwe_daily_rate ?? undefined,
        substitutedFiling: r.substituted_filing ?? undefined,
        taxStatus: (r.tax_status as Employee["taxStatus"]) ?? undefined,
        taxResidency: (r.tax_residency as Employee["taxResidency"]) ?? undefined,
        separationDate: r.separation_date ?? undefined,
        separationType: (r.separation_type as Employee["separationType"]) ?? undefined,
    };
}

type ProfRow = {
    id: string;
    employee_id: string;
    tin: string | null;
    employment_classification: string;
    is_mwe: boolean;
    mwe_daily_rate: number | null;
    substituted_filing: boolean;
    tax_status: string;
    tax_residency: string;
    separation_date: string | null;
    separation_type: string | null;
    prev_employer_tin: string | null;
    prev_employer_name: string | null;
    prev_income: number | null;
    prev_tax_withheld: number | null;
    prev_2316_received: boolean;
    created_at: string;
    updated_at: string;
};
function rowToProfile(r: ProfRow): EmployeeTaxProfile {
    return {
        id: r.id,
        employeeId: r.employee_id,
        tin: r.tin ?? undefined,
        employmentClassification: r.employment_classification as EmployeeTaxProfile["employmentClassification"],
        isMWE: r.is_mwe,
        mweDailyRate: r.mwe_daily_rate ?? undefined,
        substitutedFiling: r.substituted_filing,
        taxStatus: r.tax_status as EmployeeTaxProfile["taxStatus"],
        taxResidency: r.tax_residency as EmployeeTaxProfile["taxResidency"],
        prevEmployerTin: r.prev_employer_tin ?? undefined,
        prevEmployerName: r.prev_employer_name ?? undefined,
        prevIncome: r.prev_income ?? undefined,
        prevTaxWithheld: r.prev_tax_withheld ?? undefined,
        prev2316Received: r.prev_2316_received,
        separationDate: r.separation_date ?? undefined,
        separationType: (r.separation_type as EmployeeTaxProfile["separationType"]) ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

type SumRow = {
    id: string;
    employee_id: string;
    year: number;
    total_taxable_comp: number;
    total_non_taxable_comp: number;
    total_de_minimis: number;
    total_sss: number;
    total_philhealth: number;
    total_pagibig: number;
    total_13th_non_taxable: number;
    total_13th_taxable: number;
    total_other_benefits: number;
    total_tax_withheld: number;
    prev_employer_income: number;
    prev_employer_tax: number;
    annual_tax_due: number | null;
    adjustment_type: string | null;
    adjustment_amount: number | null;
    status: string;
    finalized_at: string | null;
    finalized_by: string | null;
    created_at: string;
    updated_at: string;
};
function rowToSummary(r: SumRow): AnnualTaxSummary {
    return {
        id: r.id,
        employeeId: r.employee_id,
        year: r.year,
        totalTaxableComp: Number(r.total_taxable_comp),
        totalNonTaxableComp: Number(r.total_non_taxable_comp),
        totalDeMinimis: Number(r.total_de_minimis),
        totalSSS: Number(r.total_sss),
        totalPhilHealth: Number(r.total_philhealth),
        totalPagIBIG: Number(r.total_pagibig),
        total13thNonTaxable: Number(r.total_13th_non_taxable),
        total13thTaxable: Number(r.total_13th_taxable),
        totalOtherBenefits: Number(r.total_other_benefits),
        totalTaxWithheld: Number(r.total_tax_withheld),
        prevEmployerIncome: Number(r.prev_employer_income),
        prevEmployerTax: Number(r.prev_employer_tax),
        annualTaxDue: r.annual_tax_due == null ? undefined : Number(r.annual_tax_due),
        adjustmentType: (r.adjustment_type as AnnualTaxSummary["adjustmentType"]) ?? undefined,
        adjustmentAmount: r.adjustment_amount == null ? undefined : Number(r.adjustment_amount),
        status: r.status as AnnualTaxSummary["status"],
        finalizedAt: r.finalized_at ?? undefined,
        finalizedBy: r.finalized_by ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}
