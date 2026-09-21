import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8 text-foreground">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground mt-1">Last updated: September 2026</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs font-medium shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Library</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-base font-semibold text-foreground">1. Information We Collect</h2>
        <p>
          We only collect information necessary to provide the tracking functionality:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Account Information: Your email address if you sign in via Magic Link or Google OAuth.</li>
          <li>Library Data: Chapter URLs, series names, tags, and reading progress that you explicitly save.</li>
          <li>Technical Data: Browser User-Agent and error logs when you submit a bug report.</li>
        </ul>

        <h2 className="text-base font-semibold text-foreground">2. How We Use Your Data</h2>
        <p>
          Your data is used solely to maintain your personal reading library, fetch chapter updates, and display your progress across devices. We do not sell, rent, or monetize personal information.
        </p>

        <h2 className="text-base font-semibold text-foreground">3. Data Security & Isolation</h2>
        <p>
          All library items are protected by PostgreSQL Row Level Security (RLS). Other users cannot query or access your library entries. API tokens are stored using one-way SHA-256 cryptographic hashes.
        </p>

        <h2 className="text-base font-semibold text-foreground">4. Data Deletion & Export</h2>
        <p>
          You retain full ownership of your data. You can export your library as a portable JSON file anytime via Settings, or purge your account and records permanently.
        </p>
      </div>
    </div>
  );
}
