"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { signIn } from "@/services/auth.service";
import { hydrateAllStores, startWriteThrough } from "@/services/sync.service";
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
    { role: "Admin", email: "admin@nexhrms.com", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    { role: "HR", email: "hr@nexhrms.com", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    { role: "Finance", email: "finance@nexhrms.com", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    { role: "Employee", email: "employee@nexhrms.com", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
    { role: "Supervisor", email: "supervisor@nexhrms.com", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { role: "Payroll", email: "payroll@nexhrms.com", color: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
    { role: "Auditor", email: "auditor@nexhrms.com", color: "bg-slate-500/15 text-slate-700 dark:text-slate-400" },
    { role: "QR Employee", email: "qr@nexhrms.com", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
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
                // Sync: hydrate all stores from Supabase and start write-through
                await hydrateAllStores();
                startWriteThrough();
                toast.success("Welcome back!");
                router.push(`/${result.user.role}/dashboard`);
            } else {
                toast.error(result.error || "Invalid email or password");
            }
        } catch {
            toast.error("Connection error. Please try again.");
        } finally {
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
                <Card className="relative w-full max-w-md border border-border/50 shadow-2xl shadow-black/5 dark:shadow-black/30">
                    <CardHeader className="text-center space-y-4 pb-2">
                        <div className="flex justify-center">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={companyName} className="h-8 w-8 object-contain" />
                                ) : (
                                    <Image src="/logo.png" alt={companyName} width={32} height={32} />
                                )}
                            </div>
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold tracking-tight">{loginHeading || companyName}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                {loginSubheading || "Sign in to your account to continue"}
                            </p>
                        </div>
                    </CardHeader>

                <CardContent className="space-y-6">
                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
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
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/50" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-card px-3 text-muted-foreground">Quick Demo Login</span>
                        </div>
                    </div>

                    {/* Quick Login Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                        {DEMO_ACCOUNTS.map((acc) => (
                            <Button
                                key={acc.role}
                                variant="outline"
                                size="sm"
                                className="h-auto py-2.5 px-3 justify-start gap-2"
                                disabled={loading}
                                onClick={() => handleQuickLogin(acc.email)}
                            >
                                <Badge variant="secondary" className={`text-[10px] ${acc.color} shrink-0`}>
                                    {acc.role}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate">{acc.email}</span>
                            </Button>
                        ))}
                    </div>

                    {/* Demo hint */}
                    <p className="text-[11px] text-muted-foreground text-center">
                        Password for all demo accounts: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">demo1234</code>
                    </p>
                </CardContent>
            </Card>
            </div>
        </div>
    );
}
