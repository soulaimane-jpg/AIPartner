# IMPLEMENTATION_PLAN — plan-A production build

Scope: all P0 + all P1 (P2 excluded per plan-A §12). Sequenced per plan-A §13. Each workstream is a reviewable boundary.

## Workstreams

| WS | Deliverable | Depends on |
|---|---|---|
| WS1a | Prisma schema additions (all additive; see below) | — |
| WS1b | Canonical section registry `src/lib/sections.ts` | — |
| WS1c | State-machine module `src/lib/state-machine/` (lead §5.1, invite §5.2, proposal §5.3) — all transitions guarded + audited | WS1a |
| WS1d | Timer engine `src/lib/timers/` (`TimerInstance` sweep via job queue) + `PlatformSettings` service + admin Settings page | WS1a |
| WS1e | Identity firewall `src/lib/serializers/` + proposals-page leak fix + leak test suite | WS1a |
| WS2 | M1 legal gate (versioned docs, acceptance gate, admin publishing) + M2 onboarding questions w/ skip tracking | WS1a |
| WS3 | M5 partner DB extensions, contacts, preference-question config, preferences step relocation | WS1a |
| WS4 | M3 Path B: call booking, transcript upload, LLM transcript→brief, review loop, `origin` flag | WS1b |
| WS5 | M9 unified clarification threads (context types, call slots, states, firewall participants) | WS1e |
| WS6 | M4 triage refit: checklist, clarification loop, `lead_approved` gate | WS1c, WS5 |
| WS7 | M6 invites & timers: T1/T2, one-time extension, expiry transitions, competitive notifications, submission order + stagger | WS1c, WS1d |
| WS8 | M7 proposal builder: canonical sections, pricing models, guidance, internal approval, countdown | WS1b, WS7 |
| WS9 | M8 QC + anonymization pipeline (LLM pass → human diff review) + comparison builder + release gate + stagger | WS8, WS1e |
| WS10 | M10 comparison view (customer), voting, 1–3 selection + timer, reveal-consent gate | WS9 |
| WS11 | M11 selected/not-selected notifications, slot confirm loop, meeting summaries, three-party NDA, deal reporting | WS10 |
| WS12 | M12 pipeline Kanban, timer badges, anonymization queue, release controls, legal mgmt, metrics | alongside WS6–11 |
| WS13 | §9 notification matrix (19 events) + `NotificationTemplate` admin editing | WS1d |
| WS14 | Hardening: firewall/state-machine/timer test suites, E2E happy path §3.2 | all |

## Schema additions (all additive — no destructive migration)

New models: `PlatformSetting`, `TimerInstance`, `LegalDocument`, `LegalAcceptance`, `PartnerContact`, `BriefSection`, `ProposalSection`, `AnonymizedProposal`, `ComparisonView`, `ComparisonCell`, `ClarificationThread`, `ClarificationMessage`, `ProposalVote`, `NotificationTemplate`, `DealReport`, `PreferenceQuestion`.

Column additions:
- `CustomerProfile`: `employeeCountBand`, `gcpAgreementStatus`, `gcpContractEndDate`, `gcpDiscountPct`, `resellInterest`, `onboardingQuestionsState`
- `PartnerProfile`: `clouds`, `sizeBand`, `tncStatus`, `tncVersion`, `source`
- `ProjectBrief`: `origin`, `callRecordingRef`, `callTranscript`, `anonymizedCompanySummary`, `selectionDeadlineAt`, `partnerPreferences`
- `Match`: `acceptDeadlineAt`, `proposalDeadlineAt`, `extensionUsed`, `extensionRequestedAt`, `extensionNote`, `extensionResolvedAt`, `extensionGrantedBy`, `placeholderLabel`
- `Proposal`: `internalApprovedById`, `internalApprovedAt`, `qcPassedAt`, `releasedAt` (+ extended status values in enums)

State mapping (`ProjectBrief.stage` legacy → §5.1): documented in `src/lib/state-machine/lead.ts`; legacy values remain readable, new transitions write new states.

## Settings keys (§7) seeded at first read

`lead_accept_hours=48`, `proposal_submit_hours=48`, `extension_hours=24`, `company_select_hours=48`, `stagger_hours=2`, `reminder_offsets_hours=[24,4]`, `weekend_leeway_mode=off`, `competitive_notifications_enabled=true`, `brief_draft_reminder_days=5`.

## Verification

- Firewall: `tests/firewall.test.ts` — deny-list assertions over every partner/company-facing serializer (blocking).
- State machine: table-driven tests for every §5.1/§5.2 row incl. guards.
- Timers: clock-injected expiry tests (T1, T2, extension, selection, stagger).
- E2E: §3.2 happy path.

## Progress log

- **WS1 DONE** — schema pushed (provider fixed mysql→postgresql; `leadState` added; `title` aligned to DB Text), `src/lib/sections.ts`, `src/lib/state-machine/{lead,invite,proposal,transition}.ts`, `src/lib/settings.ts`, `src/lib/timers/{index,handlers}.ts`, `src/lib/notify.ts` (§9 templates), `src/lib/comparison/release.ts` (stagger), `/api/cron/timers`, `src/lib/serializers/firewall.ts` + proposals-page leak fix. Tests: `tests/{firewall,state-machine}.test.ts` — 85 passing (`npm test`). Vitest configured (`vitest.config.ts`, server-only stub).
- **WS2 DONE** — RBAC: new plan-A permissions in `permissions.ts` + matrix rows (admin ⛔ on `proposal.approve-internal`/`vote.cast`). M1: `src/lib/legal/documents.ts` (versioned docs, placeholder seed, acceptance), `src/lib/actions/legal.ts`, gate in `PortalShell`, `/legal/accept` UI, `/admin/legal` console. M2: `src/lib/actions/company-onboarding.ts` (skippable questions + skip tracking), `/onboarding/company` UI, survey→company→tutorial chain.
- NOTE: IDE TS-server shows stale Prisma-type errors in `timers/handlers.ts` etc. — `npx tsc --noEmit` is clean; restart TS server.
- NEXT: WS3 (M5 partner extensions + PreferenceQuestion admin), then WS4 (M3 dual-path brief).
