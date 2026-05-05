import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";

async function getCurrentEmployee(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: byId } = await supabase
    .from("employees")
    .select("id, role, profile_id")
    .eq("id", userId)
    .maybeSingle();
  if (byId?.id) return byId;

  const { data: byProfile } = await supabase
    .from("employees")
    .select("id, role, profile_id")
    .eq("profile_id", userId)
    .maybeSingle();
  return byProfile || null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentEmp = await getCurrentEmployee(supabase, user.id);
    const isAdminHr = currentEmp && ["admin", "hr"].includes(currentEmp.role);

    if (!isAdminHr && currentEmp?.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("biometric_enrollments")
      .select("*, enrolled_by_employee:employees(id, name, email)")
      .eq("employee_id", id)
      .order("enrolled_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(`GET /api/biometric/enrollments/${id}:`, error);
    return NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentEmp = await getCurrentEmployee(supabase, user.id);
    if (!currentEmp || currentEmp.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("biometric_enrollments")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error(`DELETE /api/biometric/enrollments/${id}:`, error);
    return NextResponse.json({ error: "Failed to remove enrollment" }, { status: 500 });
  }
}
