"use client";

import { useDocumentsStore } from "@/store/documents.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderArchive } from "lucide-react";

export default function Documents201ReadonlyView() {
    const docs = useDocumentsStore((s) => s.documents);
    const { employees } = useEmployeesStore();
    const stats = useDocumentsStore((s) => s.getStats());

    const empMap = new Map(employees.map((e) => [e.id, e]));

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FolderArchive className="h-6 w-6 text-primary" /> 201 Files (Read-only)
                </h1>
                <p className="text-sm text-muted-foreground">Audit view of employee documents</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total" value={stats.total} />
                <Stat label="Approved" value={stats.approved} />
                <Stat label="For Review" value={stats.forReview} />
                <Stat label="Expiring 30d" value={stats.expiring30} />
            </div>
            <Card>
                <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {docs.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No documents.</TableCell></TableRow>
                            ) : (
                                docs.map((d) => (
                                    <TableRow key={d.id}>
                                        <TableCell>{empMap.get(d.employeeId)?.name ?? d.employeeId}</TableCell>
                                        <TableCell className="text-xs capitalize">{d.documentType.replace(/_/g, " ")}</TableCell>
                                        <TableCell>{d.documentTitle}</TableCell>
                                        <TableCell><Badge variant="secondary" className="capitalize">{d.status.replace("_", " ")}</Badge></TableCell>
                                        <TableCell className="text-xs">{new Date(d.updatedAt).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </CardContent></Card>
    );
}
