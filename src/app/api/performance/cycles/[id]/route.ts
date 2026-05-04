import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("performance_cycles")
      .select(
        `
        *,
        criteria:performance_criteria(*),
        salary_bands:performance_salary_bands(*)
      `
      )
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error(`GET /api/performance/cycles/${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch cycle" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const { name, description, period_start, period_end, review_start_date, review_end_date } =
      body;

    // Fetch old cycle for audit
    const { data: oldCycle } = await supabase
      .from("performance_cycles")
      .select("*")
      .eq("id", params.id)
      .single();

    const { data, error } = await supabase
      .from("performance_cycles")
      .update({
        name,
        description,
        period_start,
        period_end,
        review_start_date,
        review_end_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: employee.company_id,
      entity_type: "cycle",
      entity_id: params.id,
      action: "updated",
      changed_by: user.id,
      details: { old_cycle: oldCycle, new_cycle: data },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`PUT /api/performance/cycles/${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update cycle" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const { status } = body;

    // Fetch old cycle for audit
    const { data: oldCycle } = await supabase
      .from("performance_cycles")
      .select("status")
      .eq("id", params.id)
      .single();

    const { data, error } = await supabase
      .from("performance_cycles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: employee.company_id,
      entity_type: "cycle",
      entity_id: params.id,
      action: "status_changed",
      old_status: oldCycle?.status,
      new_status: status,
      changed_by: user.id,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`PATCH /api/performance/cycles/${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update cycle status" }, { status: 500 });
  }
}
