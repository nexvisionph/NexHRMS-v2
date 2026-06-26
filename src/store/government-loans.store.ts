import { create } from "zustand";
import {
    SEED_SSS_LOANS,
    SEED_PAGIBIG_LOANS,
    SEED_SSS_DEDUCTIONS,
    SEED_PAGIBIG_DEDUCTIONS,
    type SSSLoan,
    type PagibigLoan,
    type GovernmentLoanDeduction,
} from "@/app/[role]/loans/_lib/government-loans";

interface GovernmentLoansState {
    sssLoans: SSSLoan[];
    pagibigLoans: PagibigLoan[];
    sssDeductions: GovernmentLoanDeduction[];
    pagibigDeductions: GovernmentLoanDeduction[];
    createSSSLoan: (loan: Omit<SSSLoan, "id" | "totalDeducted" | "payrollPeriod" | "status">) => void;
    createPagibigLoan: (loan: Omit<PagibigLoan, "id" | "status">) => void;
    settleSSSLoan: (id: string) => void;
    settlePagibigLoan: (id: string) => void;
    getSSSDeductions: (loanId?: string) => GovernmentLoanDeduction[];
    getPagibigDeductions: (loanId?: string) => GovernmentLoanDeduction[];
}

let sssCounter = SEED_SSS_LOANS.length + 1;
let pagibigCounter = SEED_PAGIBIG_LOANS.length + 1;

export const useGovernmentLoansStore = create<GovernmentLoansState>((set, get) => ({
    sssLoans: SEED_SSS_LOANS,
    pagibigLoans: SEED_PAGIBIG_LOANS,
    sssDeductions: SEED_SSS_DEDUCTIONS,
    pagibigDeductions: SEED_PAGIBIG_DEDUCTIONS,

    createSSSLoan: (loan) => {
        const id = `SSS${String(sssCounter++).padStart(3, "0")}`;
        set((s) => ({
            sssLoans: [
                ...s.sssLoans,
                {
                    ...loan,
                    id,
                    totalDeducted: 0,
                    payrollPeriod: "1st Half",
                    status: "active",
                },
            ],
        }));
    },

    createPagibigLoan: (loan) => {
        const id = `PGB${String(pagibigCounter++).padStart(3, "0")}`;
        set((s) => ({
            pagibigLoans: [
                ...s.pagibigLoans,
                { ...loan, id, status: "active" },
            ],
        }));
    },

    settleSSSLoan: (id) => {
        set((s) => ({
            sssLoans: s.sssLoans.map((l) =>
                l.id === id ? { ...l, status: "settled", totalDeducted: l.loanAmount } : l,
            ),
        }));
    },

    settlePagibigLoan: (id) => {
        set((s) => ({
            pagibigLoans: s.pagibigLoans.map((l) =>
                l.id === id ? { ...l, status: "settled", outstandingBalance: 0 } : l,
            ),
        }));
    },

    getSSSDeductions: (loanId) => {
        const deductions = get().sssDeductions;
        return loanId ? deductions.filter((d) => d.loanId === loanId) : deductions;
    },

    getPagibigDeductions: (loanId) => {
        const deductions = get().pagibigDeductions;
        return loanId ? deductions.filter((d) => d.loanId === loanId) : deductions;
    },
}));
