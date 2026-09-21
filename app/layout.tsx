import type { Metadata } from 'next';
import './globals.css';
import { PreferencesProvider } from '@/lib/preferences-context';
import { HeaderNavbar } from '@/components/header-navbar';

export const metadata: Metadata = {
  title: 'Manga Tracker — Smart Chapter Ingestion & Library',
  description: 'Never lose your place. Auto-merges chapters into series with one-tap continue reading.',
  manifest: '/manifest.json',
  referrer: 'no-referrer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased selection:bg-indigo-600 selection:text-white transition-colors duration-200">
        <PreferencesProvider>
          {/* Top Beta Banner */}
          <div className="bg-indigo-600/10 border-b border-indigo-500/20 px-4 py-1.5 text-center text-xs text-indigo-700 dark:text-indigo-300 font-medium flex items-center justify-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>
              Manga Tracker <strong>Beta v0.1.0</strong> — Found a bug or have an idea?{' '}
              <a href="/settings#feedback" className="underline font-semibold hover:text-indigo-800 dark:hover:text-indigo-200">
                Send feedback
              </a>
            </span>
          </div>
          <HeaderNavbar />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </PreferencesProvider>
      </body>
    </html>
  );
}

