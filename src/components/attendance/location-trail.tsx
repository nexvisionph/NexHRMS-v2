"use client";

import { useState } from "react";
import { useLocationStore } from "@/store/location.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Calendar, Navigation } from "lucide-react";

export function LocationTrail() {
    const pings = useLocationStore((s) => s.pings);
    const employees = useEmployeesStore((s) => s.employees);
    const [empFilter, setEmpFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split("T")[0]);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

    const filtered = pings
        .filter((p) => {
            const matchEmp = empFilter === "all" || p.employeeId === empFilter;
            const matchDate = !dateFilter || p.timestamp.startsWith(dateFilter);
            return matchEmp && matchDate;
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 200);

    const inFence = filtered.filter((p) => p.withinGeofence).length;
    const outFence = filtered.filter((p) => !p.withinGeofence).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Select value={empFilter} onValueChange={setEmpFilter}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="All Employees" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Employees</SelectItem>
                            {employees.filter((e) => e.id).map((e) => (
                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-[150px] h-8 text-xs"
                    />
                </div>
                <div className="flex items-center gap-2 ml-auto text-xs">
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                        {inFence} in fence
                    </Badge>
                    {outFence > 0 && (
                        <Badge variant="secondary" className="bg-red-500/15 text-red-700 dark:text-red-400 text-[10px]">
                            {outFence} out of fence
                        </Badge>
                    )}
                    <span className="text-muted-foreground">{filtered.length} pings</span>
                </div>
            </div>

            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Time</TableHead>
                                    <TableHead className="text-xs">Employee</TableHead>
                                    <TableHead className="text-xs">Lat / Lng</TableHead>
                                    <TableHead className="text-xs">Accuracy</TableHead>
                                    <TableHead className="text-xs">Geofence</TableHead>
                                    <TableHead className="text-xs">Distance</TableHead>
                                    <TableHead className="text-xs">Source</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12">
                                            <Navigation className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                            <p className="text-sm text-muted-foreground">No location pings for this date</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((ping) => (
                                        <TableRow key={ping.id}>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(ping.timestamp).toLocaleTimeString()}
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">{getEmpName(ping.employeeId)}</TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {ping.lat.toFixed(6)}, {ping.lng.toFixed(6)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                \u00b1{Math.round(ping.accuracyMeters)}m
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] ${
                                                        ping.withinGeofence
                                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                                            : "bg-red-500/15 text-red-700 dark:text-red-400"
                                                    }`}
                                                >
                                                    {ping.withinGeofence ? "IN" : "OUT"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {ping.distanceFromSite !== undefined
                                                    ? ping.distanceFromSite < 1000
                                                        ? `${ping.distanceFromSite}m`
                                                        : `${(ping.distanceFromSite / 1000).toFixed(1)}km`
                                                    : "\u2014"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{ping.source}</Badge>
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
