import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../../../lib/db';
import {
  audit,
  createSession,
  digest,
  emailSchema,
  now,
  requireAdmin,
  token,
} from '../../../lib/auth';
import {
  addBlock,
  bookAppointment,
  changeStatus,
  iso,
  localDate,
  moneyInput,
  saveAvailability,
  saveClient,
  saveService,
  saveStaff,
  tenantRow,
} from '../../../lib/crm';
import { errorMessage, feedback, form } from '../../../lib/http';
import type { Appointment } from '../../../lib/types';
import { whatsappEnabled } from '../../../lib/whatsapp/crypto';

export const POST: APIRoute = async (context) => {
  const auth = context.locals.auth;
  if (!auth) return context.redirect('/login', 303);
  let back = '/';
  try {
    const { data, input } = await form(context);
    const rawBack = input.back || '/';
    const target = new URL(rawBack, context.url);
    if (target.origin === context.url.origin && !rawBack.startsWith('//'))
      back = target.pathname + target.search;
    const store = db();
    const businessId = auth.business.id;
    switch (context.params.action) {
      case 'client': {
        const id = saveClient(store, auth, input);
        return feedback(context, `/clientes/${id}`, 'Cliente guardado.');
      }
      case 'archive': {
        tenantRow(store, 'clients', input.id || '', businessId);
        if (
          input.archived === '1' &&
          store.get(
            "SELECT id FROM appointments WHERE client_id=? AND business_id=? AND status IN ('pending','confirmed') AND starts_at>?",
            input.id!,
            businessId,
            now(),
          )
        )
          throw new Error(
            'Cancela o completa las citas activas antes de archivar al cliente.',
          );
        store.transaction(() => {
          store.run(
            'UPDATE clients SET archived=? WHERE id=? AND business_id=?',
            input.archived === '1' ? 1 : 0,
            input.id!,
            businessId,
          );
          audit(store, auth, 'client.archived', input.id!);
        });
        break;
      }
      case 'note': {
        tenantRow(store, 'clients', input.client_id || '', businessId);
        const content = z.string().trim().min(1).max(2000).parse(input.content);
        store.run(
          'INSERT INTO notes VALUES (?,?,?,?,?,?)',
          randomUUID(),
          businessId,
          input.client_id!,
          auth.user.id,
          content,
          now(),
        );
        break;
      }
      case 'service':
        saveService(store, auth, input);
        break;
      case 'staff':
        saveStaff(store, auth, input, data.getAll('services').map(String));
        break;
      case 'availability':
        saveAvailability(store, auth, input);
        break;
      case 'appointment': {
        const id = bookAppointment(store, auth, input);
        return feedback(
          context,
          `/citas/${id}`,
          input.id
            ? 'Cita reprogramada. Vuelve a confirmar con el cliente.'
            : 'Cita reservada.',
        );
      }
      case 'status':
        changeStatus(store, auth, input.id || '', input.status || '');
        break;
      case 'block':
        addBlock(store, auth, input);
        break;
      case 'remove-block': {
        requireAdmin(auth);
        store.run(
          'DELETE FROM blocks WHERE id=? AND business_id=?',
          input.id || '',
          businessId,
        );
        break;
      }
      case 'task': {
        tenantRow(store, 'clients', input.client_id || '', businessId);
        const title = z.string().trim().min(1).max(200).parse(input.title);
        const due = localDate(input.due_at || '', auth.business.timezone);
        store.run(
          'INSERT INTO tasks VALUES (?,?,?,?,?,?,0)',
          randomUUID(),
          businessId,
          input.client_id!,
          auth.user.id,
          title,
          iso(due),
        );
        break;
      }
      case 'task-done': {
        const task = tenantRow<{ author_id: string }>(
          store,
          'tasks',
          input.id || '',
          businessId,
        );
        if (auth.role === 'agent' && task.author_id !== auth.user.id)
          throw new Error('Solo puedes completar tus propios seguimientos.');
        store.run(
          'UPDATE tasks SET done=1 WHERE id=? AND business_id=?',
          input.id!,
          businessId,
        );
        break;
      }
      case 'payment': {
        requireAdmin(auth);
        const appointment = tenantRow<Appointment>(
          store,
          'appointments',
          input.appointment_id || '',
          businessId,
        );
        if (appointment.status === 'cancelled')
          throw new Error('No registres cobros en una cita cancelada.');
        const amount = moneyInput(input.amount || '');
        store.transaction(() => {
          const id = z.uuid().parse(input.request_id);
          if (
            store.get(
              'SELECT id FROM payments WHERE id=? AND business_id=?',
              id,
              businessId,
            )
          )
            return;
          store.run(
            'INSERT INTO payments VALUES (?,?,?,?,?,?)',
            id,
            businessId,
            input.appointment_id!,
            amount,
            now(),
            auth.user.id,
          );
          audit(store, auth, 'payment.recorded', id);
        });
        break;
      }
      case 'invite': {
        requireAdmin(auth);
        const email = emailSchema.parse((input.email || '').trim());
        const role = z.enum(['admin', 'agent']).parse(input.role);
        const inviteToken = token();
        store.run(
          'INSERT INTO invites VALUES (?,?,?,?,?,NULL)',
          digest(inviteToken),
          businessId,
          email,
          role,
          new Date(Date.now() + 48 * 3600000).toISOString(),
        );
        return context.redirect(`/equipo?invitacion=${inviteToken}`, 303);
      }
      case 'switch-business': {
        const membership = store.get(
          'SELECT user_id FROM memberships WHERE user_id=? AND business_id=?',
          auth.user.id,
          input.business_id || '',
        );
        if (!membership) throw new Error('No tienes acceso a este negocio.');
        const old = context.cookies.get('auralogic_session')?.value;
        if (old)
          store.run('DELETE FROM sessions WHERE token_hash=?', digest(old));
        context.cookies.set(
          'auralogic_session',
          createSession(store, auth.user.id, input.business_id!),
          {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure:
              new URL(process.env.APP_ORIGIN || context.url.origin).protocol ===
              'https:',
            maxAge: 7 * 86400,
          },
        );
        return context.redirect('/', 303);
      }
      case 'whatsapp-connect': {
        requireAdmin(auth);
        if (!whatsappEnabled())
          throw new Error(
            'Configura y ejecuta el worker de WhatsApp antes de conectar.',
          );
        const connection = store.get<{ heartbeat_at: string | null }>(
          'SELECT heartbeat_at FROM connections WHERE business_id=?',
          businessId,
        );
        if (
          !connection?.heartbeat_at ||
          Date.parse(connection.heartbeat_at) < Date.now() - 30000
        )
          throw new Error('El worker de WhatsApp no está activo.');
        store.run(
          "UPDATE connections SET desired=1,status='connecting' WHERE business_id=?",
          businessId,
        );
        break;
      }
      case 'whatsapp-disconnect': {
        requireAdmin(auth);
        store.transaction(() => {
          store.run(
            "UPDATE messages SET status='cancelled' WHERE business_id=? AND status='queued'",
            businessId,
          );
          store.run(
            "UPDATE connections SET desired=0,status='disconnected',qr_cipher=NULL,qr_expires_at=NULL WHERE business_id=?",
            businessId,
          );
        });
        break;
      }
      case 'message': {
        const conversation = tenantRow<{ assigned_to: string | null }>(
          store,
          'conversations',
          input.conversation_id || '',
          businessId,
        );
        if (
          conversation.assigned_to &&
          conversation.assigned_to !== auth.user.id &&
          auth.role === 'agent'
        )
          throw new Error('La conversación está asignada a otra persona.');
        const body = z.string().trim().min(1).max(4000).parse(input.body);
        const connection = store.get<{
          status: string;
          heartbeat_at: string | null;
        }>(
          'SELECT status,heartbeat_at FROM connections WHERE business_id=?',
          businessId,
        );
        if (
          connection?.status !== 'connected' ||
          !connection.heartbeat_at ||
          Date.parse(connection.heartbeat_at) < Date.now() - 30000
        )
          throw new Error('WhatsApp no está conectado.');
        const messageId = z.uuid().parse(input.request_id);
        store.run(
          "INSERT INTO messages VALUES (?,?,?,?,'out',?,'queued',?,?) ON CONFLICT(id) DO NOTHING",
          messageId,
          businessId,
          input.conversation_id!,
          null,
          body,
          auth.user.id,
          now(),
        );
        break;
      }
      case 'assign-conversation': {
        const existing = tenantRow<{ assigned_to: string | null }>(
          store,
          'conversations',
          input.id || '',
          businessId,
        );
        if (
          auth.role === 'agent' &&
          existing.assigned_to &&
          existing.assigned_to !== auth.user.id
        )
          throw new Error(
            'Pide a un administrador que transfiera esta conversación.',
          );
        const user = input.user_id || auth.user.id;
        if (user !== auth.user.id) requireAdmin(auth);
        if (
          !store.get(
            'SELECT user_id FROM memberships WHERE business_id=? AND user_id=?',
            businessId,
            user,
          )
        )
          throw new Error('Selecciona alguien de tu equipo.');
        store.run(
          'UPDATE conversations SET assigned_to=? WHERE id=? AND business_id=?',
          user,
          input.id!,
          businessId,
        );
        break;
      }
      default:
        return new Response('Acción no encontrada.', { status: 404 });
    }
    return feedback(context, back, 'Cambios guardados.');
  } catch (error) {
    return feedback(context, back, errorMessage(error), true);
  }
};
