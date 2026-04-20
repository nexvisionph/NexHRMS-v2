"use client";

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface EmployeeComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Label shown when "all" is selected. Defaults to "All Employees". */
  allLabel?: string;
  /** If true, hides the "All" option. Use for dialogs where a specific employee must be chosen. */
  required?: boolean;
  /** Extra className on the trigger button. */
  className?: string;
  /** Filter employees by status. Defaults to ["active"]. Pass null for no filter. */
  statusFilter?: string[] | null;
  /** Placeholder when no employee is selected (required mode). */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function EmployeeCombobox({
  value,
  onValueChange,
  allLabel = "All Employees",
  required = false,
  className,
  statusFilter = ["active"],
  placeholder = "Select employee...",
  disabled = false,
}: EmployeeComboboxProps) {
  const [open, setOpen] = useState(false);
  const employees = useEmployeesStore((s) => s.employees);

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.id &&
          (statusFilter === null || statusFilter.includes(e.status))
      ),
    [employees, statusFilter]
  );

  const selected = filteredEmployees.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 min-w-[200px] justify-between font-normal",
            className
          )}
        >
          <span className="flex items-center gap-2 overflow-hidden">
            {selected ? (
              <>
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[9px]",
                      "bg-primary/10 text-primary"
                    )}
                  >
                    {getInitials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selected.name}</span>
              </>
            ) : value === "all" && !required ? (
              <>
                <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{allLabel}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employee..." />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            {!required && (
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onValueChange("all");
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 py-2"
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{allLabel}</span>
                  {value === "all" && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Employees">
              {filteredEmployees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.name} ${emp.department ?? ""} ${emp.id}`}
                  onSelect={() => {
                    onValueChange(emp.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 py-2"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-[9px]",
                        value === emp.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {getInitials(emp.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    {emp.department && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {emp.department}
                      </p>
                    )}
                  </div>
                  {value === emp.id && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
