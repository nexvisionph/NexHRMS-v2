import { createServerSupabaseClient } from "@/services/supabase-server";
import { getCurrentUser } from "@/services/auth.service";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycle_id");

    let query = supabase.from("performance_salary_bands").select("*");

    if (cycleId) {
      query = query.eq("cycle_id", cycleId);
    }

    const { data, error } = await query.order("sequence", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/performance/salary-bands:", error);
    return NextResponse.json({ error: "Failed to fetch salary bands" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization
    const { data: employee } = await supabase
      .from("employees")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if (!employee || !["admin", "hr", "finance", "finance_admin"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { cycle_id, band_name, min_rating, max_rating, adjustment_percentage, description, sequence } = body;

    const bandId = `PSB-${Date.now()}`;
    const { data, error } = await supabase
      .from("performance_salary_bands")
      .insert({
        id: bandId,
        company_id: employee.company_id,
        cycle_id,
        band_name,
        min_rating,
        max_rating,
        adjustment_percentage,
        description,
        sequence,
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: employee.company_id,
      entity_type: "cycle",
      entity_id: cycle_id,
      action: "salary_band_added",
      changed_by: user.id,
      details: { band_name, adjustment_percentage },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/salary-bands:", error);
    return NextResponse.json({ error: "Failed to create salary band" }, { status: 500 });
  }
}
