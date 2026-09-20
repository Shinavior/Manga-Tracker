'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ApiTokenItem {
  id: string;
  name: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
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
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings & Integrations</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure mobile share targets, API tokens, and 1-tap browser bookmarklets
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors border border-zinc-700"
        >
          &larr; Back to Library
        </Link>
      </div>

      {/* 1. API Tokens Section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            API Tokens
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            API tokens allow external tools like iOS Shortcuts, bookmarklets, and browser extensions to save manga to your library securely.
          </p>
        </div>

        {/* Create Token Form */}
        <form onSubmit={handleCreateToken} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="Token name (e.g. My iPhone, Safari Bookmarklet)"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={creatingToken}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20 whitespace-nowrap"
          >
            {creatingToken ? 'Generating...' : 'Create Token'}
          </button>
        </form>

        {/* Newly created token alert */}
        {createdRawToken && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                New Token Created! Copy it now (it will not be shown again):
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdRawToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                className="text-xs px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium transition-colors"
              >
                {copiedToken ? '✓ Copied' : 'Copy Key'}
              </button>
            </div>
            <code className="block bg-zinc-950 p-2.5 rounded-lg text-xs font-mono text-emerald-300 break-all select-all border border-emerald-900/50">
              {createdRawToken}
            </code>
          </div>
        )}

        {/* Active Tokens List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Tokens</h3>
          {loadingTokens ? (
            <div className="text-xs text-zinc-500 py-3">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="text-xs text-zinc-500 py-3 bg-zinc-950/50 rounded-xl border border-zinc-800/80 px-4">
              No API tokens created yet. (Single-user mode will accept unauthenticated requests by default).
            </div>
          ) : (
            <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
              {tokens.map((token) => (
                <div key={token.id} className="p-3 bg-zinc-950/60 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {token.name}
                      <span className="text-xs font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800">
                        ...{token.lastFour}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Created: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt && ` · Last used: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeToken(token.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium transition-colors border border-rose-500/20"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. One-Tap Bookmarklet Section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              1-Tap Browser Bookmarklet
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Drag the button below to your browser bookmarks bar. When reading any manga online, click it to save instantly!
            </p>
          </div>
          <button
            onClick={testToastPreview}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium border border-zinc-700"
          >
            🧪 Test Toast Preview
          </button>
        </div>

        {/* Configuration Tabs */}
        <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Auth Mode */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Authentication
              </label>
              <div className="flex rounded-lg bg-zinc-900 p-1 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTokenMode('single_user')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                    tokenMode === 'single_user' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Single User Mode
                </button>
                <button
                  type="button"
                  onClick={() => setTokenMode('custom')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                    tokenMode === 'custom' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Custom API Key
                </button>
              </div>
            </div>

            {/* Bookmarklet Behavior */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Action Style
              </label>
              <div className="flex rounded-lg bg-zinc-900 p-1 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setBookmarkletType('toast')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                    bookmarkletType === 'toast' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  In-Page Toast (Silent)
                </button>
                <button
                  type="button"
                  onClick={() => setBookmarkletType('popup')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                    bookmarkletType === 'popup' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Popup Window
                </button>
              </div>
            </div>
          </div>

          {/* Custom Token Input (if custom selected) */}
          {tokenMode === 'custom' && (
            <div className="pt-2 border-t border-zinc-800/80">
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                API Token to embed:
              </label>
              <input
                type="text"
                placeholder="Paste mgt_... raw token"
                value={customTokenInput}
                onChange={(e) => setCustomTokenInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Draggable button */}
        <div className="p-6 bg-zinc-950/70 border border-zinc-800 rounded-xl text-center space-y-3">
          <p className="text-xs text-zinc-400">
            👉 Drag this button to your Bookmarks Bar:
          </p>
          <div>
            <a
              href={activeBookmarkletCode}
              onClick={(e) => {
                // Prevent navigation when clicked directly on page
                e.preventDefault();
                alert('👉 Drag this button to your browser Bookmarks Bar (Ctrl+Shift+B / Cmd+Shift+B to show bookmarks bar).');
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 cursor-grab active:cursor-grabbing hover:brightness-110 transition-all border border-amber-400 select-none"
            >
              <span>📌 + Track Manga</span>
            </a>
          </div>
          <p className="text-[11px] text-zinc-500">
            (Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Ctrl+Shift+B</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Cmd+Shift+B</kbd> to show bookmarks bar)
          </p>
        </div>

        {/* Code inspection & copy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Bookmarklet JavaScript</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeBookmarkletCode);
                setCopiedBookmarklet(true);
                setTimeout(() => setCopiedBookmarklet(false), 2000);
              }}
              className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors border border-zinc-700"
            >
              {copiedBookmarklet ? '✓ Copied Code' : 'Copy Code'}
            </button>
          </div>
          <pre className="bg-zinc-950 p-3 rounded-xl text-xs font-mono text-zinc-400 overflow-x-auto border border-zinc-800 max-h-24">
            {activeBookmarkletCode}
          </pre>
        </div>
      </section>

      {/* 3. Mobile Sharing (iOS Shortcuts & Android PWA) */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Mobile Sharing & PWA Setup
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configure mobile sharing from Safari, Chrome, and reading apps.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* iOS Shortcuts Card */}
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="text-base">🍎</span> iOS Shortcut (Share Sheet)
            </div>
            <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Open the <strong>Shortcuts</strong> app on your iPhone or iPad.</li>
              <li>Create a new shortcut named <strong>"Track Manga"</strong>.</li>
              <li>Enable <strong>"Show in Share Sheet"</strong> for URLs and Safari web pages.</li>
              <li>
                Add action <strong>"Get Contents of URL"</strong>:
                <div className="bg-zinc-900 p-2 rounded mt-1 font-mono text-[11px] text-zinc-300 border border-zinc-800">
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
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="text-base">🤖</span> Android & Chrome PWA
            </div>
            <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside leading-relaxed">
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
