'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, BarChart3, MessageSquare, ArrowLeft, RefreshCw } from 'lucide-react';

interface AdminNavProps {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export function AdminNav({ title, subtitle, onRefresh, loading = false }: AdminNavProps) {
  const pathname = usePathname();

  const isOverview = pathname === '/admin';
  const isFeedback = pathname === '/admin/feedback';

  return (
    <div className="space-y-4 border-b border-border pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs text-foreground cursor-pointer shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs text-foreground shadow-xs transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Library</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href="/admin"
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isOverview
              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
              : 'border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-card-hover'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Overview & Analytics</span>
        </Link>
        <Link
          href="/admin/feedback"
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isFeedback
              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
              : 'border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-card-hover'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Feedback Inbox</span>
        </Link>
      </div>
    </div>
  );
}
