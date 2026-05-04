import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PayrollDataTableProps<T> {
    columns: { key: string; label: string; className?: string; render?: (row: T, index: number) => ReactNode }[];
    rows: T[];
    getRowKey: (row: T, index: number) => string;
    emptyText: string;
    minWidth?: string;
}

export function PayrollDataTable<T>({ columns, rows, getRowKey, emptyText, minWidth = "min-w-[980px]" }: PayrollDataTableProps<T>) {
    return (
        <Card className="border border-border/50">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className={minWidth}>
                        <TableHeader>
                            <TableRow>
                                {columns.map((column) => (
                                    <TableHead key={column.key} className={`text-xs ${column.className || ""}`}>{column.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                                        {emptyText}
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((row, index) => (
                                <TableRow key={getRowKey(row, index)}>
                                    {columns.map((column) => (
                                        <TableCell key={column.key} className="text-xs">
                                            {column.render ? column.render(row, index) : String((row as Record<string, unknown>)[column.key] ?? "")}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
