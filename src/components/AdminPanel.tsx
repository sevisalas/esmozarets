import { useState } from 'react';
import type { DanceEvent, Member, Place } from '../types';
import { compareEvents, formatDateLabel, getEventStateLabel } from '../utils';
import { EventForm } from './EventForm';
import { MemberForm } from './MemberForm';
import { PlaceForm } from './PlaceForm';

interface AdminPanelProps {
  isAdmin: boolean;
  members: Member[];
  events: DanceEvent[];
  places: Place[];
  onCreateEvent: (event: DanceEvent) => Promise<void>;
  onUpdateEvent: (event: DanceEvent) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onUploadEventImage: (file: File) => Promise<string>;
  onCreateMember: (member: Member) => Promise<void>;
  onUpdateMember: (member: Member) => Promise<void>;
  onCreatePlace: (place: Place) => Promise<void>;
  onUpdatePlace: (place: Place) => Promise<void>;
  isSaving?: boolean;
  onClose: () => void;
}

export function AdminPanel({
  isAdmin,
  members,
  events,
  places,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onUploadEventImage,
  onCreateMember,
  onUpdateMember,
  onCreatePlace,
  onUpdatePlace,
  isSaving = false,
  onClose,
}: AdminPanelProps) {
  const [editingEvent, setEditingEvent] = useState<DanceEvent | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [isPlaceFormOpen, setIsPlaceFormOpen] = useState(false);

  if (!isAdmin) {
    return null;
  }

  const sortedEvents = [...events].filter((event) => !event.isPlanning).sort(compareEvents);
  const closedProposals = [...events].filter((event) => event.isPlanning).sort(compareEvents);
  const sortedMembers = [...members].sort((a, b) => {
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  const getPlaceEvents = (place: Place) => events.filter((event) => {
    if (event.placeId) return event.placeId === place.id;
    const eventLocation = event.location.trim().toLocaleLowerCase();
    const placeName = place.name.trim().toLocaleLowerCase();
    return eventLocation === placeName || eventLocation.startsWith(`${placeName} ·`);
  });

  return (
    <section className="admin-panel">
      <div className="admin-header">
        <div>
          <h2>Administración</h2>
          <p className="admin-copy">Prepara los próximos almuerzos y mantén al día el grupo.</p>
        </div>
        <div className="inline-actions">
          <button className="secondary-btn" onClick={onClose} disabled={isSaving}>Cerrar</button>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <div className="admin-section-header">
            <h3>Eventos</h3>
            <button className="primary-btn" disabled={isSaving} onClick={() => {
              setEditingEvent(null);
              setIsEventFormOpen((value) => !value);
            }}>Nuevo evento</button>
          </div>
          {isEventFormOpen && (
            <EventForm
              initialEvent={editingEvent}
              places={places}
              onUploadImage={onUploadEventImage}
              onSubmit={async (event) => {
                if (editingEvent) {
                  await onUpdateEvent(event);
                } else {
                  await onCreateEvent(event);
                }
                setEditingEvent(null);
                setIsEventFormOpen(false);
              }}
              onCancel={() => {
                setEditingEvent(null);
                setIsEventFormOpen(false);
              }}
            />
          )}
          <ul className="list-stack">
            {sortedEvents.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <p>{formatDateLabel(event.date)} · {event.time}</p>
                  <span className={`status-badge ${event.finished ? 'status-no' : event.active ? 'status-yes' : 'status-muted'}`}>
                    {getEventStateLabel(event)}
                  </span>
                </div>
                <div className="inline-actions">
                  <button className="secondary-btn" onClick={() => {
                    setEditingEvent(event);
                    setIsEventFormOpen(true);
                  }} disabled={isSaving}>Editar</button>
                  <button className="secondary-btn" onClick={() => void onUpdateEvent({ ...event, finished: !event.finished })} disabled={isSaving}>
                    {event.finished ? 'Reabrir' : 'Finalizar'}
                  </button>
                  <button className="secondary-btn" onClick={() => void onUpdateEvent({ ...event, active: !event.active })} disabled={isSaving}>
                    {event.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="secondary-btn" onClick={() => void onDeleteEvent(event.id)} disabled={isSaving}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card">
          <div className="admin-section-header">
            <h3>Propuestas cerradas</h3>
          </div>
          <p className="admin-copy">Solo para consultar. Una propuesta cerrada no se puede reabrir ni modificar.</p>
          <ul className="list-stack">
            {closedProposals.length === 0 && <li className="list-empty">Todavía no hay propuestas cerradas.</li>}
            {closedProposals.map((proposal) => (
              <li key={proposal.id}>
                <div>
                  <strong>{proposal.title}</strong>
                  <p>{proposal.candidatePlaceIds.length} sitios · {proposal.possibleDates.length} fechas</p>
                  <span className={`status-badge ${proposal.finished ? 'status-muted' : 'status-yes'}`}>
                    {proposal.finished ? 'Cerrada' : 'Abierta'}
                  </span>
                </div>
                <div className="inline-actions">
                  <button className="secondary-btn" onClick={() => void onDeleteEvent(proposal.id)} disabled={isSaving}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card">
          <div className="admin-section-header">
            <h3>Lugares</h3>
            <button className="primary-btn" disabled={isSaving} onClick={() => {
              setEditingPlace(null);
              setIsPlaceFormOpen((value) => !value);
            }}>Nuevo lugar</button>
          </div>
          {isPlaceFormOpen && (
            <PlaceForm
              initialPlace={editingPlace}
              onUploadImage={onUploadEventImage}
              onSubmit={async (place) => {
                if (editingPlace) await onUpdatePlace(place);
                else await onCreatePlace(place);
                setEditingPlace(null);
                setIsPlaceFormOpen(false);
              }}
              onCancel={() => {
                setEditingPlace(null);
                setIsPlaceFormOpen(false);
              }}
            />
          )}
          <ul className="list-stack">
            {[...places].sort((a, b) => a.name.localeCompare(b.name)).map((place) => (
              <li key={place.id}>
                {place.imageUrl && <img className="place-list-image" src={place.imageUrl} alt={`Foto de ${place.name}`} />}
                <div>
                  <strong>{place.name}</strong>
                  {place.address && <p>{place.address}</p>}
                  {(() => {
                    const placeEvents = getPlaceEvents(place);
                    const visits = placeEvents.filter((event) => event.finished).length;
                    return (
                      <p className="place-visit-count">
                        {visits} {visits === 1 ? 'visita' : 'visitas'} · {placeEvents.length} {placeEvents.length === 1 ? 'almuerzo registrado' : 'almuerzos registrados'}
                      </p>
                    );
                  })()}
                  <span className={`status-badge ${place.active ? 'status-yes' : 'status-muted'}`}>
                    {place.active ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
                <div className="inline-actions">
                  <button className="secondary-btn" onClick={() => {
                    setEditingPlace(place);
                    setIsPlaceFormOpen(true);
                  }} disabled={isSaving}>Editar</button>
                  <button className="secondary-btn" onClick={() => void onUpdatePlace({ ...place, active: !place.active })} disabled={isSaving}>
                    {place.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card">
          <div className="admin-section-header">
            <h3>Miembros</h3>
            <button className="primary-btn" disabled={isSaving} onClick={() => {
              setEditingMember(null);
              setIsMemberFormOpen((value) => !value);
            }}>Crear miembro</button>
          </div>
          {isMemberFormOpen && (
            <MemberForm
              initialMember={editingMember}
              onSubmit={async (member) => {
                if (editingMember) {
                  await onUpdateMember(member);
                } else {
                  await onCreateMember(member);
                }
                setEditingMember(null);
                setIsMemberFormOpen(false);
              }}
              onCancel={() => {
                setEditingMember(null);
                setIsMemberFormOpen(false);
              }}
            />
          )}
          <ul className="list-stack">
            {sortedMembers.map((member) => (
              <li key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <span className={`status-badge ${member.active ? 'status-yes' : 'status-muted'}`}>
                    {member.active ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
                <div className="inline-actions">
                  <button className="secondary-btn" onClick={() => {
                    setEditingMember(member);
                    setIsMemberFormOpen(true);
                  }} disabled={isSaving}>Editar</button>
                  <button className="secondary-btn" onClick={() => void onUpdateMember({ ...member, active: !member.active })} disabled={isSaving}>
                    {member.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
