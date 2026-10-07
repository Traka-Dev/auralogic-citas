import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const migrations = [
  `
  CREATE TABLE businesses (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MXN', created_at TEXT NOT NULL
  );
  CREATE TABLE users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE memberships (
    user_id TEXT NOT NULL REFERENCES users(id), business_id TEXT NOT NULL REFERENCES businesses(id),
    role TEXT NOT NULL CHECK(role IN ('owner','admin','agent')), PRIMARY KEY(user_id,business_id)
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, business_id TEXT NOT NULL,
    expires_at TEXT NOT NULL, FOREIGN KEY(user_id,business_id) REFERENCES memberships(user_id,business_id)
  );
  CREATE TABLE rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, resets_at INTEGER NOT NULL);
  CREATE TABLE invites (
    token_hash TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
    email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','agent')),
    expires_at TEXT NOT NULL, used_at TEXT
  );
  CREATE TABLE clients (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), name TEXT NOT NULL,
    phone TEXT, email TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'Manual', archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, UNIQUE(id,business_id), UNIQUE(business_id,phone)
  );
  CREATE TABLE notes (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id), content TEXT NOT NULL, created_at TEXT NOT NULL,
    FOREIGN KEY(client_id,business_id) REFERENCES clients(id,business_id)
  );
  CREATE TABLE staff (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#367a68', active INTEGER NOT NULL DEFAULT 1, UNIQUE(id,business_id)
  );
  CREATE TABLE availability (
    staff_id TEXT NOT NULL, business_id TEXT NOT NULL, weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
    opens TEXT NOT NULL, closes TEXT NOT NULL, PRIMARY KEY(staff_id,weekday),
    FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id)
  );
  CREATE TABLE services (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), name TEXT NOT NULL,
    duration INTEGER NOT NULL CHECK(duration BETWEEN 5 AND 480),
    buffer INTEGER NOT NULL DEFAULT 0 CHECK(buffer BETWEEN 0 AND 120),
    price_cents INTEGER NOT NULL CHECK(price_cents >= 0), active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(id,business_id)
  );
  CREATE TABLE staff_services (
    staff_id TEXT NOT NULL, service_id TEXT NOT NULL, business_id TEXT NOT NULL,
    PRIMARY KEY(staff_id,service_id),
    FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id),
    FOREIGN KEY(service_id,business_id) REFERENCES services(id,business_id)
  );
  CREATE TABLE blocks (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, staff_id TEXT NOT NULL,
    starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, reason TEXT NOT NULL,
    CHECK(ends_at > starts_at), FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id)
  );
  CREATE TABLE appointments (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT NOT NULL,
    service_id TEXT NOT NULL, staff_id TEXT NOT NULL, starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL, busy_until TEXT NOT NULL, price_cents INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','confirmed','completed','cancelled','no_show')),
    notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(id,business_id),
    FOREIGN KEY(client_id,business_id) REFERENCES clients(id,business_id),
    FOREIGN KEY(service_id,business_id) REFERENCES services(id,business_id),
    FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id), CHECK(ends_at > starts_at)
  );
  CREATE INDEX appointments_schedule ON appointments(business_id,staff_id,starts_at,busy_until);
  CREATE TABLE appointment_events (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, appointment_id TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id), description TEXT NOT NULL, created_at TEXT NOT NULL,
    FOREIGN KEY(appointment_id,business_id) REFERENCES appointments(id,business_id)
  );
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, due_at TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(client_id,business_id) REFERENCES clients(id,business_id)
  );
  CREATE TABLE payments (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, appointment_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), created_at TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id),
    FOREIGN KEY(appointment_id,business_id) REFERENCES appointments(id,business_id)
  );
  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
    author_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE connections (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id),
    desired INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'disconnected',
    qr_cipher TEXT, qr_expires_at TEXT, heartbeat_at TEXT, phone TEXT
  );
  CREATE TABLE wa_auth (
    business_id TEXT NOT NULL REFERENCES businesses(id), key TEXT NOT NULL, cipher TEXT NOT NULL,
    PRIMARY KEY(business_id,key)
  );
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT NOT NULL,
    jid TEXT NOT NULL, assigned_to TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'open',
    updated_at TEXT NOT NULL, UNIQUE(id,business_id), UNIQUE(business_id,jid),
    FOREIGN KEY(client_id,business_id) REFERENCES clients(id,business_id)
  );
  CREATE TABLE messages (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
    external_id TEXT, direction TEXT NOT NULL CHECK(direction IN ('in','out')),
    body TEXT NOT NULL, status TEXT NOT NULL, author_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL, UNIQUE(business_id,conversation_id,external_id),
    FOREIGN KEY(conversation_id,business_id) REFERENCES conversations(id,business_id)
  );
  CREATE INDEX messages_history ON messages(business_id,conversation_id,created_at);
  CREATE TABLE worker_lock (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `,
];

export type SqlParams = SQLInputValue[];

export class Store {
  readonly connection: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:')
      mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    this.connection = new DatabaseSync(path);
    this.connection.exec(
      'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
    );
    this.migrate();
  }
  migrate() {
    this.connection.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    migrations.forEach((sql, index) => {
      this.transaction(() => {
        if (
          !this.get(
            'SELECT version FROM schema_migrations WHERE version=?',
            index + 1,
          )
        ) {
          this.connection.exec(sql);
          this.run(
            'INSERT INTO schema_migrations VALUES (?,?)',
            index + 1,
            new Date().toISOString(),
          );
        }
      });
    });
  }
  get<T>(sql: string, ...params: SqlParams): T | undefined {
    return this.connection.prepare(sql).get(...params) as T | undefined;
  }
  all<T>(sql: string, ...params: SqlParams): T[] {
    return this.connection.prepare(sql).all(...params) as T[];
  }
  run(sql: string, ...params: SqlParams) {
    return this.connection.prepare(sql).run(...params);
  }
  transaction<T>(fn: () => T): T {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.connection.exec('COMMIT');
      return result;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.connection.close();
  }
}

let instance: Store | undefined;
export function db(): Store {
  return (instance ??= new Store(
    process.env.DATABASE_PATH || './data/auralogic-citas.sqlite',
  ));
}
