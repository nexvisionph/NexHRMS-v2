// Apply migration: add reference_image column to face_enrollments
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
function env(key) {
  const m = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Check if column exists
  const { error: checkErr } = await sb.from("face_enrollments").select("reference_image").limit(1);
  if (!checkErr) {
    console.log("✓ Column reference_image already exists");
    return;
  }

  console.log("Column missing, applying migration...");
  
  // Create a temporary RPC function to run DDL
  const createSql = `
    CREATE OR REPLACE FUNCTION public._apply_migration_026()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $fn$
    BEGIN
      ALTER TABLE public.face_enrollments ADD COLUMN IF NOT EXISTS reference_image TEXT;
    END;
    $fn$;
  `;
  
  // We can't run raw SQL via REST, so create a helper via pg_net or dashboard
  // Instead, let's check if we can use the special _apply function
  const res = await fetch(`${url}/rest/v1/rpc/_apply_migration_026`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (res.status === 404) {
    console.log("\nCannot apply DDL via REST API directly.");
    console.log("Please run this SQL in the Supabase Dashboard → SQL Editor:\n");
    console.log("  ALTER TABLE public.face_enrollments ADD COLUMN IF NOT EXISTS reference_image TEXT;\n");
    console.log("The face verification system will gracefully handle the missing column until applied.");
  } else if (res.ok) {
    console.log("✓ Migration applied successfully");
    // Clean up the temp function
    await fetch(`${url}/rest/v1/rpc/_apply_migration_026`, {
      method: "POST",
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
    });
  } else {
    const text = await res.text();
    console.log("Migration response:", res.status, text);
  }
}

main().catch(console.error);
