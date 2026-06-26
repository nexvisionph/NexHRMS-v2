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
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (status IN (
    'pending', 
    'approved', 
    'rejected', 
    'active', 
    'settled', 
    'frozen', 
    'cancelled', 
    'separated', 
    'draft', 
    'pending_supervisor', 
    'pending_hr', 
    'pending_finance',
    'inactive'
));
`;

async function main() {
    console.log(`Connecting to ${DB_HOST}:5432...`);

    const { Client } = await import("pg");
    const configs = [
        { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
        { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}`, database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false } },
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
        console.log("✅ loans_status_check constraint updated successfully.\n");
    } finally {
        await client.end();
    }
}

main().catch((e) => {
    console.error("Fatal:", e.message);
    process.exit(1);
});
