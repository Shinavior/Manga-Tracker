# Manga Chapter Tracker

[English](#english) | [ภาษาไทย](#ภาษาไทย)

---

## English

### Overview

Manga Chapter Tracker is a smart URL resolver and single-row manga library manager. When you save a new chapter URL from any reading platform, the system automatically groups it under its canonical series entry, archives previously read chapters with a 30-day purge countdown, and provides one-tap navigation to continue reading or jump to the next chapter.

### Key Features

- Single Row per Series: Ingests chapter URLs from any website and organizes them under a unified, canonical series card without cluttering your library.
- Smart URL Resolver and Multi-Tier Caching: Permanent chapter cache, 7-day manga metadata cache, and 6-hour feed cache (such as MangaDex) with concurrency limits and HTTP 429 exponential backoff.
- One-Tap Next Chapter: Computes next chapter feeds automatically or probes dynamic URL patterns.
- Trash and 30-Day Purge: Automated chapter archiving featuring live countdown timers, one-tap chapter restoration, and scheduled cleanup.
- Lossless Series Merging: Merge duplicate series entries with title-similarity suggestions and zero data loss.
- Backup, Export, and Bookmarks Import: Complete JSON library export and Netscape HTML browser bookmarks ingestion with dry-run preview before committing.
- Automated Background Jobs: Configured for cron triggers to purge expired chapters and scan active series for newly released chapters.
- Mobile PWA and Web Share Target: Progressive Web App support with native Share Sheet ingestion on Android and iOS Shortcuts compatibility.
- Browser Bookmarklet: In-page bookmarklet for one-click tracking while browsing any reading site without switching tabs.
- Secure API Tokens: SHA-256 hashed API keys for external integrations, webhooks, and automation scripts.
- 10-Second Undo Window: Revert accidental saves, updates, or merges instantly without data loss.

### Tech Stack

- Framework: Next.js 15 (App Router, React 19, TypeScript)
- Styling: Tailwind CSS and Lucide React
- Database and ORM: Drizzle ORM with PostgreSQL (Supabase / Neon), plus transactional fallback support
- Authentication: Supabase Auth (multi-user mode) or single-user offline development mode
- Testing: Vitest with v8 coverage

### Getting Started

#### Web Usage

1. Open Manga Tracker in your browser.
2. Paste any manga chapter URL into the quick-add bar at the top.
3. The system automatically fetches metadata, organizes it under the canonical series card, and marks your current reading progress.

#### Self-Hosting & Development Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env` or `.env.local` file based on `.env.example`:
```bash
cp .env.example .env.local
```

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection string (Supabase or Neon).
- `AUTH_MODE`: Set to `multi_user` for Supabase authentication, or `single_user` for local development.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project credentials.
- `CRON_SECRET`: Bearer token for securing background cron endpoints.

3. Run database migrations:
```bash
npx drizzle-kit push
```

4. Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Running Tests

```bash
# Run unit and integration tests
npm run test

# Run tests with test coverage report
npm run test:coverage
```

### Mobile Ingestion and Bookmarklet Setup

1. Open the Settings page at [http://localhost:3000/settings](http://localhost:3000/settings).
2. Drag the `+ Track Manga` bookmarklet link to your browser Bookmarks Bar.
3. For mobile devices, install the app via Add to Home Screen (PWA) to enable system share target integration.

---

## ภาษาไทย

### ภาพรวม

Manga Chapter Tracker คือระบบจัดการคลังมังงะและถอดรหัส URL อัจฉริยะ (Smart URL Resolver & Single-Row Manager) ออกแบบมาเพื่อแก้ปัญหาการติดตามมังงะที่กระจัดกระจาย เมื่อบันทึกลิงก์ตอนอ่านจากเว็บใดก็ตาม ระบบจะจัดกลุ่มเข้าสู่การ์ดเรื่องเดิมโดยอัตโนมัติ ย้ายตอนที่อ่านแล้วเข้าสู่ถังขยะพร้อมนับถอยหลังล้างข้อมูล 30 วัน และมีปุ่มลัดสำหรับอ่านต่อหรือไปตอนถัดไปได้ทันทีในคลิกเดียว

### คุณสมบัติเด่น

- จัดกลุ่มหนึ่งเรื่องต่อหนึ่งแถว (Single Row per Series): จัดระเบียบลิงก์ตอนที่เพิ่มเข้ามาให้อยู่ภายใต้การ์ดเรื่องหลักเรื่องเดียว ไม่สร้างรายการซ้ำซ้อน
- ระบบถอดรหัส URL และแคชหลายระดับ (Multi-Tier Caching): แคชข้อมูลตอนแบบถาวร แคชรายละเอียดเรื่อง 7 วัน และแคชรายการตอนล่าสุด 6 ชั่วโมง พร้อมระบบควบคุม Concurrency และ Exponential Backoff เมื่อเจอข้อจำกัดการเรียกดู
- อ่านตอนถัดไปในคลิกเดียว (One-Tap Next Chapter): ค้นหาและคำนวณลิงก์ตอนถัดไปจากระบบฟีด หรือตรวจสอบตามโครงสร้าง URL อัตโนมัติ
- ถังขยะและลบอัตโนมัติใน 30 วัน (Trash and 30-Day Purge): พักตอนเก่าไว้ในถังขยะพร้อมเวลานับถอยหลัง สามารถกู้คืนได้ในคลิกเดียว และมีระบบลบข้อมูลที่หมดอายุอัตโนมัติ
- รวมเรื่องที่ซ้ำกันอย่างไร้รอยต่อ (Lossless Series Merging): ระบบแนะนำการรวมเรื่องที่คล้ายกันโดยคำนวณจากชื่อเรื่อง พร้อมถ่ายโอนประวัติตอนทั้งหมดโดยข้อมูลไม่สูญหาย
- สำรองข้อมูลและนำเข้าบุ๊กมาร์ก (Backup, Export, and Bookmarks Import): ส่งออกข้อมูลทั้งคลังเป็นไฟล์ JSON และนำเข้าบุ๊กมาร์กจากเบราว์เซอร์ในรูปแบบ Netscape HTML พร้อมหน้าต่างแสดงตัวอย่าง (Dry-run Preview) ก่อนบันทึกจริง
- งานเบื้องหลังอัตโนมัติ (Automated Background Jobs): รองรับการตั้งค่า Cron Job ประจำวันเพื่อลบตอนที่หมดอายุและสแกนค้นหาตอนใหม่ของเรื่องที่กำลังติดตาม
- รองรับ PWA และ Web Share Target: ใช้งานในรูปแบบ Progressive Web App รองรับการแชร์ลิงก์ผ่าน Share Sheet บน Android และรองรับ iOS Shortcuts
- บุ๊กมาร์กเล็ตสำหรับเบราว์เซอร์ (Browser Bookmarklet): เครื่องมือ Bookmarklet ที่กดบันทึกมังงะจากหน้าเว็บที่กำลังอ่านได้ทันทีโดยไม่ต้องสลับหน้าจอ
- การยืนยันตัวตนและ API Token ที่ปลอดภัย: จัดเก็บคีย์ API ด้วยการเข้ารหัส SHA-256 สำหรับเชื่อมต่อกับระบบภายนอก ส่วนขยาย และสคริปต์อัตโนมัติ
- ยกเลิกการทำงานได้ใน 10 วินาที (10-Second Undo Window): กล่องข้อความแจ้งเตือนพร้อมปุ่ม Undo สำหรับยกเลิกการบันทึกหรือการรวมเรื่องที่ผิดพลาดได้ทันที

### สถาปัตยกรรมและเทคโนโลยี

- เว็บเฟรมเวิร์ก: Next.js 15 (App Router, React 19, TypeScript)
- การจัดสไตล์: Tailwind CSS และ Lucide React
- ฐานข้อมูลและ ORM: Drizzle ORM ร่วมกับ PostgreSQL (Supabase / Neon) พร้อมระบบสำรองสำหรับโหมดออฟไลน์
- ระบบความปลอดภัยและการเข้าสู่ระบบ: Supabase Auth (โหมดผู้ใช้หลายคน) หรือโหมดผู้ใช้เดี่ยวสำหรับการพัฒนาในเครื่อง
- การทดสอบระบบ: Vitest พร้อมรายงาน Coverage ด้วย v8

### การเริ่มต้นใช้งาน

#### การใช้งานผ่านเว็บ

1. เปิดใช้งาน Manga Tracker ผ่านเว็บเบราว์เซอร์
2. วางลิงก์ตอนของมังงะลงในช่องค้นหาหรือช่องเพิ่มเรื่องด้านบน
3. ระบบจะดึงข้อมูลมังงะ จัดกลุ่มเข้าสู่การ์ดเรื่องเดิมโดยอัตโนมัติ และบันทึกสถานะการอ่านล่าสุด

#### การตั้งค่าและการติดตั้งสำหรับโฮสต์เอง

1. ติดตั้ง Dependencies:
```bash
npm install
```

2. ตั้งค่าตัวแปรสภาพแวดล้อม (Environment Variables):
สร้างไฟล์ `.env` หรือ `.env.local` จากไฟล์ตัวอย่าง `.env.example`:
```bash
cp .env.example .env.local
```

ตัวแปรสภาพแวดล้อมสำคัญ:
- `DATABASE_URL`: Connection string สำหรับเชื่อมต่อไปยัง PostgreSQL (Supabase หรือ Neon)
- `AUTH_MODE`: กำหนดเป็น `multi_user` เพื่อเปิดใช้งานระบบสมาชิก Supabase หรือ `single_user` สำหรับพัฒนาในเครื่อง
- `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`: ข้อมูลสำหรับเชื่อมต่อกับ Supabase
- `CRON_SECRET`: รหัสลับ Bearer Token สำหรับป้องกัน Endpoint งานเบื้องหลัง (Cron)

3. ดำเนินการอัปเดตสคีมาฐานข้อมูล:
```bash
npx drizzle-kit push
```

4. เริ่มต้นเซิร์ฟเวอร์สำหรับพัฒนา:
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

#### การรันแบบทดสอบ

```bash
# รันการทดสอบ Unit และ Integration
npm run test

# รันการทดสอบพร้อมสรุปผล Coverage
npm run test:coverage
```

### การตั้งค่า Bookmarklet และการใช้งานบนมือถือ

1. เข้าไปที่หน้าการตั้งค่า [http://localhost:3000/settings](http://localhost:3000/settings)
2. ลากปุ่มลิงก์ `+ Track Manga` ไปวางบนแถบบุ๊กมาร์กของเบราว์เซอร์
3. สำหรับสมาร์ตโฟน สามารถกด เพิ่มไปยังหน้าจอหลัก (Add to Home Screen) เพื่อเปิดใช้งาน PWA และส่งลิงก์ผ่านเมนูแชร์ของระบบได้ทันที

---

## License

MIT
