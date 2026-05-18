import { defineConfig } from 'vite';
import { resolve, relative } from 'node:path';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

// The calibration page dynamic-imports modules/screening-tests/ColorBlindTest.js
// at runtime, and various pages fetch from /data and /vendor. Vite can't
// statically analyze runtime-computed paths, so we copy these trees into
// dist verbatim after the build.
function copyRuntimeAssets() {
  return {
    name: 'knowsy:copy-runtime-assets',
    apply: 'build',
    closeBundle() {
      const root = __dirname;
      const out = resolve(root, 'dist');
      const dirs = ['modules', 'util', 'vendor', 'data', 'assets'];
      const files = ['sw.js'];
      for (const d of dirs) {
        const src = resolve(root, d);
        if (existsSync(src)) cpSync(src, resolve(out, d), { recursive: true });
      }
      for (const f of files) {
        const src = resolve(root, f);
        if (existsSync(src)) cpSync(src, resolve(out, f));
      }
    },
  };
}

// Scans modules/**/*.js for `export const STATUS = '...'` declarations and
// exposes the resulting manifest via the virtual module `virtual:knowsy-released`.
//
// A widget marks itself ready for production by adding ONE line near the top:
//
//   export const STATUS = 'done';
//
// Files that don't declare a STATUS default to 'wip' and are hidden in prod.
//
// The plugin re-scans on every file change in dev so flipping a module's
// status during development reflects immediately without a server restart.
function statusManifestPlugin() {
  const VIRTUAL_ID = 'virtual:knowsy-released';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  // export const STATUS = 'done' / "done" / `done`. Stops at the next quote.
  const STATUS_RE = /export\s+const\s+STATUS\s*=\s*['"`]([^'"`]+)['"`]/;
  const SKIP = new Set(['legacy', 'docs', 'node_modules']);
  let manifest = null;
  let server = null;

  function walk(dir, root, into) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('_') || entry.startsWith('.') || SKIP.has(entry)) continue;
      const full = resolve(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full, root, into);
      } else if (entry.endsWith('.js') && !entry.endsWith('.test.js') && !entry.endsWith('.spec.js')) {
        // Read at most the first 4 KB — STATUS should be near the top.
        const head = readFileSync(full, 'utf8').slice(0, 4096);
        const m = STATUS_RE.exec(head);
        const status = m ? m[1].toLowerCase() : 'wip';
        // Key uses ./modules/... to match the registry's `src` field exactly.
        const key = './' + relative(root, full).split('\\').join('/');
        into[key] = status;
      }
    }
  }

  function scan() {
    const root = __dirname;
    const out = {};
    const modulesDir = resolve(root, 'modules');
    if (existsSync(modulesDir)) walk(modulesDir, root, out);
    return out;
  }

  return {
    name: 'knowsy:status-manifest',
    buildStart() { manifest = scan(); },
    configureServer(s) {
      server = s;
      manifest = scan();
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return `export default ${JSON.stringify(manifest ?? {}, null, 2)};\n`;
      }
    },
    handleHotUpdate({ file, server: s }) {
      if (file.includes('/modules/') && file.endsWith('.js')) {
        manifest = scan();
        const mod = (s ?? server)?.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          (s ?? server).moduleGraph.invalidateModule(mod);
          (s ?? server).ws.send({ type: 'full-reload' });
        }
      }
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [statusManifestPlugin(), copyRuntimeAssets()],
  server: {
    port: 5173,
    open: '/',
    proxy: {
      // Knowsy compute server (server/main.py): SymPy solver + OlmoOCR2 OCR.
      // Start it with `bash server/start.sh` before booting the dev server.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        app: resolve(__dirname, 'app.html'),
        calibrate: resolve(__dirname, 'calibrate.html'),
        profile: resolve(__dirname, 'profile.html'),
        solarSystem: resolve(__dirname, 'solar-system.html'),
        periodicTable: resolve(__dirname, 'periodic-table.html'),
      },
    },
  },
});
