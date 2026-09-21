'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePreferences } from '@/lib/preferences-context';

interface ArchivedChapterItem {
  id: string;
  seriesId: string;
  seriesTitle: string;
  seriesCoverUrl: string | null;
  url: string;
  chapterLabel: string;
  chapterNumber: number | null;
  archivedAt: string | null;
  purgeAt: string | null;
  daysRemaining: number;
  restoredCount: number;
  savedAt: string;
}

export default function TrashPage() {
  const { t } = usePreferences();
  const [chapters, setChapters] = useState<ArchivedChapterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchArchived();
  }, []);

  const fetchArchived = async () => {
    try {
      const res = await fetch('/api/chapters?archived=true');
      if (res.ok) {
        const data = await res.json();
        setChapters(data.chapters || []);
      }
    } catch (err) {
      console.error('Failed to load trash chapters', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (chapterId: string, label: string) => {
    setRestoringId(chapterId);
    try {
      const res = await fetch(`/api/chapters/${chapterId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `Restored ${label} to active library!` });
        fetchArchived();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to restore' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to restore chapter' });
    } finally {
      setRestoringId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDelete = async (chapterId: string) => {
    if (!confirm(t('confirmPermDelete'))) return;
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, { method: 'DELETE' });
      if (res.ok) setChapters((prev) => prev.filter((c) => c.id !== chapterId));
    } catch (err) {
      console.error('Failed to delete chapter', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('trashTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('trashSubtitle')}</p>
        </div>
        <Link href="/" className="px-4 py-2 rounded-xl bg-card hover:bg-card-hover text-foreground text-sm font-medium transition-colors border border-border">
          {t('backToLibrary')}
        </Link>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border text-sm font-medium transition-all ${feedback.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'}`}>
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-rose-500 border-t-transparent mb-3"></div>
          <p className="text-xs">{t('trashLoading')}</p>
        </div>
      ) : chapters.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-muted text-muted-foreground flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground">{t('trashEmpty')}</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{t('trashEmptyDesc')}</p>
          <div className="pt-2">
            <Link href="/" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">{t('returnToLibrary')}</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{t('archivedChapters', { n: chapters.length })}</span>
            <span>{t('autoPurge30')}</span>
          </div>
          <div className="divide-y divide-border bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            {chapters.map((ch) => (
              <div key={ch.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-card-hover transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  {ch.seriesCoverUrl ? (
                    <img src={ch.seriesCoverUrl} alt={ch.seriesTitle} referrerPolicy="no-referrer" className="w-12 h-16 object-cover rounded-lg bg-muted border border-border flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground flex-shrink-0">📖</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{ch.seriesTitle}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">{ch.chapterLabel}</span>
                      <a href={ch.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-indigo-400 truncate max-w-xs transition-colors">{ch.url}</a>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {t('archivedAtLabel')} {ch.archivedAt ? new Date(ch.archivedAt).toLocaleDateString() : 'N/A'}
                      {ch.restoredCount > 0 && ` · ${t('restoredXTimes', { n: ch.restoredCount })}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:self-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <div className="text-right mr-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ch.daysRemaining <= 3 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-muted text-foreground border-border'}`}>
                      ⏳ {ch.daysRemaining === 1 ? t('dayLeft') : t('daysLeft', { n: ch.daysRemaining })}
                    </span>
                  </div>
                  <button onClick={() => handleRestore(ch.id, `${ch.seriesTitle} (${ch.chapterLabel})`)} disabled={restoringId === ch.id} className="text-xs px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors shadow-lg shadow-indigo-600/20 whitespace-nowrap">
                    {restoringId === ch.id ? t('restoring') : t('restoreToActive')}
                  </button>
                  <button onClick={() => handleDelete(ch.id)} className="text-xs p-2 rounded-xl bg-muted hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 font-medium transition-colors border border-border hover:border-rose-500/30" title={t('deletePermanentlyLabel')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
