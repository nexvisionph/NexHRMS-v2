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
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Camera, MapPin, Search, Calendar } from "lucide-react";
import { LocationResult } from "./location-result";

export function SiteSurveyGallery() {
    const photos = useLocationStore((s) => s.photos);
    const employees = useEmployeesStore((s) => s.employees);
    const [empFilter, setEmpFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [selected, setSelected] = useState<string | null>(null);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

    const filtered = photos.filter((p) => {
        const matchEmp = empFilter === "all" || p.employeeId === empFilter;
        const matchDate = !dateFilter || p.capturedAt.startsWith(dateFilter);
        return matchEmp && matchDate;
    });

    const selectedPhoto = photos.find((p) => p.id === selected);

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
                <span className="text-xs text-muted-foreground ml-auto">
                    {filtered.length} photo{filtered.length !== 1 ? "s" : ""}
                </span>
            </div>

            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No site survey photos found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filtered.map((photo) => (
                        <button
                            key={photo.id}
                            onClick={() => setSelected(photo.id)}
                            className="group relative rounded-lg overflow-hidden border border-border/50 hover:ring-2 ring-primary/50 transition-all aspect-square bg-muted"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={photo.photoDataUrl}
                                alt="Site survey"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                <p className="text-[10px] text-white font-medium truncate">{getEmpName(photo.employeeId)}</p>
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5 text-white/70" />
                                    <span className="text-[9px] text-white/70 font-mono">
                                        {photo.gpsLat.toFixed(4)}, {photo.gpsLng.toFixed(4)}
                                    </span>
                                </div>
                            </div>
                            {photo.geofencePass !== undefined && (
                                <div className="absolute top-1 right-1">
                                    <Badge
                                        className={`text-[8px] px-1 py-0 ${
                                            photo.geofencePass
                                                ? "bg-emerald-500 text-white"
                                                : "bg-red-500 text-white"
                                        }`}
                                    >
                                        {photo.geofencePass ? "IN" : "OUT"}
                                    </Badge>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Photo detail dialog */}
            <Dialog open={!!selectedPhoto} onOpenChange={() => setSelected(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Site Survey Photo
                        </DialogTitle>
                    </DialogHeader>
                    {selectedPhoto && (
                        <div className="space-y-4">
                            <div className="rounded-lg overflow-hidden border border-border/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={selectedPhoto.photoDataUrl}
                                    alt="Site survey detail"
                                    className="w-full object-cover"
                                />
                            </div>
                            <div className="text-sm space-y-1">
                                <p><span className="text-muted-foreground">Employee:</span> {getEmpName(selectedPhoto.employeeId)}</p>
                                <p><span className="text-muted-foreground">Date:</span> {new Date(selectedPhoto.capturedAt).toLocaleString()}</p>
                            </div>
                            <LocationResult
                                lat={selectedPhoto.gpsLat}
                                lng={selectedPhoto.gpsLng}
                                accuracy={selectedPhoto.gpsAccuracyMeters}
                                capturedAt={selectedPhoto.capturedAt}
                                reverseGeoAddress={selectedPhoto.reverseGeoAddress}
                                geofencePass={selectedPhoto.geofencePass}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
