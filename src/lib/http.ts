import type { APIContext } from 'astro';
import { z } from 'zod';
import { equalToken } from './auth';

export async function form(context: APIContext) {
  const data = await context.request.formData();
  if (!equalToken(String(data.get('csrf') || ''), context.locals.csrf))
    throw new Error('La sesión del formulario expiró. Recarga la página.');
  return {
    data,
    input: Object.fromEntries(
      [...data].filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
  };
}
export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || 'Revisa los datos del formulario.';
  if (
    error instanceof Error &&
    !/SQLITE|constraint|UNIQUE|FOREIGN|database/i.test(error.message)
  )
    return error.message;
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.';
}
export function feedback(
  context: APIContext,
  path: string,
  message: string,
  error = false,
) {
  const url = new URL(path, context.url);
  if (url.origin !== context.url.origin || !url.pathname.startsWith('/'))
    return context.redirect('/');
  url.searchParams.set(error ? 'error' : 'ok', message);
  return context.redirect(url.pathname + url.search, 303);
}
