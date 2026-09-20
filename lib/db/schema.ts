import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ============ users ============
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ series ============
export const series = pgTable(
  'series',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seriesKey: text('series_key').notNull(),
    source: text('source').notNull().default('generic'), // mangadex|generic|fallback|manual
    urlPattern: text('url_pattern'),
    autoTitle: text('auto_title'),
    customTitle: text('custom_title'),
    coverUrl: text('cover_url'),
    status: text('status').notNull().default('unread'), // unread|reading|read|waiting|paused|dropped
    tags: text('tags').array().notNull().default([]),
    language: text('language'),
    currentChapterId: uuid('current_chapter_id'),
    confidence: text('confidence').notNull().default('high'), // high|medium|low
    needsReview: boolean('needs_review').notNull().default(false),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    hasUpdate: boolean('has_update').notNull().default(false),
    nextChapterUrl: text('next_chapter_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    seriesUserKeyIdx: uniqueIndex('series_user_key_idx').on(table.userId, table.seriesKey),
    seriesUserStatusIdx: index('series_user_status_idx').on(table.userId, table.status),
    seriesUserUpdatedIdx: index('series_user_updated_idx').on(table.userId, table.updatedAt),
  })
);

// ============ chapters ============
export const chapters = pgTable(
  'chapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    chapterLabel: text('chapter_label').notNull(),
    chapterNumber: numeric('chapter_number', { precision: 10, scale: 2 }),
    isCurrent: boolean('is_current').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    purgeAt: timestamp('purge_at', { withTimezone: true }),
    restoredCount: integer('restored_count').notNull().default(0),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chaptersSeriesIdx: index('chapters_series_idx').on(table.seriesId, table.savedAt),
    chaptersPurgeIdx: index('chapters_purge_idx').on(table.purgeAt),
  })
);

// ============ series_links ============
export const seriesLinks = pgTable(
  'series_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    host: text('host').notNull(),
    urlPattern: text('url_pattern').notNull(),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    seriesLinksPatternIdx: uniqueIndex('series_links_pattern_idx').on(table.seriesId, table.urlPattern),
  })
);

// ============ resolve_cache ============
export const resolveCache = pgTable('resolve_cache', {
  cacheKey: text('cache_key').primaryKey(),
  payload: jsonb('payload').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ undo_tokens ============
export const undoTokens = pgTable('undo_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
});

// ============ api_tokens ============
export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// ============ settings ============
export const settings = pgTable('settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  retentionDays: integer('retention_days').notNull().default(30),
  defaultStatus: text('default_status').notNull().default('unread'),
  defaultLanguage: text('default_language').default('en'),
  autoCheckUpdates: boolean('auto_check_updates').notNull().default(true),
  theme: text('theme').notNull().default('system'),
});
