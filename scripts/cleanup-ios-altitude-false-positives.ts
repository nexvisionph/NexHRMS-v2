/**
 * cleanup-ios-altitude-false-positives.ts
 *
 * Removes legacy false-positive anti-cheat records caused by old iOS altitude checks.
 * Safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/cleanup-ios-altitude-false-positives.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const IOS_ALTITUDE_REGEX = /ios altitude.*missing/i;

async function cleanup() {
  console.log("Cleaning legacy iOS altitude false positives...");

  const { data: logs, error: logsError } = await supabase
    .from("notification_logs")
    .select("id,type,subject,body")
    .eq("type", "cheat_detected")
    .limit(5000);

  if (logsError) {
    console.error("Failed to fetch notification logs:", logsError.message);
    process.exit(1);
  }

  const badLogIds = (logs || [])
    .filter((l) => IOS_ALTITUDE_REGEX.test(l.body || ""))
    .map((l) => l.id);

  if (badLogIds.length > 0) {
    const { error: delErr } = await supabase
      .from("notification_logs")
      .delete()
      .in("id", badLogIds);

    if (delErr) {
      console.error("Failed to delete false-positive notifications:", delErr.message);
      process.exit(1);
    }
  }

  const { data: penalties, error: penaltiesError } = await supabase
    .from("penalty_records")
    .select("id,reason,resolved")
    .limit(5000);

  if (penaltiesError) {
    console.error("Failed to fetch penalty records:", penaltiesError.message);
    process.exit(1);
  }

  const badPenaltyIds = (penalties || [])
    .filter((p) => IOS_ALTITUDE_REGEX.test(p.reason || ""))
    .map((p) => p.id);

  if (badPenaltyIds.length > 0) {
    const { error: updErr } = await supabase
      .from("penalty_records")
      .update({ resolved: true })
      .in("id", badPenaltyIds);

    if (updErr) {
      console.error("Failed to resolve false-positive penalties:", updErr.message);
      process.exit(1);
    }
  }

  console.log(`Removed ${badLogIds.length} notification(s).`);
  console.log(`Resolved ${badPenaltyIds.length} penalty record(s).`);
  console.log("Done.");
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
