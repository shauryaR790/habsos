import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('api', { recursive: true });

await build({
  entryPoints: ['server/vercel.ts'],
  outfile: 'api/[...path].js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  packages: 'external',
  legalComments: 'none',
  footer: { js: 'module.exports = handler; module.exports.maxDuration = maxDuration;' },
});
