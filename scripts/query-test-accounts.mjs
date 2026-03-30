/**
 * Quick diagnostic script: queries Supabase for employees, projects,
 * face enrollments, and auth profiles to find a test-ready account.
 * Run: node scripts/query-test-accounts.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read .env.local
const envPath = resolve(import.meta.dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("=== 1. All Employees ===");
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, name, email, role, status, profile_id, department, work_type")
    .order("name");
  if (empErr) { console.error("employees error:", empErr.message); return; }
  console.table(employees);

  console.log("\n=== 2. Projects (with verification method) ===");
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id, name, status, verification_method, require_geofence, geofence_radius_meters, assigned_employee_ids, location_lat, location_lng, location_radius");
  if (projErr) { console.error("projects error:", projErr.message); return; }
  console.table(projects);

  console.log("\n=== 3. Face Enrollments ===");
  const { data: enrollments, error: feErr } = await supabase
    .from("face_enrollments")
    .select("id, employee_id, is_active, enrollment_date, last_verified, verification_count");
  if (feErr) { console.error("face_enrollments error:", feErr.message); return; }
  console.table(enrollments?.length ? enrollments : [{ note: "No enrollments found" }]);

  console.log("\n=== 4. Auth Profiles ===");
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, name, email, role, must_change_password, profile_complete")
    .order("name");
  if (profErr) { console.error("profiles error:", profErr.message); return; }
  console.table(profiles);

  console.log("\n=== 5. Today's Attendance Logs ===");
  const today = new Date().toISOString().split("T")[0];
  const { data: logs, error: logErr } = await supabase
    .from("attendance_logs")
    .select("id, employee_id, date, check_in, check_out, status, face_verified, project_id")
    .eq("date", today);
  if (logErr) { console.error("attendance_logs error:", logErr.message); return; }
  console.table(logs?.length ? logs : [{ note: "No logs for today" }]);

  console.log("\n=== 6. Attendance Events (last 10) ===");
  const { data: events, error: evtErr } = await supabase
    .from("attendance_events")
    .select("id, employee_id, event_type, timestamp_utc, project_id")
    .order("timestamp_utc", { ascending: false })
    .limit(10);
  if (evtErr) { console.error("attendance_events error:", evtErr.message); return; }
  console.table(events?.length ? events : [{ note: "No events" }]);

  // ── Summary: find best test candidate ──
  console.log("\n=== ANALYSIS: Test Account Candidates ===");
  const activeEmployees = employees.filter(e => e.status === "active");
  const enrolledIds = new Set((enrollments || []).filter(e => e.is_active).map(e => e.employee_id));
  const qrProjects = (projects || []).filter(p => p.verification_method === "qr_only" || p.verification_method === "face_or_qr");

  for (const emp of activeEmployees) {
    const assignedProjects = (projects || []).filter(p => p.assigned_employee_ids?.includes(emp.id));
    const enrolled = enrolledIds.has(emp.id);
    const hasProfile = profiles.some(p => p.email === emp.email);
    console.log(`  ${emp.id} | ${emp.name} | role=${emp.role} | profile=${hasProfile} | face_enrolled=${enrolled} | projects=[${assignedProjects.map(p => p.name + '(' + p.verification_method + ')').join(', ')}]`);
  }
}

main().catch(console.error);
