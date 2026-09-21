'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { extractUrlFromSharePayload } from '@/lib/utils/share';

interface SaveSuccessData {
  action: 'created' | 'updated' | 'noop';
  wentBackward: boolean;
  series: {
    id: string;
    title: string;
    coverUrl: string | null;
    status: string;
    tags: string[];
    confidence: string;
    needsReview: boolean;
  };
  chapter: {
    id: string;
    url: string;
    label: string;
    number: number | null;
  };
}

function ShareContent() {
  const searchParams = useSearchParams();

  const rawUrl = searchParams.get('url');
  const rawText = searchParams.get('text');
  const rawTitle = searchParams.get('title');
  const apiKey = searchParams.get('k') || searchParams.get('token');

  const [extractedUrl, setExtractedUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveSuccessData | null>(null);

  useEffect(() => {
    const found = extractUrlFromSharePayload(rawUrl, rawText, rawTitle);
    if (found) {
      setExtractedUrl(found);
      performSave(found);
    }
  }, [rawUrl, rawText, rawTitle]);

  const performSave = async (targetUrl: string) => {
    if (!targetUrl) return;
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`/api/save${apiKey ? `?k=${encodeURIComponent(apiKey)}` : ''}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to save manga chapter');
      }

      setSaveResult(data);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (extractedUrl.trim()) {
      performSave(extractedUrl.trim());
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Quick Ingestion</h1>
        <p className="text-sm text-zinc-400 mt-1">Receive & save shared manga chapters instantly</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-xl">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent mb-4"></div>
          <h3 className="text-lg font-medium text-white">Saving Chapter...</h3>
          <p className="text-xs text-zinc-400 mt-1 truncate max-w-sm mx-auto">{extractedUrl}</p>
        </div>
      )}

      {/* Success result */}
      {!loading && saveResult && (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                {saveResult.action === 'created' ? 'New Series Added' : 'Chapter Updated'}
              </span>
              <h2 className="text-lg font-bold text-white leading-tight mt-0.5">
                {saveResult.series.title}
              </h2>
            </div>
          </div>

          <div className="bg-zinc-950/80 rounded-xl p-4 border border-zinc-800 flex items-center gap-4">
            {saveResult.series.coverUrl && (
              <img
                src={saveResult.series.coverUrl}
                alt={saveResult.series.title}
                referrerPolicy="no-referrer"
                className="w-14 h-20 object-cover rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-400">Current Chapter</div>
              <div className="text-base font-semibold text-indigo-300 truncate">
                {saveResult.chapter.label}
              </div>
              <div className="text-xs text-zinc-500 mt-1 truncate">
                {saveResult.chapter.url}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <a
              href={saveResult.chapter.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm text-center transition-colors shadow-lg shadow-indigo-600/20"
            >
              Open Chapter
            </a>
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm text-center transition-colors border border-zinc-700"
            >
              Go to Library
            </Link>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-6 shadow-xl mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-300">Failed to Save</h3>
              <p className="text-xs text-zinc-400 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Manual URL Input / Retry fallback */}
      {!loading && !saveResult && (
        <form onSubmit={handleManualSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Manga or Chapter URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              required
              placeholder="https://mangadex.org/chapter/..."
              value={extractedUrl}
              onChange={(e) => setExtractedUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
            >
              Save
            </button>
          </div>
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
              &larr; Back to Library
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto py-12 px-4 text-center text-zinc-500">
          Loading share receiver...
        </div>
      }
    >
      <ShareContent />
    </Suspense>
  );
}
