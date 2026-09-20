'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AddMangaBar } from '@/components/add-manga-bar';
import { FilterBar } from '@/components/filter-bar';
import { SeriesCard, SeriesCardData } from '@/components/series-card';
import { UndoToast, UndoToastData } from '@/components/undo-toast';
import { BookOpen, Layers, Sparkles, RefreshCw } from 'lucide-react';

export default function LibraryPage() {
  const [seriesList, setSeriesList] = useState<SeriesCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sort, setSort] = useState('updated');
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);

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
    fetchSeries();
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
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Quick Add Bar */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl flex items-center gap-2.5">
              <span>My Manga Library</span>
              <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300 border border-purple-500/30">
                {seriesList.length}
              </span>
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Paste any chapter URL to automatically update or create series.
            </p>
          </div>

          <button
            onClick={() => fetchSeries()}
            className="flex items-center gap-1.5 self-start rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-gray-300 hover:bg-card hover:text-white transition-colors"
            title="Refresh Library"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Ingestion Paste Bar */}
        <AddMangaBar onSaveSuccess={handleSaveSuccess} />
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
        ) : seriesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/30 py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-3 border border-purple-500/20">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-white">No series found</h3>
            <p className="mt-1 text-xs text-gray-400 max-w-sm">
              {search || selectedStatus !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Paste a chapter URL in the box above to start tracking your reading list.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                onUpdate={handleUpdateSeries}
                onDelete={handleDeleteSeries}
              />
            ))}
          </div>
        )}
      </section>

      {/* Floating 60s Undo Notification */}
      <UndoToast
        toast={undoToast}
        onUndo={handleUndo}
        onDismiss={() => setUndoToast(null)}
      />
    </div>
  );
}
