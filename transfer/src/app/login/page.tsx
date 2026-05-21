"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { signIn } from "@/services/auth.service";
import { hydrateAllStores, startWriteThrough, startRealtime } from "@/services/sync.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { DEMO_USERS } from "@/data/seed";

// Set to true to use local demo login (no Supabase required)
const USE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const ROLE_COLORS: Record<string, string> = {
    admin: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    hr: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    finance: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    employee: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    supervisor: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    payroll_admin: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    auditor: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

const getRoleColor = (role: string) => ROLE_COLORS[role] || "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400";
const toRoleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function LoginPage() {
    const router = useRouter();
    const { login: localLogin, setUser } = useAuthStore(
        useShallow((s) => ({ login: s.login, setUser: s.setUser }))
    );
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showEmployeeAccounts, setShowEmployeeAccounts] = useState(false);
    const employees = useEmployeesStore((s) => s.employees);

    const { systemDemoAccounts, employeeDemoAccounts } = useMemo(() => {
        const employeeIds = new Set(employees.map((emp) => emp.id));
        const accounts = DEMO_USERS.filter((u) => !!u.email).map((u) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            email: u.email,
            color: getRoleColor(u.role),
        }));

        return {
            systemDemoAccounts: accounts.filter((acc) => !employeeIds.has(acc.id)),
            employeeDemoAccounts: accounts.filter((acc) => employeeIds.has(acc.id)),
        };
    }, [employees]);

    // Consolidated branding from appearance store
    const {
        loginHeading, loginSubheading, logoUrl, companyName, brandTagline
    } = useAppearanceStore(
        useShallow((s) => ({
            loginHeading: s.loginHeading,
            loginSubheading: s.loginSubheading,
            logoUrl: s.logoUrl,
            companyName: s.companyName,
            brandTagline: s.brandTagline,
        }))
    );

    const handleSupabaseLogin = async (loginEmail: string, loginPassword: string) => {
        setLoading(true);
        try {
            const result = await signIn(loginEmail, loginPassword);
            if (result.ok) {
                // Hydrate Zustand store with Supabase user data
                setUser({
                    id: result.user.id,
                    name: result.user.name,
                    email: result.user.email,
                    role: result.user.role,
                    avatarUrl: result.user.avatarUrl,
                    mustChangePassword: result.user.mustChangePassword,
                    profileComplete: result.user.profileComplete,
                    phone: result.user.phone,
                    department: result.user.department,
                    birthday: result.user.birthday,
                    address: result.user.address,
                    emergencyContact: result.user.emergencyContact,
                });
                useAuthStore.setState({ isAuthenticated: true });
                // Start store hydration NOW — runs in parallel with navigation
                // so data is ready by the time the dashboard mounts
                hydrateAllStores({ skipSessionCheck: true }).then(() => {
                    startWriteThrough();
                    startRealtime();
                });
                toast.success("Welcome back!");
                router.push(`/${result.user.role}/dashboard`);
            } else if (result.error === "deactivated") {
                toast.error("Your account has been deactivated. Please contact your HR administrator.");
                setLoading(false);
                router.push("/deactivated");
            } else {
                toast.error(result.error || "Invalid email or password");
                setLoading(false);
            }
        } catch {
            toast.error("Connection error. Please try again.");
            setLoading(false);
        }
    };

    const handleDemoLogin = (loginEmail: string, loginPassword: string) => {
        setLoading(true);
        // Check employee status before allowing demo login
        const emp = employees.find(
            (e) => e.email?.toLowerCase() === loginEmail.toLowerCase()
        );
        if (emp && (emp.status === "inactive" || emp.status === "resigned")) {
            setLoading(false);
            router.push("/deactivated");
            return;
        }
        const success = localLogin(loginEmail, loginPassword);
        if (success) {
            toast.success("Welcome back!");
            const role = useAuthStore.getState().currentUser.role;
            router.push(`/${role}/dashboard`);
        } else {
            toast.error("Invalid email or password");
        }
        setLoading(false);
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (USE_DEMO_MODE) {
            handleDemoLogin(email, password);
        } else {
            handleSupabaseLogin(email, password);
        }
    };

    const handleQuickLogin = (demoEmail: string) => {
        if (USE_DEMO_MODE) {
            handleDemoLogin(demoEmail, "demo1234");
        } else {
            handleSupabaseLogin(demoEmail, "demo1234");
        }
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Left side: Branding / Decorative (Hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 flex-col justify-between bg-zinc-950 text-white p-12 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[size:40px_40px]" />
                
                {/* Top Branding */}
                <div className="relative z-10 flex items-center gap-3">
                    {logoUrl ? (
                        <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoUrl} alt={companyName} className="h-8 object-contain brightness-0 invert" />
                        </div>
                    ) : (
                        <div className="bg-primary/20 p-2 rounded-xl backdrop-blur-md border border-primary/20">
                            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-lg text-primary-foreground shadow-lg">
                                {companyName.charAt(0)}
                            </div>
                        </div>
                    )}
                    <span className="font-bold text-xl tracking-tight">{companyName}</span>
                </div>

                {/* Center Message */}
                <div className="relative z-10 max-w-lg mb-20 space-y-6">
                    <h1 className="text-4xl lg:text-5xl leading-tight font-bold text-white mb-6">
                        {loginHeading || "Your complete HR & Payroll ecosystem."}
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed">
                        {brandTagline || "Streamline attendance, simplify payroll, and empower your workforce with one integrated platform."}
                    </p>
                </div>

                {/* Bottom Graphic / Sub */}
                <div className="relative z-10 flex items-center gap-4 text-zinc-500 text-sm">
                    <div className="flex -space-x-3">
                        {["admin", "hr", "finance", "employee"].map((r, i) => (
                            <div key={r} style={{ zIndex: 10 - i }} className={`h-8 w-8 rounded-full border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold ${ROLE_COLORS[r].split(" ")[0].replace("/15", "")} ${ROLE_COLORS[r].split(" ")[1].replace("text-", "text-white ")} shadow-sm`}>
                                {r.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>
                    <span>Powered by Nexvision Innovations Inc.</span>
                </div>
            </div>

            {/* Right side: Login Form Panel */}
            <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
                <div className="w-full max-w-[420px] space-y-8 relative z-10">
                    
                    {/* Mobile Branding (Only visible on small screens) */}
                    <div className="lg:hidden flex flex-col items-center justify-center mb-8 space-y-4">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={companyName} className="h-16 md:h-20 w-auto object-contain max-w-[200px]" />
                        ) : (
                            <>
                                <Image src="/logo.png" alt={companyName} width={200} height={80} className="h-16 md:h-20 w-auto object-contain dark:hidden" priority />
                                <Image src="/darklogo.png" alt={companyName} width={200} height={80} className="h-16 md:h-20 w-auto object-contain hidden dark:block" priority />
                            </>
                        )}
                        <h2 className="text-2xl font-bold tracking-tight text-foreground text-center">
                            {companyName}
                        </h2>
                    </div>

                    {/* Form Header */}
                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome back</h2>
                        <p className="text-sm text-muted-foreground">
                            {loginSubheading || "Enter your credentials to access your account"}
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                    Email address
                                </label>
                                <Input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-12 bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary/30 transition-shadow"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium leading-none">Password</label>
                                </div>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary/30 transition-shadow"
                                    required
                                />
                            </div>
                        </div>
                        
                        <Button type="submit" size="lg" className="w-full h-12 text-base font-semibold shadow-md active:scale-[0.99] transition-all" disabled={loading}>
                            {loading ? "Signing in..." : "Sign in"}
                        </Button>
                    </form>

                    {/* Demo Access section */}
                    <div className="pt-6">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-3 text-muted-foreground/70 font-semibold tracking-wider">Demo Accounts</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {systemDemoAccounts.map((acc) => (
                                <button
                                    key={acc.email}
                                    type="button"
                                    className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/60 hover:border-border/80 transition-all text-left group"
                                    disabled={loading}
                                    onClick={() => handleQuickLogin(acc.email)}
                                >
                                    <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm ${acc.color}`}>
                                        <span className="text-xs font-bold uppercase">{acc.role.slice(0, 2)}</span>
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{toRoleLabel(acc.role)}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">{acc.email}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Collapsible Employee Demos */}
                        <div className="mt-4 rounded-xl border border-border/60 overflow-hidden bg-muted/10">
                            <button
                                type="button"
                                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
                                onClick={() => setShowEmployeeAccounts((v) => !v)}
                            >
                                <span>Employee Demos ({employeeDemoAccounts.length})</span>
                                {showEmployeeAccounts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            {showEmployeeAccounts && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-t border-border/40 bg-background/50">
                                    {employeeDemoAccounts.map((acc) => (
                                        <button
                                            key={acc.email}
                                            type="button"
                                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 transition-all text-left"
                                            disabled={loading}
                                            onClick={() => handleQuickLogin(acc.email)}
                                        >
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded font-semibold ${acc.color} shadow-none shrink-0`}>
                                                {toRoleLabel(acc.role)}
                                            </Badge>
                                            <span className="text-[11px] text-muted-foreground truncate">{acc.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Demo hint */}
                        <div className="mt-4 text-center">
                            <p className="text-xs text-muted-foreground font-medium">
                                <span className="opacity-80">Default password: </span>
                                <code className="font-mono bg-muted/50 border border-border/50 px-2 py-0.5 rounded text-[11px] select-all">demo1234</code>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
