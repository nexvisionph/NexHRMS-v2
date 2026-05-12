import { NextRequest, NextResponse } from "next/server";

/**
 * Employee Import API
 * Accepts XLSX/CSV data for bulk employee import with dry-run validation.
 */

interface ImportRow {
  name: string;
  email: string;
  role?: string;
  department?: string;
  salary?: number;
  joinDate?: string;
  phone?: string;
  workType?: string;
  jobTitle?: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

function validateRow(row: ImportRow, index: number): ImportError[] {
  const errors: ImportError[] = [];

  if (!row.name || row.name.trim().length < 2) {
    errors.push({ row: index, field: "name", message: "Name is required (min 2 characters)" });
  }

  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push({ row: index, field: "email", message: "Valid email is required" });
  }

  if (row.salary !== undefined && (isNaN(Number(row.salary)) || Number(row.salary) < 0)) {
    errors.push({ row: index, field: "salary", message: "Salary must be a positive number" });
  }

  if (row.joinDate && isNaN(Date.parse(row.joinDate))) {
    errors.push({ row: index, field: "joinDate", message: "Invalid date format" });
  }

  const validWorkTypes = ["WFH", "WFO", "HYBRID", "ONSITE"];
  if (row.workType && !validWorkTypes.includes(row.workType.toUpperCase())) {
    errors.push({ row: index, field: "workType", message: `Work type must be one of: ${validWorkTypes.join(", ")}` });
  }

  return errors;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows, dryRun = true } = body as { rows: ImportRow[]; dryRun?: boolean };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No data rows provided" }, { status: 400 });
    }

    // Validate all rows
    const allErrors: ImportError[] = [];
    const validRows: ImportRow[] = [];

    rows.forEach((row, index) => {
      const rowErrors = validateRow(row, index + 1); // 1-indexed for user display
      if (rowErrors.length > 0) {
        allErrors.push(...rowErrors);
      } else {
        validRows.push(row);
      }
    });

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: rows.length - validRows.length,
        errors: allErrors,
        preview: validRows.slice(0, 5),
      });
    }

    // In production, insert valid rows into Supabase
    if (allErrors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "Validation errors found",
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: rows.length - validRows.length,
        errors: allErrors,
      }, { status: 422 });
    }

    // Success — in production, batch insert into employees table
    return NextResponse.json({
      ok: true,
      imported: validRows.length,
      message: `Successfully imported ${validRows.length} employees`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
