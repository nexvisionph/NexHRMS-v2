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
// All demo accounts use password: demo1234
export const DEMO_USERS: DemoUser[] = [
    // ── System role accounts ──────────────────────────────────
    { id: "U001", name: "Alex Rivera",  role: "admin",         email: "admin@sdsi.com" },
    { id: "U002", name: "Jordan Lee",   role: "hr",            email: "hr@sdsi.com" },
    { id: "U003", name: "Morgan Chen",  role: "finance",       email: "finance@sdsi.com" },
    { id: "U004", name: "Sam Torres",   role: "employee",      email: "employee@sdsi.com" },
    { id: "U006", name: "Pat Reyes",    role: "supervisor",    email: "supervisor@sdsi.com" },
    { id: "U007", name: "Dana Cruz",    role: "payroll_admin", email: "payroll@sdsi.com" },
    { id: "U008", name: "Rene Santos",  role: "auditor",       email: "auditor@sdsi.com" },
    { id: "U009", name: "Jamie Reyes",  role: "employee",      email: "qr@sdsi.com" },
    { id: "U010", name: "Riley Santos", role: "employee",      email: "qr2@sdsi.com" },
    { id: "U011", name: "Alex Reyes",   role: "employee",      email: "face@sdsi.com" },
    // ── Employee test accounts (EMP001-EMP025) — password: demo1234 ──
    { id: "EMP001", name: "Miguel Antonio Santos",   role: "employee", email: "miguel.santos@sdsi.com" },
    { id: "EMP002", name: "Andrea Mae Reyes",        role: "employee", email: "andrea.reyes@sdsi.com" },
    { id: "EMP003", name: "Kevin James Dela Cruz",   role: "employee", email: "kevin.delacruz@sdsi.com" },
    { id: "EMP004", name: "Diana Rose Bautista",     role: "employee", email: "diana.bautista@sdsi.com" },
    { id: "EMP005", name: "Joshua Paul Mendoza",     role: "employee", email: "joshua.mendoza@sdsi.com" },
    { id: "EMP006", name: "Joselito Rafael Cruz",    role: "employee", email: "joselito.cruz@sdsi.com" },
    { id: "EMP007", name: "Camille Joy Garcia",      role: "employee", email: "camille.garcia@sdsi.com" },
    { id: "EMP008", name: "Maricel Grace Padilla",   role: "employee", email: "maricel.padilla@sdsi.com" },
    { id: "EMP009", name: "Melissa Anne Fernandez",  role: "employee", email: "melissa.fernandez@sdsi.com" },
    { id: "EMP010", name: "Bernard Emmanuel Aquino", role: "employee", email: "bernard.aquino@sdsi.com" },
    { id: "EMP011", name: "Antonio Jose Ramos",      role: "employee", email: "antonio.ramos@sdsi.com" },
    { id: "EMP012", name: "Eduardo Felipe Magbanua", role: "employee", email: "eduardo.magbanua@sdsi.com" },
    { id: "EMP013", name: "Cynthia Grace Santiago",  role: "employee", email: "cynthia.santiago@sdsi.com" },
    { id: "EMP014", name: "Ferdinand Mark Cabral",   role: "employee", email: "ferdinand.cabral@sdsi.com" },
    { id: "EMP015", name: "Nora Luz Dizon",          role: "employee", email: "nora.dizon@sdsi.com" },
    { id: "EMP016", name: "Rafael Miguel Torres",    role: "employee", email: "rafael.torres@sdsi.com" },
    { id: "EMP017", name: "Patricia Anne Villanueva",role: "employee", email: "patricia.villanueva@sdsi.com" },
    { id: "EMP018", name: "Ryan Patrick Evangelista",role: "employee", email: "ryan.evangelista@sdsi.com" },
    { id: "EMP019", name: "Emmanuel Rey Santos",     role: "employee", email: "emmanuel.santos@sdsi.com" },
    { id: "EMP020", name: "Rowena Grace Castillo",   role: "employee", email: "rowena.castillo@sdsi.com" },
    { id: "EMP021", name: "Ronaldo James Dizon",     role: "employee", email: "ronaldo.dizon@sdsi.com" },
    { id: "EMP022", name: "Maria Lourdes Pascual",   role: "employee", email: "maria.pascual@sdsi.com" },
    { id: "EMP023", name: "Jerome Carlo Concepcion", role: "employee", email: "jerome.concepcion@sdsi.com" },
    { id: "EMP024", name: "Sheila Marie Ramos",      role: "employee", email: "sheila.ramos@sdsi.com" },
    { id: "EMP025", name: "Alvin Jose Gutierrez",    role: "employee", email: "alvin.gutierrez@sdsi.com" },
];

// ─── Employees ───────────────────────────────────────────────
export const SEED_EMPLOYEES: Employee[] = [
    // ── Engineering ───────────────────────────────────────────
    { id: "EMP001", name: "Miguel Antonio Santos",  email: "miguel.santos@sdsi.com",    role: "employee", jobTitle: "Senior Frontend Engineer",   department: "Engineering",     status: "active",   workType: "HYBRID",  salary: 85000,  joinDate: "2022-03-10", productivity: 91, location: "Makati City, Metro Manila",         phone: "+63-917-501-0001", birthday: "1993-06-15", teamLeader: "EMP003", profileId: "EMP001", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", biometricId: "FACE-001", address: "Unit 4B Regent Tower, Salcedo St, Legaspi Village, Makati City",   emergencyContact: "Rosa Santos (Mother) – +63-918-501-0001", preferredChannel: "in_app" },
    { id: "EMP002", name: "Andrea Mae Reyes",       email: "andrea.reyes@sdsi.com",     role: "employee", jobTitle: "Backend Developer",           department: "Engineering",     status: "active",   workType: "WFH",     salary: 72000,  joinDate: "2022-08-01", productivity: 88, location: "Quezon City, Metro Manila",         phone: "+63-917-501-0002", birthday: "1995-11-23", teamLeader: "EMP003", profileId: "EMP002", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",                    address: "45 Mabini St, Teachers Village, Quezon City",                    emergencyContact: "Carlos Reyes (Father) – +63-918-501-0002", preferredChannel: "in_app" },
    { id: "EMP003", name: "Kevin James Dela Cruz",  email: "kevin.delacruz@sdsi.com",   role: "employee", jobTitle: "DevOps Engineer",             department: "Engineering",     status: "active",   workType: "HYBRID",  salary: 92000,  joinDate: "2021-05-20", productivity: 93, location: "Pasig City, Metro Manila",          phone: "+63-917-501-0003", birthday: "1991-08-07", profileId: "EMP003", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-003", address: "Blk 12 Lot 4 Green Meadows Ave, Pasig City",                     emergencyContact: "Linda Dela Cruz (Mother) – +63-918-501-0003", preferredChannel: "in_app" },
    { id: "EMP004", name: "Diana Rose Bautista",    email: "diana.bautista@sdsi.com",   role: "employee", jobTitle: "Full Stack Developer",         department: "Engineering",     status: "active",   workType: "WFH",     salary: 68000,  joinDate: "2023-01-09", productivity: 85, location: "Mandaluyong City, Metro Manila",    phone: "+63-917-501-0004", birthday: "1996-04-12", teamLeader: "EMP003", profileId: "EMP004", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  nfcId: "NFC-004",        address: "1503 Wack-Wack Condo, Shaw Blvd, Mandaluyong City",              emergencyContact: "Eduardo Bautista (Father) – +63-918-501-0004", preferredChannel: "in_app" },
    { id: "EMP005", name: "Joshua Paul Mendoza",    email: "joshua.mendoza@sdsi.com",   role: "employee", jobTitle: "QA Engineer",                 department: "Engineering",     status: "active",   workType: "WFO",     salary: 52000,  joinDate: "2023-06-15", productivity: 82, location: "Taguig City, Metro Manila",         phone: "+63-917-501-0005", birthday: "1997-02-28", teamLeader: "EMP003", profileId: "EMP005", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  pin: "050505",           address: "Flat 2A One Bonifacio High St, BGC, Taguig City",                emergencyContact: "Lina Mendoza (Mother) – +63-918-501-0005", preferredChannel: "in_app" },
    { id: "EMP006", name: "Joselito Rafael Cruz",   email: "joselito.cruz@sdsi.com",    role: "employee", jobTitle: "HR Manager",                  department: "Human Resources", status: "active",   workType: "WFO",     salary: 80000,  joinDate: "2021-02-01", productivity: 90, location: "Makati City, Metro Manila",         phone: "+63-917-501-0006", birthday: "1989-03-22", profileId: "EMP006", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-006", address: "8 Jupiter Street, Bel-Air, Makati City",                         emergencyContact: "Carmen Cruz (Wife) – +63-918-501-0006", preferredChannel: "in_app" },
    // ── Design ────────────────────────────────────────────────
    { id: "EMP007", name: "Camille Joy Garcia",     email: "camille.garcia@sdsi.com",   role: "employee", jobTitle: "UI/UX Designer",              department: "Design",          status: "active",   workType: "HYBRID",  salary: 65000,  joinDate: "2022-10-03", productivity: 87, location: "Pasig City, Metro Manila",          phone: "+63-917-501-0007", birthday: "1995-09-18", profileId: "EMP007", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",                    address: "2205 Cityland Pasig, C. Raymundo Ave, Pasig City",               emergencyContact: "Mario Garcia (Father) – +63-918-501-0007", preferredChannel: "in_app" },
    { id: "EMP008", name: "Maricel Grace Padilla",  email: "maricel.padilla@sdsi.com",  role: "employee", jobTitle: "Marketing Manager",           department: "Marketing",       status: "active",   workType: "HYBRID",  salary: 70000,  joinDate: "2021-11-15", productivity: 88, location: "Quezon City, Metro Manila",         phone: "+63-917-501-0008", birthday: "1990-12-05", profileId: "EMP008", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-008", address: "35 Maginhawa St, Teachers Village, Quezon City",                  emergencyContact: "Roberto Padilla (Husband) – +63-918-501-0008", preferredChannel: "in_app" },
    // ── Finance ───────────────────────────────────────────────
    { id: "EMP009", name: "Melissa Anne Fernandez", email: "melissa.fernandez@sdsi.com",role: "employee", jobTitle: "Accountant",                  department: "Finance",         status: "active",   workType: "WFO",     salary: 55000,  joinDate: "2022-07-11", productivity: 89, location: "Ortigas Center, Pasig City",        phone: "+63-917-501-0009", birthday: "1993-05-30", profileId: "EMP009", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  nfcId: "NFC-009",        address: "Tower 1 Robinsons Equitable, Ortigas Center, Pasig City",        emergencyContact: "Pablo Fernandez (Father) – +63-918-501-0009", preferredChannel: "in_app" },
    { id: "EMP010", name: "Bernard Emmanuel Aquino",email: "bernard.aquino@sdsi.com",   role: "employee", jobTitle: "Senior Finance Analyst",      department: "Finance",         status: "active",   workType: "WFO",     salary: 72000,  joinDate: "2020-09-14", productivity: 92, location: "Makati City, Metro Manila",         phone: "+63-917-501-0010", birthday: "1988-07-04", profileId: "EMP010", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-010", address: "Lot 7 Sta. Rosa Street, San Lorenzo Village, Makati City",       emergencyContact: "Gloria Aquino (Wife) – +63-918-501-0010", preferredChannel: "in_app" },
    // ── Human Resources ───────────────────────────────────────
    { id: "EMP011", name: "Antonio Jose Ramos",     email: "antonio.ramos@sdsi.com",    role: "employee", jobTitle: "Recruitment Officer",         department: "Human Resources", status: "active",   workType: "WFO",     salary: 40000,  joinDate: "2023-04-03", productivity: 81, location: "Mandaluyong City, Metro Manila",    phone: "+63-917-501-0011", birthday: "1995-10-17", teamLeader: "EMP006", profileId: "EMP011", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  pin: "111111",           address: "12B Lourdes St, Highway Hills, Mandaluyong City",                emergencyContact: "Nora Ramos (Mother) – +63-918-501-0011", preferredChannel: "in_app" },
    { id: "EMP012", name: "Eduardo Felipe Magbanua",email: "eduardo.magbanua@sdsi.com", role: "employee", jobTitle: "Field Coordinator",           department: "Operations",      status: "active",   workType: "ONSITE",  salary: 38000,  joinDate: "2024-01-15", productivity: 83, location: "Marikina City, Metro Manila",       phone: "+63-917-501-0012", birthday: "1994-03-21", teamLeader: "EMP008", profileId: "EMP012", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",                    address: "7 Shoe Ave, Concepcion Uno, Marikina City",                      emergencyContact: "Fe Magbanua (Wife) – +63-918-501-0012", preferredChannel: "in_app" },
    { id: "EMP013", name: "Cynthia Grace Santiago", email: "cynthia.santiago@sdsi.com", role: "employee", jobTitle: "Admin Assistant",             department: "Human Resources", status: "active",   workType: "WFO",     salary: 28000,  joinDate: "2024-03-01", productivity: 79, location: "Makati City, Metro Manila",         phone: "+63-917-501-0013", birthday: "1998-07-09", teamLeader: "EMP006", profileId: "EMP013", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  nfcId: "NFC-013",        address: "Unit 201 Antel Corporate Centre, Valero St, Makati City",        emergencyContact: "Teresita Santiago (Mother) – +63-918-501-0013", preferredChannel: "in_app" },
    // ── Operations ────────────────────────────────────────────
    { id: "EMP014", name: "Ferdinand Mark Cabral",  email: "ferdinand.cabral@sdsi.com", role: "employee", jobTitle: "Warehouse Lead",              department: "Operations",      status: "active",   workType: "ONSITE",  salary: 35000,  joinDate: "2023-08-22", productivity: 84, location: "Caloocan City, Metro Manila",       phone: "+63-917-501-0014", birthday: "1991-01-14", teamLeader: "EMP008", profileId: "EMP014", workDays: ["Mon","Tue","Wed","Thu","Sat"], payFrequency: "semi_monthly",  pin: "141414",           address: "Blk 4 Lot 9 Gen. San Miguel St, Sangandaan, Caloocan City",      emergencyContact: "Marites Cabral (Wife) – +63-918-501-0014", preferredChannel: "in_app" },
    { id: "EMP015", name: "Nora Luz Dizon",         email: "nora.dizon@sdsi.com",       role: "employee", jobTitle: "Office Clerk",                department: "Operations",      status: "active",   workType: "WFO",     salary: 22000,  joinDate: "2024-06-10", productivity: 76, location: "Malabon City, Metro Manila",        phone: "+63-917-501-0015", birthday: "2000-05-25", teamLeader: "EMP008", profileId: "EMP015", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "bi_weekly",                       address: "123 F. Sevilla Blvd, Longos, Malabon City",                      emergencyContact: "Domingo Dizon (Father) – +63-918-501-0015", preferredChannel: "in_app" },
    // ── Design / Creative ─────────────────────────────────────
    { id: "EMP016", name: "Rafael Miguel Torres",   email: "rafael.torres@sdsi.com",    role: "employee", jobTitle: "Graphic Designer",            department: "Design",          status: "active",   workType: "HYBRID",  salary: 45000,  joinDate: "2023-09-04", productivity: 85, location: "Las Piñas City, Metro Manila",      phone: "+63-917-501-0016", birthday: "1994-11-30", teamLeader: "EMP007", profileId: "EMP016", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  pin: "161616",           address: "22 Marcos Alvarez Ave, Talon Dos, Las Piñas City",               emergencyContact: "Leonora Torres (Mother) – +63-918-501-0016", preferredChannel: "in_app" },
    { id: "EMP017", name: "Patricia Anne Villanueva",email: "patricia.villanueva@sdsi.com",role: "employee", jobTitle: "Junior Frontend Developer",department: "Engineering",     status: "active",   workType: "WFH",     salary: 32000,  joinDate: "2025-01-06", productivity: 77, location: "Parañaque City, Metro Manila",      phone: "+63-917-501-0017", birthday: "2000-09-03", teamLeader: "EMP003", profileId: "EMP017", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",                    address: "10 Moonwalk Rd, BF Homes, Parañaque City",                       emergencyContact: "Vicente Villanueva (Father) – +63-918-501-0017", preferredChannel: "in_app" },
    // ── Marketing ─────────────────────────────────────────────
    { id: "EMP018", name: "Ryan Patrick Evangelista",email: "ryan.evangelista@sdsi.com",role: "employee", jobTitle: "Digital Marketing Specialist",department: "Marketing",       status: "active",   workType: "HYBRID",  salary: 48000,  joinDate: "2023-07-17", productivity: 86, location: "Quezon City, Metro Manila",         phone: "+63-917-501-0018", birthday: "1996-06-14", teamLeader: "EMP008", profileId: "EMP018", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-018", address: "88 Timog Avenue, Sacred Heart, Quezon City",                     emergencyContact: "Rosario Evangelista (Mother) – +63-918-501-0018", preferredChannel: "in_app" },
    // ── Sales ─────────────────────────────────────────────────
    { id: "EMP019", name: "Emmanuel Rey Santos",    email: "emmanuel.santos@sdsi.com",  role: "employee", jobTitle: "Sales Manager",              department: "Sales",           status: "active",   workType: "WFO",     salary: 68000,  joinDate: "2021-07-12", productivity: 91, location: "Makati City, Metro Manila",         phone: "+63-917-501-0019", birthday: "1990-04-02", profileId: "EMP019", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-019", address: "10 Kamagong St, San Antonio Village, Makati City",               emergencyContact: "Elena Santos (Wife) – +63-918-501-0019", preferredChannel: "in_app" },
    { id: "EMP020", name: "Rowena Grace Castillo",  email: "rowena.castillo@sdsi.com",  role: "employee", jobTitle: "Senior Sales Executive",      department: "Sales",           status: "active",   workType: "WFO",     salary: 52000,  joinDate: "2022-04-25", productivity: 87, location: "Pasay City, Metro Manila",          phone: "+63-917-501-0020", birthday: "1993-08-19", teamLeader: "EMP019", profileId: "EMP020", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  nfcId: "NFC-020",        address: "221 Tramo Street, Pasay City",                                   emergencyContact: "Alfredo Castillo (Father) – +63-918-501-0020", preferredChannel: "in_app" },
    { id: "EMP021", name: "Ronaldo James Dizon",    email: "ronaldo.dizon@sdsi.com",    role: "employee", jobTitle: "Sales Executive",             department: "Sales",           status: "active",   workType: "WFO",     salary: 38000,  joinDate: "2024-02-19", productivity: 80, location: "Caloocan City, Metro Manila",       phone: "+63-917-501-0021", birthday: "1997-12-11", teamLeader: "EMP019", profileId: "EMP021", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",                    address: "156 A. Mabini St, Sangandaan, Caloocan City",                    emergencyContact: "Lydia Dizon (Mother) – +63-918-501-0021", preferredChannel: "in_app" },
    { id: "EMP022", name: "Maria Lourdes Pascual",  email: "maria.pascual@sdsi.com",    role: "employee", jobTitle: "Sales Support Specialist",    department: "Sales",           status: "active",   workType: "WFO",     salary: 30000,  joinDate: "2024-05-06", productivity: 78, location: "Las Piñas City, Metro Manila",      phone: "+63-917-501-0022", birthday: "1999-02-07", teamLeader: "EMP019", profileId: "EMP022", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  pin: "222222",           address: "45 Real St, Pamplona Uno, Las Piñas City",                       emergencyContact: "Renato Pascual (Father) – +63-918-501-0022", preferredChannel: "in_app" },
    // ── IT / Support ──────────────────────────────────────────
    { id: "EMP023", name: "Jerome Carlo Concepcion",email: "jerome.concepcion@sdsi.com",role: "employee", jobTitle: "IT Support Specialist",      department: "Engineering",     status: "active",   workType: "WFO",     salary: 42000,  joinDate: "2023-10-30", productivity: 82, location: "Taguig City, Metro Manila",         phone: "+63-917-501-0023", birthday: "1995-07-26", profileId: "EMP023", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  nfcId: "NFC-023",        address: "Block 3 Phase 2 Western Bicutan, Taguig City",                   emergencyContact: "Josefa Concepcion (Mother) – +63-918-501-0023", preferredChannel: "in_app" },
    { id: "EMP024", name: "Sheila Marie Ramos",     email: "sheila.ramos@sdsi.com",     role: "employee", jobTitle: "Finance Analyst",             department: "Finance",         status: "active",   workType: "WFO",     salary: 48000,  joinDate: "2023-02-13", productivity: 86, location: "Makati City, Metro Manila",         phone: "+63-917-501-0024", birthday: "1994-10-08", teamLeader: "EMP010", profileId: "EMP024", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",  biometricId: "FACE-024", address: "2108 Dela Rosa St, Legaspi Village, Makati City",                 emergencyContact: "Antonio Ramos (Father) – +63-918-501-0024", preferredChannel: "in_app" },
    { id: "EMP025", name: "Alvin Jose Gutierrez",   email: "alvin.gutierrez@sdsi.com",  role: "employee", jobTitle: "HR Coordinator",              department: "Human Resources", status: "active",   workType: "WFO",     salary: 32000,  joinDate: "2024-08-12", productivity: 77, location: "Quezon City, Metro Manila",         phone: "+63-917-501-0025", birthday: "2000-03-14", teamLeader: "EMP006", profileId: "EMP025", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly",                    address: "89 Batangas St, Sta. Mesa Heights, Quezon City",                 emergencyContact: "Corazon Gutierrez (Mother) – +63-918-501-0025", preferredChannel: "in_app" },
    // ── Demo auth-linked accounts ─────────────────────────────
    // Sam Torres (Employee demo user — face recognition test account)
    { id: "EMP026", name: "Sam Torres", email: "employee@sdsi.com", role: "Frontend Developer", department: "Engineering", status: "active", workType: "WFO", salary: 88000, joinDate: "2024-01-10", productivity: 82, location: "Manila", phone: "+63-917-5550126", birthday: "1995-04-20", teamLeader: "EMP003", profileId: "U004", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-917-5550126", preferredChannel: "in_app", address: "88 Rizal Avenue, Malate, Manila, Metro Manila", emergencyContact: "Maria Torres (Mother) - +63-918-5550001", pin: "262626", nfcId: "NFC-026" },
    // Jamie Reyes (QR demo user 1) — uses QR code at kiosk, no employee PIN
    { id: "EMP027", name: "Jamie Reyes", email: "qr@sdsi.com", role: "Field Technician", department: "Operations", status: "active", workType: "ONSITE", salary: 45000, joinDate: "2025-03-15", productivity: 88, location: "Marikina, Metro Manila", phone: "+63-917-1234567", birthday: "1998-05-22", profileId: "U009", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-917-1234567", preferredChannel: "in_app", address: "123 Shoe Ave, Marikina City, Metro Manila", emergencyContact: "Maria Reyes - +63-918-7654321" },
    // Riley Santos (QR demo user 2) — uses QR code at kiosk, no employee PIN
    { id: "EMP028", name: "Riley Santos", email: "qr2@sdsi.com", role: "Field Technician", department: "Operations", status: "active", workType: "ONSITE", salary: 42000, joinDate: "2025-06-01", productivity: 82, location: "Quezon City, Metro Manila", phone: "+63-918-9876543", birthday: "1999-11-08", profileId: "U010", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-918-9876543", preferredChannel: "in_app", address: "456 Commonwealth Ave, Quezon City, Metro Manila", emergencyContact: "Carlos Santos - +63-919-1112222" },
    // Alex Reyes — dedicated face recognition test account
    { id: "EMP029", name: "Alex Reyes", email: "face@sdsi.com", role: "Security Officer", department: "Operations", status: "active", workType: "ONSITE", salary: 52000, joinDate: "2025-01-15", productivity: 90, location: "Makati, Metro Manila", phone: "+63-917-5550029", birthday: "1993-07-14", profileId: "U011", workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], payFrequency: "semi_monthly", whatsappNumber: "+63-917-5550029", preferredChannel: "in_app", address: "29 Dela Rosa Street, Legazpi Village, Makati City, Metro Manila", emergencyContact: "Rosa Reyes (Mother) - +63-918-5550029", pin: "290290", nfcId: "NFC-029" },
    // ── Demo role accounts — linked to auth users ─────────────
    { id: "EMP-ADMIN",         name: "Alex Rivera",  email: "admin@sdsi.com",      role: "admin",         jobTitle: "System Administrator",    department: "Management",      status: "active", workType: "WFO",    salary: 150000, joinDate: "2020-01-01", productivity: 95, location: "Manila", phone: "+63-917-5550101", birthday: "1985-09-15", profileId: "U001", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app" },
    { id: "EMP-HR",            name: "Jordan Lee",   email: "hr@sdsi.com",         role: "hr",            jobTitle: "HR Director",             department: "Human Resources", status: "active", workType: "WFO",    salary: 95000,  joinDate: "2020-01-01", productivity: 90, location: "Manila", phone: "+63-917-5550102", birthday: "1987-03-20", profileId: "U002", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app" },
    { id: "EMP-FINANCE",       name: "Morgan Chen",  email: "finance@sdsi.com",    role: "finance",       jobTitle: "Finance Manager",         department: "Finance",         status: "active", workType: "WFO",    salary: 100000, joinDate: "2020-01-01", productivity: 92, location: "Manila", phone: "+63-917-5550103", birthday: "1988-07-11", profileId: "U003", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app" },
    { id: "EMP-SUPV",          name: "Pat Reyes",    email: "supervisor@sdsi.com", role: "supervisor",    jobTitle: "Operations Supervisor",   department: "Operations",      status: "active", workType: "HYBRID", salary: 85000,  joinDate: "2021-06-01", productivity: 88, location: "Manila", phone: "+63-917-5550104", birthday: "1989-12-05", profileId: "U006", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app" },
    { id: "EMP-PAYROLL-ADMIN", name: "Dana Cruz",    email: "payroll@sdsi.com",    role: "payroll_admin", jobTitle: "Payroll Administrator",   department: "Finance",         status: "active", workType: "WFO",    salary: 90000,  joinDate: "2021-01-01", productivity: 91, location: "Manila", phone: "+63-917-5550105", birthday: "1990-04-18", profileId: "U007", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app" },
    { id: "EMP-AUDITOR",       name: "Rene Santos",  email: "auditor@sdsi.com",    role: "auditor",       jobTitle: "Internal Auditor",        department: "Management",      status: "active", workType: "WFO",    salary: 88000,  joinDate: "2022-03-01", productivity: 89, location: "Manila", phone: "+63-917-5550106", birthday: "1991-08-22", profileId: "U008", workDays: ["Mon","Tue","Wed","Thu","Fri"], payFrequency: "semi_monthly", preferredChannel: "in_app" },
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
    { id: "LV001", employeeId: "EMP001", type: "VL",  startDate: "2026-02-20", endDate: "2026-02-22", duration: "full_day",    reason: "Family vacation planned for the long weekend.",                                     status: "pending" },
    { id: "LV002", employeeId: "EMP003", type: "SL",  startDate: "2026-02-10", endDate: "2026-02-11", duration: "full_day",    reason: "Not feeling well, need to rest.",                                                   status: "approved",  reviewedBy: "EMP006", reviewedAt: "2026-02-09" },
    { id: "LV003", employeeId: "EMP005", type: "EL",  startDate: "2026-02-15", endDate: "2026-02-15", duration: "full_day",    reason: "Family emergency.",                                                                status: "approved",  reviewedBy: "EMP006", reviewedAt: "2026-02-14" },
    { id: "LV004", employeeId: "EMP009", type: "VL",  startDate: "2026-03-01", endDate: "2026-03-05", duration: "full_day",    reason: "Planned travel vacation.",                                                         status: "pending" },
    { id: "LV005", employeeId: "EMP012", type: "SL",  startDate: "2026-02-18", endDate: "2026-02-18", duration: "half_day_am", reason: "Dental appointment.",                                                               status: "rejected",  reviewedBy: "EMP006", reviewedAt: "2026-02-17" },
    { id: "LV006", employeeId: "EMP015", type: "VL",  startDate: "2026-02-25", endDate: "2026-02-28", duration: "full_day",    reason: "Personal time off.",                                                               status: "pending" },
    { id: "LV007", employeeId: "EMP002", type: "SL",  startDate: "2026-01-20", endDate: "2026-01-21", duration: "full_day",    reason: "Flu symptoms.",                                                                    status: "approved",  reviewedBy: "EMP006", reviewedAt: "2026-01-19" },
    { id: "LV008", employeeId: "EMP018", type: "OTHER",startDate: "2026-02-14", endDate: "2026-02-14", duration: "half_day_pm", reason: "Conference attendance.",                                                           status: "approved",  reviewedBy: "EMP006", reviewedAt: "2026-02-12" },
    // EMP008 (Maricel Padilla, female) — Maternity Leave (105 days)
    { id: "LV009", employeeId: "EMP008", type: "ML",  startDate: "2026-03-10", endDate: "2026-05-31", duration: "full_day",    reason: "Maternity leave (105 days).",                                                      status: "approved",  reviewedBy: "EMP006", reviewedAt: "2026-03-05" },
    // EMP011 (Antonio Ramos, male) — Paternity Leave
    { id: "LV010", employeeId: "EMP011", type: "PL",  startDate: "2026-03-10", endDate: "2026-03-16", duration: "full_day",    reason: "Paternity leave — newborn.",                                                       status: "approved",  reviewedBy: "EMP006", reviewedAt: "2026-03-08" },
    // EMP014 (Ferdinand Cabral) — Solo Parent Leave
    { id: "LV011", employeeId: "EMP014", type: "SPL", startDate: "2026-04-01", endDate: "2026-04-07", duration: "full_day",    reason: "Solo parent leave.",                                                               status: "pending" },
];

// ─── Payslips (semi-monthly 1st cutoff Jan 1–15, 2026) ──────
// Deductions: SSS max ₱1,575 (salary ≥ ₱34,750), PhilHealth 2.5%, Pag-IBIG ₱100 (capped)
// Tax via BIR TRAIN annual method: annualise gross, subtract deductions, apply annual table, divide by 24
export const SEED_PAYSLIPS: Payslip[] = [
    // EMP001 — Miguel Santos ₱85,000/mo → semi-monthly gross ₱42,500
    { id: "PS001", employeeId: "EMP001", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 42500, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2125, pagibigDeduction: 100, taxDeduction: 7027, otherDeductions: 0, loanDeduction: 0, netPay: 31673, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP002 — Andrea Reyes ₱72,000/mo → semi-monthly gross ₱36,000
    { id: "PS002", employeeId: "EMP002", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 36000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 1800, pagibigDeduction: 100, taxDeduction: 5215, otherDeductions: 0, loanDeduction: 0, netPay: 27310, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-22", publishedAt: "2026-01-22" },
    // EMP003 — Kevin Dela Cruz ₱92,000/mo → semi-monthly gross ₱46,000
    { id: "PS003", employeeId: "EMP003", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 46000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2300, pagibigDeduction: 100, taxDeduction: 8024, otherDeductions: 0, loanDeduction: 0, netPay: 34001, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP004 — Diana Bautista ₱68,000/mo → semi-monthly gross ₱34,000
    { id: "PS004", employeeId: "EMP004", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 34000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 1700, pagibigDeduction: 100, taxDeduction: 4740, otherDeductions: 0, loanDeduction: 0, netPay: 25885, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP005 — Joshua Mendoza ₱52,000/mo → semi-monthly gross ₱26,000
    { id: "PS005", employeeId: "EMP005", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 26000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 1300, pagibigDeduction: 100, taxDeduction: 2840, otherDeductions: 0, loanDeduction: 0, netPay: 20185, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-23", publishedAt: "2026-01-23" },
    // EMP010 — Bernard Aquino ₱72,000/mo → semi-monthly gross ₱36,000
    { id: "PS006", employeeId: "EMP010", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 36000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 1800, pagibigDeduction: 100, taxDeduction: 5215, otherDeductions: 0, loanDeduction: 0, netPay: 27310, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP011 — Antonio Ramos ₱40,000/mo → semi-monthly gross ₱20,000
    { id: "PS007", employeeId: "EMP011", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 20000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 1000, pagibigDeduction: 100, taxDeduction: 1415, otherDeductions: 0, loanDeduction: 0, netPay: 15910, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP016 — Rafael Torres ₱45,000/mo → semi-monthly gross ₱22,500
    { id: "PS008", employeeId: "EMP016", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 22500, allowances: 0, sssDeduction: 1575, philhealthDeduction: 1125, pagibigDeduction: 100, taxDeduction: 2008, otherDeductions: 0, loanDeduction: 0, netPay: 17692, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
    // EMP026 — Sam Torres ₱88,000/mo → semi-monthly gross ₱44,000
    { id: "PS009", employeeId: "EMP026", payFrequency: "semi_monthly", periodStart: "2026-01-01", periodEnd: "2026-01-15", grossPay: 44000, allowances: 0, sssDeduction: 1575, philhealthDeduction: 2200, pagibigDeduction: 100, taxDeduction: 7454, otherDeductions: 0, loanDeduction: 0, netPay: 32671, issuedAt: "2026-01-20", status: "published", confirmedAt: "2026-01-21", publishedAt: "2026-01-22" },
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
    { id: "TC-003", taskId: "TSK-003", employeeId: "EMP007", message: "I'll handle the east side. Kevin, can you verify the heavy machinery on the west wing?", createdAt: "2026-03-02T10:00:00Z" },
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
    { id: "CH-003", name: "#admin-hr", memberEmployeeIds: ["EMP-HR", "EMP006", "EMP013", "EMP025"], createdBy: "EMP006", createdAt: "2026-01-15T08:00:00Z", isArchived: false },
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
