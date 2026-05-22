import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; appId: string }> };

function toApplication(row: Record<string, unknown>) {
    return {
        id: row.id,
        jobId: row.job_id,
        applicantName: row.applicant_name,
        applicantEmail: row.applicant_email,
        applicantPhone: row.applicant_phone ?? undefined,
        resumeUrl: row.resume_url ?? undefined,
        resumeStoragePath: row.resume_storage_path ?? undefined,
        coverLetter: row.cover_letter ?? undefined,
        source: row.source,
        status: row.status,
        interviewDate: row.interview_date ?? undefined,
        offerSalary: row.offer_salary ?? undefined,
        notes: row.notes ?? undefined,
        reviewedBy: row.reviewed_by ?? undefined,
        reviewedAt: row.reviewed_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function resolveActor(
    admin: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
    userId: string,
    userEmail: string | undefined
) {
    const { data, error } = await admin
        .from("employees")
        .select("id, role")
        .or(`profile_id.eq.${userId}${userEmail ? `,email.eq.${userEmail}` : ""}`)
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
}

// ── PATCH /api/jobs/[id]/applications/[appId] ─────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { appId } = await context.params;
        const serverClient = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await serverClient.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const admin = await createAdminSupabaseClient();
        const actor = await resolveActor(admin, user.id, user.email);
        if (!actor || !["admin", "hr"].includes(String(actor.role || "").toLowerCase())) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json() as Record<string, unknown>;

        const patch: Record<string, unknown> = {};
        if (body.status !== undefined) {
            patch.status = body.status;
            patch.reviewed_by = actor.id;
            patch.reviewed_at = new Date().toISOString();
        }
        if (body.notes !== undefined)              patch.notes = body.notes ?? null;
        if (body.interviewDate !== undefined)       patch.interview_date = body.interviewDate ?? null;
        if (body.offerSalary !== undefined)         patch.offer_salary = body.offerSalary ?? null;
        if (body.applicantPhone !== undefined)      patch.applicant_phone = body.applicantPhone ?? null;
        if (body.resumeUrl !== undefined)           patch.resume_url = body.resumeUrl ?? null;
        if (body.resumeStoragePath !== undefined)   patch.resume_storage_path = body.resumeStoragePath ?? null;
        if (body.coverLetter !== undefined)         patch.cover_letter = body.coverLetter ?? null;
        if (body.applicantName !== undefined)       patch.applicant_name = body.applicantName;
        if (body.applicantEmail !== undefined)      patch.applicant_email = body.applicantEmail;
        if (body.source !== undefined)              patch.source = body.source;

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
        }

        const { data, error } = await admin
            .from("job_applications")
            .update(patch)
            .eq("id", appId)
            .select()
            .single();

        if (error) {
            console.error("[jobs/[id]/applications/[appId]/PATCH]:", error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, application: toApplication(data as Record<string, unknown>) });
    } catch (err) {
        console.error("[jobs/[id]/applications/[appId]/PATCH] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

// ── DELETE /api/jobs/[id]/applications/[appId] ────────────────────────────────
export async function DELETE(_req: NextRequest, context: RouteContext) {
    try {
        const { appId } = await context.params;
        const serverClient = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await serverClient.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const admin = await createAdminSupabaseClient();
        const actor = await resolveActor(admin, user.id, user.email);
        if (!actor || !["admin", "hr"].includes(String(actor.role || "").toLowerCase())) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const { error } = await admin
            .from("job_applications")
            .delete()
            .eq("id", appId);

        if (error) {
            console.error("[jobs/[id]/applications/[appId]/DELETE]:", error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[jobs/[id]/applications/[appId]/DELETE] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}
