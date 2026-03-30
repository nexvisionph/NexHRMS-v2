/**
 * seed-supabase-users.ts
 * 
 * Creates the 7 demo user accounts in Supabase Auth + verifies profile auto-creation.
 * 
 * Usage:
 *   1. Get your service_role key from Supabase Dashboard → Settings → API
 *   2. Set it in .env.local:  SUPABASE_SERVICE_ROLE_KEY=your-key-here
 *   3. Run:  npx tsx scripts/seed-supabase-users.ts
 * 
 * The handle_new_user() trigger (001_auth_profiles.sql) auto-creates the
 * profiles row when a new auth user is inserted — so we only need to create
 * the auth user with the right metadata.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("   Get it from: Supabase Dashboard → Settings → API → service_role");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Demo accounts to create ─────────────────────────────
const DEMO_ACCOUNTS = [
  { name: "Alex Rivera",  email: "admin@nexhrms.com",      role: "admin",         department: "Management" },
  { name: "Jordan Lee",   email: "hr@nexhrms.com",         role: "hr",            department: "Human Resources" },
  { name: "Morgan Chen",  email: "finance@nexhrms.com",    role: "finance",       department: "Finance" },
  { name: "Sam Torres",   email: "employee@nexhrms.com",   role: "employee",      department: "Engineering" },
  { name: "Pat Reyes",    email: "supervisor@nexhrms.com", role: "supervisor",    department: "Engineering" },
  { name: "Dana Cruz",    email: "payroll@nexhrms.com",    role: "payroll_admin", department: "Finance" },
  { name: "Rene Santos",  email: "auditor@nexhrms.com",    role: "auditor",       department: "Compliance" },
  { name: "Jamie Reyes",  email: "qr@nexhrms.com",        role: "employee",      department: "Engineering" },
];

const DEMO_PASSWORD = "demo1234";

async function seedUsers() {
  console.log("🔄 Seeding demo users in Supabase...\n");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Accounts: ${DEMO_ACCOUNTS.length}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of DEMO_ACCOUNTS) {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email === account.email
    );

    if (existing) {
      console.log(`   ⏭️  ${account.email} (${account.role}) — already exists`);
      
      // Verify profile has correct role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, department")
        .eq("id", existing.id)
        .single();
      
      if (profile && profile.role !== account.role) {
        await supabase
          .from("profiles")
          .update({ role: account.role, department: account.department })
          .eq("id", existing.id);
        console.log(`       → Fixed profile role: ${profile.role} → ${account.role}`);
      }
      
      skipped++;
      continue;
    }

    // Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: account.name,
        role: account.role,
      },
    });

    if (error) {
      console.error(`   ❌ ${account.email} (${account.role}) — ${error.message}`);
      failed++;
      continue;
    }

    // The handle_new_user trigger auto-creates profiles row.
    // Update with department.
    if (data.user) {
      await supabase
        .from("profiles")
        .update({
          department: account.department,
          must_change_password: false,
          profile_complete: true,
        })
        .eq("id", data.user.id);
    }

    console.log(`   ✅ ${account.email} (${account.role}) — created [${data.user.id}]`);
    created++;
  }

  console.log(`\n📊 Results: ${created} created, ${skipped} skipped, ${failed} failed`);

  // Verify profiles
  console.log("\n🔍 Verifying profiles table...\n");
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, email, role, department, must_change_password, profile_complete")
    .order("role");

  if (profileError) {
    console.error(`   ❌ Could not read profiles: ${profileError.message}`);
  } else if (profiles && profiles.length > 0) {
    console.log("   ID (first 8)  | Role           | Email                    | Name");
    console.log("   " + "─".repeat(80));
    for (const p of profiles) {
      console.log(
        `   ${p.id.substring(0, 8)}    | ${(p.role ?? "").padEnd(14)} | ${(p.email ?? "").padEnd(24)} | ${p.name}`
      );
    }
  } else {
    console.log("   ⚠️  No profiles found — trigger may not have fired");
  }

  console.log("\n✅ Done! Demo accounts are ready.");
  console.log("   Password for all accounts: demo1234");
  console.log("\n   To test: set NEXT_PUBLIC_DEMO_MODE=false in .env.local, run npm run dev, and login.");
}

seedUsers().catch(console.error);
