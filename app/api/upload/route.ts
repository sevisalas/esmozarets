import { readSession } from '../../../server/session';
import { siteEnv } from '../../../server/store';

export async function POST(request: Request) {
  if (!await readSession(request)) return Response.json({ error: 'La sesión ha caducado' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) return Response.json({ error: 'Selecciona una imagen válida' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: 'La imagen no puede superar 8 MB' }, { status: 400 });
  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const key = `${crypto.randomUUID()}.${extension}`;
  await siteEnv.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return Response.json({ url: `/api/images/${key}` });
}
