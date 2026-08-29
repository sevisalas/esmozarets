import { createHmac, timingSafeEqual } from 'node:crypto';
import * as store from '../src/storage/baserowProvider.js';
import type { AppData, Attendance, DanceEvent, Member, Place } from '../src/types.js';

const secret = () => process.env.SESSION_SECRET || process.env.BASEROW_TOKEN || '';
const sign = (id: string) => createHmac('sha256', secret()).update(id).digest('hex');
const cookieFor = (id: string) => `esm_session=${encodeURIComponent(`${id}.${sign(id)}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;

function sessionId(req: any): string | null {
  const raw = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('esm_session='))?.slice(12);
  if (!raw) return null;
  const [id, signature] = decodeURIComponent(raw).split('.');
  const expected = sign(id || '');
  if (!id || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return id;
}

const publicData = (data: AppData): AppData => ({ ...data, members: data.members.map((member) => ({ ...member, password: '' })) });

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      if (!sessionId(req)) return res.status(200).json({ data: { members: [], events: [], attendances: [], places: [] } });
      return res.status(200).json({ data: publicData(await store.getAllData()) });
    }
    const { action, payload } = req.body || {};
    if (action === 'login') {
      const data = await store.getAllData();
      const username = String(payload?.username || '').trim().toLocaleLowerCase();
      const member = data.members.find((item) => item.active && item.username.trim().toLocaleLowerCase() === username && item.password === String(payload?.password || ''));
      if (!member) return res.status(401).json({ error: 'Usuario o clave incorrectos' });
      res.setHeader('Set-Cookie', cookieFor(member.id));
      return res.status(200).json({ data: publicData(data) });
    }
    if (action === 'logout') {
      res.setHeader('Set-Cookie', 'esm_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return res.status(200).json({ data: { members: [], events: [], attendances: [], places: [] } });
    }
    if (!sessionId(req)) return res.status(401).json({ error: 'La sesión ha caducado' });
    let data: AppData;
    if (action === 'saveMember') data = await store.saveMember(payload as Member);
    else if (action === 'savePlace') data = await store.savePlace(payload as Place);
    else if (action === 'saveEvent') data = await store.saveEvent(payload as DanceEvent);
    else if (action === 'deleteEvent') data = await store.deleteEvent(String(payload?.eventId));
    else if (action === 'saveAttendance') data = await store.saveAttendance(payload as Attendance);
    else if (action === 'clearAttendance') data = await store.clearAttendance(String(payload?.eventId), String(payload?.memberId));
    else return res.status(400).json({ error: 'Operación no válida' });
    return res.status(200).json({ data: publicData(data) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'No se ha podido completar la operación' });
  }
}
