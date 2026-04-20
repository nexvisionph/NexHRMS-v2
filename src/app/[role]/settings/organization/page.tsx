"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { useJobTitlesStore } from "@/store/job-titles.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Building2, Users, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Department, JobTitle } from "@/types";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function OrganizationPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);

    // Use persisted stores instead of local state
    const { departments, addDepartment, updateDepartment, deleteDepartment, resetToSeed: resetDepts } = useDepartmentsStore();
    const { jobTitles, addJobTitle, updateJobTitle, deleteJobTitle, resetToSeed: resetJobTitles } = useJobTitlesStore();

    const { hasPermission } = useRolesStore();
    const canManage = hasPermission(currentUser.role, "settings:organization");

    // Department dialog
    const [deptOpen, setDeptOpen] = useState(false);
    const [editDept, setEditDept] = useState<Department | null>(null);
    const [deptName, setDeptName] = useState("");
    const [deptDesc, setDeptDesc] = useState("");
    const [deptColor, setDeptColor] = useState("#6366f1");

    // Position dialog
    const [posOpen, setPosOpen] = useState(false);
    const [editPos, setEditPos] = useState<JobTitle | null>(null);
    const [posTitle, setPosTitle] = useState("");
    const [posDept, setPosDept] = useState("");
    const [posIsLead, setPosIsLead] = useState(false);
    const [posColor, setPosColor] = useState("#6366f1");

    // Reset confirmation
    const [resetOpen, setResetOpen] = useState(false);

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <Building2 className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You don&apos;t have access to organization settings.</p>
            </div>
        );
    }

    const getEmpCountForDept = (deptName: string) => {
        return employees.filter((e) => e.department === deptName && e.status === "active").length;
    };

    const handleSaveDept = () => {
        if (!deptName) { toast.error("Department name is required"); return; }
        if (editDept) {
            updateDepartment(editDept.id, { name: deptName, description: deptDesc || undefined, color: deptColor });
            toast.success("Department updated");
        } else {
            addDepartment({ name: deptName, description: deptDesc || undefined, color: deptColor, isActive: true, createdBy: currentUser.id });
            toast.success("Department added");
        }
        setDeptOpen(false); setEditDept(null); setDeptName(""); setDeptDesc(""); setDeptColor("#6366f1");
    };

    const handleDeleteDept = (id: string) => {
        deleteDepartment(id);
        toast.success("Department removed");
    };

    const handleSavePos = () => {
        if (!posTitle || !posDept) { toast.error("Title and department are required"); return; }
        if (editPos) {
            updateJobTitle(editPos.id, { name: posTitle, department: posDept, isLead: posIsLead, color: posColor });
            toast.success("Position updated");
        } else {
            addJobTitle({ name: posTitle, department: posDept, isActive: true, isLead: posIsLead, color: posColor, createdBy: currentUser.id });
            toast.success("Position added");
        }
        setPosOpen(false); setEditPos(null); setPosTitle(""); setPosDept(""); setPosIsLead(false); setPosColor("#6366f1");
    };

    const handleDeletePos = (id: string) => {
        deleteJobTitle(id);
        toast.success("Position removed");
    };

    const handleReset = () => {
        resetDepts();
        resetJobTitles();
        setResetOpen(false);
        toast.success("Organization structure reset to defaults");
    };

    const deptCount = departments.length;
    const posCount = jobTitles.length;
    const activeEmpCount = employees.filter((e) => e.status === "active").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Org Structure</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Departments, positions, and hierarchy</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Departments</p>
                        <p className="text-2xl font-bold mt-1">{deptCount}</p>
                    </CardContent>
                </Card>
                <Card className="border border-purple-500/20 bg-purple-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Positions</p>
                        <p className="text-2xl font-bold mt-1">{posCount}</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Active Employees</p>
                        <p className="text-2xl font-bold mt-1">{activeEmpCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Reset button */}
            <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setResetOpen(true)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
                </Button>
            </div>

            <Tabs defaultValue="departments">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="departments" className="gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Departments
                    </TabsTrigger>
                    <TabsTrigger value="positions" className="gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Positions
                    </TabsTrigger>
                </TabsList>

                {/* Departments Tab */}
                <TabsContent value="departments" className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-muted-foreground">{departments.length} departments</p>
                        <Button size="sm" className="gap-1.5" onClick={() => { setEditDept(null); setDeptName(""); setDeptDesc(""); setDeptColor("#6366f1"); setDeptOpen(true); }}>
                            <Plus className="h-3.5 w-3.5" /> Add Department
                        </Button>
                    </div>
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs w-3"></TableHead>
                                        <TableHead className="text-xs">Name</TableHead>
                                        <TableHead className="text-xs">Description</TableHead>
                                        <TableHead className="text-xs">Positions</TableHead>
                                        <TableHead className="text-xs">Active Employees</TableHead>
                                        <TableHead className="text-xs w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {departments.map((dept) => (
                                        <TableRow key={dept.id}>
                                            <TableCell>
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color || "#6366f1" }} />
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">{dept.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{dept.description || "—"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{jobTitles.filter((jt) => jt.department === dept.name).length}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{getEmpCountForDept(dept.name)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                        onClick={() => { setEditDept(dept); setDeptName(dept.name); setDeptDesc(dept.description || ""); setDeptColor(dept.color || "#6366f1"); setDeptOpen(true); }}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                                        onClick={() => handleDeleteDept(dept.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Positions Tab */}
                <TabsContent value="positions" className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-muted-foreground">{jobTitles.length} positions</p>
                        <Button size="sm" className="gap-1.5" onClick={() => { setEditPos(null); setPosTitle(""); setPosDept(""); setPosIsLead(false); setPosColor("#6366f1"); setPosOpen(true); }}>
                            <Plus className="h-3.5 w-3.5" /> Add Position
                        </Button>
                    </div>
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs w-3"></TableHead>
                                        <TableHead className="text-xs">Title</TableHead>
                                        <TableHead className="text-xs">Department</TableHead>
                                        <TableHead className="text-xs">Type</TableHead>
                                        <TableHead className="text-xs w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobTitles.map((jt) => (
                                        <TableRow key={jt.id}>
                                            <TableCell>
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jt.color || "#6366f1" }} />
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">{jt.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{jt.department || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={`text-[10px] ${jt.isLead ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-slate-500/15 text-slate-700 dark:text-slate-400"}`}>
                                                    {jt.isLead ? "Lead" : "Member"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                        onClick={() => { setEditPos(jt); setPosTitle(jt.name); setPosDept(jt.department || ""); setPosIsLead(jt.isLead); setPosColor(jt.color || "#6366f1"); setPosOpen(true); }}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                                        onClick={() => handleDeletePos(jt.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Department Dialog */}
            <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{editDept ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Department Name *</label>
                            <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Engineering" className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <Textarea value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder="What does this department do?" className="mt-1" rows={2} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Color</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input type="color" value={deptColor} onChange={(e) => setDeptColor(e.target.value)} className="w-12 h-9 p-1" />
                                <Input value={deptColor} onChange={(e) => setDeptColor(e.target.value)} className="flex-1 font-mono text-sm" />
                            </div>
                        </div>
                        <Button onClick={handleSaveDept} className="w-full">{editDept ? "Save Changes" : "Add Department"}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Position Dialog */}
            <Dialog open={posOpen} onOpenChange={setPosOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{editPos ? "Edit Position" : "Add Position"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Title *</label>
                            <Input value={posTitle} onChange={(e) => setPosTitle(e.target.value)} placeholder="e.g. Software Engineer" className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Department *</label>
                            <Select value={posDept} onValueChange={setPosDept}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                            <div>
                                <p className="text-sm font-medium">Leadership Role</p>
                                <p className="text-xs text-muted-foreground">Mark as team lead or manager position</p>
                            </div>
                            <input type="checkbox" checked={posIsLead} onChange={(e) => setPosIsLead(e.target.checked)} className="h-4 w-4" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Color</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input type="color" value={posColor} onChange={(e) => setPosColor(e.target.value)} className="w-12 h-9 p-1" />
                                <Input value={posColor} onChange={(e) => setPosColor(e.target.value)} className="flex-1 font-mono text-sm" />
                            </div>
                        </div>
                        <Button onClick={handleSavePos} className="w-full">{editPos ? "Save Changes" : "Add Position"}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reset Confirmation */}
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Organization Structure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset all departments and positions to their default values. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Reset to Defaults
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
