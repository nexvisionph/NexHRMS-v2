import { createServerSupabaseClient } from "@/services/supabase-server";
import { getCurrentUser } from "@/services/auth.service";
import { NextResponse } from "next/server";

type ReviewRatingInput = {
  criterion_id: string;
  score: number;
  feedback?: string;
};

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
      .from("performance_reviews")
      .select(
        `
        *,
        employee:employees(id, name, email, salary),
        manager:employees(id, name, email),
        ratings:performance_ratings(
          *,
          criterion:performance_criteria(*)
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    // Check authorization: manager, employee, or admin/hr/finance
    const { data: currentEmployee } = await supabase
      .from("employees")
      .select("id, role")
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .single();

    const canView =
      data.manager_id === currentEmployee?.id ||
      data.employee_id === currentEmployee?.id ||
      ["admin", "hr", "finance"].includes(currentEmployee?.role);

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`GET /api/performance/reviews/${id}:`, error);
    return NextResponse.json({ error: "Failed to fetch review" }, { status: 500 });
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

    const body = await req.json();
    const { ratings, manager_notes, overall_rating } = body;

    // Get current review
    const { data: review } = await supabase
      .from("performance_reviews")
      .select("*")
      .eq("id", id)
      .single();

    // Check authorization: only manager can edit draft reviews
    const { data: currentEmployee } = await supabase
      .from("employees")
      .select("company_id, id")
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!currentEmployee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (review?.manager_id !== currentEmployee.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (review?.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot edit non-draft reviews" },
        { status: 400 }
      );
    }

    // Update review
    const { data: updated, error } = await supabase
      .from("performance_reviews")
      .update({
        manager_notes,
        overall_rating: overall_rating,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Update ratings if provided
    if (ratings && ratings.length > 0) {
      // Delete old ratings
      await supabase.from("performance_ratings").delete().eq("review_id", id);

      // Insert new ratings
      const ratingInserts = (ratings as ReviewRatingInput[]).map((r, idx) => ({
        id: `PR-${Date.now()}-${idx}`,
        review_id: id,
        criterion_id: r.criterion_id,
        score: r.score,
        feedback: r.feedback,
      }));

      await supabase.from("performance_ratings").insert(ratingInserts);
    }

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: currentEmployee.company_id,
      entity_type: "review",
      entity_id: id,
      action: "updated",
      changed_by: user.id,
      details: { updated_fields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`PUT /api/performance/reviews/${id}:`, error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}
