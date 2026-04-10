import type {
    Employee,
    AttendanceLog,
    LeaveRequest,
    Payslip,
    CalendarEvent,
    DemoUser,
    Project,
    Loan,
    TaskGroup,
    Task,
    TaskCompletionReport,
    TaskComment,
    TaskTag,
    Announcement,
    TextChannel,
    ChannelMessage,
} from "@/types";

// ─── Demo Users ──────────────────────────────────────────────
export const DEMO_USERS: DemoUser[] = [
    { id: "U001", name: "Alex Rivera", role: "admin", email: "admin@sdsi.com" },
    { id: "U002", name: "Jordan Lee", role: "hr", email: "hr@sdsi.com" },
    { id: "U003", name: "Morgan Chen", role: "finance", email: "finance@sdsi.com" },
    { id: "U004", name: "Sam Torres", role: "employee", email: "employee@sdsi.com" },
    { id: "U006", name: "Pat Reyes", role: "supervisor", email: "supervisor@sdsi.com" },
    { id: "U007", name: "Dana Cruz", role: "payroll_admin", email: "payroll@sdsi.com" },
    { id: "U008", name: "Rene Santos", role: "auditor", email: "auditor@sdsi.com" },
    { id: "U009", name: "Jamie Reyes", role: "employee", email: "qr@sdsi.com" },
    { id: "U010", name: "Riley Santos", role: "employee", email: "qr2@sdsi.com" },
    // Face recognition test account — dedicated for biometric attendance testing
    { id: "U011", name: "Alex Reyes", role: "employee", email: "face@sdsi.com" },
    // ── Payroll test accounts ─────────────────────────────────
    { id: "U-PAY-001", name: "Maria Santos Cruz", role: "employee", email: "maria.cruz@nexhrms.test" },
    { id: "U-PAY-002", name: "Juan Miguel Reyes", role: "employee", email: "juan.reyes@nexhrms.test" },
    { id: "U-PAY-003", name: "Ana Patricia Villanueva", role: "finance", email: "ana.villanueva@nexhrms.test" },
    { id: "U-PAY-004", name: "Carlo Miguel Gonzales", role: "employee", email: "carlo.gonzales@nexhrms.test" },
    { id: "U-PAY-005", name: "Elena Marie Tan", role: "hr", email: "elena.tan@nexhrms.test" },
    { id: "U-PAY-006", name: "Roberto James Aquino", role: "supervisor", email: "roberto.aquino@nexhrms.test" },
    { id: "U-PAY-007", name: "Lisa Marie Fernandez", role: "employee", email: "lisa.fernandez@nexhrms.test" },
    { id: "U-PAY-008", name: "Mark Anthony Dela Cruz", role: "employee", email: "mark.delacruz@nexhrms.test" },
];

// ─── Employees ───────────────────────────────────────────────
export const SEED_EMPLOYEES: Employee[] = [
    { id: "EMP001", name: "Olivia Harper", email: "olivia@company.com", role: "Frontend Developer", department: "Engineering", status: "active", workType: "HYBRID", salary: 95000, joinDate: "2023-03-15", productivity: 87, location: "New York", phone: "+1-555-0101", birthday: "1994-06-12", teamLeader: "EMP010", pin: "111111", nfcId: "NFC-001" },
    { id: "EMP002", name: "Ethan Brooks", email: "ethan@company.com", role: "Backend Developer", department: "Engineering", status: "active", workType: "WFH", salary: 105000, joinDate: "2022-07-01", productivity: 92, location: "San Francisco", phone: "+1-555-0102", birthday: "1991-11-22", teamLeader: "EMP010", pin: "222222", nfcId: "NFC-002" },
    { id: "EMP003", name: "Sophia Patel", email: "sophia@company.com", role: "UI/UX Designer", department: "Design", status: "active", workType: "WFO", salary: 88000, joinDate: "2023-01-10", productivity: 78, location: "London", phone: "+44-555-0103", birthday: "1996-02-28", teamLeader: "EMP011", pin: "333333", nfcId: "NFC-003" },
    { id: "EMP004", name: "Liam Chen", email: "liam@company.com", role: "DevOps Engineer", department: "Engineering", status: "active", workType: "WFH", salary: 110000, joinDate: "2021-09-20", productivity: 95, location: "Manila", phone: "+63-555-0104", birthday: "1990-08-05", pin: "444444", nfcId: "NFC-004" },
    { id: "EMP005", name: "Ava Martinez", email: "ava@company.com", role: "Product Manager", department: "Engineering", status: "active", workType: "HYBRID", salary: 115000, joinDate: "2022-04-12", productivity: 88, location: "New York", phone: "+1-555-0105", birthday: "1993-12-18", pin: "555555", nfcId: "NFC-005" },
    { id: "EMP006", name: "Noah Williams", email: "noah@company.com", role: "HR Manager", department: "Human Resources", status: "active", workType: "WFO", salary: 92000, joinDate: "2021-01-05", productivity: 84, location: "San Francisco", phone: "+1-555-0106", birthday: "1988-04-30", pin: "123456", nfcId: "NFC-006" },
    { id: "EMP007", name: "Isabella Kim", email: "isabella@company.com", role: "Finance Manager", department: "Finance", status: "active", workType: "WFO", salary: 105000, joinDate: "2020-11-15", productivity: 91, location: "New York", phone: "+1-555-0107", birthday: "1987-09-14", pin: "234567", nfcId: "NFC-007" },
    { id: "EMP008", name: "James Wilson", email: "james@company.com", role: "Marketing Lead", department: "Marketing", status: "active", workType: "HYBRID", salary: 98000, joinDate: "2022-08-23", productivity: 76, location: "London", phone: "+44-555-0108", birthday: "1992-01-07", pin: "345678", nfcId: "NFC-008" },
    { id: "EMP009", name: "Mia Rodriguez", email: "mia@company.com", role: "Sales Executive", department: "Sales", status: "active", workType: "WFO", salary: 82000, joinDate: "2023-05-30", productivity: 81, location: "Manila", phone: "+63-555-0109", birthday: "1995-07-25", teamLeader: "EMP008" },
    { id: "EMP010", name: "Lucas Taylor", email: "lucas@company.com", role: "Frontend Developer", department: "Engineering", status: "active", workType: "WFH", salary: 120000, joinDate: "2020-02-14", productivity: 96, location: "San Francisco", phone: "+1-555-0110", birthday: "1989-03-11" },
    { id: "EMP011", name: "Charlotte Davis", email: "charlotte@company.com", role: "UI/UX Designer", department: "Design", status: "active", workType: "HYBRID", salary: 95000, joinDate: "2021-06-01", productivity: 89, location: "Tokyo", phone: "+81-555-0111", birthday: "1993-10-02" },
    { id: "EMP012", name: "Benjamin Lee", email: "benjamin@company.com", role: "QA Engineer", department: "Engineering", status: "active", workType: "WFO", salary: 85000, joinDate: "2023-02-28", productivity: 73, location: "Singapore", phone: "+65-555-0112", birthday: "1994-05-19" },
    { id: "EMP013", name: "Amelia Nguyen", email: "amelia@company.com", role: "HR Specialist", department: "Human Resources", status: "active", workType: "WFO", salary: 72000, joinDate: "2023-09-15", productivity: 82, location: "Manila", phone: "+63-555-0113", birthday: "1997-08-08" },
    { id: "EMP014", name: "Henry Johnson", email: "henry@company.com", role: "Accountant", department: "Finance", status: "inactive", workType: "WFO", salary: 68000, joinDate: "2021-04-01", productivity: 65, location: "New York", phone: "+1-555-0114", birthday: "1990-12-30" },
    { id: "EMP015", name: "Ella Thompson", email: "ella@company.com", role: "Frontend Developer", department: "Engineering", status: "active", workType: "WFH", salary: 92000, joinDate: "2022-11-20", productivity: 85, location: "London", phone: "+44-555-0115", birthday: "1995-02-14" },
    { id: "EMP016", name: "Alexander Brown", email: "alexander@company.com", role: "Backend Developer", department: "Engineering", status: "active", workType: "HYBRID", salary: 100000, joinDate: "2023-01-05", productivity: 90, location: "San Francisco", phone: "+1-555-0116", birthday: "1991-06-21" },
    { id: "EMP017", name: "Grace Mitchell", email: "grace@company.com", role: "Sales Executive", department: "Sales", status: "active", workType: "WFO", salary: 78000, joinDate: "2023-07-10", productivity: 79, location: "Tokyo", phone: "+81-555-0117", birthday: "1996-11-03" },
    { id: "EMP018", name: "Daniel Garcia", email: "daniel@company.com", role: "DevOps Engineer", department: "Engineering", status: "active", workType: "WFH", salary: 108000, joinDate: "2022-03-18", productivity: 93, location: "Manila", phone: "+63-555-0118", birthday: "1992-04-16" },
    { id: "EMP019", name: "Chloe White", email: "chloe@company.com", role: "Marketing Lead", department: "Marketing", status: "inactive", workType: "HYBRID", salary: 85000, joinDate: "2021-12-01", productivity: 60, location: "Singapore", phone: "+65-555-0119", birthday: "1994-09-28" },
    { id: "EMP020", name: "Jack Anderson", email: "jack@company.com", role: "Product Manager", department: "Engineering", status: "active", workType: "WFO", salary: 112000, joinDate: "2020-08-25", productivity: 94, location: "New York", phone: "+1-555-0120", birthday: "1988-01-15" },
    { id: "EMP021", name: "Zoe Parker", email: "zoe@company.com", role: "Frontend Developer", department: "Engineering", status: "active", workType: "HYBRID", salary: 90000, joinDate: "2023-04-22", productivity: 83, location: "London", phone: "+44-555-0121", birthday: "1996-07-09", teamLeader: "EMP010" },
    { id: "EMP022", name: "Ryan Scott", email: "ryan@company.com", role: "Backend Developer", department: "Engineering", status: "active", workType: "WFH", salary: 102000, joinDate: "2022-09-14", productivity: 88, location: "San Francisco", phone: "+1-555-0122", birthday: "1993-03-27", teamLeader: "EMP010" },
    { id: "EMP023", name: "Luna Adams", email: "luna@company.com", role: "UI/UX Designer", department: "Design", status: "active", workType: "WFO", salary: 82000, joinDate: "2023-06-05", productivity: 77, location: "Tokyo", phone: "+81-555-0123", birthday: "1997-05-14", teamLeader: "EMP011" },
    { id: "EMP024", name: "Leo Campbell", email: "leo@company.com", role: "QA Engineer", department: "Engineering", status: "active", workType: "WFH", salary: 87000, joinDate: "2022-12-10", productivity: 86, location: "Manila", phone: "+63-555-0124", birthday: "1994-10-31" },
    { id: "EMP025", name: "Aria Evans", email: "aria@company.com", role: "HR Specialist", department: "Human Resources", status: "active", workType: "HYBRID", salary: 74000, joinDate: "2023-08-01", productivity: 80, location: "Singapore", phone: "+65-555-0125", birthday: "1995-12-20" },
    // Sam Torres (Employee demo user — face recognition test account)
    { id: "EMP026", name: "Sam Torres", email: "employee@sdsi.com", role: "Frontend Developer", department: "Engineering", status: "active", workType: "WFO", salary: 88000, joinDate: "2024-01-10", productivity: 82, location: "Manila", phone: "+63-917-5550126", birthday: "1995-04-20", teamLeader: "EMP010", profileId: "U004", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-917-5550126", preferredChannel: "in_app", address: "88 Rizal Avenue, Malate, Manila, Metro Manila", emergencyContact: "Maria Torres (Mother) - +63-918-5550001", pin: "262626", nfcId: "NFC-026" },
    // Jamie Reyes (QR demo user 1) — uses QR code at kiosk, no employee PIN
    { id: "EMP027", name: "Jamie Reyes", email: "qr@sdsi.com", role: "Field Technician", department: "Operations", status: "active", workType: "ONSITE", salary: 45000, joinDate: "2025-03-15", productivity: 88, location: "Marikina, Metro Manila", phone: "+63-917-1234567", birthday: "1998-05-22", profileId: "U009", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-917-1234567", preferredChannel: "in_app", address: "123 Shoe Ave, Marikina City, Metro Manila", emergencyContact: "Maria Reyes - +63-918-7654321" },
    // Riley Santos (QR demo user 2) — uses QR code at kiosk, no employee PIN
    { id: "EMP028", name: "Riley Santos", email: "qr2@sdsi.com", role: "Field Technician", department: "Operations", status: "active", workType: "ONSITE", salary: 42000, joinDate: "2025-06-01", productivity: 82, location: "Quezon City, Metro Manila", phone: "+63-918-9876543", birthday: "1999-11-08", profileId: "U010", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-918-9876543", preferredChannel: "in_app", address: "456 Commonwealth Ave, Quezon City, Metro Manila", emergencyContact: "Carlos Santos - +63-919-1112222" },
    // Alex Reyes — dedicated face recognition test account
    { id: "EMP029", name: "Alex Reyes", email: "face@sdsi.com", role: "Security Officer", department: "Operations", status: "active", workType: "ONSITE", salary: 52000, joinDate: "2025-01-15", productivity: 90, location: "Makati, Metro Manila", phone: "+63-917-5550029", birthday: "1993-07-14", profileId: "U011", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-917-5550029", preferredChannel: "in_app", address: "29 Dela Rosa Street, Legazpi Village, Makati City, Metro Manila", emergencyContact: "Rosa Reyes (Mother) - +63-918-5550029", pin: "290290", nfcId: "NFC-029" },
    // ── Payroll test employees ────────────────────────────────
    { id: "EMP-PAYROLL-001", name: "Maria Santos Cruz", email: "maria.cruz@nexhrms.test", role: "employee", jobTitle: "Senior Software Engineer", department: "Engineering", status: "active", workType: "HYBRID", salary: 85000, joinDate: "2023-01-15", productivity: 92, location: "Makati City", phone: "+63 917 555 0001", birthday: "1990-08-15", profileId: "U-PAY-001", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "Unit 1205 The Residences, Ayala Avenue, Makati City 1226", emergencyContact: "Juan Cruz (Husband) - +63 918 555 0001" },
    { id: "EMP-PAYROLL-002", name: "Juan Miguel Reyes", email: "juan.reyes@nexhrms.test", role: "employee", jobTitle: "Full Stack Developer", department: "Engineering", status: "active", workType: "WFH", salary: 65000, joinDate: "2023-06-01", productivity: 88, location: "Quezon City", phone: "+63 918 555 0002", birthday: "1992-03-22", profileId: "U-PAY-002", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "123 Kalayaan Avenue, Diliman, Quezon City 1101", emergencyContact: "Rosa Reyes (Mother) - +63 919 555 0002" },
    { id: "EMP-PAYROLL-003", name: "Ana Patricia Villanueva", email: "ana.villanueva@nexhrms.test", role: "finance", jobTitle: "Senior Accountant", department: "Finance", status: "active", workType: "WFO", salary: 55000, joinDate: "2022-09-15", productivity: 95, location: "Ortigas Center", phone: "+63 917 555 0003", birthday: "1988-11-30", profileId: "U-PAY-003", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "Block 5 Lot 12, Greenwoods Executive Village, Pasig City 1600", emergencyContact: "Pedro Villanueva (Father) - +63 920 555 0003" },
    { id: "EMP-PAYROLL-004", name: "Carlo Miguel Gonzales", email: "carlo.gonzales@nexhrms.test", role: "employee", jobTitle: "Field Technician", department: "Operations", status: "active", workType: "ONSITE", salary: 28000, joinDate: "2024-01-10", productivity: 85, location: "Parañaque City", phone: "+63 919 555 0004", birthday: "1995-05-18", profileId: "U-PAY-004", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "456 Don Bosco Street, BF Homes, Parañaque City 1720", emergencyContact: "Lucia Gonzales (Wife) - +63 921 555 0004" },
    { id: "EMP-PAYROLL-005", name: "Elena Marie Tan", email: "elena.tan@nexhrms.test", role: "hr", jobTitle: "HR Manager", department: "Human Resources", status: "active", workType: "HYBRID", salary: 75000, joinDate: "2021-03-01", productivity: 90, location: "BGC Taguig", phone: "+63 917 555 0005", birthday: "1985-12-08", profileId: "U-PAY-005", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "8th Avenue corner 26th Street, BGC, Taguig City 1634", emergencyContact: "Michael Tan (Brother) - +63 922 555 0005" },
    { id: "EMP-PAYROLL-006", name: "Roberto James Aquino", email: "roberto.aquino@nexhrms.test", role: "supervisor", jobTitle: "Engineering Lead", department: "Engineering", status: "active", workType: "HYBRID", salary: 120000, joinDate: "2020-06-15", productivity: 94, location: "Makati City", phone: "+63 918 555 0006", birthday: "1983-07-25", profileId: "U-PAY-006", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "monthly", preferredChannel: "in_app", address: "Tower 2, Greenbelt Residences, Makati City 1223", emergencyContact: "Cristina Aquino (Wife) - +63 923 555 0006" },
    { id: "EMP-PAYROLL-007", name: "Lisa Marie Fernandez", email: "lisa.fernandez@nexhrms.test", role: "employee", jobTitle: "Marketing Specialist", department: "Marketing", status: "active", workType: "WFH", salary: 45000, joinDate: "2023-11-01", productivity: 82, location: "Cebu City", phone: "+63 917 555 0007", birthday: "1994-09-14", profileId: "U-PAY-007", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "Unit 502 IT Park Tower, Lahug, Cebu City 6000", emergencyContact: "Carmen Fernandez (Mother) - +63 924 555 0007" },
    { id: "EMP-PAYROLL-008", name: "Mark Anthony Dela Cruz", email: "mark.delacruz@nexhrms.test", role: "employee", jobTitle: "Sales Executive", department: "Sales", status: "active", workType: "ONSITE", salary: 35000, joinDate: "2024-03-15", productivity: 78, location: "Alabang", phone: "+63 919 555 0008", birthday: "1996-02-28", profileId: "U-PAY-008", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], payFrequency: "semi_monthly", preferredChannel: "in_app", address: "Phase 3 Block 7, Filinvest Corporate City, Alabang 1781", emergencyContact: "Sandra Dela Cruz (Sister) - +63 925 555 0008" },
];

// ─── Seed Projects ───────────────────────────────────────────
export const SEED_PROJECTS: Project[] = [
    {
        id: "PRJ001",
        name: "Metro Tower Construction",
        description: "High-rise office building construction project in Makati CBD. Uses face recognition for attendance.",
        location: { lat: 14.5547, lng: 121.0244, radius: 200 },
        assignedEmployeeIds: ["EMP001", "EMP002", "EMP004", "EMP026"],
        verificationMethod: "face_only",
        requireGeofence: true,
        createdAt: "2025-11-01T00:00:00Z",
    },
    {
        id: "PRJ002",
        name: "Greenfield Data Center",
        description: "New data center build-out in Clark Freeport Zone.",
        location: { lat: 15.1852, lng: 120.5464, radius: 300 },
        assignedEmployeeIds: ["EMP010", "EMP016", "EMP018"],
        createdAt: "2025-12-15T00:00:00Z",
    },
    {
        id: "PRJ003",
        name: "Client Portal Redesign",
        description: "Remote project — UX redesign for enterprise client portal.",
        location: { lat: 40.7128, lng: -74.006, radius: 500 },
        assignedEmployeeIds: ["EMP003", "EMP011", "EMP023"],
        createdAt: "2026-01-05T00:00:00Z",
    },
    {
        id: "PRJ004",
        name: "Warehouse Automation",
        description: "IoT integration for logistics warehouse in Singapore.",
        location: { lat: 1.3521, lng: 103.8198, radius: 150 },
        assignedEmployeeIds: ["EMP012", "EMP024"],
        createdAt: "2026-01-20T00:00:00Z",
    },
    {
        id: "PRJ005",
        name: "Office HQ – QR Check-in",
        description: "Main office location using QR code attendance verification at the kiosk. Address: Kamagong Street, Industrial Valley, District I, Marikina, Metro Manila",
        location: { lat: 14.6253, lng: 121.0615, radius: 500 },
        assignedEmployeeIds: ["EMP027", "EMP028"],
        verificationMethod: "qr_only",
        createdAt: "2026-02-01T00:00:00Z",
    },
    {
        id: "PRJ006",
        name: "Makati Security Post – Face Check-in",
        description: "Makati CBD security post using face recognition for attendance. Demo account for testing biometric check-in. Address: Dela Rosa Street, Legazpi Village, Makati City.",
        location: { lat: 14.5567, lng: 121.0178, radius: 300 },
        assignedEmployeeIds: ["EMP029"],
        verificationMethod: "face_only",
        requireGeofence: true,
        createdAt: "2026-01-15T00:00:00Z",
    },
];

// ─── Attendance Logs (last 30 days, EXCLUDING today) ─────────
function generateAttendanceLogs(): AttendanceLog[] {
    const logs: AttendanceLog[] = [];
    const today = new Date();
    const statuses: Array<"present" | "absent" | "on_leave"> = ["present", "present", "present", "present", "absent", "on_leave"];

    // Start from d=1 (yesterday) to exclude today's date from seed data
    for (let d = 1; d <= 30; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

        const dateStr = date.toISOString().split("T")[0];

        SEED_EMPLOYEES.filter(e => e.status === "active").forEach((emp) => {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const checkInHour = 7 + Math.floor(Math.random() * 3);
            const checkInMin = Math.floor(Math.random() * 60);
            const hoursWorked = 7 + Math.floor(Math.random() * 3);

            // Compute late minutes: shift starts at 08:00 with 10-min grace → late after 08:10
            let lateMinutes = 0;
            if (status === "present") {
                const checkInTotalMin = checkInHour * 60 + checkInMin;
                const graceEndMin = 8 * 60 + 10; // 08:10
                if (checkInTotalMin > graceEndMin) {
                    lateMinutes = checkInTotalMin - graceEndMin;
                }
            }

            logs.push({
                id: `ATT-${dateStr}-${emp.id}`,
                employeeId: emp.id,
                date: dateStr,
                checkIn: status === "present" ? `${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}` : undefined,
                checkOut: status === "present" ? `${String(checkInHour + hoursWorked).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}` : undefined,
                hours: status === "present" ? hoursWorked : 0,
                lateMinutes: status === "present" ? lateMinutes : 0,
                status,
                createdAt: date.toISOString(),
                updatedAt: date.toISOString(),
            });
        });
    }
    return logs;
}

export const SEED_ATTENDANCE: AttendanceLog[] = generateAttendanceLogs();

// ─── Leave Requests ──────────────────────────────────────────
export const SEED_LEAVES: LeaveRequest[] = [
    { id: "LV001", employeeId: "EMP001", type: "VL", startDate: "2026-02-20", endDate: "2026-02-22", duration: "full_day", reason: "Family vacation planned for the long weekend.", status: "pending" },
    { id: "LV002", employeeId: "EMP003", type: "SL", startDate: "2026-02-10", endDate: "2026-02-11", duration: "full_day", reason: "Not feeling well, need to rest.", status: "approved", reviewedBy: "EMP006", reviewedAt: "2026-02-09" },
    { id: "LV003", employeeId: "EMP005", type: "EL", startDate: "2026-02-15", endDate: "2026-02-15", duration: "full_day", reason: "Family emergency.", status: "approved", reviewedBy: "EMP006", reviewedAt: "2026-02-14" },
    { id: "LV004", employeeId: "EMP009", type: "VL", startDate: "2026-03-01", endDate: "2026-03-05", duration: "full_day", reason: "Planned travel vacation.", status: "pending" },
    { id: "LV005", employeeId: "EMP012", type: "SL", startDate: "2026-02-18", endDate: "2026-02-18", duration: "half_day_am", reason: "Dental appointment.", status: "rejected", reviewedBy: "EMP006", reviewedAt: "2026-02-17" },
    { id: "LV006", employeeId: "EMP015", type: "VL", startDate: "2026-02-25", endDate: "2026-02-28", duration: "full_day", reason: "Personal time off.", status: "pending" },
    { id: "LV007", employeeId: "EMP002", type: "SL", startDate: "2026-01-20", endDate: "2026-01-21", duration: "full_day", reason: "Flu symptoms.", status: "approved", reviewedBy: "EMP006", reviewedAt: "2026-01-19" },
    { id: "LV008", employeeId: "EMP018", type: "OTHER", startDate: "2026-02-14", endDate: "2026-02-14", duration: "half_day_pm", reason: "Conference attendance.", status: "approved", reviewedBy: "EMP006", reviewedAt: "2026-02-12" },
    { id: "LV009", employeeId: "EMP008", type: "ML", startDate: "2026-03-10", endDate: "2026-05-31", duration: "full_day", reason: "Maternity leave (105 days).", status: "approved", reviewedBy: "EMP006", reviewedAt: "2026-03-05" },
    { id: "LV010", employeeId: "EMP011", type: "PL", startDate: "2026-03-10", endDate: "2026-03-16", duration: "full_day", reason: "Paternity leave — newborn.", status: "approved", reviewedBy: "EMP006", reviewedAt: "2026-03-08" },
    { id: "LV011", employeeId: "EMP014", type: "SPL", startDate: "2026-04-01", endDate: "2026-04-07", duration: "full_day", reason: "Solo parent leave.", status: "pending" },
];

// ─── Payslips (based on MONTHLY salary, semi-monthly 1st cutoff Jan 1–15) ────
export const SEED_PAYSLIPS: Payslip[] = [
    { id: "PS001", employeeId: "EMP001", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 47500, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2375, pagibigDeduction: 100, taxDeduction: 14613, otherDeductions: 0, loanDeduction: 0, netPay: 28837, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    { id: "PS002", employeeId: "EMP002", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 52500, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2500, pagibigDeduction: 100, taxDeduction: 17082, otherDeductions: 0, loanDeduction: 0, netPay: 31243, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-22", publishedAt: "2026-01-22" },
    { id: "PS003", employeeId: "EMP003", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 44000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2200, pagibigDeduction: 100, taxDeduction: 12907, otherDeductions: 0, loanDeduction: 0, netPay: 27218, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    { id: "PS004", employeeId: "EMP004", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 55000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2500, pagibigDeduction: 100, taxDeduction: 18332, otherDeductions: 0, loanDeduction: 0, netPay: 32493, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    { id: "PS005", employeeId: "EMP005", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 57500, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2500, pagibigDeduction: 100, taxDeduction: 19582, otherDeductions: 0, loanDeduction: 0, netPay: 33743, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-23", publishedAt: "2026-01-23" },
    { id: "PS006", employeeId: "EMP010", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 60000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2500, pagibigDeduction: 100, taxDeduction: 20832, otherDeductions: 0, loanDeduction: 0, netPay: 34993, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    { id: "PS007", employeeId: "EMP011", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 47500, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2375, pagibigDeduction: 100, taxDeduction: 14613, otherDeductions: 0, loanDeduction: 0, netPay: 28837, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    { id: "PS008", employeeId: "EMP016", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 50000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2500, pagibigDeduction: 100, taxDeduction: 15832, otherDeductions: 0, loanDeduction: 0, netPay: 29993, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP026 — Sam Torres (salary ₱88,000/mo → semi-monthly gross ₱44,000)
    { id: "PS009", employeeId: "EMP026", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 44000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2200, pagibigDeduction: 100, taxDeduction: 12907, otherDeductions: 0, loanDeduction: 0, netPay: 27218, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
];

// ─── Events ──────────────────────────────────────────────────
export const SEED_EVENTS: CalendarEvent[] = [
    { id: "EVT001", title: "Team Standup", time: "09:00", date: "2026-04-14", type: "meeting" },
    { id: "EVT002", title: "Sprint Review", time: "14:00", date: "2026-04-17", type: "meeting" },
    { id: "EVT003", title: "Company All-Hands", time: "10:00", date: "2026-04-21", type: "event" },
    { id: "EVT004", title: "Design Workshop", time: "13:00", date: "2026-04-24", type: "event" },
    { id: "EVT005", title: "Q2 Planning", time: "09:30", date: "2026-04-28", type: "meeting" },
    { id: "EVT006", title: "Company Anniversary", time: "18:00", date: "2026-05-15", type: "event" },
    { id: "EVT007", title: "Safety Training", time: "08:00", date: "2026-05-06", type: "training" },
    { id: "EVT008", title: "Q2 Performance Review Deadline", time: "17:00", date: "2026-05-30", type: "deadline" },
];

// ─── Loans ───────────────────────────────────────────────────
export const SEED_LOANS: Loan[] = [
    { id: "LN001", employeeId: "EMP001", type: "cash_advance", amount: 15000, remainingBalance: 10000, monthlyDeduction: 2500, deductionCapPercent: 30, status: "active", approvedBy: "U001", createdAt: "2026-01-15", remarks: "Emergency cash advance" },
    { id: "LN002", employeeId: "EMP004", type: "salary_loan", amount: 50000, remainingBalance: 50000, monthlyDeduction: 5000, deductionCapPercent: 30, status: "active", approvedBy: "U001", createdAt: "2026-02-01", remarks: "Salary loan for housing" },
    { id: "LN003", employeeId: "EMP009", type: "cash_advance", amount: 8000, remainingBalance: 0, monthlyDeduction: 2000, deductionCapPercent: 30, status: "settled", approvedBy: "U001", createdAt: "2025-11-10" },
];

// ─── Task Groups ─────────────────────────────────────────────
export const SEED_TASK_GROUPS: TaskGroup[] = [
    { id: "TG-001", name: "Field Operations", description: "On-site inspections and field tasks for Metro Tower.", projectId: "PRJ001", createdBy: "EMP006", memberEmployeeIds: ["EMP001", "EMP002", "EMP003", "EMP004", "EMP005", "EMP007", "EMP026", "EMP009"], announcementPermission: "group_leads", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TG-002", name: "Office Tasks", description: "Internal office admin and reporting tasks.", createdBy: "EMP006", memberEmployeeIds: ["EMP010", "EMP012", "EMP013", "EMP015", "EMP016", "EMP020", "EMP021", "EMP022", "EMP023", "EMP024", "EMP025", "EMP026"], announcementPermission: "admin_only", createdAt: "2026-01-20T08:00:00Z" },
];

// ─── Tasks ───────────────────────────────────────────────────
export const SEED_TASKS: Task[] = [
    { id: "TSK-001", groupId: "TG-001", title: "Site inspection – Makati", description: "Conduct full site inspection at Metro Tower Makati. Check structural progress and safety compliance.", priority: "high", status: "verified", dueDate: "2026-02-20", assignedTo: ["EMP003"], createdBy: "EMP006", createdAt: "2026-02-15T09:00:00Z", updatedAt: "2026-02-20T16:00:00Z", completionRequired: true, tags: ["inspection", "safety"] },
    { id: "TSK-002", groupId: "TG-001", title: "Delivery to BGC office", description: "Deliver equipment and documents to the BGC satellite office. Get confirmation photo.", priority: "medium", status: "submitted", dueDate: "2026-03-05", assignedTo: ["EMP005"], createdBy: "EMP006", createdAt: "2026-03-01T08:00:00Z", updatedAt: "2026-03-04T14:00:00Z", completionRequired: true, tags: ["delivery"] },
    { id: "TSK-003", groupId: "TG-001", title: "Equipment check – Pasig", description: "Verify all heavy equipment at the Pasig warehouse is operational and accounted for.", priority: "high", status: "in_progress", dueDate: "2026-03-10", assignedTo: ["EMP003", "EMP007"], createdBy: "EMP006", createdAt: "2026-03-02T09:00:00Z", updatedAt: "2026-03-02T09:00:00Z", completionRequired: true, tags: ["equipment"] },
    { id: "TSK-004", groupId: "TG-002", title: "Prepare monthly report", description: "Compile and format the February monthly status report for stakeholder presentation.", priority: "medium", status: "open", dueDate: "2026-03-08", assignedTo: ["EMP010"], createdBy: "EMP006", createdAt: "2026-03-01T08:00:00Z", updatedAt: "2026-03-01T08:00:00Z", completionRequired: false, tags: ["report"] },
    { id: "TSK-005", groupId: "TG-002", title: "Office supply inventory", description: "Count and catalog all office supplies. Update inventory spreadsheet.", priority: "low", status: "open", dueDate: "2026-03-12", assignedTo: ["EMP012", "EMP015"], createdBy: "EMP006", createdAt: "2026-03-03T08:00:00Z", updatedAt: "2026-03-03T08:00:00Z", completionRequired: false, tags: ["inventory"] },
    { id: "TSK-006", groupId: "TG-001", title: "Safety audit – Taguig", description: "Perform full safety audit at the Taguig construction site. Document all findings.", priority: "urgent", status: "rejected", dueDate: "2026-02-28", assignedTo: ["EMP005"], createdBy: "EMP006", createdAt: "2026-02-22T08:00:00Z", updatedAt: "2026-02-27T16:00:00Z", completionRequired: true, tags: ["safety", "audit"] },
];

// Placeholder 1x1 PNG (tiny valid base64 image for seed data)
const PLACEHOLDER_PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

// ─── Task Completion Reports ─────────────────────────────────
export const SEED_COMPLETION_REPORTS: TaskCompletionReport[] = [
    { id: "TCR-001", taskId: "TSK-001", employeeId: "EMP003", photoDataUrl: PLACEHOLDER_PHOTO, gpsLat: 14.5547, gpsLng: 121.0244, gpsAccuracyMeters: 12, reverseGeoAddress: "14.5547°N, 121.0244°E (Makati CBD)", notes: "All structural checks passed. Fire exits clear.", submittedAt: "2026-02-20T15:30:00Z", verifiedBy: "EMP006", verifiedAt: "2026-02-20T16:00:00Z" },
    { id: "TCR-002", taskId: "TSK-002", employeeId: "EMP005", photoDataUrl: PLACEHOLDER_PHOTO, gpsLat: 14.5515, gpsLng: 121.0498, gpsAccuracyMeters: 8, reverseGeoAddress: "14.5515°N, 121.0498°E (BGC, Taguig)", notes: "Delivered to reception. Signed by guard.", submittedAt: "2026-03-04T14:00:00Z" },
    { id: "TCR-003", taskId: "TSK-006", employeeId: "EMP005", photoDataUrl: PLACEHOLDER_PHOTO, gpsLat: 14.5176, gpsLng: 121.0509, gpsAccuracyMeters: 15, reverseGeoAddress: "14.5176°N, 121.0509°E (Taguig)", notes: "Completed safety walkthrough.", submittedAt: "2026-02-27T15:00:00Z", rejectionReason: "Photos are blurry and incomplete. Please redo with higher quality images." },
];

// ─── Task Comments ───────────────────────────────────────────
export const SEED_TASK_COMMENTS: TaskComment[] = [
    { id: "TC-001", taskId: "TSK-001", employeeId: "EMP003", message: "Starting the inspection now. Will focus on floors 8-12 first.", createdAt: "2026-02-20T09:15:00Z" },
    { id: "TC-002", taskId: "TSK-001", employeeId: "EMP006", message: "Great. Make sure to document the fire exit compliance on each floor.", createdAt: "2026-02-20T09:30:00Z" },
    { id: "TC-003", taskId: "TSK-003", employeeId: "EMP007", message: "I'll handle the electrical equipment. Sophia, can you check the heavy machinery?", createdAt: "2026-03-02T10:00:00Z" },
    { id: "TC-004", taskId: "TSK-006", employeeId: "EMP006", message: "Please retake the photos with better lighting. The current ones are not usable for the audit report.", createdAt: "2026-02-27T16:30:00Z" },
];

// ─── Task Tags ───────────────────────────────────────────────
export const SEED_TASK_TAGS: TaskTag[] = [
    { id: "TAG-001", name: "inspection",  color: "#6366f1", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TAG-002", name: "safety",      color: "#ef4444", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TAG-003", name: "delivery",    color: "#f59e0b", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TAG-004", name: "equipment",   color: "#0ea5e9", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TAG-005", name: "report",      color: "#10b981", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TAG-006", name: "inventory",   color: "#8b5cf6", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
    { id: "TAG-007", name: "audit",       color: "#f97316", createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z" },
];

// ─── Text Channels ───────────────────────────────────────────
export const SEED_TEXT_CHANNELS: TextChannel[] = [
    { id: "CH-001", name: "#general", memberEmployeeIds: SEED_EMPLOYEES.filter(e => e.status === "active").map(e => e.id), createdBy: "EMP006", createdAt: "2026-01-01T00:00:00Z", isArchived: false },
    { id: "CH-002", name: "#field-ops", groupId: "TG-001", memberEmployeeIds: ["EMP001", "EMP002", "EMP003", "EMP004", "EMP005", "EMP007", "EMP026", "EMP009"], createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z", isArchived: false },
    { id: "CH-003", name: "#admin-hr", memberEmployeeIds: ["EMP006", "EMP013", "EMP025"], createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z", isArchived: false },
];

// ─── Announcements ───────────────────────────────────────────
export const SEED_ANNOUNCEMENTS: Announcement[] = [
    { id: "ANN-001", subject: "March payslip released", body: "Hi everyone, January semi-monthly payslips have been published. Please log in to Soren Data Solutions to view and sign your payslip. Contact finance if you have any discrepancies.", channel: "email", scope: "all_employees", sentBy: "EMP007", sentAt: "2026-01-22T10:00:00Z", status: "simulated", readBy: ["EMP001", "EMP002", "EMP003"] },
    { id: "ANN-002", subject: "Weather alert: postpone outdoor tasks", body: "Due to Typhoon Signal #2 warning, all outdoor field tasks are postponed until further notice. Stay safe and work from home if possible.", channel: "whatsapp", scope: "task_group", targetGroupId: "TG-001", sentBy: "EMP006", sentAt: "2026-02-18T07:00:00Z", status: "simulated", readBy: ["EMP003", "EMP005"] },
    { id: "ANN-003", subject: "Training schedule update", body: "The leadership training originally scheduled for March 5 has been moved to March 12. Please update your calendars. Venue remains the same — Conference Room B.", channel: "email", scope: "selected_employees", targetEmployeeIds: ["EMP005", "EMP010", "EMP020"], sentBy: "EMP006", sentAt: "2026-03-01T09:00:00Z", status: "simulated", readBy: [] },
    { id: "ANN-004", subject: "Equipment list attached", body: "Please review the attached equipment checklist before proceeding with the Pasig warehouse check. Mark off each item as you verify it.", channel: "in_app", scope: "task_assignees", targetTaskId: "TSK-003", sentBy: "EMP006", sentAt: "2026-03-02T09:30:00Z", status: "simulated", readBy: ["EMP003"] },
    { id: "ANN-005", subject: "Holiday reminder: March 10", body: "Reminder: March 10 (Monday) is a special non-working holiday. Office will be closed. Enjoy the long weekend!", channel: "whatsapp", scope: "all_employees", sentBy: "EMP006", sentAt: "2026-03-05T09:00:00Z", status: "simulated", readBy: [] },
];

// ─── Channel Messages ────────────────────────────────────────
export const SEED_CHANNEL_MESSAGES: ChannelMessage[] = [
    { id: "MSG-001", channelId: "CH-001", employeeId: "EMP006", message: "Good morning everyone! Reminder: town hall meeting at 2pm today.", createdAt: "2026-02-18T08:00:00Z", readBy: ["EMP001", "EMP002", "EMP003", "EMP010"] },
    { id: "MSG-002", channelId: "CH-001", employeeId: "EMP010", message: "Thanks for the reminder! Will the slides be shared beforehand?", createdAt: "2026-02-18T08:15:00Z", readBy: ["EMP006", "EMP001"] },
    { id: "MSG-003", channelId: "CH-001", employeeId: "EMP006", message: "Yes, I'll share them by noon.", createdAt: "2026-02-18T08:20:00Z", readBy: ["EMP010"] },
    { id: "MSG-004", channelId: "CH-002", employeeId: "EMP003", message: "Heading to Makati site now. ETA 30 minutes.", createdAt: "2026-02-20T08:30:00Z", readBy: ["EMP005", "EMP007"] },
    { id: "MSG-005", channelId: "CH-002", employeeId: "EMP005", message: "Copy. I'll be at BGC by 10am for the delivery.", createdAt: "2026-02-20T08:35:00Z", readBy: ["EMP003"] },
    { id: "MSG-006", channelId: "CH-002", employeeId: "EMP007", message: "Can someone bring extra hard hats? We're short 3.", createdAt: "2026-02-20T09:00:00Z", readBy: ["EMP003", "EMP005"] },
    { id: "MSG-007", channelId: "CH-003", employeeId: "EMP006", message: "We need to finalize the new employee onboarding checklist by Friday.", createdAt: "2026-03-01T09:00:00Z", readBy: ["EMP013", "EMP025"] },
    { id: "MSG-008", channelId: "CH-003", employeeId: "EMP013", message: "I've drafted the checklist. Will share it after lunch for review.", createdAt: "2026-03-01T09:15:00Z", readBy: ["EMP006"] },
    { id: "MSG-009", channelId: "CH-001", employeeId: "EMP020", message: "Has anyone reviewed the Q1 targets? Let's discuss in the planning meeting.", createdAt: "2026-03-03T10:00:00Z", readBy: ["EMP006", "EMP010"] },
    { id: "MSG-010", channelId: "CH-002", employeeId: "EMP026", message: "Just arrived on site. All clear here.", createdAt: "2026-03-04T08:00:00Z", readBy: ["EMP003"] },
];
