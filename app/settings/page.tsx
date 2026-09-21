'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePreferences } from '@/lib/preferences-context';

interface ApiTokenItem {
  id: string;
  name: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ImportPreviewItem {
  url: string;
  seriesKey: string;
  seriesTitle: string;
  chapterLabel: string;
  isNewSeries: boolean;
  existingSeriesId?: string;
}

interface ImportPreviewData {
  dryRun: boolean;
  totalItems: number;
  newSeriesCount: number;
  existingSeriesCount: number;
  preview?: ImportPreviewItem[];
}

export default function SettingsPage() {
  const { t } = usePreferences();
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [newTokenName, setNewTokenName] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [createdRawToken, setCreatedRawToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState<string>('');
  const [tokenMode, setTokenMode] = useState<'single_user' | 'custom'>('single_user');
  const [bookmarkletType, setBookmarkletType] = useState<'toast' | 'popup'>('toast');
  const [baseUrl, setBaseUrl] = useState<string>('');

  // Backup & Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzingImport, setAnalyzingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [executingImport, setExecutingImport] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);

  // Maintenance & Cron state
  const [runningPurge, setRunningPurge] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [runningUpdateCheck, setRunningUpdateCheck] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/tokens');
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch (err) {
      console.error('Failed to load tokens', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;

    setCreatingToken(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedRawToken(data.token.rawToken);
        setCustomTokenInput(data.token.rawToken);
        setTokenMode('custom');
        setNewTokenName('');
        fetchTokens();
      }
    } catch (err) {
      console.error('Failed to create token', err);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this API token? Any bookmarklet or shortcut using it will stop working.')) {
      return;
    }

    try {
      const res = await fetch(`/api/tokens/${tokenId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTokens();
      }
    } catch (err) {
      console.error('Failed to revoke token', err);
    }
  };

  // Export JSON handler
  const handleExportData = () => {
    const token = tokenMode === 'custom' ? customTokenInput.trim() : '';
    const query = token ? `?k=${encodeURIComponent(token)}` : '';
    window.location.href = `/api/export${query}`;
  };

  // File selection for import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
    setAnalyzingImport(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dryRun', 'true');

    try {
      const res = await fetch('/api/import?dryRun=true', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportPreview(data);
      } else {
        setImportErrorMessage(data.error?.message || 'Failed to analyze import file');
        setImportPreview(null);
      }
    } catch (err) {
      setImportErrorMessage((err as Error).message);
      setImportPreview(null);
    } finally {
      setAnalyzingImport(false);
    }
  };

  // Confirm and Execute Import
  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setExecutingImport(true);
    setImportErrorMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('dryRun', 'false');

    try {
      const res = await fetch('/api/import?dryRun=false', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportSuccessMessage(`Successfully imported ${data.savedCount || 0} chapters across ${data.totalItems} items!`);
        setImportPreview(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setImportErrorMessage(data.error?.message || 'Failed to execute import');
      }
    } catch (err) {
      setImportErrorMessage((err as Error).message);
    } finally {
      setExecutingImport(false);
    }
  };

  // Run Purge Job
  const handleRunPurge = async () => {
    setRunningPurge(true);
    setPurgeResult(null);
    try {
      const res = await fetch('/api/cron/purge', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPurgeResult(`Purged ${data.purgedCount} expired chapters from storage.`);
      } else {
        setPurgeResult(`Error: ${data.error?.message || 'Failed to run purge'}`);
      }
    } catch (err) {
      setPurgeResult(`Error: ${(err as Error).message}`);
    } finally {
      setRunningPurge(false);
    }
  };

  // Run Update Check Job
  const handleRunUpdateCheck = async () => {
    setRunningUpdateCheck(true);
    setUpdateCheckResult(null);
    try {
      const res = await fetch('/api/cron/check-updates', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setUpdateCheckResult(`Checked ${data.checkedCount} series: found ${data.updatedCount} new chapters!`);
      } else {
        setUpdateCheckResult(`Error: ${data.error?.message || 'Failed to check updates'}`);
      }
    } catch (err) {
      setUpdateCheckResult(`Error: ${(err as Error).message}`);
    } finally {
      setRunningUpdateCheck(false);
    }
  };

  // Determine active token string for bookmarklet
  const activeToken = tokenMode === 'custom' ? customTokenInput.trim() : '';
  const tokenParam = activeToken ? `?k=${encodeURIComponent(activeToken)}` : '';

  // Generate Bookmarklet Code
  const toastBookmarklet = `javascript:(function(){var u=window.location.href;var t=document.title;var ep='${baseUrl}/api/save${tokenParam}';var b=document.createElement('div');b.style.cssText='position:fixed;top:20px;right:20px;background:#18181b;color:#fff;padding:14px 20px;border-radius:14px;font-family:sans-serif;font-size:13px;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.6);border:1px solid #3f3f46;display:flex;align-items:center;gap:12px;transition:all 0.3s ease;';b.innerHTML='<span style="font-size:18px">⏳</span> <span>Saving to MangaTracker...</span>';document.body.appendChild(b);fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:u,title:t})}).then(function(r){return r.json();}).then(function(d){if(d.series){b.style.borderColor='#10b981';b.style.background='#064e3b';b.innerHTML='<span style="font-size:18px">✅</span> <div><strong>Saved:</strong> '+d.series.title+' ('+d.chapter.label+')</div>';}else{b.style.borderColor='#ef4444';b.style.background='#7f1d1d';b.innerHTML='<span style="font-size:18px">❌</span> <div>'+(d.message||'Failed')+'</div>';}setTimeout(function(){b.remove();},4000);}).catch(function(e){b.style.borderColor='#ef4444';b.style.background='#7f1d1d';b.innerHTML='<span style="font-size:18px">❌</span> <div>'+e.message+'</div>';setTimeout(function(){b.remove();},4000);});})();`;

  const popupBookmarklet = `javascript:(function(){var u=encodeURIComponent(window.location.href);var t=encodeURIComponent(document.title);var k='${activeToken ? `&k=${encodeURIComponent(activeToken)}` : ''}';window.open('${baseUrl}/share?url='+u+'&title='+t+k,'_blank','width=520,height=680,scrollbars=yes');})();`;

  const activeBookmarkletCode = bookmarkletType === 'toast' ? toastBookmarklet : popupBookmarklet;

  const testToastPreview = () => {
    const b = document.createElement('div');
    b.style.cssText =
      'position:fixed;top:20px;right:20px;background:#064e3b;color:#fff;padding:14px 20px;border-radius:14px;font-family:sans-serif;font-size:13px;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.6);border:1px solid #10b981;display:flex;align-items:center;gap:12px;';
    b.innerHTML = '<span style="font-size:18px">✅</span> <div><strong>Saved:</strong> Frieren: Beyond Journey\'s End (Ch. 130)</div>';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 3500);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('settingsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('settingsSubtitle')}</p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-card hover:bg-card-hover text-foreground text-sm font-medium transition-colors border border-border"
        >
          {t('backToLibrary')}
        </Link>
      </div>

      {/* 1. Backup, Restore & Bookmarks Import */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {t('sectionBackupTitle')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('sectionBackupDesc')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Export Box */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2"><span>📦</span> {t('exportLibraryTitle')}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t('exportLibraryDesc')}</p>
            </div>
            <button
              onClick={handleExportData}
              className="w-full px-4 py-2.5 rounded-xl bg-card hover:bg-card-hover text-foreground text-xs font-semibold transition-colors border border-border flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>{t('exportDownload')}</span>
            </button>
          </div>

          {/* Import Box */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2"><span>📥</span> {t('importTitle')}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t('importDesc')}</p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.json"
                onChange={handleFileChange}
                className="hidden"
                id="import-file-input"
              />
              <label
                htmlFor="import-file-input"
                className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 cursor-pointer text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {analyzingImport ? t('analyzingFile') : t('selectFileToImport')}
              </label>
            </div>
          </div>
        </div>

        {/* Success/Error Banners */}
        {importSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <span>✅</span>
            <span>{importSuccessMessage}</span>
          </div>
        )}

        {importErrorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <span>❌</span>
            <span>{importErrorMessage}</span>
          </div>
        )}

        {/* Dry-Run Preview Modal / Panel */}
        {importPreview && (
          <div className="bg-card border border-indigo-500/40 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>🔎</span> Import Preview (Dry-Run)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Found {importPreview.totalItems} items: <strong className="text-emerald-600 dark:text-emerald-400">{importPreview.newSeriesCount} new series</strong>, <strong className="text-indigo-600 dark:text-indigo-400">{importPreview.existingSeriesCount} existing series updates</strong>.
                </p>
              </div>
              <button
                onClick={() => {
                  setImportPreview(null);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>

            {/* Preview List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-border border border-border rounded-lg">
              {importPreview.preview?.map((p, idx) => (
                <div key={idx} className="p-2.5 bg-background flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{p.seriesTitle}</div>
                    <div className="text-muted-foreground truncate text-[11px] font-mono">{p.url}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[11px] border border-border">
                      {p.chapterLabel}
                    </span>
                    {p.isNewSeries ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[11px] border border-emerald-500/20">
                        New Series
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium text-[11px] border border-indigo-500/20">
                        Update Existing
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setImportPreview(null);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 rounded-xl bg-card hover:bg-card-hover text-foreground text-xs font-medium transition-colors border border-border cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={executingImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {executingImport ? t('importing') : t('confirmAndImport')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Automated Jobs & Retention Purge */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {t('sectionJobsTitle')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('sectionJobsDesc')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Purge Job Card */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2"><span>🧹</span> {t('purgeJobTitle').replace('🧹 ','')}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t('purgeJobDesc')}</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleRunPurge}
                disabled={runningPurge}
                className="w-full px-4 py-2 rounded-xl bg-card hover:bg-card-hover disabled:opacity-50 text-foreground text-xs font-semibold transition-colors border border-border cursor-pointer shadow-xs"
              >
                {runningPurge ? t('purging') : t('runPurgeNow')}
              </button>
              {purgeResult && (
                <div className="text-[11px] text-muted-foreground bg-muted p-2 rounded-lg border border-border font-mono">
                  {purgeResult}
                </div>
              )}
            </div>
          </div>

          {/* Update Check Job Card */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2"><span>🔄</span> {t('updateJobTitle').replace('🔄 ','')}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t('updateJobDesc')}</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleRunUpdateCheck}
                disabled={runningUpdateCheck}
                className="w-full px-4 py-2 rounded-xl bg-card hover:bg-card-hover disabled:opacity-50 text-foreground text-xs font-semibold transition-colors border border-border cursor-pointer shadow-xs"
              >
                {runningUpdateCheck ? t('checking') : t('checkUpdatesNow2')}
              </button>
              {updateCheckResult && (
                <div className="text-[11px] text-muted-foreground bg-muted p-2 rounded-lg border border-border font-mono">
                  {updateCheckResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. API Tokens Section */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            {t('sectionTokensTitle')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('sectionTokensDesc')}
          </p>
        </div>

        {/* Create Token Form */}
        <form onSubmit={handleCreateToken} className="flex gap-2">
          <input
            type="text"
            required
            placeholder={t('tokenNamePlaceholder')}
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={creatingToken}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            {creatingToken ? t('generating') : t('createToken')}
          </button>
        </form>

        {/* Newly created token alert */}
        {createdRawToken && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('newTokenCreated')}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdRawToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                className="text-xs px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium transition-colors cursor-pointer"
              >
                {copiedToken ? t('copied') : t('copyKey')}
              </button>
            </div>
            <code className="block bg-background p-2.5 rounded-lg text-xs font-mono text-emerald-600 dark:text-emerald-300 break-all select-all border border-emerald-500/20">
              {createdRawToken}
            </code>
          </div>
        )}

        {/* Active Tokens List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('activeTokens')}</h3>
          {loadingTokens ? (
            <div className="text-xs text-muted-foreground py-3">{t('loadingTokens')}</div>
          ) : tokens.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3 bg-background rounded-xl border border-border px-4">{t('noTokensYet')}</div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {tokens.map((token) => (
                <div key={token.id} className="p-3 bg-background flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      {token.name}
                      <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
                        ...{token.lastFour}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Created: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt && ` · Last used: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeToken(token.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-medium transition-colors border border-rose-500/20 cursor-pointer"
                  >
                    {t('revokeToken')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. One-Tap Bookmarklet Section */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {t('sectionBookmarkletTitle')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t('sectionBookmarkletDesc')}
            </p>
          </div>
          <button
            onClick={testToastPreview}
            className="text-xs px-3 py-1.5 rounded-lg bg-card hover:bg-card-hover text-foreground font-medium border border-border cursor-pointer"
          >
            {t('testToastPreview')}
          </button>
        </div>

        {/* Configuration Tabs */}
        <div className="bg-background border border-border rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Auth Mode */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Authentication
              </label>
              <div className="flex rounded-lg bg-card p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setTokenMode('single_user')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    tokenMode === 'single_user' ? 'bg-indigo-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Single User Mode
                </button>
                <button
                  type="button"
                  onClick={() => setTokenMode('custom')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    tokenMode === 'custom' ? 'bg-indigo-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Custom API Key
                </button>
              </div>
            </div>

            {/* Bookmarklet Behavior */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Action Style
              </label>
              <div className="flex rounded-lg bg-card p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setBookmarkletType('toast')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    bookmarkletType === 'toast' ? 'bg-indigo-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  In-Page Toast (Silent)
                </button>
                <button
                  type="button"
                  onClick={() => setBookmarkletType('popup')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    bookmarkletType === 'popup' ? 'bg-indigo-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Popup Window
                </button>
              </div>
            </div>
          </div>

          {/* Custom Token Input (if custom selected) */}
          {tokenMode === 'custom' && (
            <div className="pt-2 border-t border-border">
              <label className="block text-xs font-medium text-foreground mb-1">
                API Token to embed:
              </label>
              <input
                type="text"
                placeholder="Paste mgt_... raw token"
                value={customTokenInput}
                onChange={(e) => setCustomTokenInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Draggable button */}
        <div className="p-6 bg-background border border-border rounded-xl text-center space-y-3">
          <p className="text-xs text-muted-foreground">{t('dragInstruction')}</p>
          <div>
            <a
              href={activeBookmarkletCode}
              onClick={(e) => {
                e.preventDefault();
                alert('👉 Drag this button to your browser Bookmarks Bar (Ctrl+Shift+B / Cmd+Shift+B to show bookmarks bar).');
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-sm shadow-xs cursor-grab active:cursor-grabbing transition-all border border-amber-400 select-none"
            >
              <span>📌 + Track Manga</span>
            </a>
          </div>
          <p className="text-[11px] text-muted-foreground">
            (Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">Ctrl+Shift+B</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">Cmd+Shift+B</kbd> to show bookmarks bar)
          </p>
        </div>

        {/* Code inspection & copy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bookmarklet JavaScript</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeBookmarkletCode);
                setCopiedBookmarklet(true);
                setTimeout(() => setCopiedBookmarklet(false), 2000);
              }}
              className="text-xs px-3 py-1 rounded bg-card hover:bg-card-hover text-foreground font-medium transition-colors border border-border cursor-pointer shadow-xs"
            >
              {copiedBookmarklet ? '✓ Copied Code' : 'Copy Code'}
            </button>
          </div>
          <pre className="bg-background p-3 rounded-xl text-xs font-mono text-muted-foreground overflow-x-auto border border-border max-h-24">
            {activeBookmarkletCode}
          </pre>
        </div>
      </section>

      {/* 5. Mobile Sharing (iOS Shortcuts & Android PWA) */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
              {t('sectionMobileTitle')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('sectionMobileDesc')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* iOS Shortcuts Card */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="text-base">🍎</span> iOS Shortcut (Share Sheet)
            </div>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
              <li>Open the <strong>Shortcuts</strong> app on your iPhone or iPad.</li>
              <li>Create a new shortcut named <strong>"Track Manga"</strong>.</li>
              <li>Enable <strong>"Show in Share Sheet"</strong> for URLs and Safari web pages.</li>
              <li>
                Add action <strong>"Get Contents of URL"</strong>:
                <div className="bg-card p-2 rounded mt-1 font-mono text-[11px] text-foreground border border-border">
                  URL: {baseUrl || 'http://localhost:3000'}/api/save<br/>
                  Method: POST<br/>
                  Headers: Authorization: Bearer &lt;YOUR_TOKEN&gt;<br/>
                  Body: JSON {"{ \"url\": Shortcut Input }"}
                </div>
              </li>
              <li>Add action <strong>"Show Notification"</strong> with result message.</li>
            </ol>
          </div>

          {/* Android Web Share Target Card */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="text-base">🤖</span> Android & Chrome PWA
            </div>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
              <li>Open this website in <strong>Google Chrome</strong> on Android.</li>
              <li>Tap the menu &rarr; <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
              <li>
                Once installed as a PWA, <strong>Manga Chapter Tracker</strong> will appear directly in your system <strong>Share Sheet</strong>!
              </li>
              <li>
                Whenever you share a chapter URL from Chrome or any reading app, select Manga Chapter Tracker to save it instantly.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
