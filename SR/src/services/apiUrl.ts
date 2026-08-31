const configuredApiUrl = String(
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL || '',
).trim();

export function swoopApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!/^https?:\/\//i.test(configuredApiUrl)) return path;
  const base = configuredApiUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
