import { useState, type FormEvent } from 'react';
import type { DanceEvent, Place } from '../types';

interface ProposalFormProps {
  onSubmit: (proposal: DanceEvent) => void | Promise<void>;
  onCancel?: () => void;
  places?: Place[];
}

export function ProposalForm({ onSubmit, onCancel, places = [] }: ProposalFormProps) {
  const [title, setTitle] = useState('');
  const [candidatePlaceIds, setCandidatePlaceIds] = useState<string[]>([]);
  const [possibleDates, setPossibleDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [notes, setNotes] = useState('');

  const togglePlace = (id: string, checked: boolean) => {
    setCandidatePlaceIds((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  };

  const addDate = () => {
    if (!newDate) return;
    setPossibleDates((current) => Array.from(new Set([...current, newDate])).sort());
    setNewDate('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: crypto.randomUUID(),
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
      finished: false,
      createdAt: new Date().toISOString(),
    });
  };

  const canSubmit = title.trim().length > 0 && candidatePlaceIds.length > 0 && possibleDates.length > 0;

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3>Nueva propuesta</h3>
      <p className="form-hint">Abre una votación para decidir entre todos el próximo esmorzaret. Solo puede haber una propuesta abierta.</p>

      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Esmorzaret de septiembre" required />
      </label>

      <fieldset className="candidate-options">
        <legend>Sitios candidatos</legend>
        {places.filter((place) => place.active).map((place) => (
          <label className="checkbox-field" key={place.id}>
            <input
              type="checkbox"
              checked={candidatePlaceIds.includes(place.id)}
              onChange={(e) => togglePlace(place.id, e.target.checked)}
            />
            {place.name}{place.address ? ` · ${place.address}` : ''}
          </label>
        ))}
        {places.filter((place) => place.active).length === 0 && (
          <p className="form-hint">Crea primero algún lugar en la sección de Lugares.</p>
        )}
      </fieldset>

      <div className="candidate-options">
        <strong>Fechas posibles</strong>
        <div className="inline-actions">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button type="button" className="secondary-btn" disabled={!newDate} onClick={addDate}>Añadir fecha</button>
        </div>
        {possibleDates.map((date) => (
          <div className="candidate-date" key={date}>
            <span>{new Date(`${date}T12:00:00`).toLocaleDateString('es-ES')}</span>
            <button type="button" className="secondary-btn" onClick={() => setPossibleDates((current) => current.filter((item) => item !== date))}>Quitar</button>
          </div>
        ))}
      </div>

      <label>
        Notas (opcional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>

      <div className="modal-actions">
        {onCancel && <button type="button" className="secondary-btn" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="primary-btn" disabled={!canSubmit}>Abrir votación</button>
      </div>
    </form>
  );
}
