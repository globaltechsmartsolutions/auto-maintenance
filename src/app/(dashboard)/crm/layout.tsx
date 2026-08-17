import { redirect } from "next/navigation";
import { getDashboardViewer } from "@/lib/auth/viewer";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getDashboardViewer();
  if (!viewer.crmEnabled) redirect("/control");
  return children;
}
