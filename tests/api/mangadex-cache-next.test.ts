import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '@/lib/db/cache-service';
import { DataStore } from '@/lib/db/data-store';
import { MangaDexAdapter } from '@/lib/resolver/adapters/mangadex';
import { GenericNumericAdapter } from '@/lib/resolver/adapters/generic-numeric';
import { resolve } from '@/lib/resolver';
import { mangadexLimiter } from '@/lib/resolver/rate-limit';

describe('Phase 2: MangaDex Adapter, Caching & Next Chapter Tests', () => {
  const USER_ID = 'test-user-md';
  const MOCK_MANGA_UUID = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
  const MOCK_CH1_UUID = 'e4e5b2d6-7488-45fb-a079-b24458d822e8';
  const MOCK_CH2_UUID = 'f5ec3671-22f9-49ef-b389-9f10f3291071';
  const MOCK_CH3_UUID = '7c9e6a32-1111-2222-3333-444455556666';

  let fetchCallCount = 0;

  beforeEach(() => {
    DataStore.clearAll();
    CacheService.clear();
    fetchCallCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        fetchCallCount++;
        const urlStr = input.toString();

        // Feed endpoint
        if (urlStr.includes('/feed')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { id: MOCK_CH1_UUID, attributes: { chapter: '1' } },
                { id: MOCK_CH2_UUID, attributes: { chapter: '2' } },
                { id: MOCK_CH3_UUID, attributes: { chapter: '3' } },
              ],
            }),
          };
        }

        // Chapter 1
        if (urlStr.includes(`/chapter/${MOCK_CH1_UUID}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: MOCK_CH1_UUID,
                attributes: { chapter: '1', title: 'Chapter 1', translatedLanguage: 'en' },
                relationships: [{ type: 'manga', id: MOCK_MANGA_UUID }],
              },
            }),
          };
        }

        // Chapter 2
        if (urlStr.includes(`/chapter/${MOCK_CH2_UUID}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: MOCK_CH2_UUID,
                attributes: { chapter: '2', title: 'Chapter 2', translatedLanguage: 'en' },
                relationships: [{ type: 'manga', id: MOCK_MANGA_UUID }],
              },
            }),
          };
        }

        // Manga metadata
        if (urlStr.includes(`/manga/${MOCK_MANGA_UUID}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: MOCK_MANGA_UUID,
                attributes: {
                  title: { en: 'Solo Leveling' },
                },
                relationships: [
                  {
                    type: 'cover_art',
                    attributes: { fileName: 'solo-cover.jpg' },
                  },
                ],
              },
            }),
          };
        }

        // Generic HEAD / GET probes
        if (init?.method === 'HEAD' || init?.method === 'GET') {
          return {
            ok: true,
            status: 200,
            text: async () => 'OK',
          };
        }

        return { ok: false, status: 404 };
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges two different MangaDex chapter UUIDs into exactly one series card', async () => {
    // Save MangaDex Chapter 1
    const res1 = await resolve(`https://mangadex.org/chapter/${MOCK_CH1_UUID}`);
    const save1 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res1 });

    expect(save1.action).toBe('created');
    expect(save1.series.title).toBe('Solo Leveling');
    expect(save1.series.seriesKey).toBe(`mangadex:${MOCK_MANGA_UUID}`);
    expect(save1.chapter.number).toBe(1);

    // Save MangaDex Chapter 2
    const res2 = await resolve(`https://mangadex.org/chapter/${MOCK_CH2_UUID}`);
    const save2 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res2 });

    expect(save2.action).toBe('updated');
    expect(save2.series.title).toBe('Solo Leveling');
    expect(save2.chapter.number).toBe(2);
    expect(save2.archivedChapter?.label).toBe('Ch. 1');

    // Exactly 1 series in library
    const list = DataStore.listSeries(USER_ID);
    expect(list.total).toBe(1);
    expect(list.items[0].currentChapter?.chapterNumber).toBe(2);
  });

  it('uses resolve_cache permanently for chapters and 7 days for manga metadata', async () => {
    const adapter = new MangaDexAdapter();

    // First resolve hits fetch (1 for chapter, 1 for manga)
    await adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CH1_UUID}`));
    const initialFetchCount = fetchCallCount;
    expect(initialFetchCount).toBe(2);

    // Second resolve of same chapter should hit CacheService with 0 new network fetches
    await adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CH1_UUID}`));
    expect(fetchCallCount).toBe(initialFetchCount);

    // Resolving chapter 2 should only fetch chapter 2 (manga metadata is cached from chapter 1)
    await adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CH2_UUID}`));
    expect(fetchCallCount).toBe(initialFetchCount + 1);
  });

  it('computes next chapter correctly using MangaDex feed', async () => {
    const adapter = new MangaDexAdapter();

    const nextUrl = await adapter.nextChapterUrl({
      seriesKey: `mangadex:${MOCK_MANGA_UUID}`,
      currentUrl: `https://mangadex.org/chapter/${MOCK_CH1_UUID}`,
      currentChapterNumber: 1,
      language: 'en',
    });

    expect(nextUrl).toBe(`https://mangadex.org/chapter/${MOCK_CH2_UUID}`);

    // Probing from chapter 2 gives chapter 3
    const nextUrl3 = await adapter.nextChapterUrl({
      seriesKey: `mangadex:${MOCK_MANGA_UUID}`,
      currentUrl: `https://mangadex.org/chapter/${MOCK_CH2_UUID}`,
      currentChapterNumber: 2,
      language: 'en',
    });

    expect(nextUrl3).toBe(`https://mangadex.org/chapter/${MOCK_CH3_UUID}`);
  });

  it('handles HTTP 429 rate limit with automatic exponential backoff retry', async () => {
    let attempt = 0;
    const customFetch = vi.fn(async () => {
      attempt++;
      if (attempt <= 2) {
        return { ok: false, status: 429 } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response;
    });

    const res = await mangadexLimiter.fetchWithRetry(
      'https://api.mangadex.org/test',
      undefined,
      customFetch
    );

    expect(res.status).toBe(200);
    expect(attempt).toBe(3); // 2 retries on 429, succeeded on 3rd attempt
  });
});
