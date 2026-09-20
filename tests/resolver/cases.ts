export interface ResolverTestCase {
  url: string;
  seriesKey?: string;
  seriesKeyPrefix?: string;
  ch?: number;
  conf?: 'high' | 'medium' | 'low';
  requiresNetwork?: boolean;
  requiresTitleLookup?: boolean;
  expectError?: 'INVALID_URL' | 'BLOCKED_HOST';
}

export const CASES: ResolverTestCase[] = [
  // --- Generic numeric: the core use case ---
  {
    url: 'https://www.nekopost.net/manga/17045/1',
    seriesKey: 'nekopost.net/manga/17045/{ch}',
    ch: 1,
    conf: 'high',
  },
  {
    url: 'https://www.nekopost.net/manga/17045/2',
    seriesKey: 'nekopost.net/manga/17045/{ch}',
    ch: 2,
    conf: 'high',
  }, // MUST merge with above
  {
    url: 'https://nekopost.net/manga/17045/2/',
    seriesKey: 'nekopost.net/manga/17045/{ch}',
    ch: 2,
    conf: 'high',
  }, // trailing slash + no www
  {
    url: 'https://www.nekopost.net/manga/17045/2?utm_source=fb',
    seriesKey: 'nekopost.net/manga/17045/{ch}',
    ch: 2,
    conf: 'high',
  }, // tracking stripped

  // --- MangaDex: UUIDs must resolve to the same series ---
  {
    url: 'https://mangadex.org/chapter/e4e5b2d6-7488-45fb-a079-b24458d822e8',
    seriesKeyPrefix: 'mangadex:',
    conf: 'high',
    requiresNetwork: true,
  },
  {
    url: 'https://mangadex.org/chapter/f5ec3671-22f9-49ef-b389-9f10f3291071',
    seriesKeyPrefix: 'mangadex:',
    conf: 'high',
    requiresNetwork: true,
  },
  {
    url: 'https://mangadex.org/title/a1b2c3d4-0000-0000-0000-000000000000',
    seriesKeyPrefix: 'mangadex:',
    ch: undefined,
    conf: 'high',
    requiresNetwork: true,
  },

  // --- Slug + chapter patterns ---
  {
    url: 'https://site.com/manga/one-piece/chapter-1050',
    seriesKey: 'site.com/manga/one-piece/chapter-{ch}',
    ch: 1050,
    conf: 'high',
  },
  {
    url: 'https://site.com/manga/one-piece/ch-1050',
    seriesKey: 'site.com/manga/one-piece/ch-{ch}',
    ch: 1050,
    conf: 'high',
  },

  // --- Decimals and specials ---
  {
    url: 'https://site.com/read/solo-leveling/chapter-10.5',
    seriesKey: 'site.com/read/solo-leveling/chapter-{ch}',
    ch: 10.5,
    conf: 'high',
  },

  // --- Query-param chapters ---
  {
    url: 'https://site.com/read?id=99&c=3',
    seriesKey: 'site.com/read?c={ch}&id=99',
    ch: 3,
    conf: 'medium',
  },

  // --- Opaque ID: must NOT be treated as a chapter number ---
  {
    url: 'https://site.com/read/998877',
    conf: 'low',
    requiresTitleLookup: true,
  },

  // --- Series landing page, no chapter ---
  {
    url: 'https://www.nekopost.net/manga/17045',
    seriesKey: 'nekopost.net/manga/17045',
    ch: undefined,
    conf: 'high',
  },

  // --- Must reject ---
  {
    url: 'javascript:alert(1)',
    expectError: 'INVALID_URL',
  },
  {
    url: 'http://localhost:3000/manga/1/1',
    expectError: 'BLOCKED_HOST',
  },
  {
    url: 'ftp://site.com/a',
    expectError: 'INVALID_URL',
  },
];
