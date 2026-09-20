# 📖 Manga Chapter Tracker

> **Smart URL resolver and single-row manga library manager.** Never lose your place. Saving a new chapter URL automatically merges it into your existing series row, archives previous chapters with a 30-day purge countdown, and gives you one-tap continue & next reading.

---

## ✨ Key Features

- 🎯 **Single Row per Series**: Ingesting chapter URLs from any site automatically groups chapters under their canonical series card.
- ⚡ **Multi-Tier Caching**: Permanent chapter cache, 7-day manga metadata cache, and 6-hour feed cache for MangaDex with concurrency limiter (5 req/sec) and HTTP 429 exponential backoff.
- ⏭️ **One-Tap Next Chapter**: Automatically queries and computes the next chapter feed or probes `{ch}` URL patterns.
- 🗑️ **Trash & 30-Day Purge**: Automatic chapter archiving with live 30-day countdown timers, 1-tap restore, and scheduled purge.
- 🔗 **Series Merging**: Lossless series merge with smart title-similarity suggestions to combine duplicates seamlessly.
- 📦 **Backup, Export & Bookmarks Import**: Full JSON export/backup and Netscape HTML browser bookmarks ingestion with interactive dry-run preview.
- ⏰ **Automated Background Jobs**: Daily cron jobs for auto-purging expired chapters and scanning active series for new chapter releases.
- 📱 **Mobile Ingestion & Web Share Target**: PWA with native system Share Sheet support on Chrome Android and iOS Shortcuts.
- 📌 **1-Tap Browser Bookmarklet**: In-page silent toast bookmarklet allows tracking manga with a single click while browsing on any site.
- 🔑 **Secure API Tokens**: SHA-256 hashed API keys for external integrations, Shortcuts, and extensions.
- ⏪ **10-Second Undo Window**: Revert accidental saves or merges losslessly.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS & Lucide React
- **Database & Persistence**: Drizzle ORM + PostgreSQL schema with transactional in-memory store for single-user dev mode
- **Testing**: Vitest (99 unit & integration tests, >90% coverage)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/manga-tracker.git
cd manga-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Tests

```bash
# Run all test suites
npm run test

# Run tests with coverage
npm run test:coverage
```

---

## 📱 Mobile Ingestion & Bookmarklet Setup

1. Go to **[http://localhost:3000/settings](http://localhost:3000/settings)**.
2. Drag the **`📌 + Track Manga`** button to your browser Bookmarks Bar.
3. Or install the app as a PWA on Android to share links directly from Chrome or reading apps into Manga Tracker.

---

## 📄 License

MIT
