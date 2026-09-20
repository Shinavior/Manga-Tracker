import { FallbackAdapter } from './adapters/fallback';
import { GenericNumericAdapter } from './adapters/generic-numeric';
import { MangaDexAdapter } from './adapters/mangadex';
import { normalizeUrl } from './normalize';
import { ResolveResult, ResolverError, SiteAdapter } from './types';

export * from './types';
export * from './normalize';
export * from './adapters/mangadex';
export * from './adapters/generic-numeric';
export * from './adapters/fallback';

export class ResolverEngine {
  private adapters: SiteAdapter[];
  private fallbackAdapter: FallbackAdapter;

  constructor(customAdapters?: SiteAdapter[]) {
    this.fallbackAdapter = new FallbackAdapter();
    this.adapters = customAdapters || [
      new MangaDexAdapter(),
      new GenericNumericAdapter(),
      this.fallbackAdapter,
    ];
  }

  async resolve(rawUrl: string): Promise<ResolveResult> {
    const normalized = normalizeUrl(rawUrl);

    for (const adapter of this.adapters) {
      if (adapter.match(normalized)) {
        try {
          const result = await adapter.resolve(normalized);
          return result;
        } catch (err) {
          // If it's a known non-retryable validation error or blocked host, rethrow
          if (err instanceof ResolverError) {
            if (err.code === 'INVALID_URL' || err.code === 'BLOCKED_HOST') {
              throw err;
            }
          }
          // If it's the last adapter in the chain, throw or return fallback
          if (adapter === this.adapters[this.adapters.length - 1]) {
            throw err;
          }
          // Otherwise continue to next adapter in chain
        }
      }
    }

    // Default to fallback adapter if somehow none matched
    return this.fallbackAdapter.resolve(normalized);
  }
}

// Global default instance for convenience
const defaultEngine = new ResolverEngine();

export async function resolve(rawUrl: string): Promise<ResolveResult> {
  return defaultEngine.resolve(rawUrl);
}
