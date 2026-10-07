import type { APIRoute } from 'astro';
import QRCode from 'qrcode';
import { db } from '../../lib/db';
import { decrypt } from '../../lib/whatsapp/crypto';
import type { Message } from '../../lib/types';

export const GET: APIRoute = async (context) => {
  const auth = context.locals.auth;
  if (!auth) return new Response('No autorizado.', { status: 401 });
  const connection = db().get<{
    status: string;
    qr_cipher: string | null;
    qr_expires_at: string | null;
    heartbeat_at: string | null;
  }>('SELECT * FROM connections WHERE business_id=?', auth.business.id);
  const active =
    !!connection?.heartbeat_at &&
    Date.parse(connection.heartbeat_at) > Date.now() - 30000;
  let qr: string | null = null;
  if (
    active &&
    auth.role !== 'agent' &&
    connection?.qr_cipher &&
    connection.qr_expires_at &&
    Date.parse(connection.qr_expires_at) > Date.now()
  ) {
    qr = await QRCode.toDataURL(
      decrypt(connection.qr_cipher, `qr:${auth.business.id}`),
      { width: 240, margin: 2 },
    );
  }
  const conversation = context.url.searchParams.get('conversacion');
  const allowed =
    conversation &&
    db().get(
      'SELECT id FROM conversations WHERE id=? AND business_id=?',
      conversation,
      auth.business.id,
    );
  const messages = allowed
    ? db()
        .all<Message>(
          'SELECT * FROM messages WHERE business_id=? AND conversation_id=? ORDER BY created_at DESC LIMIT 100',
          auth.business.id,
          conversation!,
        )
        .reverse()
    : [];
  return Response.json({
    status: active ? connection!.status : 'offline',
    qr,
    messages,
  });
};
