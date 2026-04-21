/**
 * apply-push-subscriptions.ts
 *
 * Creates the push_subscriptions table in the live Supabase database,
 * along with RLS policies, indexes, and realtime publication.
 *
 * Usage:
 *   npx tsx scripts/apply-push-subscriptions.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as https from "https";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

const SQL = `
-- push_subscriptions: Web Push API subscription storage
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT fk_push_employee FOREIGN KEY (employee_id)
    REFERENCES public.employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subs_employee
  ON public.push_subscriptions(employee_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint
  ON public.push_subscriptions(endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "Employees manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admin can view all push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Employees manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.profile_id = auth.uid()
        AND e.role IN ('admin', 'hr')
    )
  );

ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
`;

function runSQL(sql: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const url = new URL(`/rest/v1/rpc/`, SUPABASE_URL);
        const payload = JSON.stringify({ query: sql });
        // Use the Management API (pg meta) via the db endpoint
        const apiUrl = new URL(`https://api.supabase.com/v1/projects/${projectRef}/database/query`);

        const options: https.RequestOptions = {
            hostname: apiUrl.hostname,
            path: apiUrl.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                "Content-Length": Buffer.byteLength(payload),
            },
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

async function applyViaDbPassword(): Promise<boolean> {
    const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
    if (!DB_PASSWORD) return false;

    // Use the Supabase pg meta REST endpoint with service_role JWT
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // Supabase JS can't run raw DDL — use the pg meta API
    // Instead, we'll use the admin client to call a custom RPC if available,
    // or fall back to the Management API approach
    return false;
}

async function main() {
    console.log(`Applying push_subscriptions migration to: ${SUPABASE_URL}\n`);

    // Approach: Use Supabase's pg-meta HTTP API (available via service_role)
    // POST to /rest/v1/ doesn't support DDL — we need the pg-meta endpoint
    // which is at https://<ref>.supabase.co/pg-meta/v1/query

    const pgMetaUrl = `${SUPABASE_URL}/pg-meta/v1/query`;

    const response = await fetch(pgMetaUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: SQL }),
    });

    if (response.ok) {
        console.log("✅ Migration applied successfully via pg-meta");
        await verify();
        return;
    }

    const errText = await response.text();
    console.log(`pg-meta returned ${response.status}: ${errText.slice(0, 200)}`);
    console.log("Trying alternative: supabase CLI 'db query'...\n");

    // Fall back: try supabase CLI
    const { execSync } = await import("child_process");
    try {
        execSync(
            `npx supabase db execute --project-ref ${projectRef} --sql "${SQL.replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
            { stdio: "inherit", cwd: path.resolve(__dirname, "..") }
        );
        console.log("✅ Applied via supabase CLI");
        await verify();
    } catch {
        console.log("supabase CLI also failed.");
        console.log("\nManual fallback: run this SQL in Supabase Dashboard → SQL Editor:\n");
        console.log("─".repeat(60));
        console.log(SQL);
        console.log("─".repeat(60));
    }
}

async function verify() {
    const { createClient } = await import("@supabase/supabase-js");
    const s = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await s.from("push_subscriptions").select("id").limit(1);
    if (error) {
        console.error("❌ Verification failed:", error.message);
    } else {
        console.log("✅ push_subscriptions table is accessible (rows:", data?.length ?? 0, ")");
    }
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
