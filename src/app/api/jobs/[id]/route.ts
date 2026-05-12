import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function toJob(row: Record<string, unknown>) {
    return {
        id: row.id,
        title: row.title,
        department: row.department,
        location: row.location,
        type: row.type,
        status: row.status,
        priority: row.priority,
        headcount: row.headcount,
        salaryMin: row.salary_min ?? undefined,
        salaryMax: row.salary_max ?? undefined,
        description: row.description,
        requirements: row.requirements,
        responsibilities: row.responsibilities,
        deadline: row.deadline ?? undefined,
        createdBy: row.created_by,
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

// ── GET /api/jobs/[id] ────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const serverClient = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await serverClient.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const admin = await createAdminSupabaseClient();
        const actor = await resolveActor(admin, user.id, user.email);
        if (!actor) {
            return NextResponse.json({ ok: false, error: "Employee record not found" }, { status: 404 });
        }

        const { data, error } = await admin
            .from("job_postings")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            console.error("[jobs/[id]/GET]:", error.message);
            return NextResponse.json({ ok: false, error: "Fetch failed" }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
        }

        // Non-HR can only see open postings
        const role = String(actor.role || "").toLowerCase();
        const isHR = ["admin", "hr"].includes(role);
        const row = data as Record<string, unknown>;
        if (!isHR && row.status !== "open") {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ ok: true, job: toJob(row) }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        console.error("[jobs/[id]/GET] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

// ── PATCH /api/jobs/[id] ──────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
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

        // Map camelCase → snake_case for DB
        const patch: Record<string, unknown> = {};
        if (body.title !== undefined)            patch.title = body.title;
        if (body.department !== undefined)        patch.department = body.department;
        if (body.location !== undefined)          patch.location = body.location;
        if (body.type !== undefined)              patch.type = body.type;
        if (body.status !== undefined)            patch.status = body.status;
        if (body.priority !== undefined)          patch.priority = body.priority;
        if (body.headcount !== undefined)         patch.headcount = Number(body.headcount);
        if ("salaryMin" in body)                  patch.salary_min = body.salaryMin ?? null;
        if ("salaryMax" in body)                  patch.salary_max = body.salaryMax ?? null;
        if (body.description !== undefined)       patch.description = body.description;
        if (body.requirements !== undefined)      patch.requirements = body.requirements;
        if (body.responsibilities !== undefined)  patch.responsibilities = body.responsibilities;
        if ("deadline" in body)                   patch.deadline = body.deadline ?? null;

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
        }

        const { data, error } = await admin
            .from("job_postings")
            .update(patch)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("[jobs/[id]/PATCH]:", error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, job: toJob(data as Record<string, unknown>) });
    } catch (err) {
        console.error("[jobs/[id]/PATCH] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

// ── DELETE /api/jobs/[id] ─────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
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

        // Cascade delete is handled at DB level (ON DELETE CASCADE for job_applications)
        const { error } = await admin
            .from("job_postings")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("[jobs/[id]/DELETE]:", error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[jobs/[id]/DELETE] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}
