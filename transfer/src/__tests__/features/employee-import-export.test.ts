/**
 * Employee Import / Export — Backend Tests
 * ==========================================
 * Covers:
 *   - POST /api/import/employees  (dryRun + live, validation, duplicates)
 *   - GET  /api/import/employees?template=true  (XLSX template generation)
 *   - GET  /api/export/employees  (XLSX export with auth + filters)
 *   - export-utils: EMPLOYEES_TEMPLATE_HEADERS shape
 *   - export-utils: downloadImportTemplate columns
 *
 * Mocks: Supabase server client (see src/__tests__/setup.ts global mock).
 * No real DB calls — all assertions on in-memory mock behavior.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";
import {
  EMPLOYEES_TEMPLATE_HEADERS,
  PAYROLL_TEMPLATE_HEADERS,
  ATTENDANCE_TEMPLATE_HEADERS,
} from "@/lib/export-utils";

// ─── Route handlers under test ───────────────────────────────────────────────
import { POST as importPOST, GET as importGET } from "@/app/api/import/employees/route";
import { GET as exportGET } from "@/app/api/export/employees/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Request object the way Next.js Route Handlers receive it */
function makeRequest(
  method: "GET" | "POST",
  url: string,
  body?: unknown
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Returns a chainable auth result mock: .select().eq().single() → role */
function makeAuthChain(role: string) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "EMP-AUTH-01", role }, error: null }),
      }),
    }),
  };
}

/**
 * Build a Supabase mock for the import route POST.
 *
 * The route calls `from("employees")` in three phases:
 *   1. Auth check:    .select("id, role").eq(...).single()
 *   2. Email lookup:  .select("email")          (directly awaited)
 *   3. Insert (×N):   .insert(record)           (if not dryRun)
 */
function makeMockForImportPOST(opts: {
  role?: string;
  existingEmails?: string[];
  insertError?: string | null;
} = {}) {
  const { role = "admin", existingEmails = [], insertError = null } = opts;
  const supabase = createServerSupabaseClient as jest.Mock;
  let callCount = 0;
  supabase.mockReturnValueOnce({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-uid" } }, error: null }),
    },
    from: jest.fn((table: string) => {
      if (table === "employees") {
        callCount++;
        if (callCount === 1) {
          // Auth check — needs .select().eq().single()
          return makeAuthChain(role);
        }
        if (callCount === 2) {
          // Email lookup — .select("email") directly awaited
          return {
            select: jest.fn().mockResolvedValue({
              data: existingEmails.map((e) => ({ email: e })),
              error: null,
            }),
          };
        }
        // Insert call (callCount >= 3)
        if (insertError) {
          return { insert: jest.fn().mockResolvedValue({ error: { message: insertError } }) };
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "audit_logs") {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  });
}

/**
 * Build a Supabase mock for the import route GET (template download).
 * Only needs the auth chain.
 */
function makeMockForImportGET(role = "admin") {
  const supabase = createServerSupabaseClient as jest.Mock;
  supabase.mockReturnValueOnce({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-uid" } }, error: null }),
    },
    from: jest.fn((table: string) => {
      if (table === "employees") return makeAuthChain(role);
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  });
}

/**
 * Build a Supabase mock for the export route GET.
 *
 * The route calls `from("employees")` twice:
 *   1. Auth check: .select("role").eq(...).single()
 *   2. Data query: .select("*").order("name").eq?(...)  — terminates with await
 */
function makeMockForExportGET(opts: {
  role?: string;
  employees?: Record<string, unknown>[];
  dbError?: string | null;
} = {}) {
  const { role = "admin", employees = [], dbError = null } = opts;
  const supabase = createServerSupabaseClient as jest.Mock;
  let callCount = 0;
  supabase.mockReturnValueOnce({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-uid" } }, error: null }),
    },
    from: jest.fn((table: string) => {
      if (table === "employees") {
        callCount++;
        if (callCount === 1) {
          // Auth check
          return makeAuthChain(role);
        }
        // Data query — .select("*").order().eq?() → all chainable, terminates when awaited
        const result = dbError
          ? { data: null, error: { message: dbError } }
          : { data: employees, error: null };

        // A thenable object that also supports .eq() chaining
        // `await queryChain` → calls .then(); `queryChain.eq(...)` → returns Promise
        const queryChain = {
          eq: jest.fn().mockResolvedValue(result),
          then: (
            resolve: (v: unknown) => unknown,
            reject?: (v: unknown) => unknown
          ) => Promise.resolve(result).then(resolve, reject),
        };

        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue(queryChain),
          }),
        };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  });
}

/** Unauthorised — no user in session */
function mockAuthAsAnon() {
  const supabase = createServerSupabaseClient as jest.Mock;
  supabase.mockReturnValueOnce({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: jest.fn(),
  });
}

/** Logged-in but role = employee (forbidden for import/export) */
function mockAuthAsEmployee(forExport = false) {
  if (forExport) {
    makeMockForExportGET({ role: "employee" });
  } else {
    makeMockForImportGET("employee");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Template column definitions (export-utils)
// ─────────────────────────────────────────────────────────────────────────────

describe("export-utils — EMPLOYEES_TEMPLATE_HEADERS", () => {
  it("contains exactly 5 personal-info columns", () => {
    expect(EMPLOYEES_TEMPLATE_HEADERS).toHaveLength(5);
  });

  it("includes Name and Email (required fields)", () => {
    expect(EMPLOYEES_TEMPLATE_HEADERS).toContain("Name");
    expect(EMPLOYEES_TEMPLATE_HEADERS).toContain("Email");
  });

  it("includes optional personal fields", () => {
    expect(EMPLOYEES_TEMPLATE_HEADERS).toContain("Phone");
    expect(EMPLOYEES_TEMPLATE_HEADERS).toContain("Birthday");
    expect(EMPLOYEES_TEMPLATE_HEADERS).toContain("Address");
  });

  it("does NOT include system-managed fields (role, department, salary)", () => {
    const headers = EMPLOYEES_TEMPLATE_HEADERS as readonly string[];
    expect(headers).not.toContain("Role");
    expect(headers).not.toContain("Department");
    expect(headers).not.toContain("Salary");
    expect(headers).not.toContain("Join Date");
    expect(headers).not.toContain("Status");
    expect(headers).not.toContain("Work Type");
  });

  it("payroll template still has Employee Name (not affected by employees change)", () => {
    expect(PAYROLL_TEMPLATE_HEADERS).toContain("Employee Name");
  });

  it("attendance template still has Employee Name (not affected by employees change)", () => {
    expect(ATTENDANCE_TEMPLATE_HEADERS).toContain("Employee Name");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: GET /api/import/employees?template=true
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/import/employees — template download", () => {
  it("returns 400 when ?template=true is missing", async () => {
    makeMockForImportGET();
    const req = makeRequest("GET", "http://localhost/api/import/employees");
    const res = await importGET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/template=true/);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthAsAnon();
    const req = makeRequest("GET", "http://localhost/api/import/employees?template=true");
    const res = await importGET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuthAsEmployee();
    const req = makeRequest("GET", "http://localhost/api/import/employees?template=true");
    const res = await importGET(req);
    expect(res.status).toBe(403);
  });

  it("returns XLSX content-type for authenticated admin", async () => {
    makeMockForImportGET();
    const req = makeRequest("GET", "http://localhost/api/import/employees?template=true");
    const res = await importGET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });

  it("includes Content-Disposition with filename", async () => {
    makeMockForImportGET();
    const req = makeRequest("GET", "http://localhost/api/import/employees?template=true");
    const res = await importGET(req);
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("employees-import-template.xlsx");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: POST /api/import/employees — dryRun validation
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/import/employees — dryRun validation", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuthAsAnon();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Juan", Email: "juan@test.com" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin/hr role", async () => {
    makeMockForImportGET("employee"); // uses same auth-only mock
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Juan", Email: "juan@test.com" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when rows array is empty", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [],
      dryRun: true,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when rows exceeds 500", async () => {
    makeMockForImportPOST();
    const rows = Array.from({ length: 501 }, (_, i) => ({
      Name: `Employee ${i}`,
      Email: `emp${i}@test.com`,
    }));
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows,
      dryRun: true,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/500/);
  });

  it("marks row as error when Name is missing", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "", Email: "noemail@test.com" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.errors).toBeGreaterThanOrEqual(1);
    const errRow = json.rowValidations.find((r: { status: string }) => r.status === "error");
    expect(errRow).toBeDefined();
    expect(errRow.message).toMatch(/Name/i);
  });

  it("marks row as error for invalid Email format", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Juan", Email: "not-an-email" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    const errRow = json.rowValidations.find((r: { status: string }) => r.status === "error");
    expect(errRow).toBeDefined();
    expect(errRow.message).toMatch(/email/i);
  });

  it("marks row as error when Birthday format is wrong", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Juan", Email: "juan@test.com", Birthday: "05/20/1990" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    const errRow = json.rowValidations.find((r: { status: string }) => r.status === "error");
    expect(errRow).toBeDefined();
    expect(errRow.message).toMatch(/YYYY-MM-DD/i);
  });

  it("accepts Birthday in correct YYYY-MM-DD format", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Maria", Email: "maria@test.com", Birthday: "1993-11-15" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.valid).toBe(1);
    expect(json.errors).toBe(0);
  });

  it("detects duplicate email within the same batch", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [
        { Name: "Juan A", Email: "same@test.com" },
        { Name: "Juan B", Email: "same@test.com" }, // duplicate
      ],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.valid).toBe(1);
    expect(json.duplicates).toBe(1);
  });

  it("detects duplicate email against existing DB records", async () => {
    makeMockForImportPOST({ existingEmails: ["existing@test.com"] });
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Existing Person", Email: "existing@test.com" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.duplicates).toBeGreaterThanOrEqual(1);
  });

  it("returns dryRun:true and imported:0 in dry run mode", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "New Person", Email: "new@test.com" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.imported).toBe(0);
    expect(json.valid).toBe(1);
  });

  it("response includes rowValidations array with correct shape", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Good Row", Email: "good@test.com" }],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(Array.isArray(json.rowValidations)).toBe(true);
    const rv = json.rowValidations[0];
    expect(rv).toHaveProperty("row");
    expect(rv).toHaveProperty("status");
    expect(rv).toHaveProperty("message");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: POST /api/import/employees — live import (dryRun: false)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/import/employees — live insert", () => {
  it("returns dryRun:false and imported > 0 for valid rows", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "New Hire", Email: "newhire@test.com" }],
      dryRun: false,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dryRun).toBe(false);
    expect(json.imported).toBe(1);
  });

  it("does NOT import rows with missing Name", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "", Email: "missing-name@test.com" }],
      dryRun: false,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.imported).toBe(0);
    expect(json.errors).toBe(1);
  });

  it("does NOT import duplicate emails (skips, counts as duplicate)", async () => {
    makeMockForImportPOST({ existingEmails: ["dup@test.com"] });
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Dup Person", Email: "dup@test.com" }],
      dryRun: false,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.imported).toBe(0);
    expect(json.duplicates).toBe(1);
  });

  it("inserts employee with default role=employee and status=active", async () => {
    let capturedRecord: Record<string, unknown> = {};
    const supabase = createServerSupabaseClient as jest.Mock;
    let callCount = 0;
    supabase.mockReturnValueOnce({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "a1" } }, error: null }) },
      from: jest.fn((table: string) => {
        if (table === "employees") {
          callCount++;
          if (callCount === 1) return makeAuthChain("admin");
          if (callCount === 2) return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
          return {
            insert: jest.fn().mockImplementation((record: Record<string, unknown>) => {
              capturedRecord = record;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "audit_logs") return { insert: jest.fn().mockResolvedValue({ error: null }) };
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    });

    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "Auto Default", Email: "defaults@test.com" }],
      dryRun: false,
    });
    await importPOST(req);
    expect(capturedRecord).toMatchObject({
      role: "employee",
      status: "active",
      work_type: "full_time",
      salary: 0,
    });
  });

  it("counts DB insert error as row error (not a 500 crash)", async () => {
    makeMockForImportPOST({ insertError: "unique constraint" });
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [{ Name: "DB Fail", Email: "dbfail@test.com" }],
      dryRun: false,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.errors).toBe(1);
    expect(json.imported).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: GET /api/export/employees — XLSX export
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/export/employees", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuthAsAnon();
    const req = makeRequest("GET", "http://localhost/api/export/employees");
    const res = await exportGET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee role", async () => {
    mockAuthAsEmployee(true);
    const req = makeRequest("GET", "http://localhost/api/export/employees");
    const res = await exportGET(req);
    expect(res.status).toBe(403);
  });

  it("returns XLSX file for admin", async () => {
    makeMockForExportGET({
      employees: [
        { id: "EMP01", name: "Juan Cruz", email: "juan@test.com", role: "employee", status: "active" },
      ],
    });
    const req = makeRequest("GET", "http://localhost/api/export/employees");
    const res = await exportGET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });

  it("includes Content-Disposition with filename employees-export", async () => {
    makeMockForExportGET();
    const req = makeRequest("GET", "http://localhost/api/export/employees");
    const res = await exportGET(req);
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd.toLowerCase()).toContain("employees");
  });

  it("returns 200 with empty data (no employees)", async () => {
    makeMockForExportGET({ employees: [] });
    const req = makeRequest("GET", "http://localhost/api/export/employees");
    const res = await exportGET(req);
    expect(res.status).toBe(200);
  });

  it("accepts status filter param without errors", async () => {
    makeMockForExportGET({ employees: [] });
    const req = makeRequest("GET", "http://localhost/api/export/employees?status=active");
    const res = await exportGET(req);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: End-to-end import flow (parse → validate → import round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe("Employee import — end-to-end flow simulation", () => {
  /** Simulate the exact data that parseImportFile would return from the template */
  const TEMPLATE_ROWS = [
    { Name: "Juan Dela Cruz", Email: "juan@example.com", Phone: "+63 917 123 4567", Birthday: "1990-05-20", Address: "Manila, Philippines" },
    { Name: "Maria Santos", Email: "maria@example.com", Phone: "+63 918 234 5678", Birthday: "1993-11-15", Address: "Quezon City, Philippines" },
  ];

  it("dry run of template rows produces 2 valid, 0 errors, 0 duplicates", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: TEMPLATE_ROWS,
      dryRun: true,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(2);
    expect(json.errors).toBe(0);
    expect(json.duplicates).toBe(0);
    expect(json.dryRun).toBe(true);
    expect(json.imported).toBe(0);
  });

  it("live import of template rows inserts 2 employees", async () => {
    makeMockForImportPOST();
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: TEMPLATE_ROWS,
      dryRun: false,
    });
    const res = await importPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(2);
    expect(json.errors).toBe(0);
    expect(json.dryRun).toBe(false);
  });

  it("second import of same rows produces 2 duplicates (idempotent)", async () => {
    makeMockForImportPOST({
      existingEmails: ["juan@example.com", "maria@example.com"],
    });
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: TEMPLATE_ROWS,
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.duplicates).toBe(2);
    expect(json.valid).toBe(0);
    expect(json.imported).toBe(0);
  });

  it("mixed batch: 1 valid, 1 error, 1 duplicate", async () => {
    makeMockForImportPOST({ existingEmails: ["dup@test.com"] });
    const req = makeRequest("POST", "http://localhost/api/import/employees", {
      rows: [
        { Name: "Valid Person", Email: "valid@test.com" },    // valid
        { Name: "", Email: "error@test.com" },                // error: no name
        { Name: "Dup Person", Email: "dup@test.com" },        // duplicate
      ],
      dryRun: true,
    });
    const res = await importPOST(req);
    const json = await res.json();
    expect(json.valid).toBe(1);
    expect(json.errors).toBe(1);
    expect(json.duplicates).toBe(1);
  });
});
