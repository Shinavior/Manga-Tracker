import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataStore } from '../../lib/db/data-store';
import { DEFAULT_USER_ID } from '../../lib/auth';
import { GET as getAdminStats } from '../../app/api/admin/stats/route';
import { addMemoryFeedback, memoryFeedbackStore } from '../../lib/db/feedback-store';

describe('Admin Stats & Overview API (/api/admin/stats)', () => {
  const originalAuthMode = process.env.AUTH_MODE;
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    DataStore.clearAll();
    memoryFeedbackStore.length = 0;
    process.env.AUTH_MODE = 'single_user';
    process.env.ADMIN_EMAIL = 'admin@example.com';
  });

  afterEach(() => {
    process.env.AUTH_MODE = originalAuthMode;
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it('returns valid admin statistics structure in single-user mode', async () => {
    // Add sample manga
    await DataStore.saveChapter({
      userId: DEFAULT_USER_ID,
      resolveResult: {
        seriesTitle: 'One Piece',
        chapterLabel: '1000',
        chapterNumber: 1000,
        source: 'mangadex',
        seriesKey: 'mangadex:op',
        chapterUrl: 'https://mangadex.org/chapter/1111-2222/1',
        confidence: 'high',
      },
    });

    // Add sample feedback
    addMemoryFeedback({
      userId: DEFAULT_USER_ID,
      type: 'bug',
      message: 'Test bug report',
      pageContext: '/library',
      appVersion: '0.1.0',
      userAgent: 'Vitest Agent',
      screenshotUrl: null,
      status: 'open',
    });

    const request = new Request('http://localhost:3000/api/admin/stats');
    const response = await getAdminStats(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.metrics).toBeDefined();
    expect(json.metrics.totalSeries).toBeGreaterThanOrEqual(1);
    expect(json.metrics.totalChapters).toBeGreaterThanOrEqual(1);
    expect(json.metrics.totalFeedback).toBe(1);
    expect(json.metrics.openFeedback).toBe(1);

    expect(json.statusBreakdown).toBeDefined();
    expect(json.sourceBreakdown).toBeDefined();
    expect(json.recentSeries).toBeDefined();
    expect(json.recentSeries.length).toBeGreaterThanOrEqual(1);
    expect(json.recentSeries[0].title).toBe('One Piece');
  });

  it('blocks unauthorized access in multi-user mode', async () => {
    process.env.AUTH_MODE = 'multi_user';
    process.env.ADMIN_EMAIL = 'superadmin@example.com';

    // Request without credentials or with non-admin session
    const request = new Request('http://localhost:3000/api/admin/stats');
    const response = await getAdminStats(request);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Unauthorized: Admin access required');
  });
});
