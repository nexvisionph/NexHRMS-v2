"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { signIn } from "@/services/auth.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Set to true to use local demo login (no Supabase required)
const USE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_ACCOUNTS = [
    { role: "Admin", email: "admin@sdsi.com", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    { role: "HR", email: "hr@sdsi.com", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    { role: "Finance", email: "finance@sdsi.com", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    { role: "Employee", email: "employee@sdsi.com", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
    { role: "Supervisor", email: "supervisor@sdsi.com", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { role: "Payroll", email: "payroll@sdsi.com", color: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
    { role: "Auditor", email: "auditor@sdsi.com", color: "bg-slate-500/15 text-slate-700 dark:text-slate-400" },
    { role: "QR Employee 1", email: "qr@sdsi.com", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
    { role: "QR Employee 2", email: "qr2@sdsi.com", color: "bg-pink-500/15 text-pink-700 dark:text-pink-400" },
];

export default function LoginPage() {
    const router = useRouter();
    const localLogin = useAuthStore((s) => s.login);
    const setUser = useAuthStore((s) => s.setUser);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // Branding from appearance store
    const loginHeading = useAppearanceStore((s) => s.loginHeading);
    const loginSubheading = useAppearanceStore((s) => s.loginSubheading);
    const loginBackground = useAppearanceStore((s) => s.loginBackground);
    const loginBgColor = useAppearanceStore((s) => s.loginBgColor);
    const loginCardStyle = useAppearanceStore((s) => s.loginCardStyle);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const companyName = useAppearanceStore((s) => s.companyName);
    const brandTagline = useAppearanceStore((s) => s.brandTagline);

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
                // Redirect immediately — client-layout will handle store hydration
                toast.success("Welcome back!");
                router.push(`/${result.user.role}/dashboard`);
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
        setTimeout(() => {
            const success = localLogin(loginEmail, loginPassword);
            if (success) {
                toast.success("Welcome back!");
                const role = useAuthStore.getState().currentUser.role;
                router.push(`/${role}/dashboard`);
            } else {
                toast.error("Invalid email or password");
            }
            setLoading(false);
        }, 500);
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
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.02)_1px,transparent_1px)] bg-[size:60px_60px] dark:bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)]" />
            )}

            {/* Split layout — branding panel */}
            {loginCardStyle === "split" && (
                <div className="hidden md:flex w-1/2 items-center justify-center bg-primary/5 relative">
                    <div className="text-center space-y-4 p-8">
                        {logoUrl ? (
                            <img src={logoUrl} alt={companyName} className="h-16 mx-auto object-contain" />
                        ) : (
                            <Image src="/logo.png" alt={companyName} width={80} height={80} className="mx-auto" />
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
                                <Image src="/logo.png" alt={companyName} width={240} height={96} className="h-16 md:h-24 w-auto object-contain drop-shadow-sm" priority />
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
                        <div>
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                placeholder="admin@sdsi.com"
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
                        <Button type="submit" size="lg" className="w-full text-base font-semibold transition-transform active:scale-[0.99] shadow-md" disabled={loading}>
                            {loading ? "Authenticating..." : "Secure Sign In"}
                        </Button>
                    </form>

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
