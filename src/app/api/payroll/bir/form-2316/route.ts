/**
 * GET  /api/payroll/bir/form-2316?employeeId=&year=
 *      → returns Form2316Record list
 * POST /api/payroll/bir/form-2316
 *      body: { employeeId, year, action: 'generate'|'release'|'revoke', revokeReason? }
 *
 * Generation only stamps the DB record (status, generated_by, document_hash).
 * The actual rendered HTML is produced client-side via lib/form-2316-generator.
 *
 * Auth: admin / finance / payroll_admin
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBIRRole, logBIRAudit } from "../_helpers";

export async function GET(req: NextRequest) {
    const auth = await requireBIRRole();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const year = searchParams.get("year");

    let q = auth.adminClient.from("form_2316_records").select("*");
    if (employeeId) q = q.eq("employee_id", employeeId);
    if (year) q = q.eq("year", Number(year));

    const { data, error } = await q.order("generated_at", { ascending: false });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
    const auth = await requireBIRRole();
    if (!auth.ok) return auth.response;

    let body: {
        employeeId?: string;
        year?: number;
        action?: string;
        documentHash?: string;
        revokeReason?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
    }

    const { employeeId, year, action } = body;
    if (!employeeId || !year || !action) {
        return NextResponse.json(
            { ok: false, message: "employeeId, year, action required" },
            { status: 400 },
        );
    }

    if (action === "generate") {
        // Require finalized annual_summary
        const { data: summary } = await auth.adminClient
            .from("annual_tax_summaries")
            .select("id, status")
            .eq("employee_id", employeeId)
            .eq("year", year)
            .maybeSingle();
        if (!summary || summary.status !== "finalized") {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Annual summary must be finalized before generating Form 2316",
                },
                { status: 409 },
            );
        }

        const { data, error } = await auth.adminClient
            .from("form_2316_records")
            .insert({
                employee_id: employeeId,
                year,
                annual_summary_id: summary.id,
                generated_by: auth.employee.id,
                document_hash: body.documentHash ?? null,
                status: "draft",
            })
            .select()
            .single();
        if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

        await logBIRAudit(auth.adminClient, auth.employee.id, "form_2316.generate", {
            employeeId,
            year,
            recordId: data.id,
        });
        return NextResponse.json({ ok: true, data });
    }

    if (action === "release") {
        const { data, error } = await auth.adminClient
            .from("form_2316_records")
            .update({
                status: "released",
                released_at: new Date().toISOString(),
            })
            .eq("employee_id", employeeId)
            .eq("year", year)
            .in("status", ["draft", "for_signature"])
            .select()
            .maybeSingle();
        if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        if (!data) {
            return NextResponse.json(
                { ok: false, message: "No releasable Form 2316 found" },
                { status: 404 },
            );
        }
        await logBIRAudit(auth.adminClient, auth.employee.id, "form_2316.release", {
            employeeId,
            year,
        });
        return NextResponse.json({ ok: true, data });
    }

    if (action === "revoke") {
        if (!body.revokeReason) {
            return NextResponse.json(
                { ok: false, message: "revokeReason required" },
                { status: 400 },
            );
        }
        const { data, error } = await auth.adminClient
            .from("form_2316_records")
            .update({
                status: "revoked",
                revoked_at: new Date().toISOString(),
                revoked_by: auth.employee.id,
                revoke_reason: body.revokeReason,
            })
            .eq("employee_id", employeeId)
            .eq("year", year)
            .neq("status", "revoked")
            .select()
            .maybeSingle();
        if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        if (!data) {
            return NextResponse.json(
                { ok: false, message: "No active Form 2316 to revoke" },
                { status: 404 },
            );
        }
        await logBIRAudit(auth.adminClient, auth.employee.id, "form_2316.revoke", {
            employeeId,
            year,
            reason: body.revokeReason,
        });
        return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
        { ok: false, message: `Unknown action: ${action}` },
        { status: 400 },
    );
}
