/**
 * run-sql-direct.ts
 * Connects directly to Supabase postgres and runs a SQL migration.
 * Usage: npx tsx scripts/run-sql-direct.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD!;

if (!SUPABASE_URL || !DB_PASSWORD) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD");
    process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const DB_HOST = `db.${projectRef}.supabase.co`;

const SQL = `
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
  ON public.push_subscriptions(employee_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint
  ON public.push_subscriptions(endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admin can view all push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Employees manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (
    employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid())
  )
  WITH CHECK (
    employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid())
  );

CREATE POLICY "Admin can view all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.profile_id = auth.uid() AND e.role IN ('admin', 'hr')
    )
  );

ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
`;

async function main() {
    console.log(`Connecting to ${DB_HOST}:5432...`);

    const { Client } = await import("pg");
    // Newer Supabase projects use the pooler with user postgres.{ref}
    // Try both approaches
    const configs = [
        // Transaction pooler (IPv4)
        { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        // Session pooler (IPv4)
        { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        // Direct legacy
        { host: DB_HOST, port: 5432, user: "postgres", database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
    ];
    let client: InstanceType<typeof Client> | null = null;
    for (const cfg of configs) {
        try {
            console.log(`  Trying ${cfg.host}:${cfg.port} as ${cfg.user}...`);
            const c = new Client({ ...cfg, connectionTimeoutMillis: 8000 });
            await c.connect();
            client = c;
            console.log(`  ✅ Connected via ${cfg.host}:${cfg.port}\n`);
            break;
        } catch (e: unknown) {
            console.log(`  ✗ ${(e as Error).message?.split("\n")[0]}`);
        }
    }
    if (!client) throw new Error("All connection attempts failed");

    try {
        await client.query(SQL);
        console.log("✅ push_subscriptions table created with RLS policies.\n");

        // Verify
        const { rows } = await client.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='push_subscriptions'"
        );
        if (rows.length > 0) {
            console.log("✅ Verified: table exists in pg_tables");
        } else {
            console.error("❌ Table not found after creation — unexpected");
        }

        const { rows: policies } = await client.query(
            "SELECT policyname FROM pg_policies WHERE tablename='push_subscriptions'"
        );
        console.log(`✅ RLS policies: ${policies.map((r: { policyname: string }) => r.policyname).join(", ")}`);
    } finally {
        await client.end();
    }
}

main().catch((e) => {
    console.error("Fatal:", e.message);
    process.exit(1);
});
