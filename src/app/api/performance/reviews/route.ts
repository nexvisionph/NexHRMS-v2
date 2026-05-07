import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { NextResponse } from "next/server";

type ReviewRatingInput = {
  criterion_id: string;
  score: number;
  feedback?: string;
};

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycle_id");
    const employeeId = searchParams.get("employee_id");
    const managerId = searchParams.get("manager_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("performance_reviews")
      .select(
        `
        *,
        employee:employees(id, name, email),
        manager:employees(id, name, email),
        ratings:performance_ratings(*)
      `
      );

    if (cycleId) query = query.eq("cycle_id", cycleId);
    if (employeeId) query = query.eq("employee_id", employeeId);
    if (managerId) query = query.eq("manager_id", managerId);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/performance/reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      cycle_id: string;
      employee_id: string;
      ratings: ReviewRatingInput[];
      manager_notes?: string;
    };
    const { cycle_id, employee_id, ratings, manager_notes } = body;

    // Get the employee row linked to the signed-in profile.
    const { data: managerEmployee } = await supabase
      .from("employees")
      .select("company_id, id, role")
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!managerEmployee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate overall rating from individual ratings
    const totalScore = ratings.reduce((sum, r) => sum + r.score, 0);
    const overallRating = totalScore / ratings.length;

    // Create review
    const reviewId = `PR-${Date.now()}`;
    const { data: review, error: reviewError } = await supabase
      .from("performance_reviews")
      .insert({
        id: reviewId,
        company_id: managerEmployee.company_id,
        cycle_id,
        employee_id,
        manager_id: managerEmployee.id,
        overall_rating: overallRating,
        manager_notes,
        status: "draft",
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    // Insert individual ratings
    const ratingInserts = ratings.map((r, idx) => ({
      id: `PR-${Date.now()}-${idx}`,
      review_id: reviewId,
      criterion_id: r.criterion_id,
      score: r.score,
      feedback: r.feedback,
    }));

    const { error: ratingError } = await supabase.from("performance_ratings").insert(ratingInserts);

    if (ratingError) throw ratingError;

    // Log audit
    await supabase.from("performance_audit_logs").insert({
      id: `PAL-${Date.now()}`,
      company_id: managerEmployee.company_id,
      entity_type: "review",
      entity_id: reviewId,
      action: "created",
      new_status: "draft",
      changed_by: user.id,
      details: { employee_id, overall_rating: overallRating },
    });

    // Create initial salary adjustment based on rating
    const { data: salaryBands } = await supabase
      .from("performance_salary_bands")
      .select("*")
      .eq("cycle_id", cycle_id)
      .order("min_rating", { ascending: true });

    const matchingBand = salaryBands?.find(
      (b) => overallRating >= b.min_rating && overallRating <= b.max_rating
    );

    if (matchingBand) {
      const adjustmentId = `PSA-${Date.now()}`;
      const { data: empData } = await supabase
        .from("employees")
        .select("salary")
        .eq("id", employee_id)
        .single();

      const recommendedAmount = (empData?.salary || 0) * (matchingBand.adjustment_percentage / 100);

      const { error: adjError } = await supabase.from("performance_salary_adjustments").insert({
        id: adjustmentId,
        company_id: managerEmployee.company_id,
        review_id: reviewId,
        employee_id,
        recommended_band_id: matchingBand.id,
        recommended_percentage: matchingBand.adjustment_percentage,
        recommended_amount: recommendedAmount,
        status: "pending",
      });

      if (adjError) throw adjError;
    }

    return NextResponse.json({ ...review, ratings }, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/reviews:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
