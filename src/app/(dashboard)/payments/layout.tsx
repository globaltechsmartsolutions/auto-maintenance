import { redirect } from "next/navigation";
import { getDashboardViewer } from "@/lib/auth/viewer";

export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getDashboardViewer();
  if (!viewer.crmEnabled || !["SUPER_ADMIN", "ADMIN"].includes(viewer.role)) redirect("/control");
  return children;
}
