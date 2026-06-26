"use client";

import { Card, CardContent } from "@/components/ui/card";

interface LoanKpiCardsProps {
    activeLabel: string;
    activeCount: number;
    outstandingBalance: number;
    settledCount: number;
}

export function LoanKpiCards({ activeLabel, activeCount, outstandingBalance, settledCount }: LoanKpiCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">{activeLabel}</p>
                    <p className="text-2xl font-bold mt-1">{activeCount}</p>
                </CardContent>
            </Card>
            <Card className="border border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Total Outstanding Balance</p>
                    <p className="text-2xl font-bold mt-1">₱{outstandingBalance.toLocaleString()}</p>
                </CardContent>
            </Card>
            <Card className="border border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Settled</p>
                    <p className="text-2xl font-bold mt-1">{settledCount}</p>
                </CardContent>
            </Card>
        </div>
    );
}
