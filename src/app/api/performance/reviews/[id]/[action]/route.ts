import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action: reviewAction } = await params;
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current review
    const { data: review } = await supabase
      .from("performance_reviews")
      .select("*")
      .eq("id", id)
      .single();

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (reviewAction === "submit") {
      // Only manager can submit
      if (review.manager_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (review.status !== "draft") {
        return NextResponse.json(
          { error: "Only draft reviews can be submitted" },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabase
        .from("performance_reviews")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await supabase.from("performance_audit_logs").insert({
        id: `PAL-${Date.now()}`,
        company_id: employee?.company_id,
        entity_type: "review",
        entity_id: id,
        action: "submitted",
        old_status: "draft",
        new_status: "submitted",
        changed_by: user.id,
      });

      return NextResponse.json(updated);
    }

    if (reviewAction === "acknowledge") {
      // Only employee can acknowledge
      if (review.employee_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (review.status !== "submitted") {
        return NextResponse.json(
          { error: "Only submitted reviews can be acknowledged" },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabase
        .from("performance_reviews")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await supabase.from("performance_audit_logs").insert({
        id: `PAL-${Date.now()}`,
        company_id: employee?.company_id,
        entity_type: "review",
        entity_id: id,
        action: "acknowledged",
        old_status: "submitted",
        new_status: "acknowledged",
        changed_by: user.id,
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(`POST /api/performance/reviews/${id}/${reviewAction}:`, error);
    return NextResponse.json({ error: "Failed to process review" }, { status: 500 });
  }
}
