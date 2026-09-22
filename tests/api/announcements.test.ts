import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GET as getAnnouncements,
  POST as postAnnouncement,
  DELETE as deleteAnnouncement,
} from '../../app/api/announcements/route';
import { GET as checkAdminAuth } from '../../app/api/announcements/auth-check/route';
import { memoryAnnouncementStore } from '../../lib/db/announcement-store';

describe('Announcements API (/api/announcements)', () => {
  const originalAuthMode = process.env.AUTH_MODE;
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    process.env.AUTH_MODE = 'single_user';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    memoryAnnouncementStore.length = 0;
  });

  afterEach(() => {
    process.env.AUTH_MODE = originalAuthMode;
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it('GET returns announcements list successfully', async () => {
    const res = await getAnnouncements();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.announcements)).toBe(true);
  });

  it('POST creates an announcement in admin mode', async () => {
    const payload = {
      title: 'New Feature: Custom Tags',
      content: 'You can now categorize manga series using custom tags.',
      category: 'feature',
      isPinned: true,
      linkUrl: 'https://demo-tracker.example.com/tags',
    };

    const req = new Request('http://localhost:3000/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await postAnnouncement(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.announcement).toBeDefined();
    expect(json.announcement.title).toBe(payload.title);
    expect(json.announcement.isPinned).toBe(true);

    // Verify it appears in GET
    const getRes = await getAnnouncements();
    const getJson = await getRes.json();
    expect(getJson.announcements.length).toBe(1);
    expect(getJson.announcements[0].title).toBe(payload.title);
  });

  it('POST rejects invalid input', async () => {
    const req = new Request('http://localhost:3000/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });

    const res = await postAnnouncement(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('POST blocks non-admin users in multi_user mode', async () => {
    process.env.AUTH_MODE = 'multi_user';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const req = new Request('http://localhost:3000/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hacked Announcement',
        content: 'Should not be allowed',
      }),
    });

    const res = await postAnnouncement(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Forbidden');
  });

  it('DELETE deletes an announcement when authenticated as admin', async () => {
    // First create one
    const createReq = new Request('http://localhost:3000/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'To Be Deleted',
        content: 'Temporary content',
      }),
    });
    const createRes = await postAnnouncement(createReq);
    const createJson = await createRes.json();
    const id = createJson.announcement.id;

    // Delete it
    const deleteReq = new Request(`http://localhost:3000/api/announcements?id=${id}`, {
      method: 'DELETE',
    });
    const deleteRes = await deleteAnnouncement(deleteReq);
    expect(deleteRes.status).toBe(200);

    const deleteJson = await deleteRes.json();
    expect(deleteJson.success).toBe(true);

    // Verify it is gone
    const getRes = await getAnnouncements();
    const getJson = await getRes.json();
    expect(getJson.announcements.some((a: any) => a.id === id)).toBe(false);
  });

  it('DELETE blocks non-admin users in multi_user mode', async () => {
    process.env.AUTH_MODE = 'multi_user';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const deleteReq = new Request('http://localhost:3000/api/announcements?id=some-id', {
      method: 'DELETE',
    });
    const deleteRes = await deleteAnnouncement(deleteReq);
    expect(deleteRes.status).toBe(403);
  });

  it('GET /api/announcements/auth-check returns admin boolean', async () => {
    const req = new Request('http://localhost:3000/api/announcements/auth-check');
    const res = await checkAdminAuth(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.isAdmin).toBe('boolean');
  });
});
