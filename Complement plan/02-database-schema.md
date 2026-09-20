# Database Schema

```sql
-- ============ users ============
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  created_at    timestamptz not null default now()
);

-- ============ series ============
create table series (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  series_key         text not null,
  source             text not null default 'generic',  -- mangadex|generic|fallback|manual
  url_pattern        text,
  auto_title         text,
  custom_title       text,                              -- overrides auto_title when set
  cover_url          text,
  status             text not null default 'unread',
  tags               text[] not null default '{}',
  language           text,
  current_chapter_id uuid,
  confidence         text not null default 'high',
  needs_review       boolean not null default false,    -- low-confidence flag for UI
  last_read_at       timestamptz,
  last_checked_at    timestamptz,                       -- for update checking
  has_update         boolean not null default false,
  next_chapter_url   text,                              -- cached next-chapter guess
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint series_status_chk check (
    status in ('unread','reading','read','waiting','paused','dropped')
  ),
  constraint series_key_unique unique (user_id, series_key)
);

create index series_user_status_idx on series(user_id, status);
create index series_user_updated_idx on series(user_id, updated_at desc);
create index series_tags_idx on series using gin(tags);
create index series_title_fts_idx on series
  using gin(to_tsvector('simple', coalesce(custom_title, auto_title, '')));

-- ============ chapters ============
create table chapters (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid not null references series(id) on delete cascade,
  url            text not null,
  chapter_label  text not null,
  chapter_number numeric(10,2),
  is_current     boolean not null default false,
  archived_at    timestamptz,          -- null = active
  purge_at       timestamptz,          -- archived_at + retention_days
  restored_count int not null default 0,
  saved_at       timestamptz not null default now()
);

create index chapters_series_idx on chapters(series_id, saved_at desc);
create index chapters_purge_idx  on chapters(purge_at) where purge_at is not null;
create unique index chapters_one_current_idx
  on chapters(series_id) where is_current = true;

alter table series add constraint series_current_chapter_fk
  foreign key (current_chapter_id) references chapters(id) on delete set null;

-- ============ series_links (one series, multiple sites) ============
create table series_links (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references series(id) on delete cascade,
  host        text not null,
  url_pattern text not null,
  label       text,
  created_at  timestamptz not null default now(),
  unique (series_id, url_pattern)
);

-- ============ resolve_cache ============
create table resolve_cache (
  cache_key   text primary key,      -- e.g. "mangadex:chapter:{uuid}"
  payload     jsonb not null,
  expires_at  timestamptz,           -- null = never expires (immutable data)
  created_at  timestamptz not null default now()
);
create index resolve_cache_exp_idx on resolve_cache(expires_at);

-- ============ undo_tokens ============
create table undo_tokens (
  token       text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  payload     jsonb not null,        -- snapshot required to reverse the operation
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

-- ============ api_tokens (bookmarklet / extension / shortcut) ============
create table api_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  name         text not null,
  token_hash   text not null unique,   -- sha256 of the raw token
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

-- ============ settings ============
create table settings (
  user_id          uuid primary key references users(id) on delete cascade,
  retention_days   int  not null default 30,
  default_status   text not null default 'unread',
  default_language text default 'en',
  auto_check_updates boolean not null default true,
  theme            text not null default 'system'
);
```

**Row Level Security** (enable before public launch):

```sql
alter table series        enable row level security;
alter table chapters      enable row level security;
alter table series_links  enable row level security;
alter table settings      enable row level security;
alter table api_tokens    enable row level security;

create policy series_owner on series
  for all using (user_id = auth.uid());

create policy chapters_owner on chapters
  for all using (exists (
    select 1 from series s where s.id = chapters.series_id and s.user_id = auth.uid()
  ));
-- (equivalent policies for series_links, settings, api_tokens)
```

## Save Transaction (exact semantics)

```sql
BEGIN;

-- 1. Upsert the series
INSERT INTO series (user_id, series_key, source, url_pattern, auto_title,
                    cover_url, language, confidence, needs_review)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
ON CONFLICT (user_id, series_key) DO UPDATE
  SET auto_title = COALESCE(series.auto_title, EXCLUDED.auto_title),
      cover_url  = COALESCE(series.cover_url,  EXCLUDED.cover_url),
      updated_at = now()
RETURNING id, current_chapter_id;

-- 2. Archive the previous current chapter (if any, and if different URL)
UPDATE chapters
   SET is_current = false,
       archived_at = now(),
       purge_at = now() + ($retention_days || ' days')::interval
 WHERE series_id = $series_id AND is_current = true;

-- 3. Insert the new chapter as current
--    (if a chapter row with this exact URL already exists, reactivate it instead)
INSERT INTO chapters (series_id, url, chapter_label, chapter_number, is_current)
VALUES ($series_id, $url, $label, $num, true)
RETURNING id;

-- 4. Point the series at it
UPDATE series
   SET current_chapter_id = $new_chapter_id,
       status = CASE WHEN status IN ('read','waiting') THEN 'unread' ELSE status END,
       has_update = false,
       next_chapter_url = null,
       updated_at = now()
 WHERE id = $series_id;

COMMIT;
```

**Re-saving the identical URL** is a no-op: return `action: 'noop'` and do not archive anything.

**Backward save** (new `chapter_number` < current): still set as current, but set a transient response flag `wentBackward: true` with `previousChapter: N` so the UI can show a *"Jumped back from Ch. N"* badge.