/**
 * BIR API auth/audit helpers — shared by all /api/payroll/bir/* routes.
 */

import { NextResponse } from "next/server";
import {
    createAdminSupabaseClient,
    createServerSupabaseClient,
} from "@/services/supabase-server";

export type BIRAllowedRole = "admin" | "finance" | "payroll_admin";

const DEFAULT_ROLES: readonly BIRAllowedRole[] = [
    "admin",
    "finance",
    "payroll_admin",
];

/**
 * Verify the caller has a BIR-management role.
 * Returns either an authorized employee record or a NextResponse error.
 */
export async function requireBIRRole(
    allowed: readonly string[] = DEFAULT_ROLES,
): Promise<
    | {
          ok: true;
          employee: { id: string; role: string; email: string };
          adminClient: Awaited<ReturnType<typeof createAdminSupabaseClient>>;
      }
    | { ok: false; response: NextResponse }
> {
    try {
        const serverClient = await createServerSupabaseClient();
        const {
            data: { user },
            error: authError,
        } = await serverClient.auth.getUser();
        if (authError || !user) {
            return {
                ok: false,
                response: NextResponse.json(
                    { ok: false, message: "Unauthorized" },
                    { status: 401 },
                ),
            };
        }

        const adminClient = await createAdminSupabaseClient();
        const { data: emp } = await adminClient
            .from("employees")
            .select("id, role, email")
            .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
            .single();

        if (!emp || !allowed.includes(emp.role)) {
            return {
                ok: false,
                response: NextResponse.json(
                    { ok: false, message: "Forbidden" },
                    { status: 403 },
                ),
            };
        }

        return {
            ok: true,
            employee: emp as { id: string; role: string; email: string },
            adminClient,
        };
    } catch (err) {
        console.error("requireBIRRole error:", err);
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, message: "Internal server error" },
                { status: 500 },
            ),
        };
    }
}

/** Append a BIR audit-log entry. Never throws — best-effort. */
export async function logBIRAudit(
    adminClient: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
    actorId: string,
    action: string,
    details: Record<string, unknown>,
): Promise<void> {
    try {
        // Strip TIN for safety — never log raw TINs to audit_logs.
        const safe = { ...details } as Record<string, unknown>;
        if ("tin" in safe) delete safe.tin;
        if ("prevEmployerTin" in safe) delete safe.prevEmployerTin;
        await adminClient.from("audit_logs").insert({
            actor_id: actorId,
            action,
            entity_type: "bir",
            details: safe,
            created_at: new Date().toISOString(),
        });
    } catch (err) {
        console.warn("logBIRAudit failed (non-fatal):", err);
    }
}
