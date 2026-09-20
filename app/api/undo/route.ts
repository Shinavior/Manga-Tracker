import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json();

    if (!body.token || typeof body.token !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Token field is required' } },
        { status: 400 }
      );
    }

    const res = DataStore.undo(auth.userId, body.token);
    if (!res.success) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: res.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: res.message });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
