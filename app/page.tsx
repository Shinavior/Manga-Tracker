'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AddMangaBar } from '@/components/add-manga-bar';
import { FilterBar } from '@/components/filter-bar';
import { SeriesCard, SeriesCardData } from '@/components/series-card';
import { UndoToast, UndoToastData } from '@/components/undo-toast';
import { UpdateCheckWidget } from '@/components/update-check-widget';
import {
  BookOpen,
  RefreshCw,
  CheckSquare,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';

export default function LibraryPage() {
  const { t } = usePreferences();
  const [seriesList, setSeriesList] = useState<SeriesCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sort, setSort] = useState('updated');
  const [filterUpdatesOnly, setFilterUpdatesOnly] = useState(false);
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Fetch series list from API
  const fetchSeries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (search.trim()) params.set('q', search.trim());
      params.set('sort', sort);

      const res = await fetch(`/api/series?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSeriesList(data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, search, sort]);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const storedUser = localStorage.getItem('manga_tracker_user');
        const isGuest = localStorage.getItem('manga_tracker_guest');
        if (storedUser || isGuest) {
          fetchSeries();
          return;
        }

        // Check if Supabase has an active session
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            fetchSeries();
            return;
          }
        }

        // Neither logged in nor guest: show login page first
        window.location.href = '/login';
      } catch {
        fetchSeries();
      }
    };

    checkAuthAndFetch();
  }, [fetchSeries]);

  // Compute status counts for filter pills
  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: seriesList.length };
    for (const s of seriesList) {
      map[s.status] = (map[s.status] || 0) + 1;
    }
    return map;
  }, [seriesList]);

  // Handle successful save from AddMangaBar
  const handleSaveSuccess = (data: any) => {
    fetchSeries();

    if (data.undoToken && data.series && data.chapter) {
      setUndoToast({
        token: data.undoToken,
        seriesTitle: data.series.title,
        chapterLabel: data.chapter.label,
        action: data.action,
        archivedLabel: data.archivedChapter?.label,
      });
    }
  };

  // Handle undo action
  const handleUndo = async (token: string) => {
    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setUndoToast(null);
        fetchSeries();
      }
    } catch {
      // ignore
    }
  };

  // Handle series update (rename, status change)
  const handleUpdateSeries = (updated: SeriesCardData) => {
    setSeriesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  // Handle series deletion
  const handleDeleteSeries = (id: string) => {
    setSeriesList((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Toggle selection for a single series
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter by updates if active
  const displayedSeries = React.useMemo(() => {
    if (filterUpdatesOnly) {
      return seriesList.filter((s) => s.hasUpdate);
    }
    return seriesList;
  }, [seriesList, filterUpdatesOnly]);

  // Select all displayed series
  const handleSelectAll = () => {
    const allDisplayedIds = displayedSeries.map((s) => s.id);
    setSelectedIds(new Set(allDisplayedIds));
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Execute batch delete
  const handleExecuteBatchDelete = async () => {
    if (selectedIds.size === 0 || isDeletingBatch) return;

    setIsDeletingBatch(true);
    try {
      const res = await fetch('/api/series/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesIds: Array.from(selectedIds) }),
      });

      if (res.ok) {
        setIsConfirmDeleteOpen(false);
        setIsSelectMode(false);
        setSelectedIds(new Set());
        fetchSeries();
      } else {
        alert('Failed to delete selected series');
      }
    } catch {
      alert('Network error while deleting series');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Banner & Quick Add Bar */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight sm:text-3xl flex items-center gap-2.5">
              <span>{t('myLibraryTitle')}</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border font-mono">
                {seriesList.length}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('librarySubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start">
            {/* Select Mode Toggle Button */}
            <button
              onClick={() => {
                if (isSelectMode) {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                } else {
                  setIsSelectMode(true);
                }
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isSelectMode
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-xs'
                  : 'border-border bg-card text-foreground hover:bg-card-hover'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{isSelectMode ? t('cancelSelectMode') : t('selectMode')}</span>
            </button>

            {/* Refresh Library */}
            <button
              onClick={() => fetchSeries()}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-card-hover transition-colors cursor-pointer"
              title={t('refresh')}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
              <span>{t('refresh')}</span>
            </button>
          </div>
        </div>

        {/* Ingestion Paste Bar (Single / Bulk Mode) */}
        <AddMangaBar onSaveSuccess={handleSaveSuccess} />

        {/* Active Series Update Check Widget */}
        <UpdateCheckWidget
          seriesList={seriesList}
          onRefreshLibrary={fetchSeries}
          filterUpdatesOnly={filterUpdatesOnly}
          onToggleFilterUpdatesOnly={() => setFilterUpdatesOnly(!filterUpdatesOnly)}
        />
      </section>

      {/* Filters & Search */}
      <section>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          selectedStatus={selectedStatus}
          onStatusSelect={setSelectedStatus}
          sort={sort}
          onSortChange={setSort}
          counts={counts}
        />
      </section>

      {/* Series Grid */}
      <section>
        {isLoading && seriesList.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-44 rounded-2xl border border-border/40 bg-card/40 animate-pulse"
              />
            ))}
          </div>
        ) : displayedSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/30 py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3 border border-border">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {filterUpdatesOnly ? t('noUpdatesFound') : t('noSeriesFound')}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {filterUpdatesOnly
                ? t('noUpdatesHint')
                : search || selectedStatus !== 'all'
                ? t('adjustFilterHint')
                : t('noSeriesHint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedSeries.map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                onUpdate={handleUpdateSeries}
                onDelete={handleDeleteSeries}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.has(series.id)}
                onToggleSelect={() => handleToggleSelect(series.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Floating Batch Action Bar (Appears when in select mode) */}
      {isSelectMode && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-2 sm:gap-4 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
              <span>{t('selectedCount', { count: selectedIds.size })}</span>
            </div>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover transition-colors cursor-pointer"
              >
                {t('selectAll')}
              </button>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover transition-colors"
                >
                  {t('deselectAll')}
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-border" />

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-rose-600/20 transition-all hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('deleteSelected')} ({selectedIds.size})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedIds(new Set());
              }}
              className="p-1.5 rounded-xl text-gray-400 hover:text-foreground hover:bg-card-hover"
              title={t('cancelSelectMode')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bulk Delete */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t('confirmDeleteBulkTitle')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('confirmDeleteBulkDesc', { count: selectedIds.size })}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-border">
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-card-hover text-foreground text-xs font-semibold transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={handleExecuteBatchDelete}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-colors"
              >
                {isDeletingBatch ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('deleting')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>{t('confirmDelete')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating 60s Undo Notification */}
      <UndoToast
        toast={undoToast}
        onUndo={handleUndo}
        onDismiss={() => setUndoToast(null)}
      />
    </div>
  );
}
