import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    const { id } = await props.params;

    const success = await DataStore.revokeApiToken(auth.userId, id);
    if (!success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Token not found or already revoked' }, message: 'Token not found or already revoked' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    const err = error as { code?: string; message?: string; statusCode?: number };
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Failed to revoke token';
    return NextResponse.json(
      { error: { code, message }, message },
      { status: err.statusCode || 500 }
    );
  }
}
