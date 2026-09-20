import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    const { id } = await params;

    const series = DataStore.markSeriesRead(auth.userId, id);
    if (!series) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Series not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      series: {
        ...series,
        title: series.customTitle || series.autoTitle || 'Untitled Series',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
