# GAP_ANALYSIS — v1 codebase vs plan-A (PRD v2)

Three-column classification per plan-A §0: **Exists & conforms** / **Exists but needs refinement** / **Missing**.
Entity mapping: plan-A `Lead` ≈ `ProjectBrief` (pipeline stage machine lives on it) · plan-A `LeadPartnerInvite` ≈ `Match` · existing `Lead` model = Googler referrals (unrelated, unchanged).

## Foundations

| Item (plan-A ref) | Status | Notes |
|---|---|---|
| Append-only audit log (§10) | ✅ Exists & conforms | `AuditLog` + `defineAction` auto-audit |
| Action layer w/ validation/RBAC/rate-limit | ✅ Exists & conforms | `src/lib/actions/define.ts`, `src/lib/rbac/*` |
| Background jobs + cron (§7 substrate) | ✅ Exists & conforms | `JobRun` + `src/lib/jobs/queue.ts` + `/api/cron/jobs` (1-min cadence) |
| Canonical section-key registry (F1, §6.3/§6.7) | ❌ Missing | Brief/proposal use fixed columns |
| Enforced state machines (§5.1/§5.2) | ⚠️ Needs refinement | `ProjectBrief.stage` / `Match.status` strings written ad-hoc (`advanceStageAction` free-writes) |
| Timer engine + `TimerInstance` (§7) | ❌ Missing | No deadline columns, no sweep |
| `PlatformSettings` config (§7) | ❌ Missing | Durations would be constants otherwise |
| Identity-firewall serializers + tests (§8 L1) | ❌ Missing | **Confirmed leak**: `(portal)/briefs/[id]/proposals/page.tsx` includes `partner.partnerProfile` pre-reveal; partner pages read prisma directly |
| Single LLM wrapper (§10) | ✅ Exists & conforms | `src/lib/claude.ts` + `parseLlmJson`, versioned prompt pattern in `ai-sourcing.ts` |

## Modules

| Module | Status | Detail |
|---|---|---|
| **M1 Legal gate** | ❌ Missing (partial mechanics) | Tokenised partner T&C click-in exists (`Match.outreachToken`, acceptance audit fields); no versioned `LegalDocument`/`LegalAcceptance`, no signup/login gate, no admin doc publishing |
| **M2 Onboarding questions** | ⚠️ Needs refinement | Brief-level `procurement/usesCloud/hadPartner` exist; company-level GCP agreement/end-date/discount/resell + skip tracking missing |
| **M3 Brief dual path** | ⚠️ Needs refinement | Path A (AI chat + builder + templates + RiskRadar) strong; Path B (book-a-call, transcript→brief, review loop) missing; no `origin` flag |
| **M4 Triage** | ⚠️ Needs refinement | Triage page + `triagedAt/By/Notes` exist; checklist UI, unified clarification loop, explicit `lead_approved` transition missing |
| **M5 Partner DB & matching** | ⚠️ Needs refinement | Rich `PartnerProfile` + admin pages + source-5 wizard + CSV import route exist; missing `clouds[]`, `sizeBand`, `tncStatus`, `source`, contacts, preference-question config driven by field coverage; `computeMatch` scoring exceeds P0 spec — kept as admin aid |
| **M6 Partner timers/extension/pressure** | ❌ Missing | No T1/T2 deadlines, no extension flow, no competitive notifications, no submission-order stagger. Accept/decline + decline reason exist |
| **M7 Structured proposals** | ⚠️ Needs refinement | `ProposalForm` + `ProposalTemplate` exist but fixed fields; canonical sections, pricing-model options, internal approval, deadline countdown missing |
| **M8 QC + anonymization + comparison** | ❌ Missing | Company-side anonymized profile exists (§8 L2 partial); no `AnonymizedProposal`, LLM entity pass, human diff review, `ComparisonView/Cell`, placeholder labels, staggered release, final release gate |
| **M9 Clarification threads** | ⚠️ Needs refinement | Three ad-hoc systems (`Comment`, `BriefQaQuestion`, `MatchNote`); no unified context-typed threads, no call-slot messages, no thread states |
| **M10 Selection & reveal** | ⚠️ Needs refinement | Shortlist page, `customerPriority`, `IN_FINAL_THREE`, single-winner `selectProposalAction` exist; 1–3 selection, selection timer, separate reveal-consent event, anonymized comparison missing |
| **M11 Meetings & post-meeting** | ⚠️ Needs refinement | `Meeting` + Google Calendar/Meet + admin scheduling strong; slot-confirm loop by partner, selected/not-selected notifications, meeting summaries, three-party NDA doc, deal reporting missing |
| **M12 Admin console** | ⚠️ Needs refinement | Briefs/matches/meetings/partners/audit/flags exist; pipeline Kanban by §5.1 states, timer badges, settings page, anonymization queue, comparison release controls, legal mgmt, metrics missing |
| **§9 Notification matrix** | ⚠️ Needs refinement | `Notification` + `Email` queue + digest exist; the 19-event matrix, template table, reminder offsets missing |

## Golden-rule violations found in v1 (fix first)

1. `src/app/(portal)/briefs/[id]/proposals/page.tsx` — customer sees partner identity pre-reveal (rule 2).
2. No serialization-layer firewall — every partner/company payload is hand-assembled (rule 1/2 risk by construction).
3. `advanceStageAction` allows arbitrary stage writes (rule 3 partially met via audit, but no guard conditions).
4. No timers exist, so no durations are configurable (rule 4 n/a → must be built config-first).
