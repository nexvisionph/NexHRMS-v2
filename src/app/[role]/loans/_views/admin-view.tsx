"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashAdvanceTab } from "@/app/[role]/loans/_components/cash-advance-tab";
import { SSSLoanTab } from "@/app/[role]/loans/_components/sss-loan-tab";
import { PagibigLoanTab } from "@/app/[role]/loans/_components/pagibig-loan-tab";

export default function AdminLoansView() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Loans & Cash Advances</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage company loans, cash advances, SSS, and Pag-IBIG loans</p>
            </div>

            <Tabs defaultValue="cash-advance">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
                    <TabsTrigger value="cash-advance">Cash Advances / Company Loan</TabsTrigger>
                    <TabsTrigger value="sss">SSS Loan</TabsTrigger>
                    <TabsTrigger value="pagibig">Pag-IBIG Loan</TabsTrigger>
                </TabsList>

                <TabsContent value="cash-advance" className="mt-6">
                    <CashAdvanceTab />
                </TabsContent>

                <TabsContent value="sss" className="mt-6">
                    <SSSLoanTab />
                </TabsContent>

                <TabsContent value="pagibig" className="mt-6">
                    <PagibigLoanTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
