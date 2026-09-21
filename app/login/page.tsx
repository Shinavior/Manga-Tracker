'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Mail, ArrowRight, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';

function LoginForm() {
  const { t } = usePreferences();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setIsConfigured(false);
    }

    const err = searchParams.get('error');
    if (err) {
      setErrorMessage('Authentication failed or link expired. Please try again.');
    }
  }, [supabase, searchParams]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (!supabase) {
      setErrorMessage(
        'Supabase Auth ยังไม่ได้ตั้งค่าใน .env.local — กรุณาระบุ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY เพื่อใช้งาน Magic Link'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setMagicSent(true);
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setErrorMessage(
        'Supabase Auth ยังไม่ได้ตั้งค่าใน .env.local — กรุณาระบุ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY เพื่อใช้งาน Google Sign-In'
      );
      return;
    }
    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'Google sign-in failed');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* App Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('appTitle') || 'Manga Tracker'}
          </h1>
          <p className="text-sm text-muted-foreground">
            เข้าสู่ระบบเพื่อซิงก์คลังมังงะข้ามอุปกรณ์ของคุณ
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 space-y-5">
          {!isConfigured && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                <span>โหมดผู้ใช้งานเดี่ยว (Single-User Mode)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-200/80">
                ขณะนี้ระบบทำงานแบบออฟไลน์/ผู้ใช้เดี่ยว คุณสามารถใช้งานคลังมังงะได้ทันทีโดยไม่ต้องเข้าสู่ระบบ
              </p>
              <div className="pt-1 text-[11px] text-amber-900/70 dark:text-amber-300/70">
                หากต้องการเปิดระบบ Multi-User ให้ตั้งค่า <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> ใน <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono">.env.local</code>
              </div>
            </div>
          )}

          {magicSent ? (
            <div className="space-y-4 text-center py-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We sent a magic sign-in link to <strong className="text-foreground">{email}</strong>.
                  Click the link to log into Manga Tracker.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMagicSent(false)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline pt-2 cursor-pointer"
              >
                Use another email address
              </button>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-border bg-background hover:bg-card-hover text-foreground text-sm font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-border" />
                <span className="relative bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Or with email
                </span>
              </div>

              {/* Email Magic Link Form */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading || !email.trim()}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Magic Link</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="pt-2 border-t border-border/60 text-center">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Return to Library
            </Link>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors">
            About
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
