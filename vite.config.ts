import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // The preview tooling passes its own port when 5183 is already taken by another session.
  server: { host: true, port: Number(process.env.PORT) || 5183, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
});
