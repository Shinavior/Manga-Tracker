import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    const { id } = await props.params;

    const series = DataStore.findSeriesById(auth.userId, id);
    if (!series) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Series not found' }, message: 'Series not found' },
        { status: 404 }
      );
    }

    const title = series.customTitle || series.autoTitle || '';
    const suggestions = DataStore.getMergeSuggestions(auth.userId, id, title);

    return NextResponse.json({ suggestions });
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to get merge suggestions';
    return NextResponse.json({ error: { code, message }, message }, { status: err.statusCode || 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    const { id: targetSeriesId } = await props.params;
    const body = await request.json().catch(() => ({}));

    const sourceSeriesId = body.sourceSeriesId || body.targetSeriesId;
    if (!sourceSeriesId || typeof sourceSeriesId !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'sourceSeriesId is required' }, message: 'sourceSeriesId is required' },
        { status: 400 }
      );
    }

    const result = DataStore.mergeSeries(auth.userId, targetSeriesId, sourceSeriesId);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'MERGE_FAILED', message: result.message || 'Merge failed' }, message: result.message || 'Merge failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Series merged successfully',
      series: result.targetSeries,
    });
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to merge series';
    return NextResponse.json({ error: { code, message }, message }, { status: err.statusCode || 500 });
  }
}
