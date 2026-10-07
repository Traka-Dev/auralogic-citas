import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
export const GET: APIRoute = () => {
  db().get('SELECT 1');
  return Response.json({ status: 'ok' });
};
