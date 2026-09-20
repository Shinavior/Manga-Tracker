# Build Phases, Risks, Config, DoD

## 10. Build Phases & Acceptance Criteria

### Phase 0 — Resolver Spike *(0.5 day)*

**Deliverable:** `lib/resolver/*` + passing test suite. No UI, no database.

**Acceptance:**
- All cases in the resolver test suite pass with mocked network
- Nekopost ch.1 and ch.2 produce an identical `seriesKey`
- Two different MangaDex chapter UUIDs of the same manga produce an identical `seriesKey`
- Malicious/invalid URLs are rejected with the correct error codes
- `pnpm test` is green, coverage on `lib/resolver` ≥ 90%

### Phase 1 — MVP *(2–3 days)*

Next.js scaffold, Drizzle schema + migrations, Supabase connection, single-user auth via env secret, `/api/resolve`, `/api/save`, `/api/series`, Library page with paste-to-save, auto-replace behavior, rename, Continue button.

**Acceptance:** Saving `nekopost.net/manga/17045/1` then `/2` results in exactly **one** row in the Library showing Ch. 2, with Ch. 1 archived. Data persists across devices.

### Phase 2 — MangaDex Adapter *(1 day)*

Full adapter, `resolve_cache` table, rate limiting + backoff, `/api/series/:id/next`, Next button in UI.

**Acceptance:** Saving two different chapter UUIDs of the same MangaDex title merges into one entry with the correct title and cover. Next button navigates correctly. No 429 errors under normal use.

### Phase 3 — Mobile Ingestion *(1–2 days)*

PWA manifest + service worker + install prompt, `/share` route, bookmarklet generator, API token system, iOS Shortcut file.

**Acceptance:** On an Android phone, sharing a chapter from Chrome to the installed PWA saves it in under 3 seconds. On iOS, the Shortcut does the same.

### Phase 4 — Polish *(2 days)*

Metadata scraping (`og:title`/`og:image`) with graceful failure, status system, tags, full-text search, filters, trash page with countdown, undo tokens + toasts, merge UI + suggestions.

**Acceptance:** A Cloudflare-protected URL still saves successfully and prompts for a manual title. Undo fully reverses a save within 60 seconds. Trash shows accurate days remaining.

### Phase 5 — Automation *(1–2 days)*

Purge cron, update-check cron, per-host backoff, import/export with dry-run preview.

**Acceptance:** Chapters past `purge_at` are deleted on schedule. Update badges appear for series with new chapters. A browser bookmark HTML file imports and correctly groups chapters into series.

### Phase 6 — Desktop Extension *(2 days)*

MV3 extension, popup, badge state, keyboard shortcut, options page, packaging for Chrome + Firefox.

**Acceptance:** One click from any manga page saves correctly; badge shows tracked state on revisit.

### Phase 7 — Public Launch Prep *(2–3 days)*

Supabase Auth (magic link), RLS policies enabled and tested, per-user rate limiting, onboarding flow, ToS/Privacy pages, error monitoring, basic analytics.

**Acceptance:** Two separate accounts cannot see or modify each other's data (verified by test). Rate limits enforced. Sign-up → first save completes in under 60 seconds.

**Total estimate: 12–16 working days.**

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| MangaDex rate limiting / API changes | High | Cache aggressively (chapter→manga mapping is immutable), exponential backoff, pin to documented endpoints, degrade to generic adapter on failure |
| Cloudflare / bot protection blocks scraping | Medium | Metadata fetch is **always** optional — never block a save. Prompt for manual title. Cache failures per host for 7 days |
| Site changes its URL structure | Medium | `series_links` supports multiple patterns per series; manual merge always available; `needs_review` flag surfaces suspicious entries |
| False-positive merges (wrong series combined) | High | Never auto-merge on low confidence; 60-second Undo on every save; "Separate" action on medium-confidence merges |
| Soft-404s produce false "new chapter" badges | Low | Content-length heuristic; label unverified results as "Possibly available" |
| Supabase free tier auto-pause | Medium | Daily cron keeps the project active; document the manual resume procedure |
| Vercel Hobby function timeout (10s) | Medium | Hard 8s timeout on all outbound fetches; move update-check batching to the cron endpoint with small page sizes |
| SSRF via user-supplied URLs | High | Block private IP ranges and non-http(s) protocols; resolve DNS and re-verify before fetching; no redirects to private hosts |
| Legal / ToS concerns about scraping | Medium | Only fetch pages the user explicitly saves, respect `robots.txt` for the update-check crawler, identify via User-Agent, no content storage |

---

## 12. Environment Variables

```bash
# Database
DATABASE_URL=postgres://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server only

# App
APP_URL=https://mangatrack.vercel.app
NODE_ENV=production

# Auth mode
AUTH_MODE=single_user               # single_user | multi_user
SINGLE_USER_SECRET=...              # used when AUTH_MODE=single_user
SINGLE_USER_ID=uuid                 # seeded user row

# Jobs
CRON_SECRET=...

# Outbound identity
SCRAPER_USER_AGENT="MangaTracker/1.0 (+https://mangatrack.vercel.app)"

# Tuning
MAX_FETCH_BYTES=1048576
FETCH_TIMEOUT_MS=8000
MANGADEX_MAX_CONCURRENT=2
```

---

## 13. Definition of Done (v1)

- [ ] Saving chapter N then N+1 of the same series yields one library entry, auto-updated
- [ ] MangaDex UUID chapters correctly merge into a single series with title and cover
- [ ] Old chapters are archived with a visible 30-day countdown and can be restored
- [ ] Undo fully reverses any save within 60 seconds
- [ ] Manual rename persists and always overrides auto-fetched titles
- [ ] Continue and Next buttons work on both generic sites and MangaDex
- [ ] Status, tags, search, and filters all function on a library of 100+ entries
- [ ] Android PWA Share Target and iOS Shortcut both save successfully
- [ ] Bookmarklet works on desktop Chrome and Firefox
- [ ] Desktop extension saves with one click and shows tracked-state badge
- [ ] Export produces valid JSON that re-imports losslessly
- [ ] Browser bookmark HTML import correctly groups chapters into series
- [ ] Cron purge and update-check run reliably on schedule
- [ ] Metadata fetch failure never prevents a save
- [ ] Resolver test suite passes at ≥90% coverage
- [ ] Lighthouse mobile performance ≥ 90, PWA installable
- [ ] RLS verified: cross-account data access is impossible