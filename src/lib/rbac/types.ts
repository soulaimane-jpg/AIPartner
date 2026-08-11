/**
 * Shared types for the RBAC and `defineAction` layers. Keeping these in
 * a leaf module avoids circular imports between `can`, `conditions`,
 * `audit`, and `define`.
 */

import type { UserRole } from "@/lib/enums";

/**
 * The minimal session/user information every Server Action receives.
 *
 * Built once per request from the Auth.js session + a few request
 * headers, then threaded through `defineAction → can → conditions →
 * handler`.
 *
 * Anonymous callers get `user: null` so action handlers must explicitly
 * check authentication (or rely on `defineAction` to short-circuit
 * non-public permissions).
 */
export interface ActionContext {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    companyId: string | null;
  } | null;

  /** Privacy-preserving identifiers used in audit log + rate limiting. */
  ipHash: string | null;
  userAgent: string | null;

  /** Correlation IDs — set by middleware/instrumentation. */
  requestId: string;
  traceId: string | null;
}
