import { ApiTokenRecord, ChapterRecord, SaveResult, SeriesRecord, UndoTokenRecord } from './types';
import { ResolveResult } from '../resolver/types';
import { resolve } from '../resolver';
import { MangaDexAdapter } from '../resolver/adapters/mangadex';
import { GenericNumericAdapter } from '../resolver/adapters/generic-numeric';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { db } from './client';
import * as schema from './schema';
import { eq, and, or, desc, asc, ilike, sql, inArray, lte } from 'drizzle-orm';

const mangadexAdapter = new MangaDexAdapter();
const genericAdapter = new GenericNumericAdapter();

// Global in-memory persistent store (shared across route invocations in dev/single-user/tests)
const globalStore = globalThis as unknown as {
  __mangaSeries?: Map<string, SeriesRecord>;
  __mangaChapters?: Map<string, ChapterRecord>;
  __mangaUndoTokens?: Map<string, UndoTokenRecord>;
  __mangaApiTokens?: Map<string, ApiTokenRecord>;
};

if (!globalStore.__mangaSeries) globalStore.__mangaSeries = new Map();
if (!globalStore.__mangaChapters) globalStore.__mangaChapters = new Map();
if (!globalStore.__mangaUndoTokens) globalStore.__mangaUndoTokens = new Map();
if (!globalStore.__mangaApiTokens) globalStore.__mangaApiTokens = new Map();

const seriesDb = globalStore.__mangaSeries;
const chaptersDb = globalStore.__mangaChapters;
const undoTokensDb = globalStore.__mangaUndoTokens;
const apiTokensDb = globalStore.__mangaApiTokens;

export function normalizeSeriesKey(key: string): string {
  return key
    .replace(/-(?:ตอนที่|ตอน|บทที่|chapter|ch|ep)-?\{ch\}/gi, '-{ch}')
    .replace(/_(?:ตอนที่|ตอน|บทที่|chapter|ch|ep)_?\{ch\}/gi, '_{ch}');
}

function toSeriesRecord(row: any): SeriesRecord {
  return {
    id: row.id,
    userId: row.userId,
    seriesKey: row.seriesKey,
    source: row.source,
    urlPattern: row.urlPattern,
    autoTitle: row.autoTitle,
    customTitle: row.customTitle,
    coverUrl: row.coverUrl,
    status: row.status as SeriesRecord['status'],
    tags: row.tags || [],
    language: row.language,
    currentChapterId: row.currentChapterId,
    confidence: row.confidence as SeriesRecord['confidence'],
    needsReview: Boolean(row.needsReview),
    lastReadAt: row.lastReadAt ? new Date(row.lastReadAt) : null,
    lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt) : null,
    hasUpdate: Boolean(row.hasUpdate),
    nextChapterUrl: row.nextChapterUrl,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function toChapterRecord(row: any): ChapterRecord {
  return {
    id: row.id,
    seriesId: row.seriesId,
    url: row.url,
    chapterLabel: row.chapterLabel,
    chapterNumber: row.chapterNumber != null ? Number(row.chapterNumber) : null,
    isCurrent: Boolean(row.isCurrent),
    archivedAt: row.archivedAt ? new Date(row.archivedAt) : null,
    purgeAt: row.purgeAt ? new Date(row.purgeAt) : null,
    restoredCount: row.restoredCount || 0,
    savedAt: new Date(row.savedAt),
  };
}

export class DataStore {
  // Clear all data (useful for test isolation)
  static clearAll(): any {
    seriesDb.clear();
    chaptersDb.clear();
    undoTokensDb.clear();
    apiTokensDb.clear();

    if (db) {
      return (async () => {
        try {
          await db.delete(schema.undoTokens);
          await db.delete(schema.apiTokens);
          await db.delete(schema.chapters);
          await db.delete(schema.series);
        } catch {
          // ignore if table doesn't exist
        }
      })();
    }
  }

  // Find existing series by (userId, seriesKey)
  static findSeriesByKey(userId: string, seriesKey: string): any {
    if (db) {
      return (async () => {
        const normKey = normalizeSeriesKey(seriesKey);
        const rows = await db
          .select()
          .from(schema.series)
          .where(
            and(
              eq(schema.series.userId, userId),
              or(eq(schema.series.seriesKey, seriesKey), eq(schema.series.seriesKey, normKey))
            )
          )
          .limit(1);

        if (rows[0]) return toSeriesRecord(rows[0]);
        return undefined;
      })();
    }

    // In-memory fallback
    for (const s of seriesDb.values()) {
      if (s.userId === userId && s.seriesKey === seriesKey) {
        return s;
      }
    }
    const normKey = normalizeSeriesKey(seriesKey);
    for (const s of seriesDb.values()) {
      if (s.userId === userId && normalizeSeriesKey(s.seriesKey) === normKey) {
        return s;
      }
    }
    return undefined;
  }

  // Find series by ID
  static findSeriesById(userId: string, seriesId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .select()
          .from(schema.series)
          .where(and(eq(schema.series.id, seriesId), eq(schema.series.userId, userId)))
          .limit(1);
        return rows[0] ? toSeriesRecord(rows[0]) : undefined;
      })();
    }

    const s = seriesDb.get(seriesId);
    if (s && s.userId === userId) return s;
    return undefined;
  }

  // Get current chapter of a series
  static getCurrentChapter(seriesId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .select()
          .from(schema.chapters)
          .where(and(eq(schema.chapters.seriesId, seriesId), eq(schema.chapters.isCurrent, true)))
          .limit(1);
        return rows[0] ? toChapterRecord(rows[0]) : undefined;
      })();
    }

    for (const ch of chaptersDb.values()) {
      if (ch.seriesId === seriesId && ch.isCurrent) {
        return ch;
      }
    }
    return undefined;
  }

  // List all chapters for a series
  static getChaptersForSeries(seriesId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .select()
          .from(schema.chapters)
          .where(eq(schema.chapters.seriesId, seriesId))
          .orderBy(desc(schema.chapters.savedAt));
        return rows.map(toChapterRecord);
      })();
    }

    const list: ChapterRecord[] = [];
    for (const ch of chaptersDb.values()) {
      if (ch.seriesId === seriesId) {
        list.push(ch);
      }
    }
    return list.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
  }

  // Get all series for a user with filters
  static listSeries(
    userId: string,
    options: {
      status?: string[];
      tag?: string[];
      q?: string;
      sort?: 'updated' | 'title' | 'chapter' | 'created';
      order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    } = {}
  ): any {
    const {
      status,
      tag,
      q,
      sort = 'updated',
      order = 'desc',
      limit = 50,
      offset = 0,
    } = options;

    if (db) {
      return (async () => {
        const conditions = [eq(schema.series.userId, userId)];

        if (status && status.length > 0) {
          conditions.push(inArray(schema.series.status, status));
        }

        if (q && q.trim()) {
          const query = q.trim();
          const cleanTagQuery = query.replace(/^#/, '');
          conditions.push(
            or(
              ilike(schema.series.customTitle, `%${query}%`),
              ilike(schema.series.autoTitle, `%${query}%`),
              sql`${schema.series.tags} @> ARRAY[${cleanTagQuery}]::text[]`
            )!
          );
        }

        let orderByClause;
        if (sort === 'title') {
          orderByClause = order === 'desc' ? desc(schema.series.customTitle) : asc(schema.series.customTitle);
        } else if (sort === 'created') {
          orderByClause = order === 'desc' ? desc(schema.series.createdAt) : asc(schema.series.createdAt);
        } else {
          orderByClause = order === 'desc' ? desc(schema.series.updatedAt) : asc(schema.series.updatedAt);
        }

        const allRows = await db
          .select()
          .from(schema.series)
          .where(and(...conditions))
          .orderBy(orderByClause);

        let filtered = allRows.map(toSeriesRecord);
        if (tag && tag.length > 0) {
          filtered = filtered.filter((s) => tag.some((t) => s.tags.includes(t)));
        }

        const total = filtered.length;
        const sliced = filtered.slice(offset, offset + limit);

        const currentChapterIds = sliced.map((s) => s.currentChapterId).filter(Boolean) as string[];
        const chapterMap = new Map<string, ChapterRecord>();

        if (currentChapterIds.length > 0) {
          const chapterRows = await db
            .select()
            .from(schema.chapters)
            .where(inArray(schema.chapters.id, currentChapterIds));
          for (const ch of chapterRows) {
            chapterMap.set(ch.id, toChapterRecord(ch));
          }
        }

        const items = sliced.map((s) => ({
          ...s,
          currentChapter: s.currentChapterId ? chapterMap.get(s.currentChapterId) : undefined,
        }));

        return { items, total };
      })();
    }

    // In-memory fallback
    let all: SeriesRecord[] = [];
    for (const s of seriesDb.values()) {
      if (s.userId !== userId) continue;

      if (status && status.length > 0 && !status.includes(s.status)) {
        continue;
      }

      if (tag && tag.length > 0 && !tag.some((t) => s.tags.includes(t))) {
        continue;
      }

      if (q && q.trim()) {
        const query = q.trim().toLowerCase();
        const cleanTagQuery = query.replace(/^#/, '');
        const displayTitle = (s.customTitle || s.autoTitle || '').toLowerCase();
        const tagMatch = s.tags.some((t) => t.toLowerCase().includes(cleanTagQuery));
        if (!displayTitle.includes(query) && !tagMatch) {
          continue;
        }
      }

      all.push(s);
    }

    const total = all.length;

    all.sort((a, b) => {
      let cmp = 0;
      if (sort === 'title') {
        const titleA = (a.customTitle || a.autoTitle || '').toLowerCase();
        const titleB = (b.customTitle || b.autoTitle || '').toLowerCase();
        cmp = titleA.localeCompare(titleB);
      } else if (sort === 'created') {
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sort === 'chapter') {
        const chA = a.currentChapterId ? chaptersDb.get(a.currentChapterId)?.chapterNumber ?? 0 : 0;
        const chB = b.currentChapterId ? chaptersDb.get(b.currentChapterId)?.chapterNumber ?? 0 : 0;
        cmp = chA - chB;
      } else {
        cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return order === 'desc' ? -cmp : cmp;
    });

    const sliced = all.slice(offset, offset + limit);
    const items = sliced.map((s) => ({
      ...s,
      currentChapter: s.currentChapterId ? chaptersDb.get(s.currentChapterId) : undefined,
    }));

    return { items, total };
  }

  // Core Save Transaction (Spec Section 4)
  static async saveChapter(params: {
    userId: string;
    resolveResult: ResolveResult;
    customTitle?: string;
    tags?: string[];
    statusOverride?: SeriesRecord['status'];
    retentionDays?: number;
  }): Promise<SaveResult> {
    const {
      userId,
      resolveResult,
      customTitle,
      tags = [],
      statusOverride,
      retentionDays = 30,
    } = params;

    const now = new Date();

    if (db) {
      try {
        await db.insert(schema.users).values({ id: userId, email: null }).onConflictDoNothing();
      } catch {
        // ignore
      }

      let existingSeries = await DataStore.findSeriesByKey(userId, resolveResult.seriesKey);
      let action: 'created' | 'updated' | 'noop' = 'created';
      let previousCurrentChapter: ChapterRecord | undefined;
      let previousStatus: SeriesRecord['status'] | undefined;
      let wentBackward = false;

      if (existingSeries) {
        action = 'updated';
        previousStatus = existingSeries.status;
        if (existingSeries.currentChapterId) {
          const chRow = await db
            .select()
            .from(schema.chapters)
            .where(eq(schema.chapters.id, existingSeries.currentChapterId))
            .limit(1);
          if (chRow[0]) previousCurrentChapter = toChapterRecord(chRow[0]);
        }

        if (previousCurrentChapter && previousCurrentChapter.url === resolveResult.chapterUrl) {
          return {
            action: 'noop',
            wentBackward: false,
            series: {
              id: existingSeries.id,
              title: existingSeries.customTitle || existingSeries.autoTitle || 'Untitled Series',
              coverUrl: existingSeries.coverUrl,
              status: existingSeries.status,
              tags: existingSeries.tags,
              seriesKey: existingSeries.seriesKey,
              confidence: existingSeries.confidence,
              needsReview: existingSeries.needsReview,
            },
            chapter: {
              id: previousCurrentChapter.id,
              url: previousCurrentChapter.url,
              label: previousCurrentChapter.chapterLabel,
              number: previousCurrentChapter.chapterNumber,
            },
          };
        }

        if (
          previousCurrentChapter?.chapterNumber !== undefined &&
          previousCurrentChapter.chapterNumber !== null &&
          resolveResult.chapterNumber !== undefined &&
          resolveResult.chapterNumber !== null &&
          resolveResult.chapterNumber < previousCurrentChapter.chapterNumber
        ) {
          wentBackward = true;
        }
      }

      let seriesId = existingSeries?.id;
      if (!existingSeries) {
        seriesId = randomUUID();
        await db.insert(schema.series).values({
          id: seriesId,
          userId,
          seriesKey: resolveResult.seriesKey,
          source: resolveResult.source,
          urlPattern: resolveResult.urlPattern || null,
          autoTitle: resolveResult.seriesTitle || null,
          customTitle: customTitle || null,
          coverUrl: resolveResult.coverUrl || null,
          status: statusOverride || 'unread',
          tags: tags.length > 0 ? tags : [],
          language: resolveResult.language || null,
          currentChapterId: null,
          confidence: resolveResult.confidence,
          needsReview: resolveResult.confidence === 'low' || resolveResult.requiresManualTitle === true,
          lastReadAt: null,
          lastCheckedAt: null,
          hasUpdate: false,
          nextChapterUrl: null,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const updates: any = {
          autoTitle: existingSeries.autoTitle || resolveResult.seriesTitle || null,
          updatedAt: now,
          hasUpdate: false,
          nextChapterUrl: null,
        };
        if (customTitle) updates.customTitle = customTitle;
        if (!existingSeries.coverUrl && resolveResult.coverUrl) updates.coverUrl = resolveResult.coverUrl;
        if (statusOverride) {
          updates.status = statusOverride;
        } else if (existingSeries.status === 'read' || existingSeries.status === 'waiting') {
          updates.status = 'unread';
        }
        if (resolveResult.urlPattern) {
          updates.urlPattern = resolveResult.urlPattern;
          updates.seriesKey = resolveResult.seriesKey;
        }
        await db.update(schema.series).set(updates).where(eq(schema.series.id, seriesId!));
      }

      let archivedInfo: { id: string; label: string; purgeAt: string } | undefined;
      if (previousCurrentChapter) {
        const purgeDate = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
        await db
          .update(schema.chapters)
          .set({ isCurrent: false, archivedAt: now, purgeAt: purgeDate })
          .where(eq(schema.chapters.id, previousCurrentChapter.id));

        archivedInfo = {
          id: previousCurrentChapter.id,
          label: previousCurrentChapter.chapterLabel,
          purgeAt: purgeDate.toISOString(),
        };
      }

      let targetChapterId: string;
      const existingChRows = await db
        .select()
        .from(schema.chapters)
        .where(and(eq(schema.chapters.seriesId, seriesId!), eq(schema.chapters.url, resolveResult.chapterUrl)))
        .limit(1);

      if (existingChRows.length > 0) {
        targetChapterId = existingChRows[0].id;
        await db
          .update(schema.chapters)
          .set({
            isCurrent: true,
            archivedAt: null,
            purgeAt: null,
            chapterLabel: resolveResult.chapterLabel,
            chapterNumber:
              resolveResult.chapterNumber != null
                ? String(resolveResult.chapterNumber)
                : existingChRows[0].chapterNumber,
            savedAt: now,
          })
          .where(eq(schema.chapters.id, targetChapterId));
      } else {
        targetChapterId = randomUUID();
        await db.insert(schema.chapters).values({
          id: targetChapterId,
          seriesId: seriesId!,
          url: resolveResult.chapterUrl,
          chapterLabel: resolveResult.chapterLabel,
          chapterNumber: resolveResult.chapterNumber != null ? String(resolveResult.chapterNumber) : null,
          isCurrent: true,
          archivedAt: null,
          purgeAt: null,
          restoredCount: 0,
          savedAt: now,
        });
      }

      await db
        .update(schema.series)
        .set({ currentChapterId: targetChapterId })
        .where(eq(schema.series.id, seriesId!));

      const undoToken = 'ut_' + randomUUID().replace(/-/g, '');
      await db.insert(schema.undoTokens).values({
        token: undoToken,
        userId,
        payload: {
          action,
          seriesId: seriesId!,
          previousCurrentChapterId: previousCurrentChapter?.id || null,
          insertedChapterId: targetChapterId,
          previousSeriesState: previousStatus ? { status: previousStatus } : undefined,
        },
        expiresAt: new Date(now.getTime() + 60 * 1000),
        consumedAt: null,
      });

      const title =
        customTitle ||
        (existingSeries ? existingSeries.customTitle || existingSeries.autoTitle : resolveResult.seriesTitle) ||
        'Untitled Series';

      return {
        action,
        wentBackward,
        series: {
          id: seriesId!,
          title,
          coverUrl: resolveResult.coverUrl || existingSeries?.coverUrl || null,
          status: statusOverride || (existingSeries?.status ?? 'unread'),
          tags: tags.length > 0 ? tags : existingSeries?.tags || [],
          seriesKey: resolveResult.seriesKey,
          confidence: resolveResult.confidence,
          needsReview: resolveResult.confidence === 'low' || resolveResult.requiresManualTitle === true,
        },
        chapter: {
          id: targetChapterId,
          url: resolveResult.chapterUrl,
          label: resolveResult.chapterLabel,
          number: resolveResult.chapterNumber ?? null,
        },
        archivedChapter: archivedInfo,
        undoToken,
      };
    }

    // In-memory fallback
    let existingSeries = DataStore.findSeriesByKey(userId, resolveResult.seriesKey);
    let action: 'created' | 'updated' | 'noop' = 'created';
    let previousCurrentChapter: ChapterRecord | undefined;
    let previousStatus: SeriesRecord['status'] | undefined;
    let wentBackward = false;

    if (existingSeries) {
      action = 'updated';
      previousStatus = existingSeries.status;
      previousCurrentChapter = existingSeries.currentChapterId
        ? chaptersDb.get(existingSeries.currentChapterId)
        : undefined;

      if (previousCurrentChapter && previousCurrentChapter.url === resolveResult.chapterUrl) {
        return {
          action: 'noop',
          wentBackward: false,
          series: {
            id: existingSeries.id,
            title: existingSeries.customTitle || existingSeries.autoTitle || 'Untitled Series',
            coverUrl: existingSeries.coverUrl,
            status: existingSeries.status,
            tags: existingSeries.tags,
            seriesKey: existingSeries.seriesKey,
            confidence: existingSeries.confidence,
            needsReview: existingSeries.needsReview,
          },
          chapter: {
            id: previousCurrentChapter.id,
            url: previousCurrentChapter.url,
            label: previousCurrentChapter.chapterLabel,
            number: previousCurrentChapter.chapterNumber,
          },
        };
      }

      if (
        previousCurrentChapter?.chapterNumber !== undefined &&
        previousCurrentChapter.chapterNumber !== null &&
        resolveResult.chapterNumber !== undefined &&
        resolveResult.chapterNumber !== null &&
        resolveResult.chapterNumber < previousCurrentChapter.chapterNumber
      ) {
        wentBackward = true;
      }
    }

    let seriesId = existingSeries?.id;
    if (!existingSeries) {
      seriesId = randomUUID();
      existingSeries = {
        id: seriesId,
        userId,
        seriesKey: resolveResult.seriesKey,
        source: resolveResult.source,
        urlPattern: resolveResult.urlPattern || null,
        autoTitle: resolveResult.seriesTitle || null,
        customTitle: customTitle || null,
        coverUrl: resolveResult.coverUrl || null,
        status: statusOverride || 'unread',
        tags: tags.length > 0 ? tags : [],
        language: resolveResult.language || null,
        currentChapterId: null,
        confidence: resolveResult.confidence,
        needsReview: resolveResult.confidence === 'low' || resolveResult.requiresManualTitle === true,
        lastReadAt: null,
        lastCheckedAt: null,
        hasUpdate: false,
        nextChapterUrl: null,
        createdAt: now,
        updatedAt: now,
      };
      seriesDb.set(seriesId, existingSeries);
    } else {
      existingSeries.autoTitle = existingSeries.autoTitle || resolveResult.seriesTitle || null;
      if (customTitle) existingSeries.customTitle = customTitle;
      if (!existingSeries.coverUrl && resolveResult.coverUrl) {
        existingSeries.coverUrl = resolveResult.coverUrl;
      }
      if (statusOverride) {
        existingSeries.status = statusOverride;
      } else if (existingSeries.status === 'read' || existingSeries.status === 'waiting') {
        existingSeries.status = 'unread';
      }
      if (resolveResult.urlPattern) {
        existingSeries.urlPattern = resolveResult.urlPattern;
        existingSeries.seriesKey = resolveResult.seriesKey;
      }
      existingSeries.hasUpdate = false;
      existingSeries.nextChapterUrl = null;
      existingSeries.updatedAt = now;
    }

    let archivedInfo: { id: string; label: string; purgeAt: string } | undefined;
    if (previousCurrentChapter) {
      previousCurrentChapter.isCurrent = false;
      previousCurrentChapter.archivedAt = now;
      const purgeDate = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
      previousCurrentChapter.purgeAt = purgeDate;
      chaptersDb.set(previousCurrentChapter.id, previousCurrentChapter);

      archivedInfo = {
        id: previousCurrentChapter.id,
        label: previousCurrentChapter.chapterLabel,
        purgeAt: purgeDate.toISOString(),
      };
    }

    let targetChapterId: string;
    let existingChapterRow: ChapterRecord | undefined;
    for (const ch of chaptersDb.values()) {
      if (ch.seriesId === seriesId && ch.url === resolveResult.chapterUrl) {
        existingChapterRow = ch;
        break;
      }
    }

    if (existingChapterRow) {
      targetChapterId = existingChapterRow.id;
      existingChapterRow.isCurrent = true;
      existingChapterRow.archivedAt = null;
      existingChapterRow.purgeAt = null;
      existingChapterRow.chapterLabel = resolveResult.chapterLabel;
      existingChapterRow.chapterNumber = resolveResult.chapterNumber ?? existingChapterRow.chapterNumber;
      existingChapterRow.savedAt = now;
      chaptersDb.set(targetChapterId, existingChapterRow);
    } else {
      targetChapterId = randomUUID();
      const newChapter: ChapterRecord = {
        id: targetChapterId,
        seriesId: seriesId!,
        url: resolveResult.chapterUrl,
        chapterLabel: resolveResult.chapterLabel,
        chapterNumber: resolveResult.chapterNumber ?? null,
        isCurrent: true,
        archivedAt: null,
        purgeAt: null,
        restoredCount: 0,
        savedAt: now,
      };
      chaptersDb.set(targetChapterId, newChapter);
    }

    existingSeries.currentChapterId = targetChapterId;
    seriesDb.set(seriesId!, existingSeries);

    const undoToken = 'ut_' + randomUUID().replace(/-/g, '');
    const undoRecord: UndoTokenRecord = {
      token: undoToken,
      userId,
      payload: {
        action,
        seriesId: seriesId!,
        previousCurrentChapterId: previousCurrentChapter?.id || null,
        insertedChapterId: targetChapterId,
        previousSeriesState: previousStatus ? { status: previousStatus } : undefined,
      },
      expiresAt: new Date(now.getTime() + 60 * 1000),
      consumedAt: null,
    };
    undoTokensDb.set(undoToken, undoRecord);

    const title = existingSeries.customTitle || existingSeries.autoTitle || 'Untitled Series';
    const currentSavedCh = chaptersDb.get(targetChapterId)!;

    return {
      action,
      wentBackward,
      series: {
        id: seriesId!,
        title,
        coverUrl: existingSeries.coverUrl,
        status: existingSeries.status,
        tags: existingSeries.tags,
        seriesKey: existingSeries.seriesKey,
        confidence: existingSeries.confidence,
        needsReview: existingSeries.needsReview,
      },
      chapter: {
        id: targetChapterId,
        url: currentSavedCh.url,
        label: currentSavedCh.chapterLabel,
        number: currentSavedCh.chapterNumber,
      },
      archivedChapter: archivedInfo,
      undoToken,
    };
  }

  // Reverse a save with Undo Token
  static undo(userId: string, token: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .select()
          .from(schema.undoTokens)
          .where(and(eq(schema.undoTokens.token, token), eq(schema.undoTokens.userId, userId)))
          .limit(1);

        if (rows.length === 0) {
          return { success: false, message: 'Invalid or expired undo token' };
        }

        const record = rows[0];
        if (record.consumedAt || new Date(record.expiresAt).getTime() < Date.now()) {
          return { success: false, message: 'Undo token has expired or already been used' };
        }

        const payload = record.payload as any;
        const { action, seriesId, previousCurrentChapterId, insertedChapterId, previousSeriesState } = payload;

        await db.delete(schema.chapters).where(eq(schema.chapters.id, insertedChapterId));

        if (action === 'created') {
          await db.delete(schema.series).where(eq(schema.series.id, seriesId));
        } else {
          if (previousCurrentChapterId) {
            await db
              .update(schema.chapters)
              .set({ isCurrent: true, archivedAt: null, purgeAt: null })
              .where(eq(schema.chapters.id, previousCurrentChapterId));
            await db
              .update(schema.series)
              .set({
                currentChapterId: previousCurrentChapterId,
                ...(previousSeriesState?.status ? { status: previousSeriesState.status } : {}),
              })
              .where(eq(schema.series.id, seriesId));
          } else {
            await db
              .update(schema.series)
              .set({
                currentChapterId: null,
                ...(previousSeriesState?.status ? { status: previousSeriesState.status } : {}),
              })
              .where(eq(schema.series.id, seriesId));
          }
        }

        await db
          .update(schema.undoTokens)
          .set({ consumedAt: new Date() })
          .where(eq(schema.undoTokens.token, token));

        return { success: true, message: 'Operation successfully reversed' };
      })();
    }

    // In-memory fallback
    const record = undoTokensDb.get(token);
    if (!record || record.userId !== userId) {
      return { success: false, message: 'Invalid or expired undo token' };
    }

    if (record.consumedAt || record.expiresAt.getTime() < Date.now()) {
      return { success: false, message: 'Undo token has expired or already been used' };
    }

    const { action, seriesId, previousCurrentChapterId, insertedChapterId, previousSeriesState } =
      record.payload;

    chaptersDb.delete(insertedChapterId);

    if (action === 'created') {
      seriesDb.delete(seriesId);
    } else {
      const series = seriesDb.get(seriesId);
      if (series) {
        if (previousCurrentChapterId) {
          const prevCh = chaptersDb.get(previousCurrentChapterId);
          if (prevCh) {
            prevCh.isCurrent = true;
            prevCh.archivedAt = null;
            prevCh.purgeAt = null;
            chaptersDb.set(prevCh.id, prevCh);
          }
          series.currentChapterId = previousCurrentChapterId;
        } else {
          series.currentChapterId = null;
        }

        if (previousSeriesState?.status) {
          series.status = previousSeriesState.status;
        }

        seriesDb.set(seriesId, series);
      }
    }

    record.consumedAt = new Date();
    undoTokensDb.set(token, record);

    return { success: true, message: 'Operation successfully reversed' };
  }

  // Update Series metadata
  static updateSeries(
    userId: string,
    seriesId: string,
    updates: {
      customTitle?: string;
      status?: SeriesRecord['status'];
      tags?: string[];
      coverUrl?: string;
    }
  ): any {
    if (db) {
      return (async () => {
        const dbUpdates: any = { updatedAt: new Date() };
        if (updates.customTitle !== undefined) dbUpdates.customTitle = updates.customTitle.trim() || null;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
        if (updates.coverUrl !== undefined) dbUpdates.coverUrl = updates.coverUrl;

        const rows = await db
          .update(schema.series)
          .set(dbUpdates)
          .where(and(eq(schema.series.id, seriesId), eq(schema.series.userId, userId)))
          .returning();

        return rows[0] ? toSeriesRecord(rows[0]) : undefined;
      })();
    }

    const s = DataStore.findSeriesById(userId, seriesId);
    if (!s) return undefined;

    if (updates.customTitle !== undefined) s.customTitle = updates.customTitle.trim() || null;
    if (updates.status !== undefined) s.status = updates.status;
    if (updates.tags !== undefined) s.tags = updates.tags;
    if (updates.coverUrl !== undefined) s.coverUrl = updates.coverUrl;
    s.updatedAt = new Date();

    seriesDb.set(seriesId, s);
    return s;
  }

  // Mark reading / read transition on Continue click
  static markSeriesRead(userId: string, seriesId: string): any {
    if (db) {
      return (async () => {
        const now = new Date();
        const rows = await db
          .update(schema.series)
          .set({ status: 'reading', lastReadAt: now, updatedAt: now })
          .where(and(eq(schema.series.id, seriesId), eq(schema.series.userId, userId)))
          .returning();
        return rows[0] ? toSeriesRecord(rows[0]) : undefined;
      })();
    }

    const s = DataStore.findSeriesById(userId, seriesId);
    if (!s) return undefined;

    s.status = 'reading';
    s.lastReadAt = new Date();
    s.updatedAt = new Date();
    seriesDb.set(seriesId, s);
    return s;
  }

  // Delete Series (and all its chapters)
  static deleteSeries(userId: string, seriesId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .delete(schema.series)
          .where(and(eq(schema.series.id, seriesId), eq(schema.series.userId, userId)))
          .returning({ id: schema.series.id });
        return rows.length > 0;
      })();
    }

    const s = DataStore.findSeriesById(userId, seriesId);
    if (!s) return false;

    for (const [chId, ch] of Array.from(chaptersDb.entries())) {
      if (ch.seriesId === seriesId) {
        chaptersDb.delete(chId);
      }
    }

    seriesDb.delete(seriesId);
    return true;
  }

  // ================= API Tokens =================

  static createApiToken(userId: string, name: string): any {
    const rawToken = 'mgt_' + randomBytes(24).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const lastFour = rawToken.slice(-4);
    const id = randomUUID();
    const now = new Date();

    const record: ApiTokenRecord = {
      id,
      userId,
      name: name.trim() || 'API Token',
      tokenHash,
      lastFour,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    };

    apiTokensDb.set(id, record);

    if (db) {
      return (async () => {
        try {
          await db.insert(schema.users).values({ id: userId, email: null }).onConflictDoNothing();
          await db.insert(schema.apiTokens).values({
            id,
            userId,
            name: record.name,
            tokenHash,
            createdAt: now,
          });
        } catch {
          // ignore
        }
        return { record, rawToken };
      })();
    }

    return { record, rawToken };
  }

  static listApiTokens(userId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .select()
          .from(schema.apiTokens)
          .where(and(eq(schema.apiTokens.userId, userId), sql`${schema.apiTokens.revokedAt} IS NULL`))
          .orderBy(desc(schema.apiTokens.createdAt));

        return rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          name: r.name,
          tokenHash: r.tokenHash,
          lastFour: '****',
          createdAt: new Date(r.createdAt),
          lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt) : null,
          revokedAt: r.revokedAt ? new Date(r.revokedAt) : null,
        }));
      })();
    }

    const list: ApiTokenRecord[] = [];
    for (const t of apiTokensDb.values()) {
      if (t.userId === userId && !t.revokedAt) {
        list.push({ ...t });
      }
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static revokeApiToken(userId: string, tokenId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .update(schema.apiTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(schema.apiTokens.id, tokenId), eq(schema.apiTokens.userId, userId)))
          .returning({ id: schema.apiTokens.id });
        apiTokensDb.delete(tokenId);
        return rows.length > 0;
      })();
    }

    const token = apiTokensDb.get(tokenId);
    if (!token || token.userId !== userId || token.revokedAt) {
      return false;
    }
    token.revokedAt = new Date();
    apiTokensDb.set(tokenId, token);
    return true;
  }

  static verifyApiToken(rawToken: string): any {
    if (!rawToken || !rawToken.trim()) return null;
    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');

    if (db) {
      return (async () => {
        const rows = await db
          .select()
          .from(schema.apiTokens)
          .where(and(eq(schema.apiTokens.tokenHash, tokenHash), sql`${schema.apiTokens.revokedAt} IS NULL`))
          .limit(1);

        if (rows[0]) {
          await db
            .update(schema.apiTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(schema.apiTokens.id, rows[0].id));
          return { userId: rows[0].userId, tokenId: rows[0].id };
        }
        return null;
      })();
    }

    for (const t of apiTokensDb.values()) {
      if (t.tokenHash === tokenHash && !t.revokedAt) {
        t.lastUsedAt = new Date();
        apiTokensDb.set(t.id, t);
        return { userId: t.userId, tokenId: t.id };
      }
    }
    return null;
  }

  // ================= Trash & Chapter Management =================

  static listArchivedChapters(userId: string): any {
    if (db) {
      return (async () => {
        const rows = await db
          .select({
            chapter: schema.chapters,
            seriesTitle: sql<string>`coalesce(${schema.series.customTitle}, ${schema.series.autoTitle}, 'Untitled Series')`,
            seriesCoverUrl: schema.series.coverUrl,
          })
          .from(schema.chapters)
          .innerJoin(schema.series, eq(schema.chapters.seriesId, schema.series.id))
          .where(
            and(
              eq(schema.series.userId, userId),
              eq(schema.chapters.isCurrent, false),
              sql`${schema.chapters.archivedAt} IS NOT NULL`
            )
          )
          .orderBy(desc(schema.chapters.archivedAt));

        const now = Date.now();
        return rows.map(({ chapter, seriesTitle, seriesCoverUrl }) => {
          const purgeTime = chapter.purgeAt ? new Date(chapter.purgeAt).getTime() : now + 30 * 86400000;
          const daysRemaining = Math.max(0, Math.ceil((purgeTime - now) / (1000 * 60 * 60 * 24)));
          return {
            ...toChapterRecord(chapter),
            seriesTitle,
            seriesCoverUrl,
            daysRemaining,
          };
        });
      })();
    }

    const list: Array<ChapterRecord & {
      seriesTitle: string;
      seriesCoverUrl: string | null;
      daysRemaining: number;
    }> = [];

    const now = Date.now();

    for (const ch of chaptersDb.values()) {
      if (ch.archivedAt && !ch.isCurrent) {
        const series = seriesDb.get(ch.seriesId);
        if (series && series.userId === userId) {
          const purgeTime = ch.purgeAt ? ch.purgeAt.getTime() : now + 30 * 86400000;
          const daysRemaining = Math.max(0, Math.ceil((purgeTime - now) / (1000 * 60 * 60 * 24)));

          list.push({
            ...ch,
            seriesTitle: series.customTitle || series.autoTitle || 'Untitled Series',
            seriesCoverUrl: series.coverUrl,
            daysRemaining,
          });
        }
      }
    }

    return list.sort((a, b) => {
      const timeA = a.archivedAt ? a.archivedAt.getTime() : 0;
      const timeB = b.archivedAt ? b.archivedAt.getTime() : 0;
      return timeB - timeA;
    });
  }

  static restoreChapter(userId: string, chapterId: string): any {
    if (db) {
      return (async () => {
        const chRows = await db
          .select()
          .from(schema.chapters)
          .where(eq(schema.chapters.id, chapterId))
          .limit(1);
        if (chRows.length === 0) return { success: false, message: 'Chapter not found' };
        const targetCh = chRows[0];

        const sRows = await db
          .select()
          .from(schema.series)
          .where(and(eq(schema.series.id, targetCh.seriesId), eq(schema.series.userId, userId)))
          .limit(1);
        if (sRows.length === 0) return { success: false, message: 'Series not found' };
        const series = sRows[0];

        if (series.currentChapterId && series.currentChapterId !== chapterId) {
          await db
            .update(schema.chapters)
            .set({ isCurrent: false, archivedAt: new Date(), purgeAt: new Date(Date.now() + 30 * 86400000) })
            .where(eq(schema.chapters.id, series.currentChapterId));
        }

        const updatedCh = await db
          .update(schema.chapters)
          .set({
            isCurrent: true,
            archivedAt: null,
            purgeAt: null,
            restoredCount: (targetCh.restoredCount || 0) + 1,
          })
          .where(eq(schema.chapters.id, chapterId))
          .returning();

        const updatedS = await db
          .update(schema.series)
          .set({ currentChapterId: chapterId, updatedAt: new Date() })
          .where(eq(schema.series.id, series.id))
          .returning();

        return {
          success: true,
          series: toSeriesRecord(updatedS[0]),
          chapter: toChapterRecord(updatedCh[0]),
        };
      })();
    }

    const targetChapter = chaptersDb.get(chapterId);
    if (!targetChapter) return { success: false, message: 'Chapter not found' };

    const series = seriesDb.get(targetChapter.seriesId);
    if (!series || series.userId !== userId) return { success: false, message: 'Series not found' };

    if (series.currentChapterId && series.currentChapterId !== chapterId) {
      const currentCh = chaptersDb.get(series.currentChapterId);
      if (currentCh) {
        currentCh.isCurrent = false;
        currentCh.archivedAt = new Date();
        currentCh.purgeAt = new Date(Date.now() + 30 * 86400000);
        chaptersDb.set(currentCh.id, currentCh);
      }
    }

    targetChapter.isCurrent = true;
    targetChapter.archivedAt = null;
    targetChapter.purgeAt = null;
    targetChapter.restoredCount = (targetChapter.restoredCount || 0) + 1;
    chaptersDb.set(targetChapter.id, targetChapter);

    series.currentChapterId = targetChapter.id;
    series.updatedAt = new Date();
    seriesDb.set(series.id, series);

    return { success: true, series, chapter: targetChapter };
  }

  static deleteChapter(userId: string, chapterId: string): any {
    if (db) {
      return (async () => {
        const chRows = await db
          .select()
          .from(schema.chapters)
          .where(eq(schema.chapters.id, chapterId))
          .limit(1);
        if (chRows.length === 0) return false;
        const ch = chRows[0];

        const sRows = await db
          .select()
          .from(schema.series)
          .where(and(eq(schema.series.id, ch.seriesId), eq(schema.series.userId, userId)))
          .limit(1);
        if (sRows.length === 0) return false;
        const series = sRows[0];

        if (series.currentChapterId === chapterId) {
          const remaining = await db
            .select()
            .from(schema.chapters)
            .where(and(eq(schema.chapters.seriesId, series.id), sql`${schema.chapters.id} != ${chapterId}`))
            .orderBy(desc(schema.chapters.savedAt));

          if (remaining.length > 0) {
            const nextCurrent = remaining[0];
            await db
              .update(schema.chapters)
              .set({ isCurrent: true, archivedAt: null, purgeAt: null })
              .where(eq(schema.chapters.id, nextCurrent.id));
            await db
              .update(schema.series)
              .set({ currentChapterId: nextCurrent.id, updatedAt: new Date() })
              .where(eq(schema.series.id, series.id));
          } else {
            await db
              .update(schema.series)
              .set({ currentChapterId: null, updatedAt: new Date() })
              .where(eq(schema.series.id, series.id));
          }
        }

        await db.delete(schema.chapters).where(eq(schema.chapters.id, chapterId));
        return true;
      })();
    }

    const chapter = chaptersDb.get(chapterId);
    if (!chapter) return false;

    const series = seriesDb.get(chapter.seriesId);
    if (!series || series.userId !== userId) return false;

    if (series.currentChapterId === chapterId) {
      const remaining = DataStore.getChaptersForSeries(series.id).filter((c: ChapterRecord) => c.id !== chapterId);
      if (remaining.length > 0) {
        remaining[0].isCurrent = true;
        remaining[0].archivedAt = null;
        remaining[0].purgeAt = null;
        chaptersDb.set(remaining[0].id, remaining[0]);
        series.currentChapterId = remaining[0].id;
      } else {
        series.currentChapterId = null;
      }
      series.updatedAt = new Date();
      seriesDb.set(series.id, series);
    }

    chaptersDb.delete(chapterId);
    return true;
  }

  // ================= Series Merging Engine =================

  static mergeSeries(
    userId: string,
    targetSeriesId: string,
    sourceSeriesId: string
  ): any {
    if (targetSeriesId === sourceSeriesId) {
      return { success: false, message: 'Cannot merge a series into itself' };
    }

    if (db) {
      return (async () => {
        const target = await DataStore.findSeriesById(userId, targetSeriesId);
        const source = await DataStore.findSeriesById(userId, sourceSeriesId);
        if (!target || !source) return { success: false, message: 'Target or source series not found' };

        await db
          .update(schema.chapters)
          .set({ seriesId: targetSeriesId })
          .where(eq(schema.chapters.seriesId, sourceSeriesId));

        const combinedTags = Array.from(new Set([...target.tags, ...source.tags]));
        const allChapters = await DataStore.getChaptersForSeries(targetSeriesId);
        let targetUpdates: any = { tags: combinedTags, updatedAt: new Date() };

        if (allChapters.length > 0) {
          const sorted = [...allChapters].sort((a: ChapterRecord, b: ChapterRecord) => {
            if (a.chapterNumber != null && b.chapterNumber != null) {
              return b.chapterNumber - a.chapterNumber;
            }
            return b.savedAt.getTime() - a.savedAt.getTime();
          });
          const bestCurrent = sorted[0];

          for (const ch of allChapters) {
            const isCurr = ch.id === bestCurrent.id;
            await db
              .update(schema.chapters)
              .set({
                isCurrent: isCurr,
                archivedAt: isCurr ? null : (ch.archivedAt || new Date()),
                purgeAt: isCurr ? null : (ch.purgeAt || new Date(Date.now() + 30 * 86400000)),
              })
              .where(eq(schema.chapters.id, ch.id));
          }
          targetUpdates.currentChapterId = bestCurrent.id;
          if (bestCurrent.seriesId === sourceSeriesId) {
            if (source.urlPattern) targetUpdates.urlPattern = source.urlPattern;
            if (source.seriesKey) targetUpdates.seriesKey = source.seriesKey;
          }
          targetUpdates.nextChapterUrl = null;
          targetUpdates.hasUpdate = false;
        }

        if (!target.coverUrl && source.coverUrl) targetUpdates.coverUrl = source.coverUrl;
        if (!target.customTitle && !target.autoTitle && (source.customTitle || source.autoTitle)) {
          targetUpdates.autoTitle = source.customTitle || source.autoTitle;
        }

        const updated = await db
          .update(schema.series)
          .set(targetUpdates)
          .where(eq(schema.series.id, targetSeriesId))
          .returning();

        await db.delete(schema.series).where(eq(schema.series.id, sourceSeriesId));
        return { success: true, targetSeries: toSeriesRecord(updated[0]) };
      })();
    }

    const target = DataStore.findSeriesById(userId, targetSeriesId);
    const source = DataStore.findSeriesById(userId, sourceSeriesId);

    if (!target || !source) {
      return { success: false, message: 'Target or source series not found' };
    }

    for (const ch of chaptersDb.values()) {
      if (ch.seriesId === sourceSeriesId) {
        ch.seriesId = targetSeriesId;
        chaptersDb.set(ch.id, ch);
      }
    }

    const combinedTags = Array.from(new Set([...target.tags, ...source.tags]));
    target.tags = combinedTags;

    const allChapters = DataStore.getChaptersForSeries(targetSeriesId);
    if (allChapters.length > 0) {
      const sorted = [...allChapters].sort((a: ChapterRecord, b: ChapterRecord) => {
        if (a.chapterNumber != null && b.chapterNumber != null) {
          return b.chapterNumber - a.chapterNumber;
        }
        return b.savedAt.getTime() - a.savedAt.getTime();
      });

      const bestCurrent = sorted[0];
      for (const ch of allChapters) {
        ch.isCurrent = ch.id === bestCurrent.id;
        if (ch.isCurrent) {
          ch.archivedAt = null;
          ch.purgeAt = null;
        } else if (!ch.archivedAt) {
          ch.archivedAt = new Date();
          ch.purgeAt = new Date(Date.now() + 30 * 86400000);
        }
        chaptersDb.set(ch.id, ch);
      }
      target.currentChapterId = bestCurrent.id;

      if (bestCurrent.seriesId === sourceSeriesId) {
        if (source.urlPattern) target.urlPattern = source.urlPattern;
        if (source.seriesKey) target.seriesKey = source.seriesKey;
      }

      target.nextChapterUrl = null;
      target.hasUpdate = false;
    }

    if (!target.coverUrl && source.coverUrl) target.coverUrl = source.coverUrl;
    if (!target.customTitle && !target.autoTitle && (source.customTitle || source.autoTitle)) {
      target.autoTitle = source.customTitle || source.autoTitle;
    }

    target.updatedAt = new Date();
    seriesDb.set(targetSeriesId, target);

    seriesDb.delete(sourceSeriesId);

    return { success: true, targetSeries: target };
  }

  static getMergeSuggestions(
    userId: string,
    currentSeriesId: string,
    titleQuery: string
  ): any {
    if (!titleQuery || titleQuery.length < 2) return [];
    const tokens = titleQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return [];

    if (db) {
      return (async () => {
        const all = await db
          .select()
          .from(schema.series)
          .where(and(eq(schema.series.userId, userId), sql`${schema.series.id} != ${currentSeriesId}`));
        const matches: Array<{ id: string; title: string; coverUrl: string | null }> = [];
        for (const s of all) {
          const sTitle = (s.customTitle || s.autoTitle || '').toLowerCase();
          if (tokens.some((token) => sTitle.includes(token))) {
            matches.push({
              id: s.id,
              title: s.customTitle || s.autoTitle || 'Untitled Series',
              coverUrl: s.coverUrl,
            });
          }
        }
        return matches.slice(0, 5);
      })();
    }

    const matches: Array<{ id: string; title: string; coverUrl: string | null }> = [];

    for (const s of seriesDb.values()) {
      if (s.userId !== userId || s.id === currentSeriesId) continue;
      const sTitle = (s.customTitle || s.autoTitle || '').toLowerCase();
      if (!sTitle) continue;

      const hasMatch = tokens.some((token) => sTitle.includes(token));
      if (hasMatch) {
        matches.push({
          id: s.id,
          title: s.customTitle || s.autoTitle || 'Untitled Series',
          coverUrl: s.coverUrl,
        });
      }
    }

    return matches.slice(0, 5);
  }

  // ================= Automated Purge & Cron =================

  static purgeExpiredChapters(now = new Date()): any {
    if (db) {
      return (async () => {
        const deleted = await db
          .delete(schema.chapters)
          .where(
            and(
              eq(schema.chapters.isCurrent, false),
              sql`${schema.chapters.archivedAt} IS NOT NULL`,
              lte(schema.chapters.purgeAt, now)
            )
          )
          .returning({ id: schema.chapters.id });

        return {
          purgedCount: deleted.length,
          chapterIds: deleted.map((d) => d.id),
        };
      })();
    }

    const deleted: string[] = [];

    for (const [chId, ch] of Array.from(chaptersDb.entries())) {
      if (!ch.isCurrent && ch.archivedAt && ch.purgeAt && ch.purgeAt.getTime() <= now.getTime()) {
        chaptersDb.delete(chId);
        deleted.push(chId);
      }
    }

    return {
      purgedCount: deleted.length,
      chapterIds: deleted,
    };
  }

  // ================= Update Checking Worker =================

  static async checkSeriesUpdates(
    userId: string,
    limit = 50
  ): Promise<{
    checkedCount: number;
    updatedCount: number;
    results: Array<{
      seriesId: string;
      title: string;
      hasUpdate: boolean;
      nextChapterUrl: string | null;
      error?: string;
    }>;
  }> {
    const activeStatuses: SeriesRecord['status'][] = ['reading', 'unread', 'waiting'];
    const { items: allSeries } = await DataStore.listSeries(userId, {
      status: activeStatuses,
      sort: 'updated',
      limit,
    });

    const targetSeries = allSeries;
    const results: Array<{
      seriesId: string;
      title: string;
      hasUpdate: boolean;
      nextChapterUrl: string | null;
      error?: string;
    }> = [];

    let updatedCount = 0;

    for (const s of targetSeries) {
      const title = s.customTitle || s.autoTitle || 'Untitled Series';
      const currentChapter = await DataStore.getCurrentChapter(s.id);

      if (!currentChapter) {
        results.push({
          seriesId: s.id,
          title,
          hasUpdate: false,
          nextChapterUrl: null,
          error: 'NO_CHAPTERS',
        });
        continue;
      }

      try {
        let checkResult: { hasUpdate: boolean; nextChapterUrl: string | null } = {
          hasUpdate: false,
          nextChapterUrl: null,
        };

        if (s.source === 'mangadex') {
          const nextUrl = await mangadexAdapter.nextChapterUrl({
            seriesKey: s.seriesKey,
            currentUrl: currentChapter.url,
            currentChapterNumber: currentChapter.chapterNumber ?? undefined,
            language: s.language || 'en',
          });
          checkResult = {
            hasUpdate: Boolean(nextUrl),
            nextChapterUrl: nextUrl,
          };
        } else if (s.urlPattern && currentChapter.chapterNumber != null) {
          const nextUrl = await genericAdapter.nextChapterUrl({
            seriesKey: s.seriesKey,
            currentUrl: currentChapter.url,
            currentChapterNumber: currentChapter.chapterNumber,
            urlPattern: s.urlPattern,
          });
          checkResult = {
            hasUpdate: Boolean(nextUrl),
            nextChapterUrl: nextUrl,
          };
        }

        if (checkResult.hasUpdate && checkResult.nextChapterUrl) {
          s.hasUpdate = true;
          s.nextChapterUrl = checkResult.nextChapterUrl;
          updatedCount++;
        } else {
          s.hasUpdate = false;
          s.nextChapterUrl = null;
        }

        s.lastCheckedAt = new Date();

        if (db) {
          await db
            .update(schema.series)
            .set({
              hasUpdate: s.hasUpdate,
              nextChapterUrl: s.nextChapterUrl,
              lastCheckedAt: s.lastCheckedAt,
            })
            .where(eq(schema.series.id, s.id));
        } else {
          seriesDb.set(s.id, s);
        }

        results.push({
          seriesId: s.id,
          title,
          hasUpdate: s.hasUpdate,
          nextChapterUrl: s.nextChapterUrl,
        });
      } catch (err: unknown) {
        results.push({
          seriesId: s.id,
          title,
          hasUpdate: s.hasUpdate,
          nextChapterUrl: s.nextChapterUrl,
          error: (err as Error).message || 'CHECK_FAILED',
        });
      }
    }

    return {
      checkedCount: targetSeries.length,
      updatedCount,
      results,
    };
  }

  // ================= Import & Export Engine =================

  static exportData(userId: string): any {
    if (db) {
      return (async () => {
        const { items: userSeries } = await DataStore.listSeries(userId, { limit: 10000 });
        const seriesWithChapters = await Promise.all(
          userSeries.map(async (s: any) => ({
            ...s,
            chapters: await DataStore.getChaptersForSeries(s.id),
          }))
        );

        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          series: seriesWithChapters,
        };
      })();
    }

    const userSeries = Array.from(seriesDb.values()).filter((s) => s.userId === userId);
    const seriesWithChapters = userSeries.map((s) => ({
      ...s,
      chapters: DataStore.getChaptersForSeries(s.id),
    }));

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      series: seriesWithChapters,
    };
  }

  static restoreBackup(
    userId: string,
    backupData: {
      version: number;
      series: Array<
        SeriesRecord & {
          chapters?: ChapterRecord[];
        }
      >;
    },
    dryRun = false
  ): any {
    if (db) {
      return (async () => {
        const preview: Array<{
          url: string;
          seriesKey: string;
          seriesTitle: string;
          chapterLabel: string;
          isNewSeries: boolean;
          existingSeriesId?: string;
        }> = [];

        let newSeriesCount = 0;
        let existingSeriesCount = 0;
        let chaptersCount = 0;

        const seriesList = backupData.series || [];

        for (const s of seriesList) {
          const existing = await DataStore.findSeriesByKey(userId, s.seriesKey);
          const isNew = !existing;
          if (isNew) {
            newSeriesCount++;
          } else {
            existingSeriesCount++;
          }

          const incomingChapters = s.chapters || [];
          const currentCh = incomingChapters.find((c) => c.isCurrent) || incomingChapters[0];

          preview.push({
            url: currentCh?.url || '',
            seriesKey: s.seriesKey,
            seriesTitle: s.customTitle || s.autoTitle || 'Untitled Series',
            chapterLabel: currentCh
              ? `${currentCh.chapterLabel} (${incomingChapters.length} ch)`
              : `${incomingChapters.length} ch`,
            isNewSeries: isNew,
            existingSeriesId: existing?.id,
          });

          if (!dryRun) {
            const targetSeriesId = existing?.id || s.id || randomUUID();
            const targetSeriesValues = {
              id: targetSeriesId,
              userId,
              seriesKey: s.seriesKey,
              source: s.source || 'generic',
              urlPattern: s.urlPattern || null,
              autoTitle: s.autoTitle || null,
              customTitle: s.customTitle || existing?.customTitle || null,
              coverUrl: s.coverUrl || existing?.coverUrl || null,
              status: s.status || 'unread',
              tags: Array.from(new Set([...(existing?.tags || []), ...(s.tags || [])])),
              language: s.language || null,
              confidence: s.confidence || 'high',
              needsReview: s.needsReview || false,
              lastReadAt: s.lastReadAt ? new Date(s.lastReadAt) : null,
              lastCheckedAt: s.lastCheckedAt ? new Date(s.lastCheckedAt) : null,
              hasUpdate: s.hasUpdate || false,
              nextChapterUrl: s.nextChapterUrl || null,
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
              updatedAt: new Date(),
            };

            if (existing) {
              await db
                .update(schema.series)
                .set(targetSeriesValues)
                .where(eq(schema.series.id, targetSeriesId));
            } else {
              await db.insert(schema.series).values(targetSeriesValues);
            }

            let activeCurrentChapterId: string | null = null;
            for (const ch of incomingChapters) {
              const existingRows = await db
                .select()
                .from(schema.chapters)
                .where(
                  and(
                    eq(schema.chapters.seriesId, targetSeriesId),
                    eq(schema.chapters.url, ch.url)
                  )
                )
                .limit(1);

              const existingCh = existingRows[0];
              const chId = existingCh?.id || ch.id || randomUUID();

              const chValues = {
                id: chId,
                seriesId: targetSeriesId,
                url: ch.url,
                chapterLabel: ch.chapterLabel,
                chapterNumber: ch.chapterNumber != null ? String(ch.chapterNumber) : null,
                isCurrent: Boolean(ch.isCurrent),
                archivedAt: ch.archivedAt ? new Date(ch.archivedAt) : null,
                purgeAt: ch.purgeAt ? new Date(ch.purgeAt) : null,
                restoredCount: ch.restoredCount || 0,
                savedAt: ch.savedAt ? new Date(ch.savedAt) : new Date(),
              };

              if (existingCh) {
                await db
                  .update(schema.chapters)
                  .set(chValues)
                  .where(eq(schema.chapters.id, chId));
              } else {
                await db.insert(schema.chapters).values(chValues);
              }

              chaptersCount++;

              if (chValues.isCurrent) {
                activeCurrentChapterId = chId;
              }
            }

            if (!activeCurrentChapterId && incomingChapters.length > 0) {
              const allChapters = await db
                .select()
                .from(schema.chapters)
                .where(eq(schema.chapters.seriesId, targetSeriesId))
                .orderBy(desc(schema.chapters.savedAt))
                .limit(1);

              if (allChapters.length > 0) {
                activeCurrentChapterId = allChapters[0].id;
                await db
                  .update(schema.chapters)
                  .set({ isCurrent: true })
                  .where(eq(schema.chapters.id, activeCurrentChapterId));
              }
            }

            if (activeCurrentChapterId) {
              await db
                .update(schema.series)
                .set({ currentChapterId: activeCurrentChapterId })
                .where(eq(schema.series.id, targetSeriesId));
            }
          }
        }

        return {
          dryRun,
          totalItems: seriesList.length,
          seriesCount: seriesList.length,
          chaptersCount: dryRun
            ? seriesList.reduce((acc, s) => acc + (s.chapters?.length || 0), 0)
            : chaptersCount,
          newSeriesCount,
          existingSeriesCount,
          preview,
          savedCount: chaptersCount,
        };
      })();
    }

    // In-memory fallback
    const preview: Array<{
      url: string;
      seriesKey: string;
      seriesTitle: string;
      chapterLabel: string;
      isNewSeries: boolean;
      existingSeriesId?: string;
    }> = [];

    let newSeriesCount = 0;
    let existingSeriesCount = 0;
    let chaptersCount = 0;

    const seriesList = backupData.series || [];

    for (const s of seriesList) {
      const existing = DataStore.findSeriesByKey(userId, s.seriesKey);
      const isNew = !existing;
      if (isNew) {
        newSeriesCount++;
      } else {
        existingSeriesCount++;
      }

      const incomingChapters = s.chapters || [];
      const currentCh = incomingChapters.find((c) => c.isCurrent) || incomingChapters[0];

      preview.push({
        url: currentCh?.url || '',
        seriesKey: s.seriesKey,
        seriesTitle: s.customTitle || s.autoTitle || 'Untitled Series',
        chapterLabel: currentCh ? `${currentCh.chapterLabel} (${incomingChapters.length} ch)` : `${incomingChapters.length} ch`,
        isNewSeries: isNew,
        existingSeriesId: existing?.id,
      });

      if (!dryRun) {
        const targetSeriesId = existing?.id || s.id || randomUUID();
        const targetSeries: SeriesRecord = {
          id: targetSeriesId,
          userId,
          seriesKey: s.seriesKey,
          source: s.source || 'generic',
          urlPattern: s.urlPattern || null,
          autoTitle: s.autoTitle || null,
          customTitle: s.customTitle || existing?.customTitle || null,
          coverUrl: s.coverUrl || existing?.coverUrl || null,
          status: s.status || 'unread',
          tags: Array.from(new Set([...(existing?.tags || []), ...(s.tags || [])])),
          language: s.language || null,
          currentChapterId: null,
          confidence: s.confidence || 'high',
          needsReview: s.needsReview || false,
          lastReadAt: s.lastReadAt ? new Date(s.lastReadAt) : null,
          lastCheckedAt: s.lastCheckedAt ? new Date(s.lastCheckedAt) : null,
          hasUpdate: s.hasUpdate || false,
          nextChapterUrl: s.nextChapterUrl || null,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: new Date(),
        };

        let activeCurrentChapterId: string | null = null;
        for (const ch of incomingChapters) {
          let existingCh: ChapterRecord | undefined;
          for (const c of chaptersDb.values()) {
            if (c.seriesId === targetSeriesId && c.url === ch.url) {
              existingCh = c;
              break;
            }
          }

          const chId = existingCh?.id || ch.id || randomUUID();
          const chRecord: ChapterRecord = {
            id: chId,
            seriesId: targetSeriesId,
            url: ch.url,
            chapterLabel: ch.chapterLabel,
            chapterNumber: ch.chapterNumber ?? null,
            isCurrent: Boolean(ch.isCurrent),
            archivedAt: ch.archivedAt ? new Date(ch.archivedAt) : null,
            purgeAt: ch.purgeAt ? new Date(ch.purgeAt) : null,
            restoredCount: ch.restoredCount || 0,
            savedAt: ch.savedAt ? new Date(ch.savedAt) : new Date(),
          };

          chaptersDb.set(chId, chRecord);
          chaptersCount++;

          if (chRecord.isCurrent) {
            activeCurrentChapterId = chId;
          }
        }

        if (!activeCurrentChapterId && incomingChapters.length > 0) {
          const allChapters = DataStore.getChaptersForSeries(targetSeriesId);
          if (allChapters.length > 0) {
            allChapters[0].isCurrent = true;
            activeCurrentChapterId = allChapters[0].id;
            chaptersDb.set(allChapters[0].id, allChapters[0]);
          }
        }

        targetSeries.currentChapterId = activeCurrentChapterId;
        seriesDb.set(targetSeriesId, targetSeries);
      }
    }

    return {
      dryRun,
      totalItems: seriesList.length,
      seriesCount: seriesList.length,
      chaptersCount: dryRun
        ? seriesList.reduce((acc, s) => acc + (s.chapters?.length || 0), 0)
        : chaptersCount,
      newSeriesCount,
      existingSeriesCount,
      preview,
      savedCount: chaptersCount,
    };
  }

  static async importData(
    userId: string,
    items: Array<{
      url: string;
      customTitle?: string;
      tags?: string[];
      status?: SeriesRecord['status'];
    }>,
    dryRun = false
  ): Promise<{
    dryRun: boolean;
    totalItems: number;
    newSeriesCount: number;
    existingSeriesCount: number;
    preview?: Array<{
      url: string;
      seriesKey: string;
      seriesTitle: string;
      chapterLabel: string;
      isNewSeries: boolean;
      existingSeriesId?: string;
    }>;
    savedCount?: number;
  }> {
    const preview: Array<{
      url: string;
      seriesKey: string;
      seriesTitle: string;
      chapterLabel: string;
      isNewSeries: boolean;
      existingSeriesId?: string;
    }> = [];

    const seenSeriesKeys = new Set<string>();
    let newSeriesCount = 0;
    let existingSeriesCount = 0;
    let savedCount = 0;

    const groupedItems = new Map<
      string,
      Array<{
        item: (typeof items)[0];
        resolved: ResolveResult;
        isNewSeries: boolean;
        existingSeriesId?: string;
      }>
    >();

    for (const item of items) {
      if (!item.url || !/^https?:\/\//i.test(item.url)) continue;

      try {
        const resolved = await resolve(item.url);
        const existing = await DataStore.findSeriesByKey(userId, resolved.seriesKey);
        const isNew = !existing;

        if (!seenSeriesKeys.has(resolved.seriesKey)) {
          seenSeriesKeys.add(resolved.seriesKey);
          if (isNew) {
            newSeriesCount++;
          } else {
            existingSeriesCount++;
          }
        }

        const entry = {
          item,
          resolved,
          isNewSeries: isNew,
          existingSeriesId: existing?.id,
        };

        if (!groupedItems.has(resolved.seriesKey)) {
          groupedItems.set(resolved.seriesKey, []);
        }
        groupedItems.get(resolved.seriesKey)!.push(entry);

        preview.push({
          url: item.url,
          seriesKey: resolved.seriesKey,
          seriesTitle: item.customTitle || resolved.seriesTitle || 'Unknown Title',
          chapterLabel: resolved.chapterLabel,
          isNewSeries: isNew,
          existingSeriesId: existing?.id,
        });
      } catch {
        // Skip unresolvable items during bulk import
      }
    }

    if (!dryRun) {
      for (const [, entries] of groupedItems.entries()) {
        entries.sort((a, b) => {
          const numA = a.resolved.chapterNumber ?? -Infinity;
          const numB = b.resolved.chapterNumber ?? -Infinity;
          return numA - numB;
        });

        for (const { item, resolved } of entries) {
          await DataStore.saveChapter({
            userId,
            resolveResult: resolved,
            customTitle: item.customTitle,
            tags: item.tags,
            statusOverride: item.status,
          });
          savedCount++;
        }
      }
    }

    return {
      dryRun,
      totalItems: items.length,
      newSeriesCount,
      existingSeriesCount,
      ...(dryRun ? { preview } : { savedCount }),
    };
  }
}
