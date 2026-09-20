import { NextRequest, NextResponse } from 'next/server';
import { authenticateCronRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function POST(req: NextRequest) {
  try {
    await authenticateCronRequest(req);
    const result = DataStore.purgeExpiredChapters();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && typeof (err as any).statusCode === 'number') {
      const msg = err instanceof Error ? err.message : String((err as any).message || 'Unauthorized');
      return NextResponse.json(
        { error: { code: (err as any).code || 'UNAUTHORIZED', message: msg } },
        { status: (err as any).statusCode }
      );
    }
    const internalMsg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: internalMsg } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
