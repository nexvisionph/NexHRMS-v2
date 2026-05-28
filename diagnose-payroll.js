// Diagnostic script — connects to Supabase using service role key and inspects payroll data.
// Run with: node diagnose-payroll.js
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Read .env.local manually
const envPath = path.join(__dirname, ".env.local");
const env = fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .reduce((acc, line) => {
        const [k, ...v] = line.split("=");
        if (k && v.length) acc[k.trim()] = v.join("=").trim();
        return acc;
    }, {});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
    console.log("=== Supabase Diagnostic ===");
    console.log("URL:", url);

    // 1. Check payslips table structure
    console.log("\n[1] Payslips table — first 5 rows:");
    const { data: payslips, error: psErr } = await supabase
        .from("payslips")
        .select("*")
        .limit(5)
        .order("issued_at", { ascending: false });
    if (psErr) console.error("Error:", psErr);
    else console.log(`Count: ${payslips.length}`, payslips);

    // 2. Total payslips count
    const { count: totalPayslips, error: cntErr } = await supabase
        .from("payslips")
        .select("*", { count: "exact", head: true });
    if (cntErr) console.error("Count error:", cntErr);
    else console.log(`\n[2] Total payslips in DB: ${totalPayslips}`);

    // 3. Payroll runs
    console.log("\n[3] Payroll runs — first 5:");
    const { data: runs, error: runsErr } = await supabase
        .from("payroll_runs")
        .select("*")
        .limit(5)
        .order("created_at", { ascending: false });
    if (runsErr) console.error("Error:", runsErr);
    else console.log(`Count: ${runs.length}`, runs);

    // 4. Try inserting a test payslip with admin client
    console.log("\n[4] Test insert (will be rolled back):");
    const testId = `PS-DIAG-${Date.now()}`;
    const { data: emps } = await supabase.from("employees").select("id").limit(1);
    const empId = emps?.[0]?.id;
    if (!empId) {
        console.error("No employees found");
    } else {
        const testRow = {
            id: testId,
            employee_id: empId,
            period_start: "2026-01-01",
            period_end: "2026-01-15",
            pay_frequency: "semi_monthly",
            gross_pay: 1000,
            allowances: 0,
            sss_deduction: 0,
            philhealth_deduction: 0,
            pagibig_deduction: 0,
            tax_deduction: 0,
            other_deductions: 0,
            loan_deduction: 0,
            net_pay: 1000,
            status: "draft",
            issued_at: new Date().toISOString(),
        };
        const { data: inserted, error: insErr } = await supabase
            .from("payslips")
            .insert(testRow)
            .select()
            .single();
        if (insErr) {
            console.error("Insert FAILED:", insErr);
        } else {
            console.log("Insert SUCCESS — record exists in DB");
            // Clean up
            await supabase.from("payslips").delete().eq("id", testId);
            console.log("Cleaned up test record");
        }
    }

    // 5. Check RLS policies on payslips
    console.log("\n[5] Checking schema column names for payslips:");
    const { data: cols, error: colErr } = await supabase
        .rpc("exec_sql", {
            query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'payslips' AND table_schema = 'public' ORDER BY ordinal_position"
        })
        .catch(() => ({ data: null, error: { message: "RPC not available" } }));
    if (colErr) {
        console.log("Cannot list columns via RPC. Trying alternative...");
        // Fetch a row and just print keys
        if (payslips && payslips[0]) {
            console.log("Columns from first row:", Object.keys(payslips[0]));
        }
    } else {
        console.log("Columns:", cols);
    }
}

main().catch(console.error);
