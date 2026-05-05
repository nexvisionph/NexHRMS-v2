import { format, endOfMonth } from "date-fns";
import type { Employee } from "@/types";
import type {
    AttendancePayrollRecord,
    PayrollComponentValue,
    PayrollEmployee,
    PayrollResult,
    PayrollSchedule,
} from "../types/payrollPayment.types";

const today = new Date();
const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");
const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

export const defaultPayrollSchedule: PayrollSchedule = {
    paymentType: "Monthly Payroll",
    payDate: monthEnd,
    taxReportDate: monthEnd,
    cutoffDate: monthEnd,
    salaryStartDate: monthStart,
    salaryEndDate: monthEnd,
    attendanceStartDate: monthStart,
    attendanceEndDate: monthEnd,
    claimStartDate: monthStart,
    claimEndDate: monthEnd,
    endOfMonth: true,
    finalizedTaxInPeriod: false,
    calculateClaimsData: true,
    calculateBenefitsTransaction: true,
    calculateTax: true,
    filters: {
        jobPosition: "all",
        workLocation: "all",
        status: "active",
        jobGrade: "all",
        costCenter: "all",
        employmentStatus: "all",
        religion: "all",
        jobStatus: "all",
    },
};

const fallbackEmployees: PayrollEmployee[] = [
    {
        id: "PAY-001",
        employeeName: "Maria Santos",
        employeeNumber: "EMP-001",
        jobPosition: "HR Manager",
        jobGrade: "G7",
        status: "active",
        joinDate: "2022-03-14",
        lastProcess: "Previous Month",
        paythrough: "Bank",
        costCenter: "People Ops",
        workLocation: "Manila HQ",
        employmentStatus: "Regular",
        religion: "Not specified",
        salary: 85000,
    },
    {
        id: "PAY-002",
        employeeName: "Jose Reyes",
        employeeNumber: "EMP-002",
        jobPosition: "Payroll Specialist",
        jobGrade: "G5",
        status: "active",
        joinDate: "2023-06-01",
        lastProcess: "Previous Month",
        paythrough: "Bank",
        costCenter: "Finance",
        workLocation: "Cebu Office",
        employmentStatus: "Regular",
        religion: "Not specified",
        salary: 52000,
    },
    {
        id: "PAY-003",
        employeeName: "Andrea Cruz",
        employeeNumber: "EMP-003",
        jobPosition: "Software Engineer",
        jobGrade: "G6",
        status: "active",
        joinDate: "2024-01-15",
        lastProcess: "New Hire",
        paythrough: "Bank",
        costCenter: "Engineering",
        workLocation: "Remote",
        employmentStatus: "Probationary",
        religion: "Not specified",
        salary: 70000,
    },
];

export function buildPayrollEmployees(employees: Employee[]): PayrollEmployee[] {
    const source = employees.length > 0 ? employees : [];
    const mapped = source.map((employee, index) => ({
        id: employee.id,
        employeeName: employee.name,
        employeeNumber: employee.id,
        jobPosition: employee.jobTitle || employee.role || "Employee",
        jobGrade: `G${(index % 5) + 3}`,
        status: employee.status,
        joinDate: employee.joinDate,
        lastProcess: index % 4 === 0 ? "New Hire" : "Previous Month",
        paythrough: "Bank",
        costCenter: employee.department || "General",
        workLocation: employee.location || "Main Office",
        employmentStatus: employee.workType || "Regular",
        religion: "Not specified",
        salary: employee.salary || 0,
    }));

    return mapped.length > 0 ? mapped : fallbackEmployees;
}

export function buildAttendanceRecords(employees: PayrollEmployee[]): AttendancePayrollRecord[] {
    return employees.map((employee, index) => ({
        id: `ATT-${employee.id}`,
        employeeName: employee.employeeName,
        employeeNumber: employee.employeeNumber,
        abo: index % 2,
        abs: index % 3,
        abs2: 0,
        abs3: index % 4 === 0 ? 1 : 0,
        absm: 0,
        absPh: index % 5 === 0 ? 1 : 0,
        acd: 22 - (index % 3),
        acdb: 0,
        actTardiness: index * 4,
        actUndertime: index % 2,
        ad: 0,
        anl: index % 3,
        aphoff: 0,
    }));
}

export function buildComponentValues(employees: PayrollEmployee[]): PayrollComponentValue[] {
    return employees.map((employee) => ({
        id: `COMP-${employee.id}`,
        employeeId: employee.id,
        employeeName: employee.employeeName,
        salaryCurrency: "PHP",
        salaryAmount: employee.salary,
        thirteenthMonthCurrency: "PHP",
        thirteenthMonthAmount: Math.round(employee.salary / 12),
        allowancesCurrency: "PHP",
        allowancesAmount: 2500,
        mealAllowance: 1500,
        basicAdjustment: 0,
        deminimis: 1000,
        onCall: 0,
        otAdjustment: 0,
    }));
}

export function buildPayrollResults(componentValues: PayrollComponentValue[], employees: PayrollEmployee[]): PayrollResult[] {
    return componentValues.map((component) => {
        const employee = employees.find((item) => item.id === component.employeeId);
        const grossPay =
            component.salaryAmount +
            component.thirteenthMonthAmount +
            component.allowancesAmount +
            component.mealAllowance +
            component.basicAdjustment +
            component.deminimis +
            component.onCall +
            component.otAdjustment;
        const deductions = Math.round(component.salaryAmount * 0.12);

        return {
            id: `RES-${component.employeeId}`,
            employeeId: component.employeeId,
            employeeName: component.employeeName,
            employeeNumber: employee?.employeeNumber || component.employeeId,
            salary: component.salaryAmount,
            thirteenthMonthPay: component.thirteenthMonthAmount,
            allowances: component.allowancesAmount,
            meal: component.mealAllowance,
            basicAdjustment: component.basicAdjustment,
            onCall: component.onCall,
            otAdjustment: component.otAdjustment,
            grossPay,
            deductions,
            netPay: Math.max(0, grossPay - deductions),
        };
    });
}
