import type { Metadata } from 'next';
import './globals.css';
import { BookOpen, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Manga Tracker — Smart Chapter Ingestion & Library',
  description: 'Never lose your place. Auto-merges chapters into series with one-tap continue reading.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased selection:bg-purple-600 selection:text-white">
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                    Manga Tracker
                    <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/20">
                      MVP
                    </span>
                  </span>
                  <p className="text-xs text-gray-400 hidden sm:block">
                    Smart URL resolver & automatic chapter replacer
                  </p>
                </div>
              </Link>

              <nav className="hidden sm:flex items-center gap-1">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Library
                </Link>
                <Link
                  href="/trash"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Trash (30d)
                </Link>
                <Link
                  href="/settings"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Settings & Ingestion
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="sm:hidden p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-gray-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Single User</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
