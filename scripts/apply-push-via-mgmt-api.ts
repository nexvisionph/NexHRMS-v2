/**
 * apply-push-via-mgmt-api.ts
 * Uses the Supabase Management API to run the push_subscriptions migration.
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as https from "https";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const PAT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = "lbdptussuttrbefqrrcp";

const SQL = `
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT fk_push_employee FOREIGN KEY (employee_id)
    REFERENCES public.employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON public.push_subscriptions(employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admin can view all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Employees manage own push subscriptions" ON public.push_subscriptions
  FOR ALL
  USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()));
CREATE POLICY "Admin can view all push subscriptions" ON public.push_subscriptions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = auth.uid() AND e.role IN ('admin','hr')));
ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
`;

function request(options: https.RequestOptions, body: string): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => resolve({ status: res.statusCode ?? 0, text: data }));
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function tryMgmtAPI() {
    const body = JSON.stringify({ query: SQL });
    const res = await request({
        hostname: "api.supabase.com",
        path: `/v1/projects/${REF}/database/query`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PAT}`,
            "Content-Length": Buffer.byteLength(body),
        },
    }, body);
    console.log(`Management API: ${res.status}`);
    console.log(res.text.slice(0, 500));
    return res.status >= 200 && res.status < 300;
}

async function tryServiceRole() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Supabase REST doesn't allow DDL, but pg-meta via service role works on some endpoints
    const body = JSON.stringify({ query: SQL });
    const url = new URL(`${SUPABASE_URL}/pg-meta/v1/query`);
    const res = await request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
            "Content-Length": Buffer.byteLength(body),
        },
    }, body);
    console.log(`pg-meta/v1/query: ${res.status}`);
    console.log(res.text.slice(0, 500));
    return res.status >= 200 && res.status < 300;
}

async function verify() {
    const { createClient } = await import("@supabase/supabase-js");
    const s = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error } = await s.from("push_subscriptions").select("id").limit(1);
    if (error) {
        console.error("\n❌ Table STILL missing:", error.message);
        console.log("\n--- Run this SQL manually in Supabase Dashboard → SQL Editor ---");
        console.log(SQL);
        console.log("--- End SQL ---");
    } else {
        console.log("\n✅ push_subscriptions table is accessible!");
    }
}

async function main() {
    console.log("Attempting Management API...\n");
    const ok1 = await tryMgmtAPI();
    if (!ok1) {
        console.log("\nTrying pg-meta endpoint...\n");
        await tryServiceRole();
    }
    await verify();
}

main().catch(console.error);
