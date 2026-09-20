# Beta Deployment Spec — Auth, Feedback, Credits Page

> This is an addendum to the main spec (files 00–05). Apply after Phase 7 (Public Launch Prep) or in place of it — this document supersedes and expands section 7 of the roadmap for beta launch specifically.

## Scope Decisions (locked)

| Decision | Value |
|---|---|
| "Credits" | An **About/Credits page** attributing the creator/maker — NOT a usage quota or billing system |
| Registration | Open to anyone, no invite gate |
| Login methods | Email magic link **and** Google OAuth |
| Bug reporting | A normal Settings/Feedback page (not a floating widget) |
| Error monitoring | Automatic (Sentry or equivalent), in addition to manual user reports |

---

## 14. Authentication (Multi-User)

### 14.1 Switch from single-user to multi-user

- Change `AUTH_MODE=single_user` → `AUTH_MODE=multi_user` in environment config
- Enable Supabase Auth providers: **Email (magic link)** and **Google OAuth**
- Configure OAuth redirect URLs for both `localhost` (dev) and the production domain in the Supabase dashboard and Google Cloud Console
- Registration is open — no invite code, no waitlist, no approval step

### 14.2 Data migration for the existing single-user account

- On first login after the multi-user switch, detect the pre-existing `SINGLE_USER_ID` row in `users`
- If the logging-in email matches the developer's configured admin email, **link** the existing `series`/`chapters`/`settings` rows to the new authenticated `auth.users.id` instead of creating a fresh empty account
- Provide a one-time migration script (`scripts/migrate-single-user.ts`) that reassigns `user_id` foreign keys across `series`, `settings`, `api_tokens` from the old placeholder UUID to the new real user ID

### 14.3 Row Level Security

- Enable RLS policies exactly as defined in `02-database-schema.md` (`series_owner`, `chapters_owner`, and equivalents for `series_links`, `settings`, `api_tokens`, `feedback`)
- **Mandatory test before beta opens:** create two test accounts, confirm neither can read, update, or delete the other's `series`, `chapters`, or `settings` rows via the API — attempt this both through normal endpoints and by directly querying with a forged `series_id` belonging to the other user

### 14.4 Session handling

- Use Supabase's standard session cookie flow (httpOnly, secure, sameSite=lax)
- Add a logout action in Settings
- Add "delete my account" action: cascades through the FK chain already defined in the schema (`on delete cascade`), then deletes the `auth.users` row via the Supabase Admin API

---

## 15. Feedback & Bug Reporting

### 15.1 Simple settings-page approach (not a floating widget)

Add a **Feedback** section within `/settings` (or a dedicated `/feedback` page linked from Settings):

```
Settings
 └── Feedback & Bugs
      ├── Type: [ Bug | Feature request | General ]
      ├── Message: (textarea)
      ├── Attach screenshot: (optional file upload)
      └── [ Submit ]
```

- On submit, auto-attach non-sensitive context: current app version, browser `userAgent`, and the last page the user was on (`document.referrer` or a tracked `lastPage` value in a cookie)
- Do **not** auto-attach anything containing personal series data beyond what's needed for debugging (e.g. don't dump the user's full library)
- Show a simple confirmation toast: *"Thanks — we'll take a look."*

### 15.2 Schema

```sql
create table feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete set null,
  type          text not null,                 -- 'bug' | 'feature' | 'general'
  message       text not null,
  page_context  text,                          -- e.g. "/series/uuid" or "/trash"
  app_version   text,
  user_agent    text,
  screenshot_url text,                         -- Supabase Storage, optional
  status        text not null default 'open',  -- open | reviewing | resolved | wontfix
  created_at    timestamptz not null default now()
);

create index feedback_status_idx on feedback(status, created_at desc);

alter table feedback enable row level security;

create policy feedback_insert_own on feedback
  for insert with check (user_id = auth.uid());

create policy feedback_select_own on feedback
  for select using (user_id = auth.uid());
```

Note: only the submitting user can read their own feedback; the developer reads everything via the service role key on an internal admin route, not through RLS.

### 15.3 API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/feedback` | Submit new feedback (rate limited: 10/day per user) |
| `GET` | `/api/admin/feedback` | List all feedback (service-role only, gated by admin email check) |
| `PATCH` | `/api/admin/feedback/:id` | Update status |

### 15.4 Minimal admin view

- Route `/admin/feedback`, protected by checking `session.user.email === process.env.ADMIN_EMAIL`
- Plain table: date, type, status dropdown, message, screenshot link, page context
- No need for a polished dashboard — a functional table is sufficient for beta

---

## 16. Automatic Error Monitoring

### 16.1 Tool

Use **Sentry** (free tier: 5,000 errors/month, sufficient for beta).

### 16.2 Setup

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

- Configure `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Set `tracesSampleRate: 0.1` (10% performance tracing, keeps free-tier usage low)
- Set `environment: process.env.NODE_ENV` to distinguish staging vs production errors
- Scrub PII: configure `beforeSend` to strip email addresses and API tokens from error payloads before they leave the client

### 16.3 What gets captured automatically

- Unhandled exceptions in API routes and React components
- Failed `fetch` calls to MangaDex or scraping targets (log as breadcrumbs, not hard errors, since these are expected occasionally)
- Resolver failures — tag with `resolver.source` (mangadex/generic/fallback) so patterns in failures are visible by adapter

### 16.4 Manual bug reports vs automatic errors

Both funnels should end up visible to the developer:
- Automatic → Sentry dashboard
- Manual → `/admin/feedback` table

Cross-reference is optional for v1 (e.g. attaching a Sentry event ID to a feedback submission) — not required for beta launch, can be added later.

---

## 17. Credits / About Page

A static page, not a database-backed feature.

### 17.1 Route

`/about` or `/credits`, linked from the footer or Settings.

### 17.2 Content

```
About Manga Tracker

Made by [Your Name / Handle]
[optional: link to portfolio, GitHub, Twitter/X, contact email]

Built with: Next.js, Supabase, Tailwind CSS, shadcn/ui
Manga metadata powered by the MangaDex API

Version: v0.1.0-beta
[optional: link to changelog or GitHub repo]

This is a beta release — feedback welcome via Settings → Feedback & Bugs.
```

### 17.3 Implementation notes

- Static content, no need for CMS or database table
- Pull `version` from `package.json` at build time (`next.config.js` can expose it via `NEXT_PUBLIC_APP_VERSION`)
- Keep it short — this is attribution, not a marketing page

---

## 18. Public Beta Safety Nets (Recommended, Optional)

> These are not part of the explicit requirements, but flagged because open registration without any usage limits creates real operational risk. Include them only if acceptable — otherwise document the risk and monitor manually.

### 18.1 Why this matters even without a credit/quota system

- The MangaDex API is shared across **all** users of the app under one server-side identity. A single misbehaving account (or a bug causing a retry loop) can trigger MangaDex rate limiting for every user simultaneously.
- Supabase free tier has hard caps on database rows, storage, and monthly active users — a spike in signups or an abuse pattern (e.g. one account saving thousands of URLs via script) can exhaust the tier faster than expected.

### 18.2 Minimum-effort mitigations (does not require a credit system)

| Mitigation | Effort | What it does |
|---|---|---|
| IP-based rate limiting on `/api/save`, `/api/resolve`, `/api/signup` | Low | Upstash Ratelimit or Vercel Edge Middleware — blocks scripted abuse without affecting normal users |
| Global MangaDex concurrency cap | Already specified in main spec | Prevents one user's burst from starving others |
| Max `series` rows per user (soft cap, e.g. 2,000) | Low | Simple `count(*)` check before insert; returns a friendly error, not a hard block — protects DB storage |
| Signup email verification | Built into Supabase Auth | Reduces throwaway/bot accounts |
| Basic CAPTCHA on signup (hCaptcha free tier) | Low | Only if bot signups become a problem — add reactively, not preemptively |

**Recommendation:** ship without any of these initially since it's beta with presumably modest traffic, but add IP-based rate limiting on `/api/save` and `/api/resolve` before announcing publicly — it's a 30-minute task and prevents the most common failure mode (a script or bug looping requests).

---

## 19. Deployment Checklist

| Item | Action |
|---|---|
| Environments | Separate Supabase projects for staging and production |
| Secrets rotation | New `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` for production, never reused from dev |
| Domain | Custom domain on Vercel, HTTPS enforced |
| OAuth config | Google OAuth consent screen configured for production domain, redirect URIs verified |
| Legal minimum | Short ToS + Privacy page — state it's a beta, data may be lost, no warranty |
| Onboarding | First-login screen: brief explainer + link to set up Bookmarklet/Extension |
| Beta banner | Small persistent badge/banner: "Beta — found a bug? Settings → Feedback" |
| Backups | Enable Supabase point-in-time recovery, or a weekly export-to-JSON cron as a cheap fallback |
| Monitoring | Sentry (errors) + Vercel Analytics (traffic), both free tier |
| Admin access | Confirm `ADMIN_EMAIL` env var set correctly, test `/admin/feedback` access control |

---

## 20. Build Phases (Beta) & Acceptance Criteria

### Phase A — Multi-User Auth *(1 day)*

Enable Supabase Auth with magic link + Google OAuth, open registration, migrate the existing single-user data, enable and test RLS.

**Acceptance:** Two independently-created accounts cannot see or modify each other's series/chapters/settings under any tested attack path (forged IDs, direct API calls). The original single-user data is correctly linked to the developer's real account after migration.

### Phase B — Feedback System *(0.5–1 day)*

`feedback` table + RLS, `/api/feedback`, Settings → Feedback page, `/admin/feedback` view gated by `ADMIN_EMAIL`.

**Acceptance:** A logged-in user can submit a bug report with an optional screenshot; the developer can view and update its status at `/admin/feedback`; a non-admin cannot access that route.

### Phase C — Error Monitoring *(0.5 day)*

Sentry integration across client/server/edge, PII scrubbing, environment tagging.

**Acceptance:** A deliberately thrown test error in a dev build appears in the Sentry dashboard within a minute, with no email addresses or tokens visible in the payload.

### Phase D — Credits Page *(< 0.5 day)*

Static `/about` page with attribution, stack credits, MangaDex API acknowledgment, version number.

**Acceptance:** Page renders correctly, version number matches `package.json`, linked from footer/Settings.

### Phase E — Deployment Hardening *(0.5–1 day)*

Separate staging/production Supabase projects, secret rotation, ToS/Privacy pages, beta banner, backups enabled, IP-based rate limiting on `/api/save` and `/api/resolve`.

**Acceptance:** Production environment is fully isolated from dev data. Rate limiting returns a clean error (not a crash) when triggered in a test. Backups are verifiably running.

**Total estimate for beta readiness: 3–4 working days**, assuming the core app (Phases 0–6 from the main spec) is already complete.

---

## 21. Environment Variables (Additions)

```bash
# Auth
AUTH_MODE=multi_user
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...

# Admin
ADMIN_EMAIL=you@example.com

# Error monitoring
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production        # or staging

# App metadata
NEXT_PUBLIC_APP_VERSION=0.1.0-beta

# Optional rate limiting (if adopting §18.2)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## 22. Definition of Done (Beta)

- [ ] Anyone can sign up via email magic link or Google OAuth, no invite required
- [ ] The developer's pre-existing single-user data is correctly migrated to their real account
- [ ] RLS verified: cross-account data access is impossible via API or forged IDs
- [ ] Feedback form works, submissions visible only to the developer via `/admin/feedback`
- [ ] Sentry captures unhandled errors automatically with PII scrubbed
- [ ] `/about` page shows correct attribution, stack, and version
- [ ] Staging and production run on fully separate Supabase projects
- [ ] ToS/Privacy pages published, beta banner visible in the app
- [ ] Backups (PITR or scheduled export) are active and verified
- [ ] (If adopted) IP-based rate limiting confirmed working on save/resolve endpoints