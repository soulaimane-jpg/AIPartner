# Plan-A implementation — progress log

Status: **all workstreams WS1–WS14 implemented**; `tsc` clean, 94 unit
tests green, production build passes.

## Shipped

| WS | Scope | Key files |
|----|-------|-----------|
| WS1 | Foundations: lead/invite/proposal state machines, timer engine, settings, notify, sections registry, firewall serializers, RBAC | `src/lib/state-machine/*`, `src/lib/timers/*`, `src/lib/settings.ts`, `src/lib/notify.ts`, `src/lib/sections.ts`, `src/lib/serializers/firewall.ts` |
| WS2 | M1 legal gate + M2 onboarding questions | `src/lib/legal.ts`, `src/lib/actions/legal.ts`, `src/app/legal/accept`, `src/app/admin/(portal)/legal` |
| WS3 | M5 partner profile extensions, contacts, admin verification | `src/lib/actions/partner-admin.ts`, partner profile pages |
| WS4 | M3 dual-path brief: book-a-call + transcript→brief LLM + review/confirm | `src/lib/ai/brief-extract.ts`, `src/app/(portal)/briefs/new-call`, `src/lib/actions/brief-intake.ts` |
| WS5 | M9 clarification threads (all context types, firewall-safe relay) | `src/lib/actions/clarifications.ts`, `src/lib/serializers/threads.ts`, `src/components/clarifications/*`, `/briefs/[id]/clarifications` |
| WS6 | M4 triage refit: checklist, clarification loop, approve-as-lead | `src/lib/actions/triage.ts`, `src/app/admin/(portal)/briefs/[id]/triage` |
| WS7 | M6 invites: select→send (T1), accept/decline, T2 + one-time extension, admin resolution | `src/lib/actions/invites.ts`, `src/components/partner/invite-panel.tsx`, `src/components/admin/invite-controls.tsx` |
| WS8 | M7 structured proposal builder, internal approval, submit (rank + war-zone notify) | `src/lib/actions/proposal-builder.ts`, `src/components/partner/structured-proposal-builder.tsx` |
| WS9 | M8 QC, LLM anonymization + human diff review, comparison build/stagger release | `src/lib/actions/qc.ts`, `src/lib/anonymize.ts`, `src/lib/comparison/release.ts`, `/admin/anonymization`, `src/components/admin/qc-controls.tsx` |
| WS10 | M10 comparison grid, team voting, 1–3 selection, distinct reveal consent | `src/lib/actions/selection.ts`, `/briefs/[id]/compare` |
| WS11 | M11 meetings-scheduled transition, summaries, deal reporting (partner + admin) | `src/lib/actions/deals.ts`, `src/components/partner/deal-report-form.tsx` |
| WS12 | M12 settings console (timers + toggles + preference questions) | `/admin/settings`, `src/lib/actions/settings.ts` |
| WS13 | Notification template editor (§9 matrix, override + reset) | `/admin/notifications`, `src/lib/actions/notification-templates.ts` |
| WS14 | Hardening: state-machine/firewall/sections test suites, build | `tests/state-machines.test.ts`, `tests/firewall.test.ts`, `tests/sections.test.ts` |

## Operational notes

- **Timer sweep**: `POST /api/timers/sweep` (cron; header `x-cron-secret`
  = `CRON_SECRET`). Handles T1/T2 expiry, reminders, selection nudges,
  stagger releases.
- **Anonymization**: every LLM pass lands in `/admin/anonymization` as
  `pending_review`; approval blocked if the partner name survives.
- **Reveal**: identity flows only via `isPartnerRevealed()` /
  `isCustomerRevealedToPartner()` in `src/lib/serializers/firewall.ts`.
- **Migrations**: schema changes shipped via `prisma migrate dev`
  (latest: plan-A models — timers, sections, threads, comparison,
  legal, deal reports).

## Residual (deliberately out of P0 scope)

- Slot-based meeting proposal/confirm loop (existing Google-Calendar
  meeting infra used instead).
- Three-party NDA acceptance UI at meeting stage (doc type +
  legal-gate infra ready; wire when template content exists).
- Admin Kanban board with per-card timer badges (list view + per-brief
  panels cover the workflow).
- Payment/fee handling — explicitly out of scope (§1).
