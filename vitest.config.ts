import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/auth.ts',
        'src/lib/crm.ts',
        'src/lib/db.ts',
        'src/lib/whatsapp/crypto.ts',
        'src/lib/whatsapp/messages.ts',
      ],
    },
  },
});
