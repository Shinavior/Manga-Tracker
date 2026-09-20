'use client';

import React from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { usePreferences, Translations } from '@/lib/preferences-context';

export const STATUS_CONFIG: Record<
  string,
  { labelKey: keyof Translations; color: string; bg: string }
> = {
  all: { labelKey: 'statusAll', color: 'text-gray-400 dark:text-gray-300', bg: 'bg-gray-500/10' },
  reading: { labelKey: 'statusReading', color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  unread: { labelKey: 'statusUnread', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
  waiting: { labelKey: 'statusWaiting', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
  read: { labelKey: 'statusRead', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-500/10' },
  paused: { labelKey: 'statusPaused', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/10' },
  dropped: { labelKey: 'statusDropped', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10' },
};

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedStatus: string;
  onStatusSelect: (status: string) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  counts: Record<string, number>;
}

export function FilterBar({
  search,
  onSearchChange,
  selectedStatus,
  onStatusSelect,
  sort,
  onSortChange,
  counts,
}: FilterBarProps) {
  const { t } = usePreferences();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-xl border border-border/70 bg-card/80 py-2 pl-10 pr-4 text-sm text-foreground placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
          />
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none rounded-xl border border-border/70 bg-card/80 py-2 pl-9 pr-8 text-xs font-medium text-foreground transition-all hover:bg-card focus:border-purple-500 focus:outline-none cursor-pointer"
            >
              <option value="updated">{t('sortUpdated')}</option>
              <option value="title">{t('sortTitle')}</option>
              <option value="chapter">{t('sortChapter')}</option>
              <option value="created">{t('sortCreated')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const isSelected = selectedStatus === key;
          const count = counts[key] ?? 0;
          const label = t(config.labelKey);

          return (
            <button
              key={key}
              onClick={() => onStatusSelect(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'border border-border/60 bg-card/60 text-gray-600 dark:text-gray-400 hover:bg-card hover:text-foreground'
              }`}
            >
              <span className={isSelected ? 'text-white' : config.color}>●</span>
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected
                      ? 'bg-purple-700 text-white'
                      : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
