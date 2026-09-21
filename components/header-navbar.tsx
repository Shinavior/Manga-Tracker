'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Settings as SettingsIcon, Sparkles, Moon, Sun, User, LogOut, MessageSquare, Info, LogIn } from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';
import { createClient } from '@/lib/supabase/client';

export function HeaderNavbar() {
  const pathname = usePathname();
  const { language, theme, toggleLanguage, toggleTheme, t } = usePreferences();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);

  const isLight = theme === 'light';
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setSupabaseConfigured(false);
      return;
    }
    setSupabaseConfigured(true);

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      window.location.href = '/';
    }
  };

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
              <p className="text-xs text-muted-foreground hidden sm:block">
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
            <Link
              href="/about"
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                pathname === '/about'
                  ? 'bg-card text-foreground font-semibold border border-border shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-hover'
              }`}
            >
              Credits
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle (TH / EN) */}
          <button
            onClick={toggleLanguage}
            title={t('toggleLanguage')}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-card-hover transition-colors cursor-pointer"
          >
            <span className="text-sm leading-none">{language === 'th' ? '🇹🇭' : '🇬🇧'}</span>
            <span className="uppercase tracking-wider">{language}</span>
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            title={t('toggleTheme')}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-border bg-card text-foreground shadow-xs hover:bg-card-hover transition-colors cursor-pointer"
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

          {/* User Auth Menu */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-card-hover transition-colors cursor-pointer shadow-xs"
              >
                <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="max-w-[120px] truncate hidden md:inline">{user.email}</span>
              </button>

              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 divide-y divide-border/60">
                    <div className="px-2.5 py-1.5 text-xs">
                      <div className="font-semibold text-foreground truncate">{user.email}</div>
                      <div className="text-[10px] text-muted-foreground">Connected Account</div>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-card-hover"
                      >
                        <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Settings</span>
                      </Link>
                      <Link
                        href="/settings#feedback"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-card-hover"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Feedback & Bugs</span>
                      </Link>
                      <Link
                        href="/about"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-card-hover"
                      >
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Credits / About</span>
                      </Link>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-medium cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : supabaseConfigured ? (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>เข้าสู่ระบบ</span>
            </Link>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>{t('singleUser')}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
