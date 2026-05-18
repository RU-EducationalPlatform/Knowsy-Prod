import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.firebase/**',
      '.vite/**',
      'vendor/**',
      'infra/functions/lib/**',
      'modules/legacy/**',
      'server/.venv/**',
      'server/**/*.py',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // The textbook app loads marked + DOMPurify as classic globals.
        marked: 'readonly',
        DOMPurify: 'readonly',
        // d3 (and topojson, used by world-map widgets) are loaded via the
        // vendored builds or a CDN <script src> on legacy pages, then accessed
        // as window globals from src/ui/GraphView.js and friends.
        d3: 'readonly',
        topojson: 'readonly',
      },
    },
    rules: {
      // Student-friendly defaults: catch real bugs, don't nag about style.
      // Style is Prettier's job; this file is only for correctness rules.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-prototype-builtins': 'off',
      'no-inner-declarations': 'off',
      // Demoted to warnings: the legacy textbook code intentionally uses both
      // (escape chars in JSON strings, control chars in tokenizers). Warning
      // keeps them visible without breaking CI.
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      'require-yield': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vitest's globals (we set globals: true in vitest.config.js).
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
];
