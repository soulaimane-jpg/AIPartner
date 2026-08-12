import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/enums";

/**
 * Page-level role gate.
 *
 * Middleware already maps path prefixes to roles, and the portal layouts
 * pass `allow` lists to `PortalShell`. Both work — but that means the
 * entire admin surface's authorization rests on a `pathname.startsWith`
 * comparison plus a layout prop. Rename a route group, add a page outside
 * one, or change the matcher, and the gate silently disappears with no
 * test failing.
 *
 * This puts the check next to the data the page reads, which is the only
 * place it can't be lost by a routing change.
 */
export async function requireRole(
  allowed: readonly UserRole[],
  opts: { signInPath?: string } = {},
): Promise<{
  id: string;
  role: UserRole;
  companyId: string | null;
  email: string;
  name: string | null;
}> {
  const session = await auth();
  const signInPath = opts.signInPath ?? "/auth/sign-in";

  if (!session?.user?.id) redirect(signInPath);

  const role = (session.user.role ?? "CUSTOMER") as UserRole;
  if (!allowed.includes(role)) {
    // Not `notFound()`: a wrong-role user landing on an admin URL should
    // be sent somewhere useful, and 404-vs-403 leaks nothing here since
    // the route list is public in the client bundle anyway.
    redirect(signInPath);
  }

  return {
    id: session.user.id,
    role,
    companyId: session.user.companyId ?? null,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
  };
}

/** Admin-only pages. */
export function requireAdmin() {
  return requireRole(["ADMIN"], { signInPath: "/admin/login" });
}

/** Googler portal pages (admins may also view). */
export function requireGoogler() {
  return requireRole(["GOOGLER", "ADMIN"]);
}

/** Partner portal pages (admins may also view). */
export function requirePartner() {
  return requireRole(["PARTNER", "ADMIN"], { signInPath: "/partner/login" });
}
