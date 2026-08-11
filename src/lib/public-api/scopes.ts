/**
 * Public-API scope catalogue.
 *
 * Lives in its own module (not in `actions/public-api-keys.ts`) because
 * a Next.js `"use server"` file may only export async functions —
 * exporting the scope tuple from there would break the build.
 */

export const API_SCOPES = [
  "*", // owner key — full access; reserved for ADMIN.
  "briefs:read",
  "briefs:write",
  "matches:read",
  "matches:write",
  "proposals:read",
  "proposals:write",
  "directory:read",
  "subprocessors:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
