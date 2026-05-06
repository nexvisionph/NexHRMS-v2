import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization: only finance can view
    const { data: employee } = await supabase
      .from("employees")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!employee || !["finance", "finance_admin", "admin", "payroll_admin"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase.from("performance_salary_adjustments").select(
      `
      *,
      employee:employees(id, name, email, salary),
      band:performance_salary_bands(*),
      review:performance_reviews(*)
    `
    );

    if (status && status !== "all") {
      query = query.eq("status", status);
    } else {
      // Default: show pending and approved
      query = query.in("status", ["pending", "approved"]);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/performance/adjustments:", error);
    return NextResponse.json({ error: "Failed to fetch adjustments" }, { status: 500 });
  }
}
