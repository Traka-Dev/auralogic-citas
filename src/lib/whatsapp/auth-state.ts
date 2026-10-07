import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import type { Store } from '../db';
import { encrypt, decrypt } from './crypto';

export function authState(store: Store, businessId: string) {
  const read = <T>(key: string): T | undefined => {
    const row = store.get<{ cipher: string }>(
      'SELECT cipher FROM wa_auth WHERE business_id=? AND key=?',
      businessId,
      key,
    );
    return row
      ? (JSON.parse(
          decrypt(row.cipher, `${businessId}:${key}`),
          BufferJSON.reviver,
        ) as T)
      : undefined;
  };
  const write = (key: string, value: unknown) => {
    if (value === null)
      store.run(
        'DELETE FROM wa_auth WHERE business_id=? AND key=?',
        businessId,
        key,
      );
    else
      store.run(
        'INSERT INTO wa_auth VALUES (?,?,?) ON CONFLICT(business_id,key) DO UPDATE SET cipher=excluded.cipher',
        businessId,
        key,
        encrypt(
          JSON.stringify(value, BufferJSON.replacer),
          `${businessId}:${key}`,
        ),
      );
  };
  const state: AuthenticationState = {
    creds: read<AuthenticationState['creds']>('creds') || initAuthCreds(),
    keys: {
      get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]) {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          let value = read<SignalDataTypeMap[T]>(`${type}:${id}`);
          if (type === 'app-state-sync-key' && value)
            value = proto.Message.AppStateSyncKeyData.fromObject(
              value,
            ) as unknown as SignalDataTypeMap[T];
          if (value) data[id] = value;
        }
        return data;
      },
      set(data) {
        store.transaction(() => {
          for (const [type, entries] of Object.entries(data))
            for (const [id, value] of Object.entries(entries || {}))
              write(`${type}:${id}`, value);
        });
      },
    },
  };
  return { state, save: () => write('creds', state.creds) };
}
