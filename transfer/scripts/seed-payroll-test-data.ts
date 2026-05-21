/**
 * Seed script for payroll test data
 * Creates:
 * 1. Test employees with complete Philippine details
 * 2. Realistic deduction templates
 * 3. Realistic allowance templates
 * 4. Employee deduction/allowance assignments
 * 5. Tax override examples
 * 
 * Run: npx tsx scripts/seed-payroll-test-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ────────────────────────────────────────────────────────────────
//  TEST EMPLOYEES - Complete Philippine payroll test data
// ────────────────────────────────────────────────────────────────
const TEST_EMPLOYEES = [
    {
        id: "EMP-PAYROLL-001",
        name: "Maria Santos Cruz",
        email: "maria.cruz@nexhrms.test",
        role: "employee",
        department: "Engineering",
        job_title: "Senior Software Engineer",
        status: "active",
        work_type: "HYBRID",
        salary: 85000, // ₱85,000/month
        join_date: "2023-01-15",
        productivity: 92,
        location: "Makati City",
        phone: "+63 917 555 0001",
        birthday: "1990-08-15",
        address: "Unit 1205 The Residences, Ayala Avenue, Makati City 1226",
        emergency_contact: "Juan Cruz (Husband) - +63 918 555 0001",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
        id: "EMP-PAYROLL-002",
        name: "Juan Miguel Reyes",
        email: "juan.reyes@nexhrms.test",
        role: "employee",
        department: "Engineering",
        job_title: "Full Stack Developer",
        status: "active",
        work_type: "WFH",
        salary: 65000, // ₱65,000/month
        join_date: "2023-06-01",
        productivity: 88,
        location: "Quezon City",
        phone: "+63 918 555 0002",
        birthday: "1992-03-22",
        address: "123 Kalayaan Avenue, Diliman, Quezon City 1101",
        emergency_contact: "Rosa Reyes (Mother) - +63 919 555 0002",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
        id: "EMP-PAYROLL-003",
        name: "Ana Patricia Villanueva",
        email: "ana.villanueva@nexhrms.test",
        role: "employee",
        department: "Finance",
        job_title: "Senior Accountant",
        status: "active",
        work_type: "WFO",
        salary: 55000, // ₱55,000/month
        join_date: "2022-09-15",
        productivity: 95,
        location: "Ortigas Center",
        phone: "+63 917 555 0003",
        birthday: "1988-11-30",
        address: "Block 5 Lot 12, Greenwoods Executive Village, Pasig City 1600",
        emergency_contact: "Pedro Villanueva (Father) - +63 920 555 0003",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
        id: "EMP-PAYROLL-004",
        name: "Carlo Miguel Gonzales",
        email: "carlo.gonzales@nexhrms.test",
        role: "employee",
        department: "Operations",
        job_title: "Field Technician",
        status: "active",
        work_type: "ONSITE",
        salary: 28000, // ₱28,000/month - minimum wage bracket
        join_date: "2024-01-10",
        productivity: 85,
        location: "Parañaque City",
        phone: "+63 919 555 0004",
        birthday: "1995-05-18",
        address: "456 Don Bosco Street, BF Homes, Parañaque City 1720",
        emergency_contact: "Lucia Gonzales (Wife) - +63 921 555 0004",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    {
        id: "EMP-PAYROLL-005",
        name: "Elena Marie Tan",
        email: "elena.tan@nexhrms.test",
        role: "hr",
        department: "Human Resources",
        job_title: "HR Manager",
        status: "active",
        work_type: "HYBRID",
        salary: 75000, // ₱75,000/month
        join_date: "2021-03-01",
        productivity: 90,
        location: "BGC Taguig",
        phone: "+63 917 555 0005",
        birthday: "1985-12-08",
        address: "8th Avenue corner 26th Street, BGC, Taguig City 1634",
        emergency_contact: "Michael Tan (Brother) - +63 922 555 0005",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
        id: "EMP-PAYROLL-006",
        name: "Roberto James Aquino",
        email: "roberto.aquino@nexhrms.test",
        role: "supervisor",
        department: "Engineering",
        job_title: "Engineering Lead",
        status: "active",
        work_type: "HYBRID",
        salary: 120000, // ₱120,000/month - senior management
        join_date: "2020-06-15",
        productivity: 94,
        location: "Makati City",
        phone: "+63 918 555 0006",
        birthday: "1983-07-25",
        address: "Tower 2, Greenbelt Residences, Makati City 1223",
        emergency_contact: "Cristina Aquino (Wife) - +63 923 555 0006",
        pay_frequency: "monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
        id: "EMP-PAYROLL-007",
        name: "Lisa Marie Fernandez",
        email: "lisa.fernandez@nexhrms.test",
        role: "employee",
        department: "Marketing",
        job_title: "Marketing Specialist",
        status: "active",
        work_type: "WFH",
        salary: 45000, // ₱45,000/month
        join_date: "2023-11-01",
        productivity: 82,
        location: "Cebu City",
        phone: "+63 917 555 0007",
        birthday: "1994-09-14",
        address: "Unit 502 IT Park Tower, Lahug, Cebu City 6000",
        emergency_contact: "Carmen Fernandez (Mother) - +63 924 555 0007",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
        id: "EMP-PAYROLL-008",
        name: "Mark Anthony Dela Cruz",
        email: "mark.delacruz@nexhrms.test",
        role: "employee",
        department: "Sales",
        job_title: "Sales Executive",
        status: "active",
        work_type: "ONSITE",
        salary: 35000, // ₱35,000/month + commission
        join_date: "2024-03-15",
        productivity: 78,
        location: "Alabang",
        phone: "+63 919 555 0008",
        birthday: "1996-02-28",
        address: "Phase 3 Block 7, Filinvest Corporate City, Alabang 1781",
        emergency_contact: "Sandra Dela Cruz (Sister) - +63 925 555 0008",
        pay_frequency: "semi_monthly",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
];

// ────────────────────────────────────────────────────────────────
//  DEDUCTION TEMPLATES - Realistic Philippine payroll deductions
// ────────────────────────────────────────────────────────────────
const DEDUCTION_TEMPLATES = [
    // Company Loan Deductions
    {
        id: "DT-COMPANY-LOAN",
        name: "Company Loan",
        type: "deduction",
        calculation_mode: "fixed",
        value: 5000,
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    {
        id: "DT-EMERGENCY-LOAN",
        name: "Emergency Loan",
        type: "deduction",
        calculation_mode: "fixed",
        value: 2000,
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    // Benefit Deductions (employee share)
    {
        id: "DT-HMO-PREMIUM",
        name: "HMO Premium (Employee Share)",
        type: "deduction",
        calculation_mode: "fixed",
        value: 1500,
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    {
        id: "DT-LIFE-INSURANCE",
        name: "Life Insurance Premium",
        type: "deduction",
        calculation_mode: "fixed",
        value: 500,
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    // Late/Absence Deductions
    {
        id: "DT-LATE-DEDUCTION",
        name: "Late Deduction",
        type: "deduction",
        calculation_mode: "hourly",
        value: 150, // per hour late
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    {
        id: "DT-ABSENCE-DEDUCTION",
        name: "Absence Deduction",
        type: "deduction",
        calculation_mode: "daily",
        value: 0, // computed from daily rate
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    // Uniform/Equipment
    {
        id: "DT-UNIFORM-DEDUCTION",
        name: "Uniform Cost Recovery",
        type: "deduction",
        calculation_mode: "fixed",
        value: 500,
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
];

// ────────────────────────────────────────────────────────────────
//  ALLOWANCE TEMPLATES - Philippine standard allowances
// ────────────────────────────────────────────────────────────────
const ALLOWANCE_TEMPLATES = [
    // De Minimis Benefits (tax-exempt up to limits)
    {
        id: "DT-RICE-SUBSIDY",
        name: "Rice Subsidy",
        type: "allowance",
        calculation_mode: "fixed",
        value: 2000, // ₱2,000/month (tax-exempt up to ₱2,000)
        conditions: null,
        applies_to_all: true,
        is_active: true,
    },
    {
        id: "DT-MEAL-ALLOWANCE",
        name: "Meal Allowance",
        type: "allowance",
        calculation_mode: "daily",
        value: 150, // ₱150/day
        conditions: { minWorkDays: 1 },
        applies_to_all: true,
        is_active: true,
    },
    {
        id: "DT-TRANSPORTATION",
        name: "Transportation Allowance",
        type: "allowance",
        calculation_mode: "fixed",
        value: 2500, // ₱2,500/month
        conditions: { workTypes: ["WFO", "HYBRID", "ONSITE"] },
        applies_to_all: false,
        is_active: true,
    },
    {
        id: "DT-COMMUNICATION",
        name: "Communication Allowance",
        type: "allowance",
        calculation_mode: "fixed",
        value: 1500, // ₱1,500/month
        conditions: null,
        applies_to_all: false,
        is_active: true,
    },
    {
        id: "DT-INTERNET",
        name: "Internet/Data Allowance",
        type: "allowance",
        calculation_mode: "fixed",
        value: 1000, // ₱1,000/month (for WFH employees)
        conditions: { workTypes: ["WFH", "HYBRID"] },
        applies_to_all: false,
        is_active: true,
    },
    {
        id: "DT-CLOTHING",
        name: "Clothing Allowance",
        type: "allowance",
        calculation_mode: "fixed",
        value: 500, // ₱500/month (tax-exempt up to ₱6,000/year)
        conditions: null,
        applies_to_all: true,
        is_active: true,
    },
    // Performance-based
    {
        id: "DT-PRODUCTIVITY-BONUS",
        name: "Productivity Bonus",
        type: "allowance",
        calculation_mode: "percentage",
        value: 5, // 5% of basic salary
        conditions: { minProductivity: 85 },
        applies_to_all: false,
        is_active: true,
    },
    // Position-based
    {
        id: "DT-SUPERVISOR-ALLOWANCE",
        name: "Supervisory Allowance",
        type: "allowance",
        calculation_mode: "fixed",
        value: 5000, // ₱5,000/month for supervisors
        conditions: { roles: ["supervisor", "hr", "finance"] },
        applies_to_all: false,
        is_active: true,
    },
    // Field work allowance
    {
        id: "DT-FIELD-ALLOWANCE",
        name: "Field Work Allowance",
        type: "allowance",
        calculation_mode: "daily",
        value: 300, // ₱300/day for ONSITE workers
        conditions: { workTypes: ["ONSITE"] },
        applies_to_all: false,
        is_active: true,
    },
];

// ────────────────────────────────────────────────────────────────
//  EMPLOYEE ASSIGNMENTS - Who gets what
// ────────────────────────────────────────────────────────────────
const EMPLOYEE_ASSIGNMENTS = [
    // Maria Santos Cruz - Senior Engineer
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-TRANSPORTATION" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-COMMUNICATION" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-INTERNET" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-PRODUCTIVITY-BONUS" },
    { employee_id: "EMP-PAYROLL-001", template_id: "DT-HMO-PREMIUM" },

    // Juan Miguel Reyes - Full Stack Developer (WFH)
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-INTERNET" },
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-COMMUNICATION" },
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-PRODUCTIVITY-BONUS" },
    { employee_id: "EMP-PAYROLL-002", template_id: "DT-COMPANY-LOAN", override_value: 3000 },

    // Ana Patricia Villanueva - Senior Accountant
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-TRANSPORTATION" },
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-PRODUCTIVITY-BONUS" },
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-HMO-PREMIUM" },
    { employee_id: "EMP-PAYROLL-003", template_id: "DT-LIFE-INSURANCE" },

    // Carlo Miguel Gonzales - Field Technician (ONSITE)
    { employee_id: "EMP-PAYROLL-004", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-004", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-004", template_id: "DT-TRANSPORTATION" },
    { employee_id: "EMP-PAYROLL-004", template_id: "DT-FIELD-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-004", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-004", template_id: "DT-UNIFORM-DEDUCTION" },

    // Elena Marie Tan - HR Manager
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-TRANSPORTATION" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-COMMUNICATION" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-INTERNET" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-SUPERVISOR-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-HMO-PREMIUM" },
    { employee_id: "EMP-PAYROLL-005", template_id: "DT-LIFE-INSURANCE" },

    // Roberto James Aquino - Engineering Lead
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-TRANSPORTATION" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-COMMUNICATION" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-INTERNET" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-SUPERVISOR-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-PRODUCTIVITY-BONUS" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-HMO-PREMIUM" },
    { employee_id: "EMP-PAYROLL-006", template_id: "DT-LIFE-INSURANCE" },

    // Lisa Marie Fernandez - Marketing Specialist (WFH, Cebu)
    { employee_id: "EMP-PAYROLL-007", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-007", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-007", template_id: "DT-INTERNET" },
    { employee_id: "EMP-PAYROLL-007", template_id: "DT-COMMUNICATION" },
    { employee_id: "EMP-PAYROLL-007", template_id: "DT-CLOTHING" },
    { employee_id: "EMP-PAYROLL-007", template_id: "DT-EMERGENCY-LOAN" },

    // Mark Anthony Dela Cruz - Sales Executive (ONSITE)
    { employee_id: "EMP-PAYROLL-008", template_id: "DT-RICE-SUBSIDY" },
    { employee_id: "EMP-PAYROLL-008", template_id: "DT-MEAL-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-008", template_id: "DT-TRANSPORTATION" },
    { employee_id: "EMP-PAYROLL-008", template_id: "DT-FIELD-ALLOWANCE" },
    { employee_id: "EMP-PAYROLL-008", template_id: "DT-COMMUNICATION" },
    { employee_id: "EMP-PAYROLL-008", template_id: "DT-CLOTHING" },
];

// ────────────────────────────────────────────────────────────────
//  TAX OVERRIDES - Custom tax configurations
// ────────────────────────────────────────────────────────────────
const TAX_OVERRIDES = [
    // Senior management has specific Pag-IBIG contribution (max)
    {
        id: "DO-EMP-PAYROLL-006-pagibig",
        employee_id: "EMP-PAYROLL-006",
        deduction_type: "pagibig",
        mode: "fixed",
        fixed_amount: 200, // Maximum Pag-IBIG contribution
    },
    // Field technician exempt from withholding tax (below threshold)
    {
        id: "DO-EMP-PAYROLL-004-bir",
        employee_id: "EMP-PAYROLL-004",
        deduction_type: "bir",
        mode: "exempt", // Below minimum taxable income
    },
];

// ────────────────────────────────────────────────────────────────
//  MAIN SEED FUNCTION
// ────────────────────────────────────────────────────────────────
async function seed() {
    console.log("🌱 Starting payroll test data seed...\n");

    // 1. Insert employees
    console.log("👥 Creating test employees...");
    const { error: empError } = await supabase
        .from("employees")
        .upsert(TEST_EMPLOYEES, { onConflict: "id" });
    
    if (empError) {
        console.error("❌ Failed to insert employees:", empError.message);
        return;
    }
    console.log(`   ✅ ${TEST_EMPLOYEES.length} employees created/updated`);

    // 2. Insert deduction templates
    console.log("\n💸 Creating deduction templates...");
    const { error: dedError } = await supabase
        .from("deduction_templates")
        .upsert(DEDUCTION_TEMPLATES, { onConflict: "id" });
    
    if (dedError) {
        console.error("❌ Failed to insert deduction templates:", dedError.message);
        return;
    }
    console.log(`   ✅ ${DEDUCTION_TEMPLATES.length} deduction templates created/updated`);

    // 3. Insert allowance templates
    console.log("\n💰 Creating allowance templates...");
    const { error: allowError } = await supabase
        .from("deduction_templates")
        .upsert(ALLOWANCE_TEMPLATES, { onConflict: "id" });
    
    if (allowError) {
        console.error("❌ Failed to insert allowance templates:", allowError.message);
        return;
    }
    console.log(`   ✅ ${ALLOWANCE_TEMPLATES.length} allowance templates created/updated`);

    // 4. Insert employee assignments
    console.log("\n📋 Assigning deductions/allowances to employees...");
    const assignmentRecords = EMPLOYEE_ASSIGNMENTS.map((a, idx) => ({
        id: `EDA-SEED-${String(idx + 1).padStart(3, "0")}`,
        employee_id: a.employee_id,
        template_id: a.template_id,
        override_value: a.override_value ?? null,
        effective_from: "2024-01-01",
        is_active: true,
        assigned_by: "SYSTEM",
    }));

    const { error: assignError } = await supabase
        .from("employee_deduction_assignments")
        .upsert(assignmentRecords, { onConflict: "id" });
    
    if (assignError) {
        console.error("❌ Failed to insert assignments:", assignError.message);
        return;
    }
    console.log(`   ✅ ${assignmentRecords.length} assignments created/updated`);

    // 5. Insert tax overrides
    console.log("\n🏛️ Creating tax overrides...");
    const { error: taxError } = await supabase
        .from("deduction_overrides")
        .upsert(TAX_OVERRIDES, { onConflict: "id" });
    
    if (taxError) {
        console.error("❌ Failed to insert tax overrides:", taxError.message);
        return;
    }
    console.log(`   ✅ ${TAX_OVERRIDES.length} tax overrides created/updated`);

    // Summary
    console.log("\n" + "═".repeat(60));
    console.log("🎉 PAYROLL TEST DATA SEED COMPLETE!");
    console.log("═".repeat(60));
    console.log(`
📊 Summary:
   • ${TEST_EMPLOYEES.length} test employees created
   • ${DEDUCTION_TEMPLATES.length} deduction templates created
   • ${ALLOWANCE_TEMPLATES.length} allowance templates created
   • ${EMPLOYEE_ASSIGNMENTS.length} employee assignments created
   • ${TAX_OVERRIDES.length} tax overrides created

🧪 Test Accounts:
`);
    TEST_EMPLOYEES.forEach((emp) => {
        console.log(`   • ${emp.name} (${emp.email})`);
        console.log(`     Role: ${emp.job_title} | Salary: ₱${emp.salary.toLocaleString()}/month`);
    });
    console.log(`
💡 To test payroll computation:
   1. Go to Payroll → Management tab
   2. Select an employee or create a new payroll run
   3. Deductions and allowances will be auto-applied based on assignments

📝 Note: All test account passwords default to "Test@123" if you create auth profiles.
`);
}

seed().catch(console.error);
