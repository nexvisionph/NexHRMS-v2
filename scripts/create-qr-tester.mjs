/**
 * Create a dedicated QR test account (separate from Sam Torres who is for face recognition).
 * Run: node scripts/create-qr-tester.mjs
 *
 * This creates:
 *   1. Supabase Auth user  → triggers profile auto-creation
 *   2. Employee row (EMP008) in the employees table
 *   3. Assigns to PRJ002 (QR-only project)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");

function env(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "qrtester@nexhrms.com";
const TEST_PASSWORD = "demo1234";
const EMP_ID = "EMP008";

async function main() {
  // ── 1. Check if auth user already exists ──
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let authUser = existingUsers?.users?.find((u) => u.email === TEST_EMAIL);

  if (authUser) {
    console.log(`Auth user already exists: ${authUser.id}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: "Casey Ramos",
        role: "employee",
      },
    });
    if (error) {
      console.error("Failed to create auth user:", error.message);
      return;
    }
    authUser = data.user;
    console.log("✓ Created auth user:", authUser.id);
  }

  // ── 2. Ensure profile row exists and is correct ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, name")
    .eq("id", authUser.id)
    .single();

  if (profile) {
    console.log("✓ Profile exists:", profile.email, "role:", profile.role);
    // Ensure role is correct
    if (profile.role !== "employee") {
      await supabase.from("profiles").update({ role: "employee" }).eq("id", authUser.id);
      console.log("  → Fixed role to employee");
    }
  } else {
    // Manually insert if trigger didn't fire
    const { error: profErr } = await supabase.from("profiles").insert({
      id: authUser.id,
      email: TEST_EMAIL,
      name: "Casey Ramos",
      role: "employee",
      must_change_password: false,
      profile_complete: true,
    });
    if (profErr) console.error("Profile insert error:", profErr.message);
    else console.log("✓ Created profile manually");
  }

  // ── 3. Check/create employee row ──
  const { data: existingEmp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", EMP_ID)
    .single();

  if (existingEmp) {
    console.log("✓ Employee", EMP_ID, "already exists");
    // Update profile_id link if needed
    await supabase
      .from("employees")
      .update({ profile_id: authUser.id })
      .eq("id", EMP_ID);
  } else {
    const { error: empErr } = await supabase.from("employees").insert({
      id: EMP_ID,
      name: "Casey Ramos",
      email: TEST_EMAIL,
      role: "employee",
      department: "Operations",
      status: "active",
      work_type: "WFO",
      profile_id: authUser.id,
      join_date: "2025-06-15",
      salary: 22000,
    });
    if (empErr) {
      console.error("Employee insert error:", empErr.message);
      return;
    }
    console.log("✓ Created employee", EMP_ID);
  }

  // ── 4. Assign to PRJ002 (QR only project) ──
  const { data: prj } = await supabase
    .from("projects")
    .select("id, assigned_employee_ids")
    .eq("id", "PRJ002")
    .single();

  if (prj) {
    const ids = prj.assigned_employee_ids || [];
    if (!ids.includes(EMP_ID)) {
      ids.push(EMP_ID);
      await supabase
        .from("projects")
        .update({ assigned_employee_ids: ids })
        .eq("id", "PRJ002");
      console.log("✓ Assigned", EMP_ID, "to PRJ002");
    } else {
      console.log("✓ Already assigned to PRJ002");
    }
  } else {
    console.error("✗ PRJ002 not found — run setup-qr-test.mjs first");
  }

  // ── 5. Summary ──
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  QR TEST ACCOUNT READY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Employee:   Casey Ramos (EMP008)");
  console.log("  Login:      qrtester@nexhrms.com");
  console.log("  Password:   demo1234");
  console.log("  Role:       employee");
  console.log("  Department: Operations");
  console.log("");
  console.log("  Assigned:   PRJ002 – Office HQ – QR Check-in (qr_only)");
  console.log("");
  console.log("  HOW TO TEST:");
  console.log("  1. Login as qrtester@nexhrms.com / demo1234");
  console.log("  2. Go to employee dashboard → QR code section");
  console.log("  3. A daily QR code is auto-generated");
  console.log("  4. Scan from /kiosk page to check in/out");
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(console.error);
