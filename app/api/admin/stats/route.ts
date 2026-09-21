import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { db, users, series, chapters, seriesLinks, feedback } from '@/lib/db/client';
import { eq, desc, sql } from 'drizzle-orm';
import { memoryFeedbackStore } from '@/lib/db/feedback-store';
import { SeriesRecord, ChapterRecord } from '@/lib/db/types';

export async function GET(request: Request) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin access required' },
      { status: 403 }
    );
  }

  try {
    if (db) {
      // 1. PostgreSQL DB mode
      const [usersCountRow] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [seriesCountRow] = await db.select({ count: sql<number>`count(*)` }).from(series);
      const [chaptersCountRow] = await db.select({ count: sql<number>`count(*)` }).from(chapters);
      const [feedbackCountRow] = await db.select({ count: sql<number>`count(*)` }).from(feedback);
      const [openFeedbackCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedback)
        .where(eq(feedback.status, 'open'));

      const statusRows = await db
        .select({
          status: series.status,
          count: sql<number>`count(*)`,
        })
        .from(series)
        .groupBy(series.status);

      const sourceRows = await db
        .select({
          source: series.source,
          count: sql<number>`count(*)`,
        })
        .from(series)
        .groupBy(series.source);

      const hostRows = await db
        .select({
          host: seriesLinks.host,
          count: sql<number>`count(*)`,
        })
        .from(seriesLinks)
        .groupBy(seriesLinks.host)
        .orderBy(desc(sql<number>`count(*)`))
        .limit(6);

      const recentRows = await db
        .select({
          id: series.id,
          autoTitle: series.autoTitle,
          customTitle: series.customTitle,
          source: series.source,
          status: series.status,
          updatedAt: series.updatedAt,
        })
        .from(series)
        .orderBy(desc(series.updatedAt))
        .limit(6);

      const statusBreakdown: Record<string, number> = {
        reading: 0,
        unread: 0,
        read: 0,
        paused: 0,
        dropped: 0,
      };
      statusRows.forEach((r) => {
        if (r.status) statusBreakdown[r.status] = Number(r.count);
      });

      const sourceBreakdown: Record<string, number> = {};
      sourceRows.forEach((r) => {
        if (r.source) sourceBreakdown[r.source] = Number(r.count);
      });

      const topHosts = hostRows.map((r) => ({
        host: r.host,
        count: Number(r.count),
      }));

      const recentSeries = recentRows.map((r) => ({
        id: r.id,
        title: r.customTitle || r.autoTitle || 'Untitled Series',
        source: r.source,
        status: r.status,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      }));

      return NextResponse.json({
        success: true,
        metrics: {
          totalUsers: Number(usersCountRow?.count || 0),
          totalSeries: Number(seriesCountRow?.count || 0),
          totalChapters: Number(chaptersCountRow?.count || 0),
          totalFeedback: Number(feedbackCountRow?.count || 0),
          openFeedback: Number(openFeedbackCountRow?.count || 0),
        },
        statusBreakdown,
        sourceBreakdown,
        topHosts,
        recentSeries,
      });
    }

    // 2. In-memory dev/fallback mode
    const globalStore = globalThis as unknown as {
      __mangaSeries?: Map<string, SeriesRecord>;
      __mangaChapters?: Map<string, ChapterRecord>;
    };

    const seriesList = Array.from(globalStore.__mangaSeries?.values() || []);
    const chaptersList = Array.from(globalStore.__mangaChapters?.values() || []);
    const userIds = new Set(seriesList.map((s) => s.userId).filter(Boolean));

    const statusBreakdown: Record<string, number> = {
      reading: 0,
      unread: 0,
      read: 0,
      paused: 0,
      dropped: 0,
    };
    const sourceBreakdown: Record<string, number> = {};

    seriesList.forEach((s) => {
      const st = s.status || 'unread';
      statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
      const src = s.source || 'generic';
      sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
    });

    const openFeedback = memoryFeedbackStore.filter((f) => f.status === 'open').length;

    const recentSeries = [...seriesList]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6)
      .map((s) => ({
        id: s.id,
        title: s.customTitle || s.autoTitle || 'Untitled Series',
        source: s.source,
        status: s.status,
        updatedAt: new Date(s.updatedAt).toISOString(),
      }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalUsers: Math.max(userIds.size, 1),
        totalSeries: seriesList.length,
        totalChapters: chaptersList.length,
        totalFeedback: memoryFeedbackStore.length,
        openFeedback,
      },
      statusBreakdown,
      sourceBreakdown,
      topHosts: Object.entries(sourceBreakdown).map(([host, count]) => ({ host, count })),
      recentSeries,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
