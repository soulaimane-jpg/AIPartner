# Production Hardening — Progress Notes

## Slice 1 · Foundations (this branch)

Goal: lay down the primitives every subsequent slice depends on, with
**zero new IDE errors** and **zero changes to runtime behaviour** for
existing flows beyond the one canonical migration.

### Shipped

| Layer | Module | What it does |
|---|---|---|
| Env | `src/env.ts` | Boot-time Zod validation; production-required keys; HSTS/CSP-aware. |
| Schemas | `src/lib/schemas/{base,enums,errors,brief,index}.ts` | Brand-typed IDs (`BriefId`, `UserId`, …), `ActionError` discriminated union, `mapErrorToToast`, brief I/O. |
| RBAC | `src/lib/rbac/{permissions,matrix,can,conditions,types,index}.ts` | 40+ permission strings, 4-role matrix, 9 conditions (`isOwnBrief`, `isMatchedPartner`, …), `can()` + `canStatic()`. |
| Context | `src/lib/action-context.ts` | Per-request `ActionContext`: user, hashed IP, UA, request/trace IDs. |
| Audit | `src/lib/audit.ts` | Append-only `AuditLog` with redaction + 16 KB cap; fire-and-forget. |
| Flags | `src/lib/flags.ts` | Server-side `getFlag()` + `setFlag()` with `FeatureFlagChange` history + 30 s cache. |
| Rate limit | `src/lib/rate-limit.ts` | DB + memory backends, swappable to Redis. |
| Wrapper | `src/lib/actions/define.ts` | `defineAction()` — Zod in/out, auth, RBAC, rate limit, audit, error mapping. |
| Pilot migration | `createBriefAction` in `src/lib/actions/briefs.ts` + caller in `qualification-wizard.tsx` | Canonical example of the new pattern; returns `ActionResult<{briefId}>`. |
| Schema | `prisma/schema.prisma` | New models: `AuditLog`, `FeatureFlag`, `FeatureFlagChange`, `Email`, `RateLimitBucket`. |
| Security | `next.config.mjs` + `public/.well-known/security.txt` | HSTS (prod only), CSP, Permissions-Policy, RFC 9116 disclosure file. |
| Env doc | `.env.example` | Re-organised + documents every new variable. |

### Verification

```sh
npx tsc --noEmit                       # 0 errors
npx next lint --max-warnings=0 --file src/env.ts ... defineAction.ts
                                       # 0 errors/warnings on new files
```

The persistent IDE lints during the session were stale TS-server cache
referencing Prisma fields that exist in the regenerated client; `tsc`
confirmed reality.

### User actions before next slice

1. **Apply schema** — the new tables need to exist in the Postgres
   database before any action that touches them runs:

   ```sh
   npm run db:push
   ```

   (Or `npx prisma db push --schema prisma/schema.prisma`.)

2. **Fill in optional env vars** in your local `.env` as desired.
   None are required for dev; production will fail to boot without
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (≥ 32 chars).

### Next slice candidates

- Admin UI for feature flags + `AuditLogTimeline` component.
- Migrate the remaining 8 Server Actions in `src/lib/actions/` to
  `defineAction`.
- Sentry + PostHog wiring (deps + provider + masking).
- Email queue worker + Resend provider implementation.
- MFA (TOTP) + `AuthSession` model + session revocation UI.
