import type { LoanStatus } from "@/types";

export type SSSLoanType = "calamity" | "salary";
export type PagibigLoanType = "mpl" | "calamity";

export interface SSSLoan {
    id: string;
    employeeId: string;
    sssNumber: string;
    loanType: SSSLoanType;
    referenceNumber: string;
    loanAmount: number;
    monthlyAmortization: number;
    startDeductionDate: string;
    endDate: string;
    payrollPeriod: string;
    totalDeducted: number;
    status: LoanStatus;
}

export interface PagibigLoan {
    id: string;
    employeeId: string;
    loanType: PagibigLoanType;
    referenceNumber: string;
    loanAmount: number;
    monthlyAmortization: number;
    outstandingBalance: number;
    startDeductionDate: string;
    endDate: string;
    dateReleased: string;
    status: LoanStatus;
}

export interface GovernmentLoanDeduction {
    id: string;
    loanId: string;
    employeeId: string;
    deductedAt: string;
    amount: number;
    remainingAfter: number;
    payslipId?: string;
}

export interface GovernmentLoanScheduleItem {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    paid: boolean;
    skippedReason?: string;
}

export const SSS_LOAN_TYPE_LABELS: Record<SSSLoanType, string> = {
    calamity: "SSS Calamity Loan",
    salary: "SSS Salary Loan",
};

export const PAGIBIG_LOAN_TYPE_LABELS: Record<PagibigLoanType, string> = {
    mpl: "Multi-Purpose Loan (MPL)",
    calamity: "Calamity Loan",
};

export function formatCompanyLoanType(type: string): string {
    if (type === "salary_loan") return "Company Loan";
    return type.replace(/_/g, " ");
}

export function generateSchedule(
    startDate: string,
    endDate: string,
    monthlyAmount: number,
    totalDeducted = 0,
): GovernmentLoanScheduleItem[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || monthlyAmount <= 0) return [];

    const items: GovernmentLoanScheduleItem[] = [];
    let current = new Date(start);
    let installment = 1;
    let deducted = totalDeducted;

    while (current <= end) {
        const paid = deducted >= monthlyAmount;
        if (paid) deducted -= monthlyAmount;
        items.push({
            installmentNumber: installment,
            dueDate: current.toISOString().split("T")[0],
            amount: monthlyAmount,
            paid,
        });
        current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
        installment += 1;
    }
    return items;
}

export const SEED_SSS_LOANS: SSSLoan[] = [
    {
        id: "SSS001",
        employeeId: "EMP001",
        sssNumber: "34-1234567-8",
        loanType: "salary",
        referenceNumber: "SSS-2026-00142",
        loanAmount: 24000,
        monthlyAmortization: 1000,
        startDeductionDate: "2026-01-01",
        endDate: "2027-12-31",
        payrollPeriod: "1st Half",
        totalDeducted: 3000,
        status: "active",
    },
    {
        id: "SSS002",
        employeeId: "EMP004",
        sssNumber: "34-9876543-2",
        loanType: "calamity",
        referenceNumber: "SSS-2025-00891",
        loanAmount: 16000,
        monthlyAmortization: 800,
        startDeductionDate: "2025-06-01",
        endDate: "2026-05-31",
        payrollPeriod: "2nd Half",
        totalDeducted: 16000,
        status: "settled",
    },
    {
        id: "SSS003",
        employeeId: "EMP009",
        sssNumber: "34-5551234-6",
        loanType: "salary",
        referenceNumber: "SSS-2026-00201",
        loanAmount: 36000,
        monthlyAmortization: 1500,
        startDeductionDate: "2026-02-01",
        endDate: "2028-01-31",
        payrollPeriod: "1st Half",
        totalDeducted: 1500,
        status: "active",
    },
];

export const SEED_PAGIBIG_LOANS: PagibigLoan[] = [
    {
        id: "PGB001",
        employeeId: "EMP001",
        loanType: "mpl",
        referenceNumber: "HDMF-2026-5512",
        loanAmount: 50000,
        monthlyAmortization: 2083.33,
        outstandingBalance: 41666.67,
        startDeductionDate: "2026-01-01",
        endDate: "2028-01-31",
        dateReleased: "2025-12-15",
        status: "active",
    },
    {
        id: "PGB002",
        employeeId: "EMP004",
        loanType: "calamity",
        referenceNumber: "HDMF-2025-3310",
        loanAmount: 20000,
        monthlyAmortization: 833.33,
        outstandingBalance: 0,
        startDeductionDate: "2025-07-01",
        endDate: "2026-06-30",
        dateReleased: "2025-06-20",
        status: "settled",
    },
    {
        id: "PGB003",
        employeeId: "EMP002",
        loanType: "mpl",
        referenceNumber: "HDMF-2026-7781",
        loanAmount: 80000,
        monthlyAmortization: 3333.33,
        outstandingBalance: 73333.33,
        startDeductionDate: "2026-03-01",
        endDate: "2028-02-29",
        dateReleased: "2026-02-10",
        status: "active",
    },
];

export const SEED_SSS_DEDUCTIONS: GovernmentLoanDeduction[] = [
    { id: "SSD001", loanId: "SSS001", employeeId: "EMP001", deductedAt: "2026-01-15", amount: 1000, remainingAfter: 23000, payslipId: "PS-2026-01-A" },
    { id: "SSD002", loanId: "SSS001", employeeId: "EMP001", deductedAt: "2026-02-15", amount: 1000, remainingAfter: 22000, payslipId: "PS-2026-02-A" },
    { id: "SSD003", loanId: "SSS001", employeeId: "EMP001", deductedAt: "2026-03-15", amount: 1000, remainingAfter: 21000, payslipId: "PS-2026-03-A" },
    { id: "SSD004", loanId: "SSS003", employeeId: "EMP009", deductedAt: "2026-02-28", amount: 1500, remainingAfter: 34500, payslipId: "PS-2026-02-B" },
];

export const SEED_PAGIBIG_DEDUCTIONS: GovernmentLoanDeduction[] = [
    { id: "PGD001", loanId: "PGB001", employeeId: "EMP001", deductedAt: "2026-01-31", amount: 2083.33, remainingAfter: 47916.67, payslipId: "PS-2026-01-A" },
    { id: "PGD002", loanId: "PGB001", employeeId: "EMP001", deductedAt: "2026-02-28", amount: 2083.33, remainingAfter: 45833.34, payslipId: "PS-2026-02-A" },
    { id: "PGD003", loanId: "PGB003", employeeId: "EMP002", deductedAt: "2026-03-15", amount: 3333.33, remainingAfter: 76666.67, payslipId: "PS-2026-03-A" },
];

export interface CompanyLoanScheduleItem {
    payrollPeriod: string;
    amount: number;
    status: "paid" | "pending";
}

export function generateCompanyLoanSchedule(
    totalAmount: number,
    monthlyDeduction: number,
    startDeductionDate: string,
    deductionFrequency: "every_payroll" | "first_payroll" | "last_payroll" = "every_payroll",
    totalDeducted = 0
): CompanyLoanScheduleItem[] {
    const start = new Date(startDeductionDate || new Date());
    if (Number.isNaN(start.getTime()) || monthlyDeduction <= 0 || totalAmount <= 0) return [];

    const schedule: CompanyLoanScheduleItem[] = [];
    let remainingBalance = totalAmount;
    let currentDate = new Date(start);
    let totalDeductionsMade = totalDeducted;

    while (remainingBalance > 0.01) {
        let installmentAmount = 0;

        if (deductionFrequency === "every_payroll") {
            installmentAmount = Math.min(monthlyDeduction / 2, remainingBalance);
            const currentDay = currentDate.getDate();
            if (currentDay <= 15) {
                currentDate.setDate(15);
            } else {
                const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                currentDate = nextMonth;
            }
        } else if (deductionFrequency === "first_payroll") {
            installmentAmount = Math.min(monthlyDeduction, remainingBalance);
            currentDate.setDate(15);
        } else {
            installmentAmount = Math.min(monthlyDeduction, remainingBalance);
            const eom = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            currentDate = eom;
        }

        const payrollPeriodLabel = currentDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        let status: "paid" | "pending" = "pending";
        if (totalDeductionsMade >= installmentAmount - 0.01) {
            status = "paid";
            totalDeductionsMade -= installmentAmount;
        }

        schedule.push({
            payrollPeriod: payrollPeriodLabel,
            amount: Math.round(installmentAmount * 100) / 100,
            status,
        });

        remainingBalance -= installmentAmount;

        if (deductionFrequency === "every_payroll") {
            if (currentDate.getDate() === 15) {
                currentDate.setDate(28); // trigger moving to second cutoff next iteration
            } else {
                currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 15);
            }
        } else {
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 15);
        }
    }

    return schedule;
}
