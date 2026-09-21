import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8 text-foreground">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold">Terms of Service</h1>
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
        <h2 className="text-base font-semibold text-foreground">1. Beta Software Disclaimer</h2>
        <p>
          Manga Tracker is currently provided as a public beta application. The service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. While we do our best to maintain data persistence, features may change, and temporary downtime or data resets may occur during active development.
        </p>

        <h2 className="text-base font-semibold text-foreground">2. Non-Hosting & Personal Bookmarking</h2>
        <p>
          Manga Tracker does not host, upload, or store any manga image files, pirated scans, or copyrighted comic panels. It is strictly a personal URL bookmarking and reading progression tracker. All chapter links point to external third-party sites over which Manga Tracker has no ownership or control.
        </p>

        <h2 className="text-base font-semibold text-foreground">3. User Responsibilities</h2>
        <p>
          You are responsible for keeping your account credentials, sessions, and generated API tokens secure. You agree not to abuse or attempt denial-of-service against the API endpoints.
        </p>

        <h2 className="text-base font-semibold text-foreground">4. Changes & Termination</h2>
        <p>
          We reserve the right to modify or discontinue features at any time. You may delete your account and data at any time through the application settings.
        </p>
      </div>
    </div>
  );
}
