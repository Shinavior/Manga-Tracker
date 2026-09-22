import { randomUUID } from 'crypto';

export interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  category: 'update' | 'feature' | 'guide' | 'notice';
  isPinned: boolean;
  linkUrl: string | null;
  authorEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Global in-memory store for announcements when db is not connected
const globalStore = globalThis as unknown as {
  __mangaAnnouncements?: AnnouncementRecord[];
};

if (!globalStore.__mangaAnnouncements) {
  // Initial seed announcements (professional, clean, dummy links)
  globalStore.__mangaAnnouncements = [
    {
      id: 'seed-announcement-1',
      title: 'อัปเดตระบบ v0.2.0: เพิ่มระบบคู่มือใช้งานและศูนย์ประกาศข่าวสาร',
      content: 'ยินดีต้อนรับสู่ MangaTracker เวอร์ชันล่าสุด! เราได้เพิ่มคู่มือการใช้งานแบบทีละขั้นตอน (How to Use) และศูนย์รวมประกาศสำหรับแจ้งเตือนอัปเดตใหม่ๆ พร้อมปรับปรุงแถบนำทางให้รองรับการใช้งานบนมือถือได้อย่างสมบูรณ์แบบ',
      category: 'update',
      isPinned: true,
      linkUrl: 'https://demo-tracker.example.com/changelog/v0.2.0',
      authorEmail: 'admin@mangatracker.local',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
    {
      id: 'seed-announcement-2',
      title: 'วิธีใช้งาน: การบุ๊กมาร์กตอนอ่านอัตโนมัติด้วย 1-Tap Bookmarklet',
      content: 'ผู้อ่านสามารถลาก Bookmarklet ในหน้าตั้งค่าไปวางบนแถบเบราว์เซอร์ เมื่อเปิดอ่านมังงะในเว็บไซต์ทั่วไป เพียงกดปุ่มบุ๊กมาร์ก ระบบจะบันทึกตอนล่าสุดและคำนวณตอนต่อไปให้ทันทีโดยไม่ต้องเปิดสลับหน้าจอ',
      category: 'guide',
      isPinned: false,
      linkUrl: 'https://demo-tracker.example.com/docs/bookmarklet-guide',
      authorEmail: 'admin@mangatracker.local',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    },
    {
      id: 'seed-announcement-3',
      title: 'ฟีเจอร์ตรวจเช็กตอนใหม่อัตโนมัติ (Auto-check & Sync)',
      content: 'ระบบจะสแกนหาตอนใหม่จากแหล่งมังงะที่รองรับอย่างสม่ำเสมอ หากมีตอนใหม่ถูกปล่อยออกมา การ์ดมังงะจะแสดงป้ายกำกับตอนใหม่พร้อมปุ่มทางลัดไปยังตอนถัดไปได้ทันที',
      category: 'feature',
      isPinned: false,
      linkUrl: null,
      authorEmail: 'admin@mangatracker.local',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8), // 8 days ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
    },
  ];
}

export const memoryAnnouncementStore = globalStore.__mangaAnnouncements;

export function addMemoryAnnouncement(
  record: Omit<AnnouncementRecord, 'id' | 'createdAt' | 'updatedAt'>
): AnnouncementRecord {
  const now = new Date();
  const newRecord: AnnouncementRecord = {
    ...record,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  memoryAnnouncementStore.unshift(newRecord);
  return newRecord;
}

export function deleteMemoryAnnouncement(id: string): boolean {
  const index = memoryAnnouncementStore.findIndex((a) => a.id === id);
  if (index !== -1) {
    memoryAnnouncementStore.splice(index, 1);
    return true;
  }
  return false;
}
