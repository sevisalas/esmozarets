import { useEffect, useState, type FormEvent } from 'react';
import type { Place } from '../types';

interface PlaceFormProps {
  initialPlace?: Place | null;
  onSubmit: (place: Place) => void | Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<string>;
}

const emptyPlace = (): Place => ({
  id: crypto.randomUUID(),
  name: '',
  address: '',
  notes: '',
  imageUrl: '',
  active: true,
  createdAt: new Date().toISOString(),
});

export function PlaceForm({ initialPlace, onSubmit, onCancel, onUploadImage }: PlaceFormProps) {
  const [place, setPlace] = useState<Place>(emptyPlace());
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageMessage, setImageMessage] = useState('');

  useEffect(() => {
    setPlace(initialPlace ?? emptyPlace());
  }, [initialPlace]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit({
      ...place,
      id: initialPlace?.id ?? crypto.randomUUID(),
      name: place.name.trim(),
      address: place.address.trim(),
      notes: place.notes.trim(),
      imageUrl: place.imageUrl.trim(),
      createdAt: initialPlace?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3>{initialPlace ? 'Editar lugar' : 'Crear lugar'}</h3>
      <label>
        Nombre
        <input value={place.name} onChange={(event) => setPlace({ ...place, name: event.target.value })} required />
      </label>
      <label>
        Dirección
        <input value={place.address} onChange={(event) => setPlace({ ...place, address: event.target.value })} />
      </label>
      <label>
        Notas
        <textarea value={place.notes} onChange={(event) => setPlace({ ...place, notes: event.target.value })} rows={3} />
      </label>
      <label>
        Foto del lugar
        <input
          type="file"
          accept="image/*"
          disabled={isUploadingImage}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setIsUploadingImage(true);
            setImageMessage('');
            void onUploadImage(file)
              .then((imageUrl) => {
                setPlace((current) => ({ ...current, imageUrl }));
                setImageMessage('Foto subida');
              })
              .catch(() => setImageMessage('No se ha podido subir la foto'))
              .finally(() => setIsUploadingImage(false));
          }}
        />
      </label>
      {place.imageUrl && (
        <div className="form-image-preview">
          <img src={place.imageUrl} alt={`Foto de ${place.name || 'lugar'}`} />
          <button type="button" className="secondary-btn" onClick={() => setPlace({ ...place, imageUrl: '' })}>Quitar foto</button>
        </div>
      )}
      {imageMessage && <p className="form-hint">{imageMessage}</p>}
      <label>
        Estado
        <select value={place.active ? 'Sí' : 'No'} onChange={(event) => setPlace({ ...place, active: event.target.value === 'Sí' })}>
          <option value="Sí">Activo</option>
          <option value="No">Desactivado</option>
        </select>
      </label>
      <div className="modal-actions">
        <button type="button" className="secondary-btn" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="primary-btn" disabled={isUploadingImage}>
          {isUploadingImage ? 'Subiendo foto...' : 'Guardar lugar'}
        </button>
      </div>
    </form>
  );
}
