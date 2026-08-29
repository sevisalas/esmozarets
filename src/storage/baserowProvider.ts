import type { AppData, Attendance, AttendanceStatus, DanceEvent, Member, Place } from '../types.js';

interface BaserowListResponse<T> {
  next: string | null;
  results: T[];
}

interface BaserowEventRow {
  id: number;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  placeId?: string;
  isPlanning?: boolean;
  candidatePlaceIds?: string;
  possibleDates?: string;
  clothingRequired?: boolean;
  notes?: string;
  imageUrl?: string | null;
  ImageUrl?: string | null;
  Imagen?: string | null;
  imagen?: string | null | Array<{ url?: string; name?: string }>;
  cartel?: string | null;
  Cartel?: string | null;
  active?: boolean;
  finished?: boolean;
  createdAt?: string;
  titulo?: string; fecha?: string; hora?: string; lugar_id?: Array<{ id: number }>;
  es_votacion?: boolean; lugares_candidatos?: Array<{ id: number }>; fechas_posibles?: string;
  notas?: string; activo?: boolean; finalizado?: boolean; fecha_creacion?: string;
}

interface BaserowMemberRow {
  id: number;
  name?: string;
  nombre?: string;
  Nombre?: string;
  nombre_a_mostrar?: string;
  Nombre_a_mostrar?: string;
  usuario?: string;
  Usuario?: string;
  active?: boolean;
  isAdmin?: boolean;
  admin?: boolean;
  Admin?: boolean;
  password?: string | null;
  Password?: string | null;
  clave?: string | null;
  Clave?: string | null;
  contraseña?: string | null;
  Contraseña?: string | null;
  createdAt?: string;
  activo?: boolean; administrador?: boolean; fecha_creacion?: string;
}

interface BaserowAttendanceRow {
  id: number;
  eventId?: string;
  memberId?: string;
  status?: AttendanceStatus | string;
  preferredPlaceId?: string;
  preferredDate?: string;
  comment?: string;
  updatedAt?: string;
  uniqueKey?: string;
  evento_id?: string; miembro_id?: Array<{ id: number }>; estado?: string | { value?: string }; lugar_preferido_id?: Array<{ id: number }>;
  fecha_preferida?: string; comentario?: string; fecha_actualizacion?: string;
}

interface BaserowPlaceRow {
  id: number;
  name?: string;
  address?: string;
  notes?: string;
  imageUrl?: string | null;
  active?: boolean;
  createdAt?: string;
  nombre?: string; direccion?: string; notas?: string; imagen?: Array<{ url?: string; name?: string }>; activo?: boolean; fecha_creacion?: string;
}

interface BaserowFileUploadResponse {
  url?: string;
  name?: string;
}

const VALID_ATTENDANCE_STATUSES: AttendanceStatus[] = ['Sí', 'No', 'Quizás'];
const EVENT_META_PREFIX = '__ESM_META__';
const PLACE_PREFIX = '__ESM_PLACE__';

function parseMeta(value: string | undefined): Record<string, unknown> | null {
  if (!value?.startsWith(EVENT_META_PREFIX)) return null;
  try { return JSON.parse(value.slice(EVENT_META_PREFIX.length)) as Record<string, unknown>; } catch { return null; }
}

// Lee una lista de textos guardada como JSON (p. ej. fechas_posibles en un campo de texto largo).
function parseStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

const serverEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const viteEnv = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env) ?? {};
const config = {
  apiUrl: viteEnv.VITE_BASEROW_API_URL || serverEnv.VITE_BASEROW_API_URL || 'https://api.baserow.io',
  token: viteEnv.VITE_BASEROW_TOKEN || serverEnv.BASEROW_TOKEN,
  eventsTableId: viteEnv.VITE_BASEROW_EVENTS_TABLE_ID || serverEnv.VITE_BASEROW_EVENTS_TABLE_ID,
  membersTableId: viteEnv.VITE_BASEROW_MEMBERS_TABLE_ID || serverEnv.VITE_BASEROW_MEMBERS_TABLE_ID,
  attendanceTableId: viteEnv.VITE_BASEROW_ATTENDANCE_TABLE_ID || serverEnv.VITE_BASEROW_ATTENDANCE_TABLE_ID,
  placesTableId: viteEnv.VITE_BASEROW_PLACES_TABLE_ID || serverEnv.VITE_BASEROW_PLACES_TABLE_ID,
};

function requireConfig() {
  if (!config.token || config.token === 'AQUI_EL_TOKEN_REAL') {
    throw new Error('Falta configurar VITE_BASEROW_TOKEN');
  }

  if (!config.eventsTableId || !config.membersTableId || !config.attendanceTableId) {
    throw new Error('Faltan configurar los IDs de tablas de Baserow');
  }
}

function tableUrl(tableId: string, rowId?: string): string {
  const base = `${config.apiUrl.replace(/\/$/, '')}/api/database/rows/table/${tableId}/`;
  return rowId ? `${base}${rowId}/?user_field_names=true` : `${base}?user_field_names=true`;
}

function userFileUploadUrl(): string {
  return `${config.apiUrl.replace(/\/$/, '')}/api/user-files/upload-file/`;
}

function normalizeBaserowFileUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith('//')) {
    return `https:${trimmedUrl}`;
  }

  const baseUrl = config.apiUrl.replace(/\/$/, '');
  return trimmedUrl.startsWith('/') ? `${baseUrl}${trimmedUrl}` : `${baseUrl}/${trimmedUrl}`;
}

async function baserowFetch<T>(url: string, init?: RequestInit): Promise<T> {
  requireConfig();

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Token ${config.token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Baserow ${response.status}: ${detail || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function baserowUploadFetch<T>(url: string, body: FormData): Promise<T> {
  requireConfig();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.token}`,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Baserow ${response.status}: ${detail || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function listRows<T>(tableId: string): Promise<T[]> {
  const rows: T[] = [];
  let nextUrl: string | null = tableUrl(tableId);

  while (nextUrl) {
    const page: BaserowListResponse<T> = await baserowFetch<BaserowListResponse<T>>(nextUrl);
    rows.push(...page.results);
    nextUrl = page.next;
  }

  return rows;
}

function eventFromRow(row: BaserowEventRow): DanceEvent {
  const spanishImage = Array.isArray(row.imagen) ? row.imagen[0]?.url : row.imagen;
  const imageUrl = spanishImage ?? row.imageUrl ?? row.ImageUrl ?? row.Imagen ?? row.cartel ?? row.Cartel ?? '';
  const meta = parseMeta(row.notes);

  return {
    id: String(row.id),
    title: row.titulo ?? row.title ?? '',
    date: row.fecha ?? row.date ?? '',
    time: row.hora ?? row.time ?? '',
    location: row.location ?? '',
    placeId: row.lugar_id?.[0] ? String(row.lugar_id[0].id) : (row.placeId ?? String(meta?.placeId ?? '')),
    isPlanning: row.es_votacion ?? row.isPlanning ?? Boolean(meta?.isPlanning),
    candidatePlaceIds: row.lugares_candidatos?.map((item) => String(item.id)) ?? (row.candidatePlaceIds ? JSON.parse(row.candidatePlaceIds) : (Array.isArray(meta?.candidatePlaceIds) ? meta.candidatePlaceIds as string[] : [])),
    possibleDates: parseStringArray(row.fechas_posibles) ?? parseStringArray(row.possibleDates) ?? (Array.isArray(meta?.possibleDates) ? meta.possibleDates as string[] : []),
    clothingRequired: row.clothingRequired ?? false,
    notes: row.notas ?? (meta ? String(meta.notes ?? '') : (row.notes ?? '')),
    imageUrl: normalizeBaserowFileUrl(String(imageUrl || '')),
    active: row.activo ?? row.active ?? true,
    finished: row.finalizado ?? row.finished ?? false,
    createdAt: row.fecha_creacion ?? row.createdAt ?? '',
  };
}

function getMemberPassword(row: BaserowMemberRow): string {
  const password = row.clave ?? row.Clave ?? row.password ?? row.Password ?? row.contraseña ?? row.Contraseña ?? '';
  return String(password).trim();
}

function getMemberUsername(row: BaserowMemberRow): string {
  const username = row.usuario ?? row.Usuario ?? '';
  return String(username).trim();
}

function getMemberDisplayName(row: BaserowMemberRow): string {
  const name = row.nombre ?? row.nombre_a_mostrar ?? row.Nombre_a_mostrar ?? row.Nombre ?? row.name ?? '';
  return String(name).trim();
}

function memberFromRow(row: BaserowMemberRow): Member {
  const member = {
    id: String(row.id),
    username: getMemberUsername(row),
    name: getMemberDisplayName(row),
    active: row.activo ?? row.active ?? true,
    isAdmin: row.administrador ?? row.Admin ?? row.admin ?? row.isAdmin ?? false,
    password: getMemberPassword(row),
    createdAt: row.fecha_creacion ?? row.createdAt ?? '',
  };

  if (viteEnv.DEV) {
    console.log('Login member loaded', {
      id: member.id,
      username: member.username,
      name: member.name,
      active: member.active,
      isAdmin: member.isAdmin,
      hasPassword: Boolean(member.password),
      passwordLength: member.password?.length ?? 0,
    });
  }

  return member;
}

function attendanceFromRow(row: BaserowAttendanceRow): Attendance | null {
  const spanishStatus = typeof row.estado === 'object' ? row.estado.value : row.estado;
  const rawStatus = spanishStatus === 'Confirmado' ? 'Sí'
    : spanishStatus === 'Cancelado' ? 'No'
      : spanishStatus === 'Pendiente' ? 'Quizás'
        : (spanishStatus ?? row.status);
  if (!VALID_ATTENDANCE_STATUSES.includes(rawStatus as AttendanceStatus)) {
    return null;
  }

  const meta = parseMeta(row.comment);
  return {
    id: String(row.id),
    eventId: row.evento_id ?? row.eventId ?? '',
    memberId: row.miembro_id?.[0] ? String(row.miembro_id[0].id) : (row.memberId ?? ''),
    status: rawStatus as AttendanceStatus,
    preferredPlaceId: row.preferredPlaceId ?? String(meta?.preferredPlaceId ?? ''),
    preferredDate: row.preferredDate ?? String(meta?.preferredDate ?? ''),
    comment: row.comentario ?? (meta ? String(meta.comment ?? '') : (row.comment ?? '')),
    updatedAt: row.fecha_actualizacion ?? row.updatedAt ?? '',
  };
}

function placeFromRow(row: BaserowPlaceRow): Place {
  return {
    id: String(row.id),
    name: row.nombre ?? row.name ?? '',
    address: row.direccion ?? row.address ?? '',
    notes: row.notas ?? row.notes ?? '',
    imageUrl: normalizeBaserowFileUrl(String(row.imagen?.[0]?.url ?? row.imageUrl ?? '')),
    active: row.activo ?? row.active ?? true,
    createdAt: row.fecha_creacion ?? row.createdAt ?? '',
  };
}

function eventToPayload(event: DanceEvent) {
  // Baserow rechaza "" en campos de fecha: hay que enviar null.
  return {
    titulo: event.title,
    fecha: event.date || null,
    hora: event.time || '',
    lugar_id: event.placeId ? [Number(event.placeId)] : [],
    es_votacion: event.isPlanning,
    lugares_candidatos: event.candidatePlaceIds.map(Number),
    fechas_posibles: JSON.stringify(event.possibleDates ?? []),
    notas: event.notes,
    activo: event.active,
    finalizado: event.finished,
    fecha_creacion: (event.createdAt || new Date().toISOString()).slice(0, 10),
  };
}

async function imageFieldPayload(imageUrl: string, fallbackName: string): Promise<Array<{ name: string }> | undefined> {
  if (!imageUrl) return [];
  const match = imageUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) return undefined;
  const extension = (match[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: match[1] }), `${fallbackName}.${extension}`);
  const uploaded = await baserowUploadFetch<BaserowFileUploadResponse>(userFileUploadUrl(), body);
  if (!uploaded.name) throw new Error('Baserow no ha devuelto el nombre de la imagen subida');
  return [{ name: uploaded.name }];
}

function memberToPayload(member: Member) {
  return {
    usuario: member.username,
    nombre: member.name,
    activo: member.active,
    administrador: member.isAdmin,
    clave: member.password,
    fecha_creacion: (member.createdAt || new Date().toISOString()).slice(0, 10),
  };
}

function attendanceUniqueKey(eventId: string, memberId: string): string {
  return `${eventId}_${memberId}`;
}

function isBaserowRowId(id: string): boolean {
  return /^\d+$/.test(id);
}

function attendanceToPayload(attendance: Attendance) {
  return {
    evento_id: attendance.eventId,
    miembro_id: [Number(attendance.memberId)],
    estado: attendance.status === 'Sí' ? 'Confirmado' : attendance.status === 'No' ? 'Cancelado' : 'Pendiente',
    lugar_preferido_id: attendance.preferredPlaceId ? [Number(attendance.preferredPlaceId)] : [],
    fecha_preferida: attendance.preferredDate || null,
    comentario: attendance.comment,
    fecha_actualizacion: (attendance.updatedAt || new Date().toISOString()).slice(0, 10),
  };
}

async function findAttendanceRow(eventId: string, memberId: string): Promise<BaserowAttendanceRow | null> {
  const rows = await listRows<BaserowAttendanceRow>(config.attendanceTableId as string);
  return rows.find((row) => {
    const rowMemberId = row.miembro_id?.[0] ? String(row.miembro_id[0].id) : row.memberId;
    const rowEventId = row.evento_id ?? row.eventId;
    return rowMemberId === memberId && rowEventId === eventId;
  }) ?? null;
}

export async function getAllData(): Promise<AppData> {
  requireConfig();

  const [eventRows, memberRows, attendanceRows, placeRows] = await Promise.all([
    listRows<BaserowEventRow>(config.eventsTableId as string),
    listRows<BaserowMemberRow>(config.membersTableId as string),
    listRows<BaserowAttendanceRow>(config.attendanceTableId as string),
    config.placesTableId ? listRows<BaserowPlaceRow>(config.placesTableId) : Promise.resolve([]),
  ]);

  const embeddedPlaces = eventRows.filter((row) => row.title?.startsWith(PLACE_PREFIX)).map((row) => ({
    id: String(row.id), name: String(row.title).slice(PLACE_PREFIX.length), address: row.location ?? '',
    notes: String(parseMeta(row.notes)?.notes ?? ''), imageUrl: normalizeBaserowFileUrl(String(row.imageUrl ?? '')),
    active: row.active ?? true, createdAt: row.createdAt ?? '',
  }));
  const events = eventRows.filter((row) => !row.title?.startsWith(PLACE_PREFIX)).map(eventFromRow).filter((event) => event.title);
  const attendances = attendanceRows.map(attendanceFromRow).filter((attendance): attendance is Attendance => Boolean(attendance));
  for (const attendance of attendances) {
    const eventByTitle = events.find((event) => event.title === attendance.eventId);
    if (eventByTitle) attendance.eventId = eventByTitle.id;
  }
  return {
    events,
    members: memberRows.map(memberFromRow).filter((member) => member.username && member.name),
    attendances,
    places: [...placeRows.map(placeFromRow), ...embeddedPlaces].filter((place) => place.name),
  };
}

export async function savePlace(place: Place): Promise<AppData> {
  const placeImage = await imageFieldPayload(place.imageUrl, `lugar-${place.name}`);
  const payload = config.placesTableId ? {
    nombre: place.name,
    direccion: place.address,
    notas: place.notes,
    ...(placeImage !== undefined ? { imagen: placeImage } : {}),
    activo: place.active,
    fecha_creacion: (place.createdAt || new Date().toISOString()).slice(0, 10),
  } : {
    title: `${PLACE_PREFIX}${place.name}`, date: '2100-01-01', time: '', location: place.address,
    clothingRequired: false, notes: `${EVENT_META_PREFIX}${JSON.stringify({ notes: place.notes })}`,
    imageUrl: place.imageUrl || '', active: place.active, finished: true, createdAt: place.createdAt,
  };

  const targetTable = config.placesTableId || config.eventsTableId as string;

  if (place.id && isBaserowRowId(place.id)) {
    await baserowFetch<BaserowPlaceRow>(tableUrl(targetTable, place.id), { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    await baserowFetch<BaserowPlaceRow>(tableUrl(targetTable), { method: 'POST', body: JSON.stringify(payload) });
  }

  return getAllData();
}

export async function saveEvent(event: DanceEvent): Promise<AppData> {
  const eventImage = await imageFieldPayload(event.imageUrl, `evento-${event.title}`);
  const payload = { ...eventToPayload(event), ...(eventImage !== undefined ? { imagen: eventImage } : {}) };

  if (event.id && isBaserowRowId(event.id)) {
    await baserowFetch<BaserowEventRow>(tableUrl(config.eventsTableId as string, event.id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } else {
    await baserowFetch<BaserowEventRow>(tableUrl(config.eventsTableId as string), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  return getAllData();
}

export async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);

  const uploadedFile = await baserowUploadFetch<BaserowFileUploadResponse>(userFileUploadUrl(), body);
  if (!uploadedFile.url) {
    throw new Error('No se ha podido obtener la URL del archivo subido');
  }

  return normalizeBaserowFileUrl(uploadedFile.url);
}

export async function deleteEvent(id: string): Promise<AppData> {
  await baserowFetch<void>(tableUrl(config.eventsTableId as string, id), {
    method: 'DELETE',
  });

  return getAllData();
}

export async function saveMember(member: Member): Promise<AppData> {
  const payload = memberToPayload(member);

  if (member.id && isBaserowRowId(member.id)) {
    await baserowFetch<BaserowMemberRow>(tableUrl(config.membersTableId as string, member.id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } else {
    await baserowFetch<BaserowMemberRow>(tableUrl(config.membersTableId as string), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  return getAllData();
}

export async function saveAttendance(attendance: Attendance): Promise<AppData> {
  const existingRow = await findAttendanceRow(attendance.eventId, attendance.memberId);
  const payload = attendanceToPayload(attendance);

  if (existingRow) {
    await baserowFetch<BaserowAttendanceRow>(tableUrl(config.attendanceTableId as string, String(existingRow.id)), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } else {
    await baserowFetch<BaserowAttendanceRow>(tableUrl(config.attendanceTableId as string), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  return getAllData();
}

export async function clearAttendance(eventId: string, memberId: string): Promise<AppData> {
  const existingRow = await findAttendanceRow(eventId, memberId);

  if (existingRow) {
    await baserowFetch<void>(tableUrl(config.attendanceTableId as string, String(existingRow.id)), {
      method: 'DELETE',
    });
  }

  return getAllData();
}
