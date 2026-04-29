"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/services/auth.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ArrowLeft, UserPlus, Shield, User, Briefcase, Building2 } from "lucide-react";
import { SYSTEM_ROLES, DEPARTMENTS } from "@/lib/constants";
import type { Role } from "@/types";

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "employee" as Role,
        department: "",
        agree: false,
    });

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const result = await signUp({
                email: formData.email,
                password: formData.password,
                name: formData.name,
                role: formData.role,
                department: formData.department,
            });

            if (result.ok) {
                toast.success("Account created successfully! Please check your email to verify.");
                router.push("/login");
            } else {
                toast.error(result.error || "Signup failed. Please try again.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
            {/* Pattern overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,0,0,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.02)_1px,transparent_1px)] bg-[size:60px_60px] dark:bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)]" />
            
            <div className="relative w-full max-w-xl">
                {/* Back button */}
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute -top-12 left-0 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => router.push("/login")}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                </Button>

                <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] bg-card/80 backdrop-blur-sm sm:rounded-2xl rounded-xl overflow-hidden">
                    {/* Top Accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
                    
                    <CardHeader className="text-center pt-10 pb-6">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                <UserPlus className="h-8 w-8" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight">Create your account</CardTitle>
                        <CardDescription>Enter your details to join the NexHRMS platform</CardDescription>
                    </CardHeader>

                    <CardContent className="px-6 sm:px-10 pb-10">
                        <form onSubmit={handleSignup} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                        <User className="h-3 w-3 mr-1.5" />
                                        Full Name
                                    </Label>
                                    <Input 
                                        id="name"
                                        placeholder="John Doe" 
                                        required 
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                        <Building2 className="h-3 w-3 mr-1.5" />
                                        Work Email
                                    </Label>
                                    <Input 
                                        id="email"
                                        type="email" 
                                        placeholder="john@company.com" 
                                        required 
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" title="Password must be at least 8 characters" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Password
                                </Label>
                                <Input 
                                    id="password"
                                    type="password" 
                                    placeholder="••••••••" 
                                    required 
                                    minLength={8}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                        <Shield className="h-3 w-3 mr-1.5" />
                                        System Role
                                    </Label>
                                    <Select 
                                        value={formData.role} 
                                        onValueChange={(val) => setFormData({ ...formData, role: val as Role })}
                                    >
                                        <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all capitalize">
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SYSTEM_ROLES.map((role) => (
                                                <SelectItem key={role} value={role} className="capitalize">
                                                    {role.replace("_", " ")}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                        <Briefcase className="h-3 w-3 mr-1.5" />
                                        Department
                                    </Label>
                                    <Select 
                                        value={formData.department} 
                                        onValueChange={(val) => setFormData({ ...formData, department: val })}
                                    >
                                        <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all">
                                            <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DEPARTMENTS.map((dept) => (
                                                <SelectItem key={dept} value={dept}>
                                                    {dept}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 pt-2">
                                <Checkbox 
                                    id="agree" 
                                    checked={formData.agree}
                                    onCheckedChange={(val) => setFormData({ ...formData, agree: !!val })}
                                    className="mt-0.5"
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="agree"
                                        className="text-xs font-medium text-muted-foreground leading-normal cursor-pointer"
                                    >
                                        I agree to the <span className="text-primary hover:underline">Terms of Service</span> and <span className="text-primary hover:underline">Privacy Policy</span>.
                                    </Label>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button 
                                    type="submit" 
                                    className="w-full h-12 text-base font-bold transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                                    disabled={loading || !formData.agree}
                                >
                                    {loading ? "Creating account..." : "Sign Up & Create Profile"}
                                </Button>
                            </div>

                        </form>
                    </CardContent>
                </Card>

                {/* Info Note */}
                <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium leading-relaxed">
                        Note: New accounts will be assigned a unique system ID automatically 
                        following the NexHRMS corporate standard.
                    </p>
                </div>
            </div>
        </div>
    );
}
