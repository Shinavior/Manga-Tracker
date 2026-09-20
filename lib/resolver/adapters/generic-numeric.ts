import { NextChapterContext, ResolveResult, SiteAdapter } from '../types';

const PREFIX_REGEX = /^(chapter|chap|ch|ep|episode|tuyen)[-_]?(\d+(?:\.\d+)?)$/i;
const BARE_NUMBER_REGEX = /^\d+(?:\.\d+)?$/;
const SUFFIX_REGEX = /^(\d+(?:\.\d+)?)[-_]?(chapter|ch)$/i;
const QUERY_PARAM_KEYS = ['c', 'ch', 'chapter', 'chap', 'ep', 'page'];
const SERIES_ROOT_SEGMENTS = new Set(['manga', 'series', 'comic', 'comics', 'title', 'titles', 'book', 'books']);

export class GenericNumericAdapter implements SiteAdapter {
  name = 'generic';

  match(url: URL): boolean {
    return url.protocol === 'https:' || url.protocol === 'http:';
  }

  async resolve(url: URL): Promise<ResolveResult> {
    const hostname = url.hostname;
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);

    // 1. Scan path segments right to left
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];

      // Priority 1: Prefixed decimal (e.g. chapter-10.5, ch-1050)
      const prefixMatch = seg.match(PREFIX_REGEX);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        const numStr = prefixMatch[2];
        const chapterNum = parseFloat(numStr);

        const separator = seg.includes('-') ? '-' : seg.includes('_') ? '_' : '';
        const placeholderSeg = `${prefix}${separator}{ch}`;

        const newSegments = [...segments];
        newSegments[i] = placeholderSeg;
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        return {
          seriesKey: pattern,
          urlPattern: pattern,
          source: 'generic',
          chapterNumber: chapterNum,
          chapterLabel: `Ch. ${numStr}`,
          chapterUrl: url.toString(),
          confidence: 'high',
        };
      }

      // Priority 2: Bare number (e.g. 1, 2, 10.5)
      if (BARE_NUMBER_REGEX.test(seg)) {
        // Guard: If there is only a single bare numeric segment (e.g. /123), treat as landing page
        if (segments.length === 1) {
          break;
        }

        // Guard: Check if this bare number is the series ID on a series landing page
        // (e.g. /manga/17045 where 'manga' is the root and 17045 is the only child segment)
        if (i === 1 && segments.length === 2 && SERIES_ROOT_SEGMENTS.has(segments[0].toLowerCase())) {
          // This is a series landing page: /manga/17045
          break;
        }

        // Guard: 6 or more digits is likely a database ID, not a chapter number
        if (/^\d{6,}$/.test(seg)) {
          return {
            seriesKey: `${hostname}${pathname}${url.search}`,
            urlPattern: `${hostname}${pathname}${url.search}`,
            source: 'generic',
            chapterNumber: undefined,
            chapterLabel: 'Unknown',
            chapterUrl: url.toString(),
            confidence: 'low',
            requiresManualTitle: true,
          };
        }

        const chapterNum = parseFloat(seg);
        const newSegments = [...segments];
        newSegments[i] = '{ch}';
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        return {
          seriesKey: pattern,
          urlPattern: pattern,
          source: 'generic',
          chapterNumber: chapterNum,
          chapterLabel: `Ch. ${seg}`,
          chapterUrl: url.toString(),
          confidence: 'high',
        };
      }

      // Priority 3: Suffixed (e.g. 1050-chapter, 1050_ch)
      const suffixMatch = seg.match(SUFFIX_REGEX);
      if (suffixMatch) {
        const numStr = suffixMatch[1];
        const suffix = suffixMatch[2];
        const chapterNum = parseFloat(numStr);

        const separator = seg.includes('-') ? '-' : seg.includes('_') ? '_' : '';
        const placeholderSeg = `{ch}${separator}${suffix}`;

        const newSegments = [...segments];
        newSegments[i] = placeholderSeg;
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        return {
          seriesKey: pattern,
          urlPattern: pattern,
          source: 'generic',
          chapterNumber: chapterNum,
          chapterLabel: `Ch. ${numStr}`,
          chapterUrl: url.toString(),
          confidence: 'high',
        };
      }
    }

    // 2. Scan query params if no path segment matched
    const searchParams = Array.from(url.searchParams.entries());
    for (const key of QUERY_PARAM_KEYS) {
      const val = url.searchParams.get(key);
      if (val && BARE_NUMBER_REGEX.test(val)) {
        // Guard against 6+ digit IDs
        if (/^\d{6,}$/.test(val)) continue;

        const chapterNum = parseFloat(val);

        // Build sorted query params with {ch} placeholder
        const newParams = searchParams.map(([k, v]) =>
          k === key ? ([k, '{ch}'] as [string, string]) : ([k, v] as [string, string])
        );
        newParams.sort(([aKey, aVal], [bKey, bVal]) => {
          if (aKey === bKey) return aVal.localeCompare(bVal);
          return aKey.localeCompare(bKey);
        });

        // Unescape %7Bch%7D -> {ch}
        const queryPattern = new URLSearchParams(newParams).toString().replace(/%7Bch%7D/g, '{ch}');
        const pattern = `${hostname}${pathname}?${queryPattern}`;

        return {
          seriesKey: pattern,
          urlPattern: pattern,
          source: 'generic',
          chapterNumber: chapterNum,
          chapterLabel: `Ch. ${val}`,
          chapterUrl: url.toString(),
          confidence: 'medium',
        };
      }
    }

    // 3. Series Landing page (no chapter found)
    const landingKey = `${hostname}${pathname.length > 1 ? pathname : ''}`;
    return {
      seriesKey: landingKey,
      urlPattern: landingKey,
      source: 'generic',
      chapterNumber: undefined,
      chapterLabel: 'Landing',
      chapterUrl: url.toString(),
      confidence: 'high',
    };
  }

  async nextChapterUrl(ctx: NextChapterContext): Promise<string | null> {
    if (!ctx.urlPattern || ctx.currentChapterNumber === undefined) return null;

    const nextCh = Math.floor(ctx.currentChapterNumber) + 1;
    const nextUrlStr = 'https://' + ctx.urlPattern.replace('{ch}', String(nextCh));

    try {
      const res = await fetch(nextUrlStr, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'MangaTracker/1.0 (+https://mangatrack.vercel.app)',
        },
      });

      if (res.ok) return nextUrlStr;

      if (res.status === 405) {
        const getRes = await fetch(nextUrlStr, {
          method: 'GET',
          headers: {
            'User-Agent': 'MangaTracker/1.0 (+https://mangatrack.vercel.app)',
            'Range': 'bytes=0-0',
          },
        });
        if (getRes.ok || getRes.status === 206) return nextUrlStr;
      }
    } catch {
      return null;
    }

    return null;
  }
}
