/**
 * seed-supabase-users.ts
 *
 * Creates all 8 demo user accounts in Supabase Auth, ensures profiles are
 * correct, and upserts employees table records for the employee-role accounts.
 *
 * Idempotent â€” safe to run multiple times. Existing auth users get their
 * password reset to demo1234 and their profile/employee records corrected.
 *
 * Usage:
 *   npx tsx scripts/seed-supabase-users.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("âŒ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("âŒ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("   Get it from: Supabase Dashboard â†’ Settings â†’ API â†’ service_role");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "demo1234";

// â”€â”€â”€ Auth + Profile accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEMO_ACCOUNTS = [
  { name: "Alex Rivera",  email: "admin@nexhrms.com",      role: "admin",         department: "Management" },
  { name: "Jordan Lee",   email: "hr@nexhrms.com",         role: "hr",            department: "Human Resources" },
  { name: "Morgan Chen",  email: "finance@nexhrms.com",    role: "finance",       department: "Finance" },
  { name: "Sam Torres",   email: "employee@nexhrms.com",   role: "employee",      department: "Engineering" },
  { name: "Pat Reyes",    email: "supervisor@nexhrms.com", role: "supervisor",    department: "Engineering" },
  { name: "Dana Cruz",    email: "payroll@nexhrms.com",    role: "payroll_admin", department: "Finance" },
  { name: "Rene Santos",  email: "auditor@nexhrms.com",    role: "auditor",       department: "Compliance" },
  { name: "Jamie Reyes",  email: "qr@nexhrms.com",         role: "employee",      department: "Operations" },
  { name: "Riley Santos", email: "qr2@nexhrms.com",        role: "employee",      department: "Operations" },
  // â”€â”€â”€ Payroll Test Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { name: "Maria Santos Cruz",       email: "maria.cruz@nexhrms.test",       role: "employee",   department: "Engineering" },
  { name: "Juan Miguel Reyes",       email: "juan.reyes@nexhrms.test",       role: "employee",   department: "Engineering" },
  { name: "Ana Patricia Villanueva", email: "ana.villanueva@nexhrms.test",   role: "employee",   department: "Finance" },
  { name: "Carlo Miguel Gonzales",   email: "carlo.gonzales@nexhrms.test",   role: "employee",   department: "Operations" },
  { name: "Elena Marie Tan",         email: "elena.tan@nexhrms.test",        role: "hr",         department: "Human Resources" },
  { name: "Roberto James Aquino",    email: "roberto.aquino@nexhrms.test",   role: "supervisor", department: "Engineering" },
  { name: "Lisa Marie Fernandez",    email: "lisa.fernandez@nexhrms.test",   role: "employee",   department: "Marketing" },
  { name: "Mark Anthony Dela Cruz",  email: "mark.delacruz@nexhrms.test",    role: "employee",   department: "Sales" },
];

// â”€â”€â”€ employees table records for accounts that are role="employee" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// profileId is populated at runtime after auth user is resolved.
const DEMO_EMPLOYEE_RECORDS: Record<string, {
  id: string; name: string; email: string; department: string;
  job_title: string; work_type: string; salary: number; join_date: string;
  productivity: number; location: string; phone: string; birthday: string;
  pin: string; status: string;
  address?: string; emergency_contact?: string;
  work_days?: string[]; pay_frequency?: string; whatsapp_number?: string;
}> = {
  "employee@nexhrms.com": {
    id: "EMP026",
    name: "Sam Torres",
    email: "employee@nexhrms.com",
    department: "Engineering",
    job_title: "Frontend Developer",
    work_type: "WFO",
    salary: 88000,
    join_date: "2024-01-10",
    productivity: 82,
    location: "Manila",
    phone: "+63-555-0126",
    birthday: "1995-04-20",
    pin: "666666",
    status: "active",
  },
  "qr@nexhrms.com": {
    id: "EMP027",
    name: "Jamie Reyes",
    email: "qr@nexhrms.com",
    department: "Operations",
    job_title: "Field Technician",
    work_type: "ONSITE",
    salary: 45000,
    join_date: "2025-03-15",
    productivity: 88,
    location: "Marikina, Metro Manila",
    phone: "+63-917-1234567",
    birthday: "1998-05-22",
    pin: "",
    status: "active",
    address: "123 Shoe Ave, Marikina City, Metro Manila",
    emergency_contact: "Maria Reyes - +63-918-7654321",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
    whatsapp_number: "+63-917-1234567",
  },
  "qr2@nexhrms.com": {
    id: "EMP028",
    name: "Riley Santos",
    email: "qr2@nexhrms.com",
    department: "Operations",
    job_title: "Field Technician",
    work_type: "ONSITE",
    salary: 42000,
    join_date: "2025-06-01",
    productivity: 82,
    location: "Quezon City, Metro Manila",
    phone: "+63-918-9876543",
    birthday: "1999-11-08",
    pin: "",
    status: "active",
    address: "456 Commonwealth Ave, Quezon City, Metro Manila",
    emergency_contact: "Carlos Santos - +63-919-1112222",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
    whatsapp_number: "+63-918-9876543",
  },
  // â”€â”€â”€ Payroll Test Employees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "maria.cruz@nexhrms.test": {
    id: "EMP-PAY-001",
    name: "Maria Santos Cruz",
    email: "maria.cruz@nexhrms.test",
    department: "Engineering",
    job_title: "Senior Software Engineer",
    work_type: "HYBRID",
    salary: 85000,
    join_date: "2023-01-15",
    productivity: 92,
    location: "Makati City",
    phone: "+63 917 555 0001",
    birthday: "1990-08-15",
    pin: "100100",
    status: "active",
    address: "Unit 1205 The Residences, Ayala Avenue, Makati City 1226",
    emergency_contact: "Juan Cruz (Husband) - +63 918 555 0001",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
  },
  "juan.reyes@nexhrms.test": {
    id: "EMP-PAY-002",
    name: "Juan Miguel Reyes",
    email: "juan.reyes@nexhrms.test",
    department: "Engineering",
    job_title: "Full Stack Developer",
    work_type: "WFH",
    salary: 65000,
    join_date: "2023-06-01",
    productivity: 88,
    location: "Quezon City",
    phone: "+63 918 555 0002",
    birthday: "1992-03-22",
    pin: "200200",
    status: "active",
    address: "123 Kalayaan Avenue, Diliman, Quezon City 1101",
    emergency_contact: "Rosa Reyes (Mother) - +63 919 555 0002",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
  },
  "ana.villanueva@nexhrms.test": {
    id: "EMP-PAY-003",
    name: "Ana Patricia Villanueva",
    email: "ana.villanueva@nexhrms.test",
    department: "Finance",
    job_title: "Senior Accountant",
    work_type: "WFO",
    salary: 55000,
    join_date: "2022-09-15",
    productivity: 95,
    location: "Ortigas Center",
    phone: "+63 917 555 0003",
    birthday: "1988-11-30",
    pin: "300300",
    status: "active",
    address: "Block 5 Lot 12, Greenwoods Executive Village, Pasig City 1600",
    emergency_contact: "Pedro Villanueva (Father) - +63 920 555 0003",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
  },
  "carlo.gonzales@nexhrms.test": {
    id: "EMP-PAY-004",
    name: "Carlo Miguel Gonzales",
    email: "carlo.gonzales@nexhrms.test",
    department: "Operations",
    job_title: "Field Technician",
    work_type: "ONSITE",
    salary: 28000,
    join_date: "2024-01-10",
    productivity: 85,
    location: "ParaÃ±aque City",
    phone: "+63 919 555 0004",
    birthday: "1995-05-18",
    pin: "400400",
    status: "active",
    address: "456 Don Bosco Street, BF Homes, ParaÃ±aque City 1720",
    emergency_contact: "Lucia Gonzales (Wife) - +63 921 555 0004",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    pay_frequency: "semi_monthly",
  },
  "elena.tan@nexhrms.test": {
    id: "EMP-PAY-005",
    name: "Elena Marie Tan",
    email: "elena.tan@nexhrms.test",
    department: "Human Resources",
    job_title: "HR Manager",
    work_type: "HYBRID",
    salary: 75000,
    join_date: "2021-03-01",
    productivity: 90,
    location: "BGC Taguig",
    phone: "+63 917 555 0005",
    birthday: "1985-12-08",
    pin: "500500",
    status: "active",
    address: "8th Avenue corner 26th Street, BGC, Taguig City 1634",
    emergency_contact: "Michael Tan (Brother) - +63 922 555 0005",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
  },
  "roberto.aquino@nexhrms.test": {
    id: "EMP-PAY-006",
    name: "Roberto James Aquino",
    email: "roberto.aquino@nexhrms.test",
    department: "Engineering",
    job_title: "Engineering Lead",
    work_type: "HYBRID",
    salary: 120000,
    join_date: "2020-06-15",
    productivity: 94,
    location: "Makati City",
    phone: "+63 918 555 0006",
    birthday: "1983-07-25",
    pin: "600600",
    status: "active",
    address: "Tower 2, Greenbelt Residences, Makati City 1223",
    emergency_contact: "Cristina Aquino (Wife) - +63 923 555 0006",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "monthly",
  },
  "lisa.fernandez@nexhrms.test": {
    id: "EMP-PAY-007",
    name: "Lisa Marie Fernandez",
    email: "lisa.fernandez@nexhrms.test",
    department: "Marketing",
    job_title: "Marketing Specialist",
    work_type: "WFH",
    salary: 45000,
    join_date: "2023-11-01",
    productivity: 82,
    location: "Cebu City",
    phone: "+63 917 555 0007",
    birthday: "1994-09-14",
    pin: "700700",
    status: "active",
    address: "Unit 502 IT Park Tower, Lahug, Cebu City 6000",
    emergency_contact: "Carmen Fernandez (Mother) - +63 924 555 0007",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pay_frequency: "semi_monthly",
  },
  "mark.delacruz@nexhrms.test": {
    id: "EMP-PAY-008",
    name: "Mark Anthony Dela Cruz",
    email: "mark.delacruz@nexhrms.test",
    department: "Sales",
    job_title: "Sales Executive",
    work_type: "ONSITE",
    salary: 35000,
    join_date: "2024-03-15",
    productivity: 78,
    location: "Alabang",
    phone: "+63 919 555 0008",
    birthday: "1996-02-28",
    pin: "800800",
    status: "active",
    address: "Phase 3 Block 7, Filinvest Corporate City, Alabang 1781",
    emergency_contact: "Sandra Dela Cruz (Sister) - +63 925 555 0008",
    work_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    pay_frequency: "semi_monthly",
  },
};

async function seedUsers() {
  console.log("ðŸ”„ Seeding demo users in Supabase...\n");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Accounts: ${DEMO_ACCOUNTS.length}\n`);

  // Fetch all existing auth users once (avoid N+1 calls)
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingByEmail = new Map(
    (allUsers?.users ?? []).map((u) => [u.email ?? "", u])
  );

  let created = 0;
  let updated = 0;
  let failed = 0;

  // Map email â†’ resolved auth user ID
  const resolvedIds: Record<string, string> = {};

  for (const account of DEMO_ACCOUNTS) {
    const existing = existingByEmail.get(account.email);

    if (existing) {
      // Reset password to demo1234 so quick-login always works
      const { error: pwErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: account.name, role: account.role },
      });
      if (pwErr) {
        console.warn(`   âš ï¸  ${account.email} â€” could not reset password: ${pwErr.message}`);
      }

      // Fix profile role/department if wrong
      await supabase.from("profiles").upsert({
        id: existing.id,
        name: account.name,
        email: account.email,
        role: account.role,
        department: account.department,
        must_change_password: false,
        profile_complete: true,
      }, { onConflict: "id" });

      console.log(`   ðŸ”„  ${account.email} (${account.role}) â€” updated (password reset)`);
      resolvedIds[account.email] = existing.id;
      updated++;
      continue;
    }

    // Create new auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: account.name, role: account.role },
    });

    if (error || !data.user) {
      console.error(`   âŒ ${account.email} (${account.role}) â€” ${error?.message ?? "unknown error"}`);
      failed++;
      continue;
    }

    // Upsert profile (trigger may have already created it)
    await supabase.from("profiles").upsert({
      id: data.user.id,
      name: account.name,
      email: account.email,
      role: account.role,
      department: account.department,
      must_change_password: false,
      profile_complete: true,
    }, { onConflict: "id" });

    console.log(`   âœ…  ${account.email} (${account.role}) â€” created [${data.user.id}]`);
    resolvedIds[account.email] = data.user.id;
    created++;
  }

  console.log(`\nðŸ“Š Auth results: ${created} created, ${updated} updated, ${failed} failed`);

  // â”€â”€â”€ Upsert employees table records for employee-role accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ”„ Upserting employees table records...\n");

  for (const [email, empData] of Object.entries(DEMO_EMPLOYEE_RECORDS)) {
    const profileId = resolvedIds[email];
    if (!profileId) {
      console.warn(`   âš ï¸  No auth user resolved for ${email} â€” skipping employees row`);
      continue;
    }

    const { error: empErr } = await supabase.from("employees").upsert({
      id: empData.id,
      name: empData.name,
      email: empData.email,
      role: "employee",
      department: empData.department,
      status: empData.status,
      work_type: empData.work_type,
      salary: empData.salary,
      join_date: empData.join_date,
      productivity: empData.productivity,
      location: empData.location,
      phone: empData.phone,
      birthday: empData.birthday,
      ...(empData.pin ? { pin: empData.pin } : {}),
      profile_id: profileId,
      ...(empData.address ? { address: empData.address } : {}),
      ...(empData.emergency_contact ? { emergency_contact: empData.emergency_contact } : {}),
      ...(empData.work_days ? { work_days: empData.work_days } : {}),
      ...(empData.pay_frequency ? { pay_frequency: empData.pay_frequency } : {}),
      ...(empData.whatsapp_number ? { whatsapp_number: empData.whatsapp_number } : {}),
    }, { onConflict: "id" });

    if (empErr) {
      console.error(`   âŒ employees row for ${email} â€” ${empErr.message}`);
    } else {
      // Also patch profile_id on existing row in case it was null
      await supabase.from("employees")
        .update({ profile_id: profileId })
        .eq("email", email)
        .is("profile_id", null);
      console.log(`   âœ…  employees[${empData.id}] ${email} â†’ profile_id ${profileId.substring(0, 8)}...`);
    }
  }

  // â”€â”€â”€ Final verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("\nðŸ” Final verification\n");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, role, department")
    .in("email", DEMO_ACCOUNTS.map((a) => a.email))
    .order("role");

  if (profiles && profiles.length > 0) {
    console.log("   Profile | Role           | Email");
    console.log("   " + "â”€".repeat(60));
    for (const p of profiles) {
      console.log(`   ${p.id.substring(0, 8)}  | ${(p.role ?? "").padEnd(14)} | ${p.email}`);
    }
  }

  const { data: empRows } = await supabase
    .from("employees")
    .select("id, name, email, profile_id")
    .in("email", Object.keys(DEMO_EMPLOYEE_RECORDS));

  if (empRows && empRows.length > 0) {
    console.log("\n   Employee | Name         | Email              | profile_id");
    console.log("   " + "â”€".repeat(70));
    for (const e of empRows) {
      console.log(
        `   ${e.id.padEnd(8)} | ${(e.name ?? "").padEnd(12)} | ${(e.email ?? "").padEnd(18)} | ` +
        `${e.profile_id ? e.profile_id.substring(0, 8) + "..." : "âŒ NULL"}`
      );
    }
  }

  console.log("\nâœ… Done! All demo accounts are ready.");
  console.log("   Password for all accounts: demo1234");
  console.log("\n   Quick login accounts:");
  for (const a of DEMO_ACCOUNTS) {
    console.log(`   ${a.role.padEnd(14)} â†’ ${a.email}`);
  }
}

seedUsers().catch(console.error);
