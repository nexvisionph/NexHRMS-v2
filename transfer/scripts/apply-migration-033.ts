/**
 * apply-migration-033.ts
 *
 * Applies migration 033_fix_location_pings_rls.sql to the live Supabase project.
 * Fixes the RLS INSERT policy on location_pings (and site_survey_photos /
 * break_records) so that both the owning employee AND admin/HR can write rows.
 *
 * Usage:
 *   npx tsx scripts/apply-migration-033.ts
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

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

const SQL = `
-- ─── location_pings ──────────────────────────────────────────
DROP POLICY IF EXISTS lp_insert ON public.location_pings;
CREATE POLICY lp_insert ON public.location_pings
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

-- ─── site_survey_photos ──────────────────────────────────────
DROP POLICY IF EXISTS ssp_insert ON public.site_survey_photos;
CREATE POLICY ssp_insert ON public.site_survey_photos
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

-- ─── break_records ───────────────────────────────────────────
DROP POLICY IF EXISTS br_insert_own ON public.break_records;
CREATE POLICY br_insert_own ON public.break_records
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS br_update_own ON public.break_records;
CREATE POLICY br_update_own ON public.break_records
    FOR UPDATE
    USING  (public.is_own_employee(employee_id) OR public.is_admin_or_hr())
    WITH CHECK (public.is_own_employee(employee_id) OR public.is_admin_or_hr());
`;

async function run() {
  console.log("🔄 Applying migration 033_fix_location_pings_rls...\n");

  const { error } = await supabase.rpc("exec_sql" as never, { sql: SQL });

  if (error) {
    // exec_sql RPC may not exist — fall back to raw REST SQL endpoint
    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY!,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql: SQL }),
    });

    if (!res.ok) {
      // Last resort: print instructions for manual run
      console.error("⚠️  Could not execute via RPC. Please run the SQL manually:");
      console.error("   Supabase Dashboard → SQL Editor → New query → paste contents of:");
      console.error("   supabase/migrations/033_fix_location_pings_rls.sql");
      console.error("\n   Or use Supabase CLI:");
      console.error("   supabase db push");
      return;
    }
  }

  console.log("✅ Migration applied successfully.");
  console.log("   location_pings INSERT is now open to both employee (own) and admin/HR.");
}

run().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
