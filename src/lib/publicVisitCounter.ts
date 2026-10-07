const COUNTER_ENDPOINT = 'https://heibzaolhwlzqaweludm.supabase.co/functions/v1/record-site-visit';
const VISITOR_TOKEN_KEY = 'm3tm:world:visitor-token:v1';
const VISIT_RECORDED_KEY = 'm3tm:world:visitor-counted:v1';
const PRODUCTION_HOSTS = new Set(['m3tm-world.vercel.app']);

function randomHex(bytesLength = 24): string {
  const bytes = new Uint8Array(bytesLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateVisitorToken(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_TOKEN_KEY);
    if (existing && /^[0-9a-f]{48}$/.test(existing)) return existing;
    const token = randomHex();
    window.localStorage.setItem(VISITOR_TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export async function recordWorldVisitOnce(): Promise<void> {
  if (typeof window === 'undefined' || !PRODUCTION_HOSTS.has(window.location.hostname)) return;
  try {
    if (window.localStorage.getItem(VISIT_RECORDED_KEY) === '1') return;
  } catch {
    return;
  }
  const visitorToken = getOrCreateVisitorToken();
  if (!visitorToken) return;
  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorToken }),
      keepalive: true,
    });
    if (!response.ok) return;
    window.localStorage.setItem(VISIT_RECORDED_KEY, '1');
  } catch {
    // Visitor telemetry must never block the public WORLD experience.
  }
}

