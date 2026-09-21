'use client';

import React, { useEffect, useState } from 'react';
import { Undo2, X, CheckCircle2 } from 'lucide-react';

export interface UndoToastData {
  token: string;
  seriesTitle: string;
  chapterLabel: string;
  action: 'created' | 'updated';
  archivedLabel?: string;
}

interface UndoToastProps {
  toast: UndoToastData | null;
  onUndo: (token: string) => void;
  onDismiss: () => void;
}

export function UndoToast({ toast, onUndo, onDismiss }: UndoToastProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  useEffect(() => {
    if (!toast) return;
    setSecondsRemaining(60);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
        <CheckCircle2 className="h-5 w-5" />
      </div>

      <div className="min-w-0 pr-2">
        <div className="text-xs font-semibold text-foreground">
          {toast.action === 'created' ? 'Added new series' : 'Updated chapter'}
        </div>
        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
          <span className="text-foreground font-medium">{toast.seriesTitle}</span> → {toast.chapterLabel}
          {toast.archivedLabel && (
            <span className="text-muted-foreground"> (archived {toast.archivedLabel})</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onUndo(toast.token)}
        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs transition-all cursor-pointer"
      >
        <Undo2 className="h-3.5 w-3.5" />
        <span>Undo</span>
        <span className="rounded bg-black/20 px-1 py-0.2 text-[10px] text-white font-mono">
          {secondsRemaining}s
        </span>
      </button>

      <button
        onClick={onDismiss}
        className="rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
