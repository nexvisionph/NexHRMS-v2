"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { signIn, signUp } from "@/services/auth.service";
import { hydrateAllStores, startWriteThrough, startRealtime } from "@/services/sync.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Apple, CircleHelp, Chrome, ArrowLeftRight } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { createClient } from "@/services/supabase-browser";

// Set to true to use local demo login (no Supabase required)
const USE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const ALLOW_SIGN_UP = process.env.NEXT_PUBLIC_ALLOW_SIGN_UP === "true";

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
    const [mode, setMode] = useState<"signIn" | "signUp" | "recovery">(ALLOW_SIGN_UP ? "signIn" : "recovery" === searchParams.get("type") ? "recovery" : "signIn");
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
            setMode("recovery");
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
            if (mode === "signUp") {
                // signUp expects a single input object with required fields.
                const res = await signUp({ email: loginEmail, password: loginPassword, name: loginEmail.split('@')[0] ?? '', role: 'employee' });
                if (res.ok) {
                    toast.success("Account created. Check your email to continue.");
                    setMode("signIn");
                    setLoading(false);
                    return;
                }
                toast.error(res.error || "Unable to create account");
                setLoading(false);
                return;
            }

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

    return (
        <div
            className={cn(
                "min-h-screen flex p-4",
                loginCardStyle === "split" ? "flex-row" : "items-center justify-center",
                loginBackground === "gradient" && "bg-gradient-to-br from-background via-muted/30 to-background",
                loginBackground === "pattern" && "bg-background",
            )}
            style={loginBackground === "solid" ? { backgroundColor: loginBgColor || undefined } : undefined}
        >
            {/* Pattern overlay */}
            {loginBackground !== "solid" && (
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,0,0,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.02)_1px,transparent_1px)] bg-[size:60px_60px] dark:bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)]" />
            )}

            {/* Split layout — branding panel */}
            {loginCardStyle === "split" && (
                <div className="hidden md:flex w-1/2 items-center justify-center bg-primary/5 relative">
                    <div className="text-center space-y-4 p-8">
                        {logoUrl ? (
                            <img src={logoUrl} alt={companyName} className="h-16 mx-auto object-contain" />
                        ) : (
                            <>
                                <Image src="/logo.png" alt={companyName} width={80} height={80} className="mx-auto dark:hidden" />
                                <Image src="/darklogo.png" alt={companyName} width={80} height={80} className="mx-auto hidden dark:block" />
                            </>
                        )}
                        <h2 className="text-2xl font-bold">{companyName}</h2>
                        {brandTagline && (
                            <p className="text-muted-foreground">{brandTagline}</p>
                        )}
                    </div>
                </div>
            )}

            <div className={cn(
                "flex items-center justify-center",
                loginCardStyle === "split" ? "w-full md:w-1/2 p-4 md:p-8" : "relative w-full"
            )}>
                <Card className="relative w-full max-w-lg overflow-hidden border-0 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] bg-card sm:rounded-2xl rounded-xl">
                    {/* Decorative Top Accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
                    
                    <CardHeader className="text-center space-y-1 pb-4 pt-12">
                        <div className="flex justify-center mb-6">
                            {logoUrl ? (
                                <img src={logoUrl} alt={companyName} className="h-16 md:h-24 w-auto object-contain max-w-[280px] drop-shadow-sm" />
                            ) : (
                                <>
                                    <Image src="/logo.png" alt={companyName} width={240} height={96} className="h-16 md:h-24 w-auto object-contain drop-shadow-sm dark:hidden" priority />
                                    <Image src="/darklogo.png" alt={companyName} width={240} height={96} className="h-16 md:h-24 w-auto object-contain drop-shadow-sm hidden dark:block" priority />
                                </>
                            )}
                        </div>
                        <div>
                            <p className="text-sm md:text-base text-muted-foreground font-medium">
                                {loginSubheading || "Sign in to your secure portal"}
                            </p>
                        </div>
                    </CardHeader>

                <CardContent className="space-y-6 px-6 md:px-10 pb-8">
                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {mode !== "recovery" && (
                            <>
                        <div>
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                placeholder="admin@nexhrms.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1.5"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1.5"
                                required
                            />
                        </div>
                        </>
                        )}
                        {mode === "recovery" && (
                            <>
                                <div>
                                    <label className="text-sm font-medium">New Password</label>
                                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Confirm Password</label>
                                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1.5" required />
                                </div>
                            </>
                        )}
                        <Button type="submit" size="lg" className="w-full text-base font-semibold transition-transform active:scale-[0.99] shadow-md" disabled={loading}>
                            {loading ? "Authenticating..." : mode === "recovery" ? "Update Password" : mode === "signUp" ? "Create Account" : "Secure Sign In"}
                        </Button>
                    </form>

                    {/* OAuth buttons removed per request */}

                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={handleForgotPassword}>
                            <CircleHelp className="h-3.5 w-3.5" />
                            {mode === "recovery" ? "Back to sign in" : "Forgot password?"}
                        </button>
                        {mode !== "recovery" ? (
                            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => router.push("/signup")}>
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                Need an account? Sign up
                            </button>
                        ) : null}
                    </div>

                    {/* Divider */}
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase font-medium tracking-widest">
                            <span className="bg-card px-4 text-muted-foreground/70">Demo Access</span>
                        </div>
                    </div>

                    {/* Quick Login Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {DEMO_ACCOUNTS.map((acc) => (
                            <Button
                                key={acc.role}
                                variant="outline"
                                className="h-12 w-full justify-start px-3 shadow-none border-dashed border-border/80 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                                disabled={loading}
                                onClick={() => handleQuickLogin(acc.email)}
                            >
                                <Badge variant="secondary" className={`text-[10px] w-20 font-semibold flex items-center justify-center tracking-wide ${acc.color} shrink-0`}>
                                    {acc.role}
                                </Badge>
                                <span className="text-[11px] sm:text-xs text-muted-foreground truncate group-hover:text-primary transition-colors ml-1">{acc.email}</span>
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
                                        className="h-12 w-full justify-start px-3 shadow-none border-dashed border-border/80 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                                        disabled={loading}
                                        onClick={() => handleQuickLogin(acc.email)}
                                    >
                                        <Badge variant="secondary" className={`text-[10px] w-20 font-semibold flex items-center justify-center tracking-wide ${acc.color} shrink-0`}>
                                            {acc.role}
                                        </Badge>
                                        <span className="text-[11px] sm:text-xs text-muted-foreground truncate group-hover:text-primary transition-colors ml-1">{acc.name}</span>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Demo hint */}
                    <div className="pt-2 text-center rounded-lg bg-muted/30 pb-2">
                        <p className="text-xs text-muted-foreground font-medium">
                            <span className="opacity-80">Default password: </span>
                            <code className="font-mono bg-background border px-2 py-0.5 rounded text-[11px] shadow-sm select-all">demo1234</code>
                        </p>
                    </div>
                </CardContent>
            </Card>
            </div>
        </div>
    );
}
