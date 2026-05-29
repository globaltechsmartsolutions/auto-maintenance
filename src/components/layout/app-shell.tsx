"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeEuro,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Users,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/services", label: "Servicios", icon: Wrench },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/employees", label: "Empleados", icon: UserRoundCog },
  { href: "/invoices", label: "Facturas", icon: ReceiptText },
  { href: "/payments", label: "Pagos", icon: CreditCard },
  { href: "/automations", label: "Automatizaciones", icon: Bot },
  { href: "/portal", label: "Portal cliente", icon: Building2 },
  { href: "/admin", label: "SaaS admin", icon: Gauge },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
        <Sparkles className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-none">
          LimpiaPro CRM
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          Operaciones SaaS
        </span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navigation.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          aria-label="Cambiar tema"
        >
          <Moon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Cambiar tema</TooltipContent>
    </Tooltip>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar/95 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-sidebar-border p-5">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <NavList />
          </div>
          <div className="border-t border-sidebar-border p-4">
            <div className="rounded-lg border border-sidebar-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Plan Growth</p>
                  <p className="text-xs text-muted-foreground">18 usuarios</p>
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
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Abrir navegación</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>
                    <Brand />
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4">
                  <NavList />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex md:w-[360px]">
              <Search className="size-4" />
              <span>Buscar clientes, servicios, facturas...</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="hidden rounded-md sm:inline-flex">
                Madrid HQ
              </Badge>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Alertas">
                    <Bell className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alertas</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <Avatar className="size-7">
                      <AvatarFallback>AM</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm sm:inline">Admin</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Limpiezas Demo SL</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="size-4" />
                    Configuración
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/login">
                      <LogOut className="size-4" />
                      Cerrar sesión
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="page-shell">{children}</main>
      </div>
    </div>
  );
}
