import type { Role } from "@/types";

export const ADMIN_TIER_ROLES = ["admin", "support_admin", "finance_admin", "analyst"] as const satisfies readonly Role[];

export function isAdministrativeRole(role?: string | null): role is Role {
    return !!role && ADMIN_TIER_ROLES.includes(role as (typeof ADMIN_TIER_ROLES)[number]);
}
