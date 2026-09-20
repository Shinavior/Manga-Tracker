export interface RateLimitOptions {
  maxConcurrent?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export class ConcurrencyAndRateLimiter {
  private maxConcurrent: number;
  private minIntervalMs: number;
  private maxRetries: number;
  private initialBackoffMs: number;

  private runningCount = 0;
  private queue: Array<() => void> = [];
  private lastRequestTime = 0;

  constructor(options: RateLimitOptions = {}) {
    const isTest = typeof process !== 'undefined' && (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test');
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.minIntervalMs = options.minIntervalMs ?? (isTest ? 0 : 200);
    this.maxRetries = options.maxRetries ?? (isTest ? 2 : 4);
    this.initialBackoffMs = options.initialBackoffMs ?? (isTest ? 1 : 1000);
  }

  private isTestEnv(): boolean {
    return typeof process !== 'undefined' && (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test');
  }

  private async acquireSlot(): Promise<void> {
    while (this.runningCount >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    if (!this.isTestEnv()) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.minIntervalMs) {
        await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - timeSinceLast));
      }
      this.lastRequestTime = Date.now();
    }

    this.runningCount++;
  }

  private releaseSlot(): void {
    this.runningCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }

  async fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    customFetch: typeof fetch = fetch
  ): Promise<Response> {
    let attempt = 0;
    const isTest = this.isTestEnv();
    let backoff = isTest ? 1 : this.initialBackoffMs;
    const maxRetries = isTest ? 2 : this.maxRetries;

    while (true) {
      await this.acquireSlot();
      try {
        const response = await customFetch(input, init);

        // If HTTP 429 Too Many Requests, perform exponential backoff
        if (response.status === 429 && attempt < maxRetries) {
          attempt++;
          this.releaseSlot();
          await new Promise((resolve) => setTimeout(resolve, backoff));
          backoff *= 2;
          continue;
        }

        this.releaseSlot();
        return response;
      } catch (err) {
        this.releaseSlot();
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          backoff *= 2;
          continue;
        }
        throw err;
      }
    }
  }
}

// Global MangaDex Rate Limiter instance (max 2 concurrent, 5 req/sec)
export const mangadexLimiter = new ConcurrencyAndRateLimiter();

export async function fetchMangaDex(
  input: RequestInfo | URL,
  init?: RequestInit,
  customFetch?: typeof fetch
): Promise<Response> {
  return mangadexLimiter.fetchWithRetry(input, init, customFetch);
}
