import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { resolve } from '@/lib/resolver';
import { ResolverError } from '@/lib/resolver/types';
import { DataStore } from '@/lib/db/data-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_URL', message: 'URL field is required' }, message: 'URL field is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Resolve URL through adapter pipeline
    const resolveResult = await resolve(body.url);

    // 2. Perform Save Transaction in DataStore
    const saveResult = await DataStore.saveChapter({
      userId: auth.userId,
      resolveResult,
      customTitle: body.title,
      tags: body.tags,
      statusOverride: body.status,
    });

    return NextResponse.json(saveResult, { status: 200, headers: corsHeaders });
  } catch (err: unknown) {
    if (err instanceof ResolverError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message }, message: err.message },
        { status: err.statusCode, headers: corsHeaders }
      );
    }
    const msg = (err as Error).message || 'Save operation failed';
    return NextResponse.json(
      { error: { code: 'RESOLVE_FAILED', message: msg }, message: msg },
      { status: 500, headers: corsHeaders }
    );
  }
}

