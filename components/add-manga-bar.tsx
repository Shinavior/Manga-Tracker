'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Link as LinkIcon, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { ResolveResult } from '@/lib/resolver/types';

interface AddMangaBarProps {
  onSaveSuccess: (result: any) => void;
}

export function AddMangaBar({ onSaveSuccess }: AddMangaBarProps) {
  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-resolve when a valid-looking URL is typed or pasted
  useEffect(() => {
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
  }, [url]);

  const handleSave = async (e: React.FormEvent) => {
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

  return (
    <div className="w-full rounded-2xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur-md">
      <form onSubmit={handleSave} className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
              {isResolving ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any chapter URL (e.g. Nekopost, MangaDex, etc.)..."
              className="w-full rounded-xl border border-border/80 bg-background/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
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
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Track Chapter</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300 border border-red-800/40">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Preview Card */}
        {preview && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/15 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              {preview.coverUrl ? (
                <img
                  src={preview.coverUrl}
                  alt={preview.seriesTitle || 'Cover'}
                  className="h-16 w-12 rounded-lg object-cover border border-purple-500/20"
                />
              ) : (
                <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-purple-900/30 text-purple-400 text-xs font-semibold">
                  Manga
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white text-sm truncate">
                    {preview.seriesTitle || 'Untitled Series'}
                  </h4>
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300 uppercase tracking-wide">
                    {preview.source}
                  </span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    {preview.chapterLabel}
                  </span>
                </div>

                <p className="text-xs text-gray-400 truncate mt-0.5 font-mono">
                  Key: {preview.seriesKey}
                </p>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Custom series title (optional)"
                    className="w-full rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Tags (comma separated, e.g. action, isekai)"
                    className="w-full rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
