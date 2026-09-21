'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
} from 'lucide-react';
import { SeriesCardData } from './series-card';
import { usePreferences } from '@/lib/preferences-context';

export interface UpdateCheckResultItem {
  seriesId: string;
  title: string;
  nextUrl: string | null;
  updated: boolean;
}

interface UpdateCheckWidgetProps {
  seriesList: SeriesCardData[];
  onRefreshLibrary: () => Promise<void>;
  filterUpdatesOnly: boolean;
  onToggleFilterUpdatesOnly: () => void;
}

export function UpdateCheckWidget({
  seriesList,
  onRefreshLibrary,
  filterUpdatesOnly,
  onToggleFilterUpdatesOnly,
}: UpdateCheckWidgetProps) {
  const { t } = usePreferences();
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState<{
    checkedCount: number;
    updatedCount: number;
    results: UpdateCheckResultItem[];
    timestamp: string;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Count series that currently have hasUpdate = true in the library
  const currentUpdatesInLibrary = seriesList.filter((s) => s.hasUpdate);

  const handleRunCheck = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/cron/check-updates', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastCheck({
          checkedCount: data.checkedCount,
          updatedCount: data.updatedCount,
          results: data.results || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        setIsExpanded(true);
        // Refresh library in background to update card badges
        await onRefreshLibrary();
      } else {
        setError(data.error?.message || 'Failed to check updates');
      }
    } catch (err) {
      setError((err as Error).message || 'Network error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  // Get items that have an update either from last check or currently in library
  const updatedItems = lastCheck
    ? lastCheck.results.filter((r) => r.updated && r.nextUrl)
    : currentUpdatesInLibrary.map((s) => ({
        seriesId: s.id,
        title: s.title,
        nextUrl: s.nextChapterUrl || null,
        updated: true,
      }));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border text-foreground shadow-xs">
            <Sparkles className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground tracking-tight">
                {t('updateWidgetTitle')}
              </h2>
              {currentUpdatesInLibrary.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{t('updatesFoundBadge', { count: currentUpdatesInLibrary.length })}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastCheck ? (
                <>
                  {t('lastChecked')} {lastCheck.timestamp} ({lastCheck.checkedCount} series) •{' '}
                  <span className={lastCheck.updatedCount > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground font-medium'}>
                    {t('updatesFoundBadge', { count: lastCheck.updatedCount })}
                  </span>
                </>
              ) : (
                t('updateWidgetDesc')
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {currentUpdatesInLibrary.length > 0 && (
            <button
              onClick={onToggleFilterUpdatesOnly}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                filterUpdatesOnly
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{filterUpdatesOnly ? t('showAllSeries') : t('filterUpdatesOnly')}</span>
            </button>
          )}

          <button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? t('checkingUpdates') : t('checkUpdatesNow')}</span>
          </button>

          {updatedItems.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-xl border border-border bg-card p-2 text-gray-500 dark:text-zinc-400 hover:bg-card-hover hover:text-foreground transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Expanded List of Series with New Chapters */}
      {isExpanded && updatedItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/70">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>{t('updatesFoundBadge', { count: updatedItems.length })}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {updatedItems.map((item) => {
              const matchingSeries = seriesList.find((s) => s.id === item.seriesId);
              return (
                <div
                  key={item.seriesId}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-2.5 transition-all hover:border-indigo-500/30 hover:bg-card shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {matchingSeries?.coverUrl ? (
                      <img
                        src={matchingSeries.coverUrl}
                        alt={item.title}
                        className="h-10 w-8 rounded-lg object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-8 items-center justify-center rounded-lg bg-card text-muted-foreground border border-border font-bold text-xs shrink-0">
                        {item.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {matchingSeries?.currentChapter?.label ? (
                          <>
                            {matchingSeries.currentChapter.label}
                          </>
                        ) : (
                          t('newUpdateBadge')
                        )}
                      </p>
                    </div>
                  </div>

                  {item.nextUrl && (
                    <a
                      href={item.nextUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 shrink-0 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      title={t('readNextChapter')}
                    >
                      <span>{t('nextChapter')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checked and all up to date */}
      {lastCheck && lastCheck.updatedCount === 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-gray-600 dark:text-zinc-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>{t('allCaughtUp')}</span>
        </div>
      )}
    </div>
  );
}
