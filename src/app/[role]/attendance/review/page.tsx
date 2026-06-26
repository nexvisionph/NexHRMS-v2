"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AttendanceReviewPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  const [logs, setLogs] = useState<any[]>([]);
  const [loading] = useState(false);

  useEffect(() => {
    // In a real implementation, this would fetch from /api/attendance/review
    // which joins attendance_logs, attendance_events, and attendance_evidence
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Review</h1>
        <p className="text-muted-foreground mt-2">
          Review mobile GPS and biometric attendance records before payroll integration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Selfie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No records pending review.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.employee_name}</TableCell>
                      <TableCell>{log.date}</TableCell>
                      <TableCell>{log.check_in}</TableCell>
                      <TableCell>{log.check_out}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.source}</Badge>
                      </TableCell>
                      <TableCell>{log.location}</TableCell>
                      <TableCell>{log.distance}m</TableCell>
                      <TableCell>
                        {log.selfie_url ? (
                          <a href={log.selfie_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            View
                          </a>
                        ) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "pending_review" ? "secondary" : "default"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">Review</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
