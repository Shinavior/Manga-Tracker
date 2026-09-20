import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../../lib/db/data-store';
import { DEFAULT_USER_ID } from '../../lib/auth';
import { GET as getChapters } from '../../app/api/chapters/route';
import { DELETE as deleteChapter } from '../../app/api/chapters/[id]/route';
import { POST as restoreChapter } from '../../app/api/chapters/[id]/restore/route';
import { POST as mergeSeries, GET as getMergeSuggestions } from '../../app/api/series/[id]/merge/route';

describe('Phase 4: Trash, Chapter Restore & Series Merging', () => {
  const userId = DEFAULT_USER_ID;

  beforeEach(() => {
    DataStore.clearAll();
  });

  describe('Trash and Archived Chapter Management', () => {
    it('archives previous chapter when a newer chapter is saved', async () => {
      // 1. Save Ch. 1
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'test.com/manga/solo/{ch}',
          source: 'generic',
          chapterNumber: 1,
          chapterLabel: 'Ch. 1',
          chapterUrl: 'https://test.com/manga/solo/1',
          seriesTitle: 'Solo Leveling',
          coverUrl: 'https://test.com/cover.jpg',
          confidence: 'high',
        },
      });

      // 2. Save Ch. 2 (archives Ch. 1)
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'test.com/manga/solo/{ch}',
          source: 'generic',
          chapterNumber: 2,
          chapterLabel: 'Ch. 2',
          chapterUrl: 'https://test.com/manga/solo/2',
          seriesTitle: 'Solo Leveling',
          confidence: 'high',
        },
      });

      // 3. Query /api/chapters?archived=true
      const req = new Request('http://localhost:3000/api/chapters?archived=true', { method: 'GET' });
      const res = await getChapters(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.chapters.length).toBe(1);
      expect(json.chapters[0].chapterLabel).toBe('Ch. 1');
      expect(json.chapters[0].daysRemaining).toBeGreaterThanOrEqual(29);
      expect(json.chapters[0].seriesTitle).toBe('Solo Leveling');
    });

    it('restores an archived chapter to active status via /api/chapters/:id/restore', async () => {
      // Save Ch. 1 then Ch. 2
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'test.com/manga/solo/{ch}',
          source: 'generic',
          chapterNumber: 1,
          chapterLabel: 'Ch. 1',
          chapterUrl: 'https://test.com/manga/solo/1',
          seriesTitle: 'Solo Leveling',
          confidence: 'high',
        },
      });

      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'test.com/manga/solo/{ch}',
          source: 'generic',
          chapterNumber: 2,
          chapterLabel: 'Ch. 2',
          chapterUrl: 'https://test.com/manga/solo/2',
          seriesTitle: 'Solo Leveling',
          confidence: 'high',
        },
      });

      const archived = DataStore.listArchivedChapters(userId);
      expect(archived.length).toBe(1);
      const ch1Id = archived[0].id;

      // Restore Ch. 1
      const restoreReq = new Request(`http://localhost:3000/api/chapters/${ch1Id}/restore`, { method: 'POST' });
      const restoreRes = await restoreChapter(restoreReq, { params: Promise.resolve({ id: ch1Id }) });
      expect(restoreRes.status).toBe(200);

      // Verify series currentChapter is now Ch. 1
      const series = DataStore.findSeriesByKey(userId, 'test.com/manga/solo/{ch}');
      expect(series?.currentChapterId).toBe(ch1Id);

      const currentCh = DataStore.getCurrentChapter(series!.id);
      expect(currentCh?.chapterLabel).toBe('Ch. 1');
      expect(currentCh?.restoredCount).toBe(1);
    });

    it('permanently deletes an archived chapter via DELETE /api/chapters/:id', async () => {
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'test.com/manga/solo/{ch}',
          source: 'generic',
          chapterNumber: 1,
          chapterLabel: 'Ch. 1',
          chapterUrl: 'https://test.com/manga/solo/1',
          seriesTitle: 'Solo Leveling',
          confidence: 'high',
        },
      });

      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'test.com/manga/solo/{ch}',
          source: 'generic',
          chapterNumber: 2,
          chapterLabel: 'Ch. 2',
          chapterUrl: 'https://test.com/manga/solo/2',
          seriesTitle: 'Solo Leveling',
          confidence: 'high',
        },
      });

      const archived = DataStore.listArchivedChapters(userId);
      expect(archived.length).toBe(1);
      const ch1Id = archived[0].id;

      const delReq = new Request(`http://localhost:3000/api/chapters/${ch1Id}`, { method: 'DELETE' });
      const delRes = await deleteChapter(delReq, { params: Promise.resolve({ id: ch1Id }) });
      expect(delRes.status).toBe(200);

      expect(DataStore.listArchivedChapters(userId).length).toBe(0);
    });
  });

  describe('Series Merging and Suggestions', () => {
    it('merges source series into target series losslessly', async () => {
      // Series A (from site 1)
      const resA = await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'site1.com/series/frieren/{ch}',
          source: 'generic',
          chapterNumber: 10,
          chapterLabel: 'Ch. 10',
          chapterUrl: 'https://site1.com/series/frieren/10',
          seriesTitle: 'Sousou no Frieren',
          coverUrl: 'https://site1.com/cover.jpg',
          confidence: 'high',
        },
        tags: ['fantasy'],
      });

      // Series B (from site 2, higher chapter)
      const resB = await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'site2.com/manga/frieren-beyond/{ch}',
          source: 'generic',
          chapterNumber: 12,
          chapterLabel: 'Ch. 12',
          chapterUrl: 'https://site2.com/manga/frieren-beyond/12',
          seriesTitle: "Frieren: Beyond Journey's End",
          confidence: 'high',
        },
        tags: ['adventure'],
      });

      const seriesAId = resA.series.id;
      const seriesBId = resB.series.id;

      // Merge Series B into Series A
      const mergeReq = new Request(`http://localhost:3000/api/series/${seriesAId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSeriesId: seriesBId }),
      });

      const mergeRes = await mergeSeries(mergeReq, { params: Promise.resolve({ id: seriesAId }) });
      expect(mergeRes.status).toBe(200);

      // Verify Series B is deleted
      expect(DataStore.findSeriesById(userId, seriesBId)).toBeUndefined();

      // Verify Series A contains both chapters and combined tags
      const updatedA = DataStore.findSeriesById(userId, seriesAId);
      expect(updatedA).toBeDefined();
      expect(updatedA?.tags).toContain('fantasy');
      expect(updatedA?.tags).toContain('adventure');

      const allAChapters = DataStore.getChaptersForSeries(seriesAId);
      expect(allAChapters.length).toBe(2);

      // Best current chapter is Ch. 12
      const currentCh = DataStore.getCurrentChapter(seriesAId);
      expect(currentCh?.chapterNumber).toBe(12);
    });

    it('returns title similarity merge suggestions', async () => {
      const resA = await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'site1.com/solo/{ch}',
          source: 'generic',
          chapterNumber: 1,
          chapterLabel: 'Ch. 1',
          chapterUrl: 'https://site1.com/solo/1',
          seriesTitle: 'Solo Leveling Ragnarok',
          confidence: 'high',
        },
      });

      const resB = await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'site2.com/solo/{ch}',
          source: 'generic',
          chapterNumber: 1,
          chapterLabel: 'Ch. 1',
          chapterUrl: 'https://site2.com/solo/1',
          seriesTitle: 'Solo Leveling Side Stories',
          confidence: 'high',
        },
      });

      const sugReq = new Request(`http://localhost:3000/api/series/${resA.series.id}/merge`, { method: 'GET' });
      const sugRes = await getMergeSuggestions(sugReq, { params: Promise.resolve({ id: resA.series.id }) });
      expect(sugRes.status).toBe(200);
      const json = await sugRes.json();

      expect(json.suggestions.length).toBe(1);
      expect(json.suggestions[0].id).toBe(resB.series.id);
    });
  });
});
