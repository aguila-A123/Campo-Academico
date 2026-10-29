export function serviceStatus(snapshot, now = Date.now()) {
  if (!snapshot.checked) return 'checking';
  if (snapshot.error) return 'unknown';
  const age = now - Date.parse(snapshot.row?.updated_at);
  if (!Number.isFinite(age) || age > 90000 || age < -30000) return 'offline';
  return snapshot.row.status === 'online' ? 'online' : 'reconnecting';
}

export const serviceLabels = {
  checking: 'Comprobando Dragon IA…',
  online: 'Dragon IA conectado',
  reconnecting: 'Dragon IA está reconectando. Las preguntas y respuestas guardadas se conservan.',
  offline: 'Dragon IA no está disponible. Comprueba el servidor de tu PC; Chrome abierto no confirma que el servicio esté activo.',
  unknown: 'No se puede comprobar Dragon IA. Revisa la conexión; no reenvíes una pregunta sin comprobar su estado.',
};

export function messageStatus(message, service, now = Date.now()) {
  if (message.estado === 'completado' || message.estado === 'error') return { waiting: false, text: '' };
  const started = Date.parse(message.iniciado_en);
  if (message.estado === 'procesando' && Number.isFinite(started) && now - started > 600000) {
    return { waiting: false, text: 'Esta petición lleva demasiado tiempo sin confirmación. Puede estar interrumpida o pendiente de guardar. Revisa el servidor y la conversación antes de reenviarla.' };
  }
  if (service !== 'online') return { waiting: false, text: serviceLabels[service] };
  return { waiting: true, text: message.estado === 'pendiente' ? 'En cola, esperando a Dragon IA…' : 'Esperando la respuesta…' };
}
