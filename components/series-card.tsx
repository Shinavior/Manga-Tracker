'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { STATUS_CONFIG } from './filter-bar';

export interface SeriesCardData {
  id: string;
  title: string;
  customTitle?: string | null;
  autoTitle?: string | null;
  coverUrl?: string | null;
  status: string;
  tags: string[];
  seriesKey: string;
  source: string;
  needsReview: boolean;
  hasUpdate: boolean;
  nextChapterUrl?: string | null;
  currentChapter?: {
    id: string;
    label: string;
    url: string;
    number: number | null;
    savedAt: string;
  } | null;
  updatedAt: string;
}

interface SeriesCardProps {
  series: SeriesCardData;
  onUpdate: (updated: SeriesCardData) => void;
  onDelete: (id: string) => void;
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function SeriesCard({ series, onUpdate, onDelete }: SeriesCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(series.title);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [nextFeedback, setNextFeedback] = useState<string | null>(null);

  // Merge State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSuggestions, setMergeSuggestions] = useState<Array<{ id: string; title: string; coverUrl: string | null }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedMergeId, setSelectedMergeId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  const statusConfig = STATUS_CONFIG[series.status] || STATUS_CONFIG.unread;

  const handleOpenMergeModal = async () => {
    setIsMenuOpen(false);
    setIsMergeModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/series/${series.id}/merge`);
      if (res.ok) {
        const data = await res.json();
        setMergeSuggestions(data.suggestions || []);
        if (data.suggestions?.length > 0) {
          setSelectedMergeId(data.suggestions[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!selectedMergeId) return;
    setIsMerging(true);
    try {
      const res = await fetch(`/api/series/${series.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSeriesId: selectedMergeId }),
      });
      const data = await res.json();
      if (res.ok && data.series) {
        setIsMergeModalOpen(false);
        // Refresh page or trigger callback
        window.location.reload();
      } else {
        alert(data.message || 'Failed to merge series');
      }
    } catch (err) {
      alert('Error during series merge');
    } finally {
      setIsMerging(false);
    }
  };

  const handleContinue = async () => {
    if (!series.currentChapter?.url) return;

    // Open chapter in new tab
    window.open(series.currentChapter.url, '_blank', 'noopener,noreferrer');

    // Optimistic reading status update
    try {
      const res = await fetch(`/api/series/${series.id}/read`, { method: 'POST' });
      if (res.ok) {
        onUpdate({
          ...series,
          status: 'reading',
        });
      }
    } catch {
      // ignore
    }
  };

  const handleNext = async () => {
    if (isLoadingNext) return;

    // If nextChapterUrl is already known, open directly
    if (series.nextChapterUrl) {
      window.open(series.nextChapterUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Otherwise probe /api/series/:id/next
    setIsLoadingNext(true);
    setNextFeedback(null);

    try {
      const res = await fetch(`/api/series/${series.id}/next`);
      const data = await res.json();

      if (res.ok && data.url) {
        onUpdate({
          ...series,
          nextChapterUrl: data.url,
          hasUpdate: true,
        });
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        setNextFeedback('Caught up');
        setTimeout(() => setNextFeedback(null), 3000);
      }
    } catch {
      setNextFeedback('Not available');
      setTimeout(() => setNextFeedback(null), 3000);
    } finally {
      setIsLoadingNext(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/series/${series.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate({
          ...series,
          title: data.series.title,
          customTitle: data.series.customTitle,
        });
        setIsEditingTitle(false);
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsMenuOpen(false);
    try {
      const res = await fetch(`/api/series/${series.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate({
          ...series,
          status: data.series.status,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    setIsMenuOpen(false);
    if (!window.confirm(`Are you sure you want to delete "${series.title}"?`)) return;
    try {
      const res = await fetch(`/api/series/${series.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(series.id);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-950/20 ${
        series.needsReview ? 'border-l-4 border-l-amber-500 border-border' : 'border-border'
      }`}
    >
      <div>
        {/* Top Info Header */}
        <div className="flex items-start gap-3.5">
          {/* Cover Art */}
          <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-md">
            {series.coverUrl ? (
              <img
                src={series.coverUrl}
                alt={series.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-purple-950/40 to-slate-900 p-1 text-center">
                <span className="text-lg font-bold text-purple-400/80">
                  {series.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Series details */}
          <div className="flex-1 min-w-0">
            {/* Title / Edit inline */}
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 mb-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(series.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full rounded-lg border border-purple-500 bg-background px-2 py-0.5 text-sm font-semibold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  disabled={isSubmitting}
                  className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setTitleDraft(series.title);
                    setIsEditingTitle(false);
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-1">
                <h3
                  onClick={() => setIsEditingTitle(true)}
                  className="font-bold text-white text-base leading-tight truncate cursor-pointer hover:text-purple-300 transition-colors"
                  title="Click to rename"
                >
                  {series.title}
                </h3>

                {/* ⋯ Options Menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-card-hover hover:text-white"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsEditingTitle(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 hover:bg-card-hover"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Rename Series</span>
                      </button>

                      <div className="my-1 border-t border-border/50" />
                      <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Change Status
                      </div>

                      {['unread', 'reading', 'read', 'waiting', 'paused', 'dropped'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(st)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs capitalize ${
                            series.status === st
                              ? 'bg-purple-600/20 text-purple-300 font-medium'
                              : 'text-gray-300 hover:bg-card-hover'
                          }`}
                        >
                          <span>{st}</span>
                          {series.status === st && <Check className="h-3 w-3" />}
                        </button>
                      ))}

                      <div className="my-1 border-t border-border/50" />
                      <button
                        onClick={handleOpenMergeModal}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 hover:bg-indigo-950/30"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Merge Series...</span>
                      </button>

                      <div className="my-1 border-t border-border/50" />
                      <button
                        onClick={handleDelete}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Series</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Chapter & Source */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="font-semibold text-purple-300">
                {series.currentChapter?.label || 'No chapters'}
              </span>
              <span>•</span>
              <span className="rounded bg-gray-800/80 px-1.5 py-0.5 text-[10px] font-mono text-gray-300">
                {series.source}
              </span>
              <span>•</span>
              <span className="text-[11px] text-gray-500">{timeAgo(series.updatedAt)}</span>
            </div>

            {/* Status & Badges */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusConfig.bg} ${statusConfig.color}`}
              >
                <span>●</span>
                <span className="capitalize">{series.status}</span>
              </span>

              {series.hasUpdate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="h-3 w-3" />
                  <span>New</span>
                </span>
              )}

              {series.needsReview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Verify</span>
                </span>
              )}

              {series.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-border/40 px-1.5 py-0.5 text-[10px] text-gray-400"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
        <button
          onClick={handleContinue}
          disabled={!series.currentChapter?.url}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600/90 py-2 text-xs font-semibold text-white shadow-md shadow-purple-900/20 transition-all hover:bg-purple-600 hover:shadow-purple-700/30 disabled:opacity-40"
        >
          <span>Continue</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleNext}
          disabled={!series.currentChapter?.url || isLoadingNext}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
            series.hasUpdate || series.nextChapterUrl
              ? 'border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-900/40'
              : 'border-border/80 bg-card-hover text-gray-300 hover:bg-border hover:text-white'
          } disabled:opacity-50`}
          title="Check or open next chapter"
        >
          {isLoadingNext ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
              <span>Checking...</span>
            </>
          ) : nextFeedback ? (
            <span className="text-gray-400">{nextFeedback}</span>
          ) : (
            <>
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Merge Series Dialog Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Merge Series
              </h3>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Combine another series entry into <strong>{series.title}</strong>. All chapter reading history and tags will be united under this card.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Select series to merge in:
              </label>

              {loadingSuggestions ? (
                <div className="text-xs text-zinc-500 py-4 text-center">Finding similar series...</div>
              ) : mergeSuggestions.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4 bg-zinc-950/60 rounded-xl p-3 border border-zinc-800 text-center">
                  No similar title suggestions found. You can enter another Series ID or merge from library.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {mergeSuggestions.map((sug) => (
                    <label
                      key={sug.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        selectedMergeId === sug.id
                          ? 'bg-indigo-950/40 border-indigo-500 text-white'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mergeTarget"
                        value={sug.id}
                        checked={selectedMergeId === sug.id}
                        onChange={() => setSelectedMergeId(sug.id)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      {sug.coverUrl && (
                        <img
                          src={sug.coverUrl}
                          alt={sug.title}
                          className="w-8 h-10 object-cover rounded bg-zinc-800 border border-zinc-700 flex-shrink-0"
                        />
                      )}
                      <span className="text-xs font-medium truncate flex-1">{sug.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={!selectedMergeId || isMerging}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
              >
                {isMerging ? 'Merging...' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
