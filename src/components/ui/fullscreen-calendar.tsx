"use client";

import * as React from "react";
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfToday,
  startOfWeek,
  startOfMonth,
  eachWeekOfInterval,
  isSameWeek,
  getWeek,
  startOfYear,
  endOfYear,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "@/hooks/use-media-query";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CalendarViewMode = "week" | "month" | "year";

export interface CalendarItem {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time?: string;
  status?: string;
  priority?: string;
  type?: string;
}

export interface CalendarItemColor {
  bg: string;
  text: string;
  dot: string;
}

export interface FullScreenCalendarProps {
  items: CalendarItem[];
  /** Map of status/type → color classes. Falls back to default gray */
  colorMap?: Record<string, CalendarItemColor>;
  /** Called when clicking an item on the calendar */
  onItemClick?: (item: CalendarItem) => void;
  /** Called when clicking an empty day to create new */
  onDayClick?: (date: Date) => void;
  /** Render a custom action bar on the right side of the header */
  headerActions?: React.ReactNode;
  /** Label for items (e.g. "Tasks", "Events") */
  itemLabel?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const colStartClasses = [
  "",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
];

const DEFAULT_COLOR: CalendarItemColor = {
  bg: "bg-muted",
  text: "text-muted-foreground",
  dot: "bg-muted-foreground",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Component ──────────────────────────────────────────────────────────────

export function FullScreenCalendar({
  items,
  colorMap = {},
  onItemClick,
  onDayClick,
  headerActions,
  itemLabel = "Items",
}: FullScreenCalendarProps) {
  const today = startOfToday();
  const [selectedDay, setSelectedDay] = React.useState(today);
  const [currentMonth, setCurrentMonth] = React.useState(
    format(today, "MMM-yyyy")
  );
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("month");
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date());
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // ── Navigation ────────────────────────────────────────────

  function navigatePrev() {
    if (viewMode === "year") {
      setCurrentMonth(format(add(firstDayCurrentMonth, { years: -1 }), "MMM-yyyy"));
    } else if (viewMode === "week") {
      setCurrentMonth(format(add(firstDayCurrentMonth, { weeks: -1 }), "MMM-yyyy"));
      setSelectedDay((d) => add(d, { weeks: -1 }));
    } else {
      setCurrentMonth(format(add(firstDayCurrentMonth, { months: -1 }), "MMM-yyyy"));
    }
  }

  function navigateNext() {
    if (viewMode === "year") {
      setCurrentMonth(format(add(firstDayCurrentMonth, { years: 1 }), "MMM-yyyy"));
    } else if (viewMode === "week") {
      setCurrentMonth(format(add(firstDayCurrentMonth, { weeks: 1 }), "MMM-yyyy"));
      setSelectedDay((d) => add(d, { weeks: 1 }));
    } else {
      setCurrentMonth(format(add(firstDayCurrentMonth, { months: 1 }), "MMM-yyyy"));
    }
  }

  function goToToday() {
    setCurrentMonth(format(today, "MMM-yyyy"));
    setSelectedDay(today);
  }

  // ── Item helpers ──────────────────────────────────────────

  function getItemsForDay(day: Date): CalendarItem[] {
    return items.filter((item) => {
      try {
        return isSameDay(new Date(item.date), day);
      } catch {
        return false;
      }
    });
  }

  function getColor(item: CalendarItem): CalendarItemColor {
    const key = item.status || item.type || "";
    return colorMap[key] || DEFAULT_COLOR;
  }

  function handleDayClick(day: Date) {
    setSelectedDay(day);
    if (onDayClick) onDayClick(day);
  }

  // ── Header label ──────────────────────────────────────────

  const headerLabel = React.useMemo(() => {
    if (viewMode === "year") return format(firstDayCurrentMonth, "yyyy");
    if (viewMode === "week") {
      const weekStart = startOfWeek(selectedDay);
      const weekEnd = endOfWeek(selectedDay);
      return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(firstDayCurrentMonth, "MMMM yyyy");
  }, [viewMode, firstDayCurrentMonth, selectedDay]);

  // ─── Selected day panel items ─────────────────────────────

  const selectedDayItems = getItemsForDay(selectedDay);

  return (
    <div className="flex flex-1 flex-col">
      {/* ─── Calendar Header ─────────────────────────────── */}
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0 lg:flex-none">
        <div className="flex flex-auto">
          <div className="flex items-center gap-4">
            <div className="hidden w-20 flex-col items-center justify-center rounded-lg border bg-muted p-0.5 md:flex">
              <h1 className="p-1 text-xs uppercase text-muted-foreground">
                {format(today, "MMM")}
              </h1>
              <div className="flex w-full items-center justify-center rounded-lg border bg-background p-0.5 text-lg font-bold">
                <span>{format(today, "d")}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-foreground">
                {headerLabel}
              </h2>
              <p className="text-sm text-muted-foreground">
                {viewMode === "month" && (
                  <>{format(firstDayCurrentMonth, "MMM d, yyyy")} – {format(endOfMonth(firstDayCurrentMonth), "MMM d, yyyy")}</>
                )}
                {viewMode === "week" && (
                  <>Week {getWeek(selectedDay)}</>
                )}
                {viewMode === "year" && (
                  <>{format(startOfYear(firstDayCurrentMonth), "MMM d")} – {format(endOfYear(firstDayCurrentMonth), "MMM d, yyyy")}</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-4">
          {/* View mode toggle */}
          <div className="inline-flex w-full -space-x-px rounded-lg shadow-sm shadow-black/5 md:w-auto rtl:space-x-reverse">
            {(["week", "month", "year"] as CalendarViewMode[]).map((mode) => (
              <Button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 capitalize text-xs",
                  viewMode === mode && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
                variant={viewMode === mode ? "default" : "outline"}
                size="sm"
              >
                {mode}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          {/* Navigation */}
          <div className="inline-flex w-full -space-x-px rounded-lg shadow-sm shadow-black/5 md:w-auto rtl:space-x-reverse">
            <Button
              onClick={navigatePrev}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Previous"
            >
              <ChevronLeftIcon size={16} strokeWidth={2} />
            </Button>
            <Button
              onClick={goToToday}
              className="w-full rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 md:w-auto text-xs"
              variant="outline"
              size="sm"
            >
              Today
            </Button>
            <Button
              onClick={navigateNext}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Next"
            >
              <ChevronRightIcon size={16} strokeWidth={2} />
            </Button>
          </div>

          {headerActions && (
            <>
              <Separator orientation="vertical" className="hidden h-6 md:block" />
              <Separator orientation="horizontal" className="block w-full md:hidden" />
              {headerActions}
            </>
          )}
        </div>
      </div>

      {/* ─── Calendar Body ───────────────────────────────── */}
      {viewMode === "month" && (
        <MonthView
          firstDayCurrentMonth={firstDayCurrentMonth}
          selectedDay={selectedDay}
          isDesktop={isDesktop}
          items={items}
          getItemsForDay={getItemsForDay}
          getColor={getColor}
          onItemClick={onItemClick}
          onDayClick={handleDayClick}
        />
      )}

      {viewMode === "week" && (
        <WeekView
          selectedDay={selectedDay}
          items={items}
          getItemsForDay={getItemsForDay}
          getColor={getColor}
          onItemClick={onItemClick}
          onDayClick={handleDayClick}
        />
      )}

      {viewMode === "year" && (
        <YearView
          year={firstDayCurrentMonth}
          items={items}
          getItemsForDay={getItemsForDay}
          onMonthClick={(month) => {
            setCurrentMonth(format(month, "MMM-yyyy"));
            setViewMode("month");
          }}
        />
      )}

      {/* ─── Selected Day Panel (Mobile + Desktop bottom) ── */}
      {viewMode !== "year" && (
        <div className="border-t bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold">
              {isToday(selectedDay)
                ? "Today"
                : format(selectedDay, "EEEE, MMM d")}
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {selectedDayItems.length} {selectedDayItems.length === 1 ? itemLabel.replace(/s$/, "") : itemLabel}
            </Badge>
          </div>
          {selectedDayItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No {itemLabel.toLowerCase()} on this day
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDayItems.map((item) => {
                const color = getColor(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                      onItemClick && "cursor-pointer",
                    )}
                    onClick={() => onItemClick?.(item)}
                  >
                    <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", color.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.time && (
                          <span className="text-[10px] text-muted-foreground">{item.time}</span>
                        )}
                        {(item.status || item.type) && (
                          <Badge variant="secondary" className={cn("text-[10px] h-4", color.bg, color.text)}>
                            {item.status || item.type}
                          </Badge>
                        )}
                        {item.priority && (
                          <Badge variant="outline" className="text-[10px] h-4 capitalize">
                            {item.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Month View ─────────────────────────────────────────────────────────────

interface MonthViewProps {
  firstDayCurrentMonth: Date;
  selectedDay: Date;
  isDesktop: boolean;
  items: CalendarItem[];
  getItemsForDay: (day: Date) => CalendarItem[];
  getColor: (item: CalendarItem) => CalendarItemColor;
  onItemClick?: (item: CalendarItem) => void;
  onDayClick: (day: Date) => void;
}

function MonthView({
  firstDayCurrentMonth,
  selectedDay,
  isDesktop,
  getItemsForDay,
  getColor,
  onItemClick,
  onDayClick,
}: MonthViewProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth)),
  });

  return (
    <div className="lg:flex lg:flex-auto lg:flex-col">
      {/* Week Days Header */}
      <div className="grid grid-cols-7 border text-center text-xs font-semibold leading-6 lg:flex-none">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
          <div key={d} className={cn("py-2.5", i < 6 && "border-r")}>{d}</div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="flex text-xs leading-6 lg:flex-auto">
        {/* Desktop grid */}
        <div className="hidden w-full border-x lg:grid lg:grid-cols-7 lg:auto-rows-fr">
          {days.map((day, dayIdx) => {
            const dayItems = getItemsForDay(day);
            return (
              <div
                key={dayIdx}
                onClick={() => onDayClick(day)}
                className={cn(
                  dayIdx === 0 && colStartClasses[getDay(day)],
                  !isEqual(day, selectedDay) &&
                    !isToday(day) &&
                    !isSameMonth(day, firstDayCurrentMonth) &&
                    "bg-accent/50 text-muted-foreground",
                  "relative flex flex-col border-b border-r hover:bg-muted/50 cursor-pointer min-h-[100px] transition-colors",
                  isEqual(day, selectedDay) && "ring-2 ring-primary/30 ring-inset bg-primary/5",
                )}
              >
                <header className="flex items-center justify-between p-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs",
                      isEqual(day, selectedDay) && isToday(day) && "bg-primary text-primary-foreground font-semibold",
                      isEqual(day, selectedDay) && !isToday(day) && "bg-foreground text-background font-semibold",
                      !isEqual(day, selectedDay) && isToday(day) && "bg-primary/10 text-primary font-semibold",
                      !isEqual(day, selectedDay) && !isToday(day) && isSameMonth(day, firstDayCurrentMonth) && "text-foreground",
                      !isEqual(day, selectedDay) && !isToday(day) && !isSameMonth(day, firstDayCurrentMonth) && "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayItems.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{dayItems.length}</Badge>
                  )}
                </header>
                <div className="flex-1 px-2 pb-1.5 space-y-1">
                  {dayItems.slice(0, 2).map((item) => {
                    const color = getColor(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 w-full text-left transition-colors",
                          color.bg, color.text,
                          "hover:opacity-80",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick?.(item);
                        }}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color.dot)} />
                        <span className="truncate text-[10px] font-medium leading-tight">{item.title}</span>
                      </button>
                    );
                  })}
                  {dayItems.length > 2 && (
                    <p className="text-[10px] text-muted-foreground px-1">
                      + {dayItems.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile grid */}
        <div className="isolate grid w-full grid-cols-7 grid-rows-5 border-x lg:hidden">
          {days.map((day, dayIdx) => {
            const dayItems = getItemsForDay(day);
            return (
              <button
                onClick={() => onDayClick(day)}
                key={dayIdx}
                type="button"
                className={cn(
                  "flex h-14 flex-col border-b border-r px-2 py-1.5 hover:bg-muted focus:z-10 transition-colors",
                  isEqual(day, selectedDay) && "bg-primary/5",
                  !isSameMonth(day, firstDayCurrentMonth) && "text-muted-foreground",
                )}
              >
                <time
                  dateTime={format(day, "yyyy-MM-dd")}
                  className={cn(
                    "ml-auto flex size-6 items-center justify-center rounded-full text-xs",
                    isEqual(day, selectedDay) && isToday(day) && "bg-primary text-primary-foreground",
                    isEqual(day, selectedDay) && !isToday(day) && "bg-foreground text-background",
                    !isEqual(day, selectedDay) && isToday(day) && "bg-primary/10 text-primary font-semibold",
                  )}
                >
                  {format(day, "d")}
                </time>
                {dayItems.length > 0 && (
                  <div className="-mx-0.5 mt-auto flex flex-wrap-reverse">
                    {dayItems.slice(0, 3).map((item) => {
                      const color = getColor(item);
                      return (
                        <span
                          key={item.id}
                          className={cn("mx-0.5 mt-0.5 h-1.5 w-1.5 rounded-full", color.dot)}
                        />
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────────────────────

interface WeekViewProps {
  selectedDay: Date;
  items: CalendarItem[];
  getItemsForDay: (day: Date) => CalendarItem[];
  getColor: (item: CalendarItem) => CalendarItemColor;
  onItemClick?: (item: CalendarItem) => void;
  onDayClick: (day: Date) => void;
}

function WeekView({
  selectedDay,
  getItemsForDay,
  getColor,
  onItemClick,
  onDayClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(selectedDay);
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(selectedDay),
  });

  return (
    <div className="flex flex-col flex-1">
      {/* Week header */}
      <div className="grid grid-cols-7 border text-center text-xs font-semibold leading-6">
        {weekDays.map((day, i) => (
          <div key={i} className={cn("py-2.5", i < 6 && "border-r")}>
            <span className="hidden sm:inline">{format(day, "EEE")}</span>
            <span className="sm:hidden">{format(day, "EEEEE")}</span>
            <span className="ml-1">{format(day, "d")}</span>
          </div>
        ))}
      </div>

      {/* Week body */}
      <div className="grid grid-cols-7 flex-1 border-x">
        {weekDays.map((day, i) => {
          const dayItems = getItemsForDay(day);
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={cn(
                "flex flex-col border-b border-r p-2 min-h-[200px] cursor-pointer hover:bg-muted/50 transition-colors",
                isEqual(day, selectedDay) && "ring-2 ring-primary/30 ring-inset bg-primary/5",
                isToday(day) && "bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayItems.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{dayItems.length}</Badge>
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                {dayItems.map((item) => {
                  const color = getColor(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 w-full text-left transition-colors",
                        color.bg, color.text,
                        "hover:opacity-80",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemClick?.(item);
                      }}
                    >
                      <span className="text-[10px] font-medium leading-tight truncate w-full">
                        {item.title}
                      </span>
                      {item.time && (
                        <span className="text-[9px] opacity-70">{item.time}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Year View ──────────────────────────────────────────────────────────────

interface YearViewProps {
  year: Date;
  items: CalendarItem[];
  getItemsForDay: (day: Date) => CalendarItem[];
  onMonthClick: (month: Date) => void;
}

function YearView({ year, items, getItemsForDay, onMonthClick }: YearViewProps) {
  const yearNum = year.getFullYear();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {MONTH_NAMES.map((_, monthIdx) => {
        const monthStart = new Date(yearNum, monthIdx, 1);
        const monthEnd = endOfMonth(monthStart);
        const days = eachDayOfInterval({
          start: startOfWeek(monthStart),
          end: endOfWeek(monthEnd),
        });

        // Count items this month
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const monthItemCount = monthDays.reduce((sum, d) => sum + getItemsForDay(d).length, 0);

        return (
          <button
            key={monthIdx}
            type="button"
            className="rounded-lg border bg-card p-3 text-left hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => onMonthClick(monthStart)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">{format(monthStart, "MMMM")}</h3>
              {monthItemCount > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{monthItemCount}</Badge>
              )}
            </div>
            <div className="grid grid-cols-7 gap-px text-[9px]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-center text-muted-foreground font-medium py-0.5">{d}</span>
              ))}
              {days.map((day, i) => {
                const dayItems = getItemsForDay(day);
                const inMonth = isSameMonth(day, monthStart);
                return (
                  <span
                    key={i}
                    className={cn(
                      "text-center py-0.5 rounded-sm relative",
                      !inMonth && "text-muted-foreground/30",
                      inMonth && isToday(day) && "bg-primary text-primary-foreground font-bold rounded-full",
                      inMonth && dayItems.length > 0 && !isToday(day) && "font-bold text-primary",
                    )}
                  >
                    {format(day, "d")}
                    {inMonth && dayItems.length > 0 && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-2 rounded-full bg-primary" />
                    )}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
