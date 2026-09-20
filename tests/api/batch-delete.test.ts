import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DataStore } from '../../lib/db/data-store';
import { DEFAULT_USER_ID } from '../../lib/auth';
import { DELETE as batchDeleteSeries, POST as batchDeletePost } from '../../app/api/series/batch/route';

describe('Batch Delete API', () => {
  const userId = DEFAULT_USER_ID;

  beforeEach(() => {
    DataStore.clearAll();
  });

  it('deletes multiple series simultaneously and moves them to trash', async () => {
    // 1. Create 3 series
    const s1 = await DataStore.saveChapter({
      userId,
      resolveResult: {
        seriesKey: 'site.com/series-a/{ch}',
        source: 'generic',
        chapterNumber: 1,
        chapterLabel: 'Ch. 1',
        chapterUrl: 'https://site.com/series-a/1',
        seriesTitle: 'Series A',
        confidence: 'high',
      },
    });

    const s2 = await DataStore.saveChapter({
      userId,
      resolveResult: {
        seriesKey: 'site.com/series-b/{ch}',
        source: 'generic',
        chapterNumber: 1,
        chapterLabel: 'Ch. 1',
        chapterUrl: 'https://site.com/series-b/1',
        seriesTitle: 'Series B',
        confidence: 'high',
      },
    });

    const s3 = await DataStore.saveChapter({
      userId,
      resolveResult: {
        seriesKey: 'site.com/series-c/{ch}',
        source: 'generic',
        chapterNumber: 1,
        chapterLabel: 'Ch. 1',
        chapterUrl: 'https://site.com/series-c/1',
        seriesTitle: 'Series C',
        confidence: 'high',
      },
    });

    expect(DataStore.listSeries(userId).items.length).toBe(3);

    // 2. Batch delete s1 and s2
    const req = new NextRequest('http://localhost:3000/api/series/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesIds: [s1.series.id, s2.series.id] }),
    });

    const res = await batchDeleteSeries(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.count).toBe(2);
    expect(json.totalRequested).toBe(2);

    // 3. Verify only s3 remains in active series
    const remaining = DataStore.listSeries(userId).items;
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(s3.series.id);

    // 4. Verify deleted series can no longer be retrieved as active
    expect(DataStore.findSeriesById(userId, s1.series.id)).toBeUndefined();
    expect(DataStore.findSeriesById(userId, s2.series.id)).toBeUndefined();
    expect(DataStore.findSeriesById(userId, s3.series.id)).toBeDefined();
  });

  it('rejects empty or invalid seriesIds', async () => {
    const req = new NextRequest('http://localhost:3000/api/series/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesIds: [] }),
    });

    const res = await batchDeleteSeries(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('supports POST fallback for batch deletion', async () => {
    const s1 = await DataStore.saveChapter({
      userId,
      resolveResult: {
        seriesKey: 'site.com/series-post/{ch}',
        source: 'generic',
        chapterNumber: 1,
        chapterLabel: 'Ch. 1',
        chapterUrl: 'https://site.com/series-post/1',
        seriesTitle: 'Series POST',
        confidence: 'high',
      },
    });

    const req = new NextRequest('http://localhost:3000/api/series/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesIds: [s1.series.id] }),
    });

    const res = await batchDeletePost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
  });
});
