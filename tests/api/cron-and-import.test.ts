import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataStore } from '@/lib/db/data-store';
import { DEFAULT_USER_ID } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { POST as purgeRoute } from '@/app/api/cron/purge/route';
import { POST as checkUpdatesRoute } from '@/app/api/cron/check-updates/route';
import { GET as exportRoute } from '@/app/api/export/route';
import { POST as importRoute } from '@/app/api/import/route';

describe('Phase 5: Cron, Update Checking, Export & Import', () => {
  const userId = DEFAULT_USER_ID;

  beforeEach(() => {
    DataStore.clearAll();
  });

  describe('30-Day Retention Purge', () => {
    it('purges only chapters past their purgeAt timestamp', async () => {
      // 1. Save chapter 1
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'series-purge-test',
          source: 'generic',
          chapterUrl: 'https://example.com/manga/test/ch-1',
          chapterLabel: 'Ch. 1',
          chapterNumber: 1,
          seriesTitle: 'Purge Test Manga',
          confidence: 'high',
        },
      });

      // 2. Save chapter 2 -> archives chapter 1
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'series-purge-test',
          source: 'generic',
          chapterUrl: 'https://example.com/manga/test/ch-2',
          chapterLabel: 'Ch. 2',
          chapterNumber: 2,
          seriesTitle: 'Purge Test Manga',
          confidence: 'high',
        },
        retentionDays: 30,
      });

      const series = DataStore.findSeriesByKey(userId, 'series-purge-test')!;
      const chaptersBefore = DataStore.getChaptersForSeries(series.id);
      expect(chaptersBefore).toHaveLength(2);

      // Purge now (should purge 0 since 30 days haven't passed)
      const purgeNow = DataStore.purgeExpiredChapters(new Date());
      expect(purgeNow.purgedCount).toBe(0);
      expect(DataStore.getChaptersForSeries(series.id)).toHaveLength(2);

      // Purge 31 days in future (should purge chapter 1, but keep current chapter 2)
      const futureDate = new Date(Date.now() + 31 * 86400000);
      const purgeFuture = DataStore.purgeExpiredChapters(futureDate);
      expect(purgeFuture.purgedCount).toBe(1);

      const chaptersAfter = DataStore.getChaptersForSeries(series.id);
      expect(chaptersAfter).toHaveLength(1);
      expect(chaptersAfter[0].chapterNumber).toBe(2);
      expect(chaptersAfter[0].isCurrent).toBe(true);
    });

    it('handles purge API route POST', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/purge', {
        method: 'POST',
      });
      const res = await purgeRoute(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.purgedCount).toBeDefined();
    });
  });

  describe('Update Checking Worker', () => {
    it('scans active series and updates nextChapterUrl / hasUpdate', async () => {
      // Create a series with a known URL pattern
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'series-worker-test',
          source: 'generic',
          chapterUrl: 'https://example.com/manga/test/ch-10',
          chapterLabel: 'Ch. 10',
          chapterNumber: 10,
          urlPattern: 'https://example.com/manga/test/ch-{ch}',
          seriesTitle: 'Worker Test Manga',
          confidence: 'high',
        },
      });

      // Run check updates
      const result = await DataStore.checkSeriesUpdates(userId);
      expect(result.checkedCount).toBe(1);
      expect(result.results[0].title).toBe('Worker Test Manga');

      const series = DataStore.findSeriesByKey(userId, 'series-worker-test')!;
      expect(series.lastCheckedAt).toBeDefined();
    });

    it('handles check-updates API route', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/check-updates', {
        method: 'POST',
      });
      const res = await checkUpdatesRoute(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.checkedCount).toBeDefined();
    });
  });

  describe('JSON Export & Import', () => {
    it('exports all series and chapters correctly', async () => {
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'series-export-test',
          source: 'generic',
          chapterUrl: 'https://example.com/manga/export/ch-1',
          chapterLabel: 'Ch. 1',
          chapterNumber: 1,
          seriesTitle: 'Export Manga',
          confidence: 'high',
        },
        tags: ['action', 'shounen'],
      });

      const exportData = DataStore.exportData(userId);
      expect(exportData.version).toBe(1);
      expect(exportData.series).toHaveLength(1);
      expect(exportData.series[0].seriesKey).toBe('series-export-test');
      expect(exportData.series[0].tags).toEqual(['action', 'shounen']);
      expect(exportData.series[0].chapters).toHaveLength(1);

      // Verify API export endpoint
      const req = new NextRequest('http://localhost:3000/api/export');
      const res = await exportRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('manga-tracker-backup');
    });

    it('performs dry-run import preview without altering database', async () => {
      const items = [
        { url: 'https://example.com/manga/dry-run/ch-1', customTitle: 'Dry Run Manga' },
      ];

      const previewResult = await DataStore.importData(userId, items, true);
      expect(previewResult.dryRun).toBe(true);
      expect(previewResult.totalItems).toBe(1);
      expect(previewResult.newSeriesCount).toBe(1);
      expect(previewResult.preview).toHaveLength(1);
      expect(previewResult.preview![0].seriesTitle).toBe('Dry Run Manga');

      // Verify nothing was saved
      const all = DataStore.listSeries(userId);
      expect(all.total).toBe(0);
    });

    it('imports items when dryRun is false', async () => {
      const items = [
        { url: 'https://example.com/manga/actual-import/ch-1', customTitle: 'Actual Import' },
      ];

      const importResult = await DataStore.importData(userId, items, false);
      expect(importResult.dryRun).toBe(false);
      expect(importResult.savedCount).toBe(1);

      const all = DataStore.listSeries(userId);
      expect(all.total).toBe(1);
      expect(all.items[0].customTitle).toBe('Actual Import');
    });

    it('handles Netscape Bookmark HTML in import API endpoint', async () => {
      const htmlBookmarks = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <DL><p>
          <DT><A HREF="https://example.com/manga/imported-from-html/ch-5">Imported HTML Title</A>
        </DL><p>
      `;

      // 1. Dry run
      const dryReq = new NextRequest('http://localhost:3000/api/import?dryRun=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlBookmarks }),
      });
      const dryRes = await importRoute(dryReq);
      const dryData = await dryRes.json();
      expect(dryRes.status).toBe(200);
      expect(dryData.dryRun).toBe(true);
      expect(dryData.totalItems).toBe(1);
      expect(dryData.newSeriesCount).toBe(1);

      // 2. Confirmed import
      const execReq = new NextRequest('http://localhost:3000/api/import?dryRun=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlBookmarks }),
      });
      const execRes = await importRoute(execReq);
      const execData = await execRes.json();
      expect(execRes.status).toBe(200);
      expect(execData.savedCount).toBe(1);

      const series = DataStore.listSeries(userId);
      expect(series.total).toBe(1);
    });

    it('restores full backup JSON directly with all chapter history preserved', async () => {
      const backupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        series: [
          {
            id: 'series-backup-test-id',
            userId,
            seriesKey: 'backup.com/manga/test/{ch}',
            source: 'generic' as const,
            urlPattern: 'backup.com/manga/test/{ch}',
            autoTitle: 'Backup Restored Manga',
            customTitle: 'Custom Backup Title',
            coverUrl: 'https://backup.com/cover.jpg',
            status: 'reading' as const,
            tags: ['fantasy', 'magic'],
            language: 'en',
            currentChapterId: 'ch-3-id',
            confidence: 'high' as const,
            needsReview: false,
            lastReadAt: null,
            lastCheckedAt: null,
            hasUpdate: false,
            nextChapterUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            chapters: [
              {
                id: 'ch-1-id',
                seriesId: 'series-backup-test-id',
                url: 'https://backup.com/manga/test/1',
                chapterLabel: 'Ch. 1',
                chapterNumber: 1,
                isCurrent: false,
                archivedAt: new Date(),
                purgeAt: new Date(Date.now() + 20 * 86400000),
                restoredCount: 0,
                savedAt: new Date(Date.now() - 10000),
              },
              {
                id: 'ch-2-id',
                seriesId: 'series-backup-test-id',
                url: 'https://backup.com/manga/test/2',
                chapterLabel: 'Ch. 2',
                chapterNumber: 2,
                isCurrent: false,
                archivedAt: new Date(),
                purgeAt: new Date(Date.now() + 25 * 86400000),
                restoredCount: 0,
                savedAt: new Date(Date.now() - 5000),
              },
              {
                id: 'ch-3-id',
                seriesId: 'series-backup-test-id',
                url: 'https://backup.com/manga/test/3',
                chapterLabel: 'Ch. 3',
                chapterNumber: 3,
                isCurrent: true,
                archivedAt: null,
                purgeAt: null,
                restoredCount: 0,
                savedAt: new Date(),
              },
            ],
          },
        ],
      };

      // Import via API
      const req = new NextRequest('http://localhost:3000/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupPayload),
      });
      const res = await importRoute(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.seriesCount).toBe(1);
      expect(data.chaptersCount).toBe(3);

      const all = DataStore.listSeries(userId);
      expect(all.total).toBe(1);
      expect(all.items[0].customTitle).toBe('Custom Backup Title');
      expect(all.items[0].tags).toEqual(['fantasy', 'magic']);

      const chapters = DataStore.getChaptersForSeries(all.items[0].id);
      expect(chapters).toHaveLength(3);

      const currentChapter = DataStore.getCurrentChapter(all.items[0].id);
      expect(currentChapter?.chapterNumber).toBe(3);
      expect(currentChapter?.isCurrent).toBe(true);
    });

    it('sorts out-of-order chapters in bookmark import so highest chapter is current', async () => {
      // Pass Ch. 50 then Ch. 1 for the same series
      const outOfOrderItems = [
        { url: 'https://example.com/manga/sorting-test/ch-50', customTitle: 'Sorting Manga' },
        { url: 'https://example.com/manga/sorting-test/ch-1', customTitle: 'Sorting Manga' },
        { url: 'https://example.com/manga/sorting-test/ch-25', customTitle: 'Sorting Manga' },
      ];

      const res = await DataStore.importData(userId, outOfOrderItems, false);
      expect(res.savedCount).toBe(3);

      const series = DataStore.listSeries(userId);
      expect(series.total).toBe(1);

      const currentChapter = DataStore.getCurrentChapter(series.items[0].id);
      // Ch. 50 must remain current!
      expect(currentChapter?.chapterNumber).toBe(50);
      expect(currentChapter?.isCurrent).toBe(true);

      const allChapters = DataStore.getChaptersForSeries(series.items[0].id);
      expect(allChapters).toHaveLength(3);
      const archived = allChapters.filter((c) => !c.isCurrent);
      expect(archived).toHaveLength(2);
      expect(archived.map((c) => c.chapterNumber).sort((a, b) => (a || 0) - (b || 0))).toEqual([1, 25]);
    });

    it('deduplicates new series in dry-run preview for multiple bookmarks of the same series', async () => {
      const multiChapterBookmarks = [
        { url: 'https://example.com/manga/dedup-test/ch-1' },
        { url: 'https://example.com/manga/dedup-test/ch-2' },
        { url: 'https://example.com/manga/dedup-test/ch-3' },
      ];

      const preview = await DataStore.importData(userId, multiChapterBookmarks, true);
      expect(preview.dryRun).toBe(true);
      expect(preview.totalItems).toBe(3);
      // Must be counted as 1 new series, not 3!
      expect(preview.newSeriesCount).toBe(1);
      expect(preview.existingSeriesCount).toBe(0);
      expect(preview.preview).toHaveLength(3);
    });

    it('preserves existing hasUpdate when update check encounters a network error', async () => {
      await DataStore.saveChapter({
        userId,
        resolveResult: {
          seriesKey: 'series-preserve-update-test',
          source: 'generic',
          chapterUrl: 'https://example.com/manga/preserve/ch-5',
          chapterLabel: 'Ch. 5',
          chapterNumber: 5,
          urlPattern: 'https://non-existent-domain-xyz-404.com/ch-{ch}',
          seriesTitle: 'Preserve Update Manga',
          confidence: 'high',
        },
      });

      const series = DataStore.findSeriesByKey(userId, 'series-preserve-update-test')!;
      // Manually set hasUpdate = true to simulate a previously found update
      series.hasUpdate = true;
      series.nextChapterUrl = 'https://non-existent-domain-xyz-404.com/ch-6';

      // Run check updates against non-existent domain (which will fail/timeout)
      const res = await DataStore.checkSeriesUpdates(userId);
      expect(res.checkedCount).toBe(1);

      const refreshed = DataStore.findSeriesByKey(userId, 'series-preserve-update-test')!;
      // hasUpdate and nextChapterUrl must be preserved, NOT wiped to false/null
      expect(refreshed.hasUpdate).toBe(true);
      expect(refreshed.nextChapterUrl).toBe('https://non-existent-domain-xyz-404.com/ch-6');
    });

    it('validates CRON_SECRET authorization on purge and check-updates endpoints', async () => {
      const origSecret = process.env.CRON_SECRET;
      const origAuthMode = process.env.AUTH_MODE;
      try {
        process.env.CRON_SECRET = 'super-secret-cron-token';
        process.env.AUTH_MODE = 'multi_user';

        // 1. Purge with valid Bearer secret
        const validPurgeReq = new NextRequest('http://localhost:3000/api/cron/purge', {
          method: 'POST',
          headers: { Authorization: 'Bearer super-secret-cron-token' },
        });
        const validPurgeRes = await purgeRoute(validPurgeReq);
        expect(validPurgeRes.status).toBe(200);

        // 2. Check-updates with valid Bearer secret
        const validUpdateReq = new NextRequest('http://localhost:3000/api/cron/check-updates', {
          method: 'POST',
          headers: { Authorization: 'Bearer super-secret-cron-token' },
        });
        const validUpdateRes = await checkUpdatesRoute(validUpdateReq);
        expect(validUpdateRes.status).toBe(200);

        // 3. Purge with invalid secret should fail 401
        const invalidPurgeReq = new NextRequest('http://localhost:3000/api/cron/purge', {
          method: 'POST',
          headers: { Authorization: 'Bearer wrong-secret' },
        });
        const invalidPurgeRes = await purgeRoute(invalidPurgeReq);
        expect(invalidPurgeRes.status).toBe(401);
      } finally {
        process.env.CRON_SECRET = origSecret;
        process.env.AUTH_MODE = origAuthMode;
      }
    });
  });
});

