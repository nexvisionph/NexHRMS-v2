import type { Role, Permission, HolidayType } from "@/types";

// System roles (auth/permission level) - matches Role type
export const SYSTEM_ROLES: readonly Role[] = [
    "admin",
    "hr",
    "finance",
    "employee",
    "supervisor",
    "payroll_admin",
    "auditor",
] as const;

export const DEPARTMENTS = [
    "Engineering",
    "Design",
    "Marketing",
    "Human Resources",
    "Finance",
    "Sales",
    "Operations",
] as const;

export const ROLES = [
    "Frontend Developer",
    "Backend Developer",
    "UI/UX Designer",
    "Product Manager",
    "HR Manager",
    "HR Specialist",
    "Finance Manager",
    "Accountant",
    "Marketing Lead",
    "Sales Executive",
    "DevOps Engineer",
    "QA Engineer",
] as const;

export const LOCATIONS = [
    "New York",
    "San Francisco",
    "London",
    "Manila",
    "Singapore",
    "Tokyo",
] as const;

// ─── GPS & Attendance Thresholds ─────────────────────────────────────────────
export const GPS_CONFIG = {
    /** Maximum acceptable GPS accuracy in meters (reject if locationAccuracyMeters > this) */
    MAX_ACCURACY_METERS: 30,
    /** Default geofence radius in meters */
    DEFAULT_GEOFENCE_RADIUS: 100,
    /** Location timestamp max age in seconds (reject stale readings) */
    MAX_LOCATION_AGE_SECONDS: 20,
} as const;

// ─── PH Holiday Pay Multipliers (DOLE) ───────────────────────────────────────
export const PH_HOLIDAY_MULTIPLIERS = {
    regular_holiday: {
        worked: 2.0,           // 200% – work on regular holiday
        worked_overtime: 2.6,  // 260% – OT on regular holiday
        rest_day: 2.6,         // 260% – RH falls on rest day
        rest_day_overtime: 3.38, // 338% – RH + rest day + OT
        not_worked: 1.0,       // 100% – absent but paid
    },
    special_holiday: {
        worked: 1.3,           // 130% – work on special holiday
        worked_overtime: 1.69, // 169% – OT on special holiday
        rest_day: 1.5,         // 150% – SH falls on rest day
        rest_day_overtime: 1.95, // 195% – SH + rest day + OT
        not_worked: 0,         // 0% – special holiday, not worked = no pay
    },
} as const;

// ─── Philippine National & Special Holidays 2026 ─────────────────────────────
export const DEFAULT_HOLIDAYS: { date: string; name: string; type: HolidayType }[] = [
    { date: "2026-01-01", name: "New Year's Day", type: "regular" },
    { date: "2026-01-28", name: "Chinese New Year", type: "special" },
    { date: "2026-02-25", name: "EDSA People Power Revolution", type: "special" },
    { date: "2026-04-02", name: "Maundy Thursday", type: "regular" },
    { date: "2026-04-03", name: "Good Friday", type: "regular" },
    { date: "2026-04-04", name: "Black Saturday", type: "special" },
    { date: "2026-04-09", name: "Araw ng Kagitingan", type: "regular" },
    { date: "2026-05-01", name: "Labor Day", type: "regular" },
    { date: "2026-06-12", name: "Independence Day", type: "regular" },
    { date: "2026-08-21", name: "Ninoy Aquino Day", type: "special" },
    { date: "2026-08-31", name: "National Heroes Day", type: "regular" },
    { date: "2026-11-01", name: "All Saints Day", type: "special" },
    { date: "2026-11-02", name: "All Souls Day", type: "special" },
    { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2026-12-08", name: "Immaculate Conception", type: "special" },
    { date: "2026-12-24", name: "Christmas Eve", type: "special" },
    { date: "2026-12-25", name: "Christmas Day", type: "regular" },
    { date: "2026-12-30", name: "Rizal Day", type: "regular" },
    { date: "2026-12-31", name: "New Year's Eve", type: "special" },
];

// ─── Policy Snapshot Versions ─────────────────────────────────────────────────
export const POLICY_VERSIONS = {
    taxTable: "2026-TRAIN-v1",
    sss: "2026-SSS-v1",
    philhealth: "2026-PhilHealth-v1",
    pagibig: "2026-PagIBIG-v1",
    holidayList: "2026-DOLE-v1",
    formula: "2026-PH-PAYROLL-v1",
    ruleSet: "RS-DEFAULT-v1",
} as const;

export const NAV_ITEMS: {
    label: string;
    href: string;
    icon: string;
    roles: Role[];
    /** Permission required to see this nav item (used by new permission system) */
    permission?: Permission;
    /** Module flag key — if set, item is hidden when module is disabled */
    moduleFlag?: string;
    /** If true, href is used as-is (not prefixed with role segment) */
    absolute?: boolean;
}[] = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: "LayoutDashboard",
            roles: ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"],
            permission: "page:dashboard",
        },
        {
            label: "Employees",
            href: "/employees/manage",
            icon: "Users",
            roles: ["admin", "hr", "finance", "supervisor", "auditor"],
            permission: "page:employees",
        },
        {
            label: "Projects",
            href: "/projects",
            icon: "FolderKanban",
            roles: ["admin", "hr", "supervisor"],
            permission: "page:projects",
            moduleFlag: "projects",
        },
        {
            label: "Tasks",
            href: "/tasks",
            icon: "ListTodo",
            roles: ["admin", "hr", "supervisor", "employee"],
            permission: "page:tasks",
            moduleFlag: "tasks",
        },
        {
            label: "Messages",
            href: "/messages",
            icon: "MessageSquare",
            roles: ["admin", "hr", "supervisor", "employee"],
            permission: "page:messages",
            moduleFlag: "messages",
        },
        {
            label: "Attendance",
            href: "/attendance",
            icon: "Clock",
            roles: ["admin", "hr", "supervisor", "employee"],
            permission: "page:attendance",
            moduleFlag: "attendance",
        },
        {
            label: "Leave",
            href: "/leave",
            icon: "CalendarOff",
            roles: ["admin", "hr", "supervisor", "employee"],
            permission: "page:leave",
            moduleFlag: "leave",
        },
        {
            label: "Payroll",
            href: "/payroll",
            icon: "Wallet",
            roles: ["admin", "finance", "payroll_admin", "employee"],
            permission: "page:payroll",
            moduleFlag: "payroll",
        },
        {
            label: "Loans",
            href: "/loans",
            icon: "Banknote",
            roles: ["admin", "finance", "payroll_admin"],
            permission: "page:loans",
            moduleFlag: "loans",
        },
        {
            label: "Reports",
            href: "/reports",
            icon: "BarChart3",
            roles: ["admin", "hr", "finance", "payroll_admin", "auditor"],
            permission: "page:reports",
            moduleFlag: "reports",
        },
        {
            label: "Timesheets",
            href: "/timesheets",
            icon: "ClipboardList",
            roles: ["admin", "hr", "supervisor", "payroll_admin"],
            permission: "page:timesheets",
            moduleFlag: "timesheets",
        },
        {
            label: "Shifts",
            href: "/settings/shifts",
            icon: "AlarmClock",
            roles: ["admin", "hr"],
            permission: "settings:shifts",
        },
        {
            label: "Audit Log",
            href: "/audit",
            icon: "FileSearch",
            roles: ["admin", "auditor"],
            permission: "page:audit",
            moduleFlag: "audit",
        },
        {
            label: "Notifications",
            href: "/notifications",
            icon: "Bell",
            roles: ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"],
            permission: "page:notifications",
            moduleFlag: "notifications",
        },
        {
            label: "Kiosk (QR)",
            href: "/kiosk/qr",
            icon: "QrCode",
            roles: ["admin", "hr"],
            permission: "page:kiosk",
            moduleFlag: "kiosk",
            absolute: true,
        },
        {
            label: "Kiosk (Face)",
            href: "/kiosk/face",
            icon: "ScanFace",
            roles: ["admin", "hr"],
            permission: "page:kiosk",
            moduleFlag: "kiosk",
            absolute: true,
        },
        {
            label: "My Profile",
            href: "/profile",
            icon: "UserCircle",
            roles: ["hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"],
            permission: "page:dashboard",
        },
        {
            label: "Face Enrollment",
            href: "/face-enrollment",
            icon: "ScanFace",
            roles: ["employee", "supervisor"],
            permission: "page:attendance",
        },
        {
            label: "Settings",
            href: "/settings",
            icon: "Settings",
            roles: ["admin", "hr"],
            permission: "page:settings",
        },
    ];

export const ROLE_ACCESS: Record<Role, string[]> = {
    admin: [
        "/dashboard",
        "/employees",
        "/projects",
        "/tasks",
        "/messages",
        "/attendance",
        "/leave",
        "/payroll",
        "/loans",
        "/reports",
        "/reports/government",
        "/settings",
        "/settings/shifts",
        "/settings/organization",
        "/settings/roles",
        "/settings/page-builder",
        "/settings/dashboard-builder",
        "/notifications",
        "/timesheets",
        "/audit",
        "/kiosk",
        "/custom",
    ],
    hr: ["/dashboard", "/employees", "/projects", "/tasks", "/messages", "/attendance", "/leave", "/reports", "/notifications", "/timesheets", "/settings/shifts", "/kiosk", "/profile"],
    finance: ["/dashboard", "/payroll", "/loans", "/reports", "/reports/government", "/employees/directory", "/employees/manage", "/notifications", "/profile"],
    employee: ["/dashboard", "/attendance", "/leave", "/payroll", "/tasks", "/messages", "/notifications", "/face-enrollment", "/profile"],
    supervisor: ["/dashboard", "/attendance", "/leave", "/timesheets", "/employees", "/projects", "/tasks", "/messages", "/notifications", "/face-enrollment", "/profile"],
    payroll_admin: ["/dashboard", "/payroll", "/loans", "/reports", "/reports/government", "/timesheets", "/notifications", "/profile"],
    auditor: ["/dashboard", "/audit", "/reports", "/employees", "/notifications", "/profile"],
};

/** Map a URL path to the permission needed to access it */
export const PATH_TO_PERMISSION: Record<string, Permission> = {
    "/dashboard": "page:dashboard",
    "/employees": "page:employees",
    "/employees/manage": "page:employees",
    "/employees/directory": "page:employees",
    "/projects": "page:projects",
    "/tasks": "page:tasks",
    "/messages": "page:messages",
    "/attendance": "page:attendance",
    "/leave": "page:leave",
    "/payroll": "page:payroll",
    "/loans": "page:loans",
    "/reports": "page:reports",
    "/reports/government": "reports:government",
    "/settings": "page:settings",
    "/settings/shifts": "settings:shifts",
    "/settings/organization": "settings:organization",
    "/settings/roles": "settings:roles",
    "/settings/page-builder": "settings:page_builder",
    "/settings/dashboard-builder": "settings:page_builder",
    "/settings/appearance": "settings:organization",
    "/settings/branding": "settings:organization",
    "/settings/modules": "settings:organization",
    "/settings/navigation": "settings:organization",
    "/notifications": "page:notifications",
    "/timesheets": "page:timesheets",
    "/audit": "page:audit",
    "/kiosk": "page:kiosk",
    "/profile": "page:dashboard",
};
