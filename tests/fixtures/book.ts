import { readFileSync } from 'node:fs';
import { Store } from '../../src/lib/db';
import { bookAppointment } from '../../src/lib/crm';
import type { AuthContext } from '../../src/lib/auth';
const store = new Store(process.argv[2]!);
const { auth, input } = JSON.parse(readFileSync(process.argv[3]!, 'utf8')) as {
  auth: AuthContext;
  input: Record<string, string>;
};
try {
  bookAppointment(store, auth, input);
  console.info('reserved');
} catch {
  console.info('conflict');
} finally {
  store.close();
}
