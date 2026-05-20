import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { signProjectQr } from "@/lib/project-qr";

/**
 * GET /api/projects/[id]/qr
 *
 * Returns the signed QR payload string for a project so the client can render
 * it with `<QRCodeCanvas value={...} />`.
 *
 * Auth: requires a logged-in user with role admin/manager/hr/finance/payroll_admin
 *       (anyone who can view/manage projects). The qrSecret itself is NEVER
 *       returned — only the signed payload (which is what gets stamped onto
 *       the printable QR).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Permission gate: must be a privileged role
  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || !["admin", "manager", "hr", "finance", "payroll_admin"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch the project's qrSecret + enabled flag
  const admin = await createAdminSupabaseClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, name, qr_secret, qr_enabled")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.qr_enabled) {
    return NextResponse.json({ error: "QR is disabled for this project" }, { status: 409 });
  }
  if (!project.qr_secret) {
    return NextResponse.json({ error: "Project missing QR secret — re-run migration 055" }, { status: 500 });
  }

  let payload: string;
  try {
    payload = signProjectQr(project.id as string, project.qr_secret as string);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign QR payload" },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const checkinUrl = `${appUrl}/checkin?qr=${encodeURIComponent(payload)}`;

  return NextResponse.json({
    projectId: project.id,
    projectName: project.name,
    payload, // raw signed JSON — kept for reference/debug
    checkinUrl, // QR-encode THIS — phone camera opens it directly
  });
}
