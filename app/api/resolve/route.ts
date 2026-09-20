import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { resolve } from '@/lib/resolver';
import { ResolverError } from '@/lib/resolver/types';

export async function POST(req: NextRequest) {
  try {
    await authenticateRequest(req);
    const body = await req.json();

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_URL', message: 'URL field is required' } },
        { status: 400 }
      );
    }

    const result = await resolve(body.url);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    if (err instanceof ResolverError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: { code: 'RESOLVE_FAILED', message: (err as Error).message || 'Failed to resolve URL' } },
      { status: 500 }
    );
  }
}
