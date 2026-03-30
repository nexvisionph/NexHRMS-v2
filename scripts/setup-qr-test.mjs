/**
 * Setup a QR-enabled project and assign test account (EMP004 - Sam Torres)
 * Run: node scripts/setup-qr-test.mjs
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

async function main() {
  const QR_PROJECT_ID = "PRJ002";
  const TEST_EMP = "EMP004"; // Sam Torres - employee@nexhrms.com

  // ── 1. Check if QR project already exists ──
  const { data: existing } = await supabase
    .from("projects")
    .select("id, name, verification_method")
    .eq("id", QR_PROJECT_ID)
    .single();

  if (existing) {
    console.log(`Project ${QR_PROJECT_ID} already exists:`, existing);
  } else {
    // ── 2. Insert QR project ──
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        id: QR_PROJECT_ID,
        name: "Office HQ – QR Check-in",
        description: "Main office with QR code attendance. For testing QR-based check-in/out.",
        status: "active",
        verification_method: "qr_only",
        require_geofence: false,
        geofence_radius_meters: 200,
        assigned_employee_ids: [TEST_EMP, "EMP001", "EMP002", "EMP005"],
        location_lat: 14.5547,
        location_lng: 121.0244,
        location_radius: 200,
      })
      .select()
      .single();

    if (projErr) {
      console.error("Failed to create project:", projErr.message);
      return;
    }
    console.log("✓ Created QR project:", project.id, project.name);
  }

  // ── 3. Also update Metro Tower to face_or_qr so both methods work there ──
  const { error: updateErr } = await supabase
    .from("projects")
    .update({ verification_method: "face_or_qr" })
    .eq("id", "PRJ001");

  if (updateErr) {
    console.error("Failed to update PRJ001:", updateErr.message);
  } else {
    console.log("✓ Updated PRJ001 (Metro Tower) → face_or_qr (supports both face and QR)");
  }

  // ── 4. Verify test account profile ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, must_change_password, profile_complete")
    .eq("email", "employee@nexhrms.com")
    .single();

  if (profile) {
    console.log("✓ Profile found:", profile.email, "| role:", profile.role, "| password_change:", profile.must_change_password);
  } else {
    console.error("✗ No profile for employee@nexhrms.com");
  }

  // ── 5. Verify face enrollment ──
  const { data: enrollment } = await supabase
    .from("face_enrollments")
    .select("id, employee_id, is_active, verification_count")
    .eq("employee_id", TEST_EMP)
    .eq("is_active", true)
    .single();

  if (enrollment) {
    console.log("✓ Face enrolled:", enrollment.id, "| verifications:", enrollment.verification_count);
  } else {
    console.log("⚠ No face enrollment for", TEST_EMP, "(enroll via app before testing face check-in)");
  }

  // ── 6. Final summary ──
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  TEST ACCOUNT READY FOR QR + FACE TESTING");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Employee:   Sam Torres (EMP004)");
  console.log("  Login:      employee@nexhrms.com");
  console.log("  Password:   password123   (default seed password)");
  console.log("  Role:       employee");
  console.log("  Department: Engineering");
  console.log("");
  console.log("  PROJECT 1:  PRJ001 – Metro Tower Construction");
  console.log("    Method:   face_or_qr  (both face & QR accepted)");
  console.log("    Geofence: ON (100m radius)");
  console.log("    Face:     " + (enrollment ? "Enrolled ✓" : "NOT enrolled – enroll first"));
  console.log("");
  console.log("  PROJECT 2:  PRJ002 – Office HQ – QR Check-in");
  console.log("    Method:   qr_only  (QR code only)");
  console.log("    Geofence: OFF");
  console.log("");
  console.log("  HOW TO TEST:");
  console.log("  1. Login as employee@nexhrms.com / password123");
  console.log("  2. Navigate to QR check-in page");
  console.log("  3. The daily QR code rotates automatically");
  console.log("  4. Scan from /kiosk or employee dashboard");
  console.log("═══════════════════════════════════════════════════════════════");

  // ── 7. Show all projects now ──
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name, verification_method, require_geofence, assigned_employee_ids, status");
  console.log("\nAll Projects:");
  console.table(allProjects);
}

main().catch(console.error);
