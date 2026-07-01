import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const migrationPath = path.resolve(__dirname, "../supabase/migrations/072_add_loans_approval_fields.sql");
const SQL = fs.readFileSync(migrationPath, "utf8");

async function main() {
    console.log(`Applying 072_add_loans_approval_fields migration to: ${SUPABASE_URL}\n`);

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

    // Fallback: supabase CLI
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
        console.log("\nManual fallback: run the migration SQL file in the Supabase Editor.");
    }
}

async function verify() {
    const { createClient } = await import("@supabase/supabase-js");
    const s = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await s.from("loans").select("id, reviewed_by, proof_file_path").limit(1);
    if (error) {
        console.error("❌ Verification failed:", error.message);
    } else {
        console.log("✅ Loans table columns verified (reviews/proof_file_path accessible)");
    }
}

main().catch((e) => {
    console.error("Fatal:", e.message);
    process.exit(1);
});

