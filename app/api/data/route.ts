import { authenticate, clearAttendance, deleteEvent, getAllData, importData, saveAttendance, saveEvent, saveMember, savePlace } from '../../../server/store';
import { clearSessionCookie, createSession, readSession, sessionCookie } from '../../../server/session';
import type { Attendance, DanceEvent, Member, Place } from '../../../src/types';
import type { AppData } from '../../../src/types';

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  if (!await readSession(request)) return json({ data: { members: [], events: [], attendances: [], places: [] } });
  return json({ data: await getAllData() });
}

export async function POST(request: Request) {
  try {
    const { action, payload } = await request.json() as { action: string; payload?: Record<string, unknown> };
    if (action === 'login') {
      const member = await authenticate(String(payload?.username || ''), String(payload?.password || ''));
      if (!member) return json({ error: 'Usuario o clave incorrectos' }, 401);
      return json({ data: await getAllData() }, 200, { 'Set-Cookie': sessionCookie(await createSession(member.id)) });
    }
    if (action === 'logout') return json({ data: { members: [], events: [], attendances: [], places: [] } }, 200, { 'Set-Cookie': clearSessionCookie });
    if (!await readSession(request)) return json({ error: 'La sesión ha caducado' }, 401);
    if (action === 'saveMember') await saveMember(payload as unknown as Member);
    else if (action === 'savePlace') await savePlace(payload as unknown as Place);
    else if (action === 'saveEvent') await saveEvent(payload as unknown as DanceEvent);
    else if (action === 'deleteEvent') await deleteEvent(String(payload?.eventId));
    else if (action === 'saveAttendance') await saveAttendance(payload as unknown as Attendance);
    else if (action === 'clearAttendance') await clearAttendance(String(payload?.eventId), String(payload?.memberId));
    else if (action === 'importData') await importData(payload as unknown as AppData);
    else return json({ error: 'Operación no válida' }, 400);
    return json({ data: await getAllData() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se ha podido completar la operación' }, 500);
  }
}
