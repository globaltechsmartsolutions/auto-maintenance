import { redirect } from "next/navigation";
import { CompanySettings } from "@/components/control/company-settings";
import { getDashboardViewer } from "@/lib/auth/viewer";
import { getCompanySettings } from "@/lib/wia-control/service";
import { isDemoMode } from "@/lib/demo-mode";

export default async function SettingsPage() {
  const viewer = await getDashboardViewer();
  if (!["SUPER_ADMIN", "ADMIN"].includes(viewer.role)) redirect("/control");

  const settings = !isDemoMode() && viewer.companyId && viewer.id
    ? await getCompanySettings({
        companyId: viewer.companyId,
        userId: viewer.id,
        role: viewer.role,
      })
    : {
        name: viewer.companyName,
        timezone: "Europe/Madrid",
        clockRetentionYears: 4,
        crmEnabled: viewer.crmEnabled,
      };

  return <CompanySettings initialValue={settings} />;
}
