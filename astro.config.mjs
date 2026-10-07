import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 131072 }),
  vite: { ssr: { external: ['node:sqlite'] } },
  devToolbar: { enabled: false },
});
