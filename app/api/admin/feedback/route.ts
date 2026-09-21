import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db, feedback } from '@/lib/db/client';
import { eq, desc } from 'drizzle-orm';
import { memoryFeedbackStore, FeedbackRecord } from '@/lib/db/feedback-store';

async function verifyAdmin(request: Request) {
  const adminEmail = process.env.ADMIN_EMAIL;
  try {
    const auth = await authenticateRequest(request);
    // In multi_user mode, verify email matches ADMIN_EMAIL
    if (adminEmail && auth.email && auth.email.toLowerCase() === adminEmail.toLowerCase()) {
      return true;
    }
    // In local dev single-user mode, allow admin access
    if (process.env.AUTH_MODE !== 'multi_user') {
      return true;
    }
  } catch {
    // unauthenticated
  }
  return false;
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
  }

  try {
    if (db) {
      const items = await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(100);
      return NextResponse.json({ success: true, items });
    }

    return NextResponse.json({ success: true, items: memoryFeedbackStore });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
  }

  try {
    const { id, status } = await request.json();
    const validStatuses = ['open', 'reviewing', 'resolved', 'wontfix'];
    if (!id || !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid ID or status' }, { status: 400 });
    }

    if (db) {
      const [updated] = await db
        .update(feedback)
        .set({ status })
        .where(eq(feedback.id, id))
        .returning();
      return NextResponse.json({ success: true, feedback: updated });
    }

    const item = memoryFeedbackStore.find((f: FeedbackRecord) => f.id === id);
    if (item) {
      item.status = status;
      return NextResponse.json({ success: true, feedback: item });
    }

    return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
