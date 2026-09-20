import { NextChapterContext, ResolveResult, ResolverError, SiteAdapter } from '../types';
import { fetchMangaDex } from '../rate-limit';
import { CacheService } from '../../db/cache-service';

const API = 'https://api.mangadex.org';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CachedChapterData {
  mangaId: string;
  chapterNumber?: number;
  chapterLabel: string;
  language?: string;
  volume?: string | null;
  title?: string | null;
}

interface CachedMangaData {
  title: string;
  coverUrl?: string;
}

export class MangaDexAdapter implements SiteAdapter {
  name = 'mangadex';

  match(url: URL): boolean {
    if (url.hostname !== 'mangadex.org') return false;
    return (
      /^\/chapter\/[0-9a-f-]{36}/i.test(url.pathname) ||
      /^\/title\/[0-9a-f-]{36}/i.test(url.pathname)
    );
  }

  async resolve(url: URL): Promise<ResolveResult> {
    const segments = url.pathname.split('/').filter(Boolean);
    const type = segments[0]?.toLowerCase();
    const id = segments[1];

    if (!id || !UUID_RE.test(id)) {
      throw new ResolverError('INVALID_URL', `Invalid MangaDex UUID in path: ${url.pathname}`);
    }

    if (type === 'chapter') {
      return this.resolveChapter(id, `https://mangadex.org/chapter/${id}`);
    } else if (type === 'title') {
      return this.resolveTitle(id, `https://mangadex.org/title/${id}`);
    }

    throw new ResolverError('INVALID_URL', `Unsupported MangaDex URL path: ${url.pathname}`);
  }

  private async resolveChapter(chapterId: string, canonicalUrl: string): Promise<ResolveResult> {
    const cacheKey = `mangadex:chapter:${chapterId}`;
    let chapterData = CacheService.get<CachedChapterData>(cacheKey);

    if (!chapterData) {
      const chapterRes = await fetchMangaDex(`${API}/chapter/${chapterId}`, {
        headers: {
          'User-Agent': 'MangaTracker/1.0 (+https://mangatrack.vercel.app)',
        },
      });

      if (!chapterRes.ok) {
        if (chapterRes.status === 404) {
          throw new ResolverError('NOT_FOUND', `MangaDex chapter ${chapterId} not found`, 404);
        }
        if (chapterRes.status === 429) {
          throw new ResolverError('RATE_LIMITED', 'MangaDex API rate limit exceeded', 429);
        }
        throw new ResolverError('UPSTREAM_ERROR', `MangaDex chapter lookup failed: ${chapterRes.statusText}`, 502);
      }

      const chapterJson = await chapterRes.json();
      const attrs = chapterJson.data?.attributes || {};
      const relationships = chapterJson.data?.relationships || [];

      const mangaRel = relationships.find((r: { type: string; id: string }) => r.type === 'manga');
      if (!mangaRel?.id) {
        throw new ResolverError('RESOLVE_FAILED', 'No manga relationship found for chapter');
      }

      const mangaId = mangaRel.id;
      const chapterRaw = attrs.chapter;
      const chapterNumber = chapterRaw !== null && chapterRaw !== undefined && chapterRaw !== ''
        ? parseFloat(chapterRaw)
        : undefined;

      const chapterLabel = chapterNumber !== undefined
        ? `Ch. ${chapterRaw}`
        : (attrs.title || 'Chapter');

      const language = attrs.translatedLanguage || undefined;

      chapterData = {
        mangaId,
        chapterNumber,
        chapterLabel,
        language,
        volume: attrs.volume || null,
        title: attrs.title || null,
      };

      // Permanent caching for immutable chapter data
      CacheService.set(cacheKey, chapterData);
    }

    // Fetch manga metadata (cached with 7-day TTL)
    const mangaData = await this.fetchMangaMetadata(chapterData.mangaId);

    return {
      seriesKey: `mangadex:${chapterData.mangaId}`,
      source: 'mangadex',
      seriesTitle: mangaData.title,
      coverUrl: mangaData.coverUrl,
      chapterNumber: chapterData.chapterNumber,
      chapterLabel: chapterData.chapterLabel,
      chapterUrl: canonicalUrl,
      language: chapterData.language,
      confidence: 'high',
      urlPattern: `mangadex.org/title/${chapterData.mangaId}`,
      meta: {
        mangaId: chapterData.mangaId,
        chapterId,
        volume: chapterData.volume,
        title: chapterData.title,
      },
    };
  }

  private async resolveTitle(mangaId: string, canonicalUrl: string): Promise<ResolveResult> {
    const mangaData = await this.fetchMangaMetadata(mangaId);

    return {
      seriesKey: `mangadex:${mangaId}`,
      source: 'mangadex',
      seriesTitle: mangaData.title,
      coverUrl: mangaData.coverUrl,
      chapterNumber: undefined,
      chapterLabel: 'Landing',
      chapterUrl: canonicalUrl,
      confidence: 'high',
      urlPattern: `mangadex.org/title/${mangaId}`,
      meta: {
        mangaId,
      },
    };
  }

  private async fetchMangaMetadata(mangaId: string): Promise<CachedMangaData> {
    const cacheKey = `mangadex:manga:${mangaId}`;
    const cached = CacheService.get<CachedMangaData>(cacheKey);
    if (cached) return cached;

    const mangaRes = await fetchMangaDex(`${API}/manga/${mangaId}?includes[]=cover_art`, {
      headers: {
        'User-Agent': 'MangaTracker/1.0 (+https://mangatrack.vercel.app)',
      },
    });

    if (!mangaRes.ok) {
      return { title: 'Unknown Manga' };
    }

    const mangaJson = await mangaRes.json();
    const attrs = mangaJson.data?.attributes || {};
    const relationships = mangaJson.data?.relationships || [];

    // Extract title (en > first available in title map > altTitles > default)
    let title: string | undefined = attrs.title?.en;
    if (!title && attrs.title) {
      const firstLang = Object.keys(attrs.title)[0];
      if (firstLang) title = attrs.title[firstLang];
    }
    if (!title && Array.isArray(attrs.altTitles)) {
      for (const alt of attrs.altTitles) {
        const val = Object.values(alt)[0];
        if (typeof val === 'string' && val) {
          title = val;
          break;
        }
      }
    }

    // Extract cover
    let coverUrl: string | undefined;
    const coverRel = relationships.find(
      (r: { type: string; attributes?: { fileName?: string } }) =>
        r.type === 'cover_art' && r.attributes?.fileName
    );
    if (coverRel?.attributes?.fileName) {
      coverUrl = `https://uploads.mangadex.org/covers/${mangaId}/${coverRel.attributes.fileName}.256.jpg`;
    }

    const result: CachedMangaData = {
      title: title || 'Unknown Manga',
      coverUrl,
    };

    // 7-day TTL (7 * 24 * 60 * 60 = 604800s)
    CacheService.set(cacheKey, result, 604800);
    return result;
  }

  async nextChapterUrl(ctx: NextChapterContext): Promise<string | null> {
    const mangaId = (ctx.meta?.mangaId as string) || ctx.seriesKey.replace(/^mangadex:/, '');
    if (!mangaId) return null;

    const lang = ctx.language || 'en';
    const cacheKey = `mangadex:feed:${mangaId}:${lang}`;
    let feedData = CacheService.get<Array<{ id: string; chapter?: string }>>(cacheKey);

    if (!feedData) {
      const params = new URLSearchParams({
        'translatedLanguage[]': lang,
        'order[chapter]': 'asc',
        'limit': '100',
        'includeExternalUrl': '0',
      });

      try {
        const res = await fetchMangaDex(`${API}/manga/${mangaId}/feed?${params.toString()}`, {
          headers: {
            'User-Agent': 'MangaTracker/1.0 (+https://mangatrack.vercel.app)',
          },
        });
        if (!res.ok) return null;

        const feedJson = await res.json();
        feedData = (feedJson.data || []).map((item: any) => ({
          id: item.id,
          chapter: item.attributes?.chapter,
        }));

        // 6-hour TTL (6 * 3600 = 21600s)
        CacheService.set(cacheKey, feedData, 21600);
      } catch {
        return null;
      }
    }

    const currentCh = ctx.currentChapterNumber ?? 0;
    for (const item of feedData || []) {
      if (item.chapter) {
        const chNum = parseFloat(item.chapter);
        if (chNum > currentCh) {
          return `https://mangadex.org/chapter/${item.id}`;
        }
      }
    }

    return null;
  }
}
