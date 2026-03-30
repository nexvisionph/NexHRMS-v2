"use client";

import { useMemo } from "react";
import { useLoansStore } from "@/store/loans.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, History, Percent } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmployeeLoansView() {
    const { loans, getAllDeductions, getSchedule } = useLoansStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const myEmployeeId = employees.find((e) => e.profileId === currentUser.id || e.email === currentUser.email || e.name === currentUser.name)?.id;

    const myLoans = useMemo(() => loans.filter((l) => l.employeeId === myEmployeeId), [loans, myEmployeeId]);
    const myDeductions = useMemo(() => getAllDeductions().filter((d) => myLoans.some((l) => l.id === d.loanId)), [getAllDeductions, myLoans]);

    const stats = useMemo(() => {
        const active = myLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0),
            totalSettled: myLoans.filter((l) => l.status === "settled").length,
        };
    }, [myLoans]);

    if (!myEmployeeId) {
        return (
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold tracking-tight">My Loans</h1></div>
                <Card><CardContent className="p-8 text-center text-muted-foreground">No employee record linked to your account.</CardContent></Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{myLoans.length} loan(s)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-medium">Active Loans</p><p className="text-2xl font-bold mt-1">{stats.totalActive}</p></CardContent></Card>
                <Card className="border border-amber-500/20 bg-amber-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p><p className="text-2xl font-bold mt-1">₱{stats.totalOutstanding.toLocaleString()}</p></CardContent></Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-medium">Settled</p><p className="text-2xl font-bold mt-1">{stats.totalSettled}</p></CardContent></Card>
            </div>

            <Tabs defaultValue="loans">
                <TabsList className="w-full overflow-x-auto justify-start">
                    <TabsTrigger value="loans">My Loans</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Repayment Schedule</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> Deduction History{myDeductions.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{myDeductions.length}</span>}</TabsTrigger>
                </TabsList>

                <TabsContent value="loans" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Balance</TableHead><TableHead className="text-xs">Progress</TableHead><TableHead className="text-xs">Monthly</TableHead><TableHead className="text-xs">Cap</TableHead><TableHead className="text-xs">Status</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {myLoans.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">You have no loans</TableCell></TableRow>
                                        ) : myLoans.map((loan) => {
                                            const paidPct = loan.amount > 0 ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100) : 100;
                                            const statusColor = loan.status === "active" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : loan.status === "settled" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : loan.status === "cancelled" ? "bg-red-500/15 text-red-700 dark:text-red-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
                                            return (
                                                <TableRow key={loan.id}>
                                                    <TableCell className="text-xs capitalize">{loan.type.replace("_", " ")}</TableCell>
                                                    <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                    <TableCell className="w-32"><div className="flex items-center gap-2"><Progress value={paidPct} className="h-2 flex-1" /><span className="text-[10px] text-muted-foreground w-8">{paidPct}%</span></div></TableCell>
                                                    <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400"><Percent className="h-2.5 w-2.5 mr-0.5" />{loan.deductionCapPercent || 30}%</Badge></TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${statusColor}`}>{loan.status}</Badge></TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Loan</TableHead><TableHead className="text-xs">#</TableHead><TableHead className="text-xs">Due Date</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Status</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {myLoans.filter((l) => l.status === "active").length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No active schedules</TableCell></TableRow>
                                        ) : myLoans.filter((l) => l.status === "active").flatMap((loan) =>
                                            getSchedule(loan.id).map((inst, i) => (
                                                <TableRow key={`${loan.id}-${i}`}>
                                                    <TableCell className="text-xs capitalize">{loan.type.replace("_", " ")}</TableCell>
                                                    <TableCell className="text-xs">{i + 1}</TableCell>
                                                    <TableCell className="text-xs">{inst.dueDate}</TableCell>
                                                    <TableCell className="text-sm">₱{inst.amount.toLocaleString()}</TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${inst.paid ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{inst.paid ? "Paid" : inst.skippedReason || "Pending"}</Badge></TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Loan</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Running Balance</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : myDeductions.sort((a, b) => b.deductedAt.localeCompare(a.deductedAt)).map((d) => {
                                            const loan = myLoans.find((l) => l.id === d.loanId);
                                            return (
                                                <TableRow key={d.id}>
                                                    <TableCell className="text-xs">{d.deductedAt}</TableCell>
                                                    <TableCell className="text-xs capitalize">{loan?.type.replace("_", " ") || d.loanId}</TableCell>
                                                    <TableCell className="text-sm">₱{d.amount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-sm">₱{d.remainingAfter.toLocaleString()}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
