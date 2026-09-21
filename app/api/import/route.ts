import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DataStore } from '@/lib/db/data-store';
import { parseNetscapeBookmarksHtml } from '@/lib/utils/bookmark-parser';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const url = new URL(req.url);
    const dryRunParam = url.searchParams.get('dryRun');

    let isDryRun = dryRunParam === 'true';
    const contentType = req.headers.get('content-type') || '';
    const itemsToImport: Array<{
      url: string;
      customTitle?: string;
      tags?: string[];
    }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const formDryRun = formData.get('dryRun');
      if (formDryRun !== null) {
        isDryRun = formDryRun === 'true' || formDryRun === '1';
      }

      if (!file) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'No file uploaded' } },
          { status: 400 }
        );
      }

      const fileContent = await file.text();
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.html') || fileName.endsWith('.htm') || fileContent.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>')) {
        const parsed = parseNetscapeBookmarksHtml(fileContent);
        for (const p of parsed) {
          itemsToImport.push({ url: p.url, customTitle: p.title });
        }
      } else {
        // Parse as JSON
        try {
          const parsedJson = JSON.parse(fileContent);
          // Check if it's a direct MangaTracker backup file (has version and series array)
          if (parsedJson.version && Array.isArray(parsedJson.series)) {
            const backupResult = await DataStore.restoreBackup(auth.userId, parsedJson, isDryRun);
            return NextResponse.json({
              success: true,
              ...backupResult,
            });
          }

          if (Array.isArray(parsedJson)) {
            itemsToImport.push(...parsedJson);
          } else if (parsedJson.series && Array.isArray(parsedJson.series)) {
            for (const s of parsedJson.series) {
              const currentUrl = s.currentChapter?.url || (s.chapters && s.chapters[0]?.url);
              if (currentUrl) {
                itemsToImport.push({
                  url: currentUrl,
                  customTitle: s.customTitle || s.autoTitle,
                  tags: s.tags,
                });
              }
            }
          } else if (parsedJson.items && Array.isArray(parsedJson.items)) {
            itemsToImport.push(...parsedJson.items);
          }
        } catch {
          return NextResponse.json(
            { error: { code: 'INVALID_JSON', message: 'Could not parse uploaded JSON file' } },
            { status: 400 }
          );
        }
      }
    } else {
      // JSON request body
      const body = await req.json();
      if (body.dryRun !== undefined) {
        isDryRun = Boolean(body.dryRun);
      }

      if (body.version && Array.isArray(body.series)) {
        const backupResult = await DataStore.restoreBackup(auth.userId, body, isDryRun);
        return NextResponse.json({
          success: true,
          ...backupResult,
        });
      }

      if (body.html) {
        const parsed = parseNetscapeBookmarksHtml(body.html);
        for (const p of parsed) {
          itemsToImport.push({ url: p.url, customTitle: p.title });
        }
      } else if (Array.isArray(body)) {
        itemsToImport.push(...body);
      } else if (body.items && Array.isArray(body.items)) {
        itemsToImport.push(...body.items);
      } else if (body.series && Array.isArray(body.series)) {
        for (const s of body.series) {
          const currentUrl = s.currentChapter?.url || (s.chapters && s.chapters[0]?.url);
          if (currentUrl) {
            itemsToImport.push({
              url: currentUrl,
              customTitle: s.customTitle || s.autoTitle,
              tags: s.tags,
            });
          }
        }
      }
    }

    if (itemsToImport.length === 0) {
      return NextResponse.json(
        { error: { code: 'EMPTY_IMPORT', message: 'No valid URLs found to import' } },
        { status: 400 }
      );
    }

    const result = await DataStore.importData(auth.userId, itemsToImport, isDryRun);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
