// Build-time generator: reads the raw exercise CSV, consolidates the ~5343 rows
// into the unique `Exercise[]` (~52 entries) with precomputed search keywords,
// and writes public/exercises.json. Run via `npm run data:build` (and prebuild).
//
// This replaces the old runtime path that shipped the 3 MB CSV and parsed it
// client-side with papaparse on every cold start. papaparse is only used here,
// at build time, never in the client bundle.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Papa from 'papaparse';
import { consolidateExercises } from './consolidate-exercises.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'scripts', 'data', 'muscle_exercises.csv');
const OUT_PATH = path.join(ROOT, 'public', 'exercises.json');

const csvContent = readFileSync(CSV_PATH, 'utf-8');

const result = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
});

if (result.errors && result.errors.length > 0) {
  console.warn(`papaparse reported ${result.errors.length} row error(s); first:`, result.errors[0]);
}

const exercises = consolidateExercises(result.data);

writeFileSync(OUT_PATH, JSON.stringify(exercises, null, 2) + '\n', 'utf-8');

console.log(
  `Wrote ${exercises.length} consolidated exercises to ${path.relative(ROOT, OUT_PATH)} ` +
    `(from ${result.data.length} CSV rows).`
);
