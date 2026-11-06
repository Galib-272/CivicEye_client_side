// MapLibre loads its rendering worker from a URL next to its own module, which no longer
// exists once Next.js bundles the library. Serve the installed version's worker from
// public/ instead (see location-map.tsx). Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
  'maplibre-gl-worker.mjs',
);
const target = join(import.meta.dirname, '..', 'public', 'vendor', 'maplibre-gl-worker.mjs');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
