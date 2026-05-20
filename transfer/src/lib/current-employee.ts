import type { DemoUser, Employee } from "@/types";

export function findCurrentEmployee(employees: Employee[], currentUser: Pick<DemoUser, "id" | "email" | "name">) {
  const userEmail = currentUser.email?.toLowerCase();
  return (
    employees.find((employee) => employee.profileId === currentUser.id) ||
    employees.find((employee) => employee.email?.toLowerCase() === userEmail) ||
    employees.find((employee) => employee.name === currentUser.name)
  );
}

export function getAttendanceEmployeeIds(employees: Employee[], currentEmployee?: Employee) {
  if (!currentEmployee) return [];

  const ids = new Set([currentEmployee.id]);
  if (currentEmployee.biometricId) {
    for (const employee of employees) {
      if (employee.biometricId === currentEmployee.biometricId) {
        ids.add(employee.id);
      }
    }
  }

  return Array.from(ids);
}
