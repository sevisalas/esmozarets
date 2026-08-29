export const config = { api: { bodyParser: false } };

export default async function handler(_req: any, res: any) {
  return res.status(501).json({ error: 'La subida de imágenes estará disponible en la siguiente actualización' });
}
