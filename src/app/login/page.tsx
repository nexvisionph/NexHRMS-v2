"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { signIn } from "@/services/auth.service";
import { hydrateAllStores, startWriteThrough, startRealtime } from "@/services/sync.service";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Apple, CircleHelp, ArrowLeft, Moon, Sun } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { createClient } from "@/services/supabase-browser";

// Set to true to use local demo login (no Supabase required)
const USE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_ACCOUNTS = [
    { role: "Admin", email: "admin@nexhrms.com", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    { role: "HR", email: "hr@nexhrms.com", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    { role: "Finance", email: "finance@nexhrms.com", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    { role: "Employee", email: "employee@nexhrms.com", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
    { role: "Supervisor", email: "supervisor@nexhrms.com", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { role: "Payroll", email: "payroll@nexhrms.com", color: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
    { role: "Auditor", email: "auditor@nexhrms.com", color: "bg-slate-500/15 text-slate-700 dark:text-slate-400" },
    { role: "QR Employee 1", email: "qr@nexhrms.com", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
    { role: "QR Employee 2", email: "qr2@nexhrms.com", color: "bg-pink-500/15 text-pink-700 dark:text-pink-400" },
    { role: "\uD83E\uDD16 Face Demo", email: "face@nexhrms.com", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
];
const PAYROLL_TEST_ACCOUNTS = [
    { role: "Sr. Engineer", email: "maria.cruz@nexhrms.test", color: "bg-rose-500/15 text-rose-700 dark:text-rose-400", name: "Maria Cruz" },
    { role: "Developer", email: "juan.reyes@nexhrms.test", color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400", name: "Juan Reyes" },
    { role: "Finance", email: "ana.villanueva@nexhrms.test", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", name: "Ana Villanueva" },
    { role: "Field Tech", email: "carlo.gonzales@nexhrms.test", color: "bg-lime-500/15 text-lime-700 dark:text-lime-400", name: "Carlo Gonzales" },
    { role: "HR Manager", email: "elena.tan@nexhrms.test", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400", name: "Elena Tan" },
    { role: "Eng. Lead", email: "roberto.aquino@nexhrms.test", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", name: "Roberto Aquino" },
    { role: "Marketing", email: "lisa.fernandez@nexhrms.test", color: "bg-pink-500/15 text-pink-700 dark:text-pink-400", name: "Lisa Fernandez" },
    { role: "Sales Exec", email: "mark.delacruz@nexhrms.test", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400", name: "Mark Dela Cruz" },
];
export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login: localLogin, setUser } = useAuthStore(
        useShallow((s) => ({ login: s.login, setUser: s.setUser }))
    );
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPayrollAccounts, setShowPayrollAccounts] = useState(false);
    const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
    const [mode, setMode] = useState<"signIn" | "recovery">("recovery" === searchParams.get("type") ? "recovery" : "signIn");
    const isLightMode = themeMode === "light";
    const employees = useEmployeesStore((s) => s.employees);
    const supabase = useMemo(() => createClient(), []);

    // Consolidated branding from appearance store
    const {
        loginHeading, loginSubheading, loginBackground, loginBgColor,
        loginCardStyle, logoUrl, companyName, brandTagline
    } = useAppearanceStore(
        useShallow((s) => ({
            loginHeading: s.loginHeading,
            loginSubheading: s.loginSubheading,
            loginBackground: s.loginBackground,
            loginBgColor: s.loginBgColor,
            loginCardStyle: s.loginCardStyle,
            logoUrl: s.logoUrl,
            companyName: s.companyName,
            brandTagline: s.brandTagline,
        }))
    );

    useEffect(() => {
        if (searchParams.get("type") === "recovery") {
            const timer = setTimeout(() => setMode("recovery"), 0);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    const redirectAfterAuth = (role: string) => {
        router.push(`/${role}/dashboard`);
    };

    const handleOAuthLogin = async (provider: "google" | "apple") => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/login`,
                },
            });
            if (error) {
                toast.error(error.message);
                setLoading(false);
            }
        } catch {
            toast.error("OAuth sign-in failed. Please try again.");
            setLoading(false);
        }
    };

    const handleSupabaseLogin = async (loginEmail: string, loginPassword: string) => {
        setLoading(true);
        try {
            // Sign-in flow
            const res = await signIn(loginEmail, loginPassword);
            if (res.ok) {
                // Hydrate Zustand store with Supabase user data
                setUser({
                    id: res.user.id,
                    name: res.user.name,
                    email: res.user.email,
                    role: res.user.role,
                    avatarUrl: res.user.avatarUrl,
                    mustChangePassword: res.user.mustChangePassword,
                    profileComplete: res.user.profileComplete,
                    phone: res.user.phone,
                    department: res.user.department,
                    birthday: res.user.birthday,
                    address: res.user.address,
                    emergencyContact: res.user.emergencyContact,
                });
                useAuthStore.setState({ isAuthenticated: true });
                hydrateAllStores({ skipSessionCheck: true }).then(() => {
                    startWriteThrough();
                    startRealtime();
                });
                toast.success("Welcome back!");
                redirectAfterAuth(res.user.role);
            } else if (res.error === "deactivated") {
                toast.error("Your account has been deactivated. Please contact your HR administrator.");
                setLoading(false);
                router.push("/deactivated");
            } else if (res.error === "pending_approval") {
                toast.info("Your account is pending admin approval. Please wait for confirmation.");
                setLoading(false);
            } else {
                toast.error(res.error || "Invalid email or password");
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
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

    const handlePasswordRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }
        toast.success("Password updated. You can sign in now.");
        setMode("signIn");
        setLoading(false);
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === "recovery") {
            void handlePasswordRecovery(e);
            return;
        }
        if (USE_DEMO_MODE) {
            handleDemoLogin(email, password);
        } else {
            void handleSupabaseLogin(email, password);
        }
    };

    const handleForgotPassword = async () => {
        router.push("/login?type=recovery");
    };

    const handleQuickLogin = (demoEmail: string) => {
        if (USE_DEMO_MODE) {
            handleDemoLogin(demoEmail, "demo1234");
        } else {
            handleSupabaseLogin(demoEmail, "demo1234");
        }
    };

const panelCardClass = cn(
    "mx-auto w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-6 rounded-3xl",
    isLightMode
        ? "bg-white shadow-xl"
        : "bg-[#121212] border border-[#1f1f1f]"
);

    const headingTextClass = isLightMode ? "text-slate-900" : "text-white";
    const subheadingTextClass = isLightMode ? "text-slate-600" : "text-gray-300";
    const labelTextClass = isLightMode ? "text-slate-900" : "text-white";
    const inputClassName = cn(
        "mt-1.5",
        isLightMode
            ? "text-slate-900 placeholder:text-slate-500 bg-white border-slate-300"
            : "text-white placeholder:text-gray-500 bg-transparent"
    );
    const forgotTextClass = isLightMode ? "text-slate-900 hover:text-teal-600" : "text-white hover:text-teal-300";
    const demoButtonClass = cn(
        "h-12 w-full justify-start px-3 shadow-none border-dashed border-border/80 transition-colors group",
        isLightMode
            ? "bg-slate-200 text-slate-900 hover:border-teal-600/80"
            : "bg-slate-700/20 text-white hover:border-teal-400/80 hover:bg-slate-700/20 hover:text-white"
    );
    const demoEmailTextClass = cn(
        "text-[11px] sm:text-xs truncate ml-1",
        isLightMode ? "text-slate-900" : "text-white hover:text-teal-300"
    );
    const payrollEmailTextClass = cn(
        "text-[11px] sm:text-xs truncate ml-1",
        isLightMode ? "text-black" : "text-white hover:text-teal-300"
    );

    return (
        <main
            className={cn(
                "relative min-h-screen lg:grid lg:grid-cols-[50%_50%]",
                isLightMode ? "bg-slate-50" : "bg-background",
                !isLightMode && loginBackground === "gradient" && "bg-gradient-to-br from-background via-muted/30 to-background",
                !isLightMode && loginBackground === "pattern" && "bg-background"
            )}
            style={isLightMode ? undefined : loginBackground === "solid" ? { backgroundColor: loginBgColor || undefined } : undefined}
        >
            <div className="relative hidden lg:flex flex-col p-10 overflow-hidden" style={{ backgroundColor: isLightMode ? '#F8FAFC' : '#121212' }}>
                <div className="absolute inset-0 text-[#02B0B2]">
                    <FloatingPaths position={1} />
                    <FloatingPaths position={-1} />
                </div>
                <div className="relative z-10">
                    <Image src={isLightMode ? "/blacklogo.png" : "/finalwhitelogo.png"} alt="NEXVision wordmark" width={280} height={80} className="object-contain" />
                </div>
                <div className={isLightMode ? "relative z-10 mt-auto text-black" : "relative z-10 mt-auto text-gray-300"}>
                    <p className="text-sm leading-relaxed">{brandTagline || 'Streamlined HR Management for Modern Organizations'}</p>
                </div>
            </div>

            <div className="relative flex min-h-screen flex-col justify-center p-4 md:p-8" style={{ backgroundColor: isLightMode ? '#F0ECEC' : '#181818' }}>
                <div className="absolute top-4 right-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={isLightMode ? "h-10 w-10 rounded-full text-black hover:bg-black/5 hover:text-black transition-colors" : "h-10 w-10 rounded-full text-white hover:bg-teal-500/10 hover:text-white transition-colors"}
                        onClick={() => setThemeMode(isLightMode ? "dark" : "light")}
                    >
                        {isLightMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </Button>
                </div>
                <div className={panelCardClass}>
                    {mode === "recovery" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute -top-12 left-0 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setMode("signIn")}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Sign In
                        </Button>
                    )}

                    <div className={cn("text-center space-y-1 pb-4 pt-12", headingTextClass)}>
                        <div className="flex justify-center mb-6">
                            <h1 className="text-4xl font-bold uppercase tracking-[0.2em]">SIGN IN</h1>
                        </div>
                        <div>
                            <p className={cn("text-sm md:text-base font-medium", subheadingTextClass)}>
                                {loginSubheading || "Sign in to your account to continue"}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6 px-6 md:px-10 pb-8">
                        {/* Login Form */}
                        <form onSubmit={handleLogin} className="space-y-4">
                            {mode !== "recovery" && (
                                <>
                                    <div>
                                        <label className={cn("text-sm font-medium", labelTextClass)}>Email</label>
                                        <Input
                                            type="email"
                                            placeholder="admin@nexhrms.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={cn("text-sm font-medium", labelTextClass)}>Password</label>
                                        <Input
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={inputClassName}
                                            required
                                        />
                                    </div>
                                </>
                            )}
                            {mode === "recovery" && (
                                <>
                                    <div>
                                        <label className={cn("text-sm font-medium", labelTextClass)}>New Password</label>
                                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClassName} required />
                                    </div>
                                    <div>
                                        <label className={cn("text-sm font-medium", labelTextClass)}>Confirm Password</label>
                                        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClassName} required />
                                    </div>
                                </>
                            )}
                            <Button type="submit" size="lg" className="w-full bg-teal-500 text-white hover:bg-teal-400 focus-visible:ring-teal-300 text-base font-semibold transition-transform active:scale-[0.99] shadow-md" disabled={loading}>
                                {loading ? "Authenticating..." : mode === "recovery" ? "Update Password" : "Secure Sign In"}
                            </Button>
                        </form>

                        {/* OAuth buttons removed per request */}

                        <div className="flex items-center justify-between gap-3 text-xs">
                            <button type="button" className={cn("inline-flex items-center gap-1 transition-colors", forgotTextClass)} onClick={handleForgotPassword}>
                                <CircleHelp className="h-3.5 w-3.5" />
                                {mode === "recovery" ? "Back to sign in" : "Forgot password?"}
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className={cn("w-full border-t", isLightMode ? "border-border/60" : "border-transparent")} />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase font-medium tracking-widest">
                                <span className={isLightMode ? "px-4 text-teal-600" : "px-4 text-teal-300"}>Demo Access</span>
                            </div>
                        </div>

                        {/* Quick Login Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            {DEMO_ACCOUNTS.map((acc) => (
                                <Button
                                    key={acc.role}
                                    variant="outline"
                                    className={demoButtonClass}
                                    disabled={loading}
                                    onClick={() => handleQuickLogin(acc.email)}
                                >
                                    <Badge variant="secondary" className={`text-[10px] w-20 font-semibold flex items-center justify-center tracking-wide ${acc.color} shrink-0`}>
                                        {acc.role}
                                    </Badge>
                                    <span className={demoEmailTextClass}>{acc.email}</span>
                                </Button>
                            ))}
                        </div>

                        {/* Payroll Test Accounts — collapsible */}
                        <div className="rounded-lg border border-dashed border-border/60 overflow-hidden">
                            <button
                                type="button"
                                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 hover:bg-muted/30 transition-colors"
                                onClick={() => setShowPayrollAccounts((v) => !v)}
                            >
                                <span>Payroll Test Accounts</span>
                                {showPayrollAccounts ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            {showPayrollAccounts && (
                                <div className="grid grid-cols-2 gap-2 p-2 pt-1 border-t border-border/40">
                                    {PAYROLL_TEST_ACCOUNTS.map((acc) => (
                                        <Button
                                            key={acc.email}
                                            variant="outline"
                                            className={demoButtonClass}
                                            disabled={loading}
                                            onClick={() => handleQuickLogin(acc.email)}
                                        >
                                            <Badge variant="secondary" className={`text-[10px] w-20 font-semibold flex items-center justify-center tracking-wide ${acc.color} shrink-0`}>
                                                {acc.role}
                                            </Badge>
                                            <span className={payrollEmailTextClass}>{acc.email}</span>
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Demo hint */}
                        <div className={cn("pt-2 text-center rounded-lg pb-2", isLightMode ? "bg-muted/30" : "bg-slate-800") }>
                            <p className={cn("text-xs font-medium", isLightMode ? "text-muted-foreground" : "text-gray-300")}>
                                <span className="opacity-80">Default password: </span>
                                <code className={cn("font-mono px-2 py-0.5 rounded text-[11px] select-all", isLightMode ? "bg-background border" : "bg-slate-700 text-gray-200")}>demo1234</code>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

function FloatingPaths({ position }: { position: number }) {
    const paths = Array.from({ length: 36 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
            380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
            152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
            684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
    }));

    return (
        <div className="pointer-events-none absolute inset-0">
            <svg className="h-full w-full" viewBox="0 0 696 316" fill="none">
                <title>Background Paths</title>
                {paths.map((path) => (
                    <motion.path
                        key={path.id}
                        d={path.d}
                        stroke="#02B0B2"
                        strokeWidth={path.width}
                        strokeOpacity={0.1 + path.id * 0.03}
                        initial={{ pathLength: 0.3, opacity: 0.6 }}
                        animate={{
                            pathLength: 1,
                            opacity: [0.3, 0.6, 0.3],
                            pathOffset: [0, 1, 0],
                        }}
                        transition={{
                            duration: 20 + Math.random() * 10,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'linear',
                        }}
                    />
                ))}
            </svg>
        </div>
    );
}

