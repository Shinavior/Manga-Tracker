import { ApiTokenRecord, ChapterRecord, SaveResult, SeriesRecord, UndoTokenRecord } from './types';
import { ResolveResult } from '../resolver/types';
import { createHash, randomBytes, randomUUID } from 'crypto';

// Global in-memory persistent store (shared across route invocations in dev/single-user)
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

export class DataStore {
  // Clear all data (useful for test isolation)
  static clearAll() {
    seriesDb.clear();
    chaptersDb.clear();
    undoTokensDb.clear();
    apiTokensDb.clear();
  }

  // Find existing series by (userId, seriesKey)
  static findSeriesByKey(userId: string, seriesKey: string): SeriesRecord | undefined {
    for (const s of seriesDb.values()) {
      if (s.userId === userId && s.seriesKey === seriesKey) {
        return s;
      }
    }
    return undefined;
  }

  // Find series by ID
  static findSeriesById(userId: string, seriesId: string): SeriesRecord | undefined {
    const s = seriesDb.get(seriesId);
    if (s && s.userId === userId) return s;
    return undefined;
  }

  // Get current chapter of a series
  static getCurrentChapter(seriesId: string): ChapterRecord | undefined {
    for (const ch of chaptersDb.values()) {
      if (ch.seriesId === seriesId && ch.isCurrent) {
        return ch;
      }
    }
    return undefined;
  }

  // List all chapters for a series
  static getChaptersForSeries(seriesId: string): ChapterRecord[] {
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
  ): { items: Array<SeriesRecord & { currentChapter?: ChapterRecord }>; total: number } {
    const {
      status,
      tag,
      q,
      sort = 'updated',
      order = 'desc',
      limit = 50,
      offset = 0,
    } = options;

    let all: SeriesRecord[] = [];
    for (const s of seriesDb.values()) {
      if (s.userId !== userId) continue;

      // Status filter
      if (status && status.length > 0 && !status.includes(s.status)) {
        continue;
      }

      // Tag filter
      if (tag && tag.length > 0 && !tag.some((t) => s.tags.includes(t))) {
        continue;
      }

      // Search query filter (matches title or tags)
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

    // Sorting
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
        // default updated
        cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return order === 'desc' ? -cmp : cmp;
    });

    // Pagination
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

      // Re-saving the identical URL is a no-op
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

      // Check if user went backward in chapters
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

    // 1. Create or update series
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
      // Update existing series metadata
      existingSeries.autoTitle = existingSeries.autoTitle || resolveResult.seriesTitle || null;
      if (customTitle) existingSeries.customTitle = customTitle;
      if (!existingSeries.coverUrl && resolveResult.coverUrl) {
        existingSeries.coverUrl = resolveResult.coverUrl;
      }
      if (statusOverride) {
        existingSeries.status = statusOverride;
      } else if (existingSeries.status === 'read' || existingSeries.status === 'waiting') {
        // Automatic transition: newer save resets read/waiting back to unread
        existingSeries.status = 'unread';
      }
      existingSeries.hasUpdate = false;
      existingSeries.nextChapterUrl = null;
      existingSeries.updatedAt = now;
    }

    // 2. Archive previous current chapter (if different URL)
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

    // 3. Reactivate existing chapter row if previously saved, or insert new
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

    // 4. Update series current chapter pointer
    existingSeries.currentChapterId = targetChapterId;
    seriesDb.set(seriesId!, existingSeries);

    // 5. Generate Undo Token (valid 60s)
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
  static undo(userId: string, token: string): { success: boolean; message: string } {
    const record = undoTokensDb.get(token);
    if (!record || record.userId !== userId) {
      return { success: false, message: 'Invalid or expired undo token' };
    }

    if (record.consumedAt || record.expiresAt.getTime() < Date.now()) {
      return { success: false, message: 'Undo token has expired or already been used' };
    }

    const { action, seriesId, previousCurrentChapterId, insertedChapterId, previousSeriesState } =
      record.payload;

    // Delete the newly inserted chapter
    chaptersDb.delete(insertedChapterId);

    if (action === 'created') {
      // Delete the entire created series
      seriesDb.delete(seriesId);
    } else {
      // Restore previous current chapter and status
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

  // Update Series metadata (custom title, status, tags, cover)
  static updateSeries(
    userId: string,
    seriesId: string,
    updates: {
      customTitle?: string;
      status?: SeriesRecord['status'];
      tags?: string[];
      coverUrl?: string;
    }
  ): SeriesRecord | undefined {
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
  static markSeriesRead(userId: string, seriesId: string): SeriesRecord | undefined {
    const s = DataStore.findSeriesById(userId, seriesId);
    if (!s) return undefined;

    s.status = 'reading';
    s.lastReadAt = new Date();
    s.updatedAt = new Date();
    seriesDb.set(seriesId, s);
    return s;
  }

  // Delete Series (and all its chapters)
  static deleteSeries(userId: string, seriesId: string): boolean {
    const s = DataStore.findSeriesById(userId, seriesId);
    if (!s) return false;

    // Delete chapters
    for (const [chId, ch] of Array.from(chaptersDb.entries())) {
      if (ch.seriesId === seriesId) {
        chaptersDb.delete(chId);
      }
    }

    // Delete series
    seriesDb.delete(seriesId);
    return true;
  }

  // ================= API Tokens =================

  // Create a new API token
  static createApiToken(userId: string, name: string): { record: ApiTokenRecord; rawToken: string } {
    const rawToken = 'mgt_' + randomBytes(24).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const lastFour = rawToken.slice(-4);
    const id = randomUUID();

    const record: ApiTokenRecord = {
      id,
      userId,
      name: name.trim() || 'API Token',
      tokenHash,
      lastFour,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    };

    apiTokensDb.set(id, record);
    return { record, rawToken };
  }

  // List all API tokens for a user
  static listApiTokens(userId: string): ApiTokenRecord[] {
    const list: ApiTokenRecord[] = [];
    for (const t of apiTokensDb.values()) {
      if (t.userId === userId && !t.revokedAt) {
        list.push({ ...t });
      }
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Revoke an API token
  static revokeApiToken(userId: string, tokenId: string): boolean {
    const token = apiTokensDb.get(tokenId);
    if (!token || token.userId !== userId || token.revokedAt) {
      return false;
    }
    token.revokedAt = new Date();
    apiTokensDb.set(tokenId, token);
    return true;
  }

  // Verify a raw token string (from Bearer header or ?k= query)
  static verifyApiToken(rawToken: string): { userId: string; tokenId: string } | null {
    if (!rawToken || !rawToken.trim()) return null;
    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');

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

  // List all archived chapters across user series with remaining purge countdown
  static listArchivedChapters(userId: string): Array<ChapterRecord & {
    seriesTitle: string;
    seriesCoverUrl: string | null;
    daysRemaining: number;
  }> {
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

  // Restore an archived chapter to be the current chapter
  static restoreChapter(userId: string, chapterId: string): {
    success: boolean;
    series?: SeriesRecord;
    chapter?: ChapterRecord;
    message?: string;
  } {
    const targetChapter = chaptersDb.get(chapterId);
    if (!targetChapter) return { success: false, message: 'Chapter not found' };

    const series = seriesDb.get(targetChapter.seriesId);
    if (!series || series.userId !== userId) return { success: false, message: 'Series not found' };

    // Archive current chapter if different
    if (series.currentChapterId && series.currentChapterId !== chapterId) {
      const currentCh = chaptersDb.get(series.currentChapterId);
      if (currentCh) {
        currentCh.isCurrent = false;
        currentCh.archivedAt = new Date();
        currentCh.purgeAt = new Date(Date.now() + 30 * 86400000);
        chaptersDb.set(currentCh.id, currentCh);
      }
    }

    // Set restored chapter as current
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

  // Permanently delete a chapter
  static deleteChapter(userId: string, chapterId: string): boolean {
    const chapter = chaptersDb.get(chapterId);
    if (!chapter) return false;

    const series = seriesDb.get(chapter.seriesId);
    if (!series || series.userId !== userId) return false;

    // If deleting current chapter, swap current pointer to most recent remaining chapter if exists
    if (series.currentChapterId === chapterId) {
      const remaining = DataStore.getChaptersForSeries(series.id).filter((c) => c.id !== chapterId);
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

  // Merge sourceSeriesId INTO targetSeriesId losslessly
  static mergeSeries(
    userId: string,
    targetSeriesId: string,
    sourceSeriesId: string
  ): { success: boolean; targetSeries?: SeriesRecord; message?: string } {
    if (targetSeriesId === sourceSeriesId) {
      return { success: false, message: 'Cannot merge a series into itself' };
    }

    const target = DataStore.findSeriesById(userId, targetSeriesId);
    const source = DataStore.findSeriesById(userId, sourceSeriesId);

    if (!target || !source) {
      return { success: false, message: 'Target or source series not found' };
    }

    // 1. Re-link all source chapters to target series
    for (const ch of chaptersDb.values()) {
      if (ch.seriesId === sourceSeriesId) {
        ch.seriesId = targetSeriesId;
        chaptersDb.set(ch.id, ch);
      }
    }

    // 2. Combine tags
    const combinedTags = Array.from(new Set([...target.tags, ...source.tags]));
    target.tags = combinedTags;

    // 3. Keep highest chapter as current
    const allChapters = DataStore.getChaptersForSeries(targetSeriesId);
    if (allChapters.length > 0) {
      // Find chapter with highest chapterNumber or most recent
      const sorted = [...allChapters].sort((a, b) => {
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
    }

    // 4. Fill missing metadata if target was missing cover or title
    if (!target.coverUrl && source.coverUrl) target.coverUrl = source.coverUrl;
    if (!target.customTitle && !target.autoTitle && (source.customTitle || source.autoTitle)) {
      target.autoTitle = source.customTitle || source.autoTitle;
    }

    target.updatedAt = new Date();
    seriesDb.set(targetSeriesId, target);

    // 5. Delete source series
    seriesDb.delete(sourceSeriesId);

    return { success: true, targetSeries: target };
  }

  // Get merge suggestions based on title token similarity
  static getMergeSuggestions(
    userId: string,
    currentSeriesId: string,
    titleQuery: string
  ): Array<{ id: string; title: string; coverUrl: string | null }> {
    if (!titleQuery || titleQuery.length < 2) return [];
    const tokens = titleQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return [];

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
}
