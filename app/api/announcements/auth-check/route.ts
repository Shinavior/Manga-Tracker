import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';

export async function GET(request: Request) {
  try {
    const isAdmin = await verifyAdmin(request);
    return NextResponse.json({ success: true, isAdmin });
  } catch {
    return NextResponse.json({ success: true, isAdmin: false });
  }
}
