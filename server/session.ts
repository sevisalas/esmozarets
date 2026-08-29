import { siteEnv } from './store';

const encoder = new TextEncoder();
const cookieName = 'esmorzarets_session';

function secret() {
  return siteEnv.SESSION_SECRET || 'esmorzarets-local-development-only';
}

async function signature(value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(memberId: string) {
  const payload = `${memberId}.${Date.now() + 1000 * 60 * 60 * 24 * 30}`;
  return `${payload}.${await signature(payload)}`;
}

export async function readSession(request: Request): Promise<string | null> {
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  if (!token) return null;
  const [memberId, expires, suppliedSignature] = token.split('.');
  if (!memberId || !expires || !suppliedSignature || Number(expires) < Date.now()) return null;
  return await signature(`${memberId}.${expires}`) === suppliedSignature ? memberId : null;
}

export const sessionCookie = (token: string) => `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
export const clearSessionCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
