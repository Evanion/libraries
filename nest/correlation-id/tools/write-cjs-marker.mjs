// The package has no top-level "type", so Node treats .js as CommonJS by
// default -- which is what dist/cjs needs. dist/esm therefore has to opt in
// explicitly, or Node parses the ESM output as CommonJS and fails on `import`.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const esm = join(import.meta.dirname, '..', 'dist', 'esm');
if (!existsSync(esm)) {
  console.error('dist/esm missing -- did the ESM build run?');
  process.exit(1);
}
writeFileSync(join(esm, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
console.log('wrote dist/esm/package.json (type: module)');
