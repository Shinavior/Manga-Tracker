'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  ListPlus,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ResolveResult } from '@/lib/resolver/types';
import { usePreferences } from '@/lib/preferences-context';

interface AddMangaBarProps {
  onSaveSuccess: (result: any) => void;
}

interface BulkProgressItem {
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  title?: string;
  error?: string;
}

export function AddMangaBar({ onSaveSuccess }: AddMangaBarProps) {
  const { t } = usePreferences();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single mode state
  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk mode state
  const [bulkText, setBulkText] = useState('');
  const [bulkTagsInput, setBulkTagsInput] = useState('');
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressItem[]>([]);
  const [bulkSummaryStats, setBulkSummaryStats] = useState<{ success: number; error: number } | null>(null);

  // Auto-resolve single URL when typed or pasted
  useEffect(() => {
    if (mode !== 'single') return;

    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setPreview(null);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      setError(null);
      try {
        const res = await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message || 'Failed to resolve URL');
          setPreview(null);
        } else {
          setPreview(data.result);
          if (data.result.seriesTitle && !customTitle) {
            setCustomTitle('');
          }
        }
      } catch (err) {
        setError('Network error resolving URL');
        setPreview(null);
      } finally {
        setIsResolving(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [url, mode]);

  // Handle single save
  const handleSingleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          title: customTitle.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to save chapter');
      } else {
        setUrl('');
        setCustomTitle('');
        setTagsInput('');
        setPreview(null);
        onSaveSuccess(data);
      }
    } catch (err) {
      setError('Network error saving chapter');
    } finally {
      setIsSaving(false);
    }
  };

  // Parse bulk URLs from textarea
  const parsedUrls = React.useMemo(() => {
    return bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('http://') || line.startsWith('https://'));
  }, [bulkText]);

  // Handle bulk ingestion
  const handleStartBulk = async () => {
    if (parsedUrls.length === 0 || isBulkRunning) return;

    setIsBulkRunning(true);
    setBulkSummaryStats(null);

    const items: BulkProgressItem[] = parsedUrls.map((u) => ({
      url: u,
      status: 'pending',
    }));
    setBulkProgress([...items]);

    const tags = bulkTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i++) {
      items[i].status = 'processing';
      setBulkProgress([...items]);

      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: items[i].url,
            tags: tags.length > 0 ? tags : undefined,
          }),
        });

        const data = await res.json();
        if (res.ok && data.series) {
          items[i].status = 'success';
          items[i].title = data.series.title;
          successCount++;
        } else {
          items[i].status = 'error';
          items[i].error = data.error?.message || 'Save failed';
          errorCount++;
        }
      } catch (err: any) {
        items[i].status = 'error';
        items[i].error = err.message || 'Network error';
        errorCount++;
      }

      setBulkProgress([...items]);
      // Brief pause to be respectful to sources
      await new Promise((r) => setTimeout(r, 200));
    }

    setIsBulkRunning(false);
    setBulkSummaryStats({ success: successCount, error: errorCount });

    // Refresh library with the new series
    onSaveSuccess({ bulk: true, successCount, errorCount });
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur-md transition-colors duration-200">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background/80 border border-border/60">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'single'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-foreground'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('singleMode')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'bulk'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-foreground'
            }`}
          >
            <ListPlus className="h-3.5 w-3.5" />
            <span>{t('bulkMode')}</span>
          </button>
        </div>

        {mode === 'bulk' && (
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            {t('bulkDetected', { count: parsedUrls.length })}
          </span>
        )}
      </div>

      {mode === 'single' ? (
        /* Single Mode Form */
        <form onSubmit={handleSingleSave} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                {isResolving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('urlPlaceholder')}
                className="w-full rounded-xl border border-border/80 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={!url.trim() || isSaving || isResolving}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 transition-all hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('saving')}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>{t('trackChapter')}</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300 border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Preview Card */}
          {preview && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3">
                {preview.coverUrl ? (
                  <img
                    src={preview.coverUrl}
                    alt={preview.seriesTitle || 'Cover'}
                    className="h-16 w-12 rounded-lg object-cover border border-purple-500/20"
                  />
                ) : (
                  <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold">
                    Manga
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground text-sm truncate">
                      {preview.seriesTitle || 'Untitled Series'}
                    </h4>
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-300 uppercase tracking-wide">
                      {preview.source}
                    </span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                      {preview.chapterLabel}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 font-mono">
                    Key: {preview.seriesKey}
                  </p>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={t('customTitlePlaceholder')}
                      className="w-full rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder={t('tagsPlaceholder')}
                      className="w-full rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      ) : (
        /* Bulk Mode Container */
        <div className="space-y-3 animate-in fade-in duration-200">
          <div>
            <textarea
              rows={4}
              value={bulkText}
              disabled={isBulkRunning}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={t('bulkPlaceholder')}
              className="w-full rounded-xl border border-border/80 bg-background/80 p-3 text-xs sm:text-sm font-mono text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 justify-between">
            <input
              type="text"
              value={bulkTagsInput}
              disabled={isBulkRunning}
              onChange={(e) => setBulkTagsInput(e.target.value)}
              placeholder={t('tagsPlaceholder')}
              className="w-full sm:w-80 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={handleStartBulk}
              disabled={parsedUrls.length === 0 || isBulkRunning}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 transition-all hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {t('bulkProcessing', {
                      current: bulkProgress.filter((p) => p.status !== 'pending').length,
                      total: bulkProgress.length,
                    })}
                  </span>
                </>
              ) : (
                <>
                  <ListPlus className="h-4 w-4" />
                  <span>{t('startBulkIngestion')}</span>
                </>
              )}
            </button>
          </div>

          {/* Progress bar */}
          {isBulkRunning && bulkProgress.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="w-full h-2 rounded-full bg-background overflow-hidden border border-border">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      (bulkProgress.filter((p) => p.status === 'success' || p.status === 'error').length /
                        bulkProgress.length) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Bulk Summary Stats */}
          {bulkSummaryStats && (
            <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 p-3 text-xs">
              <span className="font-semibold text-foreground">
                {bulkSummaryStats.error === 0 ? t('bulkDone') : t('bulkFailures')}
              </span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                {t('bulkSuccessCount', { count: bulkSummaryStats.success })}
              </span>
              {bulkSummaryStats.error > 0 && (
                <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400 font-medium">
                  {t('bulkErrorCount', { count: bulkSummaryStats.error })}
                </span>
              )}
            </div>
          )}

          {/* Progress Items List */}
          {bulkProgress.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-2 space-y-1 text-xs">
              {bulkProgress.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-card/60 transition-colors"
                >
                  <span className="truncate font-mono text-[11px] text-gray-500 dark:text-gray-400 max-w-[70%]">
                    {item.title ? `${item.title} — ` : ''}
                    {item.url}
                  </span>
                  <div className="shrink-0 flex items-center gap-1">
                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1 text-purple-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </span>
                    )}
                    {item.status === 'success' && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-[10px]">OK</span>
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex items-center gap-1 text-red-500" title={item.error}>
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-[10px] truncate max-w-[100px]">{item.error || 'Err'}</span>
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-gray-400 text-[10px]">Wait</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
