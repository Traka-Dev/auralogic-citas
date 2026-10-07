import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DateTime } from 'luxon';
import { Store } from '../../src/lib/db';
import {
  checkPassword,
  createSession,
  digest,
  hashPassword,
  now,
  rateLimit,
  register,
  resolveSession,
  type AuthContext,
} from '../../src/lib/auth';
import {
  addBlock,
  bookAppointment,
  changeStatus,
  localDate,
  moneyInput,
  normalizePhone,
  saveAvailability,
  saveClient,
  saveService,
  saveStaff,
  tenantRow,
} from '../../src/lib/crm';
import { encrypt, decrypt } from '../../src/lib/whatsapp/crypto';
import { ingestMessage } from '../../src/lib/whatsapp/messages';

let store: Store;
let auth: AuthContext;
let client: string;
let service: string;
let staff: string;
const date = DateTime.fromISO('2035-06-04T15:00:00Z'); // Monday, 09:00 Mexico City
function fixture(database: Store) {
  const businessId = randomUUID();
  const userId = randomUUID();
  database.run(
    'INSERT INTO businesses VALUES (?,?,?,?,?)',
    businessId,
    'Estudio',
    'America/Mexico_City',
    'MXN',
    now(),
  );
  database.run(
    'INSERT INTO users VALUES (?,?,?,?,?)',
    userId,
    'Persona',
    'persona@example.test',
    'unused',
    now(),
  );
  database.run(
    'INSERT INTO memberships VALUES (?,?,?)',
    userId,
    businessId,
    'owner',
  );
  return {
    user: { id: userId, name: 'Persona', email: 'persona@example.test' },
    business: {
      id: businessId,
      name: 'Estudio',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
    },
    role: 'owner',
  } satisfies AuthContext;
}
function booking(overrides: Record<string, string> = {}) {
  return {
    client_id: client,
    service_id: service,
    staff_id: staff,
    starts_at: '2035-06-04T09:00',
    ...overrides,
  };
}
beforeEach(() => {
  store = new Store(':memory:');
  auth = fixture(store);
  client = saveClient(store, auth, { name: 'Valeria', phone: '+525555010100' });
  service = saveService(store, auth, {
    name: 'Corte',
    duration: '45',
    buffer: '15',
    price: '350.25',
  });
  staff = saveStaff(store, auth, { name: 'María' }, [service]);
  saveAvailability(store, auth, {
    staff_id: staff,
    weekday: '1',
    opens: '09:00',
    closes: '18:00',
  });
});
afterEach(() => store.close());

describe('agenda', () => {
  it('persists UTC, price and preparation time', () => {
    const id = bookAppointment(store, auth, booking(), date.minus({ days: 1 }));
    const row = tenantRow<{
      starts_at: string;
      busy_until: string;
      price_cents: number;
    }>(store, 'appointments', id, auth.business.id);
    expect(row.starts_at).toBe('2035-06-04T15:00:00.000Z');
    expect(row.busy_until).toBe('2035-06-04T16:00:00.000Z');
    expect(row.price_cents).toBe(35025);
  });
  it('rejects an overlapping appointment including the buffer', () => {
    bookAppointment(store, auth, booking());
    expect(() =>
      bookAppointment(store, auth, booking({ starts_at: '2035-06-04T09:50' })),
    ).toThrow('ocupado');
    expect(() =>
      bookAppointment(store, auth, booking({ starts_at: '2035-06-04T10:00' })),
    ).not.toThrow();
  });
  it('releases cancelled time', () => {
    const id = bookAppointment(store, auth, booking());
    changeStatus(store, auth, id, 'cancelled');
    expect(() => bookAppointment(store, auth, booking())).not.toThrow();
  });
  it('rejects closed days, past times and buffer after closing', () => {
    expect(() =>
      bookAppointment(store, auth, booking({ starts_at: '2035-06-05T09:00' })),
    ).toThrow('horario');
    expect(() =>
      bookAppointment(store, auth, booking(), date.plus({ minutes: 1 })),
    ).toThrow('futuro');
    expect(() =>
      bookAppointment(store, auth, booking({ starts_at: '2035-06-04T17:15' })),
    ).toThrow('horario');
  });
  it('requires enabled service and rejects blocks', () => {
    store.run('DELETE FROM staff_services');
    expect(() => bookAppointment(store, auth, booking())).toThrow('habilitado');
    store.run(
      'INSERT INTO staff_services VALUES (?,?,?)',
      staff,
      service,
      auth.business.id,
    );
    addBlock(store, auth, {
      staff_id: staff,
      starts_at: '2035-06-04T09:00',
      ends_at: '2035-06-04T10:00',
      reason: 'Descanso',
    });
    expect(() => bookAppointment(store, auth, booking())).toThrow('bloqueado');
  });
  it('keeps the old reservation when rescheduling fails', () => {
    const first = bookAppointment(store, auth, booking());
    bookAppointment(store, auth, booking({ starts_at: '2035-06-04T10:00' }));
    expect(() =>
      bookAppointment(
        store,
        auth,
        booking({ id: first, starts_at: '2035-06-04T10:00' }),
      ),
    ).toThrow();
    expect(
      tenantRow<{ starts_at: string }>(
        store,
        'appointments',
        first,
        auth.business.id,
      ).starts_at,
    ).toBe('2035-06-04T15:00:00.000Z');
  });
  it('does not allow early attendance or transitions from a closed appointment', () => {
    const id = bookAppointment(store, auth, booking());
    expect(() => changeStatus(store, auth, id, 'completed')).toThrow('hora');
    changeStatus(store, auth, id, 'cancelled');
    expect(() => changeStatus(store, auth, id, 'confirmed')).toThrow('cerrada');
  });
  it('rejects DST gaps and ambiguous local times', () => {
    expect(() => localDate('2035-03-11T02:30', 'America/New_York')).toThrow();
    expect(() => localDate('2035-11-04T01:30', 'America/New_York')).toThrow();
  });
  it('does not block a time with a contradictory exception', () => {
    bookAppointment(store, auth, booking());
    expect(() =>
      addBlock(store, auth, {
        staff_id: staff,
        starts_at: '2035-06-04T09:30',
        ends_at: '2035-06-04T10:30',
        reason: 'Descanso',
      }),
    ).toThrow('citas');
  });
});
describe('tenant isolation and validation', () => {
  it('rejects foreign clients and resources', () => {
    const foreign = fixtureWithoutUser(store);
    expect(() =>
      tenantRow(store, 'clients', client, foreign.business.id),
    ).toThrow('acceso');
    expect(() => bookAppointment(store, foreign, booking())).toThrow('acceso');
    expect(() =>
      saveClient(store, foreign, {
        id: client,
        name: 'Otra',
        phone: '+525555010101',
      }),
    ).toThrow('acceso');
  });
  it('enforces tenant-scoped foreign keys at the database level', () => {
    const foreign = fixtureWithoutUser(store);
    expect(() =>
      store.run(
        'INSERT INTO notes VALUES (?,?,?,?,?,?)',
        randomUUID(),
        foreign.business.id,
        client,
        auth.user.id,
        'Nota',
        now(),
      ),
    ).toThrow('FOREIGN KEY');
  });
  it('deduplicates phones within a business, allowing separate businesses', () => {
    expect(() =>
      saveClient(store, auth, { name: 'Otra', phone: '+525555010100' }),
    ).toThrow('ya pertenece');
    const foreign = fixtureWithoutUser(store);
    expect(() =>
      saveClient(store, foreign, { name: 'Valeria', phone: '+525555010100' }),
    ).not.toThrow();
  });
  it('prevents agents from changing services or schedules', () => {
    const agent = { ...auth, role: 'agent' } as AuthContext;
    expect(() =>
      saveService(store, agent, {
        name: 'Corte',
        duration: '30',
        price: '100',
      }),
    ).toThrow('administración');
    expect(() =>
      saveAvailability(store, agent, {
        staff_id: staff,
        weekday: '1',
        opens: '09:00',
        closes: '18:00',
      }),
    ).toThrow('administración');
  });
  it('normalizes real phones and exact decimal amounts', () => {
    expect(normalizePhone('+52 55 5501 0100')).toBe('+525555010100');
    expect(() => normalizePhone('5555010100')).toThrow('prefijo');
    expect(moneyInput('12.03')).toBe(1203);
    expect(() => moneyInput('0')).toThrow();
    expect(() => moneyInput('12.003')).toThrow();
  });
});
function fixtureWithoutUser(database: Store): AuthContext {
  const id = randomUUID();
  database.run(
    'INSERT INTO businesses VALUES (?,?,?,?,?)',
    id,
    'Otro',
    'America/Mexico_City',
    'MXN',
    now(),
  );
  database.run(
    'INSERT INTO memberships VALUES (?,?,?)',
    auth.user.id,
    id,
    'owner',
  );
  return { ...auth, business: { ...auth.business, id } };
}
describe('authentication', () => {
  it('hashes passwords and rejects incorrect passwords', async () => {
    const hash = await hashPassword('correcta-larga-123');
    expect(hash).not.toContain('correcta');
    expect(await checkPassword('correcta-larga-123', hash)).toBe(true);
    expect(await checkPassword('otra', hash)).toBe(false);
  });
  it('stores only session hashes and expires sessions', () => {
    const token = createSession(store, auth.user.id, auth.business.id);
    expect(resolveSession(store, token)?.business.id).toBe(auth.business.id);
    expect(
      store.get('SELECT * FROM sessions WHERE token_hash=?', token),
    ).toBeUndefined();
    store.run(
      'UPDATE sessions SET expires_at=? WHERE token_hash=?',
      '2000-01-01T00:00:00.000Z',
      digest(token),
    );
    expect(resolveSession(store, token)).toBeNull();
  });
  it('persists rate limits and creates an isolated business on registration', async () => {
    expect(rateLimit(store, 'test', 2)).toBe(true);
    expect(rateLimit(store, 'test', 2)).toBe(true);
    expect(rateLimit(store, 'test', 2)).toBe(false);
    const created = await register(store, {
      name: 'Nuevo',
      business: 'Nuevo negocio',
      email: 'nuevo@example.test',
      password: 'contraseña-larga-123',
      timezone: 'America/Mexico_City',
    });
    expect(created.businessId).not.toBe(auth.business.id);
    expect(
      store.get(
        'SELECT business_id FROM connections WHERE business_id=?',
        created.businessId,
      ),
    ).toBeDefined();
  });
});
describe('WhatsApp', () => {
  it('encrypts secrets and binds ciphertext to the business', () => {
    process.env.WHATSAPP_ENCRYPTION_KEY = 'a'.repeat(64);
    const cipher = encrypt('sesión secreta', auth.business.id);
    expect(cipher).not.toContain('secreta');
    expect(decrypt(cipher, auth.business.id)).toBe('sesión secreta');
    expect(() => decrypt(cipher, 'otro negocio')).toThrow();
    delete process.env.WHATSAPP_ENCRYPTION_KEY;
  });
  it('deduplicates incoming events and reuses a matching client', () => {
    const message = {
      key: {
        remoteJid: '525555010100@s.whatsapp.net',
        id: 'external1',
        fromMe: false,
      },
      message: { conversation: 'Hola' },
      messageTimestamp: 2000000000,
      pushName: 'Valeria WhatsApp',
    };
    ingestMessage(store, auth.business.id, message);
    ingestMessage(store, auth.business.id, message);
    expect(
      store.get<{ count: number }>('SELECT COUNT(*) count FROM messages')
        ?.count,
    ).toBe(1);
    expect(
      store.get<{ count: number }>('SELECT COUNT(*) count FROM clients')?.count,
    ).toBe(1);
  });
  it('ignores groups and protocol messages and never treats LIDs as phone numbers', () => {
    ingestMessage(store, auth.business.id, {
      key: { remoteJid: 'group@g.us', id: 'x' },
      message: { conversation: 'Grupo' },
    });
    ingestMessage(store, auth.business.id, {
      key: { remoteJid: 'abc@lid', id: 'lid1' },
      message: { conversation: 'Hola' },
    });
    expect(
      store.get<{ phone: string | null }>(
        "SELECT phone FROM clients WHERE source='WhatsApp'",
      )?.phone,
    ).toBeNull();
    expect(
      store.get<{ count: number }>('SELECT COUNT(*) count FROM messages')
        ?.count,
    ).toBe(1);
  });
});
it('preserves data after reopening and prevents concurrent reservations across processes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'auralogic-citas-concurrency-'));
  const path = join(directory, 'db.sqlite');
  let persistent: Store | undefined;
  try {
    persistent = new Store(path);
    const seeded = fixture(persistent);
    const c = saveClient(persistent, seeded, {
      name: 'Cliente',
      phone: '+525555010100',
    });
    const s = saveService(persistent, seeded, {
      name: 'Servicio',
      duration: '45',
      buffer: '15',
      price: '350',
    });
    const p = saveStaff(persistent, seeded, { name: 'Prestador' }, [s]);
    saveAvailability(persistent, seeded, {
      staff_id: p,
      weekday: '1',
      opens: '09:00',
      closes: '18:00',
    });
    const inputPath = join(directory, 'input.json');
    writeFileSync(
      inputPath,
      JSON.stringify({
        auth: seeded,
        input: {
          client_id: c,
          service_id: s,
          staff_id: p,
          starts_at: '2035-06-04T09:00',
        },
      }),
    );
    persistent.close();
    persistent = undefined;
    const exec = promisify(execFile);
    const args = ['--import', 'tsx', 'tests/fixtures/book.ts', path, inputPath];
    const results = await Promise.all([
      exec(process.execPath, args),
      exec(process.execPath, args),
    ]);
    expect(results.map((r) => r.stdout.trim()).sort()).toEqual([
      'conflict',
      'reserved',
    ]);
    persistent = new Store(path);
    expect(
      persistent.get<{ count: number }>(
        'SELECT COUNT(*) count FROM appointments',
      )?.count,
    ).toBe(1);
    expect(
      persistent.get('SELECT id FROM clients WHERE id=?', c),
    ).toBeDefined();
  } finally {
    persistent?.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);
