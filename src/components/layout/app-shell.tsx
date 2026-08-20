"use client";

import * as React from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import {
  BadgeEuro,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  DatabaseZap,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  ListChecks,
  Moon,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
  UserRoundCog,
  Wrench,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DemoActionButton,
  DemoProvider,
  useDemo,
} from "@/components/demo/demo-provider";
import {
  WiaControlProvider,
  useWiaControl,
} from "@/components/control/wia-control-provider";
import { cn } from "@/lib/utils";
import type { DashboardViewer } from "@/lib/auth/viewer";
import type { Role } from "@/lib/auth/roles";

type NavigationSection = {
  label: string;
  items: Array<{
    href: Route;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: Role[];
  }>;
  commercial?: boolean;
};

const navigationSections: NavigationSection[] = [
  {
    label: "Operations",
    items: [
      { href: "/control", label: "Coverage", icon: ShieldCheck },
      { href: "/worksites", label: "Worksites", icon: Building2 },
      { href: "/shifts", label: "Shifts", icon: CalendarDays },
      { href: "/time-tracking", label: "Time tracking", icon: Clock3 },
      { href: "/services", label: "Services", icon: Wrench },
      { href: "/employees", label: "Team", icon: UserRoundCog },
      { href: "/onboarding" as Route, label: "Pilot setup", icon: ListChecks, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
      { href: "/settings" as Route, label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
  {
    label: "Sales",
    commercial: true,
    items: [
      { href: "/crm", label: "CRM", icon: Users },
      { href: "/invoices", label: "Invoices", icon: ReceiptText, roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/payments", label: "Payments", icon: CreditCard, roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/dashboard", label: "Business overview", icon: LayoutDashboard },
      { href: "/automations", label: "Automations", icon: Bot },
      { href: "/admin", label: "SaaS administration", icon: Gauge, roles: ["SUPER_ADMIN"] },
    ],
  },
];

function Brand() {
  return (
    <Link href="/control" className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
        <ShieldCheck className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-none">
          WIA Control
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          Verifiable operations
        </span>
      </span>
    </Link>
  );
}

function NavList({ viewer, onNavigate }: { viewer: DashboardViewer; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visibleSections = navigationSections
    .filter((section) => !section.commercial || viewer.crmEnabled)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(viewer.role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-5">
      {visibleSections.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            {section.label}
          </p>
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(nextTheme)}
          aria-label="Change theme"
        >
          <Moon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Change theme</TooltipContent>
    </Tooltip>
  );
}

function DemoResetMenuItem() {
  const { resetDemo } = useDemo();
  const { resetControl } = useWiaControl();

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        resetDemo();
        resetControl();
      }}
    >
      <RefreshCw className="size-4" />
      Restore local environment
    </DropdownMenuItem>
  );
}

function DemoDataToolsMenu() {
  const { clearDemoScope } = useDemo();
  const scopes = [
    { label: "Web bookings", scope: "web" },
    { label: "Services", scope: "services" },
    { label: "Leads", scope: "leads" },
    { label: "Employees", scope: "employees" },
    { label: "Notes", scope: "notes" },
  ] as const;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <DatabaseZap className="size-4" />
        Internal tools
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-56">
          <DropdownMenuLabel>Local data</DropdownMenuLabel>
          {scopes.map((item) => (
            <DropdownMenuItem
              key={item.scope}
              onSelect={(event) => {
                event.preventDefault();
                clearDemoScope(item.scope);
              }}
            >
              <DatabaseZap className="size-4" />
              Clear {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

export function AppShell({ children, viewer }: { children: React.ReactNode; viewer: DashboardViewer }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <DemoProvider>
    <WiaControlProvider>
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar/95 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-sidebar-border p-5">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <NavList viewer={viewer} />
          </div>
          <div className="border-t border-sidebar-border p-4">
            <div className="rounded-lg border border-sidebar-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Plan Growth</p>
                  <p className="text-xs text-muted-foreground">18 users</p>
                </div>
                <BadgeEuro className="size-4 text-primary" />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[72%] rounded-full bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>
                    <Brand />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    WIA Control main navigation.
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4">
                  <NavList viewer={viewer} onNavigate={() => setMobileNavOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex md:w-[360px]">
              <Search className="size-4" />
              <span>Search shifts, worksites, employees...</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="hidden rounded-md sm:inline-flex">
                {viewer.role === "MANAGER" ? "Coordination" : "Administration"}
              </Badge>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <DemoActionButton
                    action="notifications"
                    variant="outline"
                    size="icon"
                    aria-label="Alerts"
                  >
                    <Bell className="size-4" />
                  </DemoActionButton>
                </TooltipTrigger>
                <TooltipContent>Alerts</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <Avatar className="size-7">
                      <AvatarFallback>
                        {viewer.userName.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm sm:inline">{viewer.userName.split(" ")[0]}</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {viewer.companyName}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {viewer.role === "MANAGER" ? "Coordinator" : viewer.role === "SUPER_ADMIN" ? "Super administrator" : "Administrator"}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={"/profile" as Route}>
                      <UserRound className="size-4" />
                      My profile
                    </Link>
                  </DropdownMenuItem>
                  {viewer.role !== "MANAGER" ? (
                    <DropdownMenuItem asChild>
                      <Link href={"/settings" as Route}>
                        <Settings className="size-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DemoDataToolsMenu />
                  <DemoResetMenuItem />
                  <DropdownMenuItem asChild>
                    <form action={signOutAction} className="w-full">
                      <button type="submit" className="flex w-full items-center gap-1.5 text-left">
                      <LogOut className="size-4" />
                      Sign out
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="page-shell">{children}</main>
      </div>
    </div>
    </WiaControlProvider>
    </DemoProvider>
  );
}
