/**
 * `can(ctx, permission, payload)` — the only function callers should use
 * to check authorisation. Looks up the matrix, evaluates a condition if
 * present, and returns a boolean.
 *
 * Async-only: even fast paths return a `Promise<boolean>` so refactors
 * that introduce a DB lookup can't accidentally break callers.
 */

import type { Permission } from "./permissions";
import { MATRIX, type Ability } from "./matrix";
import { getCondition } from "./conditions";
import type { ActionContext } from "./types";

export async function can(
  ctx: ActionContext,
  permission: Permission,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  // Anonymous callers get nothing — Server Actions that legitimately need
  // to be public (e.g. partner T&C accept via tokenised link) should
  // bypass `defineAction`.
  if (!ctx.user) return false;

  const ability: Ability | undefined = MATRIX[ctx.user.role]?.[permission];
  if (ability === true) return true;
  if (ability === false || ability === undefined) return false;

  // Conditional ability — execute the named condition.
  const condition = getCondition(ability);
  try {
    const result = await condition(ctx, payload);
    return Boolean(result);
  } catch {
    // Failing closed: any error in a condition denies the action and
    // surfaces as a `FORBIDDEN` from the action wrapper.
    return false;
  }
}

/**
 * Helper for non-async call sites where a UI hint wants to know whether
 * a button should appear. Skips conditional checks (returns false for
 * any conditional ability), so it's a *lower bound* on real permission.
 */
export function canStatic(
  ctx: ActionContext,
  permission: Permission,
): boolean {
  if (!ctx.user) return false;
  return MATRIX[ctx.user.role]?.[permission] === true;
}
