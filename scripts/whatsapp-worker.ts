import makeWASocket, {
  DisconnectReason,
  type WASocket,
} from '@whiskeysockets/baileys';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { db } from '../src/lib/db';
import { now } from '../src/lib/auth';
import { authState } from '../src/lib/whatsapp/auth-state';
import { encrypt, whatsappEnabled } from '../src/lib/whatsapp/crypto';
import { ingestMessage } from '../src/lib/whatsapp/messages';

if (!whatsappEnabled())
  throw new Error(
    'Activa WHATSAPP_ENABLED y configura una clave de cifrado válida en .env.',
  );
const store = db();
const owner = randomUUID();
const sockets = new Map<string, WASocket>();
const retry = new Map<string, number>();
const logger = pino({ level: 'silent' }); // Never log QR, session credentials or message bodies.
let stopped = false;
store.transaction(() => {
  const lock = store.get<{ expires_at: number }>(
    'SELECT expires_at FROM worker_lock WHERE id=1',
  );
  if (lock && lock.expires_at > Date.now())
    throw new Error('Ya hay un worker activo para esta base de datos.');
  store.run(
    'INSERT INTO worker_lock VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at',
    owner,
    Date.now() + 15000,
  );
  store.run("UPDATE messages SET status='uncertain' WHERE status='sending'");
  store.run(
    "UPDATE connections SET status='disconnected',qr_cipher=NULL,qr_expires_at=NULL",
  );
});

function open(businessId: string) {
  const auth = authState(store, businessId);
  const socket = makeWASocket({
    auth: auth.state,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 20000,
  });
  sockets.set(businessId, socket);
  socket.ev.on('creds.update', () => {
    if (!stopped && sockets.get(businessId) === socket) auth.save();
  });
  socket.ev.on('connection.update', (update) => {
    if (sockets.get(businessId) !== socket || stopped) return;
    if (update.qr)
      store.run(
        "UPDATE connections SET qr_cipher=?,qr_expires_at=?,status='qr' WHERE business_id=? AND desired=1",
        encrypt(update.qr, `qr:${businessId}`),
        new Date(Date.now() + 45000).toISOString(),
        businessId,
      );
    if (update.connection === 'open')
      store.run(
        "UPDATE connections SET status='connected',qr_cipher=NULL,qr_expires_at=NULL,phone=? WHERE business_id=?",
        socket.user?.id.split(':')[0] || null,
        businessId,
      );
    if (update.connection === 'close') {
      sockets.delete(businessId);
      const code = (
        update.lastDisconnect?.error as
          { output?: { statusCode?: number } } | undefined
      )?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        store.run('DELETE FROM wa_auth WHERE business_id=?', businessId);
        store.run(
          "UPDATE connections SET desired=0,status='disconnected',qr_cipher=NULL,qr_expires_at=NULL,phone=NULL WHERE business_id=?",
          businessId,
        );
      } else {
        retry.set(businessId, Date.now() + 5000);
        store.run(
          "UPDATE connections SET status='reconnecting',qr_cipher=NULL,qr_expires_at=NULL WHERE business_id=?",
          businessId,
        );
      }
    }
  });
  socket.ev.on('messages.upsert', (event) => {
    if (stopped || sockets.get(businessId) !== socket) return;
    for (const message of event.messages)
      ingestMessage(store, businessId, message);
  });
  socket.ev.on('messages.update', (events) => {
    if (stopped || sockets.get(businessId) !== socket) return;
    for (const event of events) {
      const status = event.update.status;
      if (event.key.id && status && status >= 3)
        store.run(
          'UPDATE messages SET status=? WHERE business_id=? AND external_id=?',
          status >= 4 ? 'read' : 'delivered',
          businessId,
          event.key.id,
        );
    }
  });
}
async function poll() {
  const connections = store.all<{
    business_id: string;
    desired: number;
    status: string;
  }>('SELECT * FROM connections');
  for (const connection of connections) {
    const businessId = connection.business_id;
    const existing = sockets.get(businessId);
    if (!connection.desired) {
      if (existing) {
        sockets.delete(businessId);
        try {
          await existing.logout();
        } catch {
          existing.end(new Error('Desvinculado por el administrador.'));
        }
      }
      store.run('DELETE FROM wa_auth WHERE business_id=?', businessId);
      store.run(
        "UPDATE connections SET status='disconnected',qr_cipher=NULL,qr_expires_at=NULL,phone=NULL WHERE business_id=?",
        businessId,
      );
    } else if (
      connection.desired &&
      !existing &&
      Date.now() > (retry.get(businessId) || 0)
    )
      open(businessId);
  }
  const outgoing = store.all<{
    id: string;
    business_id: string;
    jid: string;
    body: string;
    conversation_id: string;
  }>(
    "SELECT m.*,c.jid FROM messages m JOIN conversations c ON m.conversation_id=c.id JOIN connections w ON m.business_id=w.business_id WHERE m.status='queued' AND w.status='connected' AND w.desired=1 ORDER BY m.created_at LIMIT 10",
  );
  for (const message of outgoing) {
    if (stopped) break;
    const socket = sockets.get(message.business_id);
    if (!socket) continue;
    if (
      !store.run(
        "UPDATE messages SET status='sending' WHERE id=? AND status='queued'",
        message.id,
      ).changes
    )
      continue;
    try {
      const sent = await socket.sendMessage(message.jid, {
        text: message.body,
      });
      store.transaction(() => {
        // The provider echo may have arrived before the send result was persisted.
        if (sent?.key.id)
          store.run(
            'DELETE FROM messages WHERE business_id=? AND conversation_id=? AND external_id=? AND id<>?',
            message.business_id,
            message.conversation_id,
            sent.key.id,
            message.id,
          );
        store.run(
          "UPDATE messages SET status='sent',external_id=? WHERE id=?",
          sent?.key.id || null,
          message.id,
        );
        store.run(
          'UPDATE conversations SET updated_at=? WHERE id=? AND business_id=?',
          now(),
          message.conversation_id,
          message.business_id,
        );
      });
    } catch {
      // Sending may have reached WhatsApp even if the acknowledgement failed. Never retry blindly.
      store.run(
        "UPDATE messages SET status='uncertain' WHERE id=?",
        message.id,
      );
    }
  }
}
const heartbeat = setInterval(() => {
  if (stopped) return;
  const renewed = store.run(
    'UPDATE worker_lock SET expires_at=? WHERE id=1 AND owner=?',
    Date.now() + 15000,
    owner,
  );
  if (!renewed.changes) {
    stopped = true;
    return;
  }
  store.run('UPDATE connections SET heartbeat_at=?', now());
}, 1000);
const shutdown = () => {
  stopped = true;
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.info('Worker de WhatsApp iniciado. Un solo worker por base de datos.');
try {
  while (!stopped) {
    try {
      await poll();
    } catch {
      console.error(
        'Falló un ciclo del worker; revisa su estado y configuración.',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} finally {
  clearInterval(heartbeat);
  for (const socket of sockets.values())
    socket.end(new Error('Worker detenido.'));
  if (store.get('SELECT id FROM worker_lock WHERE id=1 AND owner=?', owner))
    store.run(
      "UPDATE connections SET status='disconnected',heartbeat_at=NULL,qr_cipher=NULL,qr_expires_at=NULL",
    );
  store.run('DELETE FROM worker_lock WHERE id=1 AND owner=?', owner);
  store.close();
}
