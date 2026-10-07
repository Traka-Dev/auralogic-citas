import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { db } from '../../lib/db';
import {
  checkPassword,
  createSession,
  digest,
  emailSchema,
  hashPassword,
  now,
  rateLimit,
  register,
} from '../../lib/auth';
import { feedback, form, errorMessage } from '../../lib/http';

export const POST: APIRoute = async (context) => {
  let action = 'login';
  let inviteToken = '';
  try {
    const { input } = await form(context);
    action = input.action || 'login';
    inviteToken = input.token || '';
    const store = db();
    if (action === 'logout') {
      const session = context.cookies.get('auralogic_session')?.value;
      if (session)
        store.run('DELETE FROM sessions WHERE token_hash=?', digest(session));
      context.cookies.delete('auralogic_session', { path: '/' });
      return context.redirect('/login', 303);
    }
    const email = emailSchema.parse((input.email || '').trim());
    // Limits are persisted and shared by app processes. Do not trust forwarded IP headers.
    if (
      !rateLimit(store, `auth:email:${digest(email)}`) ||
      !rateLimit(store, `auth:ip:${digest(context.clientAddress)}`, 60)
    )
      throw new Error('Demasiados intentos. Espera 15 minutos.');
    let userId: string;
    let businessId: string;
    if (action === 'register') {
      ({ userId, businessId } = await register(store, {
        name: input.name || '',
        email,
        password: input.password || '',
        business: input.business || '',
        timezone: input.timezone || '',
      }));
    } else if (action === 'invite') {
      const invite = store.get<{
        business_id: string;
        email: string;
        role: string;
      }>(
        'SELECT * FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?',
        digest(input.token || ''),
        now(),
      );
      if (!invite || invite.email !== email)
        throw new Error(
          'La invitación no es válida para este correo o ya expiró.',
        );
      const existing = store.get<{ id: string; password_hash: string }>(
        'SELECT * FROM users WHERE email=?',
        email,
      );
      let newHash: string | undefined;
      if (existing) {
        if (
          !(await checkPassword(input.password || '', existing.password_hash))
        )
          throw new Error('Usa la contraseña de tu cuenta existente.');
        userId = existing.id;
      } else {
        if (!(input.name || '').trim() || (input.name || '').length > 100)
          throw new Error('Escribe tu nombre.');
        newHash = await hashPassword(input.password || '');
        userId = randomUUID();
      }
      businessId = invite.business_id;
      store.transaction(() => {
        const valid = store.get(
          'SELECT token_hash FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?',
          digest(input.token || ''),
          now(),
        );
        if (!valid) throw new Error('Esta invitación ya fue utilizada.');
        if (!existing)
          store.run(
            'INSERT INTO users VALUES (?,?,?,?,?)',
            userId,
            input.name!.trim(),
            email,
            newHash!,
            now(),
          );
        store.run(
          'INSERT INTO memberships VALUES (?,?,?) ON CONFLICT DO NOTHING',
          userId,
          businessId,
          invite.role,
        );
        store.run(
          'UPDATE invites SET used_at=? WHERE token_hash=?',
          now(),
          digest(input.token || ''),
        );
      });
    } else {
      const user = store.get<{ id: string; password_hash: string }>(
        'SELECT id,password_hash FROM users WHERE email=?',
        email,
      );
      // Run a hash even for an unknown account to reduce timing differences.
      const fallback =
        'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await checkPassword(
        input.password || '',
        user?.password_hash || fallback,
      );
      if (!user || !valid) throw new Error('Correo o contraseña incorrectos.');
      const membership = store.get<{ business_id: string }>(
        'SELECT business_id FROM memberships WHERE user_id=? ORDER BY business_id LIMIT 1',
        user.id,
      );
      if (!membership)
        throw new Error('Tu cuenta no tiene un negocio asignado.');
      userId = user.id;
      businessId = membership.business_id;
    }
    const session = createSession(store, userId, businessId);
    context.cookies.set('auralogic_session', session, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure:
        new URL(process.env.APP_ORIGIN || context.url.origin).protocol ===
        'https:',
      maxAge: 7 * 86400,
    });
    return context.redirect('/', 303);
  } catch (error) {
    return feedback(
      context,
      action === 'register'
        ? '/registro'
        : action === 'invite'
          ? `/invitacion?token=${encodeURIComponent(inviteToken)}`
          : '/login',
      errorMessage(error),
      true,
    );
  }
};
