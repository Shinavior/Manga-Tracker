import { ResolverError } from './types';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'ref_src',
  'source',
  'igshid',
  'mc_cid',
  'mc_eid',
]);

const MAX_URL_LENGTH = 2048;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  if (
    host === 'localhost' ||
    host === '[::1]' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }

  // IPv4 checks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some((o) => o < 0 || o > 255)) return true;

    const [a, b] = octets;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (Link-local)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
  }

  return false;
}

export function normalizeUrl(input: string): URL {
  if (!input || typeof input !== 'string') {
    throw new ResolverError('INVALID_URL', 'URL must be a non-empty string');
  }

  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new ResolverError(
      'INVALID_URL',
      `URL length must be between 1 and ${MAX_URL_LENGTH} characters`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ResolverError('INVALID_URL', `Invalid URL format: ${input}`);
  }

  // Validate protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ResolverError(
      'INVALID_URL',
      `Unsupported protocol '${parsed.protocol}'. Only http: and https: are allowed.`
    );
  }

  // Check SSRF / blocked host
  if (isBlockedHost(parsed.hostname)) {
    throw new ResolverError(
      'BLOCKED_HOST',
      `Host '${parsed.hostname}' is blocked for security reasons.`
    );
  }

  // Upgrade http to https
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }

  // Lowercase hostname and remove leading www.
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  // Strip hash fragment
  parsed.hash = '';

  // Filter tracking parameters
  const remainingParams: [string, string][] = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      remainingParams.push([key, value]);
    }
  }

  // Sort remaining params for deterministic keys
  remainingParams.sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });

  parsed.search = new URLSearchParams(remainingParams).toString();

  // Strip trailing slashes while preserving root "/"
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }

  return parsed;
}
