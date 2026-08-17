import { redirect } from "next/navigation";
import { getDashboardViewer } from "@/lib/auth/viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getDashboardViewer();
  if (viewer.role !== "SUPER_ADMIN") redirect("/control");
  return children;
}
