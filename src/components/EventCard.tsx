import { useEffect, useState } from 'react';
import type { Attendance, DanceEvent, Member, Place } from '../types';
import { formatDateLabel, formatStatus, getAttendanceSummary } from '../utils';

interface EventCardProps {
  event: DanceEvent;
  attendances: Attendance[];
  members: Member[];
  places: Place[];
  summary: ReturnType<typeof getAttendanceSummary>;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onUpdateAttendance: () => void;
  onViewInscritos: () => void;
}

export function EventCard({
  event,
  attendances,
  members,
  places,
  summary,
  isExpanded,
  onToggleExpanded,
  onUpdateAttendance,
  onViewInscritos,
}: EventCardProps) {
  const [hasPosterError, setHasPosterError] = useState(false);
  const memberNames = attendances
    .map((attendance) => members.find((member) => member.id === attendance.memberId)?.name)
    .filter(Boolean) as string[];
  const placeImageUrl = places.find((place) => place.id === event.placeId)?.imageUrl ?? '';
  const posterUrl = event.imageUrl || placeImageUrl;
  const shouldShowPoster = Boolean(posterUrl) && !hasPosterError;
  const candidatePlaces = event.candidatePlaceIds.map((id) => places.find((place) => place.id === id)?.name).filter(Boolean);

  useEffect(() => {
    setHasPosterError(false);
  }, [posterUrl]);

  if (!isExpanded) {
    return (
      <article className="event-card event-card-collapsed">
        <div className="event-collapsed-summary">
          <p className="collapsed-meta">
            {event.isPlanning ? 'Quedada por decidir' : [formatDateLabel(event.date), event.time, event.location].filter(Boolean).join(' · ')}
          </p>
          <h2 className="collapsed-title">{event.title}</h2>
          <p className="collapsed-status">
            {event.isPlanning ? `${event.possibleDates.length} fechas · ${candidatePlaces.length} lugares candidatos` : `${event.clothingRequired ? 'Reserva cerrada' : 'Reserva abierta'} · ${summary.yes} se apuntan`}
          </p>
        </div>

        <button className="expand-button" onClick={onToggleExpanded}>
          Ver detalles
        </button>
      </article>
    );
  }

  return (
    <article className="event-card">
      <div className={`event-card-content ${shouldShowPoster ? 'has-poster' : ''}`}>
        <div className="event-main">
          <div className="event-card-header">
            <div>
              <p className="event-date">{event.isPlanning ? 'Fecha y lugar por decidir' : `${formatDateLabel(event.date)} · ${event.time}`}</p>
              <h2>{event.title}</h2>
              {!event.isPlanning && <p className="event-place">{event.location}</p>}
            </div>
            <span className={`pill ${!event.isPlanning && event.clothingRequired ? 'pill-yes' : 'pill-no'}`}>
              {event.isPlanning ? 'En propuesta' : event.clothingRequired ? 'Reserva confirmada' : 'Pendiente de reservar'}
            </span>
          </div>

          <div className="event-meta">
            {event.isPlanning && (
              <>
                <p><strong>Lugares candidatos:</strong> {candidatePlaces.join(', ') || 'Pendientes'}</p>
                <p><strong>Posibles fechas:</strong> {event.possibleDates.map(formatDateLabel).join(', ') || 'Pendientes'}</p>
              </>
            )}
            <p><strong>Sobre el almuerzo:</strong> {event.notes || 'Todavía no hay más detalles.'}</p>
          </div>

          <div className="counts-row">
            <div className="count-box"><span>Sí</span><strong>{summary.yes}</strong></div>
            <div className="count-box"><span>Quizás</span><strong>{summary.maybe}</strong></div>
            <div className="count-box"><span>No</span><strong>{summary.no}</strong></div>
          </div>

          <div className="event-actions">
            <button className="primary-action" onClick={onUpdateAttendance}>{event.isPlanning ? 'Votar lugar y fecha' : '¿Te apuntas?'}</button>
            <button className="secondary-action" onClick={onViewInscritos}>{event.isPlanning ? 'Ver votos' : 'Ver compañeros'}</button>
          </div>

          {memberNames.length > 0 && (
            <div className="mini-list">
              <p className="mini-title">Ya han respondido</p>
              <p>
                {attendances.slice(0, 4).map((attendance) => {
                  const member = members.find((item) => item.id === attendance.memberId);
                  return `${member?.name ?? 'Miembro'}: ${formatStatus(attendance.status)}`;
                }).join(', ')}
                {memberNames.length > 4 ? '...' : ''}
              </p>
            </div>
          )}
        </div>

        {shouldShowPoster && (
          <div className="event-poster">
            <img
              src={posterUrl}
              alt={`Imagen de ${event.title}`}
              onError={() => setHasPosterError(true)}
            />
          </div>
        )}
      </div>
      <button className="expand-button expanded-toggle" onClick={onToggleExpanded}>
        Ocultar detalles
      </button>
    </article>
  );
}
