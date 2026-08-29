'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Attendance, DanceEvent, Member, Place } from './types';
import { addAttendance, addEvent, addMember, addPlace, deleteEvent, getConfiguredDataSource, loadData, loginMember, logoutMember, removeAttendance, saveSampleEvents, updateEvent, updateMember, updatePlace, uploadEventImage, type DataSourceMeta, type StorageResult } from './storage';
import { getAttendanceSummary, isEventPending, compareEvents } from './utils';
import { EventCard } from './components/EventCard';
import { AttendanceModal } from './components/AttendanceModal';
import { AdminPanel } from './components/AdminPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { HelpModal } from './components/HelpModal';

const MEMBER_STORAGE_KEY = 'alumni_lunch_member_id';
const showDiagnostics = import.meta.env.VITE_SHOW_DIAGNOSTICS === 'true';

export default function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<DanceEvent[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DanceEvent | null>(null);
  const [modalMode, setModalMode] = useState<'edit' | 'view' | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(() => new Set());
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(() => window.localStorage.getItem(MEMBER_STORAGE_KEY));
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [dataMeta, setDataMeta] = useState<DataSourceMeta>(() => ({
    configuredMode: getConfiguredDataSource(),
    realOrigin: 'none',
    eventCount: 0,
    lastLoadedAt: '',
    lastError: null,
  }));

  const currentMember = useMemo(() => {
    if (!currentMemberId) {
      return null;
    }

    return members.find((member) => member.id === currentMemberId && member.active) ?? null;
  }, [currentMemberId, members]);
  const isAuthenticated = currentMember !== null;
  const isAdmin = isAuthenticated;

  useEffect(() => {
    void refreshData(false);
  }, []);

  useEffect(() => {
    if (!currentMemberId || !hasLoadedData) {
      return;
    }

    const savedMember = members.find((member) => member.id === currentMemberId);
    if (!savedMember || !savedMember.active) {
      window.localStorage.removeItem(MEMBER_STORAGE_KEY);
      setCurrentMemberId(null);
      setIsAdminOpen(false);
      setIsProfileOpen(false);
      setIsHelpOpen(false);
      closeAttendanceModal();
    }
  }, [currentMemberId, hasLoadedData, members]);

  const pendingEvents = useMemo(() => {
    return [...events]
      .filter((event) => isEventPending(event) && !event.isPlanning)
      .sort(compareEvents);
  }, [events]);

  const activeProposal = useMemo(() => {
    return events.find((event) => event.isPlanning && event.active && !event.finished) ?? null;
  }, [events]);

  const syncState = (result: StorageResult) => {
    setMembers(result.data.members);
    setEvents(result.data.events);
    setAttendances(result.data.attendances);
    setPlaces(result.data.places);
    setDataMeta(result.meta);
    setHasLoadedData(true);
  };

  const getSourceMessage = (meta: DataSourceMeta) => {
    if (meta.realOrigin === 'baserow') {
      return 'Datos actualizados';
    }

    if (meta.realOrigin === 'localStorage') {
      return 'Datos locales de prueba';
    }

    return 'Datos de prueba internos';
  };

  const showTemporaryMessage = (nextMessage: string) => {
    setMessage(nextMessage);
    window.setTimeout(() => {
      setMessage((currentMessage) => (currentMessage === nextMessage ? '' : currentMessage));
    }, 2500);
  };

  const getTechnicalMessage = (error: unknown) => {
    return error instanceof Error ? error.message : '';
  };

  const setDataSourceError = (error: unknown) => {
    const technicalMessage = getTechnicalMessage(error);
    const errorMessage = technicalMessage || 'No se han podido cargar los datos';
    setMembers([]);
    setEvents([]);
    setAttendances([]);
    setPlaces([]);
    setHasLoadedData(true);
    setDataMeta({
      configuredMode: getConfiguredDataSource(),
      realOrigin: 'none',
      eventCount: 0,
      lastLoadedAt: new Date().toISOString(),
      lastError: errorMessage,
    });
    setMessage(showDiagnostics && technicalMessage ? errorMessage : 'No se han podido cargar los datos');
  };

  const refreshData = async (showSuccessMessage = true) => {
    try {
      const result = await loadData();
      syncState(result);
      if (showSuccessMessage) {
        setMessage(getSourceMessage(result.meta));
      }
    } catch (error) {
      setDataSourceError(error);
    }
  };

  const openAttendanceModal = (event: DanceEvent, mode: 'edit' | 'view') => {
    setSelectedEvent(event);
    setModalMode(mode);
  };

  const closeAttendanceModal = () => {
    setSelectedEvent(null);
    setModalMode(null);
  };

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEventIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(eventId)) {
        nextIds.delete(eventId);
      } else {
        nextIds.add(eventId);
      }

      return nextIds;
    });
  };

  const expandAllEvents = () => {
    setExpandedEventIds(new Set(pendingEvents.map((event) => event.id)));
  };

  const collapseAllEvents = () => {
    setExpandedEventIds(new Set());
  };

  const handleSaveAttendance = async (attendance: Attendance) => {
    setIsSaving(true);
    try {
      const result = await addAttendance(attendance);
      syncState(result);
      showTemporaryMessage('Asistencia actualizada');
      closeAttendanceModal();
    } catch (error) {
      const technicalMessage = getTechnicalMessage(error);
      setMessage(showDiagnostics && technicalMessage ? technicalMessage : 'No se ha podido guardar la asistencia');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAttendance = async (eventId: string, memberId: string) => {
    setIsSaving(true);
    try {
      const result = await removeAttendance(eventId, memberId);
      syncState(result);
      showTemporaryMessage('Asistencia actualizada');
      closeAttendanceModal();
    } catch (error) {
      const technicalMessage = getTechnicalMessage(error);
      setMessage(showDiagnostics && technicalMessage ? technicalMessage : 'No se ha podido guardar la asistencia');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSampleEvents = async () => {
    setIsSaving(true);
    setMessage('Creando eventos de muestra...');
    try {
      const result = await saveSampleEvents();
      syncState(result);
      setMessage('Datos locales de prueba');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogin = async () => {
    const enteredName = loginName.trim();
    const enteredPassword = loginPassword.trim();
    setIsSaving(true);
    try {
      const result = await loginMember(enteredName, enteredPassword);
      syncState(result);
      const member = result.data.members.find((item) => item.username.trim().toLocaleLowerCase() === enteredName.toLocaleLowerCase());
      if (!member) throw new Error('Usuario no encontrado');
      window.localStorage.setItem(MEMBER_STORAGE_KEY, member.id);
      setCurrentMemberId(member.id);
      setLoginName('');
      setLoginPassword('');
      setMessage('');
    } catch (error) {
      setMessage(getTechnicalMessage(error) || 'Usuario o clave incorrectos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    void logoutMember();
    window.localStorage.removeItem(MEMBER_STORAGE_KEY);
    setCurrentMemberId(null);
    setLoginName('');
    setLoginPassword('');
    setIsAdminOpen(false);
    setIsProfileOpen(false);
    setIsHelpOpen(false);
    closeAttendanceModal();
    setMessage('');
  };

  const handleCreateEvent = async (event: DanceEvent) => {
    setIsSaving(true);
    try {
      const result = await addEvent(event);
      syncState(result);
      showTemporaryMessage('Almuerzo guardado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEvent = async (event: DanceEvent) => {
    setIsSaving(true);
    try {
      const result = await updateEvent(event);
      syncState(result);
      showTemporaryMessage('Almuerzo guardado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('¿Seguro que quieres eliminar este almuerzo?')) {
      setIsSaving(true);
      try {
        const result = await deleteEvent(eventId);
        syncState(result);
        showTemporaryMessage('Datos actualizados');
      } catch (error) {
        setDataSourceError(error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleUploadEventImage = async (file: File) => {
    return uploadEventImage(file);
  };

  const handleCreateMember = async (member: Member) => {
    setIsSaving(true);
    try {
      const result = await addMember(member);
      syncState(result);
      showTemporaryMessage('Miembro guardado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMember = async (member: Member) => {
    setIsSaving(true);
    try {
      const result = await updateMember(member);
      syncState(result);
      showTemporaryMessage('Miembro guardado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePlace = async (place: Place) => {
    setIsSaving(true);
    try {
      syncState(await addPlace(place));
      showTemporaryMessage('Lugar guardado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePlace = async (place: Place) => {
    setIsSaving(true);
    try {
      syncState(await updatePlace(place));
      showTemporaryMessage('Lugar guardado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfile = async (member: Member) => {
    setIsSaving(true);
    try {
      const result = await updateMember(member);
      syncState(result);
      showTemporaryMessage('Perfil actualizado');
    } catch (error) {
      setDataSourceError(error);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="app-shell">
      <header className="app-hero">
        <div className="hero-image">
          <div className="hero-overlay">
            <span className="hero-mark" aria-hidden="true">A</span>
            <h1>La buena mesa<br />nos vuelve a reunir</h1>
            <p className="hero-copy">Almuerzos, recuerdos y muchas historias por contar.</p>
          </div>
        </div>
      </header>

      {message && <div className="message-banner">{message}</div>}

      {!isAuthenticated && (
        <main className="access-card">
          <div className="access-intro">
            <span className="access-icon" aria-hidden="true">✦</span>
            <div><p className="eyebrow">Espacio privado</p><h2>Hola, compañero</h2></div>
          </div>
          <p>Entra para ver el próximo almuerzo y confirmar si vienes.</p>
          <label>
            Usuario
            <input
              type="text"
              value={loginName}
              onChange={(event) => setLoginName(event.target.value)}
              placeholder="Escribe tu usuario"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Clave
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && loginName.trim() && loginPassword.trim()) {
                  void handleLogin();
                }
              }}
              autoComplete="current-password"
              placeholder="Escribe tu clave"
              required
            />
          </label>
          <button className="primary-btn" onClick={() => void handleLogin()} disabled={isSaving || !loginName.trim() || !loginPassword.trim()}>
            Entrar
          </button>
        </main>
      )}

      {isAuthenticated && showDiagnostics && (
      <section className="data-source-panel">
        <strong>Origen de datos</strong>
        <dl>
          <div>
            <dt>Modo configurado</dt>
            <dd>{dataMeta.configuredMode}</dd>
          </div>
          <div>
            <dt>Origen real</dt>
            <dd>{dataMeta.realOrigin}</dd>
          </div>
          <div>
            <dt>Eventos recibidos</dt>
            <dd>{dataMeta.eventCount}</dd>
          </div>
          <div>
            <dt>Última carga</dt>
            <dd>{dataMeta.lastLoadedAt || 'Pendiente'}</dd>
          </div>
          <div>
            <dt>Último error</dt>
            <dd>{dataMeta.lastError || 'Ninguno'}</dd>
          </div>
          <div>
            <dt>Miembro actual</dt>
            <dd>{currentMember?.name ?? 'Ninguno'}</dd>
          </div>
          <div>
            <dt>Es admin</dt>
            <dd>{isAdmin ? 'Sí' : 'No'}</dd>
          </div>
        </dl>
      </section>
      )}

      {isAuthenticated && (
        <div className="top-actions">
          {isAdmin && (
            <button className="admin-link-btn" onClick={() => setIsAdminOpen((value) => !value)}>
              {isAdminOpen ? 'Almuerzos' : 'Organizar'}
            </button>
          )}
          {!isAdmin && (
            <button className="admin-link-btn" onClick={() => setIsProfileOpen((value) => !value)}>
              {isProfileOpen ? 'Almuerzos' : 'Mi perfil'}
            </button>
          )}
          <button className="expand-button" onClick={expandAllEvents}>
            Ver todos
          </button>
          <button className="expand-button" onClick={collapseAllEvents}>
            Ocultar todos
          </button>
          <button className="session-link-btn" onClick={() => setIsHelpOpen(true)}>
            Ayuda
          </button>
          <button className="session-link-btn" onClick={handleLogout}>
            Salir
          </button>
        </div>
      )}

      {isAuthenticated && !isAdminOpen && !isProfileOpen && (
        <main className="content-stack">
          <section className="proposal-section">
            <p className="eyebrow">Antes de nada · votación</p>
            {activeProposal ? (
              <EventCard
                key={activeProposal.id}
                event={activeProposal}
                attendances={attendances.filter((attendance) => attendance.eventId === activeProposal.id)}
                members={members}
                places={places}
                summary={getAttendanceSummary(attendances.filter((attendance) => attendance.eventId === activeProposal.id))}
                isExpanded
                onToggleExpanded={() => toggleEventExpanded(activeProposal.id)}
                onUpdateAttendance={() => openAttendanceModal(activeProposal, 'edit')}
                onViewInscritos={() => openAttendanceModal(activeProposal, 'view')}
              />
            ) : (
              <article className="event-card next-meetup-placeholder">
                <div>
                  <h2>Aún no hay ninguna quedada en votación</h2>
                  <p className="event-place">La propuesta es el paso previo: se vota lugar y fecha antes de fijar el esmorzaret.</p>
                </div>
                {isAdmin && <button className="primary-action" onClick={() => setIsAdminOpen(true)}>Preparar votación</button>}
              </article>
            )}
          </section>

          {pendingEvents.length === 0 ? (
            <div className="empty-state empty-state-panel">
              <span className="empty-icon" aria-hidden="true">🍽</span>
              <strong>No hay almuerzos a la vista</strong>
              {getConfiguredDataSource() === 'local' && (
                <>
                  <span>Crea la próxima cita o carga unos almuerzos de ejemplo.</span>
                  <button className="primary-btn" onClick={handleLoadSampleEvents} disabled={isSaving}>
                    Ver almuerzos de muestra
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {pendingEvents.map((event) => {
                const eventAttendances = attendances.filter((attendance) => attendance.eventId === event.id);
                const summary = getAttendanceSummary(eventAttendances);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    attendances={eventAttendances}
                    members={members}
                    places={places}
                    summary={summary}
                    isExpanded={expandedEventIds.has(event.id)}
                    onToggleExpanded={() => toggleEventExpanded(event.id)}
                    onUpdateAttendance={() => openAttendanceModal(event, 'edit')}
                    onViewInscritos={() => openAttendanceModal(event, 'view')}
                  />
                );
              })}
            </>
          )}
        </main>
      )}

      {isAuthenticated && isAdmin && isAdminOpen && (
        <AdminPanel
          isAdmin={isAdmin}
          members={members}
          events={events}
          places={places}
          onCreateEvent={handleCreateEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          onUploadEventImage={handleUploadEventImage}
          onCreateMember={handleCreateMember}
          onUpdateMember={handleUpdateMember}
          onCreatePlace={handleCreatePlace}
          onUpdatePlace={handleUpdatePlace}
          isSaving={isSaving}
          onClose={() => {
            setIsAdminOpen(false);
          }}
        />
      )}

      {isAuthenticated && !isAdmin && isProfileOpen && currentMember && (
        <ProfilePanel
          member={currentMember}
          onSave={handleUpdateProfile}
          isSaving={isSaving}
        />
      )}

      {selectedEvent && modalMode && currentMember && (
        <AttendanceModal
          event={selectedEvent}
          currentMember={currentMember}
          mode={modalMode}
          members={members}
          places={places}
          attendances={attendances.filter((attendance) => attendance.eventId === selectedEvent.id)}
          onClose={closeAttendanceModal}
          onSave={handleSaveAttendance}
          onRemove={handleRemoveAttendance}
          isSaving={isSaving}
        />
      )}

      {isAuthenticated && isHelpOpen && (
        <HelpModal isAdmin={isAdmin} onClose={() => setIsHelpOpen(false)} />
      )}
    </div>
  );
}
