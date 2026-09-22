'use client';

import React from 'react';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Lightweight and safe Markdown renderer for announcement posts.
 * Supports:
 * - Images: ![alt](url)
 * - Links: [text](url)
 * - Bold: **text**
 * - Inline code: `code`
 * - Line breaks and paragraphs
 */
export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  if (!content) return null;

  // Split into lines to parse line-by-line / block-by-block
  const lines = content.split('\n');

  return (
    <div className={`space-y-2 text-xs sm:text-[13px] leading-relaxed text-muted-foreground ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Empty line -> small spacer
        if (!trimmed) {
          return <div key={lineIdx} className="h-2" />;
        }

        // Check if line is a standalone markdown image: ![alt](url)
        const standaloneImageMatch = trimmed.match(/^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/i);
        if (standaloneImageMatch) {
          const [, alt, src] = standaloneImageMatch;
          return (
            <div key={lineIdx} className="my-2.5 overflow-hidden rounded-xl border border-border bg-muted/20">
              <img
                src={src}
                alt={alt || 'Announcement image'}
                loading="lazy"
                className="w-full max-h-96 object-cover object-center rounded-xl transition-all hover:scale-[1.01]"
                onError={(e) => {
                  // Fallback for broken image URLs
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {alt && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border/40 bg-card/50">
                  <ImageIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{alt}</span>
                </div>
              )}
            </div>
          );
        }

        // Parse inline formatting: images, links, bold, code
        return (
          <p key={lineIdx} className="break-words">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses inline formatting:
 * 1. Images: ![alt](url)
 * 2. Links: [label](url)
 * 3. Bold: **text**
 * 4. Inline code: `code`
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex pattern matching:
  // 1: ! [alt] (url)
  // 2: [text] (url)
  // 3: **bold**
  // 4: `code`
  const tokenRegex = /(!?\[.*?\]\(https?:\/\/[^\s\)]+\)|\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // 1. Image: ![alt](url)
    const imgMatch = part.match(/^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/i);
    if (imgMatch) {
      const [, alt, src] = imgMatch;
      return (
        <span key={index} className="inline-block my-1 max-w-full">
          <img
            src={src}
            alt={alt || 'Image'}
            loading="lazy"
            className="rounded-lg max-h-64 w-auto object-cover border border-border inline-block shadow-xs"
          />
        </span>
      );
    }

    // 2. Link: [text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/i);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium underline underline-offset-2 transition-colors"
        >
          <span>{label || href}</span>
          <ExternalLink className="inline h-3 w-3 ml-0.5" />
        </a>
      );
    }

    // 3. Bold: **text**
    const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={index} className="font-bold text-foreground">
          {boldMatch[1]}
        </strong>
      );
    }

    // 4. Code: `code`
    const codeMatch = part.match(/^`(.*?)`$/);
    if (codeMatch) {
      return (
        <code
          key={index}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground border border-border/60"
        >
          {codeMatch[1]}
        </code>
      );
    }

    // Standard plain text
    return <span key={index}>{part}</span>;
  });
}
