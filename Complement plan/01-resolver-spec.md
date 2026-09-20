# Resolver Specification

> Build and fully test this **before** any UI work. Everything else is standard CRUD.

## 3.1 Types

```ts
// lib/resolver/types.ts

export type Confidence = 'high' | 'medium' | 'low';

export interface ResolveResult {
  seriesKey: string;          // Stable unique identifier for the series
  source: string;             // 'mangadex' | 'generic' | 'fallback'
  seriesTitle?: string;
  coverUrl?: string;
  chapterNumber?: number;     // Numeric, supports decimals (10.5)
  chapterLabel: string;       // Human display, e.g. "Ch. 10.5", "Extra 1"
  chapterUrl: string;         // Normalized canonical URL
  language?: string;          // ISO code, if known
  confidence: Confidence;
  urlPattern?: string;        // e.g. "nekopost.net/manga/17045/{ch}"
  meta?: Record<string, unknown>;
}

export interface SiteAdapter {
  name: string;
  /** Cheap synchronous check — does this adapter handle this URL? */
  match(url: URL): boolean;
  /** Resolve the URL into series + chapter info. May perform network I/O. */
  resolve(url: URL): Promise<ResolveResult>;
  /** Optionally compute the next chapter URL. */
  nextChapterUrl?(ctx: NextChapterContext): Promise<string | null>;
}

export interface NextChapterContext {
  seriesKey: string;
  currentUrl: string;
  currentChapterNumber?: number;
  urlPattern?: string;
  language?: string;
  meta?: Record<string, unknown>;
}
```

## 3.2 URL Normalization

```ts
// lib/resolver/normalize.ts

const TRACKING_PARAMS = [
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
  'fbclid','gclid','ref','ref_src','source','igshid','mc_cid','mc_eid',
];

export function normalizeUrl(input: string): URL {
  const u = new URL(input.trim());

  // Force https for known-safe hosts; otherwise preserve
  if (u.protocol === 'http:') u.protocol = 'https:';

  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';

  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);

  // Sort remaining params for deterministic keys
  const sorted = new URLSearchParams([...u.searchParams.entries()].sort());
  u.search = sorted.toString();

  // Strip trailing slash (but keep root "/")
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');

  return u;
}
```

**Rules:**
- Reject non-`http(s)` protocols with `400 INVALID_URL`
- Reject private/loopback hosts (`localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, `[::1]`) — SSRF protection
- Max URL length: 2048 chars

## 3.3 Adapter: MangaDex

MangaDex chapter URLs use opaque UUIDs that cannot be pattern-matched:

```
https://mangadex.org/chapter/e4e5b2d6-7488-45fb-a079-b24458d822e8
https://mangadex.org/chapter/f5ec3671-22f9-49ef-b389-9f10f3291071
```

These are consecutive chapters of the same series, but share no textual similarity. **The only correct solution is to call the MangaDex API.**

```ts
// lib/resolver/adapters/mangadex.ts

const API = 'https://api.mangadex.org';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

match(url: URL) {
  return url.hostname === 'mangadex.org'
      && /^\/chapter\/[0-9a-f-]{36}/i.test(url.pathname);
}
```

**Resolution steps:**

1. Extract chapter UUID from path segment index 1
2. `GET {API}/chapter/{chapterId}` →
   - `data.attributes.chapter` → chapter number (string, may be `null` for oneshots)
   - `data.attributes.title` → chapter title
   - `data.attributes.translatedLanguage` → language code
   - `data.attributes.volume` → volume
   - `data.relationships[]` where `type === 'manga'` → **manga UUID (the series key)**
3. `GET {API}/manga/{mangaId}?includes[]=cover_art` →
   - `attributes.title.en` (fallback: first available key in `attributes.title`, then `altTitles`)
   - `relationships[]` where `type === 'cover_art'` → `attributes.fileName`
4. Cover URL: `https://uploads.mangadex.org/covers/{mangaId}/{fileName}.256.jpg`
5. Return `seriesKey = "mangadex:{mangaId}"`, `confidence = 'high'`

**Next chapter:** query the manga feed endpoint, which is the documented way to list a manga's chapters:

```
GET {API}/manga/{mangaId}/feed
      ?translatedLanguage[]={lang}
      &order[chapter]=asc
      &limit=500
      &offset={n}
      &includeExternalUrl=0
```

Find the first entry whose numeric `chapter` is greater than the current one, then return `https://mangadex.org/chapter/{thatChapterId}`.

**Operational requirements:**
- Send a descriptive `User-Agent` identifying the app + contact URL
- Cache `chapterId → {mangaId, chapterNumber, language}` permanently in `resolve_cache` (immutable data)
- Cache `mangaId → {title, coverUrl}` with 7-day TTL
- Cache feed results with 6-hour TTL
- On HTTP 429: exponential backoff (1s, 2s, 4s, 8s), max 4 retries, then fail gracefully
- Global concurrency limit of 2 simultaneous requests to MangaDex
- Also match `mangadex.org/title/{uuid}` → series-only entry with no chapter

## 3.4 Adapter: Generic Numeric

Handles the majority of manga sites, including Nekopost.

**Algorithm:**

1. Split normalized pathname into segments
2. Scan **right to left** for the first segment matching a chapter pattern:

| Priority | Pattern | Regex | Example |
|---|---|---|---|
| 1 | Prefixed decimal | `/^(chapter\|chap\|ch\|ep\|episode\|tuyen)[-_]?(\d+(?:\.\d+)?)$/i` | `chapter-10.5` |
| 2 | Bare number | `/^\d+(?:\.\d+)?$/` | `1`, `2`, `10.5` |
| 3 | Suffixed | `/^(\d+(?:\.\d+)?)[-_]?(chapter\|ch)$/i` | `1050-chapter` |

3. **Guard:** if the matched bare number has **6 or more digits**, it is likely a database ID, not a chapter number → do not treat as a chapter slot; drop to `medium` confidence and require corroboration from page title
4. Replace the matched segment with `{ch}`, preserving any prefix/suffix
5. If no path segment matches, scan query params for keys in `['c','ch','chapter','chap','ep','page']` whose value is numeric → build pattern with `{ch}` in the query, set `confidence = 'medium'`
6. If nothing matches, the URL is a **series landing page** → `seriesKey` is the full normalized path, `chapterNumber = undefined`

**Output:**

```ts
{
  seriesKey:  `${hostname}${pathWithPlaceholder}`,   // "nekopost.net/manga/17045/{ch}"
  urlPattern: `${hostname}${pathWithPlaceholder}`,
  chapterNumber: 1,
  chapterLabel: 'Ch. 1',
  confidence: 'high',
  source: 'generic',
}
```

**Next chapter:** substitute `{ch}` with `chapterNumber + 1` (integer increment; for decimals, round down then +1). Before returning, issue a `HEAD` request (falling back to `GET` with `Range: bytes=0-0` if HEAD returns 405). Return the URL only on a 2xx response. Timeout 5s.

## 3.5 Adapter: Fallback

Used when no chapter pattern is detectable.

1. Fetch the page HTML (8s timeout, 1MB size cap, `User-Agent` set to a normal desktop browser string)
2. Extract, in priority order:
   - `<link rel="canonical">` → re-run the generic adapter against it (canonical often has a cleaner URL)
   - `og:title`, then `<title>`, then `<h1>`
   - `og:image` → cover
   - JSON-LD `@type: Book`/`BreadcrumbList` for series name
3. Clean the title: strip common suffixes via regex — `/\s*[-–|]\s*(read|อ่าน)?.*$/i`, site name, `"Chapter N"` fragment
4. `seriesKey = "fallback:{hostname}:{slugify(cleanedTitle)}"`, `confidence = 'low'`
5. If the fetch fails entirely (Cloudflare, timeout, non-HTML): `seriesKey = "manual:{hostname}:{sha256(url).slice(0,16)}"`, `confidence = 'low'`, flag `requiresManualTitle: true`

**The save operation must never fail because metadata fetching failed.** Always persist the URL.

## 3.6 Merge Policy

| Confidence | Behavior |
|---|---|
| `high` | Silent auto-merge into the matching series. Toast: *"Updated {title} → Ch. {n}"* with Undo |
| `medium` | Auto-merge, but toast reads *"Merged into {title} — wrong series?"* with **Undo** and **Separate** actions |
| `low` | **Never auto-merge.** Create a new series, then compute merge suggestions |

**Merge suggestion algorithm (low confidence only):**
- Candidates: all of the user's series on the same `host` **OR** with normalized-title similarity ≥ 0.80
- Similarity: normalized Levenshtein ratio on lowercased, punctuation-stripped titles
- Return top 3 as `mergeSuggestions[]`; UI shows a dismissible prompt
- A **manual merge** action must always be available from series detail, regardless of confidence

**Manual merge semantics:** move all `chapters` from source series to target, keep the target's title/status/tags, recompute `current_chapter_id` as the chapter with the highest `chapter_number` (tiebreak: latest `saved_at`), copy `series_links`, delete the source series.

## 3.7 Regression Test Suite (must all pass)

```ts
// tests/resolver/cases.ts

export const CASES = [
  // --- Generic numeric: the core use case ---
  { url: 'https://www.nekopost.net/manga/17045/1',
    seriesKey: 'nekopost.net/manga/17045/{ch}', ch: 1, conf: 'high' },
  { url: 'https://www.nekopost.net/manga/17045/2',
    seriesKey: 'nekopost.net/manga/17045/{ch}', ch: 2, conf: 'high' }, // MUST merge with above
  { url: 'https://nekopost.net/manga/17045/2/',
    seriesKey: 'nekopost.net/manga/17045/{ch}', ch: 2, conf: 'high' }, // trailing slash + no www
  { url: 'https://www.nekopost.net/manga/17045/2?utm_source=fb',
    seriesKey: 'nekopost.net/manga/17045/{ch}', ch: 2, conf: 'high' }, // tracking stripped

  // --- MangaDex: UUIDs must resolve to the same series ---
  { url: 'https://mangadex.org/chapter/e4e5b2d6-7488-45fb-a079-b24458d822e8',
    seriesKeyPrefix: 'mangadex:', conf: 'high', requiresNetwork: true },
  { url: 'https://mangadex.org/chapter/f5ec3671-22f9-49ef-b389-9f10f3291071',
    seriesKeyPrefix: 'mangadex:', conf: 'high', requiresNetwork: true },
  // Assertion: the two above MUST produce an identical seriesKey (mocked fixtures)
  { url: 'https://mangadex.org/title/a1b2c3d4-0000-0000-0000-000000000000',
    seriesKeyPrefix: 'mangadex:', ch: undefined, conf: 'high' },

  // --- Slug + chapter patterns ---
  { url: 'https://site.com/manga/one-piece/chapter-1050',
    seriesKey: 'site.com/manga/one-piece/chapter-{ch}', ch: 1050, conf: 'high' },
  { url: 'https://site.com/manga/one-piece/ch-1050',
    seriesKey: 'site.com/manga/one-piece/ch-{ch}', ch: 1050, conf: 'high' },

  // --- Decimals and specials ---
  { url: 'https://site.com/read/solo-leveling/chapter-10.5',
    seriesKey: 'site.com/read/solo-leveling/chapter-{ch}', ch: 10.5, conf: 'high' },

  // --- Query-param chapters ---
  { url: 'https://site.com/read?id=99&c=3',
    seriesKey: 'site.com/read?c={ch}&id=99', ch: 3, conf: 'medium' },

  // --- Opaque ID: must NOT be treated as a chapter number ---
  { url: 'https://site.com/read/998877',
    conf: 'low', requiresTitleLookup: true },

  // --- Series landing page, no chapter ---
  { url: 'https://www.nekopost.net/manga/17045',
    seriesKey: 'nekopost.net/manga/17045', ch: undefined, conf: 'high' },

  // --- Must reject ---
  { url: 'javascript:alert(1)',            expectError: 'INVALID_URL' },
  { url: 'http://localhost:3000/manga/1/1', expectError: 'BLOCKED_HOST' },
  { url: 'ftp://site.com/a',               expectError: 'INVALID_URL' },
];
```

**Additional invariants to assert:**
- `resolve(a)` and `resolve(b)` for chapters 1 and 2 of the same series return **identical** `seriesKey`
- Resolution is **idempotent**: `resolve(resolve(x).chapterUrl).seriesKey === resolve(x).seriesKey`
- All network calls are mocked in unit tests; a separate `*.live.test.ts` (excluded from CI) hits real APIs