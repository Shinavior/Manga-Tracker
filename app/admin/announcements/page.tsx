'use client';

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  Pin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Bell,
  ShieldAlert,
} from 'lucide-react';
import { AdminNav } from '@/components/admin/admin-nav';
import { AnnouncementItem } from '@/components/announcements-modal';
import { MarkdownContent } from '@/components/markdown-content';

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'update' | 'feature' | 'guide' | 'notice'>('update');
  const [isPinned, setIsPinned] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.announcements || []);
      } else {
        setError(data.error || 'Failed to load announcements');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormError('Title and content are required');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category,
          isPinned,
          linkUrl: linkUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTitle('');
        setContent('');
        setLinkUrl('');
        setIsPinned(false);
        setShowCreate(false);
        fetchAnnouncements();
      } else {
        setFormError(data.error || 'Failed to create announcement');
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(data.error || 'Failed to delete announcement');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const formatDate = (dateInput: string | Date) => {
    try {
      return new Date(dateInput).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <AdminNav
        title="Admin Announcements (จัดการประกาศ)"
        subtitle="Publish news, release notes, guides, and alerts to all users"
        onRefresh={fetchAnnouncements}
        loading={loading}
      />

      {error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5" />
            <span>Admin Access Restricted</span>
          </div>
          <p className="text-xs">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Total Announcements: <strong className="text-foreground">{items.length}</strong>
            </span>

            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showCreate ? 'Close Form' : 'New Announcement (เขียนประกาศ)'}</span>
            </button>
          </div>

          {/* Create Announcement Form */}
          {showCreate && (
            <form
              onSubmit={handleCreate}
              className="p-5 sm:p-6 rounded-2xl border border-indigo-500/30 bg-card shadow-xs space-y-4 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-border/80 pb-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-indigo-500" />
                  <span>Create New Announcement</span>
                </h3>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Title (หัวข้อ)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. System Update v0.2.0: New Features Released"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Category (หมวดหมู่)</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="update">System Update (อัปเดตระบบ)</option>
                    <option value="feature">New Feature (ฟีเจอร์ใหม่)</option>
                    <option value="guide">User Guide (วิธีใช้งาน)</option>
                    <option value="notice">Notice (แจ้งเตือน)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Content (เนื้อหา)</label>
                  <span className="text-[10px] text-indigo-500 font-mono">
                    Markdown: ![คำอธิบาย](URL รูป) | **ตัวหนา** | [ลิงก์](URL)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Details... Supports images like ![screenshot](https://example.com/pic.png)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">External Link URL (Optional)</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://demo-tracker.example.com/changelog"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/80">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs text-foreground font-medium flex items-center gap-1">
                    <Pin className="h-3 w-3 text-indigo-500" />
                    <span>Pin to top (ปักหมุดไว้บนสุด)</span>
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs font-medium text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Publishing...' : 'Publish Announcement'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Announcements Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-xs gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span>Loading announcements...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center border border-border rounded-2xl bg-card space-y-2">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm font-semibold text-foreground">No announcements yet</div>
              <p className="text-xs text-muted-foreground">Click "New Announcement" above to publish your first post.</p>
            </div>
          ) : (
            <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.isPinned && (
                          <span className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-500 border border-indigo-500/20">
                            <Pin className="h-3 w-3" />
                            <span>Pinned</span>
                          </span>
                        )}
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold border border-border uppercase">
                          {item.category}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(item.createdAt)}</span>
                        </span>
                        {item.authorEmail && (
                          <span className="text-[11px] text-muted-foreground">
                            by {item.authorEmail}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm sm:text-base text-foreground">
                        {item.title}
                      </h4>

                      <div className="mt-1.5 max-h-48 overflow-y-auto">
                        <MarkdownContent content={item.content} />
                      </div>

                      {item.linkUrl && (
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:underline font-mono"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>{item.linkUrl}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
