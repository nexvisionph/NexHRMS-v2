"use client";

import { useState, useMemo } from "react";
import { useLocationStore } from "@/store/location.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Calendar, Navigation, Users, Check, ChevronsUpDown } from "lucide-react";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LocationTrail() {
    const pings = useLocationStore((s) => s.pings);
    const employees = useEmployeesStore((s) => s.employees);
    const [empFilter, setEmpFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split("T")[0]);
    const [empOpen, setEmpOpen] = useState(false);

    const activeEmployees = useMemo(
        () => employees.filter((e) => e.id && e.status === "active"),
        [employees]
    );

    const selectedEmployee = activeEmployees.find((e) => e.id === empFilter);
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
                {/* Employee picker — searchable combobox with avatars */}
                <Popover open={empOpen} onOpenChange={setEmpOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={empOpen}
                            className="h-8 min-w-[200px] justify-between text-xs font-normal"
                        >
                            <span className="flex items-center gap-2 overflow-hidden">
                                {selectedEmployee ? (
                                    <>
                                        <Avatar className="h-5 w-5 shrink-0">
                                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                                {getInitials(selectedEmployee.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{selectedEmployee.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="text-muted-foreground">All Employees</span>
                                    </>
                                )}
                            </span>
                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-1" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search employee..." className="h-9 text-sm" />
                            <CommandList>
                                <CommandEmpty>No employee found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        value="all"
                                        onSelect={() => { setEmpFilter("all"); setEmpOpen(false); }}
                                        className="flex items-center gap-2 py-2"
                                    >
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <span className="flex-1 text-sm font-medium">All Employees</span>
                                        {empFilter === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
                                    </CommandItem>
                                </CommandGroup>
                                <CommandGroup heading="Active Employees">
                                    {activeEmployees.map((emp) => (
                                        <CommandItem
                                            key={emp.id}
                                            value={`${emp.name} ${emp.department ?? ""}`}
                                            onSelect={() => { setEmpFilter(emp.id); setEmpOpen(false); }}
                                            className="flex items-center gap-2 py-2"
                                        >
                                            <Avatar className="h-6 w-6 shrink-0">
                                                <AvatarFallback className={cn(
                                                    "text-[9px]",
                                                    empFilter === emp.id ? "bg-primary text-primary-foreground" : "bg-muted"
                                                )}>
                                                    {getInitials(emp.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{emp.name}</p>
                                                {emp.department && (
                                                    <p className="text-[10px] text-muted-foreground truncate">{emp.department}</p>
                                                )}
                                            </div>
                                            {empFilter === emp.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
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
