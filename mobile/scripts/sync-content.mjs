#!/usr/bin/env node
/**
 * Copies the website's canonical content (../content/*.json) into
 * src/data/ so the app ships with a bundled offline fallback catalogue.
 *
 * The live app always tries `${API_BASE}/catalogue.json` first; these
 * bundled copies are only used when the network is unavailable.
 *
 * Run after any content change:  npm run sync-content
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../content');
const target = resolve(here, '../src/data');

mkdirSync(target, { recursive: true });

const files = readdirSync(source).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`No JSON files found in ${source}`);
  process.exit(1);
}

for (const file of files) {
  // Validate JSON before copying so a broken content file fails loudly.
  JSON.parse(readFileSync(join(source, file), 'utf8'));
  copyFileSync(join(source, file), join(target, file));
  console.log(`synced ${file}`);
}

