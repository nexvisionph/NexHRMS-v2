"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyLoansTab } from "@/app/[role]/loans/_components/company-loans-tab";
import { CashAdvancesTab } from "@/app/[role]/loans/_components/cash-advances-tab";
import { GovernmentLoansTab } from "@/app/[role]/loans/_components/government-loans-tab";

export default function AdminLoansView() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Loans & Cash Advances</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage company loans, cash advances, SSS, and Pag-IBIG loans</p>
            </div>

            <Tabs defaultValue="company-loans">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
                    <TabsTrigger value="company-loans">Company Loans</TabsTrigger>
                    <TabsTrigger value="cash-advances">Cash Advances</TabsTrigger>
                    <TabsTrigger value="government-loans">Government Loans</TabsTrigger>
                </TabsList>

                <TabsContent value="company-loans" className="mt-6">
                    <CompanyLoansTab />
                </TabsContent>

                <TabsContent value="cash-advances" className="mt-6">
                    <CashAdvancesTab />
                </TabsContent>

                <TabsContent value="government-loans" className="mt-6">
                    <GovernmentLoansTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
