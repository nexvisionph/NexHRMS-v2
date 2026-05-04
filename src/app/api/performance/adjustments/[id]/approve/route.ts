import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization: only finance can approve
    const { data: employee } = await supabase
      .from("employees")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if (!employee || !["finance", "finance_admin", "admin", "payroll_admin"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { finance_approved_amount, override_reason, action } = body;

    // Get current adjustment
    const { data: adjustment } = await supabase
      .from("performance_salary_adjustments")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!adjustment) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    if (adjustment.status !== "pending") {
      return NextResponse.json(
        { error: "Can only approve pending adjustments" },
        { status: 400 }
      );
    }

    let newStatus: string;
    let approvedAmount: number | null = null;

    if (action === "approve") {
      newStatus = "approved";
      approvedAmount = finance_approved_amount || adjustment.recommended_amount;
    } else if (action === "reject") {
      newStatus = "rejected";
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("performance_salary_adjustments")
      .update({
        status: newStatus,
        finance_approved_amount: approvedAmount,
        finance_override_reason: override_reason,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    // Get review and update status if all adjustments are approved
    const { data: review } = await supabase
      .from("performance_reviews")
      .select("*")
      .eq("id", adjustment.review_id)
      .single();

    if (review && newStatus === "approved") {
      const { data: allAdjustments } = await supabase
        .from("performance_salary_adjustments")
        .select("status")
        .eq("review_id", review.id);

      const allApproved = allAdjustments?.every((a) => ["approved", "applied"].includes(a.status));

      if (allApproved && review.status === "acknowledged") {
        await supabase
          .from("performance_reviews")
          .update({
            status: "finance_approved",
            finance_approved_at: new Date().toISOString(),
            finance_approved_by: user.id,
          })
          .eq("id", review.id);
      }
    }

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: employee.company_id,
      entity_type: "adjustment",
      entity_id: params.id,
      action: `${action}_by_finance`,
      old_status: "pending",
      new_status: newStatus,
      changed_by: user.id,
      details: { approved_amount: approvedAmount },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`POST /api/performance/adjustments/${params.id}/approve:`, error);
    return NextResponse.json({ error: "Failed to approve adjustment" }, { status: 500 });
  }
}
