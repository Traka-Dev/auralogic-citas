import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Store } from './db';
import type { Business } from './types';

export interface AuthContext {
  user: { id: string; name: string; email: string };
  business: Business;
  role: 'owner' | 'admin' | 'agent';
}
const derive = promisify(scrypt);
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export const token = () => randomBytes(32).toString('hex');
export const emailSchema = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, 'Usa al menos 12 caracteres.')
  .max(128);

export async function hashPassword(password: string) {
  passwordSchema.parse(password);
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function checkPassword(password: string, hash: string) {
  const [, salt, encoded] = hash.split(':');
  if (!salt || !encoded || password.length > 128) return false;
  const key = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export function equalToken(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function rateLimit(
  store: Store,
  key: string,
  limit = 12,
  windowMs = 900000,
) {
  const time = Date.now();
  return store.transaction(() => {
    store.run('DELETE FROM rate_limits WHERE resets_at < ?', time);
    const entry = store.get<{ hits: number; resets_at: number }>(
      'SELECT * FROM rate_limits WHERE key=?',
      key,
    );
    if (entry && entry.hits >= limit) return false;
    store.run(
      `INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1`,
      key,
      time + windowMs,
    );
    return true;
  });
}
export function createSession(
  store: Store,
  userId: string,
  businessId: string,
) {
  const value = token();
  store.run('DELETE FROM sessions WHERE expires_at < ?', now());
  store.run(
    'INSERT INTO sessions VALUES (?,?,?,?)',
    digest(value),
    userId,
    businessId,
    new Date(Date.now() + 7 * 86400000).toISOString(),
  );
  return value;
}
export function resolveSession(
  store: Store,
  value?: string,
): AuthContext | null {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  const row = store.get<{
    user_id: string;
    user_name: string;
    email: string;
    role: AuthContext['role'];
    id: string;
    name: string;
    timezone: string;
    currency: string;
  }>(
    `
    SELECT u.id user_id,u.name user_name,u.email,m.role,b.id,b.name,b.timezone,b.currency
    FROM sessions s JOIN users u ON s.user_id=u.id JOIN businesses b ON s.business_id=b.id
    JOIN memberships m ON m.user_id=u.id AND m.business_id=b.id
    WHERE s.token_hash=? AND s.expires_at>?`,
    digest(value),
    now(),
  );
  return row
    ? {
        user: { id: row.user_id, name: row.user_name, email: row.email },
        business: {
          id: row.id,
          name: row.name,
          timezone: row.timezone,
          currency: row.currency,
        },
        role: row.role,
      }
    : null;
}
export async function register(
  store: Store,
  input: {
    name: string;
    email: string;
    password: string;
    business: string;
    timezone: string;
  },
) {
  const email = emailSchema.parse(input.email.trim());
  const name = z.string().trim().min(2).max(100).parse(input.name);
  const business = z.string().trim().min(2).max(100).parse(input.business);
  if (
    !Intl.supportedValuesOf('timeZone').includes(input.timezone) &&
    input.timezone !== 'UTC'
  )
    throw new Error('Zona horaria inválida.');
  const passwordHash = await hashPassword(input.password);
  const userId = randomUUID();
  const businessId = randomUUID();
  store.transaction(() => {
    if (store.get('SELECT id FROM users WHERE email=?', email))
      throw new Error('Este correo ya tiene una cuenta. Inicia sesión.');
    store.run(
      'INSERT INTO businesses(id,name,timezone,created_at) VALUES (?,?,?,?)',
      businessId,
      business,
      input.timezone,
      now(),
    );
    store.run(
      'INSERT INTO users VALUES (?,?,?,?,?)',
      userId,
      name,
      email,
      passwordHash,
      now(),
    );
    store.run(
      'INSERT INTO memberships VALUES (?,?,?)',
      userId,
      businessId,
      'owner',
    );
    store.run('INSERT INTO connections(business_id) VALUES (?)', businessId);
  });
  return { userId, businessId };
}
export function requireAdmin(auth: AuthContext) {
  if (auth.role === 'agent')
    throw new Error('Esta acción requiere permisos de administración.');
}
export function audit(
  store: Store,
  auth: AuthContext,
  action: string,
  target: string,
) {
  store.run(
    'INSERT INTO audit_log VALUES (?,?,?,?,?,?)',
    randomUUID(),
    auth.business.id,
    auth.user.id,
    action,
    target,
    now(),
  );
}
