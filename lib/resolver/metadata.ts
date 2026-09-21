export interface ScrapedMetadata {
  title: string | null;       // cleaned series title
  rawTitle: string | null;    // original page title before cleaning (useful for chapter number extraction)
  coverUrl: string | null;
  siteName: string | null;
  error?: string;
}

// IP Range check for basic SSRF protection
export function isPrivateIp(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.')
  ) {
    return true;
  }
  // Check 172.16.0.0 - 172.31.255.255
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

// Clean extracted page titles from common site banners and suffixes
export function cleanScrapedTitle(rawTitle: string): string {
  let cleaned = rawTitle.trim();

  // Strip leading site / action prefixes (e.g. "อ่านมังงะ ", "อ่านการ์ตูน ", "มังงะ ")
  cleaned = cleaned.replace(/^\[?(อ่านมังงะ|อ่านการ์ตูน|มังงะ|อ่านเรื่อง|อ่าน|read manga online|read manga|read)\]?\s*[-:]?\s*/i, '').trim();

  // Strip common delimiters and suffixes (e.g. "Solo Leveling Chapter 10 - Read Manga Online Free")
  const noisePatterns = [
    /\s*[-|–—]\s*(read\s+online|read\s+manga|read\s+free|mangadex|nekopost|chapmanganato|manganato|mangakakalot|batoto|dark-manga).*$/i,
    /\s*[-|–—]\s*(ตอนที่|chapter|ch\.)\s*[\d.]+\s*(free\s+online|online|raw|eng\s*sub|แปลไทย)?.*$/i,
    /\s*\|\s*.*$/, // Pipe and anything after (e.g. " | Dark-Manga", " | Nekopost")
    /\s*[-–—]\s*Chapter\s*[\d.]+.*$/i,
  ];

  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // Remove trailing chapter and translation references, e.g. "ตอนที่ 1 แปลไทย", "Chapter 100", "Ch. 5"
  cleaned = cleaned.replace(/\s+(chapter|ตอนที่|ตอน|บทที่|ch\.|ep\.)\s*[\d.]+(\s*[-:]\s*.*|\s+แปลไทย|\s+ซับไทย|\s+raw|\s+eng\s*sub)?.*$/i, '').trim();

  // Strip standalone trailing "แปลไทย" or "ซับไทย"
  cleaned = cleaned.replace(/\s+(แปลไทย|ซับไทย)$/i, '').trim();

  return cleaned || rawTitle.trim();
}

/**
 * Safely fetches HTML head and extracts OpenGraph / meta tags with strict 3-second timeout.
 * Never throws — always returns partial or null metadata on network failure or Cloudflare challenge.
 */
export async function scrapePageMetadata(url: string): Promise<ScrapedMetadata> {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { title: null, rawTitle: null, coverUrl: null, siteName: null, error: 'INVALID_PROTOCOL' };
    }

    if (isPrivateIp(parsed.hostname)) {
      return { title: null, rawTitle: null, coverUrl: null, siteName: null, error: 'SSRF_BLOCKED' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    let currentUrl = url;
    let response: Response | null = null;
    let hops = 0;

    while (hops < 3) {
      const target = new URL(currentUrl);
      if (!['http:', 'https:'].includes(target.protocol)) {
        clearTimeout(timeoutId);
        return { title: null, rawTitle: null, coverUrl: null, siteName: null, error: 'INVALID_PROTOCOL' };
      }
      if (isPrivateIp(target.hostname)) {
        clearTimeout(timeoutId);
        return { title: null, rawTitle: null, coverUrl: null, siteName: null, error: 'SSRF_BLOCKED' };
      }

      const res = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 MangaTracker/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) {
          response = res;
          break;
        }
        currentUrl = new URL(location, currentUrl).toString();
        hops++;
        continue;
      }

      response = res;
      break;
    }

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      return { title: null, rawTitle: null, coverUrl: null, siteName: null, error: `HTTP_${response?.status || 'FAIL'}` };
    }

    // Read first 64KB of HTML to parse head quickly
    const text = await response.text();
    const headSample = text.slice(0, 65536);

    // Extract og:title or twitter:title
    const ogTitleMatch =
      headSample.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      headSample.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i) ||
      headSample.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);

    // Extract <title>
    const titleTagMatch = headSample.match(/<title[^>]*>([^<]+)<\/title>/i);

    // Extract og:image or twitter:image
    const ogImageMatch =
      headSample.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      headSample.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i) ||
      headSample.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);

    // Extract Schema JSON-LD image / thumbnail or Svelte/Nuxt embedded state image
    const schemaImageMatch =
      headSample.match(/["'](?:thumbnailUrl|primaryImageOfPage|image)["']\s*:\s*["'](https?:\/\/[^"']+)["']/i) ||
      headSample.match(/image:\s*["'](https?:\/\/[^"']+)["']/i);

    // Extract og:site_name
    const ogSiteNameMatch = headSample.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);

    let rawTitle = ogTitleMatch ? ogTitleMatch[1] : titleTagMatch ? titleTagMatch[1] : null;
    let coverUrl = ogImageMatch ? ogImageMatch[1] : schemaImageMatch ? schemaImageMatch[1] : null;
    const siteName = ogSiteNameMatch ? ogSiteNameMatch[1] : null;

    // Nekopost-specific cover CDN fallback if not found in HTML meta
    if (!coverUrl && parsed.hostname.includes('nekopost.net')) {
      const nekoMatch = parsed.pathname.match(/\/(?:manga|comic|project)\/(\d+)/i);
      if (nekoMatch && nekoMatch[1]) {
        coverUrl = `https://www.osemocphoto.com/collectManga/${nekoMatch[1]}/${nekoMatch[1]}_mini.jpg`;
      }
    }

    if (rawTitle) {
      // Decode basic HTML entities
      rawTitle = rawTitle
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'");
    }

    if (coverUrl && !coverUrl.startsWith('http')) {
      // Resolve relative image URLs
      try {
        coverUrl = new URL(coverUrl, url).toString();
      } catch {
        coverUrl = null;
      }
    }

    return {
      title: rawTitle ? cleanScrapedTitle(rawTitle) : null,
      rawTitle: rawTitle ?? null,
      coverUrl,
      siteName,
    };
  } catch (err: unknown) {
    const message = (err as Error).message || 'Scrape failed';
    return { title: null, rawTitle: null, coverUrl: null, siteName: null, error: message };
  }
}
