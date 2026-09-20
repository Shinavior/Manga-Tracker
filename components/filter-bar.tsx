'use client';

import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  all: { label: 'All', color: 'text-gray-300', bg: 'bg-gray-800/60' },
  reading: { label: 'Reading', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  unread: { label: 'Unread', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  waiting: { label: 'Waiting', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  read: { label: 'Read', color: 'text-gray-400', bg: 'bg-gray-700/20' },
  paused: { label: 'Paused', color: 'text-slate-400', bg: 'bg-slate-700/20' },
  dropped: { label: 'Dropped', color: 'text-red-400', bg: 'bg-red-950/20' },
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
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search series by title or #tag..."
            className="w-full rounded-xl border border-border/70 bg-card/60 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-all focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
          />
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none rounded-xl border border-border/70 bg-card/60 py-2 pl-9 pr-8 text-xs font-medium text-gray-300 transition-all hover:bg-card focus:border-purple-500 focus:outline-none"
            >
              <option value="updated">Recently Updated</option>
              <option value="title">Title (A to Z)</option>
              <option value="chapter">Highest Chapter</option>
              <option value="created">Recently Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const isSelected = selectedStatus === key;
          const count = counts[key] ?? 0;

          return (
            <button
              key={key}
              onClick={() => onStatusSelect(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'border border-border/50 bg-card/40 text-gray-400 hover:bg-card hover:text-gray-200'
              }`}
            >
              <span className={isSelected ? 'text-white' : config.color}>●</span>
              <span>{config.label}</span>
              {count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? 'bg-purple-700 text-white' : 'bg-border text-gray-400'
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
