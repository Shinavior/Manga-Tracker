import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../../lib/db/data-store';
import { authenticateRequest, DEFAULT_USER_ID } from '../../lib/auth';
import { GET as getTokens, POST as postToken } from '../../app/api/tokens/route';
import { DELETE as deleteToken } from '../../app/api/tokens/[id]/route';
import { extractUrlFromSharePayload } from '../../lib/utils/share';

describe('Phase 3: API Tokens, Auth & Mobile Share Ingestion', () => {
  const userId = DEFAULT_USER_ID;

  beforeEach(() => {
    DataStore.clearAll();
  });

  describe('DataStore API Token Management', () => {
    it('creates an API token with SHA-256 hash and lastFour', () => {
      const { record, rawToken } = DataStore.createApiToken(userId, 'Test Token');
      expect(rawToken).toMatch(/^mgt_/);
      expect(record.id).toBeDefined();
      expect(record.name).toBe('Test Token');
      expect(record.lastFour).toBe(rawToken.slice(-4));
      expect(record.lastUsedAt).toBeNull();
      expect(record.revokedAt).toBeNull();
    });

    it('verifies valid token and updates lastUsedAt', () => {
      const { rawToken, record } = DataStore.createApiToken(userId, 'Mobile App');
      expect(record.lastUsedAt).toBeNull();

      const verification = DataStore.verifyApiToken(rawToken);
      expect(verification).not.toBeNull();
      expect(verification?.userId).toBe(userId);
      expect(verification?.tokenId).toBe(record.id);

      const tokens = DataStore.listApiTokens(userId);
      expect(tokens[0].lastUsedAt).toBeInstanceOf(Date);
    });

    it('rejects invalid or tampered tokens', () => {
      DataStore.createApiToken(userId, 'Key 1');
      expect(DataStore.verifyApiToken('mgt_invalid_token')).toBeNull();
      expect(DataStore.verifyApiToken('')).toBeNull();
    });

    it('revokes an API token so it can no longer be used', () => {
      const { record, rawToken } = DataStore.createApiToken(userId, 'To Revoke');
      expect(DataStore.verifyApiToken(rawToken)).not.toBeNull();

      const revoked = DataStore.revokeApiToken(userId, record.id);
      expect(revoked).toBe(true);

      // Cannot be verified after revocation
      expect(DataStore.verifyApiToken(rawToken)).toBeNull();

      // Does not appear in active tokens list
      const activeTokens = DataStore.listApiTokens(userId);
      expect(activeTokens.find((t) => t.id === record.id)).toBeUndefined();
    });
  });

  describe('API Routes: /api/tokens and /api/tokens/[id]', () => {
    it('creates a token via POST and lists it via GET', async () => {
      // POST /api/tokens
      const postReq = new Request('http://localhost:3000/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'iOS Shortcut' }),
      });
      const postRes = await postToken(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.token.name).toBe('iOS Shortcut');
      expect(postJson.token.rawToken).toMatch(/^mgt_/);

      // GET /api/tokens
      const getReq = new Request('http://localhost:3000/api/tokens', { method: 'GET' });
      const getRes = await getTokens(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.tokens.length).toBe(1);
      expect(getJson.tokens[0].name).toBe('iOS Shortcut');
      expect(getJson.tokens[0].rawToken).toBeUndefined(); // raw token never leaked in list
    });

    it('deletes/revokes a token via DELETE /api/tokens/[id]', async () => {
      const { record } = DataStore.createApiToken(userId, 'Temporary');

      const delReq = new Request(`http://localhost:3000/api/tokens/${record.id}`, { method: 'DELETE' });
      const delRes = await deleteToken(delReq, { params: Promise.resolve({ id: record.id }) });
      expect(delRes.status).toBe(200);
      const delJson = await delRes.json();
      expect(delJson.success).toBe(true);

      // Revoking again returns 404
      const secondDelRes = await deleteToken(delReq, { params: Promise.resolve({ id: record.id }) });
      expect(secondDelRes.status).toBe(404);
    });
  });

  describe('Authentication Context with Tokens', () => {
    it('authenticates using ?k= query parameter with valid token', async () => {
      const { rawToken } = DataStore.createApiToken(userId, 'Bookmarklet');

      const req = new Request(`http://localhost:3000/api/save?k=${encodeURIComponent(rawToken)}`, {
        method: 'POST',
      });
      const auth = await authenticateRequest(req);
      expect(auth.userId).toBe(userId);
      expect(auth.authMethod).toBe('api_token');
    });

    it('authenticates using Bearer token header', async () => {
      const { rawToken } = DataStore.createApiToken(userId, 'Header Token');

      const req = new Request('http://localhost:3000/api/save', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rawToken}` },
      });
      const auth = await authenticateRequest(req);
      expect(auth.userId).toBe(userId);
      expect(auth.authMethod).toBe('api_token');
    });

    it('rejects unauthorized requests in multi_user mode', async () => {
      const origMode = process.env.AUTH_MODE;
      process.env.AUTH_MODE = 'multi_user';

      try {
        const req = new Request('http://localhost:3000/api/save', { method: 'POST' });
        await expect(authenticateRequest(req)).rejects.toThrow();
      } finally {
        process.env.AUTH_MODE = origMode;
      }
    });
  });

  describe('Mobile Share Payload URL Extraction', () => {
    it('extracts URL when clean url param is provided', () => {
      const url = extractUrlFromSharePayload('https://mangadex.org/chapter/123-abc', null, null);
      expect(url).toBe('https://mangadex.org/chapter/123-abc');
    });

    it('extracts URL from messy text param sent by Chrome Android Share Sheet', () => {
      const text = 'Check out Chapter 50: https://mangadex.org/chapter/456-def on MangaDex!';
      const url = extractUrlFromSharePayload(null, text, 'MangaDex Title');
      expect(url).toBe('https://mangadex.org/chapter/456-def');
    });

    it('extracts URL from title param when text and url are empty', () => {
      const title = 'Chapter 1: https://readmanga.today/series/sololeveling/ch1';
      const url = extractUrlFromSharePayload(null, null, title);
      expect(url).toBe('https://readmanga.today/series/sololeveling/ch1');
    });

    it('returns null if no valid URL is found in any param', () => {
      const url = extractUrlFromSharePayload(null, 'Just some text without a link', 'Random Title');
      expect(url).toBeNull();
    });
  });

  describe('CORS and Bookmarklet Endpoint Support', () => {
    it('handles OPTIONS preflight on /api/save with permissive CORS headers', async () => {
      const { OPTIONS: optionsHandler } = await import('../../app/api/save/route');
      const res = await optionsHandler();
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    });
  });
});
