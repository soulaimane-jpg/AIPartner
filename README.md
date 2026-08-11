# PartnerMatch — GCP Customer ⇄ Partner matching platform

A modern, production-grade rebuild of a GCP partner-matching platform: turn a
business problem into an actionable Statement of Work, match qualified Google
Cloud partners, receive side-by-side proposals, and select the right partner.

Three portals in one product:

- **Customer** — describe a problem, let the AI structure a Project Brief,
  compare proposals.
- **Partner** — receive qualified, anonymized briefs, submit structured
  proposals, manage company profile and specializations.
- **Admin** — oversee the pipeline, move briefs across stages, assign partners,
  inspect users and companies.

## Tech stack

| Concern          | Choice                                                |
| ---------------- | ----------------------------------------------------- |
| Framework        | Next.js 15 App Router + Turbopack + Server Actions    |
| Language         | TypeScript (strict)                                   |
| UI               | Tailwind CSS, shadcn/ui (Radix), Lucide icons         |
| Data             | Prisma ORM + SQLite (dev) — swap to Postgres for prod |
| Auth             | Auth.js v5 (Credentials provider, JWT sessions)       |
| Validation       | Zod + React Hook Form                                 |
| Toasts           | Sonner                                                |
| AI (optional)    | Provider-agnostic server action (OpenAI-ready)        |

## Architecture

```
src/
  app/
    (marketing)/            # Public landing + pricing (shared shell)
    auth/                   # Customer sign-in / sign-up
    partner/                # Partner portal + split-screen login + profile
    admin/                  # Admin portal (dark login, sidebar shell)
    (portal)/               # Customer-authenticated shell
      dashboard/            # Pipeline cards + notifications
      briefs/
        new/                # 3-step qualification wizard
        [id]/builder/       # AI chat Project Brief builder
        [id]/preview/       # Structured SOW document
        [id]/proposals/     # Side-by-side proposal comparison
    api/auth/[...nextauth]/ # Auth.js route handlers
  components/               # Reusable UI + domain widgets (shadcn + app)
  lib/
    auth.ts                 # NextAuth config
    prisma.ts               # Prisma client (single instance)
    enums.ts                # SQLite-safe string-union enums
    constants.ts            # Brand, pipeline, services, GCP specializations
    brief.ts                # Completion heuristic, stage helpers
    actions/                # Server Actions (auth, briefs, chat, proposals, partner, admin)
    types/                  # Shared types (kept out of 'use server' files)
  middleware.ts             # Role-based route guards
prisma/
  schema.prisma             # Single DB schema, SQLite-compatible
  seed.ts                   # Deterministic seed with demo accounts
```

### Design principles
- **Server-first** — pages are server components; client components only where
  interactivity is required (chat, wizard, forms).
- **Server Actions** — all writes go through typed, Zod-validated actions.
  Predictable, testable, no hand-rolled API routes.
- **Role-based guards** — `src/middleware.ts` redirects unauthenticated users to
  the correct sign-in surface and blocks cross-role access.
- **No native enums** — string unions + a central `enums.ts` keep the DB portable
  to Postgres/MySQL and the types sharp.
- **Progressive completion** — `computeCompletion()` derives a progress score
  from filled brief fields; the submit gate uses it.

## Getting started

```bash
npm install            # installs and runs prisma generate
npx prisma db push     # creates prisma/dev.db with the schema
npm run db:seed        # loads demo accounts + briefs + proposals
npm run dev            # starts dev server at http://localhost:3000
```

### Demo accounts (pre-seeded)

| Role     | Email                              | Password       |
| -------- | ---------------------------------- | -------------- |
| Admin    | `admin@test.com`                   | `admin123.`    |
| Partner  | `testpartner@partnermatch.cloud`   | `Partner123!`  |
| Customer | `simon@optiocean.com`              | `Customer`     |

Sign-in surfaces:
- Customer: `/auth/sign-in`
- Partner:  `/partner/login`
- Admin:    `/admin/login`

## Key flows

### Customer
1. `/auth/sign-up` → creates a Customer user + Company.
2. `/briefs/new` — 3-step qualification (cloud usage, procurement, service
   categories).
3. `/briefs/:id/builder` — AI-assisted chat that extracts structured brief
   fields on every turn and updates completion.
4. `/briefs/:id/preview` — full SOW preview with pipeline, submit gate
   (≥ 40% completion).
5. `/briefs/:id/proposals` — side-by-side proposal comparison + partner
   selection.

### Partner
1. `/partner/login` — split-screen login with partner value prop sidebar.
2. `/partner` — 5-KPI dashboard (Open, In Progress, Submitted, Active, Won) +
   5 tabs mirroring the funnel.
3. `/partner/briefs/:id` — detail view with anonymized brief + right-rail
   proposal form (summary, approach, timeline, cost, team composition,
   strengths).
4. `/partner/profile` — Company / Google Cloud / Team tabs, specializations,
   tier, team invites.

### Admin
- `/admin` — KPIs, pipeline-by-stage counts, recent briefs.
- `/admin/briefs/:id` — stage controls, assign partner to create a Match +
  Proposal stub, visualize current matches.
- `/admin/partners` — directory of partners with tier and specializations.
- `/admin/users` — all platform users with role badges.
- `/admin/matches` — every match with proposal status and quick links.

## Environment

Copy `.env.example` to `.env` and adjust:

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<long-random-string>"
AUTH_TRUST_HOST="true"
OPENAI_API_KEY=""       # optional; assistant falls back to deterministic logic
```

## Promoting to production

1. Switch Prisma provider to `postgresql` and set `DATABASE_URL`.
2. Set `AUTH_SECRET` to a 32+ byte random string.
3. `npm run build && npm start` — Next.js runs Server Actions and API routes.
4. The AI assistant in `src/lib/actions/chat.ts` is deliberately isolated —
   replace `simulateAssistant()` with a streaming call to OpenAI / Vertex AI
   without touching the rest of the platform.

## Scripts

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Dev server (Turbopack)                            |
| `npm run build`    | Prisma generate + production build                |
| `npm start`        | Run production server                             |
| `npm run db:push`  | Sync Prisma schema to SQLite                      |
| `npm run db:seed`  | Reset + seed demo data                            |
| `npm run db:studio`| Launch Prisma Studio to inspect/edit the DB       |
| `npm run typecheck`| `tsc --noEmit`                                    |
| `npm run lint`     | Next.js / ESLint                                  |

## License

Proprietary — demo scaffold. Swap in your license before deploying.
