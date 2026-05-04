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

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycle_id");

    let query = supabase.from("performance_criteria").select("*");

    if (cycleId) {
      query = query.eq("cycle_id", cycleId);
    }

    const { data, error } = await query.order("sequence", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/performance/criteria:", error);
    return NextResponse.json({ error: "Failed to fetch criteria" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization
    const { data: employee } = await supabase
      .from("employees")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if (!employee || !["admin", "hr"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { cycle_id, name, description, weight = 1, sequence } = body;

    const criterionId = `PC-${Date.now()}`;
    const { data, error } = await supabase
      .from("performance_criteria")
      .insert({
        id: criterionId,
        company_id: employee.company_id,
        cycle_id,
        name,
        description,
        weight,
        sequence,
        is_active: true,
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
      action: "criterion_added",
      changed_by: user.id,
      details: { criterion_name: name },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/criteria:", error);
    return NextResponse.json({ error: "Failed to create criterion" }, { status: 500 });
  }
}
