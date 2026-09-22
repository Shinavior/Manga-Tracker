'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Bell,
  Pin,
  Tag,
  Calendar,
  ExternalLink,
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';
import { MarkdownContent } from '@/components/markdown-content';

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  category: 'update' | 'feature' | 'guide' | 'notice';
  isPinned: boolean;
  linkUrl: string | null;
  authorEmail: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnnouncementsViewed?: () => void;
}

export function AnnouncementsModal({
  isOpen,
  onClose,
  onAnnouncementsViewed,
}: AnnouncementsModalProps) {
  const { language, t } = usePreferences();
  const isTh = language === 'th';

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'update' | 'feature' | 'guide' | 'notice'>('update');
  const [linkUrl, setLinkUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch announcements
  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok && data.success) {
        setAnnouncements(data.announcements || []);
        // Save latest timestamp to mark as viewed
        if (data.announcements && data.announcements.length > 0) {
          const newest = data.announcements[0];
          const time = new Date(newest.createdAt).getTime();
          localStorage.setItem('manga_tracker_last_read_announcement_time', String(time));
          if (onAnnouncementsViewed) {
            onAnnouncementsViewed();
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Check admin status
  const checkAdminStatus = async () => {
    try {
      const res = await fetch('/api/announcements/auth-check');
      const data = await res.json();
      if (res.ok && data.isAdmin) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
      checkAdminStatus();
    }
  }, [isOpen]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormError(isTh ? 'กรุณากรอกหัวข้อและเนื้อหาประกาศ' : 'Title and content are required');
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
        // Reset form
        setTitle('');
        setContent('');
        setLinkUrl('');
        setIsPinned(false);
        setShowCreateForm(false);
        fetchAnnouncements();
      } else {
        setFormError(data.error || (isTh ? 'ไม่สามารถโพสต์ประกาศได้' : 'Failed to publish announcement'));
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return;

    try {
      const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      } else {
        alert(data.error || (isTh ? 'ไม่สามารถลบประกาศได้' : 'Failed to delete announcement'));
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    if (activeCategory === 'all') return announcements;
    return announcements.filter((a) => a.category === activeCategory);
  }, [announcements, activeCategory]);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'update':
        return {
          label: t('categoryUpdate'),
          className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
        };
      case 'feature':
        return {
          label: t('categoryFeature'),
          className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        };
      case 'guide':
        return {
          label: t('categoryGuide'),
          className: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
        };
      case 'notice':
        return {
          label: t('categoryNotice'),
          className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        };
      default:
        return {
          label: cat,
          className: 'bg-muted text-muted-foreground border-border',
        };
    }
  };

  const formatDate = (dateInput: string | Date) => {
    try {
      const d = new Date(dateInput);
      return d.toLocaleDateString(isTh ? 'th-TH' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden text-foreground">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 sm:px-6 py-4 bg-card/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 shadow-xs">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  {t('announcements')}
                </h2>
                {isAdmin && (
                  <span className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-500 border border-indigo-500/20">
                    <ShieldCheck className="h-3 w-3" />
                    <span>{t('adminOnly')}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {t('announcementsSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && !showCreateForm && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('newAnnouncement')}</span>
              </button>
            )}

            <button
              onClick={onClose}
              aria-label={t('close')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card-hover text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Category Filters Bar */}
        <div className="border-b border-border/60 bg-muted/20 px-4 sm:px-6 py-2.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max">
            {[
              { id: 'all', label: t('categoryAll') },
              { id: 'update', label: t('categoryUpdate') },
              { id: 'feature', label: t('categoryFeature') },
              { id: 'guide', label: t('categoryGuide') },
              { id: 'notice', label: t('categoryNotice') },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card-hover'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Admin Create Form Section */}
          {isAdmin && showCreateForm && (
            <form
              onSubmit={handleCreateAnnouncement}
              className="p-4 sm:p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-3.5 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20">
                <span className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                  <span>{t('newAnnouncement')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('cancel')}
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">{t('titleLabel')}</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isTh ? 'เช่น อัปเดตระบบ v0.2.0 หรือ วิธีใช้งาน...' : 'e.g. System Update v0.2.0...'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">{t('categoryLabel')}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="update">{t('categoryUpdate')}</option>
                    <option value="feature">{t('categoryFeature')}</option>
                    <option value="guide">{t('categoryGuide')}</option>
                    <option value="notice">{t('categoryNotice')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">{t('contentLabel')}</label>
                  <span className="text-[10px] text-indigo-500 font-mono">
                    {isTh ? 'รองรับรูปภาพ: ![คำอธิบาย](URL รูป) และ **ตัวหนา**' : 'Supports: ![alt](image_url) and **bold**'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isTh ? 'รายละเอียดประกาศ... สามารถแทรกรูปภาพได้ด้วย ![คำอธิบาย](https://...)' : 'Announcement notes... you can insert images via ![alt](https://...)'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">{t('linkUrlLabel')}</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://demo-tracker.example.com/changelog"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs text-foreground font-medium flex items-center gap-1">
                    <Pin className="h-3 w-3 text-indigo-500" />
                    <span>{t('pinPost')}</span>
                  </span>
                </label>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? t('publishing') : t('publish')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Announcements List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span>{isTh ? 'กำลังโหลดประกาศ...' : 'Loading announcements...'}</span>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-2">
              <Bell className="h-8 w-8 text-muted-foreground/40 stroke-1" />
              <p>{t('noAnnouncements')}</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredAnnouncements.map((item) => {
                const categoryStyle = getCategoryBadge(item.category);
                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
                      item.isPinned
                        ? 'border-indigo-500/30 bg-indigo-500/5 shadow-xs'
                        : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.isPinned && (
                            <span className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-500 border border-indigo-500/20">
                              <Pin className="h-3 w-3" />
                              <span>{t('pinnedBadge')}</span>
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${categoryStyle.className}`}
                          >
                            {categoryStyle.label}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(item.createdAt)}</span>
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                          {item.title}
                        </h3>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(item.id)}
                          title={isTh ? 'ลบประกาศ' : 'Delete announcement'}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-2.5">
                      <MarkdownContent content={item.content} />
                    </div>

                    {item.linkUrl && (
                      <div className="mt-3 pt-2.5 border-t border-border/60">
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600 hover:underline"
                        >
                          <span>{isTh ? 'ดูรายละเอียดเพิ่มเติม' : 'Read more / documentation'}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
