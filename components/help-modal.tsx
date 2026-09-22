'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  BookOpen,
  RefreshCw,
  Download,
  Lightbulb,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { usePreferences } from '@/lib/preferences-context';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { language, t } = usePreferences();
  const [currentStep, setCurrentStep] = useState(1);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('manga_tracker_hide_tutorial');
      if (stored === 'true') {
        setDontShowAgain(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontShowAgain(checked);
    try {
      localStorage.setItem('manga_tracker_hide_tutorial', checked ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const isTh = language === 'th';

  const steps = [
    {
      id: 1,
      icon: Search,
      tabTitle: isTh ? '1 วางลิงก์ / ค้นหา' : '1 Paste URL / Search',
      badge: isTh ? 'ขั้นตอน 1' : 'Step 1',
      title: isTh
        ? 'วางลิงก์ตอนที่กำลังอ่าน ระบบจะระบุเรื่องให้อัตโนมัติ'
        : 'Paste chapter URL, system auto-detects series and chapter',
      lead: isTh
        ? 'เพียงคัดลอก URL ตอนจากเว็บไซต์มังงะใดก็ได้มาวางในช่องค้นหา ระบบอัจฉริยะจะสกัดชื่อเรื่องและหมายเลขตอนโดยอัตโนมัติ'
        : 'Copy any manga chapter URL from your browser and paste it. Our smart resolver extracts title and chapter instantly.',
      checkpoints: isTh
        ? [
            'รองรับทั้ง MangaDex และเว็บไซต์มังงะทั่วไปโดยตรง',
            'สามารถค้นหาตามชื่อเรื่องหรือแฮชแท็ก #tag ในคลังได้อย่างรวดเร็ว',
            'สกัดหมายเลขตอนอัตโนมัติ เช่น Ch. 179, ตอนที่ 15.5',
            'มีโหมดเพิ่มหลายเรื่องพร้อมกัน (Bulk Add) คราวละหลายสิบลำดับ',
          ]
        : [
            'Native support for MangaDex and generic manga reader sites',
            'Quickly search library by series title or custom #tags',
            'Automatic chapter number normalization (e.g. Ch. 179, Vol. 2 Ep. 15.5)',
            'Bulk Add mode available for importing dozens of URLs at once',
          ],
      tip: isTh
        ? 'หากบันทึกผ่านเบราว์เซอร์ สามารถลากปุ่ม 1-Tap Bookmarklet ในหน้าตั้งค่าไปไว้ที่แถบบุ๊กมาร์ก เพื่อกดบันทึกได้ด้วยคลิกเดียว'
        : 'Tip: Use the 1-Tap Bookmarklet from Settings to bookmark chapters directly while browsing with a single click.',
      mockupType: 'add-bar',
    },
    {
      id: 2,
      icon: BookOpen,
      tabTitle: isTh ? '2 บันทึกตอนอ่าน' : '2 Track Reading',
      badge: isTh ? 'ขั้นตอน 2' : 'Step 2',
      title: isTh
        ? 'จัดการสถานะและแทนที่ตอนอ่านใหม่อัตโนมัติ'
        : 'Manage reading statuses & lossless auto-replacements',
      lead: isTh
        ? 'เมื่ออ่านตอนใหม่ ระบบจะอัปเดตตอนปัจจุบันให้ทันที พร้อมเก็บประวัติตอนเดิมไว้ในระบบกู้คืน ไม่เปลืองพื้นที่และไม่สับสน'
        : 'When saving a new chapter, your current reading progress advances seamlessly while archiving older chapters for clean organization.',
      checkpoints: isTh
        ? [
            'ระบบสลับสถานะอัตโนมัติ (กำลังอ่าน, อ่านแล้ว, รอตอบรับ, หยุดพัก)',
            'รองรับการรวมเรื่อง (Merge Series) ข้ามแหล่งที่มาให้เป็นเรื่องเดียวกัน',
            'มีระบบเลิกทำ (Undo Toast) ภายใน 5 วินาทีหากบันทึกผิดตอน',
            'แก้ไขชื่อเรื่องและจัดหมวดหมู่ด้วยแท็กที่คุณกำหนดเองได้ตามใจชอบ',
          ]
        : [
            'Flexible status transitions (Reading, Read, Waiting, Paused, Dropped)',
            'Merge series from different domains into a single unified record',
            'Instant 5-second Undo toast if you accidentally saved the wrong chapter',
            'Customize titles, covers, and assign multiple classification tags',
          ],
      tip: isTh
        ? 'การ์ดมังงะจะมีปุ่มลัดสำหรับคลิกไปยังตอนปัจจุบัน และปุ่มตอนถัดไปเพื่อเริ่มอ่านตอนใหม่ได้ทันที'
        : 'Tip: The series card provides direct action buttons to continue reading your current chapter or jump to the next chapter.',
      mockupType: 'series-card',
    },
    {
      id: 3,
      icon: RefreshCw,
      tabTitle: isTh ? '3 ตรวจตอนใหม่อัตโนมัติ' : '3 Auto-Check & Sync',
      badge: isTh ? 'ขั้นตอน 3' : 'Step 3',
      title: isTh
        ? 'ระบบสแกนหาตอนใหม่ ไม่พลาดทุกการอัปเดต'
        : 'Automated background scans for latest chapter releases',
      lead: isTh
        ? 'Manga Tracker มีระบบตรวจเช็กตอนที่เพิ่งปล่อยใหม่อย่างชาญฉลาด พร้อมแจ้งเตือนด้วยป้ายกำกับตอนใหม่ทันทีที่หน้าแรก'
        : 'Smart background workers periodically inspect supported hosts for new chapters, flagging updated series with bright badges.',
      checkpoints: isTh
        ? [
            'กดปุ่ม "ตรวจหาตอนใหม่" ในวิดเจ็ตหน้าแรกเพื่อสแกนแบบเรียลไทม์',
            'กรองดูเฉพาะเรื่องที่มีตอนใหม่ได้ในคลิกเดียว (Filter Updates Only)',
            'แสดงป้ายกำกับ "ตอนใหม่!" สีเขียวสดใสบนการ์ดมังงะที่มีอัปเดต',
            'ลิงก์ตรงไปยังตอนล่าสุดเพื่ออ่านได้ทันทีโดยไม่ต้องเข้าหน้าสารบัญ',
          ]
        : [
            'Click "Check Updates Now" on the home dashboard for on-demand scanning',
            'Filter by updated series with one click to see only new releases',
            'Prominent badge alerts you whenever a new chapter is detected',
            'Direct next-chapter link to jump straight into reading',
          ],
      tip: isTh
        ? 'สามารถตั้งเวลา Cron Job หรือเชื่อมต่อ Webhook สำหรับสแกนอัตโนมัติในพื้นหลังได้ผ่านหน้าตั้งค่า'
        : 'Tip: Configure background Cron jobs or webhooks in Settings for zero-maintenance automated tracking.',
      mockupType: 'update-checker',
    },
    {
      id: 4,
      icon: Download,
      tabTitle: isTh ? '4 สำรองและจัดการ' : '4 Backup & Manage',
      badge: isTh ? 'ขั้นตอน 4' : 'Step 4',
      title: isTh
        ? 'สำรองข้อมูล JSON และกู้คืนได้ทุกเวลา'
        : 'Full JSON backup, cross-device sync & easy recovery',
      lead: isTh
        ? 'ข้อมูลของคุณเป็นของคุณอย่างแท้จริง สามารถดาวน์โหลดไฟล์สำรองข้อมูล JSON เก็บไว้ หรือนำเข้ากลับเข้ามาได้ทุกเมื่อ'
        : 'Your reading history is yours. Export full library backups as portable JSON files, or restore deleted items from the 30-day trash.',
      checkpoints: isTh
        ? [
            'ส่งออกคลังมังงะทั้งระบบเป็นไฟล์ JSON ได้ในคลิกเดียว',
            'นำเข้าข้อมูลกลับเข้ามา พร้อมระบบตรวจสอบตัวอย่างก่อนยืนยัน',
            'ถังขยะกักเก็บตอนและเรื่องที่ลบไว้ 30 วันก่อนลบถาวร กู้คืนได้ตลอดเวลา',
            'รองรับการใช้งานทั้งบนคอมพิวเตอร์และมือถือได้อย่างลื่นไหล',
          ]
        : [
            'One-click full library export to standard JSON format',
            'Preview and diff import contents before committing changes',
            '30-day safety trash bin keeps deleted series safe from accidental loss',
            'Optimized responsive design across desktop, tablet, and mobile devices',
          ],
      tip: isTh
        ? 'หากต้องการใช้งานข้ามอุปกรณ์ แนะนำให้เข้าสู่ระบบบัญชีเพื่อซิงค์ข้อมูลผ่านคลาวด์แบบอัตโนมัติ'
        : 'Tip: Sign in with your account to automatically sync your reading list across all your devices securely.',
      mockupType: 'backup-manage',
    },
  ];

  const currentStepData = steps[currentStep - 1];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden text-foreground">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 sm:px-8 py-4 sm:py-5 bg-card/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 font-bold text-sm tracking-wider">
              MT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                  {t('userGuide')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground line-clamp-1">
                {t('userGuideSubtitle')}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card-hover text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Navigation Tabs Bar */}
        <div className="border-b border-border/60 bg-muted/20 px-3 sm:px-8 py-2.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-foreground text-background shadow-xs'
                      : 'border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-card-hover'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-background' : 'text-muted-foreground'}`} />
                  <span>{step.tabTitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left Column: Visual Mockup Screen */}
            <div className="lg:col-span-6 flex flex-col justify-center items-center">
              <div className="relative w-full rounded-2xl border border-border/80 bg-background/90 p-4 sm:p-5 shadow-inner overflow-hidden min-h-[290px] flex flex-col justify-center">
                {/* Subtle grid pattern background */}
                <div
                  className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07] pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
                    backgroundSize: '16px 16px',
                  }}
                />

                {/* Mockup Case 1: Add Bar */}
                {currentStepData.mockupType === 'add-bar' && (
                  <div className="relative z-10 w-full space-y-3.5 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Search className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{isTh ? 'เพิ่มและติดตามมังงะ' : 'Add & Track Manga'}</span>
                      </div>
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-500 border border-indigo-500/20">
                        Smart Resolver
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-muted-foreground">
                        {isTh ? 'ลิงก์ตอนที่อ่าน (Mock URL):' : 'Chapter URL (Mock Link):'}
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-card px-3 py-2 text-foreground font-mono text-[11px] shadow-xs">
                        <span className="truncate text-indigo-500 dark:text-indigo-400">
                          https://demo-reader.example/series/solo-leveling/ch-179
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                        <span className="text-muted-foreground text-[10px] uppercase">
                          {isTh ? 'ชื่อเรื่องที่ระบุได้' : 'Detected Title'}
                        </span>
                        <div className="font-semibold truncate">Solo Leveling</div>
                      </div>
                      <div className="p-2.5 rounded-xl border border-border bg-card space-y-1">
                        <span className="text-muted-foreground text-[10px] uppercase">
                          {isTh ? 'ตอนล่าสุด' : 'Chapter'}
                        </span>
                        <div className="font-semibold text-emerald-500">Ch. 179.00</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{isTh ? 'บันทึกตอนอ่าน' : 'Track Chapter'}</span>
                    </button>
                  </div>
                )}

                {/* Mockup Case 2: Series Card */}
                {currentStepData.mockupType === 'series-card' && (
                  <div className="relative z-10 w-full space-y-3.5 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card shadow-xs">
                      <div className="h-16 w-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground truncate text-sm">Frieren: Beyond Journey's End</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.2">
                            {isTh ? 'กำลังอ่าน' : 'Reading'}
                          </span>
                          <span>Ch. 128</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono">
                          demo-manga.org
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-border bg-card text-foreground font-semibold text-[11px]">
                        <span>{isTh ? 'อ่านตอนปัจจุบัน' : 'Read Current'}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-indigo-600 text-white font-semibold text-[11px] shadow-xs">
                        <span>{isTh ? 'ตอนถัดไป Ch. 129' : 'Next Ch. 129'}</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-border/80 bg-muted/20 text-[11px] flex items-center justify-between text-muted-foreground">
                      <span>{isTh ? 'บันทึกผิดตอน?' : 'Accidental save?'}</span>
                      <span className="text-amber-500 font-semibold cursor-pointer">
                        {isTh ? 'เลิกทำ (Undo)' : 'Undo (5s)'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Mockup Case 3: Update Checker */}
                {currentStepData.mockupType === 'update-checker' && (
                  <div className="relative z-10 w-full space-y-3.5 text-xs animate-in fade-in duration-200">
                    <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{isTh ? 'สแกนตอนใหม่ประจำวัน' : 'Daily Update Checker'}</span>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          {isTh ? '2 ตอนใหม่' : '2 Updates'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isTh ? 'สแกนล่าสุด: ไม่กี่นาทีที่แล้ว' : 'Last scanned: A few minutes ago'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-semibold text-foreground truncate">Chainsaw Man</span>
                        </div>
                        <span className="text-indigo-500 font-mono text-[11px] font-semibold">
                          Ch. 175 {isTh ? 'ปล่อยแล้ว' : 'Ready'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-semibold text-foreground truncate">Jujutsu Kaisen</span>
                        </div>
                        <span className="text-indigo-500 font-mono text-[11px] font-semibold">
                          Ch. 271 {isTh ? 'ปล่อยแล้ว' : 'Ready'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mockup Case 4: Backup & Manage */}
                {currentStepData.mockupType === 'backup-manage' && (
                  <div className="relative z-10 w-full space-y-3.5 text-xs animate-in fade-in duration-200">
                    <div className="p-3 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Download className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{isTh ? 'ส่งออกคลังข้อมูลสำรอง' : 'Export JSON Backup'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>manga-library-backup.json</span>
                        <span className="text-emerald-500 font-medium">100% Ready</span>
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-foreground text-background py-1.5 font-semibold text-[11px]"
                      >
                        {isTh ? 'ดาวน์โหลดไฟล์สำรอง' : 'Download Backup'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl border border-border bg-card text-center">
                        <div className="text-muted-foreground text-[10px]">{isTh ? 'ถังขยะกักเก็บ' : 'Trash Storage'}</div>
                        <div className="font-bold text-foreground mt-0.5">30 {isTh ? 'วัน' : 'Days'}</div>
                      </div>
                      <div className="p-2.5 rounded-xl border border-border bg-card text-center">
                        <div className="text-muted-foreground text-[10px]">{isTh ? 'ความพร้อมระบบ' : 'Cloud Sync'}</div>
                        <div className="font-bold text-emerald-500 mt-0.5">{isTh ? 'พร้อมใช้งาน' : 'Active'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Step Details & Checklist */}
            <div className="lg:col-span-6 space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {currentStepData.badge}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {currentStepData.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {currentStepData.lead}
                </p>
              </div>

              {/* Checklist items */}
              <div className="space-y-2.5 pt-1">
                {currentStepData.checkpoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-foreground">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="leading-snug">{point}</span>
                  </div>
                ))}
              </div>

              {/* Pro Tip Box */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">{t('tipLabel')}: </span>
                  <span className="text-muted-foreground dark:text-amber-200/90 leading-relaxed">
                    {currentStepData.tip}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Footer Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-border/80 px-4 sm:px-8 py-3.5 sm:py-4 bg-muted/10">
          
          {/* Don't show again checkbox */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              id="hide-tutorial-checkbox"
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
            <label
              htmlFor="hide-tutorial-checkbox"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none"
            >
              {t('dontShowAgain')}
            </label>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">
              {t('stepIndicator', {
                current: currentStep,
                total: steps.length,
                title: currentStepData.tabTitle.replace(/^\d+\s*/, ''),
              })}
            </span>

            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-card-hover text-xs font-semibold text-foreground cursor-pointer shadow-xs transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{t('prevStep')}</span>
              </button>
            )}

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white cursor-pointer shadow-md shadow-indigo-600/20 transition-all ml-auto sm:ml-0"
              >
                <span>{t('nextStep')}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white cursor-pointer shadow-md shadow-emerald-600/20 transition-all ml-auto sm:ml-0"
              >
                <span>{t('finishTutorial')}</span>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
