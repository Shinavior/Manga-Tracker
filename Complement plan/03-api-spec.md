# API Specification & Update Checking

## 5. API Specification

All endpoints return JSON. Errors use:

```json
{ "error": { "code": "INVALID_URL", "message": "Human readable" } }
```

**Error codes:** `INVALID_URL`, `BLOCKED_HOST`, `UNAUTHORIZED`, `RATE_LIMITED`, `NOT_FOUND`, `RESOLVE_FAILED`, `UPSTREAM_ERROR`, `CONFLICT`, `VALIDATION_ERROR`

**Auth:** session cookie (web UI) **or** `Authorization: Bearer <api_token>` (bookmarklet, extension, shortcut).

### 5.1 Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/resolve` | Dry-run preview — resolve without persisting |
| `POST` | `/api/save` | Resolve + upsert + archive previous chapter |
| `POST` | `/api/undo` | Reverse the last save using a token |
| `GET` | `/api/series` | List with filters, search, pagination |
| `GET` | `/api/series/:id` | Detail + chapter history |
| `PATCH` | `/api/series/:id` | Update title, status, tags, cover |
| `DELETE` | `/api/series/:id` | Delete series (cascades to chapters) |
| `POST` | `/api/series/:id/merge` | Merge another series into this one |
| `GET` | `/api/series/:id/next` | Compute/return next chapter URL |
| `POST` | `/api/series/:id/read` | Mark opened → status `reading`, bump `last_read_at` |
| `GET` | `/api/chapters?archived=true` | Trash listing with days remaining |
| `POST` | `/api/chapters/:id/restore` | Restore an archived chapter to current |
| `DELETE` | `/api/chapters/:id` | Permanently delete a chapter |
| `GET` | `/api/export` | Full JSON export |
| `POST` | `/api/import` | Import JSON or browser bookmark HTML |
| `POST` | `/api/cron/purge` | Hard-delete chapters past `purge_at` |
| `POST` | `/api/cron/check-updates` | Detect new chapters |

### 5.2 Key Contracts

**`POST /api/save`**

```jsonc
// Request
{
  "url": "https://www.nekopost.net/manga/17045/2",
  "title": "optional user-provided title",      // wins over auto_title
  "tags": ["action"],                            // optional, only on creation
  "status": "unread"                             // optional override
}

// 200 Response
{
  "action": "updated",          // created | updated | noop
  "wentBackward": false,
  "series": {
    "id": "uuid",
    "title": "Series Name",
    "coverUrl": "https://…",
    "status": "unread",
    "tags": ["action"],
    "seriesKey": "nekopost.net/manga/17045/{ch}",
    "confidence": "high",
    "needsReview": false
  },
  "chapter": {
    "id": "uuid",
    "url": "https://nekopost.net/manga/17045/2",
    "label": "Ch. 2",
    "number": 2
  },
  "archivedChapter": { "id": "uuid", "label": "Ch. 1", "purgeAt": "2026-03-15T…" },
  "undoToken": "ut_xxx",        // valid 60s
  "mergeSuggestions": []        // populated only when confidence === 'low'
}
```

**`GET /api/series`**

Query params: `status` (CSV), `tag` (CSV), `q` (search), `sort` (`updated|title|chapter|created`), `order` (`asc|desc`), `cursor`, `limit` (default 50, max 200), `needsReview` (bool), `hasUpdate` (bool)

```jsonc
{
  "items": [
    {
      "id": "uuid",
      "title": "Series Name",
      "coverUrl": "https://…",
      "status": "reading",
      "tags": ["action","isekai"],
      "currentChapter": { "label": "Ch. 2", "url": "https://…", "number": 2 },
      "nextChapterUrl": "https://nekopost.net/manga/17045/3",
      "hasUpdate": true,
      "needsReview": false,
      "lastReadAt": "2026-02-10T…",
      "updatedAt": "2026-02-12T…"
    }
  ],
  "nextCursor": "eyJ…",
  "total": 132
}
```

**`POST /api/undo`** — `{ "token": "ut_xxx" }` → restores the archived chapter to current, deletes the newly-created chapter, and deletes the series entirely if it was created by that save. Tokens are single-use.

**`GET /api/series/:id/next`** — returns `{ "url": "https://…", "verified": true, "chapterNumber": 3 }` or `{ "url": null, "reason": "not_found" | "unsupported" | "upstream_error" }`. Cached 6 hours in `series.next_chapter_url`.

### 5.3 Rate Limits

| Scope | Limit |
|---|---|
| `/api/save`, `/api/resolve` per user | 60/hour |
| Outbound to MangaDex API | 5 req/sec global, max 2 concurrent |
| Outbound metadata scrape per host | 1 req/2s |
| `/api/import` | 5/day |

---

## 6. Update Checking

Runs daily via GitHub Actions cron. **Maximum one check per series per 24 hours.**

**MangaDex series:** fetch the manga feed filtered by the series' language, ordered by chapter descending, limit 1. If the top chapter number exceeds the user's current chapter → set `has_update = true`, cache `next_chapter_url`.

**Generic series with a known `{ch}` pattern:** issue a `HEAD` request to `currentChapter + 1`. A 2xx response means a new chapter exists.

**Important caveats to implement:**
- Many sites return HTTP 200 with a soft-404 page. Mitigate by also comparing `Content-Length` against the current chapter's response — if it differs by less than 10%, treat as likely valid; otherwise mark `verified: false` and let the UI say *"Possibly available"*
- Sites behind bot protection will fail; record the failure and back off that host for 7 days
- Never check `paused` or `dropped` series
- Process at most 200 series per cron run, oldest `last_checked_at` first

**Cron workflow:**

```yaml
# .github/workflows/cron.yml
name: Scheduled Jobs
on:
  schedule:
    - cron: '0 3 * * *'    # purge, daily 03:00 UTC
    - cron: '0 4 * * *'    # update check, daily 04:00 UTC
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Purge expired chapters
        run: |
          curl -fsS -X POST "$APP_URL/api/cron/purge" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
      - name: Check for updates
        run: |
          curl -fsS -X POST "$APP_URL/api/cron/check-updates" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

This also keeps the Supabase free-tier project from auto-pausing due to inactivity.