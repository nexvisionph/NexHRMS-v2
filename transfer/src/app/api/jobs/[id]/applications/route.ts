import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

// ── GET /api/jobs/[id]/applications ───────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        const { id: jobId } = await context.params;
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

        const { data, error } = await admin
            .from("job_applications")
            .select("*")
            .eq("job_id", jobId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[jobs/[id]/applications/GET]:", error.message);
            return NextResponse.json({ ok: false, error: "Fetch failed" }, { status: 500 });
        }

        return NextResponse.json(
            { ok: true, applications: (data ?? []).map((r) => toApplication(r as Record<string, unknown>)) },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("[jobs/[id]/applications/GET] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

// ── POST /api/jobs/[id]/applications ─────────────────────────────────────────
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id: jobId } = await context.params;
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

        if (!body.id || !body.applicantName || !body.applicantEmail) {
            return NextResponse.json(
                { ok: false, error: "Missing required fields: id, applicantName, applicantEmail" },
                { status: 400 }
            );
        }

        // Verify job exists
        const { data: job, error: jobError } = await admin
            .from("job_postings")
            .select("id, status")
            .eq("id", jobId)
            .maybeSingle();

        if (jobError || !job) {
            return NextResponse.json({ ok: false, error: "Job posting not found" }, { status: 404 });
        }

        const { data, error } = await admin
            .from("job_applications")
            .insert({
                id: body.id,
                job_id: jobId,
                applicant_name: body.applicantName,
                applicant_email: body.applicantEmail,
                applicant_phone: body.applicantPhone ?? null,
                resume_url: body.resumeUrl ?? null,
                cover_letter: body.coverLetter ?? null,
                source: body.source ?? "Other",
                status: body.status ?? "applied",
                notes: body.notes ?? null,
            })
            .select()
            .single();

        if (error) {
            console.error("[jobs/[id]/applications/POST]:", error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json(
            { ok: true, application: toApplication(data as Record<string, unknown>) },
            { status: 201 }
        );
    } catch (err) {
        console.error("[jobs/[id]/applications/POST] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}
