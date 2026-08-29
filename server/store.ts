import { env } from 'cloudflare:workers';
import type { AppData, Attendance, DanceEvent, Member, Place } from '../src/types';

type SiteEnv = { DB: D1Database; UPLOADS: R2Bucket; SESSION_SECRET?: string };
export const siteEnv = env as unknown as SiteEnv;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, location TEXT NOT NULL, place_id TEXT NOT NULL DEFAULT '', reservation_confirmed INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, finished INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attendances (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, member_id TEXT NOT NULL, status TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, UNIQUE(event_id, member_id))`,
  `CREATE INDEX IF NOT EXISTS idx_events_place_id ON events(place_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendances_event_member ON attendances(event_id, member_id)`,
];

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, salt = crypto.randomUUID()): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return `v2:${salt}:${bytesToHex(new Uint8Array(digest))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt] = stored.split(':');
  return Boolean(salt) && await hashPassword(password, salt) === stored;
}

export async function ensureDatabase() {
  await siteEnv.DB.batch(schemaStatements.map((sql) => siteEnv.DB.prepare(sql)));
  const count = await siteEnv.DB.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
  if (!count?.count) {
    const now = new Date().toISOString();
    await siteEnv.DB.prepare('INSERT INTO members (id, username, name, active, password_hash, created_at) VALUES (?, ?, ?, 1, ?, ?)')
      .bind(crypto.randomUUID(), 'Carmen', 'Carmen', await hashPassword('1234'), now).run();
  } else {
    const legacyDemo = await siteEnv.DB.prepare("SELECT id FROM members WHERE username = 'Carmen' COLLATE NOCASE AND password_hash NOT LIKE 'v2:%'").first<{ id: string }>();
    if (legacyDemo) await siteEnv.DB.prepare('UPDATE members SET password_hash = ? WHERE id = ?').bind(await hashPassword('1234'), legacyDemo.id).run();
  }
}

export async function authenticate(username: string, password: string): Promise<Member | null> {
  await ensureDatabase();
  const row = await siteEnv.DB.prepare('SELECT * FROM members WHERE username = ? COLLATE NOCASE').bind(username.trim()).first<Record<string, unknown>>();
  if (!row || !row.active || !await verifyPassword(password, String(row.password_hash))) return null;
  return memberFromRow(row);
}

const memberFromRow = (row: Record<string, unknown>): Member => ({
  id: String(row.id), username: String(row.username), name: String(row.name), active: Boolean(row.active), isAdmin: true, password: '', createdAt: String(row.created_at),
});
const placeFromRow = (row: Record<string, unknown>): Place => ({
  id: String(row.id), name: String(row.name), address: String(row.address), notes: String(row.notes), imageUrl: String(row.image_url), active: Boolean(row.active), createdAt: String(row.created_at),
});
const eventFromRow = (row: Record<string, unknown>): DanceEvent => ({
  id: String(row.id), title: String(row.title), date: String(row.date), time: String(row.time), location: String(row.location), placeId: String(row.place_id), clothingRequired: Boolean(row.reservation_confirmed), notes: String(row.notes), imageUrl: String(row.image_url), active: Boolean(row.active), finished: Boolean(row.finished), createdAt: String(row.created_at),
});
const attendanceFromRow = (row: Record<string, unknown>): Attendance => ({
  id: String(row.id), eventId: String(row.event_id), memberId: String(row.member_id), status: row.status as Attendance['status'], comment: String(row.comment), updatedAt: String(row.updated_at),
});

export async function getAllData(): Promise<AppData> {
  await ensureDatabase();
  const [members, places, events, attendances] = await Promise.all([
    siteEnv.DB.prepare('SELECT * FROM members ORDER BY active DESC, name').all<Record<string, unknown>>(),
    siteEnv.DB.prepare('SELECT * FROM places ORDER BY active DESC, name').all<Record<string, unknown>>(),
    siteEnv.DB.prepare('SELECT * FROM events ORDER BY date, time').all<Record<string, unknown>>(),
    siteEnv.DB.prepare('SELECT * FROM attendances ORDER BY updated_at').all<Record<string, unknown>>(),
  ]);
  return { members: members.results.map(memberFromRow), places: places.results.map(placeFromRow), events: events.results.map(eventFromRow), attendances: attendances.results.map(attendanceFromRow) };
}

export async function saveMember(member: Member) {
  const existing = await siteEnv.DB.prepare('SELECT password_hash FROM members WHERE id = ?').bind(member.id).first<{ password_hash: string }>();
  const passwordHash = member.password ? await hashPassword(member.password) : existing?.password_hash;
  if (!passwordHash) throw new Error('La contraseña es obligatoria');
  await siteEnv.DB.prepare(`INSERT INTO members (id, username, name, active, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET username=excluded.username, name=excluded.name, active=excluded.active, password_hash=excluded.password_hash`)
    .bind(member.id, member.username, member.name, member.active ? 1 : 0, passwordHash, member.createdAt).run();
}

export async function savePlace(place: Place) {
  await siteEnv.DB.prepare(`INSERT INTO places (id, name, address, notes, image_url, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, address=excluded.address, notes=excluded.notes, image_url=excluded.image_url, active=excluded.active`)
    .bind(place.id, place.name, place.address, place.notes, place.imageUrl, place.active ? 1 : 0, place.createdAt).run();
}

export async function saveEvent(event: DanceEvent) {
  await siteEnv.DB.prepare(`INSERT INTO events (id, title, date, time, location, place_id, reservation_confirmed, notes, image_url, active, finished, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, date=excluded.date, time=excluded.time, location=excluded.location, place_id=excluded.place_id, reservation_confirmed=excluded.reservation_confirmed, notes=excluded.notes, image_url=excluded.image_url, active=excluded.active, finished=excluded.finished`)
    .bind(event.id, event.title, event.date, event.time, event.location, event.placeId, event.clothingRequired ? 1 : 0, event.notes, event.imageUrl, event.active ? 1 : 0, event.finished ? 1 : 0, event.createdAt).run();
}

export async function deleteEvent(id: string) {
  await siteEnv.DB.batch([
    siteEnv.DB.prepare('DELETE FROM attendances WHERE event_id = ?').bind(id),
    siteEnv.DB.prepare('DELETE FROM events WHERE id = ?').bind(id),
  ]);
}

export async function saveAttendance(attendance: Attendance) {
  await siteEnv.DB.prepare(`INSERT INTO attendances (id, event_id, member_id, status, comment, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id, member_id) DO UPDATE SET status=excluded.status, comment=excluded.comment, updated_at=excluded.updated_at`)
    .bind(attendance.id, attendance.eventId, attendance.memberId, attendance.status, attendance.comment, attendance.updatedAt).run();
}

export async function clearAttendance(eventId: string, memberId: string) {
  await siteEnv.DB.prepare('DELETE FROM attendances WHERE event_id = ? AND member_id = ?').bind(eventId, memberId).run();
}

export async function importData(data: AppData) {
  await ensureDatabase();
  for (const member of data.members) await saveMember(member);
  for (const place of data.places ?? []) await savePlace(place);
  for (const event of data.events) await saveEvent(event);
  for (const attendance of data.attendances) await saveAttendance(attendance);
}
