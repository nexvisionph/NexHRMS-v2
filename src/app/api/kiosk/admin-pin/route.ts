import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

const ADMIN_KIOSK_DEVICE_ID = "ADMIN_KIOSK_CONFIG";
const DEFAULT_PIN = "000000";

/** Tight rate limiter for PIN verification: 10 attempts per 5 minutes per IP. */
const pinRateLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });

function hashPin(pin: string): string {
    return crypto.createHash("sha256").update(`kiosk-admin:${pin}`).digest("hex");
}

/**
 * GET /api/kiosk/admin-pin?pin=<pin>
 * Verify a PIN against the stored hash — returns { valid: boolean }
 * Public endpoint (no auth required) so the kiosk page can verify the PIN.
 */
export async function GET(req: Request) {
    const rl = pinRateLimiter.check(getClientIp(req));
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many PIN attempts. Please wait before retrying." },
            { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
        );
    }

    const { searchParams } = new URL(req.url);
    const pin = searchParams.get("pin");

    if (!pin || !/^\d{4,8}$/.test(pin)) {
        return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
    }

    try {
        const supabase = await createServerSupabaseClient();
        const { data } = await supabase
            .from("kiosk_pins")
            .select("pin_hash")
            .eq("kiosk_device_id", ADMIN_KIOSK_DEVICE_ID)
            .eq("is_active", true)
            .maybeSingle();

        if (!data) {
            // No PIN stored yet — fall back to default
            const valid = pin === DEFAULT_PIN;
            return NextResponse.json({ valid });
        }

        const valid = hashPin(pin) === data.pin_hash;
        return NextResponse.json({ valid });
    } catch {
        // On DB error, fall back to default PIN check (prevents lockout)
        const valid = pin === DEFAULT_PIN;
        return NextResponse.json({ valid });
    }
}

/**
 * POST /api/kiosk/admin-pin
 * Body: { pin: string }
 * Save a new admin PIN (hashed) to kiosk_pins table.
 * Requires admin authentication.
 */
export async function POST(req: Request) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is an admin
    const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("profile_id", user.id)
        .single();

    if (emp?.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json() as { pin?: unknown };
    const pin = body.pin;

    if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
        return NextResponse.json({ error: "PIN must be 4–8 digits" }, { status: 400 });
    }

    const pinHash = hashPin(pin);

    // Ensure the sentinel device exists in kiosk_devices before writing the FK.
    await supabase.from("kiosk_devices").upsert(
        { id: ADMIN_KIOSK_DEVICE_ID, name: "Admin PIN Configuration" },
        { onConflict: "id", ignoreDuplicates: true },
    );

    // Check if an admin PIN record already exists (upsert)
    const { data: existing } = await supabase
        .from("kiosk_pins")
        .select("id")
        .eq("kiosk_device_id", ADMIN_KIOSK_DEVICE_ID)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from("kiosk_pins")
            .update({
                pin_hash: pinHash,
                last_used_at: new Date().toISOString(),
                is_active: true,
            })
            .eq("kiosk_device_id", ADMIN_KIOSK_DEVICE_ID);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
        const { error } = await supabase
            .from("kiosk_pins")
            .insert({
                kiosk_device_id: ADMIN_KIOSK_DEVICE_ID,
                pin_hash: pinHash,
                created_by: user.id,
                is_active: true,
            });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
