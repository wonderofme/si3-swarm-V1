// Patch zod's package.json to add export subpaths (./v3, ./v4, ./v4/core)
// expected by some dependencies (e.g. langchain, zod-to-json-schema).
// This is a small compatibility shim until upstream libraries update.

import fs from 'fs';
import path from 'path';

const pkgPath = path.join(process.cwd(), 'node_modules', 'zod', 'package.json');

try {
  if (!fs.existsSync(pkgPath)) {
    console.warn('[patch-zod] zod package.json not found, skipping.');
    process.exit(0);
  }

  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);

  if (!pkg.exports) {
    console.log('[patch-zod] No exports field on zod, skipping patch.');
    process.exit(0);
  }

  const rootExport = pkg.exports['.'];
  if (!rootExport) {
    console.warn('[patch-zod] No root export found on zod, cannot infer subpath mappings.');
    process.exit(0);
  }

  const ensureSubpath = (subpath) => {
    if (!pkg.exports[subpath]) {
      pkg.exports[subpath] = {
        types: rootExport.types || './index.d.ts',
        require: rootExport.require || './lib/index.js',
        import: rootExport.import || './lib/index.mjs'
      };
      console.log(`[patch-zod] Added ${subpath} export subpath to zod package.json`);
    }
  };

  ensureSubpath('./v3');
  ensureSubpath('./v4');
  ensureSubpath('./v4/core');

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
} catch (err) {
  console.error('[patch-zod] Failed to patch zod package.json', err);
  process.exit(0); // Don't fail install because of this
}

