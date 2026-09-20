export interface ParsedBookmarkItem {
  url: string;
  title: string;
  addDate?: Date | null;
}

/**
 * Parses Netscape Bookmark HTML format exported from Chrome, Firefox, Safari, Edge, etc.
 * Format: <A HREF="https://..." ADD_DATE="1234567890">Title</A>
 */
export function parseNetscapeBookmarksHtml(htmlContent: string): ParsedBookmarkItem[] {
  const items: ParsedBookmarkItem[] = [];
  // Regex to match <a ... href="..." ...>title</a> tags
  const aTagRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const addDateRegex = /add_date=["'](\d+)["']/i;

  let match: RegExpExecArray | null;
  while ((match = aTagRegex.exec(htmlContent)) !== null) {
    const rawUrl = match[1]?.trim();
    let rawTitle = match[2]?.trim() || '';

    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      continue;
    }

    // Clean HTML entities in title
    rawTitle = rawTitle
      .replace(/<[^>]+>/g, '') // remove inner tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .trim();

    // Extract ADD_DATE if present
    let addDate: Date | null = null;
    const dateMatch = match[0].match(addDateRegex);
    if (dateMatch && dateMatch[1]) {
      const timestampSec = parseInt(dateMatch[1], 10);
      if (!isNaN(timestampSec) && timestampSec > 0) {
        addDate = new Date(timestampSec * 1000);
      }
    }

    items.push({
      url: rawUrl,
      title: rawTitle || rawUrl,
      addDate,
    });
  }

  return items;
}
