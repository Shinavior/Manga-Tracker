-- =========================================================
-- Manga Tracker: Complete Database Schema & RLS Setup
-- Compatible with Supabase PostgreSQL
-- =========================================================

-- 1. Enable required extensions
create extension if not exists "pgcrypto";

-- ============ users ============
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  created_at    timestamptz not null default now()
);

-- ============ series ============
create table if not exists series (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  series_key         text not null,
  source             text not null default 'generic',
  url_pattern        text,
  auto_title         text,
  custom_title       text,
  cover_url          text,
  status             text not null default 'unread',
  tags               text[] not null default '{}',
  language           text,
  current_chapter_id uuid,
  confidence         text not null default 'high',
  needs_review       boolean not null default false,
  last_read_at       timestamptz,
  last_checked_at    timestamptz,
  has_update         boolean not null default false,
  next_chapter_url   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint series_status_chk check (
    status in ('unread','reading','read','waiting','paused','dropped')
  ),
  constraint series_key_unique unique (user_id, series_key)
);

create index if not exists series_user_status_idx on series(user_id, status);
create index if not exists series_user_updated_idx on series(user_id, updated_at desc);
create index if not exists series_tags_idx on series using gin(tags);

-- ============ chapters ============
create table if not exists chapters (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid not null references series(id) on delete cascade,
  url            text not null,
  chapter_label  text not null,
  chapter_number numeric(10,2),
  is_current     boolean not null default false,
  archived_at    timestamptz,
  purge_at       timestamptz,
  restored_count int not null default 0,
  saved_at       timestamptz not null default now()
);

create index if not exists chapters_series_idx on chapters(series_id, saved_at desc);
create index if not exists chapters_purge_idx  on chapters(purge_at) where purge_at is not null;
create unique index if not exists chapters_one_current_idx on chapters(series_id) where is_current = true;

-- Add foreign key constraint for current_chapter_id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'series_current_chapter_fk'
  ) then
    alter table series add constraint series_current_chapter_fk
      foreign key (current_chapter_id) references chapters(id) on delete set null;
  end if;
end $$;

-- ============ series_links ============
create table if not exists series_links (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references series(id) on delete cascade,
  host        text not null,
  url_pattern text not null,
  label       text,
  created_at  timestamptz not null default now(),
  unique (series_id, url_pattern)
);

-- ============ resolve_cache ============
create table if not exists resolve_cache (
  cache_key   text primary key,
  payload     jsonb not null,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists resolve_cache_exp_idx on resolve_cache(expires_at);

-- ============ undo_tokens ============
create table if not exists undo_tokens (
  token       text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  payload     jsonb not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

-- ============ api_tokens ============
create table if not exists api_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  name         text not null,
  token_hash   text not null unique,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

-- ============ settings ============
create table if not exists settings (
  user_id          uuid primary key references users(id) on delete cascade,
  retention_days   int  not null default 30,
  default_status   text not null default 'unread',
  default_language text default 'en',
  auto_check_updates boolean not null default true,
  theme            text not null default 'system'
);

-- ============ feedback ============
create table if not exists feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete set null,
  type          text not null,
  message       text not null,
  page_context  text,
  app_version   text,
  user_agent    text,
  screenshot_url text,
  status        text not null default 'open',
  created_at    timestamptz not null default now()
);
create index if not exists feedback_status_idx on feedback(status, created_at desc);

-- =========================================================
-- Row Level Security (RLS) Policies
-- =========================================================

alter table series        enable row level security;
alter table chapters      enable row level security;
alter table series_links  enable row level security;
alter table settings      enable row level security;
alter table api_tokens    enable row level security;
alter table undo_tokens    enable row level security;
alter table feedback      enable row level security;

-- Series RLS
drop policy if exists series_owner on series;
create policy series_owner on series
  for all using (user_id = auth.uid());

-- Chapters RLS
drop policy if exists chapters_owner on chapters;
create policy chapters_owner on chapters
  for all using (exists (
    select 1 from series s where s.id = chapters.series_id and s.user_id = auth.uid()
  ));

-- Series Links RLS
drop policy if exists series_links_owner on series_links;
create policy series_links_owner on series_links
  for all using (exists (
    select 1 from series s where s.id = series_links.series_id and s.user_id = auth.uid()
  ));

-- Settings RLS
drop policy if exists settings_owner on settings;
create policy settings_owner on settings
  for all using (user_id = auth.uid());

-- API Tokens RLS
drop policy if exists api_tokens_owner on api_tokens;
create policy api_tokens_owner on api_tokens
  for all using (user_id = auth.uid());

-- Undo Tokens RLS
drop policy if exists undo_tokens_owner on undo_tokens;
create policy undo_tokens_owner on undo_tokens
  for all using (user_id = auth.uid());

-- Feedback RLS
drop policy if exists feedback_insert_own on feedback;
create policy feedback_insert_own on feedback
  for insert with check (user_id = auth.uid() or user_id is null);

drop policy if exists feedback_select_own on feedback;
create policy feedback_select_own on feedback
  for select using (user_id = auth.uid());

-- Auto-sync auth.users to public.users on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users (Supabase Auth)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();
