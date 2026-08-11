# Migrating a Server Action to `defineAction`

The `briefs.ts` migration is the canonical reference. Every action
should look the same once migrated. This is intentionally repetitive —
predictable structure beats clever abstractions.

## Anatomy

```ts
// 1. Define a Zod input schema in `src/lib/schemas/<domain>.ts`.
//    Brand IDs (`BriefId`, `MatchId`, …) where possible.
export const FooInput = z.object({ … });

// 2. The Server Action becomes a `defineAction` call.
export const fooAction = defineAction({
  name: "foo.do",                     // becomes audit kind "action.foo.do"
  input: FooInput,
  output: z.object({ ok: z.literal(true) }),
  permission: "foo.do",               // must exist in src/lib/rbac/permissions.ts
  rateLimit: { scope: "foo.do", limit: 30, windowSec: 60 }, // optional
  handler: async (parsed, ctx) => {
    // Use ctx.user.id / ctx.user.companyId — never call `auth()` again.
    // Throw via fail({ code: "..." }) for typed errors.
    return { ok: true };
  },
});
```

## Caller migration

Old:

```ts
try { await fooAction(args); } catch (e) { toast.error(e.message); }
```

New:

```ts
const result = await fooAction(args);
if (!result.ok) {
  toast.error(mapErrorToToast(result.error));
  return;
}
// success path
```

## Permissions to add when migrating

| Action file | New permissions to land in `permissions.ts` |
|---|---|
| `collaborators.ts` | `collaborator.invite`, `collaborator.remove`, `collaborator.approve` (already present) |
| `partner.ts` | `partner.profile.update`, `partner.profile.publish` (already present) |
| `proposals.ts` | `proposal.create`, `proposal.update`, `proposal.submit` (already present) |
| `admin.ts` | `admin.triage`, `admin.bulk-action` (already present) |
| `chat.ts` | `brief.update` (chat is an update channel for the brief) |
| `onboarding.ts` | `tenant.member.invite` (already present) |
| `googler.ts` | `tenant.member.invite` for partner team add; admin perms for googler creation |
| `auth.ts` | `auth.session.revoke`, `auth.mfa.configure` (already present) |

## Migrating actions that `redirect()`

`defineAction` returns `ActionResult` and cannot `redirect()` itself
(it would prevent serialising the response). Two patterns:

### Pattern A — return path, redirect from client

```ts
output: z.object({ briefId: z.string() }),
handler: async (...) => { … return { briefId }; }
```

```tsx
const result = await fooAction(...);
if (result.ok) router.push(`/foo/${result.data.briefId}`);
```

Used by `createBriefAction`, `submitBriefAction`.

### Pattern B — separate redirect adapter

When the action is invoked from a `<form action>` you need a server
function that throws `redirect()`. Create a thin adapter:

```ts
export async function fooAndRedirect(input: unknown): Promise<never> {
  const result = await fooAction(input);
  if (!result.ok) throw new Error(mapErrorToToast(result.error));
  redirect(`/foo/${result.data.id}`);
}
```

## Files left to migrate

Tackle these as **separate PRs**, one file at a time. Each migration
should:
1. Move all action exports in the file to `defineAction`.
2. Update every caller in the same PR.
3. Add a regression test if any action gained new logic.

| File | LOC | Action count | Risk |
|---|---|---|---|
| `lib/actions/collaborators.ts` | 432 | ~6 | Medium — touches BriefCollaborator + invites |
| `lib/actions/admin.ts` | 396 | ~5 | High — admin operations, broad reach |
| `lib/actions/partner.ts` | 339 | ~5 | High — partner profile + publishing |
| `lib/actions/auth.ts` | 202 | ~3 | High — auth flows, run integration tests |
| `lib/actions/googler.ts` | 193 | ~3 | Low — narrow surface |
| `lib/actions/chat.ts` | 143 | ~2 | Medium — LLM streaming |
| `lib/actions/proposals.ts` | 130 | ~3 | Medium |
| `lib/actions/onboarding.ts` | 128 | ~2 | Low |

Total ≈ 30 actions. Budget ~4-6 hours per file for safe migration with
test coverage.
