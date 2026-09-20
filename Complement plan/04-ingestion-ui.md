# Ingestion Channels, UI Spec, Import/Export

## 7. Ingestion Channels

| Channel | Platform | Effort | Implementation |
|---|---|---|---|
| Paste URL | All | Low | Input on Library page; auto-paste from clipboard on focus if it looks like a URL |
| Bookmarklet | Desktop + Firefox Android | Low | Generated in Settings with embedded token |
| PWA Share Target | Android | Medium | `manifest.json` `share_target` → `/share` route |
| iOS Shortcut | iOS | Low | Downloadable shortcut; Share Sheet → POST to `/api/save` |
| Extension | Desktop Chrome/Firefox/Edge | Medium | MV3, action popup + badge |

### 7.1 Bookmarklet

```js
javascript:(function(){
  var u=encodeURIComponent(location.href),
      t=encodeURIComponent(document.title);
  window.open(
    'https://APP_URL/share?url='+u+'&title='+t+'&k=TOKEN',
    'mt','width=420,height=520'
  );
})();
```

Generate this string in Settings with `APP_URL` and `TOKEN` substituted, plus a copy button and drag-to-bookmarks-bar affordance.

### 7.2 PWA Share Target

```jsonc
// public/manifest.json
{
  "name": "Manga Tracker",
  "short_name": "MangaTrack",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b0b0f",
  "theme_color": "#0b0b0f",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

The `/share` route must handle Chrome Android's behavior of sometimes placing the URL inside `text` instead of `url` — extract the first `https?://` match from either field.

### 7.3 Mobile Extension Reality Check

- **iOS:** Not feasible. Safari on iOS/iPadOS uses Apple's own extension APIs rather than standard WebExtensions, and third-party browsers are constrained to WebKit. **Use the iOS Shortcut instead** — the UX is effectively identical (Share Sheet → one tap).
- **Android:** Possible but niche. Chrome for Android does not support extensions; Firefox for Android does, and some Chromium-based alternatives such as Kiwi/Quetta allow installing from the Chrome Web Store.

**Recommendation:** ship **PWA Share Target (Android) + Shortcut (iOS)** for mobile, and reserve the extension for desktop only. Do not spend effort on a mobile extension build.

### 7.4 Desktop Extension (MV3)

```jsonc
// extension/manifest.json
{
  "manifest_version": 3,
  "name": "Manga Tracker",
  "version": "1.0.0",
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": ["https://APP_URL/*"],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background.js" },
  "options_page": "options.html"
}
```

**Behavior:**
- **Popup:** shows detected series title + chapter (via `/api/resolve`), an editable title field, tag input, and a Save button
- **Badge:** on tab change, call `/api/resolve` and show `✓` if the series is already tracked, `▲` if this chapter is newer than the tracked one
- **Keyboard shortcut:** `Ctrl+Shift+S` / `Cmd+Shift+S` saves instantly without opening the popup
- **Options page:** paste API token, set default tags/status
- Store the token in `chrome.storage.local`, never in `sync`

---

## 8. UI Specification

### 8.1 Library (`/`) — primary screen

**Layout:** mobile-first single column; 2-column grid ≥768px; 3-column ≥1280px.

**Top bar:** search input (debounced 300ms), filter button (opens sheet), sort dropdown, Add button.

**Add flow:** a persistent bottom input (mobile) or top input (desktop). On paste → auto-call `/api/resolve` → show inline preview card (cover, detected title, chapter, confidence chip) → Save button. Enter key saves directly.

**Series card:**
```
┌──────────────────────────────────────────────┐
│ ┌────┐  Series Title              ● reading  │
│ │cover│ Ch. 42 · nekopost.net    ▲ new       │
│ │ 3:4 │ 2 days ago       #action #isekai     │
│ └────┘                                        │
│        [ Continue ]  [ Next › ]  [ ⋯ ]       │
└──────────────────────────────────────────────┘
```

- **Continue** → opens `currentChapter.url` in a new tab, fires `/api/series/:id/read`
- **Next ›** → opens `/api/series/:id/next`; disabled with tooltip if unavailable; shows a spinner while verifying
- **⋯ menu** → Rename, Change status, Edit tags, Add alternate link, Merge into…, View history, Delete
- **Long-press / right-click** → multi-select mode for bulk status/tag/delete
- **`needsReview: true`** → amber left border + "Verify" chip
- Swipe right = mark read · swipe left = archive (mobile)

**Empty state:** short explainer + bookmarklet setup CTA + "Import bookmarks" button.

### 8.2 Series Detail (`/series/:id`)

- Header: cover, editable title (inline, click-to-edit), status selector, tag editor
- Current chapter card with Continue / Next buttons
- **Chapter history** table: label, URL host, saved date, and for archived rows a "Deletes in N days" chip + Restore button
- **Alternate links** section — add another site's URL for the same series (writes to `series_links`)
- Danger zone: Merge into another series, Delete series

### 8.3 Trash (`/trash`)

- Grouped by series, sorted by soonest `purge_at`
- Each row: chapter label, days remaining (red if < 7), Restore, Delete now
- Header actions: "Empty trash", "Restore all"

### 8.4 Settings (`/settings`)

- Retention period (7 / 14 / 30 / 60 / 90 / never)
- Default status for new saves, default language (MangaDex)
- Auto-check updates toggle
- API tokens: create, name, copy-once display, revoke, last-used timestamp
- Bookmarklet: generated code with copy button + install instructions
- iOS Shortcut: download link + setup steps
- Extension: download link + token pairing instructions
- Import / Export
- Theme

### 8.5 Status Model

| Status | Meaning | Color |
|---|---|---|
| `unread` | Saved, not yet opened | Blue |
| `reading` | Currently in progress | Green |
| `read` | Finished the current chapter | Gray |
| `waiting` | Caught up, waiting for the next release | Amber |
| `paused` | On hold | Slate |
| `dropped` | Abandoned | Dark gray |

**Automatic transitions:**
- Click **Continue** → `reading`
- Save a newer chapter → `read`/`waiting` revert to `unread`; `reading` stays `reading`
- Update check finds a new chapter while status is `waiting` → `has_update = true` (status unchanged; the user decides)

---

## 9. Import / Export

### 9.1 Export format

```jsonc
{
  "schemaVersion": 1,
  "exportedAt": "2026-02-12T08:00:00Z",
  "app": "manga-tracker",
  "series": [
    {
      "seriesKey": "nekopost.net/manga/17045/{ch}",
      "source": "generic",
      "title": "Series Name",
      "customTitle": null,
      "coverUrl": "https://…",
      "status": "reading",
      "tags": ["action"],
      "language": "th",
      "links": [{ "host": "nekopost.net", "urlPattern": "nekopost.net/manga/17045/{ch}" }],
      "chapters": [
        { "url": "https://nekopost.net/manga/17045/2", "label": "Ch. 2",
          "number": 2, "isCurrent": true,  "savedAt": "2026-02-12T…" },
        { "url": "https://nekopost.net/manga/17045/1", "label": "Ch. 1",
          "number": 1, "isCurrent": false, "savedAt": "2026-02-10T…",
          "archivedAt": "2026-02-12T…" }
      ]
    }
  ]
}
```

### 9.2 Import

- Accepts the JSON above (validate `schemaVersion`) **or** Netscape bookmark HTML exported from any browser
- For bookmark HTML: parse `<A HREF>` + text, run each URL through the resolver, group by `seriesKey`, keep the highest chapter as current and archive the rest
- **Dry-run preview is mandatory:** show counts of new series, merges into existing series, and skipped/invalid entries before committing
- Conflict policy selector: `skip` (default) | `merge` | `overwrite`
- Process in batches of 25 with a progress bar; resolver network calls are throttled