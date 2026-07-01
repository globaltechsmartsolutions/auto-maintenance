import Link from "next/link";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import { CustomerPortalWorkspace } from "@/components/demo/customer-portal-workspace";
import { DemoProvider } from "@/components/demo/demo-provider";
import { Button } from "@/components/ui/button";

export default function PortalPage() {
  return (
    <DemoProvider>
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-background/92 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/portal" className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
                <Sparkles className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">LimpiaPro</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Portal cliente
                </span>
              </span>
            </Link>

            <div className="hidden min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground sm:flex">
              <Building2 className="size-4 text-primary" />
              <span className="truncate">Atrium Labs</span>
            </div>

            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/dashboard">
                <ShieldCheck className="size-4" />
                Demo CRM
              </Link>
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <CustomerPortalWorkspace />
        </div>
      </main>
    </DemoProvider>
  );
}
