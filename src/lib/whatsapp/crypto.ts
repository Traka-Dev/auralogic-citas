import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const raw = process.env.WHATSAPP_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw))
    throw new Error(
      'WHATSAPP_ENCRYPTION_KEY debe contener 32 bytes en hexadecimal.',
    );
  return Buffer.from(raw, 'hex');
}
export const whatsappEnabled = () =>
  process.env.WHATSAPP_ENABLED === 'true' &&
  /^[a-f0-9]{64}$/i.test(process.env.WHATSAPP_ENCRYPTION_KEY || '');
export function encrypt(value: string, scope: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(scope));
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64'))
    .join('.');
}
export function decrypt(value: string, scope: string) {
  const [iv, tag, body] = value.split('.');
  if (!iv || !tag || !body) throw new Error('Credencial cifrada inválida.');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64'),
  );
  cipher.setAAD(Buffer.from(scope));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    cipher.update(Buffer.from(body, 'base64')),
    cipher.final(),
  ]).toString('utf8');
}
