'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Settings as SettingsIcon,
  Sparkles,
  Moon,
  Sun,
  User,
  LogOut,
  MessageSquare,
  Info,
  LogIn,
  ShieldCheck,
  HelpCircle,
  Bell,
  Menu,
  X,
  Globe,
} from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';
import { createClient } from '@/lib/supabase/client';
import { HelpModal } from '@/components/help-modal';
import { AnnouncementsModal } from '@/components/announcements-modal';

export function HeaderNavbar() {
  const pathname = usePathname();
  const { language, theme, toggleLanguage, toggleTheme, t } = usePreferences();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);

  // Modals state
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);

  const isLight = theme === 'light';
  const supabase = createClient();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  // Check unread announcements
  const checkUnreadAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok && data.success && data.announcements && data.announcements.length > 0) {
        const newest = data.announcements[0];
        const newestTime = new Date(newest.createdAt).getTime();
        const lastRead = Number(localStorage.getItem('manga_tracker_last_read_announcement_time') || 0);
        if (newestTime > lastRead) {
          setHasUnreadAnnouncements(true);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkUnreadAnnouncements();

    // 1. Check local session
    try {
      const stored = localStorage.getItem('manga_tracker_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setUser(parsed);
        }
      }
    } catch {
      // ignore
    }

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
        const local = localStorage.getItem('manga_tracker_user');
        if (!local) {
          setUser(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    try {
      localStorage.removeItem('manga_tracker_user');
      localStorage.removeItem('manga_tracker_guest');
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          
          {/* Left Brand & Desktop Navigation */}
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5 sm:gap-2 truncate">
                  {t('appTitle')}
                  <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                    {t('mvpBadge')}
                  </span>
                </span>
                <p className="text-[11px] text-muted-foreground hidden lg:block truncate max-w-xs">
                  {t('appSubtitle')}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
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

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* Help Button - Desktop Pill, Mobile Icon */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              title={t('howToUse')}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-card-hover hover:border-indigo-500/40 transition-colors cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="hidden sm:inline">{t('howToUse')}</span>
            </button>

            {/* Announcements Button - Desktop Pill, Mobile Icon with Unread Dot */}
            <button
              type="button"
              onClick={() => {
                setIsAnnouncementsOpen(true);
                setHasUnreadAnnouncements(false);
              }}
              title={t('announcements')}
              className="relative flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-card-hover hover:border-indigo-500/40 transition-colors cursor-pointer"
            >
              <div className="relative">
                <Bell className="h-4 w-4 text-foreground shrink-0" />
                {hasUnreadAnnouncements && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-background animate-pulse" />
                )}
              </div>
              <span className="hidden sm:inline">{t('announcements')}</span>
            </button>

            {/* Desktop Only Preferences: Language & Theme */}
            <div className="hidden sm:flex items-center gap-2">
              {/* Language Switcher */}
              <button
                type="button"
                onClick={toggleLanguage}
                title={t('toggleLanguage')}
                className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-card-hover transition-colors cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="uppercase tracking-wider font-mono text-[11px]">{language}</span>
              </button>

              {/* Theme Switcher */}
              <button
                type="button"
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
            </div>

            {/* Desktop User Menu */}
            <div className="hidden sm:block">
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
                    <span className="max-w-[120px] truncate">{user.email}</span>
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
                            <span>{t('navSettings')}</span>
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
                            href="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-card-hover"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Admin Dashboard</span>
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
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors shadow-xs"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>{language === 'th' ? 'เข้าสู่ระบบ' : 'Log In'}</span>
                </Link>
              )}
            </div>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              aria-label="Toggle navigation menu"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-xs hover:bg-card-hover transition-colors cursor-pointer"
            >
              {isMobileDrawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

          </div>
        </div>

        {/* Mobile Slide-down / Drawer Navigation Menu */}
        {isMobileDrawerOpen && (
          <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-xl px-4 py-4 space-y-4 shadow-xl animate-in slide-in-from-top-2 duration-150">
            
            {/* Navigation links */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors ${
                  pathname === '/'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-muted/40 text-foreground hover:bg-card-hover'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>{t('navLibrary')}</span>
              </Link>
              <Link
                href="/trash"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors ${
                  pathname === '/trash'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-muted/40 text-foreground hover:bg-card-hover'
                }`}
              >
                <span>{t('navTrash')}</span>
              </Link>
              <Link
                href="/settings"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors ${
                  pathname === '/settings'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-muted/40 text-foreground hover:bg-card-hover'
                }`}
              >
                <SettingsIcon className="h-4 w-4" />
                <span>{t('navSettings')}</span>
              </Link>
              <Link
                href="/about"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors ${
                  pathname === '/about'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-muted/40 text-foreground hover:bg-card-hover'
                }`}
              >
                <Info className="h-4 w-4" />
                <span>Credits</span>
              </Link>
            </div>

            {/* Quick Actions in Mobile Drawer: Language & Theme */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground shadow-xs"
                >
                  <Globe className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{language === 'th' ? 'ภาษาไทย' : 'English'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground shadow-xs"
                >
                  {isLight ? (
                    <>
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>{language === 'th' ? 'สว่าง' : 'Light'}</span>
                    </>
                  ) : (
                    <>
                      <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{language === 'th' ? 'มืด' : 'Dark'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Admin Link if available */}
              <Link
                href="/admin"
                className="flex items-center gap-1 text-xs text-indigo-500 hover:underline font-semibold"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin</span>
              </Link>
            </div>

            {/* Mobile User Profile or Login */}
            <div className="pt-2 border-t border-border/60">
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate">{user.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-rose-500 bg-rose-500/10 font-semibold"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{language === 'th' ? 'ออกจากระบบ' : 'Logout'}</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-xs"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{language === 'th' ? 'เข้าสู่ระบบบัญชี' : 'Log In to Account'}</span>
                </Link>
              )}
            </div>

          </div>
        )}
      </header>

      {/* Popups / Modals */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <AnnouncementsModal
        isOpen={isAnnouncementsOpen}
        onClose={() => setIsAnnouncementsOpen(false)}
        onAnnouncementsViewed={() => setHasUnreadAnnouncements(false)}
      />
    </>
  );
}
