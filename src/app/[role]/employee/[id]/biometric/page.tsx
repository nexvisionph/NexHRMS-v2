"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const METHODS = ["fingerprint", "face", "palm", "rfid", "pin"] as const;

type EnrollmentRow = {
  id: string;
  employee_id: string;
  method: string;
  enrolled_at: string;
  enrolled_by_employee?: { id: string; name: string; email: string };
  is_active: boolean;
};

export default function EmployeeBiometricPage() {
  const params = useParams();
  const employeeIdParam = params?.id as string;
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const myEmployeeId = useMemo(() => {
    const match = employees.find(
      (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
    );
    return match?.id;
  }, [employees, currentUser]);

  const canView = currentUser?.role === "admin" || currentUser?.role === "hr" || myEmployeeId === employeeIdParam;

  useEffect(() => {
    if (!canView) return;
    loadEnrollments();
  }, [canView, employeeIdParam]);

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/biometric/enrollments/${employeeIdParam}`);
      const data = await res.json();
      setEnrollments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  };

  const statusMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    enrollments.forEach((e) => {
      if (e.is_active) map[e.method] = true;
    });
    return map;
  }, [enrollments]);

  if (!canView) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">You do not have access to this biometric profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Biometric Enrollment</h1>
        <p className="text-sm text-muted-foreground">Review enrollment status for each biometric method</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METHODS.map((method) => {
          const enrolled = !!statusMap[method];
          return (
            <Card key={method} className={enrolled ? "border-emerald-200" : "border-dashed"}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{method.toUpperCase()}</p>
                  <p className="text-lg font-semibold">{enrolled ? "Enrolled" : "Not Enrolled"}</p>
                </div>
                {enrolled ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Enrolled By</TableHead>
                <TableHead>Enrolled At</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading enrollments...</TableCell></TableRow>
              ) : enrollments.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No enrollments found</TableCell></TableRow>
              ) : enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">{enrollment.method.toUpperCase()}</TableCell>
                  <TableCell>{enrollment.enrolled_by_employee?.name || "—"}</TableCell>
                  <TableCell>{new Date(enrollment.enrolled_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={enrollment.is_active ? "text-emerald-600" : "text-muted-foreground"}>
                      {enrollment.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
