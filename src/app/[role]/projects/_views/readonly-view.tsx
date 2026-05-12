"use client";

import { useProjectsStore } from "@/store/projects.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getInitials } from "@/lib/format";
import { FolderKanban, MapPin } from "lucide-react";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    active: { label: "🟢 Active", variant: "default" },
    completed: { label: "🔵 Completed", variant: "secondary" },
    on_hold: { label: "🟡 On Hold", variant: "outline" },
};

export default function ReadonlyProjectsView() {
    const projects = useProjectsStore((s) => s.projects);
    const employees = useEmployeesStore((s) => s.employees);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{projects.length} projects · View only</p>
            </div>

            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">ID</TableHead>
                                    <TableHead className="text-xs">Project Name</TableHead>
                                    <TableHead className="text-xs">Location</TableHead>
                                    <TableHead className="text-xs">Radius</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Team</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                                            <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-40" />No projects yet
                                        </TableCell>
                                    </TableRow>
                                ) : projects.map((project) => {
                                    const st = statusMap[project.status || "active"] || statusMap.active;
                                    return (
                                        <TableRow key={project.id}>
                                            <TableCell className="text-xs text-muted-foreground font-mono">{project.id}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm font-medium">{project.name}</p>
                                                    {project.description && <p className="text-xs text-muted-foreground max-w-[250px] truncate">{project.description}</p>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />{project.location.lat.toFixed(4)}, {project.location.lng.toFixed(4)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{project.location.radius}m</TableCell>
                                            <TableCell><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <div className="flex -space-x-2">
                                                        {project.assignedEmployeeIds.slice(0, 3).map((empId) => (
                                                            <Avatar key={empId} className="h-6 w-6 border-2 border-card">
                                                                <AvatarFallback className="text-[8px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                                            </Avatar>
                                                        ))}
                                                    </div>
                                                    {project.assignedEmployeeIds.length > 3 && <span className="text-xs text-muted-foreground ml-1">+{project.assignedEmployeeIds.length - 3}</span>}
                                                    {project.assignedEmployeeIds.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
