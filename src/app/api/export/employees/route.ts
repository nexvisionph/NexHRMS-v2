import { NextRequest, NextResponse } from "next/server";

/**
 * Employee Export API
 * Exports employee data to CSV format with optional filters.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const status = searchParams.get("status"); // active, inactive, resigned
  const department = searchParams.get("department");

  // In production, fetch from Supabase with filters
  // For demo mode, the client handles export via the export-utils.ts library

  // Return a placeholder response indicating the export endpoint is available
  return NextResponse.json({
    ok: true,
    message: "Employee export endpoint ready. In demo mode, use client-side export.",
    params: { format, status, department },
    supportedFormats: ["csv", "xlsx"],
    availableFilters: ["status", "department", "workType", "salaryMin", "salaryMax"],
  });
}
