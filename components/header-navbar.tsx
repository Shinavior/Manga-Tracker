'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Settings as SettingsIcon, Sparkles, Moon, Sun, Globe } from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';

export function HeaderNavbar() {
  const pathname = usePathname();
  const { language, theme, toggleLanguage, toggleTheme, t } = usePreferences();

  const isLight = theme === 'light';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                {t('appTitle')}
                <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {t('mvpBadge')}
                </span>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {t('appSubtitle')}
              </p>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1.5">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                pathname === '/'
                  ? 'bg-card text-foreground font-semibold border border-border shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-hover'
              }`}
            >
              {t('navLibrary')}
            </Link>
            <Link
              href="/trash"
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                pathname === '/trash'
                  ? 'bg-card text-foreground font-semibold border border-border shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-hover'
              }`}
            >
              {t('navTrash')}
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                pathname === '/settings'
                  ? 'bg-card text-foreground font-semibold border border-border shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-hover'
              }`}
            >
              {t('navSettings')}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle (TH / EN) */}
          <button
            onClick={toggleLanguage}
            title={t('toggleLanguage')}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-card-hover transition-colors"
          >
            <span className="text-sm leading-none">{language === 'th' ? '🇹🇭' : '🇬🇧'}</span>
            <span className="uppercase tracking-wider">{language}</span>
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            title={t('toggleTheme')}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-card-hover transition-colors"
          >
            {isLight ? (
              <Sun className="h-4 w-4 text-amber-500 animate-in spin-in-180 duration-200" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400 animate-in spin-in-180 duration-200" />
            )}
          </button>

          <Link
            href="/settings"
            className="sm:hidden p-2 rounded-lg border border-border bg-card text-foreground hover:bg-card-hover"
            title={t('navSettings')}
          >
            <SettingsIcon className="w-4 h-4" />
          </Link>

          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-gray-600 dark:text-gray-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span>{t('singleUser')}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
