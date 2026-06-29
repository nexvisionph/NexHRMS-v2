"use client";

import { useEffect } from "react";
import { useDeductionsStore } from "@/store/deductions.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useProjectsStore } from "@/store/projects.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PayScheduleSettings } from "@/components/payroll/pay-schedule-settings";
import { Settings, Users, Calculator, CalendarDays, Layers } from "lucide-react";
import { DeductionTemplatesTab } from "@/components/payroll/deduction-templates-tab";
import { EmployeeAssignmentsTab } from "@/components/payroll/employee-assignments-tab";
import { PayrollRulesTab } from "@/components/payroll/payroll-rules-tab";

/* ═══════════════════════════════════════════════════════════════
   PAYROLL SETTINGS PAGE
   Tabs: Pay Schedule | Custom Deductions | Employee Assignments | Payroll Rules
   ═══════════════════════════════════════════════════════════════ */

export default function PayrollSettingsPage() {
    const { templates, assignments, isLoading, error, fetchTemplates, addTemplate, updateTemplate, deleteTemplate, fetchAssignments, assignToEmployee, unassignFromEmployee, bulkAssignToEmployees } = useDeductionsStore();
    const { paySchedule, updatePaySchedule } = usePayrollStore();
    const employees = useEmployeesStore((s) => s.employees);
    const projects = useProjectsStore((s) => s.projects);
    const departments = useDepartmentsStore((s) => s.departments);

    useEffect(() => { fetchTemplates(); fetchAssignments(); }, [fetchTemplates, fetchAssignments]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Settings className="h-6 w-6" /> Payroll Settings
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Configure pay schedule, custom deductions &amp; employee assignments</p>
                </div>
            </div>

            {error && (
                <Card className="border border-red-300 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-3 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
                </Card>
            )}

            <Tabs defaultValue="deductions">
                <TabsList>
                    <TabsTrigger value="deductions" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Custom Deductions</TabsTrigger>
                    <TabsTrigger value="assignments" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Employee Assignments</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Pay Schedule</TabsTrigger>
                    <TabsTrigger value="rules" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Payroll Rules</TabsTrigger>
                </TabsList>

                {/* ─── Custom Deductions Tab ─────────────────────────── */}
                <TabsContent value="deductions" className="mt-4">
                    <DeductionTemplatesTab
                        templates={templates}
                        departments={departments}
                        projects={projects}
                        isLoading={isLoading}
                        onAdd={addTemplate}
                        onUpdate={updateTemplate}
                        onDelete={deleteTemplate}
                    />
                </TabsContent>

                {/* ─── Employee Assignments Tab ──────────────────────── */}
                <TabsContent value="assignments" className="mt-4">
                    <EmployeeAssignmentsTab
                        templates={templates}
                        assignments={assignments}
                        employees={employees}
                        projects={projects}
                        isLoading={isLoading}
                        onAssign={assignToEmployee}
                        onUnassign={unassignFromEmployee}
                        onBulkAssign={bulkAssignToEmployees}
                    />
                </TabsContent>

                {/* ─── Pay Schedule Tab ──────────────────────────────── */}
                <TabsContent value="schedule" className="mt-4">
                    <PayScheduleSettings schedule={paySchedule} onUpdate={updatePaySchedule} />
                </TabsContent>

                {/* ─── Payroll Rules Tab ──────────────────────────────── */}
                <TabsContent value="rules" className="mt-4">
                    <PayrollRulesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}