import { describe, it, expect, vi } from 'vitest';
import { isPrivateIp, cleanScrapedTitle, scrapePageMetadata } from '../../lib/resolver/metadata';

describe('Phase 4: Metadata Scraping & SSRF Protection', () => {
  describe('SSRF IP Protection', () => {
    it('identifies private and loopback IP addresses', () => {
      expect(isPrivateIp('localhost')).toBe(true);
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('192.168.1.100')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true);
      expect(isPrivateIp('172.20.10.5')).toBe(true);
    });

    it('allows valid public domain names', () => {
      expect(isPrivateIp('mangadex.org')).toBe(false);
      expect(isPrivateIp('www.nekopost.net')).toBe(false);
      expect(isPrivateIp('chapmanganato.to')).toBe(false);
      expect(isPrivateIp('8.8.8.8')).toBe(false);
    });
  });

  describe('Page Title Cleaner', () => {
    it('strips site branding and reading noise', () => {
      expect(cleanScrapedTitle('Solo Leveling Chapter 10 - Read Manga Online Free')).toBe('Solo Leveling');
      expect(cleanScrapedTitle('Chainsaw Man ตอนที่ 150 - Nekopost')).toBe('Chainsaw Man');
      expect(cleanScrapedTitle('Frieren: Beyond Journey\'s End | MangaDex')).toBe("Frieren: Beyond Journey's End");
      expect(cleanScrapedTitle('One Piece Ch. 1100')).toBe('One Piece');
      expect(
        cleanScrapedTitle('อ่านมังงะ The Delusional Hunter in Another World ตอนที่ 1 แปลไทย | Dark-Manga')
      ).toBe('The Delusional Hunter in Another World');
      expect(
        cleanScrapedTitle('รักสุดใจจนอยากครอบครองไว้คนเดียว - Chapter 1 | Nekopost')
      ).toBe('รักสุดใจจนอยากครอบครองไว้คนเดียว');
    });

    it('preserves real subtitle hyphens', () => {
      expect(cleanScrapedTitle('Sword Art Online - Progressive')).toBe('Sword Art Online - Progressive');
    });
  });

  describe('scrapePageMetadata Network Pipeline', () => {
    it('rejects SSRF blocked URLs safely', async () => {
      const res = await scrapePageMetadata('http://127.0.0.1:8080/secret');
      expect(res.error).toBe('SSRF_BLOCKED');
      expect(res.title).toBeNull();
    });

    it('extracts og:title, og:image, and title tags from HTML', async () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Jujutsu Kaisen - Read Manga Online" />
            <meta property="og:image" content="https://example.com/cover.jpg" />
            <title>Jujutsu Kaisen Ch. 250</title>
          </head>
          <body></body>
        </html>
      `;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(sampleHtml, { status: 200, headers: { 'content-type': 'text/html' } })
      );

      const meta = await scrapePageMetadata('https://example.com/manga/jujutsu-kaisen/ch250');
      expect(meta.title).toBe('Jujutsu Kaisen');
      expect(meta.coverUrl).toBe('https://example.com/cover.jpg');

      vi.restoreAllMocks();
    });

    it('gracefully handles 403 Cloudflare errors without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Cloudflare Challenge', { status: 403 })
      );

      const meta = await scrapePageMetadata('https://cloudflare-protected.com/manga/test');
      expect(meta.error).toBe('HTTP_403');
      expect(meta.title).toBeNull();

      vi.restoreAllMocks();
    });
  });
});
