import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    const { id } = await props.params;

    const result = DataStore.restoreChapter(auth.userId, id);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: result.message || 'Failed to restore chapter' }, message: result.message || 'Failed to restore chapter' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Chapter restored to active',
      series: result.series,
      chapter: result.chapter,
    });
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to restore chapter';
    return NextResponse.json({ error: { code, message }, message }, { status: err.statusCode || 500 });
  }
}
