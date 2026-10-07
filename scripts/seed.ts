import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { db } from '../src/lib/db';
import { register, resolveSession, createSession } from '../src/lib/auth';
import {
  saveClient,
  saveService,
  saveStaff,
  saveAvailability,
  bookAppointment,
} from '../src/lib/crm';

if (process.env.NODE_ENV === 'production')
  throw new Error('El seed de demostración solo se permite en desarrollo.');
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!email || !password)
  throw new Error(
    'Configura SEED_EMAIL y SEED_PASSWORD (12 caracteres mínimo). No hay credenciales por defecto.',
  );
const store = db();
if (store.get('SELECT id FROM users WHERE email=?', email.toLowerCase()))
  throw new Error(
    'Este correo ya existe. El seed no modifica cuentas existentes.',
  );
const { userId, businessId } = await register(store, {
  name: 'Alex Rivera',
  email,
  password,
  business: 'Estudio Oliva',
  timezone: 'America/Mexico_City',
});
const session = createSession(store, userId, businessId);
const auth = resolveSession(store, session)!;
const cut = saveService(store, auth, {
  name: 'Corte y estilo',
  duration: '45',
  buffer: '15',
  price: '350',
});
const color = saveService(store, auth, {
  name: 'Coloración',
  duration: '90',
  buffer: '15',
  price: '950',
});
saveService(store, auth, {
  name: 'Tratamiento capilar',
  duration: '30',
  buffer: '10',
  price: '450',
});
const maria = saveStaff(
  store,
  auth,
  { name: 'María Torres', color: '#367a68' },
  [cut, color],
);
const diego = saveStaff(store, auth, { name: 'Diego Luna', color: '#b58a58' }, [
  cut,
]);
for (const person of [maria, diego])
  for (let weekday = 1; weekday <= 6; weekday++)
    saveAvailability(store, auth, {
      staff_id: person,
      weekday: String(weekday),
      opens: '09:00',
      closes: '19:00',
    });
const names = [
  'Valeria Mendoza',
  'Sofía Ramírez',
  'Camila Ortiz',
  'Andrés García',
  'Lucía Navarro',
];
const today = DateTime.now().setZone(auth.business.timezone);
const firstDay = (
  today.weekday === 7 ? today.plus({ days: 1 }) : today
).startOf('day');
for (let index = 0; index < names.length; index++) {
  const client = saveClient(store, auth, {
    name: names[index]!,
    phone: `+52555501010${index}`,
    email: `cliente${index + 1}@example.test`,
    tags: index % 2 ? 'Nuevo' : 'Frecuente',
  });
  const hour = 10 + index;
  const appointmentDay =
    firstDay.plus({ hours: hour }).toMillis() > Date.now()
      ? firstDay
      : firstDay.plus({
          days: firstDay.plus({ days: 1 }).weekday === 7 ? 2 : 1,
        });
  bookAppointment(store, auth, {
    client_id: client,
    service_id: cut,
    staff_id: index % 2 ? diego : maria,
    starts_at: appointmentDay
      .plus({ hours: hour })
      .toFormat("yyyy-MM-dd'T'HH:mm"),
    notes: 'Datos de demostración',
  });
  store.run(
    'INSERT INTO tasks VALUES (?,?,?,?,?,?,0)',
    randomUUID(),
    businessId,
    client,
    userId,
    'Confirmar próxima visita',
    today.plus({ days: 1, hours: index }).toUTC().toISO()!,
  );
}
store.run('DELETE FROM sessions WHERE user_id=?', userId);
console.info(
  'Demostración creada para el correo configurado en SEED_EMAIL. Los contactos son ficticios; WhatsApp sigue desconectado.',
);
store.close();
