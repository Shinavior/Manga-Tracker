export type Confidence = 'high' | 'medium' | 'low';

export interface ResolveResult {
  seriesKey: string;          // Stable unique identifier for the series
  source: 'mangadex' | 'generic' | 'fallback' | 'manual' | string;
  seriesTitle?: string;
  coverUrl?: string;
  chapterNumber?: number;     // Numeric, supports decimals (e.g. 10.5)
  chapterLabel: string;       // Human display, e.g. "Ch. 10.5", "Extra 1"
  chapterUrl: string;         // Normalized canonical URL
  language?: string;          // ISO code, if known
  confidence: Confidence;
  urlPattern?: string;        // e.g. "nekopost.net/manga/17045/{ch}"
  meta?: Record<string, unknown>;
  requiresManualTitle?: boolean;
}

export interface NextChapterContext {
  seriesKey: string;
  currentUrl: string;
  currentChapterNumber?: number;
  urlPattern?: string;
  language?: string;
  meta?: Record<string, unknown>;
}

export interface SiteAdapter {
  name: string;
  /** Cheap synchronous check — does this adapter handle this URL? */
  match(url: URL): boolean;
  /** Resolve the URL into series + chapter info. May perform network I/O. */
  resolve(url: URL): Promise<ResolveResult>;
  /** Optionally compute the next chapter URL. */
  nextChapterUrl?(ctx: NextChapterContext): Promise<string | null>;
}

export type ResolverErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_HOST'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'RESOLVE_FAILED'
  | 'UPSTREAM_ERROR'
  | 'CONFLICT'
  | 'VALIDATION_ERROR';

export class ResolverError extends Error {
  code: ResolverErrorCode;
  statusCode: number;

  constructor(code: ResolverErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = 'ResolverError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
