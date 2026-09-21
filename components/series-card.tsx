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
  CheckSquare,
  Square,
} from 'lucide-react';
import { STATUS_CONFIG } from './filter-bar';
import { usePreferences } from '@/lib/preferences-context';

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
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function getDomainName(urlStr?: string | null, seriesKey?: string): string | null {
  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {}
  }
  if (seriesKey) {
    if (seriesKey.startsWith('mangadex')) return 'mangadex.org';
    const parts = seriesKey.split(':');
    if (parts.length > 1 && parts[1].includes('.')) return parts[1].toLowerCase().replace(/^www\./, '');
    const slashPart = seriesKey.split('/')[0];
    if (slashPart.includes('.')) return slashPart.toLowerCase().replace(/^www\./, '');
  }
  return null;
}

export function SeriesCard({
  series,
  onUpdate,
  onDelete,
  isSelectMode,
  isSelected,
  onToggleSelect,
}: SeriesCardProps) {
  const { t } = usePreferences();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(series.title);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [nextFeedback, setNextFeedback] = useState<string | null>(null);

  // Merge State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSuggestions, setMergeSuggestions] = useState<Array<{ id: string; title: string; coverUrl: string | null }>>([]);
  const [allSeriesOptions, setAllSeriesOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedMergeId, setSelectedMergeId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  const statusConfig = STATUS_CONFIG[series.status] || STATUS_CONFIG.unread;
  const domain = getDomainName(series.currentChapter?.url, series.seriesKey);

  const formatRelativeTime = (dateString: string): string => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { m: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('hoursAgo', { h: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('daysAgo', { d: days });
    return new Date(dateString).toLocaleDateString();
  };

  const handleOpenMergeModal = async () => {
    setIsMenuOpen(false);
    setIsMergeModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const [sugRes, allRes] = await Promise.all([
        fetch(`/api/series/${series.id}/merge`),
        fetch('/api/series?limit=100'),
      ]);

      if (sugRes.ok) {
        const sugData = await sugRes.json();
        setMergeSuggestions(sugData.suggestions || []);
        if (sugData.suggestions?.length > 0) {
          setSelectedMergeId(sugData.suggestions[0].id);
        }
      }

      if (allRes.ok) {
        const allData = await allRes.json();
        const otherSeries = (allData.items || [])
          .filter((s: { id: string }) => s.id !== series.id)
          .map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }));
        setAllSeriesOptions(otherSeries);
        if (!selectedMergeId && otherSeries.length > 0) {
          setSelectedMergeId(otherSeries[0].id);
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
        window.location.reload();
      } else {
        alert(data.message || 'Failed to merge series');
      }
    } catch {
      alert('Error during series merge');
    } finally {
      setIsMerging(false);
    }
  };

  const handleContinue = async () => {
    if (!series.currentChapter?.url) return;

    window.open(series.currentChapter.url, '_blank', 'noopener,noreferrer');

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

    const cachedMatch = series.nextChapterUrl?.match(/(?:-|_|\/)(?:ตอนที่|ตอน|บทที่|chapter|ch|ep)?-?(\d+(?:\.\d+)?)\/?$/i);
    const isCachedValid = cachedMatch && series.currentChapter?.number != null
      ? parseFloat(cachedMatch[1]) > series.currentChapter.number
      : Boolean(series.nextChapterUrl);

    if (series.nextChapterUrl && isCachedValid) {
      window.open(series.nextChapterUrl, '_blank', 'noopener,noreferrer');
      return;
    }

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
        onUpdate({
          ...series,
          nextChapterUrl: null,
          hasUpdate: false,
        });
        setNextFeedback(t('caughtUp'));
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
    if (!window.confirm(`${t('confirmDeleteSingleTitle')} "${series.title}"`)) return;
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
      onClick={() => {
        if (isSelectMode && onToggleSelect) {
          onToggleSelect();
        }
      }}
      className={`group relative flex flex-col justify-between overflow-visible rounded-2xl border bg-card p-4 transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 ${
        isMenuOpen ? 'z-30' : ''
      } ${
        isSelectMode ? 'cursor-pointer select-none' : ''
      } ${
        isSelected
          ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/20 shadow-indigo-500/10'
          : series.needsReview
          ? 'border-amber-500/50 bg-amber-500/[0.02] hover:border-amber-500/80'
          : 'border-border hover:border-indigo-500/40'
      }`}
    >
      <div>
        {/* Top Info Header */}
        <div className="flex items-start gap-3.5">
          {/* Cover Art with Select Checkbox */}
          <div className="relative w-20 h-28 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/60 shadow-xs">
            {series.coverUrl ? (
              <img
                src={series.coverUrl}
                alt={series.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-indigo-500/5 p-2 text-center select-none">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-1">
                  {series.title.charAt(0).toUpperCase()}
                </div>
                <span className="text-[9px] text-muted-foreground line-clamp-1 font-mono">Manga</span>
              </div>
            )}

            {/* Selection Checkbox Overlay */}
            {isSelectMode && (
              <div className="absolute top-1 left-1 z-10">
                <div
                  className={`h-5 w-5 rounded-md flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-black/60 text-white/70 backdrop-blur-sm border border-white/30 hover:bg-indigo-600'
                  }`}
                >
                  {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </div>
              </div>
            )}
          </div>

          {/* Series details */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              {/* Row 1: Status Pill + Options Menu */}
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Reading Status Pill */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${statusConfig.bg} ${statusConfig.color} border-current/20`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <span>{t(statusConfig.labelKey)}</span>
                  </span>

                  {/* New Update Badge */}
                  {series.hasUpdate && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{t('newUpdateBadge')}</span>
                    </span>
                  )}

                  {/* Needs Review Badge */}
                  {series.needsReview && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      <span>{t('needsReviewBadge')}</span>
                    </span>
                  )}
                </div>

                {/* ⋯ Options Menu */}
                {!isSelectMode && (
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-card-hover hover:text-foreground cursor-pointer transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {isMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setIsMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full z-30 mt-1 w-48 max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 divide-y divide-border/60">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setIsMenuOpen(false);
                                setIsEditingTitle(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-card-hover cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{t('editTitle')}</span>
                            </button>
                          </div>

                          <div className="py-1">
                            <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Status
                            </div>
                            {['unread', 'reading', 'read', 'waiting', 'paused', 'dropped'].map((st) => (
                              <button
                                key={st}
                                onClick={() => handleStatusChange(st)}
                                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs capitalize cursor-pointer ${
                                  series.status === st
                                    ? 'bg-foreground text-background font-medium'
                                    : 'text-foreground hover:bg-card-hover'
                                }`}
                              >
                                <span>{t(STATUS_CONFIG[st]?.labelKey || 'statusAll')}</span>
                                {series.status === st && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>

                          <div className="py-1">
                            <button
                              onClick={handleOpenMergeModal}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 font-medium cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                              <span>{t('mergeWith')}</span>
                            </button>
                          </div>

                          <div className="pt-1">
                            <button
                              onClick={handleDelete}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-medium cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('deleteSeries')}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Title / Inline Edit */}
              {isEditingTitle && !isSelectMode ? (
                <div className="flex items-center gap-1.5 mb-1.5" onClick={(e) => e.stopPropagation()}>
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
                    className="w-full rounded-lg border border-indigo-500 bg-background px-2 py-0.5 text-sm font-semibold text-foreground focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={isSubmitting}
                    className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setTitleDraft(series.title);
                      setIsEditingTitle(false);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-card-hover cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <h3
                  onClick={(e) => {
                    if (!isSelectMode) {
                      e.stopPropagation();
                      setIsEditingTitle(true);
                    }
                  }}
                  className="font-bold text-foreground text-sm leading-snug line-clamp-2 min-h-[2.5rem] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  title={isSelectMode ? '' : t('editTitle')}
                >
                  {series.title}
                </h3>
              )}

              {/* Row 3: Current Chapter & Domain */}
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-foreground">
                  {series.currentChapter?.label || 'No chapters'}
                </span>
                {domain && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                      {domain}
                    </span>
                  </>
                )}
              </div>

              {/* Row 4: Source & Relative Time & Tags */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono border border-border/60">
                  {series.source}
                </span>
                {series.updatedAt && (
                  <span className="text-muted-foreground/70">
                    • {formatRelativeTime(series.updatedAt)}
                  </span>
                )}
                {series.tags?.map((tg) => (
                  <span key={tg} className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground/80">
                    #{tg}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isSelectMode && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-border/60 pt-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleContinue}
            disabled={!series.currentChapter?.url}
            className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <span>{t('continueReading')}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleNext}
            disabled={!series.currentChapter?.url || isLoadingNext}
            className={`h-9 flex items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all cursor-pointer ${
              series.hasUpdate || series.nextChapterUrl
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'border-border bg-card-hover text-foreground hover:bg-muted'
            } disabled:opacity-50`}
            title="Check or open next chapter"
          >
            {isLoadingNext ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                <span>{t('checkingNext')}</span>
              </>
            ) : nextFeedback ? (
              <span className="text-muted-foreground">{nextFeedback}</span>
            ) : (
              <>
                <span>{t('nextChapter')}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Merge Series Dialog Modal */}
      {isMergeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                {t('mergeTitle')}
              </h3>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-foreground hover:bg-card-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
              {t('mergeDesc')}
            </p>

            <div className="space-y-3">
              {loadingSuggestions ? (
                <div className="text-xs text-gray-500 py-4 text-center">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {mergeSuggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-indigo-500">
                        {t('suggestedMatches')}
                      </div>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {mergeSuggestions.map((sug) => (
                          <label
                            key={sug.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              selectedMergeId === sug.id
                                ? 'bg-indigo-500/10 border-indigo-500 text-foreground'
                                : 'bg-background border-border text-muted-foreground hover:border-indigo-500/30'
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
                                referrerPolicy="no-referrer"
                                className="w-8 h-10 object-cover rounded bg-background border border-border flex-shrink-0"
                              />
                            )}
                            <span className="text-xs font-medium truncate flex-1">{sug.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual All Series Dropdown */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-gray-500">
                      {t('orSelectManually')}
                    </div>
                    {allSeriesOptions.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2 bg-background rounded-xl p-3 border border-border text-center">
                        No other series found.
                      </div>
                    ) : (
                      <select
                        value={selectedMergeId}
                        onChange={(e) => setSelectedMergeId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="" disabled>-- {t('selectTargetSeries')} --</option>
                        {allSeriesOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-card-hover text-foreground text-xs font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={!selectedMergeId || isMerging}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
              >
                {isMerging ? t('merging') : t('mergeButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
