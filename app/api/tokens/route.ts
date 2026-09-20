import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const tokens = DataStore.listApiTokens(auth.userId).map((t) => ({
      id: t.id,
      name: t.name,
      lastFour: t.lastFour,
      createdAt: t.createdAt.toISOString(),
      lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    }));

    return NextResponse.json({ tokens });
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to list tokens';
    return NextResponse.json(
      { error: { code, message }, message },
      { status: err.statusCode || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'API Token';

    const { record, rawToken } = DataStore.createApiToken(auth.userId, name);

    return NextResponse.json(
      {
        token: {
          id: record.id,
          name: record.name,
          lastFour: record.lastFour,
          createdAt: record.createdAt.toISOString(),
          rawToken, // Provided once upon creation
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to create token';
    return NextResponse.json(
      { error: { code, message }, message },
      { status: err.statusCode || 500 }
    );
  }
}
