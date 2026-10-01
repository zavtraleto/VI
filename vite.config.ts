import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { host: true, port: 5183, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
});
