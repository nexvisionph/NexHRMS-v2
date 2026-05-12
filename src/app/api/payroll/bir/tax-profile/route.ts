/**
 * GET  /api/payroll/bir/tax-profile?employeeId=
 * POST /api/payroll/bir/tax-profile
 *      body: EmployeeTaxProfile fields
 *
 * Manages per-employee BIR tax profiles. Mirrors selected fields back to the
 * employees table so existing payroll code can read them inline.
 *
 * Auth: admin / hr / finance / payroll_admin
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBIRRole, logBIRAudit } from "../_helpers";

const ALLOWED = ["admin", "hr", "finance", "payroll_admin"] as const;

export async function GET(req: NextRequest) {
    const auth = await requireBIRRole(ALLOWED);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");

    let q = auth.adminClient.from("employee_tax_profiles").select("*");
    if (employeeId) q = q.eq("employee_id", employeeId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
    const auth = await requireBIRRole(ALLOWED);
    if (!auth.ok) return auth.response;

    let body: {
        employeeId?: string;
        tin?: string;
        employmentClassification?: string;
        isMWE?: boolean;
        mweDailyRate?: number;
        substitutedFiling?: boolean;
        taxStatus?: string;
        taxResidency?: string;
        separationDate?: string;
        separationType?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
    }

    if (!body.employeeId) {
        return NextResponse.json({ ok: false, message: "employeeId required" }, { status: 400 });
    }

    const tinNorm = body.tin ? normalizeTin(body.tin) : null;
    if (body.tin && !tinNorm) {
        return NextResponse.json(
            { ok: false, message: "Invalid TIN format (expect 9 or 12 digits)" },
            { status: 400 },
        );
    }

    const profileRow = {
        employee_id: body.employeeId,
        tin: tinNorm,
        employment_classification: body.employmentClassification ?? "R",
        is_mwe: !!body.isMWE,
        mwe_daily_rate: body.mweDailyRate ?? null,
        substituted_filing: !!body.substitutedFiling,
        tax_status: body.taxStatus ?? "S",
        tax_residency: body.taxResidency ?? "resident",
        separation_date: body.separationDate ?? null,
        separation_type: body.separationType ?? null,
        updated_at: new Date().toISOString(),
    };

    const { data: profile, error: pErr } = await auth.adminClient
        .from("employee_tax_profiles")
        .upsert(profileRow, { onConflict: "employee_id" })
        .select()
        .single();
    if (pErr) {
        return NextResponse.json({ ok: false, message: pErr.message }, { status: 500 });
    }

    // Mirror to employees table (used by payroll engine)
    const { error: eErr } = await auth.adminClient
        .from("employees")
        .update({
            tin: tinNorm,
            employment_classification: profileRow.employment_classification,
            is_mwe: profileRow.is_mwe,
            mwe_daily_rate: profileRow.mwe_daily_rate,
            substituted_filing: profileRow.substituted_filing,
            tax_status: profileRow.tax_status,
            tax_residency: profileRow.tax_residency,
            separation_date: profileRow.separation_date,
            separation_type: profileRow.separation_type,
        })
        .eq("id", body.employeeId);
    if (eErr) {
        // Mirror failure is logged but non-fatal — profile table is source of truth.
        console.warn("employees mirror failed:", eErr);
    }

    await logBIRAudit(auth.adminClient, auth.employee.id, "tax_profile.upsert", {
        employeeId: body.employeeId,
        isMWE: profileRow.is_mwe,
        substitutedFiling: profileRow.substituted_filing,
        taxStatus: profileRow.tax_status,
    });

    return NextResponse.json({ ok: true, data: profile });
}

function normalizeTin(tin: string): string | null {
    const digits = tin.replace(/\D/g, "");
    if (digits.length !== 9 && digits.length !== 12) return null;
    if (digits.length === 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}-000`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}
