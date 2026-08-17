import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDemoMode } from "@/lib/demo-mode";

const authRoutes = ["/login", "/register", "/reset-password"];
const protectedPrefixes = [
  "/",
  "/dashboard",
  "/control",
  "/worksites",
  "/shifts",
  "/settings",
  "/profile",
  "/time-tracking",
  "/crm",
  "/services",
  "/calendar",
  "/employees",
  "/invoices",
  "/payments",
  "/automations",
  "/portal",
  "/employee",
  "/admin",
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isDemoMode()) {
    return response;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const isProtectedRoute = protectedPrefixes.some((prefix) =>
      prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
    );
    if (isProtectedRoute) {
      return new NextResponse("Authentication service is not configured.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname.startsWith("/api")) {
    return response;
  }

  if (authRoutes.includes(pathname) && user) {
    return NextResponse.redirect(new URL("/control", request.url));
  }

  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
  );

  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
