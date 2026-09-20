export function extractUrlFromSharePayload(
  urlParam: string | null,
  textParam: string | null,
  titleParam: string | null
): string | null {
  const candidates = [urlParam, textParam, titleParam].filter(Boolean) as string[];
  const urlRegex = /https?:\/\/[^\s\n\r"<>]+/i;

  for (const candidate of candidates) {
    const match = candidate.match(urlRegex);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
}
