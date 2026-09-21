import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const url = new URL(request.url);
    const archivedOnly = url.searchParams.get('archived') === 'true';

    if (archivedOnly) {
      const archivedList = await DataStore.listArchivedChapters(auth.userId);
      const chapters = archivedList.map((ch: any) => ({
        id: ch.id,
        seriesId: ch.seriesId,
        seriesTitle: ch.seriesTitle,
        seriesCoverUrl: ch.seriesCoverUrl,
        url: ch.url,
        chapterLabel: ch.chapterLabel,
        chapterNumber: ch.chapterNumber,
        archivedAt: ch.archivedAt ? ch.archivedAt.toISOString() : null,
        purgeAt: ch.purgeAt ? ch.purgeAt.toISOString() : null,
        daysRemaining: ch.daysRemaining,
        restoredCount: ch.restoredCount,
        savedAt: ch.savedAt.toISOString(),
      }));

      return NextResponse.json({ chapters });
    }

    return NextResponse.json({ chapters: [] });
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to list chapters';
    return NextResponse.json({ error: { code, message }, message }, { status: err.statusCode || 500 });
  }
}
