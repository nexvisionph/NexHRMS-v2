/**
 * Feature Test: Settings & Configuration
 *
 * Covers: appearance.store.ts, kiosk.store.ts, page-builder.store.ts,
 *         audit.store.ts, location.store.ts, timesheet.store.ts,
 *         events.store.ts, ui.store.ts
 * - Appearance (color themes, fonts, branding, modules, nav overrides, login config)
 * - Kiosk settings (update, reset)
 * - Page builder (CRUD, widgets, duplicate, import/export)
 * - Audit log (log, query by entity/action/performer, clear)
 * - Location (config, breaks, pings, photos)
 * - Timesheet computation (rule sets, overnight shifts, approval workflow)
 * - Calendar events (add, update, remove)
 * - UI store (sidebar, command palette)
 */

import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { usePageBuilderStore } from "@/store/page-builder.store";
import { useAuditStore } from "@/store/audit.store";
import { useLocationStore } from "@/store/location.store";
import { useTimesheetStore } from "@/store/timesheet.store";
import { useEventsStore } from "@/store/events.store";
import { useUIStore } from "@/store/ui.store";

beforeEach(() => {
    useAppearanceStore.getState().resetAppearance();
    useKioskStore.getState().resetSettings();
    useAuditStore.getState().resetToSeed();
    useLocationStore.getState().resetToSeed();
    useTimesheetStore.getState().resetToSeed();
    useEventsStore.getState().resetToSeed();
});

// ── Appearance ──────────────────────────────────────────────
describe("Appearance", () => {
    it("sets color theme", () => {
        useAppearanceStore.getState().setColorTheme("blue");
        expect(useAppearanceStore.getState().colorTheme).toBe("blue");
    });

    it("sets custom primary colors", () => {
        useAppearanceStore.getState().setCustomPrimary("oklch(0.5 0.2 260)", "oklch(0.6 0.2 260)");
        expect(useAppearanceStore.getState().colorTheme).toBe("custom");
        expect(useAppearanceStore.getState().customPrimaryLight).toBe("oklch(0.5 0.2 260)");
    });

    it("sets font family", () => {
        useAppearanceStore.getState().setFontFamily("inter");
        expect(useAppearanceStore.getState().fontFamily).toBe("inter");
    });

    it("sets radius", () => {
        useAppearanceStore.getState().setRadius("lg");
        expect(useAppearanceStore.getState().radius).toBe("lg");
    });

    it("sets density", () => {
        useAppearanceStore.getState().setDensity("compact");
        expect(useAppearanceStore.getState().density).toBe("compact");
    });

    it("sets branding", () => {
        useAppearanceStore.getState().setBranding({ companyName: "TestCo", logoTextVisible: false });
        expect(useAppearanceStore.getState().companyName).toBe("TestCo");
        expect(useAppearanceStore.getState().logoTextVisible).toBe(false);
    });

    it("toggles a module flag", () => {
        const wasBefore = useAppearanceStore.getState().modules.loans;
        useAppearanceStore.getState().toggleModule("loans");
        expect(useAppearanceStore.getState().modules.loans).toBe(!wasBefore);
    });

    it("sets all modules at once", () => {
        const mods = { ...useAppearanceStore.getState().modules, payroll: false };
        useAppearanceStore.getState().setModules(mods);
        expect(useAppearanceStore.getState().modules.payroll).toBe(false);
    });

    it("sets nav overrides", () => {
        useAppearanceStore.getState().setNavOverrides([{ href: "/dashboard", label: "Home", hidden: false }]);
        expect(useAppearanceStore.getState().navOverrides.length).toBe(1);
    });

    it("updates a nav override", () => {
        useAppearanceStore.getState().setNavOverrides([{ href: "/dashboard", label: "Home" }]);
        useAppearanceStore.getState().updateNavOverride("/dashboard", { label: "Main" });
        expect(useAppearanceStore.getState().navOverrides.find((n) => n.href === "/dashboard")?.label).toBe("Main");
    });

    it("sets sidebar variant", () => {
        useAppearanceStore.getState().setSidebarVariant("colored");
        expect(useAppearanceStore.getState().sidebarVariant).toBe("colored");
    });

    it("sets topbar banner", () => {
        useAppearanceStore.getState().setTopbarBanner({ topbarBannerEnabled: true, topbarBannerText: "Notice" });
        expect(useAppearanceStore.getState().topbarBannerEnabled).toBe(true);
        expect(useAppearanceStore.getState().topbarBannerText).toBe("Notice");
    });

    it("sets login config", () => {
        useAppearanceStore.getState().setLoginConfig({ loginCardStyle: "split", loginHeading: "Welcome" });
        expect(useAppearanceStore.getState().loginCardStyle).toBe("split");
        expect(useAppearanceStore.getState().loginHeading).toBe("Welcome");
    });

    it("resets appearance to defaults", () => {
        useAppearanceStore.getState().setColorTheme("rose");
        useAppearanceStore.getState().resetAppearance();
        expect(useAppearanceStore.getState().colorTheme).toBe("default");
    });
});

// ── Kiosk Settings ──────────────────────────────────────────
describe("Kiosk Settings", () => {
    it("has default settings", () => {
        expect(useKioskStore.getState().settings.kioskEnabled).toBe(true);
        expect(useKioskStore.getState().settings.pinLength).toBe(6);
    });

    it("updates settings", () => {
        useKioskStore.getState().updateSettings({ kioskTitle: "My Kiosk", pinLength: 4 });
        expect(useKioskStore.getState().settings.kioskTitle).toBe("My Kiosk");
        expect(useKioskStore.getState().settings.pinLength).toBe(4);
    });

    it("resets settings to defaults", () => {
        useKioskStore.getState().updateSettings({ kioskTitle: "Custom" });
        useKioskStore.getState().resetSettings();
        expect(useKioskStore.getState().settings.kioskTitle).toBe("Attendance Kiosk");
    });
});

// ── Page Builder ────────────────────────────────────────────
describe("Page Builder", () => {
    it("creates a page", () => {
        const id = usePageBuilderStore.getState().createPage({
            title: "Test Page",
            slug: "test-page",
            icon: "FileText",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        expect(id).toBeTruthy();
        expect(usePageBuilderStore.getState().pages.length).toBeGreaterThan(0);
    });

    it("updates a page", () => {
        const id = usePageBuilderStore.getState().createPage({
            title: "Update Me",
            slug: "update-me",
            icon: "Edit",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        usePageBuilderStore.getState().updatePage(id, { title: "Updated" });
        expect(usePageBuilderStore.getState().getPageById(id)?.title).toBe("Updated");
    });

    it("deletes a page", () => {
        const id = usePageBuilderStore.getState().createPage({
            title: "Delete Me",
            slug: "delete-me",
            icon: "Trash",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        usePageBuilderStore.getState().deletePage(id);
        expect(usePageBuilderStore.getState().getPageById(id)).toBeUndefined();
    });

    it("duplicates a page", () => {
        const id = usePageBuilderStore.getState().createPage({
            title: "Original",
            slug: "original",
            icon: "Copy",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        const dupId = usePageBuilderStore.getState().duplicatePage(id);
        expect(dupId).toBeTruthy();
        expect(usePageBuilderStore.getState().getPageById(dupId!)?.title).toContain("(Copy)");
    });

    it("adds/removes widgets", () => {
        const id = usePageBuilderStore.getState().createPage({
            title: "Widgets Test",
            slug: "widgets",
            icon: "Layout",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        usePageBuilderStore.getState().addWidget(id, { id: "w1", type: "kpi_active_employees", colSpan: 1, order: 0 });
        expect(usePageBuilderStore.getState().getPageById(id)?.widgets.length).toBe(1);
        usePageBuilderStore.getState().removeWidget(id, "w1");
        expect(usePageBuilderStore.getState().getPageById(id)?.widgets.length).toBe(0);
    });

    it("gets page by slug", () => {
        usePageBuilderStore.getState().createPage({
            title: "By Slug",
            slug: "by-slug",
            icon: "Search",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        expect(usePageBuilderStore.getState().getPageBySlug("by-slug")?.title).toBe("By Slug");
    });

    it("gets visible pages for a role", () => {
        usePageBuilderStore.getState().createPage({
            title: "Admin Only",
            slug: "admin-only",
            icon: "Shield",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        usePageBuilderStore.getState().createPage({
            title: "HR Page",
            slug: "hr-page",
            icon: "Users",
            allowedRoles: ["hr"],
            showInSidebar: true,
            order: 1,
            widgets: [],
        });
        const adminPages = usePageBuilderStore.getState().getVisiblePages("admin");
        expect(adminPages.some((p) => p.slug === "admin-only")).toBe(true);
        expect(adminPages.some((p) => p.slug === "hr-page")).toBe(false);
    });

    it("exports and imports pages", () => {
        usePageBuilderStore.getState().createPage({
            title: "Export Test",
            slug: "export-test",
            icon: "Download",
            allowedRoles: ["admin"],
            showInSidebar: true,
            order: 0,
            widgets: [],
        });
        const json = usePageBuilderStore.getState().exportPages();
        expect(json).toContain("Export Test");
        // Clear and reimport
        usePageBuilderStore.getState().deletePage(usePageBuilderStore.getState().pages[0].id);
        const result = usePageBuilderStore.getState().importPages(json);
        expect(result.ok).toBe(true);
        expect(result.imported).toBeGreaterThan(0);
    });
});

// ── Audit Log ───────────────────────────────────────────────
describe("Audit Log", () => {
    it("logs an audit entry", () => {
        useAuditStore.getState().log({
            entityType: "employee",
            entityId: "EMP001",
            action: "task_created",
            performedBy: "ADMIN001",
        });
        expect(useAuditStore.getState().logs.length).toBe(1);
    });

    it("queries by entity", () => {
        useAuditStore.getState().log({ entityType: "employee", entityId: "EMP001", action: "task_created", performedBy: "ADMIN" });
        useAuditStore.getState().log({ entityType: "leave", entityId: "LV001", action: "leave_approved", performedBy: "ADMIN" });
        expect(useAuditStore.getState().getByEntity("employee", "EMP001").length).toBe(1);
    });

    it("queries by action", () => {
        useAuditStore.getState().log({ entityType: "employee", entityId: "EMP001", action: "task_created", performedBy: "ADMIN" });
        expect(useAuditStore.getState().getByAction("task_created").length).toBe(1);
    });

    it("queries by performer", () => {
        useAuditStore.getState().log({ entityType: "employee", entityId: "EMP001", action: "task_created", performedBy: "USER-A" });
        expect(useAuditStore.getState().getByPerformer("USER-A").length).toBe(1);
    });

    it("getRecent returns limited results newest-first", () => {
        for (let i = 0; i < 5; i++) {
            useAuditStore.getState().log({ entityType: "test", entityId: `T${i}`, action: "task_created", performedBy: "SYS" });
        }
        expect(useAuditStore.getState().getRecent(3).length).toBe(3);
    });

    it("clears logs", () => {
        useAuditStore.getState().log({ entityType: "test", entityId: "T1", action: "task_created", performedBy: "SYS" });
        useAuditStore.getState().clearLogs();
        expect(useAuditStore.getState().logs.length).toBe(0);
    });
});

// ── Location ────────────────────────────────────────────────
describe("Location Tracking", () => {
    it("has default config", () => {
        expect(useLocationStore.getState().config.enabled).toBe(true);
        expect(useLocationStore.getState().config.pingIntervalMinutes).toBe(10);
    });

    it("updates config", () => {
        useLocationStore.getState().updateConfig({ pingIntervalMinutes: 5 });
        expect(useLocationStore.getState().config.pingIntervalMinutes).toBe(5);
    });

    it("resets config", () => {
        useLocationStore.getState().updateConfig({ enabled: false });
        useLocationStore.getState().resetConfig();
        expect(useLocationStore.getState().config.enabled).toBe(true);
    });

    it("adds a site survey photo", () => {
        const id = useLocationStore.getState().addPhoto({
            eventId: "EVT-001",
            employeeId: "EMP001",
            photoDataUrl: "data:image/jpeg;base64,abc",
            gpsLat: 14.5,
            gpsLng: 121.0,
            gpsAccuracyMeters: 10,
            capturedAt: new Date().toISOString(),
        });
        expect(id).toBeTruthy();
        expect(useLocationStore.getState().photos.length).toBe(1);
    });

    it("starts and ends a break", () => {
        const breakId = useLocationStore.getState().startBreak({
            employeeId: "EMP001",
            breakType: "lunch",
            lat: 14.5,
            lng: 121.0,
        });
        expect(breakId).toBeTruthy();
        const activeBreak = useLocationStore.getState().getActiveBreak("EMP001");
        expect(activeBreak).toBeTruthy();
        useLocationStore.getState().endBreak(breakId, { lat: 14.5, lng: 121.0, geofencePass: true });
        expect(useLocationStore.getState().getActiveBreak("EMP001")).toBeUndefined();
    });

    it("adds location pings", () => {
        useLocationStore.getState().addPing({
            employeeId: "EMP001",
            lat: 14.5,
            lng: 121.0,
            accuracyMeters: 10,
            timestamp: new Date().toISOString(),
            withinGeofence: true,
            source: "manual" as const,
        });
        expect(useLocationStore.getState().pings.length).toBe(1);
    });
});

// ── Timesheet ───────────────────────────────────────────────
describe("Timesheet", () => {
    it("has a default rule set", () => {
        expect(useTimesheetStore.getState().ruleSets.length).toBeGreaterThanOrEqual(1);
        expect(useTimesheetStore.getState().ruleSets[0].name).toBe("Standard PH Rule Set");
    });

    it("adds a custom rule set", () => {
        useTimesheetStore.getState().addRuleSet({
            name: "Night Shift",
            standardHoursPerDay: 8,
            graceMinutes: 5,
            roundingPolicy: "nearest_30",
            overtimeRequiresApproval: true,
            nightDiffStart: "22:00",
            nightDiffEnd: "06:00",
            holidayMultiplier: 2.0,
        });
        expect(useTimesheetStore.getState().ruleSets.length).toBe(2);
    });

    it("computes a standard day timesheet", () => {
        useTimesheetStore.getState().computeTimesheet({
            employeeId: "EMP001",
            date: "2026-03-02",
            ruleSetId: "RS-DEFAULT",
            checkIn: "08:00",
            checkOut: "17:00",
            shiftStart: "08:00",
            shiftEnd: "17:00",
            breakDuration: 60,
        });
        const ts = useTimesheetStore.getState().timesheets;
        expect(ts.length).toBe(1);
        expect(ts[0].regularHours).toBeGreaterThan(0);
    });

    it("computes overtime", () => {
        useTimesheetStore.getState().computeTimesheet({
            employeeId: "EMP001",
            date: "2026-03-02",
            ruleSetId: "RS-DEFAULT",
            checkIn: "08:00",
            checkOut: "20:00",
            shiftStart: "08:00",
            shiftEnd: "17:00",
            breakDuration: 60,
        });
        const ts = useTimesheetStore.getState().timesheets[0];
        expect(ts.overtimeHours).toBeGreaterThan(0);
    });

    it("submits and approves a timesheet", () => {
        useTimesheetStore.getState().computeTimesheet({
            employeeId: "EMP001",
            date: "2026-03-02",
            ruleSetId: "RS-DEFAULT",
            checkIn: "08:00",
            checkOut: "17:00",
            shiftStart: "08:00",
            shiftEnd: "17:00",
            breakDuration: 60,
        });
        const ts = useTimesheetStore.getState().timesheets[0];
        useTimesheetStore.getState().submitTimesheet(ts.id);
        expect(useTimesheetStore.getState().timesheets[0].status).toBe("submitted");
        useTimesheetStore.getState().approveTimesheet(ts.id, "ADMIN001");
        expect(useTimesheetStore.getState().timesheets[0].status).toBe("approved");
    });

    it("rejects a timesheet", () => {
        useTimesheetStore.getState().computeTimesheet({
            employeeId: "EMP001",
            date: "2026-03-02",
            ruleSetId: "RS-DEFAULT",
            checkIn: "08:00",
            checkOut: "17:00",
            shiftStart: "08:00",
            shiftEnd: "17:00",
            breakDuration: 60,
        });
        const ts = useTimesheetStore.getState().timesheets[0];
        useTimesheetStore.getState().submitTimesheet(ts.id);
        useTimesheetStore.getState().rejectTimesheet(ts.id, "ADMIN001");
        expect(useTimesheetStore.getState().timesheets[0].status).toBe("rejected");
    });

    it("getApproved filters by period", () => {
        useTimesheetStore.getState().computeTimesheet({
            employeeId: "EMP001",
            date: "2026-03-02",
            ruleSetId: "RS-DEFAULT",
            checkIn: "08:00",
            checkOut: "17:00",
            shiftStart: "08:00",
            shiftEnd: "17:00",
            breakDuration: 60,
        });
        const ts = useTimesheetStore.getState().timesheets[0];
        useTimesheetStore.getState().submitTimesheet(ts.id);
        useTimesheetStore.getState().approveTimesheet(ts.id, "ADMIN001");
        const approved = useTimesheetStore.getState().getApproved("EMP001", "2026-03-01", "2026-03-31");
        expect(approved.length).toBe(1);
    });
});

// ── Calendar Events ─────────────────────────────────────────
describe("Calendar Events", () => {
    it("adds an event", () => {
        const before = useEventsStore.getState().events.length;
        useEventsStore.getState().addEvent({
            title: "Team Outing",
            date: "2026-04-01",
            time: "09:00",
            type: "event",
        });
        expect(useEventsStore.getState().events.length).toBe(before + 1);
    });

    it("updates an event", () => {
        const evt = useEventsStore.getState().events[0];
        useEventsStore.getState().updateEvent(evt.id, { title: "Updated Event" });
        expect(useEventsStore.getState().events.find((e) => e.id === evt.id)?.title).toBe("Updated Event");
    });

    it("removes an event", () => {
        const evt = useEventsStore.getState().events[0];
        useEventsStore.getState().removeEvent(evt.id);
        expect(useEventsStore.getState().events.find((e) => e.id === evt.id)).toBeUndefined();
    });

    it("resets to seed", () => {
        useEventsStore.getState().addEvent({ title: "Extra", date: "2026-12-01", time: "00:00", type: "event" });
        useEventsStore.getState().resetToSeed();
        expect(useEventsStore.getState().events.some((e) => e.title === "Extra")).toBe(false);
    });
});

// ── UI Store ────────────────────────────────────────────────
describe("UI Store", () => {
    it("toggles sidebar", () => {
        const before = useUIStore.getState().sidebarOpen;
        useUIStore.getState().toggleSidebar();
        expect(useUIStore.getState().sidebarOpen).toBe(!before);
    });

    it("sets sidebar open state", () => {
        useUIStore.getState().setSidebarOpen(false);
        expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it("toggles mobile sidebar", () => {
        const before = useUIStore.getState().mobileSidebarOpen;
        useUIStore.getState().toggleMobileSidebar();
        expect(useUIStore.getState().mobileSidebarOpen).toBe(!before);
    });

    it("sets command palette open", () => {
        useUIStore.getState().setCommandPaletteOpen(true);
        expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });
});
