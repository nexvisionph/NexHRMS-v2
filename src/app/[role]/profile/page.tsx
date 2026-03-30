"use client";

import { useState } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatCurrency, formatDate } from "@/lib/format";
import { Mail, MapPin, Phone, Briefcase, Calendar, DollarSign, Heart, Home, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b last:border-0">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

export default function ProfilePage() {
    const employees = useEmployeesStore((s) => s.employees);
    const updateEmployee = useEmployeesStore((s) => s.updateEmployee);
    const currentUser = useAuthStore((s) => s.currentUser);
    const shiftTemplates = useAttendanceStore((s) => s.shiftTemplates);

    const employee = employees.find((e) => e.email === currentUser.email);

    const [editing, setEditing] = useState(false);
    const [phone, setPhone] = useState(employee?.phone || "");
    const [birthday, setBirthday] = useState(employee?.birthday || "");
    const [emergencyContact, setEmergencyContact] = useState(employee?.emergencyContact || "");
    const [address, setAddress] = useState(employee?.address || "");

    if (!employee) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <p className="text-muted-foreground">No employee profile linked to your account.</p>
            </div>
        );
    }

    const shiftName = employee.shiftId
        ? shiftTemplates.find((s) => s.id === employee.shiftId)?.name || "—"
        : "Default";

    const teamLeader = employee.teamLeader
        ? employees.find((e) => e.id === employee.teamLeader)?.name || "—"
        : "—";

    const handleStartEdit = () => {
        setPhone(employee.phone || "");
        setBirthday(employee.birthday || "");
        setEmergencyContact(employee.emergencyContact || "");
        setAddress(employee.address || "");
        setEditing(true);
    };

    const handleCancel = () => {
        setEditing(false);
    };

    const handleSave = () => {
        updateEmployee(employee.id, {
            phone: phone || undefined,
            birthday: birthday || undefined,
            emergencyContact: emergencyContact || undefined,
            address: address || undefined,
        });
        useAuditStore.getState().log({
            entityType: "employee",
            entityId: employee.id,
            action: "adjustment_applied",
            performedBy: currentUser.id,
            reason: "Self-service profile update",
        });
        toast.success("Profile updated successfully!");
        setEditing(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
                <p className="text-sm text-muted-foreground mt-0.5">View and manage your personal information</p>
            </div>

            {/* Header Card */}
            <Card className="border border-border/50">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                                {getInitials(employee.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-2xl font-bold">{employee.name}</h2>
                                <Badge variant="secondary" className={employee.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}>
                                    {employee.status}
                                </Badge>
                                <Badge variant="outline">{employee.workType}</Badge>
                            </div>
                            <p className="text-muted-foreground mt-1">{employee.role} · {employee.department}</p>
                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{employee.email}</span>
                                {employee.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{employee.phone}</span>}
                                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{employee.location}</span>
                            </div>
                        </div>
                        {!editing && (
                            <Button variant="outline" onClick={handleStartEdit} className="shrink-0">
                                Edit Profile
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information (editable) */}
                <Card className="border border-border/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {editing ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Phone</label>
                                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 912 345 6789" className="mt-1 h-8 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Birthday</label>
                                    <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="mt-1 h-8 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Emergency Contact</label>
                                    <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Name / Phone" className="mt-1 h-8 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Address</label>
                                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Home address" className="mt-1 h-8 text-sm" />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button onClick={handleSave} size="sm" className="gap-1.5"><Save className="h-3.5 w-3.5" /> Save</Button>
                                    <Button onClick={handleCancel} size="sm" variant="outline" className="gap-1.5"><X className="h-3.5 w-3.5" /> Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={employee.phone || "—"} />
                                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Birthday" value={employee.birthday ? formatDate(employee.birthday) : "—"} />
                                <InfoRow icon={<Heart className="h-4 w-4" />} label="Emergency Contact" value={employee.emergencyContact || "—"} />
                                <InfoRow icon={<Home className="h-4 w-4" />} label="Address" value={employee.address || "—"} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Employment Details (read-only) */}
                <Card className="border border-border/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Employment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0.5">
                        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Department" value={employee.department} />
                        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Role" value={employee.role} />
                        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Work Type" value={employee.workType} />
                        <InfoRow icon={<Calendar className="h-4 w-4" />} label="Join Date" value={formatDate(employee.joinDate)} />
                        <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Monthly Salary" value={`${formatCurrency(employee.salary)}/mo`} />
                        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Shift" value={shiftName} />
                        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Team Leader" value={teamLeader} />
                        {employee.workDays && (
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Work Days" value={employee.workDays.join(", ")} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
