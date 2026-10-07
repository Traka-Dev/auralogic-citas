import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';
import { audit, now, requireAdmin, type AuthContext } from './auth';
import type { Store } from './db';
import type {
  Appointment,
  AppointmentStatus,
  Client,
  Service,
  Staff,
} from './types';

const text = (max = 100) =>
  z.string().trim().min(1, 'Completa los campos requeridos.').max(max);
const identifier = z.uuid();
export function tenantRow<T>(
  store: Store,
  table:
    | 'clients'
    | 'services'
    | 'staff'
    | 'appointments'
    | 'tasks'
    | 'conversations',
  id: string,
  businessId: string,
): T {
  identifier.parse(id);
  const row = store.get<T>(
    `SELECT * FROM ${table} WHERE id=? AND business_id=?`,
    id,
    businessId,
  );
  if (!row) throw new Error('El registro no existe o no tienes acceso.');
  return row;
}
export function normalizePhone(value: string) {
  if (!value.trim().startsWith('+'))
    throw new Error('Incluye el prefijo del país: por ejemplo, +52.');
  const phone = parsePhoneNumberFromString(value.trim());
  if (!phone?.isValid())
    throw new Error('Revisa el número de teléfono y su prefijo.');
  return phone.number;
}
export function saveClient(
  store: Store,
  auth: AuthContext,
  input: Record<string, string>,
) {
  const name = text().parse(input.name);
  const phone = normalizePhone(input.phone || '');
  const email = z
    .union([z.email().max(254), z.literal('')])
    .parse((input.email || '').trim());
  const tags = z
    .string()
    .trim()
    .max(200)
    .parse(input.tags || '');
  const duplicate = store.get<{ id: string }>(
    'SELECT id FROM clients WHERE business_id=? AND phone=?',
    auth.business.id,
    phone,
  );
  if (duplicate && duplicate.id !== input.id)
    throw new Error('Este teléfono ya pertenece a un cliente del negocio.');
  const id = input.id || randomUUID();
  store.transaction(() => {
    if (input.id) {
      tenantRow(store, 'clients', id, auth.business.id);
      store.run(
        'UPDATE clients SET name=?,phone=?,email=?,tags=? WHERE id=? AND business_id=?',
        name,
        phone,
        email,
        tags,
        id,
        auth.business.id,
      );
    } else {
      store.run(
        'INSERT INTO clients(id,business_id,name,phone,email,tags,created_at) VALUES (?,?,?,?,?,?,?)',
        id,
        auth.business.id,
        name,
        phone,
        email,
        tags,
        now(),
      );
    }
    audit(store, auth, input.id ? 'client.updated' : 'client.created', id);
  });
  return id;
}
export function saveService(
  store: Store,
  auth: AuthContext,
  input: Record<string, string>,
) {
  requireAdmin(auth);
  const name = text().parse(input.name);
  const duration = z.coerce
    .number()
    .int()
    .min(5)
    .max(480)
    .parse(input.duration);
  const buffer = z.coerce
    .number()
    .int()
    .min(0)
    .max(120)
    .parse(input.buffer || '0');
  const cents = moneyInput(input.price || '0', true);
  const id = input.id || randomUUID();
  store.transaction(() => {
    if (input.id) {
      tenantRow(store, 'services', id, auth.business.id);
      store.run(
        'UPDATE services SET name=?,duration=?,buffer=?,price_cents=? WHERE id=? AND business_id=?',
        name,
        duration,
        buffer,
        cents,
        id,
        auth.business.id,
      );
    } else {
      store.run(
        'INSERT INTO services(id,business_id,name,duration,buffer,price_cents) VALUES (?,?,?,?,?,?)',
        id,
        auth.business.id,
        name,
        duration,
        buffer,
        cents,
      );
    }
    audit(store, auth, 'service.saved', id);
  });
  return id;
}
export function moneyInput(value: string, allowZero = false) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value))
    throw new Error('Usa un importe válido con hasta dos decimales.');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!allowZero && cents <= 0)
    throw new Error('El importe debe ser mayor que cero.');
  return cents;
}
export function saveStaff(
  store: Store,
  auth: AuthContext,
  input: Record<string, string>,
  serviceIds: string[],
) {
  requireAdmin(auth);
  const name = text().parse(input.name);
  const color = z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .parse(input.color || '#367a68');
  const id = input.id || randomUUID();
  const selected = [...new Set(serviceIds)];
  selected.forEach((service) =>
    tenantRow(store, 'services', service, auth.business.id),
  );
  store.transaction(() => {
    if (input.id) {
      tenantRow(store, 'staff', id, auth.business.id);
      store.run(
        'UPDATE staff SET name=?,color=? WHERE id=? AND business_id=?',
        name,
        color,
        id,
        auth.business.id,
      );
    } else
      store.run(
        'INSERT INTO staff(id,business_id,name,color) VALUES (?,?,?,?)',
        id,
        auth.business.id,
        name,
        color,
      );
    store.run(
      'DELETE FROM staff_services WHERE staff_id=? AND business_id=?',
      id,
      auth.business.id,
    );
    selected.forEach((service) =>
      store.run(
        'INSERT INTO staff_services VALUES (?,?,?)',
        id,
        service,
        auth.business.id,
      ),
    );
    audit(store, auth, 'staff.saved', id);
  });
  return id;
}
export function saveAvailability(
  store: Store,
  auth: AuthContext,
  input: Record<string, string>,
) {
  requireAdmin(auth);
  const staff = tenantRow<Staff>(
    store,
    'staff',
    input.staff_id || '',
    auth.business.id,
  );
  const weekday = z.coerce.number().int().min(1).max(7).parse(input.weekday);
  const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  const opens = clock.parse(input.opens);
  const closes = clock.parse(input.closes);
  if (opens >= closes)
    throw new Error('El cierre debe ser posterior a la apertura.');
  store.transaction(() => {
    if (input.closed === 'yes')
      store.run(
        'DELETE FROM availability WHERE staff_id=? AND business_id=? AND weekday=?',
        staff.id,
        auth.business.id,
        weekday,
      );
    else
      store.run(
        'INSERT INTO availability VALUES (?,?,?,?,?) ON CONFLICT(staff_id,weekday) DO UPDATE SET opens=excluded.opens,closes=excluded.closes',
        staff.id,
        auth.business.id,
        weekday,
        opens,
        closes,
      );
    audit(store, auth, 'availability.saved', staff.id);
  });
}
export function localDate(value: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Selecciona una fecha y una hora válidas.');
  const date = DateTime.fromISO(value, { zone: timezone });
  if (
    !date.isValid ||
    date.toFormat("yyyy-MM-dd'T'HH:mm") !== value ||
    date.getPossibleOffsets().length !== 1
  ) {
    throw new Error(
      'La hora no existe o es ambigua por el cambio de horario. Elige otra.',
    );
  }
  return date;
}
export const iso = (date: DateTime) => date.toUTC().toISO()!;

export function bookAppointment(
  store: Store,
  auth: AuthContext,
  input: Record<string, string>,
  clock: DateTime = DateTime.utc(),
) {
  return store.transaction(() => {
    const client = tenantRow<Client>(
      store,
      'clients',
      input.client_id || '',
      auth.business.id,
    );
    const service = tenantRow<Service>(
      store,
      'services',
      input.service_id || '',
      auth.business.id,
    );
    const staff = tenantRow<Staff>(
      store,
      'staff',
      input.staff_id || '',
      auth.business.id,
    );
    if (client.archived || !service.active || !staff.active)
      throw new Error('Selecciona un cliente, servicio y prestador activos.');
    if (
      !store.get(
        'SELECT staff_id FROM staff_services WHERE staff_id=? AND service_id=? AND business_id=?',
        staff.id,
        service.id,
        auth.business.id,
      )
    ) {
      throw new Error(
        'Este prestador no tiene habilitado el servicio seleccionado.',
      );
    }
    const start = localDate(input.starts_at || '', auth.business.timezone);
    const end = start.plus({ minutes: service.duration });
    const busy = end.plus({ minutes: service.buffer });
    if (start.toMillis() <= clock.toMillis())
      throw new Error('La cita debe empezar en el futuro.');
    const hours = store.get<{ opens: string; closes: string }>(
      'SELECT opens,closes FROM availability WHERE staff_id=? AND business_id=? AND weekday=?',
      staff.id,
      auth.business.id,
      start.weekday,
    );
    if (
      !hours ||
      start.toISODate() !== busy.toISODate() ||
      start.toFormat('HH:mm') < hours.opens ||
      busy.toFormat('HH:mm') > hours.closes
    ) {
      throw new Error(
        'La cita y su tiempo entre servicios deben estar dentro del horario disponible.',
      );
    }
    const id = input.id || randomUUID();
    if (input.id) {
      const existing = tenantRow<Appointment>(
        store,
        'appointments',
        id,
        auth.business.id,
      );
      if (!['pending', 'confirmed'].includes(existing.status))
        throw new Error('Solo se pueden reprogramar citas activas.');
    }
    const conflict = store.get(
      `SELECT id FROM appointments WHERE business_id=? AND staff_id=? AND status IN ('pending','confirmed','completed','no_show') AND starts_at<? AND busy_until>? AND id<>?`,
      auth.business.id,
      staff.id,
      iso(busy),
      iso(start),
      id,
    );
    const block = store.get(
      'SELECT id FROM blocks WHERE business_id=? AND staff_id=? AND starts_at<? AND ends_at>?',
      auth.business.id,
      staff.id,
      iso(busy),
      iso(start),
    );
    if (conflict || block)
      throw new Error('Ese horario está ocupado o bloqueado. Elige otro.');
    const notes = z
      .string()
      .trim()
      .max(1000)
      .parse(input.notes || '');
    if (input.id)
      store.run(
        `UPDATE appointments SET client_id=?,service_id=?,staff_id=?,starts_at=?,ends_at=?,busy_until=?,price_cents=?,notes=?,status='pending' WHERE id=? AND business_id=?`,
        client.id,
        service.id,
        staff.id,
        iso(start),
        iso(end),
        iso(busy),
        service.price_cents,
        notes,
        id,
        auth.business.id,
      );
    else
      store.run(
        'INSERT INTO appointments VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        id,
        auth.business.id,
        client.id,
        service.id,
        staff.id,
        iso(start),
        iso(end),
        iso(busy),
        service.price_cents,
        'pending',
        notes,
        now(),
      );
    store.run(
      'INSERT INTO appointment_events VALUES (?,?,?,?,?,?)',
      randomUUID(),
      auth.business.id,
      id,
      auth.user.id,
      input.id ? `Reprogramada para ${iso(start)}` : 'Cita creada',
      now(),
    );
    audit(
      store,
      auth,
      input.id ? 'appointment.rescheduled' : 'appointment.created',
      id,
    );
    return id;
  });
}
export const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmada',
  completed: 'Atendida',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};
export function changeStatus(
  store: Store,
  auth: AuthContext,
  id: string,
  status: string,
) {
  const target = z
    .enum(['confirmed', 'completed', 'cancelled', 'no_show'])
    .parse(status);
  store.transaction(() => {
    const appointment = tenantRow<Appointment>(
      store,
      'appointments',
      id,
      auth.business.id,
    );
    if (!['pending', 'confirmed'].includes(appointment.status))
      throw new Error('Esta cita ya está cerrada.');
    if (target === 'confirmed' && appointment.status !== 'pending')
      throw new Error('Esta cita ya está confirmada.');
    if (
      ['completed', 'no_show'].includes(target) &&
      appointment.starts_at > now()
    )
      throw new Error(
        'Registra la asistencia cuando llegue la hora de la cita.',
      );
    store.run(
      'UPDATE appointments SET status=? WHERE id=? AND business_id=?',
      target,
      id,
      auth.business.id,
    );
    store.run(
      'INSERT INTO appointment_events VALUES (?,?,?,?,?,?)',
      randomUUID(),
      auth.business.id,
      id,
      auth.user.id,
      statusLabels[target],
      now(),
    );
    audit(store, auth, `appointment.${target}`, id);
  });
}
export function addBlock(
  store: Store,
  auth: AuthContext,
  input: Record<string, string>,
) {
  requireAdmin(auth);
  tenantRow(store, 'staff', input.staff_id || '', auth.business.id);
  const start = localDate(input.starts_at || '', auth.business.timezone);
  const end = localDate(input.ends_at || '', auth.business.timezone);
  if (end <= start) throw new Error('El final debe ser posterior al inicio.');
  store.transaction(() => {
    if (
      store.get(
        `SELECT id FROM appointments WHERE business_id=? AND staff_id=? AND status IN ('pending','confirmed') AND starts_at<? AND busy_until>?`,
        auth.business.id,
        input.staff_id!,
        iso(end),
        iso(start),
      )
    )
      throw new Error(
        'Hay citas en ese intervalo. Reprográmalas antes de bloquearlo.',
      );
    const id = randomUUID();
    store.run(
      'INSERT INTO blocks VALUES (?,?,?,?,?,?)',
      id,
      auth.business.id,
      input.staff_id!,
      iso(start),
      iso(end),
      text(200).parse(input.reason),
    );
    audit(store, auth, 'block.created', id);
  });
}
export function appointments(
  store: Store,
  businessId: string,
  from?: string,
  until?: string,
): Appointment[] {
  return store.all<Appointment>(
    `SELECT a.*,c.name client_name,s.name service_name,p.name staff_name,p.color FROM appointments a JOIN clients c ON a.client_id=c.id AND a.business_id=c.business_id JOIN services s ON a.service_id=s.id AND a.business_id=s.business_id JOIN staff p ON a.staff_id=p.id AND a.business_id=p.business_id WHERE a.business_id=? ${from ? 'AND a.starts_at>=?' : ''} ${until ? 'AND a.starts_at<?' : ''} ORDER BY a.starts_at`,
    businessId,
    ...(from ? [from] : []),
    ...(until ? [until] : []),
  );
}
export function formatDate(
  value: string,
  timezone: string,
  format = 'dd LLL · HH:mm',
) {
  return DateTime.fromISO(value, { zone: 'utc' })
    .setZone(timezone)
    .setLocale('es')
    .toFormat(format);
}
export function money(cents: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(
    cents / 100,
  );
}
