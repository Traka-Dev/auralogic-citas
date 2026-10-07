import { randomUUID } from 'node:crypto';
import {
  jidNormalizedUser,
  normalizeMessageContent,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { now } from '../auth';
import type { Store } from '../db';

// Direct conversations only. Groups, statuses and history sync are outside this first adapter.
export function ingestMessage(
  store: Store,
  businessId: string,
  message: WAMessage,
) {
  const remote = message.key.remoteJid;
  if (
    !remote ||
    (!remote.endsWith('@s.whatsapp.net') && !remote.endsWith('@lid')) ||
    !message.key.id ||
    !message.message
  )
    return;
  const jid = jidNormalizedUser(remote);
  const externalId = message.key.id;
  const content = normalizeMessageContent(message.message);
  if (
    !content ||
    content.protocolMessage ||
    content.reactionMessage ||
    content.senderKeyDistributionMessage
  )
    return;
  const body =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    (content.imageMessage
      ? '[Imagen: consulta el adjunto en WhatsApp]'
      : content.audioMessage
        ? '[Audio: consulta el adjunto en WhatsApp]'
        : content.documentMessage
          ? '[Documento: consulta el adjunto en WhatsApp]'
          : content.videoMessage
            ? '[Video: consulta el adjunto en WhatsApp]'
            : '[Mensaje no compatible: consulta WhatsApp]');
  const rawPhone = jid.endsWith('@s.whatsapp.net')
    ? `+${jid.split('@')[0]}`
    : null;
  const parsed = rawPhone ? parsePhoneNumberFromString(rawPhone) : undefined;
  const phone = parsed?.isValid() ? parsed.number : null;
  const seconds = Number(
    message.messageTimestamp || Math.floor(Date.now() / 1000),
  );
  const date = new Date(seconds * 1000);
  const timestamp = Number.isFinite(date.getTime())
    ? date.toISOString()
    : now();
  store.transaction(() => {
    let conversation = store.get<{ id: string }>(
      'SELECT id FROM conversations WHERE business_id=? AND jid=?',
      businessId,
      jid,
    );
    if (!conversation) {
      const found = phone
        ? store.get<{ id: string }>(
            'SELECT id FROM clients WHERE business_id=? AND phone=?',
            businessId,
            phone,
          )
        : undefined;
      const clientId = found?.id || randomUUID();
      if (!found)
        store.run(
          "INSERT INTO clients(id,business_id,name,phone,source,created_at) VALUES (?,?,?,?,'WhatsApp',?)",
          clientId,
          businessId,
          (message.key.fromMe ? phone : message.pushName)?.slice(0, 100) ||
            phone ||
            'Contacto de WhatsApp',
          phone,
          now(),
        );
      conversation = { id: randomUUID() };
      store.run(
        "INSERT INTO conversations VALUES (?,?,?,?,NULL,'open',?)",
        conversation.id,
        businessId,
        clientId,
        jid,
        timestamp,
      );
    }
    // An echo from the phone must not create a second row for an outgoing CRM message.
    store.run(
      'INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(business_id,conversation_id,external_id) DO NOTHING',
      randomUUID(),
      businessId,
      conversation.id,
      externalId,
      message.key.fromMe ? 'out' : 'in',
      body,
      message.key.fromMe ? 'sent' : 'received',
      null,
      timestamp,
    );
    store.run(
      'UPDATE conversations SET updated_at=MAX(updated_at,?) WHERE id=? AND business_id=?',
      timestamp,
      conversation.id,
      businessId,
    );
  });
}
