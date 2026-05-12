import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

// ── row mapper ────────────────────────────────────────────────────────────────
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

// ── auth helper ───────────────────────────────────────────────────────────────
async function resolveActor(admin: Awaited<ReturnType<typeof createAdminSupabaseClient>>, userId: string, userEmail: string | undefined) {
    const { data, error } = await admin
        .from("employees")
        .select("id, role")
        .or(`profile_id.eq.${userId}${userEmail ? `,email.eq.${userEmail}` : ""}`)
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
}

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    try {
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

        const role = String(actor.role || "").toLowerCase();
        const isHR = ["admin", "hr"].includes(role);

        const sp = request.nextUrl.searchParams;
        let query = admin
            .from("job_postings")
            .select("*")
            .order("created_at", { ascending: false });

        // Non-HR employees only see open postings
        if (!isHR) {
            query = query.eq("status", "open");
        } else {
            if (sp.get("status")) query = query.eq("status", sp.get("status"));
            if (sp.get("department")) query = query.eq("department", sp.get("department"));
        }

        const { data, error } = await query;
        if (error) {
            console.error("[jobs/GET] fetch:", error.message);
            return NextResponse.json({ ok: false, error: "Failed to fetch job postings" }, { status: 500 });
        }

        return NextResponse.json(
            { ok: true, jobs: (data ?? []).map((r) => toJob(r as Record<string, unknown>)) },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("[jobs/GET] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

// ── POST /api/jobs ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
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

        const role = String(actor.role || "").toLowerCase();
        if (!["admin", "hr"].includes(role)) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json() as Record<string, unknown>;

        if (!body.id || !body.title || !body.location || !body.description) {
            return NextResponse.json({ ok: false, error: "Missing required fields: id, title, location, description" }, { status: 400 });
        }

        const { data, error } = await admin
            .from("job_postings")
            .insert({
                id: body.id,
                title: body.title,
                department: body.department ?? "Operations",
                location: body.location,
                type: body.type ?? "full_time",
                status: body.status ?? "open",
                priority: body.priority ?? "medium",
                headcount: Number(body.headcount) || 1,
                salary_min: body.salaryMin ?? null,
                salary_max: body.salaryMax ?? null,
                description: body.description,
                requirements: body.requirements ?? "",
                responsibilities: body.responsibilities ?? "",
                deadline: body.deadline ?? null,
                created_by: actor.id,
            })
            .select()
            .single();

        if (error) {
            console.error("[jobs/POST] insert:", error.message);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json(
            { ok: true, job: toJob(data as Record<string, unknown>) },
            { status: 201 }
        );
    } catch (err) {
        console.error("[jobs/POST] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}
