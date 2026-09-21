import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

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
    const chapters = await DataStore.getChaptersForSeries(series.id);

    return NextResponse.json({
      series: {
        ...series,
        title: series.customTitle || series.autoTitle || 'Untitled Series',
      },
      currentChapter,
      chapters,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    const { id } = await params;
    const body = await req.json();

    const updated = await DataStore.updateSeries(auth.userId, id, {
      customTitle: body.title,
      status: body.status,
      tags: body.tags,
      coverUrl: body.coverUrl,
    });

    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Series not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      series: {
        ...updated,
        title: updated.customTitle || updated.autoTitle || 'Untitled Series',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    const { id } = await params;

    const deleted = await DataStore.deleteSeries(auth.userId, id);
    if (!deleted) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Series not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
