import { randomUUID } from 'crypto';

export interface FeedbackRecord {
  id: string;
  userId: string | null;
  type: string;
  message: string;
  pageContext: string | null;
  appVersion: string;
  userAgent: string | null;
  screenshotUrl: string | null;
  status: string;
  createdAt: Date;
}

// Global in-memory store for feedback when db is not connected
const globalStore = globalThis as unknown as {
  __mangaFeedback?: FeedbackRecord[];
};

if (!globalStore.__mangaFeedback) {
  globalStore.__mangaFeedback = [];
}

export const memoryFeedbackStore = globalStore.__mangaFeedback;

export function addMemoryFeedback(record: Omit<FeedbackRecord, 'id' | 'createdAt'>): FeedbackRecord {
  const newRecord: FeedbackRecord = {
    ...record,
    id: randomUUID(),
    createdAt: new Date(),
  };
  memoryFeedbackStore.unshift(newRecord);
  return newRecord;
}
