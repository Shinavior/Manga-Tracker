import { beforeEach, describe, expect, it } from 'vitest';
import { DataStore } from '@/lib/db/data-store';
import { resolve } from '@/lib/resolver';

describe('Phase 1 MVP: DataStore Save & Auto-Replace Transactions', () => {
  const USER_ID = 'test-user-123';

  beforeEach(() => {
    DataStore.clearAll();
  });

  it('saves Ch. 1 then Ch. 2 resulting in exactly 1 series entry with Ch. 2 current and Ch. 1 archived', async () => {
    // 1. Save Nekopost Ch. 1
    const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
    const save1 = await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res1,
      tags: ['fantasy'],
    });

    expect(save1.action).toBe('created');
    expect(save1.chapter.number).toBe(1);
    expect(save1.archivedChapter).toBeUndefined();

    // Verify 1 series in database
    const list1 = DataStore.listSeries(USER_ID);
    expect(list1.total).toBe(1);
    expect(list1.items[0].currentChapter?.chapterNumber).toBe(1);

    // 2. Save Nekopost Ch. 2 of the same series
    const res2 = await resolve('https://www.nekopost.net/manga/17045/2');
    const save2 = await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res2,
    });

    expect(save2.action).toBe('updated');
    expect(save2.chapter.number).toBe(2);
    expect(save2.archivedChapter).toBeDefined();
    expect(save2.archivedChapter?.label).toBe('Ch. 1');

    // Verify STILL EXACTLY 1 series row in library, now pointing to Ch. 2
    const list2 = DataStore.listSeries(USER_ID);
    expect(list2.total).toBe(1);
    expect(list2.items[0].currentChapter?.chapterNumber).toBe(2);
    expect(list2.items[0].tags).toEqual(['fantasy']); // tags preserved

    // Check chapters table has 2 rows (1 current, 1 archived)
    const chapters = DataStore.getChaptersForSeries(list2.items[0].id);
    expect(chapters.length).toBe(2);
    const current = chapters.find((c) => c.isCurrent);
    const archived = chapters.find((c) => !c.isCurrent);
    expect(current?.chapterNumber).toBe(2);
    expect(archived?.chapterNumber).toBe(1);
    expect(archived?.archivedAt).not.toBeNull();
    expect(archived?.purgeAt).not.toBeNull();
  });

  it('returns action: noop when re-saving identical chapter URL', async () => {
    const res = await resolve('https://www.nekopost.net/manga/17045/1');
    await DataStore.saveChapter({ userId: USER_ID, resolveResult: res });

    const duplicateSave = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res });
    expect(duplicateSave.action).toBe('noop');
  });

  it('detects backward chapter jump and sets wentBackward: true', async () => {
    const res10 = await resolve('https://site.com/manga/series/chapter-10');
    await DataStore.saveChapter({ userId: USER_ID, resolveResult: res10 });

    const res5 = await resolve('https://site.com/manga/series/chapter-5');
    const save5 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res5 });

    expect(save5.wentBackward).toBe(true);
    expect(save5.chapter.number).toBe(5);
  });

  it('auto-transitions read / waiting status back to unread upon saving a new chapter', async () => {
    const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
    const save1 = await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res1,
      statusOverride: 'read',
    });

    expect(save1.series.status).toBe('read');

    // Save Ch. 2 -> status should revert to unread
    const res2 = await resolve('https://www.nekopost.net/manga/17045/2');
    const save2 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res2 });

    expect(save2.series.status).toBe('unread');
  });

  it('preserves reading status when saving a new chapter while reading', async () => {
    const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
    await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res1,
      statusOverride: 'reading',
    });

    const res2 = await resolve('https://www.nekopost.net/manga/17045/2');
    const save2 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res2 });

    expect(save2.series.status).toBe('reading');
  });

  it('reverses a chapter save with Undo token', async () => {
    // Save Ch. 1
    const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
    await DataStore.saveChapter({ userId: USER_ID, resolveResult: res1 });

    // Save Ch. 2
    const res2 = await resolve('https://www.nekopost.net/manga/17045/2');
    const save2 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res2 });

    // Undo save 2
    expect(save2.undoToken).toBeDefined();
    const undoRes = DataStore.undo(USER_ID, save2.undoToken!);
    expect(undoRes.success).toBe(true);

    // Verify series is back to Ch. 1 as current
    const series = DataStore.listSeries(USER_ID).items[0];
    expect(series.currentChapter?.chapterNumber).toBe(1);
    expect(series.currentChapter?.isCurrent).toBe(true);
    expect(series.currentChapter?.archivedAt).toBeNull();

    // Verify Ch. 2 was completely deleted
    const allChapters = DataStore.getChaptersForSeries(series.id);
    expect(allChapters.length).toBe(1);
    expect(allChapters[0].chapterNumber).toBe(1);
  });

  it('supports custom title rename overriding auto title', async () => {
    const res = await resolve('https://www.nekopost.net/manga/17045/1');
    const save = await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res,
      customTitle: 'My Favorite Isekai',
    });

    expect(save.series.title).toBe('My Favorite Isekai');

    const updated = DataStore.updateSeries(USER_ID, save.series.id, {
      customTitle: 'Updated Isekai Title',
    });
    expect(updated?.customTitle).toBe('Updated Isekai Title');
  });

  it('searches series by #tag correctly', async () => {
    const res = await resolve('https://www.nekopost.net/manga/17045/1');
    await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res,
      tags: ['action', 'isekai'],
    });

    const searchWithHash = DataStore.listSeries(USER_ID, { q: '#action' });
    expect(searchWithHash.total).toBe(1);

    const searchWithoutHash = DataStore.listSeries(USER_ID, { q: 'isekai' });
    expect(searchWithoutHash.total).toBe(1);

    const searchNotFound = DataStore.listSeries(USER_ID, { q: '#romance' });
    expect(searchNotFound.total).toBe(0);
  });

  it('reactivates previously archived chapter without creating duplicate chapter rows', async () => {
    // 1. Save Ch. 1
    const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
    await DataStore.saveChapter({ userId: USER_ID, resolveResult: res1 });

    // 2. Save Ch. 2
    const res2 = await resolve('https://www.nekopost.net/manga/17045/2');
    await DataStore.saveChapter({ userId: USER_ID, resolveResult: res2 });

    // 3. Save Ch. 1 again (reactivate)
    await DataStore.saveChapter({ userId: USER_ID, resolveResult: res1 });

    const series = DataStore.listSeries(USER_ID).items[0];
    const chapters = DataStore.getChaptersForSeries(series.id);

    // There should still be EXACTLY 2 chapter records in total, not 3!
    expect(chapters.length).toBe(2);
    expect(series.currentChapter?.chapterNumber).toBe(1);
    expect(series.currentChapter?.isCurrent).toBe(true);
  });

  it('restores previous status losslessly upon undo', async () => {
    const res1 = await resolve('https://www.nekopost.net/manga/17045/1');
    await DataStore.saveChapter({
      userId: USER_ID,
      resolveResult: res1,
      statusOverride: 'read',
    });

    // Save Ch. 2 (automatically switches status to unread)
    const res2 = await resolve('https://www.nekopost.net/manga/17045/2');
    const save2 = await DataStore.saveChapter({ userId: USER_ID, resolveResult: res2 });
    expect(save2.series.status).toBe('unread');

    // Undo save 2 -> status should revert to 'read'
    DataStore.undo(USER_ID, save2.undoToken!);
    const series = DataStore.listSeries(USER_ID).items[0];
    expect(series.status).toBe('read');
  });
});
