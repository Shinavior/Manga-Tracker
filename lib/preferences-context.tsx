'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Language = 'th' | 'en';
export type Theme = 'dark' | 'light';

export interface Translations {
  // Navigation & Header
  appTitle: string;
  appSubtitle: string;
  mvpBadge: string;
  singleUser: string;
  navLibrary: string;
  navTrash: string;
  navSettings: string;
  toggleTheme: string;
  toggleLanguage: string;

  // Add Manga Bar
  singleMode: string;
  bulkMode: string;
  urlPlaceholder: string;
  bulkPlaceholder: string;
  trackChapter: string;
  saving: string;
  resolving: string;
  customTitlePlaceholder: string;
  tagsPlaceholder: string;
  bulkSummary: string;
  bulkDetected: string;
  startBulkIngestion: string;
  bulkProcessing: string;
  bulkDone: string;
  bulkFailures: string;
  bulkSuccessCount: string;
  bulkErrorCount: string;

  // Update Checker Widget
  updateWidgetTitle: string;
  updateWidgetDesc: string;
  checkUpdatesNow: string;
  checkingUpdates: string;
  filterUpdatesOnly: string;
  showAllSeries: string;
  updatesFoundBadge: string;
  readNextChapter: string;
  allCaughtUp: string;
  lastChecked: string;

  // Filter Bar
  searchPlaceholder: string;
  statusAll: string;
  statusUnread: string;
  statusReading: string;
  statusRead: string;
  statusWaiting: string;
  statusPaused: string;
  statusDropped: string;
  sortBy: string;
  sortUpdated: string;
  sortTitle: string;
  sortChapter: string;
  sortCreated: string;

  // Library Page & Multi-Select
  myLibraryTitle: string;
  librarySubtitle: string;
  refresh: string;
  selectMode: string;
  cancelSelectMode: string;
  selectedCount: string;
  selectAll: string;
  deselectAll: string;
  deleteSelected: string;
  confirmDeleteBulkTitle: string;
  confirmDeleteBulkDesc: string;
  confirmDelete: string;
  cancel: string;
  deleting: string;
  noSeriesFound: string;
  noUpdatesFound: string;
  noSeriesHint: string;
  noUpdatesHint: string;
  adjustFilterHint: string;

  // Series Card
  continueReading: string;
  nextChapter: string;
  checkingNext: string;
  caughtUp: string;
  mergeWith: string;
  editTitle: string;
  deleteSeries: string;
  needsReviewBadge: string;
  newUpdateBadge: string;
  sourceDomain: string;
  savedAt: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  confirmDeleteSingleTitle: string;
  confirmDeleteSingleDesc: string;

  // Merge Dialog
  mergeTitle: string;
  mergeDesc: string;
  suggestedMatches: string;
  orSelectManually: string;
  selectTargetSeries: string;
  mergeButton: string;
  merging: string;

  // Trash Page
  trashTitle: string;
  trashSubtitle: string;
  backToLibrary: string;
  trashLoading: string;
  trashEmpty: string;
  trashEmptyDesc: string;
  returnToLibrary: string;
  archivedChapters: string;
  autoPurge30: string;
  archivedAtLabel: string;
  restoredXTimes: string;
  daysLeft: string;
  dayLeft: string;
  restoreToActive: string;
  restoring: string;
  deletePermanentlyLabel: string;
  confirmPermDelete: string;

  // Settings Page
  settingsTitle: string;
  settingsSubtitle: string;
  sectionBackupTitle: string;
  sectionBackupDesc: string;
  exportLibraryTitle: string;
  exportLibraryDesc: string;
  exportDownload: string;
  importTitle: string;
  importDesc: string;
  analyzingFile: string;
  selectFileToImport: string;
  importPreviewTitle: string;
  importPreviewDesc: string;
  discardImport: string;
  confirmAndImport: string;
  importing: string;
  sectionJobsTitle: string;
  sectionJobsDesc: string;
  purgeJobTitle: string;
  purgeJobDesc: string;
  runPurgeNow: string;
  purging: string;
  updateJobTitle: string;
  updateJobDesc: string;
  checkUpdatesNow2: string;
  checking: string;
  sectionTokensTitle: string;
  sectionTokensDesc: string;
  tokenNamePlaceholder: string;
  createToken: string;
  generating: string;
  newTokenCreated: string;
  copyKey: string;
  copied: string;
  activeTokens: string;
  loadingTokens: string;
  noTokensYet: string;
  revokeToken: string;
  sectionBookmarkletTitle: string;
  sectionBookmarkletDesc: string;
  testToastPreview: string;
  dragInstruction: string;
  sectionMobileTitle: string;
  sectionMobileDesc: string;
}

const translations: Record<Language, Translations> = {
  th: {
    // Navigation & Header
    appTitle: 'Manga Tracker',
    appSubtitle: 'ติดตามอ่านมังงะ อัปเดตตอนใหม่อัตโนมัติในที่เดียว',
    mvpBadge: 'MVP',
    singleUser: 'ผู้ใช้งานเดี่ยว',
    navLibrary: 'คลังมังงะ',
    navTrash: 'ถังขยะ (30 วัน)',
    navSettings: 'ตั้งค่า & จัดการ',
    toggleTheme: 'เปลี่ยนธีม (ขาว/ดำ)',
    toggleLanguage: 'เปลี่ยนภาษา (ไทย/English)',

    // Add Manga Bar
    singleMode: 'เพิ่มทีละเรื่อง',
    bulkMode: 'เพิ่มทีละหลายเรื่อง',
    urlPlaceholder: 'วางลิงก์ตอนมังงะ (เช่น Nekopost, MangaDex, เว็บทั่วไป)...',
    bulkPlaceholder: 'วางลิงก์ตอนมังงะหลายรายการ (บรรทัดละ 1 ลิงก์)...',
    trackChapter: 'บันทึกตอน',
    saving: 'กำลังบันทึก...',
    resolving: 'กำลังดึงข้อมูล...',
    customTitlePlaceholder: 'ชื่อเรื่องที่ต้องการกำหนดเอง (ไม่บังคับ)',
    tagsPlaceholder: 'แท็ก (คั่นด้วยจุลภาค เช่น แอคชั่น, อิเซไก)',
    bulkSummary: 'นำเข้ามังงะแบบกลุ่ม',
    bulkDetected: 'ตรวจพบทั้งหมด {count} ลิงก์',
    startBulkIngestion: 'เริ่มนำเข้ามังงะทั้งหมด',
    bulkProcessing: 'กำลังประมวลผลลิงก์ที่ {current} จาก {total}...',
    bulkDone: 'นำเข้าเสร็จสมบูรณ์แล้ว!',
    bulkFailures: 'มีบางลิงก์เกิดข้อผิดพลาด',
    bulkSuccessCount: 'สำเร็จ {count} รายการ',
    bulkErrorCount: 'ไม่สำเร็จ {count} รายการ',

    // Update Checker Widget
    updateWidgetTitle: 'ระบบตรวจเช็คตอนใหม่อัตโนมัติ',
    updateWidgetDesc: 'ตรวจหาตอนต่อไปจากแหล่งอ่านของทุกเรื่องที่กำลังติดตาม',
    checkUpdatesNow: 'เช็คอัปเดตตอนนี้',
    checkingUpdates: 'กำลังเช็คอัปเดต...',
    filterUpdatesOnly: 'กรองเฉพาะเรื่องที่มีตอนใหม่',
    showAllSeries: 'แสดงมังงะทั้งหมด',
    updatesFoundBadge: 'พบ {count} เรื่องมีตอนใหม่!',
    readNextChapter: 'อ่านตอนถัดไป',
    allCaughtUp: 'อ่านครบทุกตอนล่าสุดแล้ว',
    lastChecked: 'ตรวจล่าสุด',

    // Filter Bar
    searchPlaceholder: 'ค้นหาชื่อเรื่อง, #แท็ก หรือ แหล่งที่มา...',
    statusAll: 'ทั้งหมด',
    statusUnread: 'ยังไม่อ่าน',
    statusReading: 'กำลังอ่าน',
    statusRead: 'อ่านจบแล้ว',
    statusWaiting: 'รอตอนใหม่',
    statusPaused: 'พักไว้ก่อน',
    statusDropped: 'เลิกอ่าน',
    sortBy: 'เรียงลำดับ:',
    sortUpdated: 'อัปเดตล่าสุด',
    sortTitle: 'ชื่อเรื่อง A-Z',
    sortChapter: 'เลขตอน',
    sortCreated: 'เพิ่มล่าสุด',

    // Library Page & Multi-Select
    myLibraryTitle: 'คลังมังงะของฉัน',
    librarySubtitle: 'วางลิงก์ตอนเพื่ออัปเดตตอนล่าสุดหรือสร้างเรื่องใหม่อัตโนมัติ',
    refresh: 'รีเฟรช',
    selectMode: 'เลือกหลายรายการ',
    cancelSelectMode: 'ยกเลิกการเลือก',
    selectedCount: 'เลือกแล้ว {count} เรื่อง',
    selectAll: 'เลือกทั้งหมด',
    deselectAll: 'ล้างการเลือก',
    deleteSelected: 'ลบรายการที่เลือก',
    confirmDeleteBulkTitle: 'ยืนยันการลบมังงะที่เลือก?',
    confirmDeleteBulkDesc: 'มังงะจำนวน {count} เรื่องจะถูกย้ายไปยังถังขยะ และสามารถกู้คืนได้ภายใน 30 วัน',
    confirmDelete: 'ยืนยันการลบ',
    cancel: 'ยกเลิก',
    deleting: 'กำลังลบ...',
    noSeriesFound: 'ไม่พบมังงะในรายการ',
    noUpdatesFound: 'ยังไม่มีมังงะที่มีตอนใหม่',
    noSeriesHint: 'วางลิงก์ตอนมังงะในช่องด้านบนเพื่อเริ่มบันทึกรายการอ่านของคุณ',
    noUpdatesHint: 'ทุกเรื่องอ่านถึงตอนล่าสุดแล้ว หรือกด "เช็คอัปเดตตอนนี้" เพื่อสแกนอีกครั้ง',
    adjustFilterHint: 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะดูอีกครั้ง',

    // Series Card
    continueReading: 'อ่านตอนปัจจุบัน',
    nextChapter: 'ตอนถัดไป',
    checkingNext: 'กำลังค้นหาตอนใหม่...',
    caughtUp: 'ถึงตอนล่าสุดแล้ว',
    mergeWith: 'รวมเรื่องเข้าด้วยกัน...',
    editTitle: 'แก้ไขชื่อเรื่อง',
    deleteSeries: 'ลบเรื่องนี้',
    needsReviewBadge: 'รอตรวจสอบ',
    newUpdateBadge: 'มีตอนใหม่!',
    sourceDomain: 'แหล่งที่มา',
    savedAt: 'บันทึกเมื่อ',
    justNow: 'เมื่อสักครู่',
    minutesAgo: '{m} นาทีที่แล้ว',
    hoursAgo: '{h} ชั่วโมงที่แล้ว',
    daysAgo: '{d} วันที่แล้ว',
    confirmDeleteSingleTitle: 'ลบมังงะเรื่องนี้?',
    confirmDeleteSingleDesc: 'เรื่องนี้จะถูกย้ายไปยังถังขยะ และสามารถกู้คืนได้ภายใน 30 วัน',

    // Merge Dialog
    mergeTitle: 'รวมเรื่องเข้าด้วยกัน (Merge Series)',
    mergeDesc: 'รวมตอนของเรื่องนี้เข้ากับเรื่องอื่นหากเป็นเรื่องเดียวกันแต่ URL ต่างกัน',
    suggestedMatches: 'เรื่องที่คาดว่าตรงกัน:',
    orSelectManually: 'หรือเลือกเรื่องที่ต้องการรวมด้วยตัวเอง:',
    selectTargetSeries: 'เลือกมังงะเป้าหมาย...',
    mergeButton: 'รวมเข้าเรื่องนี้',
    merging: 'กำลังรวมเรื่อง...',

    // Trash Page
    trashTitle: 'ถังขยะ (ตอนที่เก็บไว้)',
    trashSubtitle: 'ตอนที่ถูกแทนที่จะถูกเก็บไว้ที่นี่เป็นเวลา 30 วัน ก่อนการลบอัตโนมัติ',
    backToLibrary: '← กลับไปคลัง',
    trashLoading: 'กำลังโหลดตอนที่เก็บไว้...',
    trashEmpty: 'ถังขยะว่างเปล่า',
    trashEmptyDesc: 'เมื่อคุณบันทึกตอนใหม่ของเรื่องที่มีอยู่แล้ว ตอนเก่าจะถูกย้ายมาที่นี่โดยอัตโนมัติ และจะถูกลบหลัง 30 วัน',
    returnToLibrary: 'กลับไปคลัง →',
    archivedChapters: 'เก็บไว้ {n} ตอน',
    autoPurge30: 'ลบอัตโนมัติหลัง 30 วัน',
    archivedAtLabel: 'เก็บไว้เมื่อ:',
    restoredXTimes: 'กู้คืนแล้ว {n} ครั้ง',
    daysLeft: 'เหลือ {n} วัน',
    dayLeft: 'เหลือ 1 วัน',
    restoreToActive: 'กู้คืน',
    restoring: 'กำลังกู้คืน...',
    deletePermanentlyLabel: 'ลบถาวร',
    confirmPermDelete: 'ยืนยันการลบตอนนี้ถาวร? ไม่สามารถกู้คืนได้',

    // Settings Page
    settingsTitle: 'ตั้งค่า & การเชื่อมต่อ',
    settingsSubtitle: 'ตั้งค่า mobile share, สำรองข้อมูล, API token และงานอัตโนมัติ',
    sectionBackupTitle: 'สำรอง & นำเข้าข้อมูล',
    sectionBackupDesc: 'ส่งออกข้อมูลทั้งหมดเป็น JSON หรือนำเข้าบุ๊กมาร์คจาก Chrome/Firefox/Safari',
    exportLibraryTitle: 'ส่งออกข้อมูล',
    exportLibraryDesc: 'ดาวน์โหลดข้อมูลทั้งหมด ชื่อเรื่อง แท็ก และประวัติการอ่าน เป็นไฟล์ JSON',
    exportDownload: '⬇️ ดาวน์โหลด Backup (.json)',
    importTitle: 'นำเข้าบุ๊กมาร์คหรือข้อมูลสำรอง',
    importDesc: 'อัปโหลดไฟล์บุ๊กมาร์คจากเบราว์เซอร์ (.html) หรือไฟล์ JSON สำรองข้อมูล',
    analyzingFile: '🔍 กำลังวิเคราะห์ไฟล์...',
    selectFileToImport: '📁 เลือกไฟล์ (.html / .json)',
    importPreviewTitle: '🔎 ตัวอย่างก่อนนำเข้า',
    importPreviewDesc: 'พบ {total} รายการ: {newCount} เรื่องใหม่, {existingCount} เรื่องที่อัปเดต',
    discardImport: 'ยกเลิก',
    confirmAndImport: '✓ ยืนยันและนำเข้า',
    importing: 'กำลังนำเข้า...',
    sectionJobsTitle: 'งานอัตโนมัติและงานเบื้องหลัง',
    sectionJobsDesc: 'MangaTracker รันงานอัตโนมัติรายวัน สามารถรันด้วยตัวเองได้ด้านล่าง',
    purgeJobTitle: '🧹 ล้างถังขยะ (30 วัน)',
    purgeJobDesc: 'ลบตอนที่เก็บไว้เกิน 30 วันออกจากระบบอย่างถาวร',
    runPurgeNow: 'ล้างถังขยะตอนนี้',
    purging: 'กำลังล้าง...',
    updateJobTitle: '🔄 ตรวจหาตอนใหม่',
    updateJobDesc: 'สแกนหาตอนที่ปล่อยใหม่จาก MangaDex และเว็บทั่วไปเพื่อแคชล่วงหน้า',
    checkUpdatesNow2: 'ตรวจเช็คตอนนี้',
    checking: 'กำลังตรวจ...',
    sectionTokensTitle: 'API Token',
    sectionTokensDesc: 'API token ช่วยให้เครื่องมือภายนอก เช่น iOS Shortcuts และบุ๊กมาร์คเลต บันทึกมังงะได้อย่างปลอดภัย',
    tokenNamePlaceholder: 'ชื่อ Token (เช่น iPhone ของฉัน, บุ๊กมาร์คเลต Safari)',
    createToken: 'สร้าง Token',
    generating: 'กำลังสร้าง...',
    newTokenCreated: 'สร้าง Token ใหม่แล้ว! คัดลอกไว้เลย (จะไม่แสดงอีกครั้ง):',
    copyKey: 'คัดลอก',
    copied: '✓ คัดลอกแล้ว',
    activeTokens: 'Token ที่ใช้งานอยู่',
    loadingTokens: 'กำลังโหลด Token...',
    noTokensYet: 'ยังไม่มี API Token (โหมดผู้ใช้เดี่ยวจะรับคำขอโดยไม่ต้องยืนยันตัวตน)',
    revokeToken: 'ยกเลิก',
    sectionBookmarkletTitle: 'บุ๊กมาร์คเลตด้วยคลิกเดียว',
    sectionBookmarkletDesc: 'ลากปุ่มด้านล่างไปยังแถบบุ๊กมาร์คในเบราว์เซอร์ เพื่อบันทึกมังงะได้ทันทีขณะอ่าน!',
    testToastPreview: '🧪 ทดสอบการแจ้งเตือน',
    dragInstruction: '👉 ลากปุ่มนี้ไปยังแถบบุ๊กมาร์ค:',
    sectionMobileTitle: 'แชร์มือถือ & PWA',
    sectionMobileDesc: 'ตั้งค่าการแชร์จาก Safari, Chrome และแอปอ่านมังงะบนมือถือ',
  },
  en: {
    // Navigation & Header
    appTitle: 'Manga Tracker',
    appSubtitle: 'Smart URL resolver & automatic chapter replacer',
    mvpBadge: 'MVP',
    singleUser: 'Single User',
    navLibrary: 'Library',
    navTrash: 'Trash (30d)',
    navSettings: 'Settings & Ingestion',
    toggleTheme: 'Toggle Theme (White/Black)',
    toggleLanguage: 'Toggle Language (TH/EN)',

    // Add Manga Bar
    singleMode: 'Single Add',
    bulkMode: 'Bulk Add',
    urlPlaceholder: 'Paste any chapter URL (e.g. Nekopost, MangaDex, etc.)...',
    bulkPlaceholder: 'Paste multiple chapter URLs (one per line)...',
    trackChapter: 'Track Chapter',
    saving: 'Saving...',
    resolving: 'Resolving...',
    customTitlePlaceholder: 'Custom series title (optional)',
    tagsPlaceholder: 'Tags (comma separated, e.g. action, isekai)',
    bulkSummary: 'Bulk Ingestion',
    bulkDetected: 'Detected {count} valid URLs',
    startBulkIngestion: 'Start Ingestion',
    bulkProcessing: 'Processing URL {current} of {total}...',
    bulkDone: 'All URLs processed successfully!',
    bulkFailures: 'Some URLs encountered errors',
    bulkSuccessCount: '{count} succeeded',
    bulkErrorCount: '{count} failed',

    // Update Checker Widget
    updateWidgetTitle: 'Active Series Update Check',
    updateWidgetDesc: 'Scan for newly released chapters across your reading list',
    checkUpdatesNow: 'Check Updates Now',
    checkingUpdates: 'Checking Updates...',
    filterUpdatesOnly: 'Filter Updates Only',
    showAllSeries: 'Show All Series',
    updatesFoundBadge: '{count} series updated!',
    readNextChapter: 'Read Next Chapter',
    allCaughtUp: 'All series are caught up',
    lastChecked: 'Last checked',

    // Filter Bar
    searchPlaceholder: 'Search titles, #tags, or sources...',
    statusAll: 'All',
    statusUnread: 'Unread',
    statusReading: 'Reading',
    statusRead: 'Read',
    statusWaiting: 'Waiting',
    statusPaused: 'Paused',
    statusDropped: 'Dropped',
    sortBy: 'Sort by:',
    sortUpdated: 'Recently Updated',
    sortTitle: 'Title A-Z',
    sortChapter: 'Chapter Number',
    sortCreated: 'Newest Added',

    // Library Page & Multi-Select
    myLibraryTitle: 'My Manga Library',
    librarySubtitle: 'Paste any chapter URL to automatically update or create series.',
    refresh: 'Refresh',
    selectMode: 'Select Items',
    cancelSelectMode: 'Cancel Selection',
    selectedCount: '{count} selected',
    selectAll: 'Select All',
    deselectAll: 'Deselect',
    deleteSelected: 'Delete Selected',
    confirmDeleteBulkTitle: 'Delete Selected Series?',
    confirmDeleteBulkDesc: '{count} series will be moved to trash and can be restored within 30 days.',
    confirmDelete: 'Confirm Delete',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    noSeriesFound: 'No series found',
    noUpdatesFound: 'No series with new updates',
    noSeriesHint: 'Paste a chapter URL in the box above to start tracking your reading list.',
    noUpdatesHint: 'All series are currently caught up, or click "Check Updates Now" above to scan again.',
    adjustFilterHint: 'Try adjusting your search query or status filter.',

    // Series Card
    continueReading: 'Read Current',
    nextChapter: 'Next Chapter',
    checkingNext: 'Finding next chapter...',
    caughtUp: 'Caught up',
    mergeWith: 'Merge with series...',
    editTitle: 'Edit Title',
    deleteSeries: 'Delete Series',
    needsReviewBadge: 'Needs Review',
    newUpdateBadge: 'New Update!',
    sourceDomain: 'Source',
    savedAt: 'Saved',
    justNow: 'Just now',
    minutesAgo: '{m}m ago',
    hoursAgo: '{h}h ago',
    daysAgo: '{d}d ago',
    confirmDeleteSingleTitle: 'Delete this series?',
    confirmDeleteSingleDesc: 'This series will be moved to trash and can be restored within 30 days.',

    // Merge Dialog
    mergeTitle: 'Merge Series',
    mergeDesc: 'Combine chapters if this title was imported under a different URL.',
    suggestedMatches: 'Suggested matches:',
    orSelectManually: 'Or pick target series manually:',
    selectTargetSeries: 'Select target series...',
    mergeButton: 'Merge into this',
    merging: 'Merging...',

    // Trash Page
    trashTitle: 'Archived Chapters (Trash)',
    trashSubtitle: 'Replaced chapters are safely archived here for 30 days before automatic purge.',
    backToLibrary: '← Back to Library',
    trashLoading: 'Loading archived chapters...',
    trashEmpty: 'Trash is Empty',
    trashEmptyDesc: 'Whenever you save a newer chapter for an existing series, the previous chapter is automatically moved here for 30 days before deletion.',
    returnToLibrary: 'Return to Library →',
    archivedChapters: '{n} archived {n, plural, one {chapter} other {chapters}}',
    autoPurge30: 'Auto-purges 30 days after archive',
    archivedAtLabel: 'Archived:',
    restoredXTimes: 'Restored {n}x previously',
    daysLeft: '{n} days left',
    dayLeft: '1 day left',
    restoreToActive: 'Restore to Active',
    restoring: 'Restoring...',
    deletePermanentlyLabel: 'Delete permanently',
    confirmPermDelete: 'Permanently delete this archived chapter now? This cannot be undone.',

    // Settings Page
    settingsTitle: 'Settings & Integrations',
    settingsSubtitle: 'Configure mobile share targets, backup & import, API tokens, and scheduled automation',
    sectionBackupTitle: 'Backup & Import Data',
    sectionBackupDesc: 'Export your entire library as JSON, or import browser bookmarks (Chrome/Firefox/Safari Netscape HTML) and JSON backups with dry-run preview.',
    exportLibraryTitle: 'Export Library',
    exportLibraryDesc: 'Download a complete JSON snapshot of all series, custom titles, tags, and reading history.',
    exportDownload: '⬇️ Download Backup (.json)',
    importTitle: 'Import Bookmarks or Backup',
    importDesc: 'Upload a browser bookmarks HTML file or a MangaTracker JSON backup file.',
    analyzingFile: '🔍 Analyzing file...',
    selectFileToImport: '📁 Select File to Import (.html / .json)',
    importPreviewTitle: '🔎 Import Preview (Dry-Run)',
    importPreviewDesc: 'Found {total} items: {newCount} new series, {existingCount} existing series updates.',
    discardImport: 'Discard',
    confirmAndImport: '✓ Confirm & Import Now',
    importing: 'Importing...',
    sectionJobsTitle: 'Automated Jobs & Background Tasks',
    sectionJobsDesc: 'MangaTracker automatically runs daily background jobs via GitHub Actions / Cron webhooks. You can also trigger them manually below.',
    purgeJobTitle: '🧹 30-Day Retention Purge',
    purgeJobDesc: 'Permanently cleans up chapters in Trash that have exceeded their 30-day countdown timer.',
    runPurgeNow: 'Run Purge Now',
    purging: 'Purging...',
    updateJobTitle: '🔄 Active Series Update Check',
    updateJobDesc: 'Scans reading and unread series via MangaDex feed and URL pattern probe to pre-cache next chapters.',
    checkUpdatesNow2: 'Check Updates Now',
    checking: 'Checking...',
    sectionTokensTitle: 'API Tokens',
    sectionTokensDesc: 'API tokens allow external tools like iOS Shortcuts, bookmarklets, and browser extensions to save manga to your library securely.',
    tokenNamePlaceholder: 'Token name (e.g. My iPhone, Safari Bookmarklet)',
    createToken: 'Create Token',
    generating: 'Generating...',
    newTokenCreated: 'New Token Created! Copy it now (it will not be shown again):',
    copyKey: 'Copy Key',
    copied: '✓ Copied',
    activeTokens: 'Active Tokens',
    loadingTokens: 'Loading tokens...',
    noTokensYet: 'No API tokens created yet. (Single-user mode will accept unauthenticated requests by default).',
    revokeToken: 'Revoke',
    sectionBookmarkletTitle: '1-Tap Browser Bookmarklet',
    sectionBookmarkletDesc: 'Drag the button below to your browser bookmarks bar. When reading any manga online, click it to save instantly!',
    testToastPreview: '🧪 Test Toast Preview',
    dragInstruction: '👉 Drag this button to your Bookmarks Bar:',
    sectionMobileTitle: 'Mobile Sharing & PWA Setup',
    sectionMobileDesc: 'Configure mobile sharing from Safari, Chrome, and reading apps.',
  },
};

interface PreferencesContextType {
  language: Language;
  theme: Theme;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load stored preferences
    try {
      const savedLang = localStorage.getItem('manga_tracker_lang') as Language;
      if (savedLang === 'th' || savedLang === 'en') {
        setLanguageState(savedLang);
      }

      const savedTheme = localStorage.getItem('manga_tracker_theme') as Theme;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } else {
        applyTheme('dark');
      }
    } catch {
      applyTheme('dark');
    }
    setMounted(true);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('manga_tracker_lang', lang);
    } catch {}
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('manga_tracker_theme', newTheme);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'th' ? 'en' : 'th');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const t = (key: keyof Translations, params?: Record<string, string | number>): string => {
    const text = translations[language]?.[key] || translations['en']?.[key] || (key as string);
    if (!params) return text;

    return Object.entries(params).reduce((acc, [k, v]) => {
      return acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }, text);
  };

  return (
    <PreferencesContext.Provider
      value={{
        language,
        theme,
        toggleLanguage,
        toggleTheme,
        setLanguage,
        setTheme,
        t,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
