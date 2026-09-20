import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASES } from './cases';
import { ResolverEngine, resolve } from '@/lib/resolver';
import { normalizeUrl } from '@/lib/resolver/normalize';
import { ResolverError } from '@/lib/resolver/types';
import { GenericNumericAdapter } from '@/lib/resolver/adapters/generic-numeric';
import { MangaDexAdapter } from '@/lib/resolver/adapters/mangadex';
import { FallbackAdapter } from '@/lib/resolver/adapters/fallback';
import { CacheService } from '@/lib/db/cache-service';

describe('Manga Resolver Unit Tests', () => {
  const MOCK_MANGA_UUID = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
  const MOCK_CHAPTER_1_UUID = 'e4e5b2d6-7488-45fb-a079-b24458d822e8';
  const MOCK_CHAPTER_2_UUID = 'f5ec3671-22f9-49ef-b389-9f10f3291071';

  beforeEach(() => {
    CacheService.clear();
    // Mock global fetch for MangaDex & Fallback
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = input.toString();

        // MangaDex chapter 1
        if (urlStr.includes(`/chapter/${MOCK_CHAPTER_1_UUID}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: MOCK_CHAPTER_1_UUID,
                attributes: {
                  chapter: '1',
                  title: 'Chapter 1',
                  translatedLanguage: 'en',
                  volume: '1',
                },
                relationships: [{ type: 'manga', id: MOCK_MANGA_UUID }],
              },
            }),
          };
        }

        // MangaDex chapter 2
        if (urlStr.includes(`/chapter/${MOCK_CHAPTER_2_UUID}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: MOCK_CHAPTER_2_UUID,
                attributes: {
                  chapter: '2',
                  title: 'Chapter 2',
                  translatedLanguage: 'en',
                  volume: '1',
                },
                relationships: [{ type: 'manga', id: MOCK_MANGA_UUID }],
              },
            }),
          };
        }

        // MangaDex feed for next chapter
        if (urlStr.includes('/feed')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: MOCK_CHAPTER_2_UUID,
                  attributes: { chapter: '2' },
                },
              ],
            }),
          };
        }

        // MangaDex manga title
        if (
          urlStr.includes(`/manga/${MOCK_MANGA_UUID}`) ||
          urlStr.includes(`/manga/a1b2c3d4-0000-0000-0000-000000000000`)
        ) {
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
                    attributes: { fileName: 'cover-123.jpg' },
                  },
                ],
              },
            }),
          };
        }

        // Generic HEAD / GET for next chapter
        if (init?.method === 'HEAD' || init?.method === 'GET') {
          return {
            ok: true,
            status: 200,
            text: async () => 'OK',
          };
        }

        // Fallback HTML mock
        return {
          ok: true,
          status: 200,
          text: async () => `
            <!DOCTYPE html>
            <html>
              <head>
                <meta property="og:title" content="Awesome Series - Read Manga Online" />
                <meta property="og:image" content="https://site.com/cover.jpg" />
                <title>Awesome Series Chapter 10</title>
              </head>
              <body><h1>Awesome Series</h1></body>
            </html>
          `,
        };
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Spec Regression Cases (3.7)', () => {
    for (const c of CASES) {
      it(`handles case: ${c.url}`, async () => {
        if (c.expectError) {
          await expect(resolve(c.url)).rejects.toSatisfy((err: unknown) => {
            return err instanceof ResolverError && err.code === c.expectError;
          });
          return;
        }

        const result = await resolve(c.url);

        if (c.seriesKey) {
          expect(result.seriesKey).toBe(c.seriesKey);
        }
        if (c.seriesKeyPrefix) {
          expect(result.seriesKey.startsWith(c.seriesKeyPrefix)).toBe(true);
        }
        if (c.ch !== undefined) {
          expect(result.chapterNumber).toBe(c.ch);
        }
        if (c.conf) {
          expect(result.confidence).toBe(c.conf);
        }
        if (c.requiresTitleLookup) {
          expect(result.requiresManualTitle).toBe(true);
        }
      });
    }
  });

  describe('Core Invariants', () => {
    it('Nekopost ch.1 and ch.2 produce exact same seriesKey', async () => {
      const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
      const res2 = await resolve('https://www.nekopost.net/manga/17045/2');

      expect(res1.seriesKey).toBe('nekopost.net/manga/17045/{ch}');
      expect(res2.seriesKey).toBe('nekopost.net/manga/17045/{ch}');
      expect(res1.seriesKey).toBe(res2.seriesKey);
    });

    it('MangaDex two chapter UUIDs produce exact same seriesKey and metadata', async () => {
      const res1 = await resolve(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`);
      const res2 = await resolve(`https://mangadex.org/chapter/${MOCK_CHAPTER_2_UUID}`);

      expect(res1.seriesKey).toBe(`mangadex:${MOCK_MANGA_UUID}`);
      expect(res2.seriesKey).toBe(`mangadex:${MOCK_MANGA_UUID}`);
      expect(res1.seriesKey).toBe(res2.seriesKey);
      expect(res1.seriesTitle).toBe('Solo Leveling');
      expect(res2.seriesTitle).toBe('Solo Leveling');
      expect(res1.coverUrl).toBe(
        `https://uploads.mangadex.org/covers/${MOCK_MANGA_UUID}/cover-123.jpg.256.jpg`
      );
    });

    it('Resolution is idempotent', async () => {
      const initial = await resolve('https://www.nekopost.net/manga/17045/1');
      const second = await resolve(initial.chapterUrl);

      expect(second.seriesKey).toBe(initial.seriesKey);
      expect(second.chapterNumber).toBe(initial.chapterNumber);
    });
  });

  describe('Security and Normalization', () => {
    it('rejects invalid inputs', () => {
      expect(() => normalizeUrl('')).toThrowError();
      // @ts-expect-error test non-string input
      expect(() => normalizeUrl(null)).toThrowError();
      expect(() => normalizeUrl('not-a-valid-url')).toThrowError();
    });

    it('rejects private IP addresses and loopback (SSRF guard)', () => {
      expect(() => normalizeUrl('http://127.0.0.1/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://192.168.1.1/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://10.0.0.1/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://169.254.169.254/latest/meta-data')).toThrowError();
      expect(() => normalizeUrl('http://172.20.0.1/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://0.0.0.0/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://[::1]/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://::1/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://app.local/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://corp.internal/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://test.localhost/manga/1')).toThrowError();
      expect(() => normalizeUrl('http://999.999.999.999/manga/1')).toThrowError();
    });

    it('rejects overly long URLs (>2048 chars)', () => {
      const longUrl = 'https://site.com/manga/' + 'a'.repeat(2050);
      expect(() => normalizeUrl(longUrl)).toThrowError();
    });

    it('strips tracking parameters and sorts remaining query parameters', () => {
      const url = normalizeUrl('https://site.com/read?b=2&utm_medium=email&a=1&utm_source=fb');
      expect(url.search).toBe('?a=1&b=2');
    });

    it('sorts multiple params with identical keys deterministically', () => {
      const url = normalizeUrl('https://site.com/read?a=2&a=1');
      expect(url.search).toBe('?a=1&a=2');
    });
  });

  describe('Next Chapter Detection', () => {
    it('computes next chapter for generic adapter', async () => {
      const adapter = new GenericNumericAdapter();
      const nextUrl = await adapter.nextChapterUrl({
        seriesKey: 'site.com/manga/one-piece/{ch}',
        urlPattern: 'site.com/manga/one-piece/{ch}',
        currentChapterNumber: 1050,
        currentUrl: 'https://site.com/manga/one-piece/1050',
      });

      expect(nextUrl).toBe('https://site.com/manga/one-piece/1051');
    });

    it('handles 405 Method Not Allowed on HEAD with GET fallback', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'HEAD') {
            return { ok: false, status: 405 };
          }
          if (init?.method === 'GET') {
            return { ok: true, status: 206 };
          }
          return { ok: false, status: 500 };
        })
      );

      const adapter = new GenericNumericAdapter();
      const nextUrl = await adapter.nextChapterUrl({
        seriesKey: 'site.com/manga/naruto/{ch}',
        urlPattern: 'site.com/manga/naruto/{ch}',
        currentChapterNumber: 500,
        currentUrl: 'https://site.com/manga/naruto/500',
      });

      expect(nextUrl).toBe('https://site.com/manga/naruto/501');
    });

    it('returns null if next chapter is not found (HTTP 404)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return { ok: false, status: 404 };
        })
      );

      const adapter = new GenericNumericAdapter();
      const nextUrl = await adapter.nextChapterUrl({
        seriesKey: 'site.com/manga/naruto/{ch}',
        urlPattern: 'site.com/manga/naruto/{ch}',
        currentChapterNumber: 700,
        currentUrl: 'https://site.com/manga/naruto/700',
      });

      expect(nextUrl).toBeNull();
    });

    it('returns null if urlPattern or currentChapterNumber is missing', async () => {
      const adapter = new GenericNumericAdapter();
      expect(
        await adapter.nextChapterUrl({
          seriesKey: 'site.com/manga',
          currentUrl: 'https://site.com/manga',
        })
      ).toBeNull();
    });

    it('computes next chapter for MangaDex adapter', async () => {
      const adapter = new MangaDexAdapter();
      const nextUrl = await adapter.nextChapterUrl({
        seriesKey: `mangadex:${MOCK_MANGA_UUID}`,
        currentChapterNumber: 1,
        currentUrl: `https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`,
        language: 'en',
      });

      expect(nextUrl).toBe(`https://mangadex.org/chapter/${MOCK_CHAPTER_2_UUID}`);
    });

    it('handles MangaDex next chapter when feed fails or no next chapter exists', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return {
            ok: false,
            status: 500,
          };
        })
      );

      const adapter = new MangaDexAdapter();
      const nextUrl = await adapter.nextChapterUrl({
        seriesKey: `mangadex:${MOCK_MANGA_UUID}`,
        currentChapterNumber: 100,
        currentUrl: `https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`,
      });

      expect(nextUrl).toBeNull();
    });
  });

  describe('Generic Adapter Edge Cases', () => {
    it('handles suffixed chapter patterns with underscores and hyphens', async () => {
      const adapter = new GenericNumericAdapter();
      const res1 = await adapter.resolve(new URL('https://site.com/manga/title/10_ch'));
      expect(res1.chapterLabel).toBe('Ch. 10');
      expect(res1.seriesKey).toBe('site.com/manga/title/{ch}_ch');

      const res2 = await adapter.resolve(new URL('https://site.com/manga/title/chap_15'));
      expect(res2.chapterLabel).toBe('Ch. 15');
      expect(res2.seriesKey).toBe('site.com/manga/title/chap_{ch}');
    });

    it('ignores 6+ digit ID in query param', async () => {
      const adapter = new GenericNumericAdapter();
      const res = await adapter.resolve(new URL('https://site.com/read?c=998877'));
      expect(res.chapterNumber).toBeUndefined();
    });
  });

  describe('MangaDex Adapter Error Handling', () => {
    it('rejects invalid UUID in pathname', async () => {
      const adapter = new MangaDexAdapter();
      await expect(
        adapter.resolve(new URL('https://mangadex.org/chapter/invalid-uuid'))
      ).rejects.toThrowError(ResolverError);
    });

    it('handles MangaDex 404', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 404,
        }))
      );

      const adapter = new MangaDexAdapter();
      await expect(
        adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`))
      ).rejects.toSatisfy((err: unknown) => err instanceof ResolverError && err.code === 'NOT_FOUND');
    });

    it('handles MangaDex 429 Rate Limit', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 429,
        }))
      );

      const adapter = new MangaDexAdapter();
      await expect(
        adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`))
      ).rejects.toSatisfy((err: unknown) => err instanceof ResolverError && err.code === 'RATE_LIMITED');
    });

    it('handles MangaDex 502 Upstream Error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
        }))
      );

      const adapter = new MangaDexAdapter();
      await expect(
        adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`))
      ).rejects.toSatisfy((err: unknown) => err instanceof ResolverError && err.code === 'UPSTREAM_ERROR');
    });

    it('handles MangaDex missing manga relationship', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: MOCK_CHAPTER_1_UUID,
              attributes: { chapter: '1' },
              relationships: [],
            },
          }),
        }))
      );

      const adapter = new MangaDexAdapter();
      await expect(
        adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`))
      ).rejects.toSatisfy((err: unknown) => err instanceof ResolverError && err.code === 'RESOLVE_FAILED');
    });

    it('handles manga title with altTitles and non-en titles', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const urlStr = input.toString();
          if (urlStr.includes('/chapter/')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                data: {
                  id: MOCK_CHAPTER_1_UUID,
                  attributes: { chapter: '1' },
                  relationships: [{ type: 'manga', id: MOCK_MANGA_UUID }],
                },
              }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: MOCK_MANGA_UUID,
                attributes: {
                  title: { ja: '進撃の巨人' },
                  altTitles: [{ en: 'Attack on Titan' }],
                },
                relationships: [],
              },
            }),
          };
        })
      );

      const adapter = new MangaDexAdapter();
      const res = await adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`));
      expect(res.seriesTitle).toBe('進撃の巨人');
    });

    it('handles failed manga metadata lookup gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const urlStr = input.toString();
          if (urlStr.includes('/chapter/')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                data: {
                  id: MOCK_CHAPTER_1_UUID,
                  attributes: { chapter: null, title: 'Special Chapter' },
                  relationships: [{ type: 'manga', id: MOCK_MANGA_UUID }],
                },
              }),
            };
          }
          return {
            ok: false,
            status: 500,
          };
        })
      );

      const adapter = new MangaDexAdapter();
      const res = await adapter.resolve(new URL(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`));
      expect(res.seriesTitle).toBe('Unknown Manga');
      expect(res.chapterLabel).toBe('Special Chapter');
    });
  });

  describe('Fallback Adapter & Title Extraction', () => {
    it('extracts og:title and og:image when generic pattern does not match', async () => {
      const adapter = new FallbackAdapter();
      const res = await adapter.resolve(new URL('https://custommangasite.com/story-details'));

      expect(res.source).toBe('fallback');
      expect(res.seriesTitle).toBe('Awesome Series');
      expect(res.seriesKey).toBe('fallback:custommangasite.com:awesome-series');
      expect(res.coverUrl).toBe('https://site.com/cover.jpg');
      expect(res.confidence).toBe('low');
    });

    it('handles HTTP error status in fallback adapter', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 403,
        }))
      );

      const adapter = new FallbackAdapter();
      const res = await adapter.resolve(new URL('https://protected.com/manga'));

      expect(res.source).toBe('fallback');
      expect(res.requiresManualTitle).toBe(true);
      expect(res.confidence).toBe('low');
    });

    it('handles network failure gracefully with manual title flag', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('Connection refused / Cloudflare block');
        })
      );

      const adapter = new FallbackAdapter();
      const res = await adapter.resolve(new URL('https://blocked-site.com/story'));

      expect(res.source).toBe('fallback');
      expect(res.requiresManualTitle).toBe(true);
      expect(res.seriesKey.startsWith('manual:blocked-site.com:')).toBe(true);
      expect(res.confidence).toBe('low');
    });
  });

  describe('ResolverEngine Custom Adapters & Fallback Flow', () => {
    it('passes through custom adapter and falls back when adapter throws non-fatal error', async () => {
      const failingAdapter = {
        name: 'failing',
        match: () => true,
        resolve: async () => {
          throw new Error('Unexpected adapter failure');
        },
      };

      const engine = new ResolverEngine([failingAdapter, new FallbackAdapter()]);
      const res = await engine.resolve('https://customsite.com/read/chapter');
      expect(res.source).toBe('fallback');
    });

    it('rethrows fatal error (e.g. BLOCKED_HOST or INVALID_URL)', async () => {
      const fatalAdapter = {
        name: 'fatal',
        match: () => true,
        resolve: async () => {
          throw new ResolverError('BLOCKED_HOST', 'Host blocked');
        },
      };

      const engine = new ResolverEngine([fatalAdapter, new FallbackAdapter()]);
      await expect(engine.resolve('https://customsite.com/read')).rejects.toThrowError(ResolverError);
    });

    it('rethrows error if last adapter in chain fails', async () => {
      const failingAdapter = {
        name: 'failing',
        match: () => true,
        resolve: async () => {
          throw new Error('Final failure');
        },
      };

      const engine = new ResolverEngine([failingAdapter]);
      await expect(engine.resolve('https://customsite.com/read')).rejects.toThrow('Final failure');
    });
  });

  describe('Scrutinize Audit Refinement Tests', () => {
    it('preserves valid series subtitles with hyphens while stripping chapter/site suffixes', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          text: async () => `
            <!DOCTYPE html>
            <html>
              <head>
                <meta property="og:title" content="Sword Art Online - Alicization - Read Online" />
              </head>
            </html>
          `,
        }))
      );

      const adapter = new FallbackAdapter();
      const res = await adapter.resolve(new URL('https://custommangasite.com/story'));
      expect(res.seriesTitle).toBe('Sword Art Online - Alicization');
    });

    it('treats single bare numeric root segment as series landing page', async () => {
      const adapter = new GenericNumericAdapter();
      const res = await adapter.resolve(new URL('https://site.com/123'));
      expect(res.chapterNumber).toBeUndefined();
      expect(res.seriesKey).toBe('site.com/123');
      expect(res.chapterLabel).toBe('Landing');
    });

    it('strips MangaDex reader page query parameters from chapter canonical URL', async () => {
      const res = await resolve(
        `https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}?page=5&other=1`
      );
      expect(res.chapterUrl).toBe(`https://mangadex.org/chapter/${MOCK_CHAPTER_1_UUID}`);
    });

    it('resolves Thai manga URLs with attached chapter slugs and merges them', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          text: async () => `
            <!DOCTYPE html>
            <html>
              <head>
                <title>อ่านมังงะ Delusional Hunter World ตอนที่ 1 แปลไทย | Dark-Manga</title>
              </head>
              <body><h1>Delusional Hunter World</h1></body>
            </html>
          `,
        }))
      );

      const adapter = new GenericNumericAdapter();
      const url1 = new URL('https://www.dark-manga.com/delusional-hunter-world-ตอนที่-1/');
      const url2 = new URL('https://www.dark-manga.com/delusional-hunter-world-ตอนที่-2/');

      const res1 = await adapter.resolve(url1);
      const res2 = await adapter.resolve(url2);

      expect(res1.seriesKey).toBe('dark-manga.com/delusional-hunter-world-ตอนที่-{ch}');
      expect(res2.seriesKey).toBe('dark-manga.com/delusional-hunter-world-ตอนที่-{ch}');
      expect(res1.seriesKey).toBe(res2.seriesKey);

      expect(res1.chapterNumber).toBe(1);
      expect(res2.chapterNumber).toBe(2);

      expect(res1.chapterLabel).toBe('Ch. 1');
      expect(res2.chapterLabel).toBe('Ch. 2');

      expect(res1.seriesTitle).toBe('Delusional Hunter World');
    });

    it('extracts Nekopost CDN cover image pattern automatically', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          text: async () => `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Nekopost Manga Reader</title>
              </head>
            </html>
          `,
        }))
      );

      const adapter = new GenericNumericAdapter();
      const url = new URL('https://www.nekopost.net/manga/17045/1');
      const res = await adapter.resolve(url);

      expect(res.seriesKey).toBe('nekopost.net/manga/17045/{ch}');
      expect(res.chapterNumber).toBe(1);
      expect(res.coverUrl).toBe('https://www.osemocphoto.com/collectManga/17045/17045_mini.jpg');
    });
  });
});
