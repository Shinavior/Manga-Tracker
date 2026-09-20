export interface UserRecord {
  id: string;
  email: string | null;
  createdAt: Date;
}

export interface SeriesRecord {
  id: string;
  userId: string;
  seriesKey: string;
  source: string;
  urlPattern: string | null;
  autoTitle: string | null;
  customTitle: string | null;
  coverUrl: string | null;
  status: 'unread' | 'reading' | 'read' | 'waiting' | 'paused' | 'dropped';
  tags: string[];
  language: string | null;
  currentChapterId: string | null;
  confidence: 'high' | 'medium' | 'low';
  needsReview: boolean;
  lastReadAt: Date | null;
  lastCheckedAt: Date | null;
  hasUpdate: boolean;
  nextChapterUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterRecord {
  id: string;
  seriesId: string;
  url: string;
  chapterLabel: string;
  chapterNumber: number | null;
  isCurrent: boolean;
  archivedAt: Date | null;
  purgeAt: Date | null;
  restoredCount: number;
  savedAt: Date;
}

export interface UndoTokenRecord {
  token: string;
  userId: string;
  payload: {
    action: 'created' | 'updated';
    seriesId: string;
    previousCurrentChapterId: string | null;
    insertedChapterId: string;
    previousSeriesState?: Partial<SeriesRecord>;
  };
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface ApiTokenRecord {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  lastFour: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface SaveResult {
  action: 'created' | 'updated' | 'noop';
  wentBackward: boolean;
  series: {
    id: string;
    title: string;
    coverUrl: string | null;
    status: string;
    tags: string[];
    seriesKey: string;
    confidence: string;
    needsReview: boolean;
  };
  chapter: {
    id: string;
    url: string;
    label: string;
    number: number | null;
  };
  archivedChapter?: {
    id: string;
    label: string;
    purgeAt: string;
  };
  undoToken?: string;
  mergeSuggestions?: unknown[];
}
