import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

const BUCKET = "job-resumes";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

type RouteContext = { params: Promise<{ id: string; appId: string }> };

function safeSegment(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
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

/**
 * POST /api/jobs/[id]/applications/[appId]/resume
 * Upload a PDF or DOCX resume for an applicant.
 * Body: multipart/form-data { file: File }
 * Returns: { ok: true, path: string, signedUrl: string }
 *
 * The file is stored in the private "job-resumes" bucket at:
 *   <jobId>/<appId>/<timestamp>.<ext>
 *
 * A signed URL valid for 1 hour is returned for immediate preview/download.
 * To get a fresh signed URL later call GET with ?signed=1.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id: jobId, appId } = await context.params;

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

        // ── parse form data ───────────────────────────────────────────────────
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
        }

        const ext = ALLOWED_MIME[file.type];
        if (!ext) {
            return NextResponse.json(
                { ok: false, error: "Invalid file type. Only PDF, DOC, and DOCX are accepted." },
                { status: 400 }
            );
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { ok: false, error: "File too large. Maximum size is 10 MB." },
                { status: 400 }
            );
        }

        // ── verify application exists ─────────────────────────────────────────
        const { data: appRow, error: appErr } = await admin
            .from("job_applications")
            .select("id, resume_storage_path")
            .eq("id", appId)
            .eq("job_id", jobId)
            .maybeSingle();

        if (appErr || !appRow) {
            return NextResponse.json({ ok: false, error: "Application not found" }, { status: 404 });
        }

        // ── delete previous file if it exists ─────────────────────────────────
        if (appRow.resume_storage_path) {
            await admin.storage.from(BUCKET).remove([appRow.resume_storage_path]);
        }

        // ── upload new file ───────────────────────────────────────────────────
        const storagePath = `${safeSegment(jobId)}/${safeSegment(appId)}/${Date.now()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { data: uploadData, error: uploadError } = await admin.storage
            .from(BUCKET)
            .upload(storagePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error("[resume/upload]:", uploadError.message);
            return NextResponse.json(
                { ok: false, error: `Upload failed: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // ── persist path on application row ───────────────────────────────────
        const { error: patchErr } = await admin
            .from("job_applications")
            .update({ resume_storage_path: uploadData.path })
            .eq("id", appId);

        if (patchErr) {
            console.error("[resume/upload] db patch:", patchErr.message);
            return NextResponse.json(
                { ok: false, error: "File uploaded but failed to save path" },
                { status: 500 }
            );
        }

        // ── return signed URL (1-hour) ─────────────────────────────────────────
        const { data: signedData, error: signedErr } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(uploadData.path, 3600);

        return NextResponse.json({
            ok: true,
            path: uploadData.path,
            signedUrl: signedData?.signedUrl ?? null,
            fileName: file.name,
        });
    } catch (err) {
        console.error("[resume/upload] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

/**
 * GET /api/jobs/[id]/applications/[appId]/resume
 * Returns a fresh 1-hour signed download URL for the stored resume.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        const { id: jobId, appId } = await context.params;

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

        const { data: appRow, error: appErr } = await admin
            .from("job_applications")
            .select("id, resume_storage_path")
            .eq("id", appId)
            .eq("job_id", jobId)
            .maybeSingle();

        if (appErr || !appRow) {
            return NextResponse.json({ ok: false, error: "Application not found" }, { status: 404 });
        }

        if (!appRow.resume_storage_path) {
            return NextResponse.json({ ok: false, error: "No resume uploaded" }, { status: 404 });
        }

        const { data: signedData, error: signedErr } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(appRow.resume_storage_path as string, 3600);

        if (signedErr || !signedData) {
            return NextResponse.json({ ok: false, error: "Could not generate download URL" }, { status: 500 });
        }

        return NextResponse.json({ ok: true, signedUrl: signedData.signedUrl, path: appRow.resume_storage_path });
    } catch (err) {
        console.error("[resume/GET] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/jobs/[id]/applications/[appId]/resume
 * Removes the stored resume file and clears resume_storage_path.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
    try {
        const { id: jobId, appId } = await context.params;

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

        const { data: appRow, error: appErr } = await admin
            .from("job_applications")
            .select("id, resume_storage_path")
            .eq("id", appId)
            .eq("job_id", jobId)
            .maybeSingle();

        if (appErr || !appRow) {
            return NextResponse.json({ ok: false, error: "Application not found" }, { status: 404 });
        }

        if (appRow.resume_storage_path) {
            await admin.storage.from(BUCKET).remove([appRow.resume_storage_path as string]);
        }

        await admin
            .from("job_applications")
            .update({ resume_storage_path: null })
            .eq("id", appId);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[resume/DELETE] unexpected:", err);
        return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
}
