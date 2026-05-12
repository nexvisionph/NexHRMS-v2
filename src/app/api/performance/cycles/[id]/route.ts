import { createServerSupabaseClient } from "@/services/supabase-server";
import { getCurrentUser } from "@/services/auth.service";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUser();

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
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error(`GET /api/performance/cycles/${id}:`, error);
    return NextResponse.json({ error: "Failed to fetch cycle" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      .eq("id", id)
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
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: employee.company_id,
      entity_type: "cycle",
      entity_id: id,
      action: "updated",
      changed_by: user.id,
      details: { old_cycle: oldCycle, new_cycle: data },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`PUT /api/performance/cycles/${id}:`, error);
    return NextResponse.json({ error: "Failed to update cycle" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    if (!employee || !["admin", "hr"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;

    // Fetch old cycle for audit
    const { data: oldCycle } = await supabase
      .from("performance_cycles")
      .select("status")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("performance_cycles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: employee.company_id,
      entity_type: "cycle",
      entity_id: id,
      action: "status_changed",
      old_status: oldCycle?.status,
      new_status: status,
      changed_by: user.id,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`PATCH /api/performance/cycles/${id}:`, error);
    return NextResponse.json({ error: "Failed to update cycle status" }, { status: 500 });
  }
}
