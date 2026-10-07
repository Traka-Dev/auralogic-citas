import { db } from '../src/lib/db';
const store = db();
console.info('Migraciones aplicadas.');
store.close();
