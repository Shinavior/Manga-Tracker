import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const { seriesIds } = body as { seriesIds?: string[] };

    if (!Array.isArray(seriesIds) || seriesIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'seriesIds must be a non-empty array of strings' } },
        { status: 400 }
      );
    }

    let deletedCount = 0;
    for (const id of seriesIds) {
      if (typeof id === 'string') {
        const deleted = await DataStore.deleteSeries(auth.userId, id);
        if (deleted) {
          deletedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: deletedCount,
      totalRequested: seriesIds.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}

// Fallback support for POST
export async function POST(req: NextRequest) {
  return DELETE(req);
}
