import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { NextResponse } from "next/server";
import type { PerformanceCycle } from "@/types";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("id");

    if (cycleId) {
      // Get specific cycle
      const { data, error } = await supabase
        .from("performance_cycles")
        .select("*")
        .eq("id", cycleId)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // Get all cycles for user's company
    const { data, error } = await supabase
      .from("performance_cycles")
      .select("*")
      .order("period_start", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/performance/cycles:", error);
    return NextResponse.json({ error: "Failed to fetch cycles" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization: only admin/hr can create
    const { data: employee } = await supabase
      .from("employees")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!employee || !["admin", "hr"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      period_start,
      period_end,
      review_start_date,
      review_end_date,
      rating_scale_min = 1,
      rating_scale_max = 5,
    } = body;

    // Get user's company_id
    const { data: userEmployee } = await supabase
      .from("employees")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const cycleId = `PC-${Date.now()}`;
    const { data, error } = await supabase
      .from("performance_cycles")
      .insert({
        id: cycleId,
        company_id: userEmployee?.company_id || "default",
        name,
        description,
        period_start,
        period_end,
        review_start_date,
        review_end_date,
        rating_scale_min,
        rating_scale_max,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: userEmployee?.company_id || "default",
      entity_type: "cycle",
      entity_id: cycleId,
      action: "created",
      new_status: "draft",
      changed_by: user.id,
      details: { cycle_name: name },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/cycles:", error);
    return NextResponse.json({ error: "Failed to create cycle" }, { status: 500 });
  }
}
