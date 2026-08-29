import { useEffect } from 'react';

interface HelpModalProps {
  isAdmin: boolean;
  onClose: () => void;
}

export function HelpModal({ isAdmin, onClose }: HelpModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="modal-card help-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Manual</p>
            <h2 id="help-title">Ayuda</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar ayuda" title="Cerrar">
            ✕
          </button>
        </div>

        <div className="help-content">
          <section>
            <h3>Almuerzos</h3>
            <p>Pulsa <strong>Ver detalles</strong> para consultar el lugar, la hora y el menú.</p>
            <p><strong>Ver todos</strong> abre todas las fichas y <strong>Ocultar todos</strong> las contrae.</p>
          </section>

          <section>
            <h3>Asistencia</h3>
            <p>Abre un almuerzo y pulsa <strong>¿Te apuntas?</strong>. Elige Sí, No o Quizás y guarda la respuesta.</p>
            <p>Puedes añadir necesidades de menú en el comentario. <strong>Ver compañeros</strong> muestra las respuestas del grupo.</p>
          </section>

          {isAdmin && (
            <section>
              <h3>Guía rápida para organizar</h3>
              <p><strong>1. Lugar:</strong> entra en <strong>Organizar</strong> y crea primero el restaurante, con dirección, notas y foto.</p>
              <p><strong>2. Almuerzo:</strong> crea el evento, selecciona el lugar, indica fecha, hora, reserva y detalles.</p>
              <p><strong>3. Miembros:</strong> añade las personas del grupo y asigna su usuario y clave.</p>
              <p><strong>4. Después del almuerzo:</strong> pulsa <strong>Finalizar</strong>. La visita se sumará automáticamente al historial del lugar.</p>
              <p>Todos los miembros activos pueden utilizar estas opciones.</p>
            </section>
          )}

          <section>
            <h3>Sesión</h3>
            <p>Pulsa <strong>Salir</strong> para cerrar la sesión y volver a la pantalla de acceso.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
