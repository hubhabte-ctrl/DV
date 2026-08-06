/**
 * codemod-engine-imports.cjs
 * Plan 06 §3.4 / line 209 — rewrite all consumers of the pre-move engine shims
 * (`../engine/commands`, `../engine/store`, `../engine/evaluator`) to the new
 * physical package `@bs/engine`.
 *
 * Governs: `src/**` and `packages/**` (except `packages/engine/src/**` itself).
 * Preserves `src/engine/progress.ts` shim (that one routes to @bs/runtime and
 * has no physical move planned in this phase).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..'); // frontend/
const TARGET_DIRS = [path.join(root, 'src'), path.join(root, 'packages')];
const SKIP_DIRS = [
  path.join(root, 'packages/engine/src'),   // the package owning the API
  path.join(root, 'src/engine'),            // legacy shim tree — deleted after codemod
  path.join(root, 'node_modules'),
  path.join(root, 'dist'),
];

// Matches any relative path segment `./` or `../` (one or more times) followed
// by `engine/(commands|store|evaluator)` — the pre-move shim locations.
// Supports both single- and double-quoted specifiers, and the optional
// `/index` suffix on the commands barrel.
const REL = String.raw`(?:\.{1,2}\/)+`;
const TAIL = String.raw`engine\/(?:commands(?:\/index)?|store|evaluator)`;

const REPLACEMENTS = [
  { from: new RegExp(`from\\s+'${REL}${TAIL}'`, 'g'), to: "from '@bs/engine'" },
  { from: new RegExp(`from\\s+"${REL}${TAIL}"`, 'g'), to: 'from "@bs/engine"' },
];

function shouldSkip(fp) {
  return SKIP_DIRS.some((d) => fp.startsWith(d));
}

function collectFiles(dir, out = []) {
  if (shouldSkip(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (shouldSkip(full)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = TARGET_DIRS.flatMap((d) => collectFiles(d));
let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;
  let count = 0;
  for (const { from, to } of REPLACEMENTS) {
    updated = updated.replace(from, (m) => {
      count++;
      return to;
    });
  }
  if (count > 0) {
    totalFiles++;
    totalReplacements += count;
    const rel = file.replace(root + path.sep, '');
    console.log(`  ${count.toString().padStart(3)}  ${rel}`);
    fs.writeFileSync(file, updated, 'utf8');
  }
}

console.log(`\n[codemod] Updated ${totalFiles} files, ${totalReplacements} replacements total.`);
