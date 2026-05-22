/**
 * Migration 045 Integration Test
 * ================================
 * Validates that migration 045 (Payroll Simplification) is correctly applied
 * to the Supabase database. Runs against the LIVE Supabase instance.
 *
 * Run: npx tsx scripts/test-migration-045.ts
 *
 * Requirements: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Test Results Tracking ───────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function pass(name: string) {
  results.push({ name, passed: true });
  console.log(`  ✅ ${name}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  console.log(`  ❌ ${name}: ${message}`);
}

// ─── Helper: Check table exists via direct query ─────────────────────────────

async function tableExists(tableName: string): Promise<boolean> {
  const { error } = await supabase.from(tableName).select("*").limit(1);
  return !error;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  Migration 045 Integration Tests — Supabase                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // ── 1. Prerequisite Tables ─────────────────────────────────────────────────
  console.log("1️⃣  Prerequisites (should exist before migration)");

  const empExists = await tableExists("employees");
  empExists ? pass("employees table exists") : fail("employees table exists", "Table missing");

  const payslipsExists = await tableExists("payslips");
  payslipsExists ? pass("payslips table exists") : fail("payslips table exists", "Table missing");

  const runsExists = await tableExists("payroll_runs");
  runsExists ? pass("payroll_runs table exists") : fail("payroll_runs table exists", "Table missing");

  // ── 2. New Tables Created ──────────────────────────────────────────────────
  console.log("\n2️⃣  New Tables Created by Migration 045");

  const dtExists = await tableExists("deduction_templates");
  dtExists ? pass("deduction_templates table exists") : fail("deduction_templates table exists", "Table missing — STEP 2 failed");

  const edaExists = await tableExists("employee_deduction_assignments");
  edaExists ? pass("employee_deduction_assignments table exists") : fail("employee_deduction_assignments table exists", "Table missing — STEP 3 failed");

  const pliExists = await tableExists("payslip_line_items");
  pliExists ? pass("payslip_line_items table exists") : fail("payslip_line_items table exists", "Table missing — STEP 4 failed");

  // ── 3. Test employees.deduction_exempt column ──────────────────────────────
  console.log("\n3️⃣  New Columns (test via insert/select)");

  // Try to select deduction_exempt from employees
  const { data: empSample, error: empSelectErr } = await supabase
    .from("employees")
    .select("id, deduction_exempt, deduction_exempt_reason")
    .limit(1);
  if (empSelectErr) {
    fail("employees.deduction_exempt column", empSelectErr.message);
  } else {
    pass("employees.deduction_exempt column exists");
    pass("employees.deduction_exempt_reason column exists");
  }

  // Try to select custom_deductions from payslips
  const { data: psSample, error: psSelectErr } = await supabase
    .from("payslips")
    .select("id, custom_deductions, line_items_json")
    .limit(1);
  if (psSelectErr) {
    fail("payslips new columns", psSelectErr.message);
  } else {
    pass("payslips.custom_deductions column exists");
    pass("payslips.line_items_json column exists");
  }

  // Try to select completed_at from payroll_runs
  const { data: runSample, error: runSelectErr } = await supabase
    .from("payroll_runs")
    .select("id, completed_at")
    .limit(1);
  if (runSelectErr) {
    fail("payroll_runs.completed_at column", runSelectErr.message);
  } else {
    pass("payroll_runs.completed_at column exists");
  }

  // ── 4. Test deduction_templates schema ─────────────────────────────────────
  console.log("\n4️⃣  deduction_templates Schema Validation");

  const { data: dtSchema, error: dtSchemaErr } = await supabase
    .from("deduction_templates")
    .select("id, name, type, calculation_mode, value, conditions, applies_to_all, is_active, created_by, created_at")
    .limit(1);
  if (dtSchemaErr) {
    fail("deduction_templates schema", dtSchemaErr.message);
  } else {
    pass("deduction_templates has expected columns");
  }

  // ── 5. Test employee_deduction_assignments schema + FK ─────────────────────
  console.log("\n5️⃣  employee_deduction_assignments Schema Validation");

  const { data: edaSchema, error: edaSchemaErr } = await supabase
    .from("employee_deduction_assignments")
    .select("id, employee_id, template_id, override_value, effective_from, effective_until, is_active, assigned_by")
    .limit(1);
  if (edaSchemaErr) {
    fail("employee_deduction_assignments schema", edaSchemaErr.message);
  } else {
    pass("employee_deduction_assignments has expected columns");
  }

  // ── 6. Test payslip_line_items schema + FK ─────────────────────────────────
  console.log("\n6️⃣  payslip_line_items Schema Validation");

  const { data: pliSchema, error: pliSchemaErr } = await supabase
    .from("payslip_line_items")
    .select("id, payslip_id, label, type, amount, template_id, calculation_detail")
    .limit(1);
  if (pliSchemaErr) {
    fail("payslip_line_items schema", pliSchemaErr.message);
  } else {
    pass("payslip_line_items has expected columns");
  }

  // ── 7. No Stale Status Values ──────────────────────────────────────────────
  console.log("\n7️⃣  No Stale Status Values");

  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, status");
  
  const stalePayslipStatuses = payslips?.filter(p => !["draft", "published", "signed"].includes(p.status)) || [];
  if (stalePayslipStatuses.length === 0) {
    pass("No stale payslip statuses");
  } else {
    fail("Stale payslip statuses", `Found ${stalePayslipStatuses.length}: ${stalePayslipStatuses.slice(0, 3).map(p => p.status).join(", ")}`);
  }

  const { data: runs } = await supabase
    .from("payroll_runs")
    .select("id, status");
  
  const staleRunStatuses = runs?.filter(r => !["draft", "locked", "completed"].includes(r.status)) || [];
  if (staleRunStatuses.length === 0) {
    pass("No stale payroll_run statuses");
  } else {
    fail("Stale payroll_run statuses", `Found ${staleRunStatuses.length}: ${staleRunStatuses.slice(0, 3).map(r => r.status).join(", ")}`);
  }

  // ── 8. Smoke Test: CRUD on deduction_templates ─────────────────────────────
  console.log("\n8️⃣  Smoke Test: CRUD Operations");

  const testId = `DT-TEST-${Date.now()}`;
  
  // INSERT
  const { data: insertData, error: insertErr } = await supabase
    .from("deduction_templates")
    .insert({
      id: testId,
      name: "Automated Test Deduction",
      type: "deduction",
      calculation_mode: "fixed",
      value: 100,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr) {
    fail("INSERT deduction_template", insertErr.message);
  } else {
    pass("INSERT deduction_template");

    // UPDATE
    const { error: updateErr } = await supabase
      .from("deduction_templates")
      .update({ name: "Updated Test Deduction" })
      .eq("id", testId);
    updateErr ? fail("UPDATE deduction_template", updateErr.message) : pass("UPDATE deduction_template");

    // SELECT
    const { data: selectData, error: selectErr } = await supabase
      .from("deduction_templates")
      .select("*")
      .eq("id", testId)
      .single();
    if (selectErr) {
      fail("SELECT deduction_template", selectErr.message);
    } else if (selectData?.name !== "Updated Test Deduction") {
      fail("SELECT deduction_template", `Name mismatch: ${selectData?.name}`);
    } else {
      pass("SELECT deduction_template");
    }

    // DELETE
    const { error: deleteErr } = await supabase
      .from("deduction_templates")
      .delete()
      .eq("id", testId);
    deleteErr ? fail("DELETE deduction_template", deleteErr.message) : pass("DELETE deduction_template");
  }

  // ── 9. Smoke Test: INSERT payslip with new columns ─────────────────────────
  console.log("\n9️⃣  Smoke Test: Payslip with new columns");

  // Get an existing employee
  const { data: existingEmp } = await supabase
    .from("employees")
    .select("id")
    .limit(1)
    .single();

  if (existingEmp) {
    const testPayslipId = `PS-TEST-${Date.now()}`;
    const { error: psInsertErr } = await supabase
      .from("payslips")
      .insert({
        id: testPayslipId,
        employee_id: existingEmp.id,
        period_start: "2026-04-01",
        period_end: "2026-04-15",
        pay_frequency: "semi_monthly",
        gross_pay: 20000,
        sss_deduction: 900,
        philhealth_deduction: 500,
        pagibig_deduction: 100,
        tax_deduction: 1000,
        other_deductions: 0,
        loan_deduction: 0,
        net_pay: 17500,
        issued_at: new Date().toISOString(),
        status: "draft",  // NEW 3-state status
        custom_deductions: 500,
        line_items_json: JSON.stringify([{ label: "Test", type: "deduction", amount: 500 }]),
      });

    if (psInsertErr) {
      fail("INSERT payslip with status='draft'", psInsertErr.message);
    } else {
      pass("INSERT payslip with status='draft' and new columns");

      // Cleanup
      await supabase.from("payslips").delete().eq("id", testPayslipId);
    }
  } else {
    console.log("  ⚠️  Skipped payslip insert test (no employees found)");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                      TEST SUMMARY                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ❌`);
  console.log("");

  if (failed > 0) {
    console.log("Failed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.name}: ${r.message}`);
    });
    console.log("");
    console.log("🔴 Migration 045 verification FAILED");
    process.exit(1);
  } else {
    console.log("🟢 Migration 045 verification PASSED — All tests successful!");
    process.exit(0);
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
