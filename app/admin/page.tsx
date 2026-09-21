'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Layers,
  MessageSquare,
  Globe,
  Activity,
  ExternalLink,
  Loader2,
  TrendingUp,
  Clock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { AdminNav } from '@/components/admin/admin-nav';

interface StatsData {
  metrics: {
    totalUsers: number;
    totalSeries: number;
    totalChapters: number;
    totalFeedback: number;
    openFeedback: number;
  };
  statusBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  topHosts: Array<{ host: string; count: number }>;
  recentSeries: Array<{
    id: string;
    title: string;
    source: string;
    status: string;
    updatedAt: string;
  }>;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch admin stats');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalSeries = data?.metrics.totalSeries || 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <AdminNav
        title="Admin Overview & Analytics"
        subtitle="Live database metrics, reader activity, and visitor tracking insights"
        onRefresh={fetchStats}
        loading={loading}
      />

      {error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5" />
            <span>Admin Access Restricted</span>
          </div>
          <p className="text-xs">{error}</p>
          <p className="text-[11px] text-muted-foreground mt-2">
            Make sure you are logged in with the email configured in <code className="font-mono">ADMIN_EMAIL</code>, or run in single-user development mode.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-xs gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span>Aggregating system statistics...</span>
        </div>
      ) : data ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Users</span>
                <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {data.metrics.totalUsers}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Registered accounts
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tracked Series</span>
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <BookOpen className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {data.metrics.totalSeries}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Unique titles in libraries
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Saved Chapters</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {data.metrics.totalChapters}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Total ingestion records
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Feedback Inbox</span>
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                    data.metrics.openFeedback > 0
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  {data.metrics.openFeedback}
                  {data.metrics.openFeedback > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Open
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {data.metrics.totalFeedback} total submissions
                </div>
              </div>
            </div>
          </div>

          {/* Vercel Web Analytics Highlight Card */}
          <div className="p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-card to-card shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>Web Traffic & Visitor Analytics</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold">
                      Live Tracking
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time visitor counts, pageviews, referrers, and device metrics powered by Vercel Analytics.
                  </p>
                </div>
              </div>

              <a
                href="https://vercel.com/analytics"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span>Open Vercel Dashboard</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl border border-border/60 bg-background/50">
                <div className="font-semibold text-foreground">Traffic Tracking</div>
                <div className="text-muted-foreground text-[11px] mt-1">
                  Active in production via <code className="font-mono">@vercel/analytics</code> injected into root layout.
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-background/50">
                <div className="font-semibold text-foreground">Privacy Friendly</div>
                <div className="text-muted-foreground text-[11px] mt-1">
                  GDPR & CCPA compliant without invasive cookie banners or personal tracking cookies.
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-background/50">
                <div className="font-semibold text-foreground">Performance Metrics</div>
                <div className="text-muted-foreground text-[11px] mt-1">
                  Collects Core Web Vitals, speed index, and user latency across mobile and desktop.
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Sections: Status & Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reading Status Breakdown */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-foreground">Manga Status Distribution</h2>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{totalSeries} series</span>
              </div>

              <div className="space-y-3.5">
                {[
                  { key: 'reading', label: 'Reading', color: 'bg-indigo-500' },
                  { key: 'unread', label: 'Unread', color: 'bg-blue-500' },
                  { key: 'read', label: 'Completed', color: 'bg-emerald-500' },
                  { key: 'paused', label: 'Paused', color: 'bg-amber-500' },
                  { key: 'dropped', label: 'Dropped', color: 'bg-rose-500' },
                ].map((item) => {
                  const count = data.statusBreakdown[item.key] || 0;
                  const pct = totalSeries > 0 ? Math.round((count / totalSeries) * 100) : 0;

                  return (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reading Sources & Domains */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-foreground">Top Sources & Adapters</h2>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {Object.keys(data.sourceBreakdown).length} sources
                </span>
              </div>

              {Object.keys(data.sourceBreakdown).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No source data recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(data.sourceBreakdown).map(([source, count]) => {
                    const pct = totalSeries > 0 ? Math.round((count / totalSeries) * 100) : 0;
                    return (
                      <div
                        key={source}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-card-hover transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {source.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-foreground uppercase tracking-wider">
                              {source}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {source === 'mangadex' ? 'MangaDex API' : 'Direct web crawler'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-foreground">{count}</div>
                          <div className="text-[10px] text-muted-foreground">{pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Series Updates Stream */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-foreground">Recently Active Series</h2>
              </div>
              <span className="text-xs text-muted-foreground">Latest library modifications</span>
            </div>

            {data.recentSeries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No series recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                      <th className="pb-2.5">Title</th>
                      <th className="pb-2.5">Source</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.recentSeries.map((s) => (
                      <tr key={s.id} className="hover:bg-card-hover/50 transition-colors">
                        <td className="py-2.5 font-medium text-foreground">{s.title}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-muted border border-border text-muted-foreground">
                            {s.source}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className="capitalize text-muted-foreground">{s.status}</span>
                        </td>
                        <td className="py-2.5 text-muted-foreground font-mono text-[11px]">
                          {new Date(s.updatedAt).toLocaleDateString()}{' '}
                          {new Date(s.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
