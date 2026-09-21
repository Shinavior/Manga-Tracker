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

    const series = await DataStore.findSeriesById(auth.userId, id);
    if (!series) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Series not found' } },
        { status: 404 }
      );
    }

    const currentChapter = await DataStore.getCurrentChapter(series.id);
    const currentChapterNumber = currentChapter?.chapterNumber ?? undefined;

    // Check if next chapter URL is already cached and not stale.
    //
    // The staleness check must be done in URL-space, not chapter-number space,
    // because on ID-based sites (e.g. mangastep.com) the number in the URL is
    // an internal ID that doesn't match the chapter number.  For example:
    //   currentChapter.url = "/slug-198/" (= Ch. 181)
    //   nextChapterUrl     = "/slug-198/"  ← stale! same URL as current
    //
    // Strategy:
    //   1. Extract trailing number from nextChapterUrl  → nextUrlNum
    //   2. Extract trailing number from currentChapter.url → curUrlNum
    //   3. If nextUrlNum <= curUrlNum → stale (URL-space comparison)
    //   4. Also fall back to chapter-number comparison for chapter-number sites
    if (series.nextChapterUrl) {
      const extractTrailingNum = (s: string): number | null => {
        const m = s.match(/(?:-|_|\/)(?:ตอนที่|ตอน|บทที่|chapter|ch|ep)?-?(\d+(?:\.\d+)?)(?:\/)?$/i);
        return m ? parseFloat(m[1]) : null;
      };

      const nextUrlNum = extractTrailingNum(series.nextChapterUrl);
      const curUrlNum  = currentChapter?.url ? extractTrailingNum(currentChapter.url) : null;

      let isStale = false;

      if (nextUrlNum !== null && curUrlNum !== null && nextUrlNum <= curUrlNum) {
        // URL-space stale: the cached "next" URL is the same as (or behind) current URL
        isStale = true;
      } else if (
        nextUrlNum !== null &&
        currentChapterNumber !== undefined &&
        nextUrlNum <= currentChapterNumber
      ) {
        // Chapter-number stale (chapter-number-based sites where URL == chapter num)
        isStale = true;
      }

      if (!isStale) {
        return NextResponse.json({
          url: series.nextChapterUrl,
          verified: true,
        });
      }

      // Stale cache: invalidate
      series.nextChapterUrl = null;
      series.hasUpdate = false;
    }

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

    // No next chapter found
    series.nextChapterUrl = null;
    series.hasUpdate = false;
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
