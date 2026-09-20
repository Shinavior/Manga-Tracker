import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';
import { MangaDexAdapter } from '@/lib/resolver/adapters/mangadex';
import { GenericNumericAdapter } from '@/lib/resolver/adapters/generic-numeric';

const mangadexAdapter = new MangaDexAdapter();
const genericAdapter = new GenericNumericAdapter();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    const { id } = await params;

    const series = DataStore.findSeriesById(auth.userId, id);
    if (!series) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Series not found' } },
        { status: 404 }
      );
    }

    // Check if next chapter URL is already cached
    if (series.nextChapterUrl) {
      return NextResponse.json({
        url: series.nextChapterUrl,
        verified: true,
      });
    }

    const currentChapter = DataStore.getCurrentChapter(series.id);
    const currentChapterNumber = currentChapter?.chapterNumber ?? undefined;

    let nextUrl: string | null = null;

    if (series.source === 'mangadex') {
      nextUrl = await mangadexAdapter.nextChapterUrl({
        seriesKey: series.seriesKey,
        currentUrl: currentChapter?.url || '',
        currentChapterNumber,
        language: series.language || 'en',
      });
    } else if (series.urlPattern) {
      nextUrl = await genericAdapter.nextChapterUrl({
        seriesKey: series.seriesKey,
        currentUrl: currentChapter?.url || '',
        currentChapterNumber,
        urlPattern: series.urlPattern,
      });
    }

    if (nextUrl) {
      // Cache next_chapter_url in series record
      series.nextChapterUrl = nextUrl;
      series.hasUpdate = true;

      return NextResponse.json({
        url: nextUrl,
        verified: true,
        chapterNumber: currentChapterNumber !== undefined ? currentChapterNumber + 1 : undefined,
      });
    }

    return NextResponse.json({
      url: null,
      reason: 'not_found',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
