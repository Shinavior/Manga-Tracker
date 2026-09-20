import { ResolveResult, SiteAdapter } from '../types';
import { scrapePageMetadata } from '../metadata';

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

  match(_url: URL): boolean {
    return true;
  }

  async resolve(url: URL): Promise<ResolveResult> {
    const hostname = url.hostname;
    const urlStr = url.toString();

    const meta = await scrapePageMetadata(urlStr);

    if (meta.title) {
      const slug = slugify(meta.title);
      return {
        seriesKey: `fallback:${hostname}:${slug}`,
        source: 'fallback',
        seriesTitle: meta.title,
        coverUrl: meta.coverUrl || undefined,
        chapterLabel: 'Current Chapter',
        chapterUrl: urlStr,
        confidence: 'low',
      };
    }

    // Fallback when metadata fetch fails or SSRF blocked
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
