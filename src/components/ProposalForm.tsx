import { useEffect, useState, type FormEvent } from 'react';
import type { DanceEvent, Place } from '../types';

interface ProposalFormProps {
  initialProposal?: DanceEvent | null;
  onSubmit: (proposal: DanceEvent) => void | Promise<void>;
  onCancel?: () => void;
  places?: Place[];
}

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

export function ProposalForm({ initialProposal, onSubmit, onCancel, places = [] }: ProposalFormProps) {
  const [title, setTitle] = useState('');
  const [candidatePlaceIds, setCandidatePlaceIds] = useState<string[]>([]);
  const [possibleDates, setPossibleDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setTitle(initialProposal?.title ?? '');
    setCandidatePlaceIds(initialProposal?.candidatePlaceIds ?? []);
    setPossibleDates(initialProposal?.possibleDates ?? []);
    setNotes(initialProposal?.notes ?? '');
  }, [initialProposal]);

  const addPlace = (id: string) => {
    if (!id) return;
    setCandidatePlaceIds((current) => (current.includes(id) ? current : [...current, id]));
  };
  const removePlace = (id: string) => setCandidatePlaceIds((current) => current.filter((item) => item !== id));

  const addDate = () => {
    if (!newDate) return;
    setPossibleDates((current) => Array.from(new Set([...current, newDate])).sort());
    setNewDate('');
  };
  const removeDate = (date: string) => setPossibleDates((current) => current.filter((item) => item !== date));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: initialProposal?.id ?? crypto.randomUUID(),
      title: title.trim(),
      date: '',
      time: '',
      location: '',
      placeId: '',
      isPlanning: true,
      candidatePlaceIds,
      possibleDates,
      clothingRequired: false,
      notes: notes.trim(),
      imageUrl: '',
      active: true,
      finished: initialProposal?.finished ?? false,
      createdAt: initialProposal?.createdAt ?? new Date().toISOString(),
    });
  };

  const placeName = (id: string) => places.find((place) => place.id === id)?.name ?? 'Sitio';
  const availablePlaces = places
    .filter((place) => (place.active || candidatePlaceIds.includes(place.id)) && !candidatePlaceIds.includes(place.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const canSubmit = title.trim().length > 0 && candidatePlaceIds.length > 0 && possibleDates.length > 0;

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3>{initialProposal ? 'Editar propuesta' : 'Nueva propuesta'}</h3>
      <p className="form-hint">Votación para decidir el próximo esmorzaret. Solo puede haber una abierta.</p>

      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Esmorzaret de septiembre" required />
      </label>

      <label>
        Sitios candidatos
        <select
          value=""
          onChange={(e) => { addPlace(e.target.value); e.target.value = ''; }}
          disabled={availablePlaces.length === 0}
        >
          <option value="">{availablePlaces.length === 0 ? 'No quedan sitios por añadir' : 'Añadir un sitio…'}</option>
          {availablePlaces.map((place) => (
            <option key={place.id} value={place.id}>{place.name}{place.address ? ` · ${place.address}` : ''}</option>
          ))}
        </select>
      </label>
      {candidatePlaceIds.length > 0 && (
        <div className="chip-list">
          {candidatePlaceIds.map((id) => (
            <span className="chip" key={id}>
              {placeName(id)}
              <button type="button" aria-label="Quitar" onClick={() => removePlace(id)}>×</button>
            </span>
          ))}
        </div>
      )}

      <label>
        Fechas posibles
        <span className="inline-actions">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button type="button" className="secondary-btn" disabled={!newDate} onClick={addDate}>Añadir</button>
        </span>
      </label>
      {possibleDates.length > 0 && (
        <div className="chip-list">
          {possibleDates.map((date) => (
            <span className="chip" key={date}>
              {formatDate(date)}
              <button type="button" aria-label="Quitar" onClick={() => removeDate(date)}>×</button>
            </span>
          ))}
        </div>
      )}

      <label>
        Notas (opcional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>

      <div className="modal-actions">
        {onCancel && <button type="button" className="secondary-btn" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="primary-btn" disabled={!canSubmit}>
          {initialProposal ? 'Guardar cambios' : 'Abrir votación'}
        </button>
      </div>
    </form>
  );
}
