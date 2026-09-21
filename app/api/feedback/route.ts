import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db, feedback } from '@/lib/db/client';
import { addMemoryFeedback } from '@/lib/db/feedback-store';

export async function POST(request: Request) {
  try {
    let userId: string | null = null;
    try {
      const auth = await authenticateRequest(request);
      userId = auth.userId;
    } catch {
      // Allow unauthenticated feedback with null userId
    }

    const body = await request.json();
    const { type, message, pageContext, screenshotUrl, userAgent } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Feedback message is required' },
        { status: 400 }
      );
    }

    const validTypes = ['bug', 'feature', 'general'];
    const feedbackType = validTypes.includes(type) ? type : 'general';
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-beta';
    const clientUserAgent = userAgent || request.headers.get('user-agent') || 'Unknown';

    if (db) {
      const [inserted] = await db
        .insert(feedback)
        .values({
          userId: userId,
          type: feedbackType,
          message: message.trim(),
          pageContext: pageContext || null,
          appVersion,
          userAgent: clientUserAgent,
          screenshotUrl: screenshotUrl || null,
          status: 'open',
        })
        .returning();

      return NextResponse.json({ success: true, feedback: inserted });
    }

    // In-memory fallback
    const mockEntry = addMemoryFeedback({
      userId: userId,
      type: feedbackType,
      message: message.trim(),
      pageContext: pageContext || null,
      appVersion,
      userAgent: clientUserAgent,
      screenshotUrl: screenshotUrl || null,
      status: 'open',
    });

    return NextResponse.json({ success: true, feedback: mockEntry });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
