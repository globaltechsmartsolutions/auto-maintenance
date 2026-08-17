import { AppShell } from "@/components/layout/app-shell";
import { getDashboardViewer } from "@/lib/auth/viewer";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getDashboardViewer();
  if (viewer.role === "EMPLOYEE") redirect("/employee");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
