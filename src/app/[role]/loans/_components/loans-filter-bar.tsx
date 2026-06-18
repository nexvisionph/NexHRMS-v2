"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LoansFilterBarProps {
    search?: string;
    onSearchChange?: (value: string) => void;
    statusFilter: string;
    onStatusChange: (value: string) => void;
    searchPlaceholder?: string;
    showSearch?: boolean;
}

export function LoansFilterBar({
    search = "",
    onSearchChange,
    statusFilter,
    onStatusChange,
    searchPlaceholder = "Search employee...",
    showSearch = true,
}: LoansFilterBarProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3">
            {showSearch && (
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="pl-9"
                    />
                </div>
            )}
            <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
