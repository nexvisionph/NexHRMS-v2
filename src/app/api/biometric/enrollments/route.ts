import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if (!employee || !["admin", "hr"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { employee_id, method, external_id } = body as {
      employee_id: string;
      method: string;
      external_id?: string;
    };

    if (!employee_id || !method) {
      return NextResponse.json({ error: "employee_id and method are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("biometric_enrollments")
      .insert({
        company_id: employee.company_id,
        employee_id,
        method,
        external_id: external_id || null,
        enrolled_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/biometric/enrollments:", error);
    return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
  }
}
