import { NextResponse } from 'next/server';
import { db, announcements } from '@/lib/db/client';
import { eq, desc } from 'drizzle-orm';
import {
  memoryAnnouncementStore,
  addMemoryAnnouncement,
  deleteMemoryAnnouncement,
} from '@/lib/db/announcement-store';
import { verifyAdmin } from '@/lib/admin';
import { authenticateRequest } from '@/lib/auth';

export async function GET() {
  try {
    if (db) {
      const items = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
        .limit(50);
      return NextResponse.json({ success: true, announcements: items });
    }

    // In-memory fallback
    const sorted = [...memoryAnnouncementStore].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ success: true, announcements: sorted });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only administrators can post announcements' },
        { status: 403 }
      );
    }

    let authorEmail: string | null = null;
    try {
      const auth = await authenticateRequest(request);
      authorEmail = auth.email || null;
    } catch {
      // ignore
    }

    const body = await request.json();
    const { title, content, category, isPinned, linkUrl } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Announcement title is required' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Announcement content is required' },
        { status: 400 }
      );
    }

    const validCategories = ['update', 'feature', 'guide', 'notice'];
    const validCategory = validCategories.includes(category)
      ? (category as 'update' | 'feature' | 'guide' | 'notice')
      : 'update';

    if (db) {
      const [inserted] = await db
        .insert(announcements)
        .values({
          title: title.trim(),
          content: content.trim(),
          category: validCategory,
          isPinned: Boolean(isPinned),
          linkUrl: linkUrl ? linkUrl.trim() : null,
          authorEmail,
        })
        .returning();

      return NextResponse.json({ success: true, announcement: inserted });
    }

    // In-memory fallback
    const newEntry = addMemoryAnnouncement({
      title: title.trim(),
      content: content.trim(),
      category: validCategory,
      isPinned: Boolean(isPinned),
      linkUrl: linkUrl ? linkUrl.trim() : null,
      authorEmail: authorEmail || 'admin@mangatracker.local',
    });

    return NextResponse.json({ success: true, announcement: newEntry });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to post announcement' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only administrators can delete announcements' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    let id = url.searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Announcement ID is required' },
        { status: 400 }
      );
    }

    if (db) {
      const [deleted] = await db
        .delete(announcements)
        .where(eq(announcements.id, id))
        .returning();
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: 'Announcement not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, deletedId: id });
    }

    // In-memory fallback
    const deleted = deleteMemoryAnnouncement(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Announcement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to delete announcement' },
      { status: 500 }
    );
  }
}
