import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);

    const statusParam = searchParams.get('status');
    const tagParam = searchParams.get('tag');
    const q = searchParams.get('q') || undefined;
    const sort = (searchParams.get('sort') as 'updated' | 'title' | 'chapter' | 'created') || 'updated';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const status = statusParam ? statusParam.split(',').map((s) => s.trim()) : undefined;
    const tag = tagParam ? tagParam.split(',').map((t) => t.trim()) : undefined;

    const { items, total } = DataStore.listSeries(auth.userId, {
      status,
      tag,
      q,
      sort,
      order,
      limit,
      offset,
    });

    const formattedItems = items.map((s) => ({
      id: s.id,
      title: s.customTitle || s.autoTitle || 'Untitled Series',
      customTitle: s.customTitle,
      autoTitle: s.autoTitle,
      coverUrl: s.coverUrl,
      status: s.status,
      tags: s.tags,
      seriesKey: s.seriesKey,
      source: s.source,
      currentChapter: s.currentChapter
        ? {
            id: s.currentChapter.id,
            label: s.currentChapter.chapterLabel,
            url: s.currentChapter.url,
            number: s.currentChapter.chapterNumber,
            savedAt: s.currentChapter.savedAt.toISOString(),
          }
        : null,
      nextChapterUrl: s.nextChapterUrl,
      hasUpdate: s.hasUpdate,
      needsReview: s.needsReview,
      lastReadAt: s.lastReadAt?.toISOString() || null,
      updatedAt: s.updatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({
      items: formattedItems,
      total,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message || 'Failed to fetch series' } },
      { status: 500 }
    );
  }
}
