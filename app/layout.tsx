import type { Metadata } from 'next';
import './globals.css';
import { PreferencesProvider } from '@/lib/preferences-context';
import { HeaderNavbar } from '@/components/header-navbar';

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
      <body className="bg-background text-foreground antialiased selection:bg-purple-600 selection:text-white transition-colors duration-200">
        <PreferencesProvider>
          <HeaderNavbar />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </PreferencesProvider>
      </body>
    </html>
  );
}

