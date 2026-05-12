/**
 * Alphalist Generator
 * --------------------------------------------------------------
 * Builds BIR Alphalist rows from finalized AnnualTaxSummaries.
 *
 *   Schedule 1 — present employees (status active at year end)
 *   Schedule 2 — separated employees (separation_date in target year)
 *
 * Reference: bir_alphalist.md §5
 */

import type {
    Employee,
    EmployeeTaxProfile,
    AnnualTaxSummary,
    AlphalistRow,
    AlphalistScheduleType,
} from "@/types";

export interface BuildAlphalistInput {
    year: number;
    schedule: AlphalistScheduleType;
    employees: Employee[];
    profiles: EmployeeTaxProfile[];
    summaries: AnnualTaxSummary[];
}

export interface BuildAlphalistResult {
    schedule1: AlphalistRow[];
    schedule2: AlphalistRow[];
    totals: {
        employeeCount: number;
        totalTaxableComp: number;
        totalTaxWithheld: number;
    };
}

export function buildAlphalist(input: BuildAlphalistInput): BuildAlphalistResult {
    const empById = new Map(input.employees.map((e) => [e.id, e]));
    const profileByEmp = new Map(input.profiles.map((p) => [p.employeeId, p]));

    const schedule1: AlphalistRow[] = [];
    const schedule2: AlphalistRow[] = [];

    let seq1 = 1;
    let seq2 = 1;

    for (const s of input.summaries) {
        const emp = empById.get(s.employeeId);
        const profile = profileByEmp.get(s.employeeId);
        if (!emp || !profile) continue;

        const isSeparated =
            !!profile.separationDate &&
            new Date(profile.separationDate).getFullYear() === input.year;

        const grossCompensation = s.totalTaxableComp + s.totalNonTaxableComp;

        const { lastName, firstName, middleName } = splitName(emp.name);

        const baseRow: Omit<AlphalistRow, "sequenceNumber"> = {
            tin: profile.tin ?? "",
            lastName,
            firstName,
            middleName,
            employmentClassification: profile.employmentClassification,
            taxStatus: profile.taxStatus,
            isMWE: profile.isMWE,
            grossCompensation: round2(grossCompensation),
            nonTaxableCompensation: round2(s.totalNonTaxableComp),
            taxableCompensation: round2(s.totalTaxableComp),
            taxWithheld: round2(s.totalTaxWithheld),
            taxDue: round2(s.annualTaxDue ?? 0),
            overUnderWithheld: round2(s.adjustmentAmount ?? 0),
            prevEmployerIncome: round2(s.prevEmployerIncome),
            prevEmployerTax: round2(s.prevEmployerTax),
            separationDate: profile.separationDate,
            separationType: profile.separationType,
        };

        if (isSeparated) {
            if (input.schedule === "schedule_1") continue;
            schedule2.push({ sequenceNumber: seq2++, ...baseRow });
        } else {
            if (input.schedule === "schedule_2") continue;
            schedule1.push({ sequenceNumber: seq1++, ...baseRow });
        }
    }

    const all = [...schedule1, ...schedule2];
    return {
        schedule1,
        schedule2,
        totals: {
            employeeCount: all.length,
            totalTaxableComp: round2(all.reduce((a, r) => a + r.taxableCompensation, 0)),
            totalTaxWithheld: round2(all.reduce((a, r) => a + r.taxWithheld, 0)),
        },
    };
}

function splitName(full: string): {
    lastName: string;
    firstName: string;
    middleName: string;
} {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { lastName: parts[0], firstName: "", middleName: "" };
    if (parts.length === 2) return { lastName: parts[1], firstName: parts[0], middleName: "" };
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];
    const middleName = parts.slice(1, -1).join(" ");
    return { lastName, firstName, middleName };
}

function round2(n: number): number {
    return Math.round((n ?? 0) * 100) / 100;
}
