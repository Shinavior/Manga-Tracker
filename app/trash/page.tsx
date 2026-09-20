'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
    if (!confirm('Permanently delete this archived chapter now? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/chapters/${chapterId}`, { method: 'DELETE' });
      if (res.ok) {
        setChapters((prev) => prev.filter((c) => c.id !== chapterId));
      }
    } catch (err) {
      console.error('Failed to delete chapter', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Archived Chapters (Trash)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Replaced chapters are safely archived here for 30 days before automatic purge.
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors border border-zinc-700"
        >
          &larr; Back to Library
        </Link>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Archived List */}
      {loading ? (
        <div className="text-center py-16 text-zinc-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rose-500 mb-3"></div>
          <p className="text-xs">Loading archived chapters...</p>
        </div>
      ) : chapters.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-zinc-800/80 text-zinc-400 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white">Trash is Empty</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Whenever you save a newer chapter for an existing series, the previous chapter is automatically moved here for 30 days before deletion.
          </p>
          <div className="pt-2">
            <Link href="/" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
              Return to Library &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>{chapters.length} archived {chapters.length === 1 ? 'chapter' : 'chapters'}</span>
            <span>Auto-purges 30 days after archive</span>
          </div>

          <div className="divide-y divide-zinc-800/80 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            {chapters.map((ch) => (
              <div
                key={ch.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {ch.seriesCoverUrl ? (
                    <img
                      src={ch.seriesCoverUrl}
                      alt={ch.seriesTitle}
                      className="w-12 h-16 object-cover rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-600 flex-shrink-0">
                      📖
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {ch.seriesTitle}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                        {ch.chapterLabel}
                      </span>
                      <a
                        href={ch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-indigo-400 truncate max-w-xs transition-colors"
                      >
                        {ch.url}
                      </a>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      Archived: {ch.archivedAt ? new Date(ch.archivedAt).toLocaleDateString() : 'N/A'}
                      {ch.restoredCount > 0 && ` · Restored ${ch.restoredCount}x previously`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:self-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/50">
                  {/* Countdown Badge */}
                  <div className="text-right mr-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        ch.daysRemaining <= 3
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      ⏳ {ch.daysRemaining} {ch.daysRemaining === 1 ? 'day' : 'days'} left
                    </span>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleRestore(ch.id, `${ch.seriesTitle} (${ch.chapterLabel})`)}
                    disabled={restoringId === ch.id}
                    className="text-xs px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                  >
                    {restoringId === ch.id ? 'Restoring...' : 'Restore to Active'}
                  </button>
                  <button
                    onClick={() => handleDelete(ch.id)}
                    className="text-xs p-2 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 font-medium transition-colors border border-zinc-700 hover:border-rose-500/30"
                    title="Delete permanently"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
