/**
 * complete-demo-accounts.ts
 *
 * Ensures all 10 demo login accounts have:
 *   1. A Supabase Auth user (password = demo1234)
 *   2. A profiles row with the correct role
 *   3. A complete employees row (job_title, salary, location, work_type,
 *      address, emergency_contact, work_days, pay_frequency, etc.)
 *
 * Also cleans up orphan face_enrollments rows that don't match any employee.
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/complete-demo-accounts.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "demo1234";

interface DemoAccount {
    email: string;
    role: "admin" | "hr" | "finance" | "employee" | "supervisor" | "payroll_admin" | "auditor";
    employeeId: string;
    name: string;
    department: string;
    job_title: string;
    work_type: "WFH" | "WFO" | "HYBRID" | "ONSITE";
    salary: number;
    join_date: string;
    productivity: number;
    location: string;
    phone: string;
    birthday: string;
    pin: string;
    address: string;
    emergency_contact: string;
    work_days: string[];
    pay_frequency: "monthly" | "semi_monthly" | "bi_weekly" | "weekly";
    whatsapp_number: string;
    preferred_channel: "email" | "whatsapp" | "sms" | "in_app";
}

const DEMO_ACCOUNTS: DemoAccount[] = [
    {
        email: "admin@nexhrms.com",
        role: "admin",
        employeeId: "EMP-ADMIN-01",
        name: "Alex Rivera",
        department: "Management",
        job_title: "System Administrator",
        work_type: "HYBRID",
        salary: 120000,
        join_date: "2022-01-15",
        productivity: 95,
        location: "BGC, Taguig",
        phone: "+63-917-555-0101",
        birthday: "1985-04-12",
        pin: "111111",
        address: "8th Avenue, Bonifacio Global City, Taguig 1634",
        emergency_contact: "Maria Rivera (Spouse) - +63-917-555-0102",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "monthly",
        whatsapp_number: "+63-917-555-0101",
        preferred_channel: "email",
    },
    {
        email: "hr@nexhrms.com",
        role: "hr",
        employeeId: "EMP-HR-01",
        name: "Jordan Lee",
        department: "Human Resources",
        job_title: "HR Manager",
        work_type: "HYBRID",
        salary: 85000,
        join_date: "2022-06-01",
        productivity: 92,
        location: "Makati City",
        phone: "+63-917-555-0201",
        birthday: "1988-09-25",
        pin: "222222",
        address: "Tower 2, Greenbelt Residences, Makati City 1223",
        emergency_contact: "Sam Lee (Brother) - +63-917-555-0202",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-555-0201",
        preferred_channel: "email",
    },
    {
        email: "finance@nexhrms.com",
        role: "finance",
        employeeId: "EMP-FIN-01",
        name: "Morgan Chen",
        department: "Finance",
        job_title: "Finance Manager",
        work_type: "WFO",
        salary: 95000,
        join_date: "2021-09-01",
        productivity: 94,
        location: "Ortigas Center",
        phone: "+63-917-555-0301",
        birthday: "1986-11-08",
        pin: "333333",
        address: "ADB Avenue, Ortigas Center, Pasig 1605",
        emergency_contact: "Lin Chen (Spouse) - +63-917-555-0302",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "monthly",
        whatsapp_number: "+63-917-555-0301",
        preferred_channel: "email",
    },
    {
        email: "employee@nexhrms.com",
        role: "employee",
        employeeId: "EMP-EMPLOYEE-01",
        name: "Sam Torres",
        department: "Engineering",
        job_title: "Frontend Developer",
        work_type: "HYBRID",
        salary: 65000,
        join_date: "2024-01-10",
        productivity: 85,
        location: "Manila",
        phone: "+63-917-555-0401",
        birthday: "1995-04-20",
        pin: "444444",
        address: "Padre Faura Street, Ermita, Manila 1000",
        emergency_contact: "Ana Torres (Mother) - +63-917-555-0402",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-555-0401",
        preferred_channel: "in_app",
    },
    {
        email: "supervisor@nexhrms.com",
        role: "supervisor",
        employeeId: "EMP-SUP-01",
        name: "Pat Reyes",
        department: "Engineering",
        job_title: "Engineering Supervisor",
        work_type: "HYBRID",
        salary: 90000,
        join_date: "2022-03-15",
        productivity: 91,
        location: "Quezon City",
        phone: "+63-917-555-0501",
        birthday: "1987-07-15",
        pin: "555555",
        address: "Tomas Morato Avenue, Quezon City 1103",
        emergency_contact: "Rico Reyes (Brother) - +63-917-555-0502",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-555-0501",
        preferred_channel: "email",
    },
    {
        email: "payroll@nexhrms.com",
        role: "payroll_admin",
        employeeId: "EMP-PAY-ADM-01",
        name: "Dana Cruz",
        department: "Finance",
        job_title: "Payroll Administrator",
        work_type: "WFO",
        salary: 70000,
        join_date: "2023-02-01",
        productivity: 93,
        location: "Pasig City",
        phone: "+63-917-555-0601",
        birthday: "1990-12-03",
        pin: "777777",
        address: "Julia Vargas Avenue, Ortigas Center, Pasig 1605",
        emergency_contact: "Leo Cruz (Father) - +63-917-555-0602",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "monthly",
        whatsapp_number: "+63-917-555-0601",
        preferred_channel: "email",
    },
    {
        email: "auditor@nexhrms.com",
        role: "auditor",
        employeeId: "EMP-AUD-01",
        name: "Rene Santos",
        department: "Compliance",
        job_title: "Internal Auditor",
        work_type: "WFH",
        salary: 80000,
        join_date: "2023-08-01",
        productivity: 90,
        location: "Cebu City",
        phone: "+63-917-555-0701",
        birthday: "1989-05-18",
        pin: "888888",
        address: "Cebu IT Park, Lahug, Cebu City 6000",
        emergency_contact: "Joy Santos (Spouse) - +63-917-555-0702",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "monthly",
        whatsapp_number: "+63-917-555-0701",
        preferred_channel: "email",
    },
    {
        email: "qr@nexhrms.com",
        role: "employee",
        employeeId: "EMP-QR-01",
        name: "Jamie Reyes",
        department: "Operations",
        job_title: "Field Technician",
        work_type: "ONSITE",
        salary: 45000,
        join_date: "2025-03-15",
        productivity: 88,
        location: "Marikina City",
        phone: "+63-917-555-0801",
        birthday: "1998-05-22",
        pin: "999999",
        address: "Marcos Highway, Marikina City 1800",
        emergency_contact: "Maria Reyes (Mother) - +63-917-555-0802",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-555-0801",
        preferred_channel: "whatsapp",
    },
    {
        email: "qr2@nexhrms.com",
        role: "employee",
        employeeId: "EMP-QR-02",
        name: "Riley Santos",
        department: "Operations",
        job_title: "Field Technician",
        work_type: "ONSITE",
        salary: 42000,
        join_date: "2025-06-01",
        productivity: 82,
        location: "Quezon City",
        phone: "+63-917-555-0901",
        birthday: "1999-11-08",
        pin: "121212",
        address: "Commonwealth Avenue, Quezon City 1121",
        emergency_contact: "Carlos Santos (Brother) - +63-917-555-0902",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-555-0901",
        preferred_channel: "whatsapp",
    },
    {
        email: "face@nexhrms.com",
        role: "employee",
        employeeId: "EMP-FACE-01",
        name: "Casey Morgan",
        department: "Operations",
        job_title: "Site Engineer",
        work_type: "ONSITE",
        salary: 50000,
        join_date: "2025-01-15",
        productivity: 87,
        location: "Makati City",
        phone: "+63-917-555-1001",
        birthday: "1996-08-14",
        pin: "131313",
        address: "Ayala Avenue, Makati City 1226",
        emergency_contact: "Jordan Morgan (Spouse) - +63-917-555-1002",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-555-1001",
        preferred_channel: "in_app",
    },
];

async function main() {
    console.log(`\nCompleting ${DEMO_ACCOUNTS.length} demo accounts in Supabase\n`);
    console.log(`URL: ${SUPABASE_URL}\n`);

    // Pre-fetch existing auth users to avoid N+1
    const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authByEmail = new Map((allUsers?.users ?? []).map((u) => [u.email ?? "", u]));

    // Pre-fetch existing employees rows by email so we can MERGE rather than create dupes
    const { data: existingEmps } = await supabase
        .from("employees")
        .select("id, email, profile_id")
        .in("email", DEMO_ACCOUNTS.map((a) => a.email));
    const empByEmail = new Map((existingEmps ?? []).map((e) => [e.email, e]));

    let authCreated = 0, authReset = 0, empUpserted = 0, errors = 0;

    for (const acc of DEMO_ACCOUNTS) {
        try {
            // 1) Auth user
            let authUser = authByEmail.get(acc.email);
            if (!authUser) {
                const { data, error } = await supabase.auth.admin.createUser({
                    email: acc.email,
                    password: DEMO_PASSWORD,
                    email_confirm: true,
                    user_metadata: { name: acc.name, role: acc.role },
                });
                if (error || !data.user) throw new Error(`auth create: ${error?.message}`);
                authUser = data.user;
                authCreated++;
                console.log(`  AUTH CREATED  ${acc.email.padEnd(28)} ${acc.role}`);
            } else {
                const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
                    password: DEMO_PASSWORD,
                    email_confirm: true,
                    user_metadata: { name: acc.name, role: acc.role },
                });
                if (error) console.warn(`  AUTH WARN     ${acc.email}: ${error.message}`);
                else authReset++;
            }

            const profileId = authUser.id;

            // 2) Profile (must match the role)
            const { error: pErr } = await supabase.from("profiles").upsert({
                id: profileId,
                name: acc.name,
                email: acc.email,
                role: acc.role,
                department: acc.department,
                must_change_password: false,
                profile_complete: true,
            }, { onConflict: "id" });
            if (pErr) console.warn(`  PROFILE WARN  ${acc.email}: ${pErr.message}`);

            // 3) Employees row — use existing ID if present, else our canonical ID
            const empId = empByEmail.get(acc.email)?.id ?? acc.employeeId;

            const { error: eErr } = await supabase.from("employees").upsert({
                id: empId,
                profile_id: profileId,
                name: acc.name,
                email: acc.email,
                role: acc.role,
                department: acc.department,
                status: "active",
                work_type: acc.work_type,
                salary: acc.salary,
                join_date: acc.join_date,
                productivity: acc.productivity,
                location: acc.location,
                phone: acc.phone,
                birthday: acc.birthday,
                pin: acc.pin,
                address: acc.address,
                emergency_contact: acc.emergency_contact,
                work_days: acc.work_days,
                pay_frequency: acc.pay_frequency,
                whatsapp_number: acc.whatsapp_number,
                preferred_channel: acc.preferred_channel,
                job_title: acc.job_title,
            }, { onConflict: "id" });

            if (eErr) {
                console.error(`  EMP ERROR     ${acc.email}: ${eErr.message}`);
                errors++;
            } else {
                empUpserted++;
                console.log(`  EMP UPSERTED  ${empId.padEnd(20)} ${acc.email.padEnd(28)} ${acc.role}`);
            }
        } catch (err) {
            errors++;
            console.error(`  FATAL         ${acc.email}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // 4) Clean up orphan face_enrollments — rows pointing to non-existent employees
    console.log(`\nChecking for orphan face_enrollments...`);
    const { data: enrollments } = await supabase.from("face_enrollments").select("id, employee_id, is_active");
    if (enrollments?.length) {
        const empIds = new Set((existingEmps ?? []).map((e) => e.id).concat(DEMO_ACCOUNTS.map((a) => a.employeeId)));
        // Also check ALL employees to be safe
        const { data: allEmps } = await supabase.from("employees").select("id");
        for (const e of allEmps ?? []) empIds.add(e.id);

        for (const fe of enrollments) {
            if (!empIds.has(fe.employee_id)) {
                const { error } = await supabase.from("face_enrollments").delete().eq("id", fe.id);
                if (error) console.warn(`  ORPHAN WARN   ${fe.id} (${fe.employee_id}): ${error.message}`);
                else console.log(`  ORPHAN DELETED ${fe.id} (${fe.employee_id})`);
            }
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`  Auth created : ${authCreated}`);
    console.log(`  Auth reset   : ${authReset}`);
    console.log(`  Employees up : ${empUpserted}`);
    console.log(`  Errors       : ${errors}`);

    // 5) Final verification
    console.log(`\n=== VERIFICATION ===\n`);
    const { data: verify } = await supabase
        .from("employees")
        .select("id, name, email, role, department, job_title, salary, work_type, profile_id")
        .in("email", DEMO_ACCOUNTS.map((a) => a.email))
        .order("role");
    console.log(`  ID                    Role             Email                          Job Title                  Salary    Profile`);
    console.log(`  ${"-".repeat(120)}`);
    for (const e of verify ?? []) {
        console.log(`  ${e.id.padEnd(20)}  ${(e.role ?? "").padEnd(15)}  ${(e.email ?? "").padEnd(30)}  ${(e.job_title ?? "").padEnd(25)}  ${String(e.salary ?? 0).padStart(8)}  ${e.profile_id ? "ok" : "MISSING"}`);
    }

    process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
});
