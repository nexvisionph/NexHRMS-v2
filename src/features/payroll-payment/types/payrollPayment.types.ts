export type PayrollStepId =
    | "schedule"
    | "head-count"
    | "attendance"
    | "payroll-data"
    | "process-result"
    | "report";

export type PayrollReportType =
    | "payroll-summary"
    | "payroll-variance"
    | "payroll-report"
    | "bank-report"
    | "statutory-report";

export interface PayrollSchedule {
    paymentType: string;
    payDate: string;
    taxReportDate: string;
    cutoffDate: string;
    salaryStartDate: string;
    salaryEndDate: string;
    attendanceStartDate: string;
    attendanceEndDate: string;
    claimStartDate: string;
    claimEndDate: string;
    endOfMonth: boolean;
    finalizedTaxInPeriod: boolean;
    calculateClaimsData: boolean;
    calculateBenefitsTransaction: boolean;
    calculateTax: boolean;
    filters: {
        jobPosition: string;
        workLocation: string;
        status: string;
        jobGrade: string;
        costCenter: string;
        employmentStatus: string;
        religion: string;
        jobStatus: string;
    };
}

export interface PayrollEmployee {
    id: string;
    employeeName: string;
    employeeNumber: string;
    jobPosition: string;
    jobGrade: string;
    status: string;
    joinDate: string;
    lastProcess: string;
    paythrough: string;
    costCenter: string;
    workLocation: string;
    employmentStatus: string;
    religion: string;
    salary: number;
}

export interface AttendancePayrollRecord {
    id: string;
    employeeName: string;
    employeeNumber: string;
    abo: number;
    abs: number;
    abs2: number;
    abs3: number;
    absm: number;
    absPh: number;
    acd: number;
    acdb: number;
    actTardiness: number;
    actUndertime: number;
    ad: number;
    anl: number;
    aphoff: number;
}

export interface PayrollComponentValue {
    id: string;
    employeeId: string;
    employeeName: string;
    salaryCurrency: string;
    salaryAmount: number;
    thirteenthMonthCurrency: string;
    thirteenthMonthAmount: number;
    allowancesCurrency: string;
    allowancesAmount: number;
    mealAllowance: number;
    basicAdjustment: number;
    deminimis: number;
    onCall: number;
    otAdjustment: number;
}

export interface PayrollResult {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber: string;
    salary: number;
    thirteenthMonthPay: number;
    allowances: number;
    meal: number;
    basicAdjustment: number;
    onCall: number;
    otAdjustment: number;
    grossPay: number;
    deductions: number;
    netPay: number;
}

export interface PayrollRun {
    id: string;
    title: string;
    schedule: PayrollSchedule;
    employees: PayrollEmployee[];
    attendanceRecords: AttendancePayrollRecord[];
    componentValues: PayrollComponentValue[];
    results: PayrollResult[];
    status: "draft" | "processing" | "processed" | "published" | "cancelled";
    progress: number;
    reportType: PayrollReportType;
}
