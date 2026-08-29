import { useEffect, useState, type FormEvent } from 'react';
import type { DanceEvent, Place } from '../types';

interface EventFormProps {
  initialEvent?: DanceEvent | null;
  onSubmit: (event: DanceEvent) => void | Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  onCancel?: () => void;
  places?: Place[];
}

const emptyEvent = (): DanceEvent => ({
  id: crypto.randomUUID(),
  title: '',
  date: '',
  time: '',
  location: '',
  placeId: '',
  isPlanning: true,
  candidatePlaceIds: [],
  possibleDates: [],
  clothingRequired: false,
  notes: '',
  imageUrl: '',
  active: true,
  finished: false,
  createdAt: new Date().toISOString(),
});

export function EventForm({ initialEvent, onSubmit, onUploadImage, onCancel, places = [] }: EventFormProps) {
  const [event, setEvent] = useState<DanceEvent>(emptyEvent());
  const [imageUploadMessage, setImageUploadMessage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newPossibleDate, setNewPossibleDate] = useState('');

  useEffect(() => {
    if (initialEvent) {
      const matchingPlace = places.find((place) =>
        place.id === initialEvent.placeId
        || initialEvent.location.trim().toLocaleLowerCase() === place.name.trim().toLocaleLowerCase()
        || initialEvent.location.trim().toLocaleLowerCase().startsWith(`${place.name.trim().toLocaleLowerCase()} ·`),
      );
      setEvent(matchingPlace ? { ...initialEvent, placeId: matchingPlace.id, location: matchingPlace.name } : initialEvent);
    } else {
      setEvent(emptyEvent());
    }
  }, [initialEvent, places]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...event,
      id: initialEvent?.id ?? crypto.randomUUID(),
      title: event.title.trim(),
      location: event.location.trim(),
      notes: event.notes.trim(),
      imageUrl: event.imageUrl.trim(),
      createdAt: initialEvent?.createdAt ?? new Date().toISOString(),
    });
  };

  const handleImageChange = async (file: File | undefined) => {
    if (!file || !onUploadImage) {
      return;
    }

    setIsUploadingImage(true);
    setImageUploadMessage('');
    try {
      const imageUrl = await onUploadImage(file);
      setEvent((currentEvent) => ({ ...currentEvent, imageUrl }));
      setImageUploadMessage('Imagen subida');
    } catch {
      setImageUploadMessage('No se ha podido subir la imagen');
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3>{initialEvent ? 'Editar almuerzo' : event.isPlanning ? 'Nueva quedada' : 'Crear almuerzo'}</h3>
      <label>
        Tipo
        <select
          value={event.isPlanning ? 'propuesta' : 'confirmado'}
          disabled={Boolean(initialEvent)}
          onChange={(e) => setEvent({ ...event, isPlanning: e.target.value === 'propuesta' })}
        >
          <option value="propuesta">Quedada por decidir</option>
          <option value="confirmado">Almuerzo con fecha y lugar decididos</option>
        </select>
        {initialEvent && <span className="form-hint">El tipo no se puede cambiar en un evento ya creado.</span>}
      </label>
      <label>
        Título
        <input value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} required />
      </label>
      {!event.isPlanning && <label>
        Fecha
        <input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} required />
      </label>}
      <label>
        Hora
        <input type="time" value={event.time} onChange={(e) => setEvent({ ...event, time: e.target.value })} required />
      </label>
      {!event.isPlanning && <label>
        Lugar
        {places.length > 0 ? (
          <select
            value={event.placeId}
            onChange={(e) => {
              const place = places.find((item) => item.id === e.target.value);
              setEvent({ ...event, placeId: place?.id ?? '', location: place?.name ?? '' });
            }}
            required
          >
            <option value="">Selecciona un lugar</option>
            {places.filter((place) => place.active || place.id === event.placeId).map((place) => (
              <option key={place.id} value={place.id}>{place.name}{place.address ? ` · ${place.address}` : ''}</option>
            ))}
          </select>
        ) : (
          <input value={event.location} onChange={(e) => setEvent({ ...event, location: e.target.value, placeId: '' })} required />
        )}
      </label>}
      {event.isPlanning && (
        <fieldset className="candidate-options">
          <legend>Lugares candidatos</legend>
          {places.filter((place) => place.active).map((place) => (
            <label className="checkbox-field" key={place.id}>
              <input type="checkbox" checked={event.candidatePlaceIds.includes(place.id)} onChange={(e) => setEvent({
                ...event,
                candidatePlaceIds: e.target.checked ? [...event.candidatePlaceIds, place.id] : event.candidatePlaceIds.filter((id) => id !== place.id),
              })} />
              {place.name}{place.address ? ` · ${place.address}` : ''}
            </label>
          ))}
          {places.length === 0 && <p className="form-hint">Crea primero algún lugar en el listado de lugares.</p>}
        </fieldset>
      )}
      {event.isPlanning && (
        <div className="candidate-options">
          <strong>Posibles fechas</strong>
          <div className="inline-actions">
            <input type="date" value={newPossibleDate} onChange={(e) => setNewPossibleDate(e.target.value)} />
            <button type="button" className="secondary-btn" disabled={!newPossibleDate} onClick={() => {
              setEvent({ ...event, possibleDates: Array.from(new Set([...event.possibleDates, newPossibleDate])).sort() });
              setNewPossibleDate('');
            }}>Añadir fecha</button>
          </div>
          {event.possibleDates.map((date) => (
            <div className="candidate-date" key={date}>
              <span>{new Date(`${date}T12:00:00`).toLocaleDateString('es-ES')}</span>
              <button type="button" className="secondary-btn" onClick={() => setEvent({ ...event, possibleDates: event.possibleDates.filter((item) => item !== date) })}>Quitar</button>
            </div>
          ))}
        </div>
      )}
      <label>
        Estado de la reserva
        <select value={event.clothingRequired ? 'Sí' : 'No'} onChange={(e) => setEvent({ ...event, clothingRequired: e.target.value === 'Sí' })}>
          <option value="Sí">Confirmada con el restaurante</option>
          <option value="No">Pendiente de confirmar</option>
        </select>
      </label>
      <label>
        Menú y otros detalles
        <textarea value={event.notes} onChange={(e) => setEvent({ ...event, notes: e.target.value })} rows={3} />
      </label>
      <label>
        Imagen del restaurante o del encuentro
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            void handleImageChange(e.target.files?.[0]);
            e.target.value = '';
          }}
          disabled={isUploadingImage || !onUploadImage}
        />
      </label>
      {event.imageUrl && (
        <div className="form-image-preview">
          <img src={event.imageUrl} alt={`Imagen de ${event.title || 'almuerzo'}`} />
          <button type="button" className="secondary-btn" onClick={() => setEvent({ ...event, imageUrl: '' })}>
            Quitar imagen
          </button>
        </div>
      )}
      {imageUploadMessage && <p className="form-hint">{imageUploadMessage}</p>}
      <label>
        Activo
        <select value={event.active ? 'Sí' : 'No'} onChange={(e) => setEvent({ ...event, active: e.target.value === 'Sí' })}>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </select>
      </label>
      <label>
        Finalizado
        <select value={event.finished ? 'Sí' : 'No'} onChange={(e) => setEvent({ ...event, finished: e.target.value === 'Sí' })}>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </select>
      </label>
      <div className="modal-actions">
        {onCancel && <button type="button" className="secondary-btn" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="primary-btn" disabled={isUploadingImage || (event.isPlanning && (!event.candidatePlaceIds.length || !event.possibleDates.length))}>
          {isUploadingImage ? 'Subiendo imagen...' : event.isPlanning ? 'Guardar quedada' : 'Guardar almuerzo'}
        </button>
      </div>
    </form>
  );
}
