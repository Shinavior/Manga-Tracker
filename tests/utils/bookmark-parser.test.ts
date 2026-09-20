import { describe, it, expect } from 'vitest';
import { parseNetscapeBookmarksHtml } from '@/lib/utils/bookmark-parser';

describe('Bookmark Parser (Netscape HTML)', () => {
  it('parses valid Netscape bookmark HTML with titles and timestamps', () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
      <TITLE>Bookmarks</TITLE>
      <H1>Bookmarks</H1>
      <DL><p>
        <DT><A HREF="https://example.com/manga/solo-leveling/chapter-100" ADD_DATE="1700000000">Solo Leveling - Chapter 100 &amp; Extra</A>
        <DT><A HREF="https://mangadex.org/chapter/12345678-abcd-1234-abcd-1234567890ab" ADD_DATE="1700000500">Ch. 50 - Frieren &lt;Beyond&gt; &#039;Journey&#039;</A>
      </DL><p>
    `;

    const results = parseNetscapeBookmarksHtml(html);
    expect(results).toHaveLength(2);

    expect(results[0].url).toBe('https://example.com/manga/solo-leveling/chapter-100');
    expect(results[0].title).toBe('Solo Leveling - Chapter 100 & Extra');
    expect(results[0].addDate).toBeInstanceOf(Date);

    expect(results[1].url).toBe('https://mangadex.org/chapter/12345678-abcd-1234-abcd-1234567890ab');
    expect(results[1].title).toBe("Ch. 50 - Frieren <Beyond> 'Journey'");
  });

  it('filters out javascript bookmarklets and non-http URLs', () => {
    const html = `
      <DT><A HREF="javascript:(function(){alert('hello');})();">Bookmarklet</A>
      <DT><A HREF="chrome://bookmarks">Browser Bookmarks</A>
      <DT><A HREF="about:blank">Blank</A>
      <DT><A HREF="https://example.com/manga/one-piece/ch-1100">One Piece 1100</A>
    `;

    const results = parseNetscapeBookmarksHtml(html);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/manga/one-piece/ch-1100');
  });

  it('handles empty or malformed HTML gracefully', () => {
    expect(parseNetscapeBookmarksHtml('')).toEqual([]);
    expect(parseNetscapeBookmarksHtml('<div>No links here</div>')).toEqual([]);
  });
});
