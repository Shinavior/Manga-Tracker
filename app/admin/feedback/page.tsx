'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';

interface FeedbackItem {
  id: string;
  userId: string | null;
  type: string;
  message: string;
  pageContext: string | null;
  appVersion: string;
  userAgent: string | null;
  screenshotUrl: string | null;
  status: string;
  createdAt: string;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/feedback');
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.items || []);
      } else {
        setError(data.error || 'Failed to load feedback');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
      }
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h1 className="text-xl font-bold text-foreground">Admin Feedback Inbox</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Review user bug reports, feature requests, and beta suggestions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchFeedback}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs text-foreground cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs text-foreground shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Library</span>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-xs gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading feedback reports...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground text-xs">
          No feedback submissions recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Message</th>
                <th className="p-3">Context / Version</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((f) => (
                <tr key={f.id} className="hover:bg-card-hover/50 transition-colors">
                  <td className="p-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                    {new Date(f.createdAt).toLocaleDateString()}{' '}
                    {new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wider border ${
                        f.type === 'bug'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : f.type === 'feature'
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {f.type}
                    </span>
                  </td>
                  <td className="p-3 max-w-md">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{f.message}</p>
                    {f.screenshotUrl && (
                      <a
                        href={f.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:underline mt-1"
                      >
                        <span>View Attached Screenshot</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                    <div>{f.pageContext || '/'}</div>
                    <div className="text-[10px] text-muted-foreground/70">v{f.appVersion}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <select
                      value={f.status}
                      disabled={updatingId === f.id}
                      onChange={(e) => handleStatusChange(f.id, e.target.value)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-semibold focus:outline-none cursor-pointer transition-colors ${
                        f.status === 'resolved'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : f.status === 'reviewing'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : f.status === 'wontfix'
                          ? 'bg-muted border-border text-muted-foreground'
                          : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      <option value="open">Open</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="resolved">Resolved</option>
                      <option value="wontfix">Won&apos;t Fix</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
