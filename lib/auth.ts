import { ResolverError } from './resolver/types';
import { DataStore } from './db/data-store';

export const DEFAULT_USER_ID = process.env.SINGLE_USER_ID || '00000000-0000-0000-0000-000000000001';

export interface AuthContext {
  userId: string;
  tokenId?: string;
  authMethod: 'single_user' | 'api_token' | 'bearer_session';
}

export async function authenticateRequest(request: Request): Promise<AuthContext> {
  // 1. Check API token via query parameter (?k=... or ?token=...)
  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('k') || url.searchParams.get('token');
    if (queryToken) {
      const verified = DataStore.verifyApiToken(queryToken);
      if (verified) {
        return { userId: verified.userId, tokenId: verified.tokenId, authMethod: 'api_token' };
      }
    }
  } catch {
    // Ignore URL parse errors
  }

  // 2. Check Authorization header (Bearer ...)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken) {
      // Check if it's a stored API token
      const verified = DataStore.verifyApiToken(rawToken);
      if (verified) {
        return { userId: verified.userId, tokenId: verified.tokenId, authMethod: 'api_token' };
      }
      // If single_user mode
      const authMode = process.env.AUTH_MODE || 'single_user';
      if (authMode === 'single_user') {
        return { userId: DEFAULT_USER_ID, authMethod: 'single_user' };
      }
    }
  }

  // 3. Fallback to single_user mode if enabled
  const authMode = process.env.AUTH_MODE || 'single_user';
  if (authMode === 'single_user') {
    return { userId: DEFAULT_USER_ID, authMethod: 'single_user' };
  }

  throw new ResolverError('UNAUTHORIZED', 'Valid API token or authentication required', 401);
}

export async function authenticateCronRequest(request: Request): Promise<AuthContext> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { userId: DEFAULT_USER_ID, authMethod: 'bearer_session' };
  }

  return authenticateRequest(request);
}

