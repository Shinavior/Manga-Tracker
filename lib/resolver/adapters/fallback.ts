import { ResolveResult, SiteAdapter } from '../types';

export interface FallbackOptions {
  fetchTimeoutMs?: number;
  maxFetchBytes?: number;
  maxBytes?: number;
}

function cleanTitle(title: string): string {
  let cleaned = title.trim();
  // Strip common site suffixes only when preceded by keywords or chapter indicators
  // e.g. " - Read Manga Online", " | อ่านมังงะ...", " - Chapter 123", " | Ch. 45"
  cleaned = cleaned.replace(/\s*[-–|]\s*(?:read|อ่าน|manga|raw|online|chapter|chap|ch|ตอนที่|\d+).*$/i, '').trim();
  // Strip trailing standalone chapter number mentions e.g. "Chapter 1050", "Ch. 10.5", "ตอนที่ 5"
  cleaned = cleaned.replace(/\b(?:chapter|chap|ch|ตอนที่)\s*\d+(?:\.\d+)?\b/gi, '').trim();
  return cleaned || 'Untitled Series';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'series';
}

async function simpleSha256Short(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
  // Fallback simple hash for non-subtle crypto environments
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export class FallbackAdapter implements SiteAdapter {
  name = 'fallback';
  private timeoutMs: number;
  private maxBytes: number;

  constructor(options: FallbackOptions = {}) {
    this.timeoutMs = options.fetchTimeoutMs ?? 8000;
    this.maxBytes = options.maxFetchBytes ?? options.maxBytes ?? 1048576; // 1MB
  }

  match(_url: URL): boolean {
    return true;
  }

  async resolve(url: URL): Promise<ResolveResult> {
    const hostname = url.hostname;
    const urlStr = url.toString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(urlStr, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MangaTracker/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const html = await res.text();
      const truncatedHtml = html.slice(0, this.maxBytes);

      // Extract metadata via regex (lightweight without heavy DOM deps)
      const ogTitleMatch = truncatedHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                           truncatedHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const titleTagMatch = truncatedHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const h1Match = truncatedHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const ogImageMatch = truncatedHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                           truncatedHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      const rawTitle = ogTitleMatch?.[1] || titleTagMatch?.[1] || h1Match?.[1];
      const coverUrl = ogImageMatch?.[1];

      if (rawTitle) {
        const title = cleanTitle(rawTitle);
        const slug = slugify(title);
        return {
          seriesKey: `fallback:${hostname}:${slug}`,
          source: 'fallback',
          seriesTitle: title,
          coverUrl,
          chapterLabel: 'Current Chapter',
          chapterUrl: urlStr,
          confidence: 'low',
        };
      }
    } catch {
      // Graceful failure (Cloudflare, network down, timeout, etc.)
    }

    // Fallback when metadata fetch fails
    const hash = await simpleSha256Short(urlStr);
    return {
      seriesKey: `manual:${hostname}:${hash}`,
      source: 'fallback',
      seriesTitle: undefined,
      chapterLabel: 'Unknown',
      chapterUrl: urlStr,
      confidence: 'low',
      requiresManualTitle: true,
    };
  }
}
