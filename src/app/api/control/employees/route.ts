import { apiRoute } from "@/lib/http/api-route";
import { employeeCreateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { createEmployeeProfile, listEmployees } from "@/lib/wia-control/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    companyId
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", employees: [] });

  const records = await listEmployees(context.actor);

  return Response.json({
    mode: "database",
    employees: records.map((record) => ({
      id: record.id,
      name: `${record.user.firstName} ${record.user.lastName}`.trim(),
      email: record.user.email,
      position: record.position ?? undefined,
      fieldStatus: record.fieldStatus,
      skills: record.skills,
      zones: record.zones,
      availability: record.availability,
      maxHoursPerDay: record.maxHoursPerDay ?? undefined,
      maxJobsPerDay: record.maxJobsPerDay ?? undefined,
      performanceScore: record.performanceScore,
      internalNotes: record.internalNotes ?? undefined,
      servicesCount: record.jobs.length,
      revenue: record.jobs
        .filter((job) => job.service.status === "COMPLETED")
        .reduce((total, job) => total + Number(job.service.price), 0),
    })),
  });
});

/**
 * Creates a new employee's login (Supabase Auth) and company profile
 * (Postgres) together. If the Postgres write fails after the Auth user
 * is created -- most commonly because the email is already in use --
 * the Auth user is rolled back, mirroring the exact pattern the sign-up
 * flow already uses (see signUpAction in app/actions/auth.ts) so a retry
 * with the same email never fails with "user already exists" while
 * having no usable profile.
 */
export const POST = apiRoute(async (request: Request) => {
  const body = (await request.json()) as Record<string, unknown>;
  const companyId = typeof body.companyId === "string" ? body.companyId : undefined;
  const payload = employeeCreateSchema.parse(body);

  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({
      employee: { id: "demo-employee", ...payload },
      temporaryPassword: "demo-password",
    });
  }

  const admin = createSupabaseAdminClient();
  const temporaryPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const { data, error } = await admin.auth.admin.createUser({
    email: payload.email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (error || !data.user) {
    return Response.json(
      { error: error?.message ?? "Could not create the login for this employee." },
      { status: 400 }
    );
  }

  try {
    const employee = await createEmployeeProfile(context.actor, {
      supabaseUserId: data.user.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      position: payload.position,
      skills: payload.skills,
      zones: payload.zones,
    });
    return Response.json({ employee, temporaryPassword });
  } catch (provisioningError) {
    try {
      await admin.auth.admin.deleteUser(data.user.id);
    } catch {
      // If cleanup itself fails, surface the original error below; an
      // orphaned auth user is recoverable manually, a hidden failure is not.
    }
    const message =
      provisioningError instanceof Error
        ? provisioningError.message
        : "Could not create this employee's profile.";
    return Response.json({ error: message }, { status: 400 });
  }
});