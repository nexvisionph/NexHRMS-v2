/**
 * seed-face-account.ts
 * Inserts the Alex Reyes (face@nexhrms.com) face recognition demo account
 * directly into Supabase using the service-role key.
 *
 * Run:  npx ts-node --project tsconfig.json scripts/seed-face-account.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
    console.log("\nðŸš€  Seeding face recognition demo accountâ€¦\n");

    // â”€â”€ 1. Create Supabase Auth user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: "face@nexhrms.com",
        password: "demo1234",
        email_confirm: true,
        user_metadata: { name: "Alex Reyes", role: "employee" },
    });

    if (authError && !authError.message.includes("already been registered")) {
        console.error("âŒ  Failed to create auth user:", authError.message);
        process.exit(1);
    }

    const authUserId = authData?.user?.id;
    console.log("âœ…  Auth user:", authUserId ?? "(already existed â€” skipped)");

    // â”€â”€ 2. Upsert profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (authUserId) {
        const { error: profileError } = await supabase.from("profiles").upsert(
            {
                id: authUserId,
                name: "Alex Reyes",
                email: "face@nexhrms.com",
                role: "employee",
                profile_complete: true,
            },
            { onConflict: "id" }
        );
        if (profileError) {
            console.warn("âš ï¸  Profile upsert:", profileError.message);
        } else {
            console.log("âœ…  Profile upserted:", authUserId);
        }
    }

    // â”€â”€ 3. Upsert employee record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const employee = {
        id: "EMP029",
        name: "Alex Reyes",
        email: "face@nexhrms.com",
        role: "employee",
        department: "Operations",
        status: "active",
        work_type: "ONSITE",
        salary: 52000,
        join_date: "2025-01-15",
        productivity: 90,
        location: "Makati, Metro Manila",
        phone: "+63-917-5550029",
        birthday: "1993-07-14",
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        pay_frequency: "semi_monthly",
        whatsapp_number: "+63-917-5550029",
        preferred_channel: "in_app",
        address: "29 Dela Rosa Street, Legazpi Village, Makati City, Metro Manila",
        emergency_contact: "Rosa Reyes (Mother) - +63-918-5550029",
        pin: "290290",
        nfc_id: "NFC-029",
        ...(authUserId ? { profile_id: authUserId } : {}),
    };

    const { error: empError } = await supabase
        .from("employees")
        .upsert(employee, { onConflict: "id" });

    if (empError) {
        console.error("âŒ  Employee upsert failed:", empError.message);
        process.exit(1);
    }
    console.log("âœ…  Employee EMP029 upserted");

    // â”€â”€ 4. Upsert project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { error: projError } = await supabase.from("projects").upsert(
        {
            id: "PRJ006",
            name: "Makati Security Post â€“ Face Check-in",
            description:
                "Makati CBD security post using face recognition for attendance. Demo account for testing biometric check-in.",
            location_lat: 14.5567,
            location_lng: 121.0178,
            location_radius: 300,
            assigned_employee_ids: ["EMP029"],
            verification_method: "face_only",
            require_geofence: true,
            geofence_radius_meters: 300,
            status: "active",
        },
        { onConflict: "id" }
    );

    if (projError) {
        console.error("âŒ  Project upsert failed:", projError.message);
        // Non-fatal â€” continue
    } else {
        console.log("âœ…  Project PRJ006 upserted");
    }

    // â”€â”€ 5. Upsert project_assignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { error: assignError } = await supabase.from("project_assignments").upsert(
        { project_id: "PRJ006", employee_id: "EMP029" },
        { onConflict: "project_id,employee_id" }
    );

    if (assignError) {
        console.warn("âš ï¸  Assignment upsert:", assignError.message);
    } else {
        console.log("âœ…  Project assignment EMP029 â†” PRJ006 upserted");
    }

    console.log("\nðŸŽ‰  Done! Alex Reyes (face@nexhrms.com) is ready.\n");
    console.log("   Login:    face@nexhrms.com");
    console.log("   Password: demo1234");
    console.log("   Employee: EMP029 | Project: PRJ006 (face_only)\n");
}

run().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
