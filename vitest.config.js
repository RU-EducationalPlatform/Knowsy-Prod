import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Most widgets touch the DOM, so default to a browser-like environment.
    // happy-dom is faster than jsdom and covers everything we need.
    environment: 'happy-dom',
    globals: true,
    include: ['**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', '.firebase', 'infra/functions'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**', 'util/**', 'modules/**'],
      exclude: ['**/*.test.js', '**/*.spec.js', 'modules/docs/**', 'modules/legacy/**', 'vendor/**'],
    },
  },
});
