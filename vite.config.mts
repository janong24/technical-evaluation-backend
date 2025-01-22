import { defineConfig } from 'vite';

import devServer from '@hono/vite-dev-server';
import nodeAdapter from '@hono/vite-dev-server/node';
import build from '@hono/vite-build/node';

export default defineConfig({
  plugins: [
    devServer({
      entry: "src/index.ts",
      adapter: nodeAdapter,
    }),
    build({
      entry: "src/index.ts",
      output: "index.mjs",
      port: 3000,
    }),
  ],
});
