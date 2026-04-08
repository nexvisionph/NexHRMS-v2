import { redirect } from "next/navigation";

export default async function EmployeesPage({ params }: { params: Promise<{ role: string }> }) {
    const { role } = await params;
    redirect(`/${role}/employees/manage`);
}
