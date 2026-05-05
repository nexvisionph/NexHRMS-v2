import { Card, CardContent } from "@/components/ui/card";

interface PayrollSummaryCardsProps {
    items: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }[];
}

const toneClass = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
};

export function PayrollSummaryCards({ items }: PayrollSummaryCardsProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {items.map((item) => (
                <Card key={item.label} className="border border-border/50">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={`mt-1 text-2xl font-semibold ${toneClass[item.tone || "default"]}`}>{item.value}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
