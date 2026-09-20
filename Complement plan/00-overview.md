# Manga Chapter Tracker — Full Implementation Spec

> **Purpose:** This document is a complete, self-contained build specification intended to be handed to an AI coding agent. It assumes no prior conversation context.

---

## 1. Product Overview

### 1.1 Problem

Browser bookmarks and reading lists are poor at tracking manga because each chapter has a different URL. Users accumulate dozens of stale bookmarks pointing to chapters they've already read.

### 1.2 Solution

A web app where saving a new chapter URL **automatically detects it belongs to a series already being tracked**, replaces the old chapter entry, and archives the previous one. One row per series, always pointing at the latest saved chapter.

### 1.3 Core Value Proposition

- Save a chapter URL → system identifies the series → auto-replaces the previous chapter
- One-tap "Continue Reading" from a clean list
- Works across arbitrary manga sites, with first-class support for MangaDex

### 1.4 Scope Decisions (locked)

| Decision | Value |
|---|---|
| Initial users | Single user, but schema and auth designed multi-user from day one |
| Primary platform | Mobile-first responsive web (PWA), must sync across devices |
| Ingestion | Paste URL, Bookmarklet, PWA Share Target, iOS Shortcut, Desktop Extension |
| Old chapters | Soft-archived with 30-day countdown, then hard-deleted by cron |
| Notifications | No push notifications. In-app badges + user-selected status only |
| Budget | Free tier only |
| Failure tolerance | Acceptable that some sites block metadata scraping; manual title entry is the fallback |

### 1.5 Non-Goals

- No manga content hosting, proxying, or reading UI
- No push/email notifications in v1
- No social features, comments, or ratings
- No mobile native apps
- No aggressive scraping or crawling

---

## 2. Architecture

### 2.1 Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) | Single deployable for UI + API |
| Styling | Tailwind CSS + shadcn/ui | |
| Database | Supabase Postgres (free tier) | |
| ORM | Drizzle ORM + drizzle-kit migrations | |
| Auth | Supabase Auth (email magic link) | Disabled behind env flag in single-user mode |
| HTML parsing | `cheerio` | Server-side only (CORS) |
| Validation | `zod` on every API boundary | |
| Hosting | Vercel Hobby | |
| Scheduled jobs | GitHub Actions cron → authenticated HTTP endpoints | More generous than Vercel Hobby cron |
| PWA | `next-pwa` + manifest with `share_target` | |
| Extension | Manifest V3, plain TS, no framework | |
| Testing | Vitest (unit), Playwright (e2e, optional) | |

### 2.2 Repository Layout

```
/
├── app/
│   ├── (app)/
│   │   ├── page.tsx                  # Library (main list)
│   │   ├── series/[id]/page.tsx      # Series detail
│   │   ├── trash/page.tsx            # Archived chapters
│   │   ├── settings/page.tsx         # Settings, tokens, bookmarklet
│   │   └── share/page.tsx            # PWA Share Target receiver
│   └── api/
│       ├── resolve/route.ts
│       ├── save/route.ts
│       ├── undo/route.ts
│       ├── series/route.ts
│       ├── series/[id]/route.ts
│       ├── series/[id]/merge/route.ts
│       ├── series/[id]/next/route.ts
│       ├── chapters/[id]/restore/route.ts
│       ├── export/route.ts
│       ├── import/route.ts
│       └── cron/
│           ├── purge/route.ts
│           └── check-updates/route.ts
├── lib/
│   ├── resolver/
│   │   ├── index.ts                  # Orchestrator
│   │   ├── normalize.ts              # URL normalization
│   │   ├── types.ts
│   │   └── adapters/
│   │       ├── mangadex.ts
│   │       ├── generic-numeric.ts
│   │       └── fallback.ts
│   ├── metadata/fetch-og.ts          # og:title / og:image scraper
│   ├── db/{schema.ts,client.ts}
│   ├── auth.ts
│   └── rate-limit.ts
├── extension/                        # MV3 desktop extension
├── tests/resolver/
└── drizzle/                          # migrations
```

### 2.3 Request Flow — Saving a Chapter

```
Client (paste / bookmarklet / share / extension)
   │
   ▼
POST /api/save { url, title?, statusOverride? }
   │
   ├─ 1. Authenticate (session cookie OR Bearer API token)
   ├─ 2. Rate limit check
   ├─ 3. normalizeUrl(url)
   ├─ 4. resolver.resolve(url)  ──► Adapter chain
   │        ├─ MangaDexAdapter    (API lookup, confidence: high)
   │        ├─ GenericNumeric     (URL pattern, confidence: high|medium)
   │        └─ Fallback           (og:title + host, confidence: low)
   ├─ 5. Find existing series by (user_id, series_key)
   │        ├─ found        → archive current chapter, insert new as current
   │        ├─ not found    → create series + chapter
   │        └─ low conf     → create new + return mergeSuggestions[]
   ├─ 6. Write undo_token (TTL 60s)
   └─ 7. Return { series, chapter, action, undoToken, mergeSuggestions }
```