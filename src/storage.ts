import type { AppData, Attendance, AttendanceStatus, DanceEvent, Member, Place } from './types';

const LOCAL_STORAGE_KEY = 'almuerzos-companeros-local-data';
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE as DataSourceMode | undefined;
const VALID_ATTENDANCE_STATUSES: AttendanceStatus[] = ['Sí', 'No', 'Quizás'];

export type DataSourceMode = 'local' | 'baserow';
export type RealDataOrigin = 'baserow' | 'localStorage' | 'internalSeed' | 'none';

export interface DataSourceMeta {
  configuredMode: DataSourceMode;
  realOrigin: RealDataOrigin;
  eventCount: number;
  lastLoadedAt: string;
  lastError: string | null;
}

export interface StorageResult {
  data: AppData;
  meta: DataSourceMeta;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return crypto.randomUUID();
}

function getRelativeDate(days: number): string {
  const nextDate = new Date();
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function createDefaultMembers(): Member[] {
  return [
    { id: createId(), username: 'Carmen', name: 'Carmen', active: true, isAdmin: true, password: '1234', createdAt: nowIso() },
    { id: createId(), username: 'Miguel', name: 'Miguel', active: true, isAdmin: false, password: '1234', createdAt: nowIso() },
  ];
}

function createSampleEvents(): DanceEvent[] {
  return [
    {
      id: createId(),
      title: 'Almuerzo de otoño',
      date: getRelativeDate(7),
      time: '14:00',
      location: 'Casa Carmela · Malvarrosa',
      placeId: '',
      isPlanning: false,
      candidatePlaceIds: [],
      possibleDates: [],
      clothingRequired: false,
      notes: 'Menú mediterráneo para compartir. Confirmaremos el precio cuando sepamos cuántos somos.',
      imageUrl: '',
      active: true,
      finished: false,
      createdAt: nowIso(),
    },
    {
      id: createId(),
      title: 'Comida de Navidad',
      date: getRelativeDate(10),
      time: '13:30',
      location: 'Restaurante La Principal',
      placeId: '',
      isPlanning: false,
      candidatePlaceIds: [],
      possibleDates: [],
      clothingRequired: true,
      notes: 'Reserva confirmada. Indica en tu comentario si tienes alguna alergia o preferencia de menú.',
      imageUrl: '',
      active: true,
      finished: false,
      createdAt: nowIso(),
    },
  ];
}

function createDefaultData(): AppData {
  return {
    members: createDefaultMembers(),
    events: createSampleEvents(),
    attendances: [],
    places: [
      { id: createId(), name: 'Casa Carmela', address: 'Malvarrosa, València', notes: '', imageUrl: '', active: true, createdAt: nowIso() },
      { id: createId(), name: 'Restaurante La Principal', address: 'València', notes: '', imageUrl: '', active: true, createdAt: nowIso() },
    ],
  };
}

function normalizeData(data: Partial<AppData>): AppData {
  const members = (data.members ?? [])
    .filter((member) => member.id && member.name)
    .map((member) => ({
      ...member,
      username: member.username || member.name,
      active: member.active ?? true,
      isAdmin: member.isAdmin ?? false,
      password: member.password ?? '',
      createdAt: member.createdAt || nowIso(),
    }));

  const events = (data.events ?? [])
    .filter((event) => event.id && event.title)
    .map((event) => ({
      ...event,
      clothingRequired: event.clothingRequired ?? false,
      placeId: event.placeId ?? '',
      isPlanning: event.isPlanning ?? false,
      candidatePlaceIds: event.candidatePlaceIds ?? [],
      possibleDates: event.possibleDates ?? [],
      notes: event.notes ?? '',
      imageUrl: event.imageUrl ?? '',
      active: event.active ?? true,
      finished: event.finished ?? false,
      createdAt: event.createdAt || nowIso(),
    }));

  const attendanceByMemberAndEvent = new Map<string, Attendance>();
  (data.attendances ?? []).forEach((attendance) => {
    if (!VALID_ATTENDANCE_STATUSES.includes(attendance.status)) {
      return;
    }

    attendanceByMemberAndEvent.set(`${attendance.eventId}:${attendance.memberId}`, {
      ...attendance,
      comment: attendance.comment ?? '',
      preferredPlaceId: attendance.preferredPlaceId ?? '',
      preferredDate: attendance.preferredDate ?? '',
      updatedAt: attendance.updatedAt || nowIso(),
    });
  });

  const places = (data.places ?? [])
    .filter((place) => place.id && place.name)
    .map((place) => ({
      ...place,
      address: place.address ?? '',
      notes: place.notes ?? '',
      imageUrl: place.imageUrl ?? '',
      active: place.active ?? true,
      createdAt: place.createdAt || nowIso(),
    }));

  return {
    members,
    events,
    attendances: Array.from(attendanceByMemberAndEvent.values()),
    places,
  };
}

function createResult(data: AppData, realOrigin: RealDataOrigin, lastError: string | null = null): StorageResult {
  const normalizedData = normalizeData(data);
  return {
    data: normalizedData,
    meta: {
      configuredMode: getConfiguredDataSource(),
      realOrigin,
      eventCount: normalizedData.events.length,
      lastLoadedAt: nowIso(),
      lastError,
    },
  };
}

function readLocalStorage(): AppData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return null;
  }
}

function writeLocalStorage(data: AppData): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalizeData(data)));
  }
}

function applyLocalChange(data: AppData, update: (currentData: AppData) => AppData): StorageResult {
  const nextData = normalizeData(update(normalizeData(data)));
  writeLocalStorage(nextData);
  return createResult(nextData, 'localStorage');
}

async function runBaserow(operation: () => Promise<AppData>): Promise<StorageResult> {
  return createResult(await operation(), 'baserow');
}

async function remoteRequest(action?: string, payload?: unknown): Promise<AppData> {
  const response = await fetch('/api/data', action ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  } : undefined);
  const result = await response.json() as { data?: AppData; error?: string };
  if (!response.ok || !result.data) throw new Error(result.error || 'No se han podido cargar los datos');
  return result.data;
}

export async function loginMember(username: string, password: string): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'local') {
    const data = getLocalData();
    const member = data.members.find((item) => item.username.trim().toLocaleLowerCase() === username.trim().toLocaleLowerCase());
    if (!member || member.password !== password) throw new Error('Usuario o clave incorrectos');
    return createResult(data, 'localStorage');
  }
  return runBaserow(() => remoteRequest('login', { username, password }));
}

export async function logoutMember(): Promise<void> {
  if (getConfiguredDataSource() === 'baserow') await remoteRequest('logout');
}

export async function importDatabaseData(data: AppData): Promise<StorageResult> {
  return runBaserow(() => remoteRequest('importData', data));
}

function getLocalData(): AppData {
  const existingData = readLocalStorage();
  if (existingData) {
    return existingData;
  }

  const data = createDefaultData();
  writeLocalStorage(data);
  return data;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result ?? ''));
    };
    reader.onerror = () => {
      reject(new Error('No se ha podido leer la imagen'));
    };
    reader.readAsDataURL(file);
  });
}

export function getConfiguredDataSource(): DataSourceMode {
  return DATA_SOURCE === 'local' ? 'local' : 'baserow';
}

export async function loadData(): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest());
  }

  const localData = readLocalStorage();
  if (localData) {
    return createResult(localData, 'localStorage');
  }

  const data = createDefaultData();
  writeLocalStorage(data);
  return createResult(data, 'internalSeed');
}

export async function addMember(member: Member): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('saveMember', member));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    members: [...data.members, member],
  }));
}

export async function updateMember(member: Member): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('saveMember', member));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    members: data.members.map((item) => (item.id === member.id ? member : item)),
  }));
}

export async function addPlace(place: Place): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('savePlace', place));
  }

  return applyLocalChange(getLocalData(), (data) => ({ ...data, places: [...data.places, place] }));
}

export async function updatePlace(place: Place): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('savePlace', place));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    places: data.places.map((item) => (item.id === place.id ? place : item)),
  }));
}

export async function addEvent(event: DanceEvent): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('saveEvent', event));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    events: [...data.events, event],
  }));
}

export async function updateEvent(event: DanceEvent): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('saveEvent', event));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    events: data.events.map((item) => (item.id === event.id ? event : item)),
  }));
}

export async function deleteEvent(eventId: string): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('deleteEvent', { eventId }));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    events: data.events.filter((event) => event.id !== eventId),
    attendances: data.attendances.filter((attendance) => attendance.eventId !== eventId),
  }));
}

export async function uploadEventImage(file: File): Promise<string> {
  if (getConfiguredDataSource() === 'baserow') {
    return readFileAsDataUrl(file);
  }

  return readFileAsDataUrl(file);
}

export async function addAttendance(attendance: Attendance): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('saveAttendance', attendance));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    attendances: [
      ...data.attendances.filter(
        (item) => !(item.eventId === attendance.eventId && item.memberId === attendance.memberId),
      ),
      attendance,
    ],
  }));
}

export async function removeAttendance(eventId: string, memberId: string): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    return runBaserow(() => remoteRequest('clearAttendance', { eventId, memberId }));
  }

  return applyLocalChange(getLocalData(), (data) => ({
    ...data,
    attendances: data.attendances.filter(
      (attendance) => !(attendance.eventId === eventId && attendance.memberId === memberId),
    ),
  }));
}

export async function saveSampleEvents(): Promise<StorageResult> {
  if (getConfiguredDataSource() === 'baserow') {
    throw new Error('Los datos de prueba no se pueden crear desde la app en modo Baserow');
  }

  const currentData = getLocalData();
  const data = normalizeData({
    ...currentData,
    members: currentData.members.length > 0 ? currentData.members : createDefaultMembers(),
    events: [...currentData.events, ...createSampleEvents()],
  });

  writeLocalStorage(data);
  return createResult(data, 'localStorage');
}
