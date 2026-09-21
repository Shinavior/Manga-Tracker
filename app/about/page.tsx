'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Github, MessageSquare, ExternalLink, ArrowLeft, Heart, Code2, Database, Shield } from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';

export default function AboutPage() {
  const { t } = usePreferences();
  const version = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-beta';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">About Manga Tracker</h1>
            <p className="text-xs text-muted-foreground">Smart chapter ingestion & single-row library manager</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs font-medium text-foreground transition-colors shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t('backToLibrary') || 'Library'}</span>
        </Link>
      </div>

      {/* Main Info Card */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <span>Release</span>
            <span>v{version}</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Created by <span className="text-indigo-600 dark:text-indigo-400">Shinavior</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Manga Tracker was designed to solve the friction of tracking reading progress across disparate manga readers.
            Every chapter URL you read is parsed, canonicalized, and merged into a single clean series row with automatic 30-day chapter retention.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="https://github.com/Shinavior/Manga-Tracker"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-card-hover text-xs font-semibold text-foreground transition-colors shadow-xs"
          >
            <Github className="h-4 w-4" />
            <span>GitHub Repository</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          <Link
            href="/settings#feedback"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-xs"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Report a Bug / Feedback</span>
          </Link>
        </div>
      </div>

      {/* Tech Stack & Credits */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Code2 className="h-4 w-4 text-indigo-500" />
            <span>Framework & Styling</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Built with <strong>Next.js 15 App Router</strong>, <strong>React 19</strong>, <strong>TypeScript</strong>, and <strong>Tailwind CSS</strong>. Icons provided by <strong>Lucide React</strong>.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="h-4 w-4 text-emerald-500" />
            <span>Database & Cloud</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Persistence and multi-user authentication powered by <strong>Supabase</strong> & <strong>PostgreSQL</strong> with <strong>Drizzle ORM</strong> and Row Level Security (RLS).
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs sm:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 text-amber-500" />
            <span>Manga Metadata Attribution</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manga metadata, canonical titles, and cover art resolution are powered in part by the <strong>MangaDex API</strong>. We are grateful to the MangaDex community and open manga readers for keeping comic indexing accessible.
          </p>
        </div>
      </div>

      {/* Beta Notice & Legal */}
      <div className="p-5 rounded-2xl border border-border bg-muted/40 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          This is an open public beta release. Manga Tracker is personal reading management software and does not host comic image files.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
