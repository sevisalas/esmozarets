import { useEffect, useState, type FormEvent } from 'react';
import type { Attendance, AttendanceFormStatus, DanceEvent, Member, Place } from '../types';
import { formatDateLabel, formatStatus, getAttendanceSummary } from '../utils';

interface AttendanceModalProps {
  event: DanceEvent;
  currentMember: Member;
  members: Member[];
  places: Place[];
  attendances?: Attendance[];
  mode?: 'edit' | 'view';
  onClose: () => void;
  onSave: (attendance: Attendance) => Promise<void>;
  onRemove?: (eventId: string, memberId: string) => Promise<void>;
  isSaving?: boolean;
}

export function AttendanceModal({
  event,
  currentMember,
  members,
  places,
  attendances = [],
  mode = 'edit',
  onClose,
  onSave,
  onRemove,
  isSaving = false,
}: AttendanceModalProps) {
  const [status, setStatus] = useState<AttendanceFormStatus>('En blanco');
  const [comment, setComment] = useState('');
  const [preferredPlaceId, setPreferredPlaceId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');

  useEffect(() => {
    const selectedAttendance = attendances.find((attendance) => attendance.memberId === currentMember.id);
    if (selectedAttendance) {
      setStatus(selectedAttendance.status as AttendanceFormStatus);
      setComment(selectedAttendance.comment);
      setPreferredPlaceId(selectedAttendance.preferredPlaceId);
      setPreferredDate(selectedAttendance.preferredDate);
    } else {
      setStatus('En blanco');
      setComment('');
      setPreferredPlaceId('');
      setPreferredDate('');
    }
  }, [attendances, currentMember.id]);

  const visibleAttendances = attendances.filter(
    (attendance) => attendance.status === 'Sí' || attendance.status === 'No' || attendance.status === 'Quizás',
  ).sort((a, b) => {
    const memberA = members.find((member) => member.id === a.memberId)?.name ?? '';
    const memberB = members.find((member) => member.id === b.memberId)?.name ?? '';
    return memberA.localeCompare(memberB);
  });
  const summary = getAttendanceSummary(visibleAttendances);

  const handleSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault();

    if (!event.isPlanning && status === 'En blanco') {
      void onRemove?.(event.id, currentMember.id);
      return;
    }

    const payload: Attendance = {
      id: attendances.find((attendance) => attendance.memberId === currentMember.id)?.id ?? crypto.randomUUID(),
      eventId: event.id,
      memberId: currentMember.id,
      status: event.isPlanning ? 'Sí' : status,
      preferredPlaceId,
      preferredDate,
      comment,
      updatedAt: new Date().toISOString(),
    };

    void onSave(payload);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Nuestro próximo encuentro</p>
            <h3>{event.title}</h3>
            <p className="modal-subtitle">{event.isPlanning ? 'Elegimos lugar y fecha' : `${formatDateLabel(event.date)} · ${event.time}`}</p>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {mode === 'view' ? (
          <div className="modal-body">
            <p className="modal-copy">Esto es lo que ha respondido el grupo.</p>
            <div className="counts-row compact-counts">
              <div className="count-box"><span>Sí</span><strong>{summary.yes}</strong></div>
              <div className="count-box"><span>Quizás</span><strong>{summary.maybe}</strong></div>
              <div className="count-box"><span>No</span><strong>{summary.no}</strong></div>
            </div>
            {visibleAttendances.length === 0 ? (
              <p className="empty-state">Todavía no ha respondido nadie. ¡Sé el primero!</p>
            ) : (
              <ul className="inscrito-list">
                {visibleAttendances.map((attendance) => {
                  const member = members.find((item) => item.id === attendance.memberId);
                  return (
                    <li key={attendance.id}>
                      <div className="inscrito-row">
                        <strong>{member?.name ?? 'Miembro'}</strong>
                        <span className={`status-badge status-${attendance.status === 'Sí' ? 'yes' : attendance.status === 'No' ? 'no' : 'maybe'}`}>
                          {formatStatus(attendance.status)}
                        </span>
                      </div>
                      {attendance.comment && <p>{attendance.comment}</p>}
                      {event.isPlanning && <p>{places.find((place) => place.id === attendance.preferredPlaceId)?.name || 'Sin lugar'} · {attendance.preferredDate ? formatDateLabel(attendance.preferredDate) : 'Sin fecha'}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <form className="modal-body" onSubmit={handleSubmit}>
            <div className="read-only-field">
              <span>Almuerzo</span>
              <strong>{event.title}</strong>
              <small>{event.isPlanning ? 'Selección para el próximo esmorzaret' : `${formatDateLabel(event.date)} · ${event.time}`}</small>
            </div>

            <div className="read-only-field">
              <span>Estás respondiendo como</span>
              <strong>{currentMember.name}</strong>
            </div>

            {event.isPlanning && <label>
              Lugar que prefieres
              <select value={preferredPlaceId} onChange={(e) => setPreferredPlaceId(e.target.value)} required>
                <option value="">Selecciona un lugar</option>
                {event.candidatePlaceIds.map((id) => {
                  const place = places.find((item) => item.id === id);
                  return place ? <option key={id} value={id}>{place.name}</option> : null;
                })}
              </select>
            </label>}
            {event.isPlanning && <label>
              Fecha que prefieres
              <select value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required>
                <option value="">Selecciona una fecha</option>
                {event.possibleDates.map((date) => <option key={date} value={date}>{formatDateLabel(date)}</option>)}
              </select>
            </label>}
            {!event.isPlanning && <label>
              ¿Podrás venir?
              <select value={status} onChange={(event) => setStatus(event.target.value as AttendanceFormStatus)}>
                <option value="Sí">Sí, cuenta conmigo</option>
                <option value="Quizás">Todavía no lo sé</option>
                <option value="No">Esta vez no podré</option>
                <option value="En blanco">Quitar mi respuesta</option>
              </select>
            </label>}

            <label>
              Comentario opcional
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                disabled={status === 'En blanco'}
                placeholder={status === 'En blanco' ? 'Se eliminará la respuesta guardada' : 'Ej. necesito menú vegetariano'}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onClose} disabled={isSaving}>Cancelar</button>
              <button type="submit" className="primary-btn" disabled={isSaving || (event.isPlanning && (!preferredPlaceId || !preferredDate))}>
                {isSaving ? 'Guardando...' : event.isPlanning ? 'Guardar mi elección' : status === 'En blanco' ? 'Eliminar respuesta' : 'Guardar asistencia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
