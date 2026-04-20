"use client";

import { useState, useMemo } from "react";
import { useEventsStore } from "@/store/events.store";
import { useRolesStore } from "@/store/roles.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Calendar, Plus, Pencil, Trash2, Clock, CalendarDays, Filter, Video, Users, XCircle, LayoutGrid, Table2 } from "lucide-react";
import { FullScreenCalendar, type CalendarItem, type CalendarItemColor } from "@/components/ui/fullscreen-calendar";
import { format, parseISO, isAfter, isBefore, isToday, startOfDay } from "date-fns";
import { toast } from "sonner";
import type { CalendarEvent } from "@/types";

const typeColors: Record<string, string> = {
    event: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    meeting: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    holiday: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    training: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    deadline: "bg-red-500/15 text-red-700 dark:text-red-400",
    other: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

const typeIcons: Record<string, React.ElementType> = {
    event: CalendarDays,
    meeting: Video,
    holiday: Calendar,
    training: Users,
    deadline: Clock,
    other: CalendarDays,
};

const EVENT_TYPE_COLORS: Record<string, CalendarItemColor> = {
    event: { bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
    meeting: { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
    holiday: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
    training: { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
    deadline: { bg: "bg-red-500/15", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
    other: { bg: "bg-slate-500/15", text: "text-slate-700 dark:text-slate-400", dot: "bg-slate-400" },
};

const eventTypes = ["event", "meeting", "holiday", "training", "deadline", "other"] as const;

export default function EventsPage() {
    const { events, addEvent, updateEvent, removeEvent } = useEventsStore();
    const hasPermission = useRolesStore((s) => s.hasPermission);
    const currentUser = useAuthStore((s) => s.currentUser);
    const canEdit = hasPermission(currentUser.role, "page:events");

    // Dialog state
    const [addOpen, setAddOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

    // Form state
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [type, setType] = useState<string>("event");

    // View state
    const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");

    // Filters
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("upcoming");

    const today = startOfDay(new Date());

    const filteredEvents = useMemo(() => {
        let filtered = [...events];

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter((e) => e.title.toLowerCase().includes(q));
        }

        // Type filter
        if (typeFilter !== "all") {
            filtered = filtered.filter((e) => (e.type || "event") === typeFilter);
        }

        // Tab filter (upcoming vs past)
        filtered = filtered.filter((e) => {
            const eventDate = parseISO(e.date);
            if (activeTab === "upcoming") {
                return isAfter(eventDate, today) || isToday(eventDate);
            } else {
                return isBefore(eventDate, today) && !isToday(eventDate);
            }
        });

        // Sort by date
        filtered.sort((a, b) => {
            const dateA = parseISO(a.date);
            const dateB = parseISO(b.date);
            return activeTab === "upcoming" 
                ? dateA.getTime() - dateB.getTime() 
                : dateB.getTime() - dateA.getTime();
        });

        return filtered;
    }, [events, searchQuery, typeFilter, activeTab, today]);

    const upcomingCount = useMemo(() => {
        return events.filter((e) => {
            const eventDate = parseISO(e.date);
            return isAfter(eventDate, today) || isToday(eventDate);
        }).length;
    }, [events, today]);

    const pastCount = events.length - upcomingCount;

    // Calendar items — ALL events (not filtered by tab)
    const calendarItems: CalendarItem[] = useMemo(() =>
        events
            .filter((e) => {
                if (typeFilter !== "all" && (e.type || "event") !== typeFilter) return false;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    if (!e.title.toLowerCase().includes(q)) return false;
                }
                return true;
            })
            .map((e) => ({
                id: e.id,
                title: e.title,
                date: e.date,
                time: e.time,
                type: e.type || "event",
            })),
        [events, typeFilter, searchQuery],
    );

    const handleCalendarItemClick = (item: CalendarItem) => {
        const event = events.find((e) => e.id === item.id);
        if (event && canEdit) openEdit(event);
    };

    const handleAdd = () => {
        if (!title || !date || !time) {
            toast.error("Please fill in all fields");
            return;
        }
        addEvent({ title, date, time, type });
        setTitle("");
        setDate("");
        setTime("");
        setType("event");
        setAddOpen(false);
        toast.success("Event created successfully");
    };

    const openEdit = (event: CalendarEvent) => {
        setEditEvent(event);
        setTitle(event.title);
        setDate(event.date);
        setTime(event.time);
        setType(event.type || "event");
        setEditOpen(true);
    };

    const handleEdit = () => {
        if (!editEvent || !title || !date || !time) {
            toast.error("Please fill in all fields");
            return;
        }
        updateEvent(editEvent.id, { title, date, time, type });
        setEditEvent(null);
        setTitle("");
        setDate("");
        setTime("");
        setType("event");
        setEditOpen(false);
        toast.success("Event updated successfully");
    };

    const handleDelete = () => {
        if (!deleteId) return;
        removeEvent(deleteId);
        setDeleteId(null);
        toast.success("Event deleted");
    };

    const resetForm = () => {
        setTitle("");
        setDate("");
        setTime("");
        setType("event");
        setEditEvent(null);
    };

    const renderEventRow = (event: CalendarEvent) => {
        const TypeIcon = typeIcons[event.type || "event"] || CalendarDays;
        const eventDate = parseISO(event.date);
        const isUpcoming = isAfter(eventDate, today) || isToday(eventDate);

        return (
            <TableRow key={event.id}>
                <TableCell>
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${typeColors[event.type || "event"]}`}>
                            <TypeIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                                {format(eventDate, "EEEE, MMMM d, yyyy")}
                            </p>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{event.time}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <Badge className={typeColors[event.type || "event"]} variant="secondary">
                        {event.type || "event"}
                    </Badge>
                </TableCell>
                <TableCell>
                    {isToday(eventDate) ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Today</Badge>
                    ) : isUpcoming ? (
                        <span className="text-sm text-muted-foreground">
                            {format(eventDate, "MMM d")}
                        </span>
                    ) : (
                        <span className="text-sm text-muted-foreground">Past</span>
                    )}
                </TableCell>
                {canEdit && (
                    <TableCell>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(event)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => setDeleteId(event.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                )}
            </TableRow>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Events & Meetings</h1>
                    <p className="text-muted-foreground">Manage company events, meetings, and important dates</p>
                </div>
                {canEdit && (
                    <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add Event
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Event</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <Input 
                                        id="title" 
                                        placeholder="Event title" 
                                        value={title} 
                                        onChange={(e) => setTitle(e.target.value)} 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="date">Date</Label>
                                        <Input 
                                            id="date" 
                                            type="date" 
                                            value={date} 
                                            onChange={(e) => setDate(e.target.value)} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="time">Time</Label>
                                        <Input 
                                            id="time" 
                                            type="time" 
                                            value={time} 
                                            onChange={(e) => setTime(e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="type">Type</Label>
                                    <Select value={type} onValueChange={setType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {eventTypes.map((t) => (
                                                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button onClick={handleAdd}>Create Event</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Events</CardDescription>
                        <CardTitle className="text-3xl">{events.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Upcoming</CardDescription>
                        <CardTitle className="text-3xl text-emerald-600">{upcomingCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Past Events</CardDescription>
                        <CardTitle className="text-3xl text-muted-foreground">{pastCount}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filters & Content */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {/* View mode toggle */}
                            <div className="inline-flex -space-x-px rounded-lg shadow-sm shadow-black/5">
                                <Button
                                    variant={viewMode === "calendar" ? "default" : "outline"}
                                    size="sm"
                                    className="rounded-none first:rounded-s-lg last:rounded-e-lg shadow-none text-xs gap-1.5"
                                    onClick={() => setViewMode("calendar")}
                                >
                                    <CalendarDays className="h-3.5 w-3.5" /> Calendar
                                </Button>
                                <Button
                                    variant={viewMode === "list" ? "default" : "outline"}
                                    size="sm"
                                    className="rounded-none first:rounded-s-lg last:rounded-e-lg shadow-none text-xs gap-1.5"
                                    onClick={() => setViewMode("list")}
                                >
                                    <Table2 className="h-3.5 w-3.5" /> List
                                </Button>
                            </div>
                            {viewMode === "list" && (
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                                    <TabsList>
                                        <TabsTrigger value="upcoming">Upcoming ({upcomingCount})</TabsTrigger>
                                        <TabsTrigger value="past">Past ({pastCount})</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Input
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-48"
                                />
                            </div>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[160px]">
                                    <Filter className="h-4 w-4 mr-2 shrink-0" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {eventTypes.map((t) => (
                                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(searchQuery || typeFilter !== "all") && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSearchQuery(""); setTypeFilter("all"); }}
                                    className="h-9 text-xs gap-1"
                                >
                                    <XCircle className="h-3 w-3" /> Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {viewMode === "calendar" ? (
                        <div className="-mx-6 -mb-6">
                            <FullScreenCalendar
                                items={calendarItems}
                                colorMap={EVENT_TYPE_COLORS}
                                onItemClick={handleCalendarItemClick}
                                onDayClick={(date) => {
                                    if (canEdit) {
                                        setDate(format(date, "yyyy-MM-dd"));
                                        setTime("09:00");
                                        setType("event");
                                        setTitle("");
                                        setAddOpen(true);
                                    }
                                }}
                                itemLabel="Events"
                                headerActions={
                                    canEdit ? (
                                        <Button size="sm" className="w-full gap-2 md:w-auto" onClick={() => setAddOpen(true)}>
                                            <Plus className="h-4 w-4" /> New Event
                                        </Button>
                                    ) : undefined
                                }
                            />
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium">No events found</h3>
                            <p className="text-sm text-muted-foreground">
                                {activeTab === "upcoming" 
                                    ? "No upcoming events scheduled" 
                                    : "No past events to display"}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    {canEdit && <TableHead className="w-24">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEvents.map(renderEventRow)}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">Title</Label>
                            <Input 
                                id="edit-title" 
                                placeholder="Event title" 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-date">Date</Label>
                                <Input 
                                    id="edit-date" 
                                    type="date" 
                                    value={date} 
                                    onChange={(e) => setDate(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-time">Time</Label>
                                <Input 
                                    id="edit-time" 
                                    type="time" 
                                    value={time} 
                                    onChange={(e) => setTime(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-type">Type</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventTypes.map((t) => (
                                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this event? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
