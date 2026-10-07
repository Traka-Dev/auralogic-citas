import { defineMiddleware } from 'astro:middleware';
import { db } from './lib/db';
import { resolveSession, token } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url } = context;
  const secure =
    new URL(process.env.APP_ORIGIN || url.origin).protocol === 'https:';
  context.locals.auth = resolveSession(
    db(),
    cookies.get('auralogic_session')?.value,
  );
  let csrf = cookies.get('auralogic_csrf')?.value;
  if (!csrf || !/^[a-f0-9]{64}$/.test(csrf)) {
    csrf = token();
    cookies.set('auralogic_csrf', csrf, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      path: '/',
      maxAge: 86400,
    });
  }
  context.locals.csrf = csrf;
  const publicPath = [
    '/login',
    '/registro',
    '/invitacion',
    '/api/auth',
    '/api/health',
  ].includes(url.pathname);
  if (!publicPath && !context.locals.auth) return context.redirect('/login');
  if (request.method === 'POST') {
    const expected =
      process.env.APP_ORIGIN || (import.meta.env.DEV ? url.origin : '');
    if (!expected || request.headers.get('origin') !== expected)
      return new Response('Origen no permitido.', { status: 403 });
    const size = Number(request.headers.get('content-length') || 0);
    if (size > 131072)
      return new Response('Solicitud demasiado grande.', { status: 413 });
  }
  const response = await next();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  if (secure)
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
});
