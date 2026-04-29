import { createAdminSupabaseClient } from "@/services/supabase-server";
import type { Role } from "@/types";

const ROLE_PREFIXES: Record<string, string> = {
  admin: "ADMIN",
  hr: "HR",
  finance: "FIN",
  employee: "EMP",
  supervisor: "SUP",
  payroll_admin: "PAY",
  auditor: "AUD",
  analyst: "ANY",
  support_admin: "SUP-ADM",
  finance_admin: "FIN-ADM",
};

/**
 * Generates a unique user ID in the format: (TYPE)-(NNNN)-(MMDD)
 * Example: USER-0001-0429
 */
export async function generateUserUniqueId(role: Role): Promise<string> {
  const supabase = await createAdminSupabaseClient();
  
  // Get current count of employees to determine the next number
  // We use the total count of employees for the incrementing part
  const { count, error } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[generateUserUniqueId] Error fetching employee count:", error);
    // Fallback to timestamp-based if query fails
    return `${(ROLE_PREFIXES[role] || "USER")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}-${getMMDD()}`;
  }

  const nextNumber = (count || 0) + 1;
  const prefix = ROLE_PREFIXES[role] || "USER";
  const formattedNumber = nextNumber.toString().padStart(4, "0");
  const mmdd = getMMDD();

  return `${prefix}-${formattedNumber}-${mmdd}`;
}

function getMMDD(): string {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${month}${day}`;
}
