import { NextChapterContext, ResolveResult, SiteAdapter } from '../types';
import { scrapePageMetadata } from '../metadata';

/**
 * Extracts the numeric value that is literally embedded in currentUrl at the
 * position of {ch} in urlPattern.  Returns null if it cannot be determined.
 *
 * This lets us distinguish two URL conventions:
 *   - Chapter-number URLs: /manga/X/10.5  → number in URL == chapterNumber
 *   - Sequential-ID URLs:  /chapter/21    → number in URL != chapterNumber
 */
function extractUrlChapterNum(currentUrl: string, urlPattern: string): number | null {
  try {
    // Build a regex from the pattern by escaping special chars then replacing {ch}
    const escaped = urlPattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex special chars
      .replace('\\{ch\\}', '(\\d+(?:\\.\\d+)?)'); // un-escape {ch} and replace with capture group

    // Strip leading protocol if pattern doesn't include it
    const urlToMatch = currentUrl.replace(/^https?:\/\//, '');
    const match = urlToMatch.match(new RegExp(escaped));
    if (match && match[1] !== undefined) {
      return parseFloat(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * WordPress Manga Reader strategy for next chapter detection.
 *
 * Many Thai manga sites (mangastep.com and others) use WordPress with a manga
 * plugin that renders next/prev via JavaScript.  The current chapter's post ID
 * is embedded in the page as `var chapter_id = <id>`.  We:
 *   1. Fetch the current chapter page and extract chapter_id
 *   2. Query WP REST API for that post's date & categories
 *   3. Query for the next post chronologically in the same category
 *   4. Return that post's permalink
 *
 * Returns: string (next URL) | null (no next chapter) | undefined (not a WP site)
 */
async function tryWordPressNextChapter(currentUrl: string): Promise<string | null | undefined> {
  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MangaTracker/1.0';
    const fetchOpts = {
      headers: { 'User-Agent': ua },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow' as const,
    };

    // 1. Fetch the current chapter page to detect WP manga pattern
    const pageRes = await fetch(currentUrl, fetchOpts);
    if (!pageRes.ok) return undefined;
    const html = await pageRes.text();

    // Detect: var chapter_id = 121621;
    const chapterIdMatch = html.match(/var\s+chapter_id\s*=\s*(\d+)/);
    if (!chapterIdMatch) return undefined; // Not a WP manga site

    const chapterId = chapterIdMatch[1];
    const origin = new URL(currentUrl).origin;

    // 2. Get current post metadata via WP REST API
    const postRes = await fetch(`${origin}/wp-json/wp/v2/posts/${chapterId}`, fetchOpts);
    if (!postRes.ok) return undefined;
    const post = await postRes.json() as { date?: string; categories?: number[] };
    if (!post.date || !post.categories?.length) return undefined;

    // 3. Find next chronological post in the same categories
    const after = encodeURIComponent(post.date);
    const cats = post.categories.join(',');
    const nextRes = await fetch(
      `${origin}/wp-json/wp/v2/posts?after=${after}&per_page=1&order=asc&categories=${cats}`,
      fetchOpts
    );
    if (!nextRes.ok) return null;
    const posts = await nextRes.json() as Array<{ link?: string }>;
    if (!Array.isArray(posts) || posts.length === 0) return null;

    return posts[0].link ?? null;
  } catch {
    return undefined; // Network error — fall through to URL+1 strategy
  }
}


const ATTACHED_PREFIX_REGEX = /^(.+?)[-_](ตอนที่|ตอน|บทที่|chapter|chap|ch|ep|episode|tuyen)[-_]?(\d+(?:\.\d+)?)$/i;
const ISOLATED_PREFIX_REGEX = /^(ตอนที่|ตอน|บทที่|chapter|chap|ch|ep|episode|tuyen)[-_]?(\d+(?:\.\d+)?)$/i;
const ATTACHED_SUFFIX_REGEX = /^(.+?)[-_](\d+(?:\.\d+)?)[-_]?(chapter|ch|ตอนที่|ตอน)$/i;
const ISOLATED_SUFFIX_REGEX = /^(\d+(?:\.\d+)?)[-_]?(chapter|ch|ตอนที่|ตอน)$/i;
const ATTACHED_BARE_NUMBER_REGEX = /^([a-zA-Z0-9_\u0E00-\u0E7F-]+)[-_](\d+(?:\.\d+)?)$/;
const BARE_NUMBER_REGEX = /^\d+(?:\.\d+)?$/;
const QUERY_PARAM_KEYS = ['c', 'ch', 'chapter', 'chap', 'ep', 'page', 'ตอน', 'ตอนที่'];
const SERIES_ROOT_SEGMENTS = new Set(['manga', 'series', 'comic', 'comics', 'title', 'titles', 'book', 'books', 'project']);

function slugToTitle(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {}

  // Strip common chapter endings from slug
  const cleaned = decoded
    .replace(/[-_](ตอนที่|ตอน|บทที่|chapter|chap|ch|ep|episode)[-_]?\d+.*$/i, '')
    .replace(/[-_]\d+$/, '')
    .trim();

  // Pure numeric ID fallback (e.g. 17045)
  if (/^\d+$/.test(cleaned)) {
    return `Series ${cleaned}`;
  }

  // Thai text in slug: replace hyphens/underscores with space
  if (/[\u0E00-\u0E7F]/.test(cleaned)) {
    return cleaned.replace(/[-_]+/g, ' ').trim();
  }

  // Capitalize English words
  return cleaned
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export class GenericNumericAdapter implements SiteAdapter {
  name = 'generic';

  match(url: URL): boolean {
    return url.protocol === 'https:' || url.protocol === 'http:';
  }

  async resolve(url: URL): Promise<ResolveResult> {
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = url.pathname;
    const rawSegments = pathname.split('/').filter(Boolean);

    let matchResult: {
      pattern: string;
      chapterNum: number;
      chapterLabel: string;
      confidence: 'high' | 'medium';
      fallbackSlug?: string;
    } | null = null;

    // 1. Scan path segments right to left
    for (let i = rawSegments.length - 1; i >= 0; i--) {
      const rawSeg = rawSegments[i];
      let seg = rawSeg;
      try {
        seg = decodeURIComponent(rawSeg);
      } catch {}

      // A. Attached chapter pattern: slug + chapter in ONE segment
      // e.g. "delusional-hunter-world-ตอนที่-1", "solo-leveling-chapter-100", "one-piece-ch-1100"
      const attachedMatch = seg.match(ATTACHED_PREFIX_REGEX);
      if (attachedMatch) {
        const slug = attachedMatch[1];
        const keyword = attachedMatch[2];
        const numStr = attachedMatch[3];
        const chapterNum = parseFloat(numStr);

        const hasHyphen = seg.includes(`${keyword}-`);
        const sep = hasHyphen ? '-' : '';
        const placeholderSeg = `${slug}-${keyword}${sep}{ch}`;

        const newSegments = [...rawSegments];
        newSegments[i] = placeholderSeg;
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        matchResult = {
          pattern,
          chapterNum,
          chapterLabel: `Ch. ${numStr}`,
          confidence: 'high',
          fallbackSlug: slug,
        };
        break;
      }

      // B. Isolated chapter prefix pattern
      // e.g. "chapter-10.5", "ch-1050", "ตอนที่-1", "ตอน-2"
      const prefixMatch = seg.match(ISOLATED_PREFIX_REGEX);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        const numStr = prefixMatch[2];
        const chapterNum = parseFloat(numStr);

        const separator = seg.includes('-') ? '-' : seg.includes('_') ? '_' : '';
        const placeholderSeg = `${prefix}${separator}{ch}`;

        const newSegments = [...rawSegments];
        newSegments[i] = placeholderSeg;
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        const prevSeg = i > 0 ? rawSegments[i - 1] : undefined;
        matchResult = {
          pattern,
          chapterNum,
          chapterLabel: `Ch. ${numStr}`,
          confidence: 'high',
          fallbackSlug: prevSeg,
        };
        break;
      }

      // C. Attached suffixed chapter: slug-1050-chapter
      const attachedSuffixMatch = seg.match(ATTACHED_SUFFIX_REGEX);
      if (attachedSuffixMatch) {
        const slug = attachedSuffixMatch[1];
        const numStr = attachedSuffixMatch[2];
        const suffix = attachedSuffixMatch[3];
        const chapterNum = parseFloat(numStr);

        const placeholderSeg = `${slug}-{ch}-${suffix}`;
        const newSegments = [...rawSegments];
        newSegments[i] = placeholderSeg;
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        matchResult = {
          pattern,
          chapterNum,
          chapterLabel: `Ch. ${numStr}`,
          confidence: 'high',
          fallbackSlug: slug,
        };
        break;
      }

      // D. Attached bare number to a slug: solo-leveling-100
      const attachedBareMatch = seg.match(ATTACHED_BARE_NUMBER_REGEX);
      if (attachedBareMatch) {
        const slug = attachedBareMatch[1];
        const numStr = attachedBareMatch[2];
        if (!/^\d{6,}$/.test(numStr)) {
          const chapterNum = parseFloat(numStr);
          const placeholderSeg = `${slug}-{ch}`;

          const newSegments = [...rawSegments];
          newSegments[i] = placeholderSeg;
          const patternPath = '/' + newSegments.join('/');
          const queryString = url.search ? url.search : '';
          const pattern = `${hostname}${patternPath}${queryString}`;

          matchResult = {
            pattern,
            chapterNum,
            chapterLabel: `Ch. ${numStr}`,
            confidence: 'high',
            fallbackSlug: slug,
          };
          break;
        }
      }

      // E. Isolated bare number: /manga/17045/1
      if (BARE_NUMBER_REGEX.test(seg)) {
        if (rawSegments.length === 1) {
          break;
        }

        if (i === 1 && rawSegments.length === 2 && SERIES_ROOT_SEGMENTS.has(rawSegments[0].toLowerCase())) {
          break;
        }

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
        const newSegments = [...rawSegments];
        newSegments[i] = '{ch}';
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        const prevSeg = i > 0 ? rawSegments[i - 1] : undefined;
        matchResult = {
          pattern,
          chapterNum,
          chapterLabel: `Ch. ${seg}`,
          confidence: 'high',
          fallbackSlug: prevSeg,
        };
        break;
      }

      // F. Isolated suffixed chapter: 1050-chapter
      const suffixMatch = seg.match(ISOLATED_SUFFIX_REGEX);
      if (suffixMatch) {
        const numStr = suffixMatch[1];
        const suffix = suffixMatch[2];
        const chapterNum = parseFloat(numStr);

        const separator = seg.includes('-') ? '-' : seg.includes('_') ? '_' : '';
        const placeholderSeg = `{ch}${separator}${suffix}`;

        const newSegments = [...rawSegments];
        newSegments[i] = placeholderSeg;
        const patternPath = '/' + newSegments.join('/');
        const queryString = url.search ? url.search : '';
        const pattern = `${hostname}${patternPath}${queryString}`;

        const prevSeg = i > 0 ? rawSegments[i - 1] : undefined;
        matchResult = {
          pattern,
          chapterNum,
          chapterLabel: `Ch. ${numStr}`,
          confidence: 'high',
          fallbackSlug: prevSeg,
        };
        break;
      }
    }

    // 2. Scan query params if no path segment matched
    if (!matchResult) {
      const searchParams = Array.from(url.searchParams.entries());
      for (const key of QUERY_PARAM_KEYS) {
        const val = url.searchParams.get(key);
        if (val && BARE_NUMBER_REGEX.test(val)) {
          if (/^\d{6,}$/.test(val)) continue;

          const chapterNum = parseFloat(val);
          const newParams = searchParams.map(([k, v]) =>
            k === key ? ([k, '{ch}'] as [string, string]) : ([k, v] as [string, string])
          );
          newParams.sort(([aKey, aVal], [bKey, bVal]) => {
            if (aKey === bKey) return aVal.localeCompare(bVal);
            return aKey.localeCompare(bKey);
          });

          const queryPattern = new URLSearchParams(newParams).toString().replace(/%7Bch%7D/g, '{ch}');
          const pattern = `${hostname}${pathname}?${queryPattern}`;

          matchResult = {
            pattern,
            chapterNum,
            chapterLabel: `Ch. ${val}`,
            confidence: 'medium',
            fallbackSlug: rawSegments[rawSegments.length - 1],
          };
          break;
        }
      }
    }

    // 3. Scrape page metadata for real title and cover image
    let seriesTitle: string | undefined;
    let coverUrl: string | undefined;
    let scrapedChapterNum: number | undefined;
    let rawPageTitle: string | null = null;

    try {
      const meta = await scrapePageMetadata(url.toString());
      if (meta.title) {
        seriesTitle = meta.title;
      }
      if (meta.coverUrl) {
        coverUrl = meta.coverUrl;
      }
      // rawTitle is the original page title before chapter-info stripping —
      // we need it to reliably extract "ตอนที่ 181" or "Chapter 181"
      rawPageTitle = meta.rawTitle;
    } catch {
      // Ignore network errors
    }

    // Try to extract real chapter number from the page title.
    // Covers patterns: "ตอนที่ 181", "Chapter 181", "Ch. 181", "Episode 181"
    if (rawPageTitle && matchResult) {
      const chFromTitle = rawPageTitle.match(
        /(?:ตอนที่|ตอน|บทที่|chapter|chap|ch\.|ep\.?|episode)\s*(\d+(?:\.\d+)?)/i
      );
      if (chFromTitle) {
        const titleNum = parseFloat(chFromTitle[1]);
        // Only override when URL number clearly doesn't match the title number
        // (tolerance of 0.5 to ignore rounding differences)
        if (!isNaN(titleNum) && Math.abs(titleNum - matchResult.chapterNum) > 0.5) {
          scrapedChapterNum = titleNum;
        }
      }
    }

    // Nekopost-specific cover CDN fallback
    if (!coverUrl && hostname.includes('nekopost.net')) {
      const nekoMatch = pathname.match(/\/(?:manga|comic|project)\/(\d+)/i);
      if (nekoMatch && nekoMatch[1]) {
        coverUrl = `https://www.osemocphoto.com/collectManga/${nekoMatch[1]}/${nekoMatch[1]}_mini.jpg`;
      }
    }

    // Fallback title derived from URL slug if scraping didn't yield a title
    const slug = matchResult?.fallbackSlug || rawSegments[rawSegments.length - 1];
    if (!seriesTitle && slug) {
      seriesTitle = slugToTitle(slug);
    }

    if (matchResult) {
      // Use page-title-derived chapter number if it differs from the URL number.
      // The urlPattern is always kept from the URL so nextChapterUrl() can still
      // correctly increment the URL ID (e.g. 198 → 199) on ID-based sites.
      const finalChapterNum = scrapedChapterNum ?? matchResult.chapterNum;
      const finalChapterLabel =
        scrapedChapterNum !== undefined
          ? `Ch. ${scrapedChapterNum % 1 === 0 ? scrapedChapterNum : scrapedChapterNum}`
          : matchResult.chapterLabel;

      return {
        seriesKey: matchResult.pattern,
        urlPattern: matchResult.pattern,
        source: 'generic',
        seriesTitle,
        coverUrl,
        chapterNumber: finalChapterNum,
        chapterLabel: finalChapterLabel,
        chapterUrl: url.toString(),
        confidence: matchResult.confidence,
      };
    }

    // 4. Series Landing page (no chapter found)
    const landingKey = `${hostname}${pathname.length > 1 ? pathname : ''}`;
    return {
      seriesKey: landingKey,
      urlPattern: landingKey,
      source: 'generic',
      seriesTitle,
      coverUrl,
      chapterNumber: undefined,
      chapterLabel: 'Landing',
      chapterUrl: url.toString(),
      confidence: 'high',
    };
  }

  async nextChapterUrl(ctx: NextChapterContext): Promise<string | null> {
    if (!ctx.urlPattern || ctx.currentChapterNumber === undefined) return null;

    // === Strategy 1: WordPress Manga Reader (e.g. mangastep.com) ===
    // Detects via embedded `var chapter_id = <id>` JS variable and uses the
    // WP REST API to find the next post in the same series/category.
    // This is the most reliable approach for WP-based sites where URL IDs are
    // non-sequential (so URL+1 would give the wrong chapter).
    const wpResult = await tryWordPressNextChapter(ctx.currentUrl);
    if (wpResult !== undefined) {
      // WP site confirmed — return the API-sourced URL (may be null = caught up)
      return wpResult;
    }

    // === Strategy 2: URL increment ===
    const chapterNum = ctx.currentChapterNumber;
    const urlNum = extractUrlChapterNum(ctx.currentUrl, ctx.urlPattern);

    // If the number embedded in the URL differs from the chapter number, the site
    // uses sequential IDs (e.g. /chapter/21 for Ch. 10.5).  In that case we
    // must increment the URL number, NOT the chapter number.
    const isIdBased = urlNum !== null && Math.abs(urlNum - chapterNum) > 0.01;
    const nextCh = isIdBased
      ? urlNum! + 1                // ID-based: increment the URL id (e.g. /chapter/21 → /chapter/22)
      : Math.floor(chapterNum) + 1; // Chapter-based: floor+1 handles both 10→11 and 10.5→11

    const hasTrailingSlash = ctx.currentUrl.endsWith('/');
    let nextUrlStr = 'https://' + ctx.urlPattern.replace('{ch}', String(nextCh));
    if (hasTrailingSlash && !nextUrlStr.endsWith('/')) {
      nextUrlStr += '/';
    }

    try {
      let res = await fetch(nextUrlStr, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MangaTracker/1.0',
        },
        signal: AbortSignal.timeout(4000),
        redirect: 'follow',
      });

      if (res.status === 405 || res.status === 501) {
        res = await fetch(nextUrlStr, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MangaTracker/1.0',
            'Range': 'bytes=0-4096',
          },
          signal: AbortSignal.timeout(4000),
          redirect: 'follow',
        });
      }

      if (!res.ok && res.status !== 206) return null;

      // 1. Redirect check: if followed redirect to homepage or 404 route
      if (res.redirected && res.url) {
        try {
          const finalUrl = new URL(res.url);
          const reqUrl = new URL(nextUrlStr);
          const finalPath = decodeURIComponent(finalUrl.pathname).replace(/\/$/, '');
          const reqPath = decodeURIComponent(reqUrl.pathname).replace(/\/$/, '');
          if (finalPath !== reqPath) {
            return null;
          }
        } catch {}
      }

      // 2. Soft 404 check via GET snippet
      let htmlText = '';
      try {
        if (typeof res.text === 'function') {
          htmlText = await res.text();
        }
      } catch {}

      if (!htmlText) {
        try {
          const getRes = await fetch(nextUrlStr, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MangaTracker/1.0',
              'Range': 'bytes=0-4096',
            },
            signal: AbortSignal.timeout(4000),
            redirect: 'follow',
          });
          if (getRes.ok || getRes.status === 206) {
            if (getRes.redirected && getRes.url) {
              const finalPath = decodeURIComponent(new URL(getRes.url).pathname).replace(/\/$/, '');
              const reqPath = decodeURIComponent(new URL(nextUrlStr).pathname).replace(/\/$/, '');
              if (finalPath !== reqPath) return null;
            }
            htmlText = await getRes.text();
          }
        } catch {}
      }

      if (htmlText) {
        const htmlLower = htmlText.slice(0, 4000).toLowerCase();
        if (
          htmlLower.includes('<title>404') ||
          htmlLower.includes('404 not found') ||
          htmlLower.includes('page not found') ||
          htmlLower.includes('ไม่พบหน้า') ||
          htmlLower.includes('ไม่พบเนื้อหา') ||
          htmlLower.includes('does not exist') ||
          htmlLower.includes('error 404')
        ) {
          return null;
        }

        // Nekopost: Soft 404 when chapter does not exist leaves Chapter empty in title: "- Chapter  |"
        // And embeds released chapters in title or ListChapter data
        if (nextUrlStr.includes('nekopost.net')) {
          if (/- Chapter\s+\|/i.test(htmlText)) {
            return null;
          }
          const hasChapterInTitle = new RegExp(`<title>[^<]*Chapter\\s+${nextCh}\\b`, 'i').test(htmlText);
          const hasChapterInList = new RegExp(`ChapterNo:"${nextCh}"`).test(htmlText);
          if (!hasChapterInTitle && !hasChapterInList) {
            return null;
          }
        } else {
          // Other generic Thai reader sites that display 'กำลังเตรียมเนื้อหา' for unreleased chapters
          if (htmlLower.includes('กำลังเตรียมเนื้อหา')) {
            return null;
          }
        }
      }

      return nextUrlStr;
    } catch (err) {
      throw err;
    }
  }
}
