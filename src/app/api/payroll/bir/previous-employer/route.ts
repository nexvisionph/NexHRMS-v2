/**
 * GET    /api/payroll/bir/previous-employer?employeeId=&year=
 * POST   /api/payroll/bir/previous-employer
 *        body: { employeeId, year, employerName, employerTin?, employerAddress?,
 *                totalIncome, totalTaxWithheld, reference2316? }
 * DELETE /api/payroll/bir/previous-employer?id=
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
    const year = searchParams.get("year");

    let q = auth.adminClient.from("previous_employer_records").select("*");
    if (employeeId) q = q.eq("employee_id", employeeId);
    if (year) q = q.eq("year", Number(year));
    const { data, error } = await q.order("year", { ascending: false });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
    const auth = await requireBIRRole(ALLOWED);
    if (!auth.ok) return auth.response;

    let body: {
        employeeId?: string;
        year?: number;
        employerName?: string;
        employerTin?: string;
        employerAddress?: string;
        totalIncome?: number;
        totalTaxWithheld?: number;
        reference2316?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
    }

    const required = ["employeeId", "year", "employerName"] as const;
    for (const k of required) {
        if (!body[k]) {
            return NextResponse.json(
                { ok: false, message: `${k} is required` },
                { status: 400 },
            );
        }
    }
    if (
        !Number.isFinite(body.totalIncome) ||
        body.totalIncome! < 0 ||
        !Number.isFinite(body.totalTaxWithheld) ||
        body.totalTaxWithheld! < 0
    ) {
        return NextResponse.json(
            { ok: false, message: "totalIncome and totalTaxWithheld must be ≥ 0" },
            { status: 400 },
        );
    }

    const tinNorm = normalizeTin(body.employerTin);
    if (body.employerTin && !tinNorm) {
        return NextResponse.json(
            { ok: false, message: "Invalid employerTin format (expect 12 digits)" },
            { status: 400 },
        );
    }

    const { data, error } = await auth.adminClient
        .from("previous_employer_records")
        .upsert(
            {
                employee_id: body.employeeId,
                year: body.year,
                employer_name: body.employerName,
                employer_tin: tinNorm,
                employer_address: body.employerAddress ?? null,
                total_income: body.totalIncome,
                total_tax_withheld: body.totalTaxWithheld,
                reference_2316: body.reference2316 ?? null,
                submitted_by: auth.employee.id,
                submitted_at: new Date().toISOString(),
            },
            { onConflict: "employee_id,year" },
        )
        .select()
        .single();

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    await logBIRAudit(auth.adminClient, auth.employee.id, "prev_employer.upsert", {
        employeeId: body.employeeId,
        year: body.year,
        income: body.totalIncome,
    });
    return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
    const auth = await requireBIRRole(ALLOWED);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

    const { error } = await auth.adminClient
        .from("previous_employer_records")
        .delete()
        .eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    await logBIRAudit(auth.adminClient, auth.employee.id, "prev_employer.delete", { id });
    return NextResponse.json({ ok: true });
}

function normalizeTin(tin: string | undefined): string | null {
    if (!tin) return null;
    const digits = tin.replace(/\D/g, "");
    if (digits.length !== 12 && digits.length !== 9) return null;
    if (digits.length === 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}-000`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}
