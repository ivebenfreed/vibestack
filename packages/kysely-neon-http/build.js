import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'fs';

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist');
}

// Build ESM
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: false,
  sourcemap: true,
  format: 'esm',
  target: 'node18',
  platform: 'node',
  outfile: 'dist/index.js',
  external: ['kysely', '@neondatabase/serverless'],
});

// Build CJS
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: false,
  sourcemap: true,
  format: 'cjs',
  target: 'node18',
  platform: 'node',
  outfile: 'dist/index.cjs',
  external: ['kysely', '@neondatabase/serverless'],
});

console.log('✅ Build complete!');