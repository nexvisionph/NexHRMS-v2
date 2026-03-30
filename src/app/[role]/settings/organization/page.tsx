"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, Building2, Users } from "lucide-react";
import { toast } from "sonner";

interface Department {
    id: string;
    code: string;
    name: string;
}

interface Position {
    id: string;
    title: string;
    departmentId: string;
    level: "junior" | "mid" | "senior" | "lead" | "manager";
}

const INITIAL_DEPARTMENTS: Department[] = [
    { id: "dept-1", code: "ENG", name: "Engineering" },
    { id: "dept-2", code: "HR", name: "Human Resources" },
    { id: "dept-3", code: "FIN", name: "Finance" },
    { id: "dept-4", code: "OPS", name: "Operations" },
    { id: "dept-5", code: "MKT", name: "Marketing" },
];

const INITIAL_POSITIONS: Position[] = [
    { id: "pos-1", title: "Software Engineer", departmentId: "dept-1", level: "mid" },
    { id: "pos-2", title: "Senior Engineer", departmentId: "dept-1", level: "senior" },
    { id: "pos-3", title: "Team Lead", departmentId: "dept-1", level: "lead" },
    { id: "pos-4", title: "HR Specialist", departmentId: "dept-2", level: "mid" },
    { id: "pos-5", title: "HR Manager", departmentId: "dept-2", level: "manager" },
    { id: "pos-6", title: "Accountant", departmentId: "dept-3", level: "mid" },
    { id: "pos-7", title: "Finance Manager", departmentId: "dept-3", level: "manager" },
    { id: "pos-8", title: "Operations Analyst", departmentId: "dept-4", level: "junior" },
];

const levelColors: Record<string, string> = {
    junior: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
    mid: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    senior: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    lead: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    manager: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export default function OrganizationPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);

    const { hasPermission } = useRolesStore();
    const canManage = hasPermission(currentUser.role, "settings:organization");

    const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
    const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);

    // Department dialog
    const [deptOpen, setDeptOpen] = useState(false);
    const [editDept, setEditDept] = useState<Department | null>(null);
    const [deptName, setDeptName] = useState("");
    const [deptCode, setDeptCode] = useState("");

    // Position dialog
    const [posOpen, setPosOpen] = useState(false);
    const [editPos, setEditPos] = useState<Position | null>(null);
    const [posTitle, setPosTitle] = useState("");
    const [posDeptId, setPosDeptId] = useState("");
    const [posLevel, setPosLevel] = useState<Position["level"]>("mid");

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <Building2 className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You don&apos;t have access to organization settings.</p>
            </div>
        );
    }

    const getDeptName = (id: string) => departments.find((d) => d.id === id)?.name || id;
    const getEmpCountForDept = (deptId: string) => {
        const deptName = getDeptName(deptId);
        return employees.filter((e) => e.department === deptName && e.status === "active").length;
    };

    const handleSaveDept = () => {
        if (!deptName || !deptCode) { toast.error("Name and code are required"); return; }
        if (editDept) {
            setDepartments((prev) => prev.map((d) => d.id === editDept.id ? { ...d, name: deptName, code: deptCode } : d));
            toast.success("Department updated");
        } else {
            setDepartments((prev) => [...prev, { id: `dept-${Date.now()}`, code: deptCode.toUpperCase(), name: deptName }]);
            toast.success("Department added");
        }
        setDeptOpen(false); setEditDept(null); setDeptName(""); setDeptCode("");
    };

    const handleDeleteDept = (id: string) => {
        setDepartments((prev) => prev.filter((d) => d.id !== id));
        setPositions((prev) => prev.filter((p) => p.departmentId !== id));
        toast.success("Department removed");
    };

    const handleSavePos = () => {
        if (!posTitle || !posDeptId) { toast.error("Title and department are required"); return; }
        if (editPos) {
            setPositions((prev) => prev.map((p) => p.id === editPos.id ? { ...p, title: posTitle, departmentId: posDeptId, level: posLevel } : p));
            toast.success("Position updated");
        } else {
            setPositions((prev) => [...prev, { id: `pos-${Date.now()}`, title: posTitle, departmentId: posDeptId, level: posLevel }]);
            toast.success("Position added");
        }
        setPosOpen(false); setEditPos(null); setPosTitle(""); setPosDeptId(""); setPosLevel("mid");
    };

    const handleDeletePos = (id: string) => {
        setPositions((prev) => prev.filter((p) => p.id !== id));
        toast.success("Position removed");
    };

    const deptCount = departments.length;
    const posCount = positions.length;
    const activeEmpCount = employees.filter((e) => e.status === "active").length;

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
            </div>
        );
    }

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

            <Tabs defaultValue="departments">
                <TabsList className="w-full overflow-x-auto justify-start">
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
                        <Button size="sm" className="gap-1.5" onClick={() => { setEditDept(null); setDeptName(""); setDeptCode(""); setDeptOpen(true); }}>
                            <Plus className="h-3.5 w-3.5" /> Add Department
                        </Button>
                    </div>
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Code</TableHead>
                                        <TableHead className="text-xs">Name</TableHead>
                                        <TableHead className="text-xs">Positions</TableHead>
                                        <TableHead className="text-xs">Active Employees</TableHead>
                                        <TableHead className="text-xs w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {departments.map((dept) => (
                                        <TableRow key={dept.id}>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-mono text-[10px]">{dept.code}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">{dept.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{positions.filter((p) => p.departmentId === dept.id).length}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{getEmpCountForDept(dept.id)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                        onClick={() => { setEditDept(dept); setDeptName(dept.name); setDeptCode(dept.code); setDeptOpen(true); }}>
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
                        <p className="text-sm text-muted-foreground">{positions.length} positions</p>
                        <Button size="sm" className="gap-1.5" onClick={() => { setEditPos(null); setPosTitle(""); setPosDeptId(""); setPosLevel("mid"); setPosOpen(true); }}>
                            <Plus className="h-3.5 w-3.5" /> Add Position
                        </Button>
                    </div>
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Title</TableHead>
                                        <TableHead className="text-xs">Department</TableHead>
                                        <TableHead className="text-xs">Level</TableHead>
                                        <TableHead className="text-xs w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {positions.map((pos) => (
                                        <TableRow key={pos.id}>
                                            <TableCell className="text-sm font-medium">{pos.title}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{getDeptName(pos.departmentId)}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={`text-[10px] capitalize ${levelColors[pos.level]}`}>{pos.level}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                                        onClick={() => { setEditPos(pos); setPosTitle(pos.title); setPosDeptId(pos.departmentId); setPosLevel(pos.level); setPosOpen(true); }}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                                        onClick={() => handleDeletePos(pos.id)}>
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
                            <label className="text-sm font-medium">Department Name</label>
                            <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Engineering" className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Code</label>
                            <Input value={deptCode} onChange={(e) => setDeptCode(e.target.value.toUpperCase())} placeholder="e.g. ENG" maxLength={5} className="mt-1 font-mono" />
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
                            <label className="text-sm font-medium">Title</label>
                            <Input value={posTitle} onChange={(e) => setPosTitle(e.target.value)} placeholder="e.g. Software Engineer" className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Department</label>
                            <Select value={posDeptId} onValueChange={setPosDeptId}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.filter((d) => d.id).map((d) => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Level</label>
                            <Select value={posLevel} onValueChange={(v) => setPosLevel(v as Position["level"])}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="junior">Junior</SelectItem>
                                    <SelectItem value="mid">Mid</SelectItem>
                                    <SelectItem value="senior">Senior</SelectItem>
                                    <SelectItem value="lead">Lead</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleSavePos} className="w-full">{editPos ? "Save Changes" : "Add Position"}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
