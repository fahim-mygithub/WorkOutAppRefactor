/**
 * Swap candidates for an exercise, taken from the (merged) exercise library,
 * so the model can name a replacement the planner will actually resolve.
 */
import type { Exercise } from '../types/exercise';

/** Alternatives sent per workout exercise. */
export const ALTERNATIVES_LIMIT = 8;

const key = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

/** Everyday gym equipment (lower-case), preferred over bands, TRX and other niche kit. */
export const COMMON_EQUIPMENT: ReadonlySet<string> = new Set([
  'barbell', 'dumbbells', 'dumbbell', 'machine', 'cables', 'cable', 'kettlebells', 'kettlebell',
]);

/** Whether an exercise uses everyday gym equipment. */
export const usesCommonEquipment = (e: Pick<Exercise, 'equipment'>): boolean => COMMON_EQUIPMENT.has(key(e.equipment));

/**
 * Words that name kit, not movement. Also every word of the library's own
 * equipment values ("Smith-Machine" → smith, machine) is added at run time.
 */
const EQUIPMENT_WORDS: ReadonlySet<string> = new Set([
  'barbell', 'barbells', 'dumbbell', 'dumbbells', 'machine', 'machines', 'cable', 'cables',
  'kettlebell', 'kettlebells', 'band', 'bands', 'bodyweight', 'smith', 'plate', 'plates', 'trx',
  'bosu', 'ball', 'vitruvian', 'landmine', 'bar', 'rope', 'weighted', 'assisted',
]);

/**
 * Filler that says nothing about the movement. Kept deliberately small:
 * joiners ("with", "and", "the", "for") and the one/single-limb modifiers.
 * "arm" and "leg" are NOT stopwords ("Leg Press", "Arm Curl" name the
 * movement); only the phrases "single arm", "one leg", "single legged" etc.
 * are dropped, so two unrelated single-arm lifts don't match on "arm".
 */
const STOPWORDS: ReadonlySet<string> = new Set(['with', 'and', 'the', 'for']);
const LIMB_MODIFIER = /\b(?:single|one|1)[\s-]+(?:arm|leg|legged|armed)\b/g;

/** The movement words of a name: lower-case, 3+ letters, no kit or filler. */
function movementWords(name: string, kit: ReadonlySet<string>): Set<string> {
  const words = key(name).replace(LIMB_MODIFIER, ' ').split(/[^\p{L}\p{N}]+/u);
  return new Set(words.filter((w) => w.length >= 3 && !kit.has(w) && !STOPWORDS.has(w)));
}

/** An exercise's muscle groups, lower-cased, minus equipment tags ("Barbell", "Cables"). */
function musclesOf(e: Exercise, equipment: ReadonlySet<string>): Set<string> {
  const groups = e.muscleGroups ?? (e.muscleGroup ?? '').split(',');
  return new Set(groups.map(key).filter((g) => g && !equipment.has(g)));
}

/**
 * Up to `limit` library names that share at least one muscle group or one
 * movement word with `exercise` and are not the exercise itself. Order: most
 * shared movement words ("bench", "press") first, then most shared muscles,
 * then other equipment before the same equipment, then common equipment
 * before niche kit, then shorter names, then by name.
 */
export function swapAlternatives(
  exercise: Exercise,
  library: readonly Exercise[],
  limit = ALTERNATIVES_LIMIT,
): string[] {
  const equipment = new Set<string>([key(exercise.equipment)]);
  for (const e of library) if (e.equipment) equipment.add(key(e.equipment));
  equipment.delete('');
  const kit = new Set(EQUIPMENT_WORDS);
  for (const e of equipment) for (const w of e.split(/[^\p{L}\p{N}]+/u)) if (w) kit.add(w);

  const own = musclesOf(exercise, equipment);
  const ownWords = movementWords(exercise.name ?? '', kit);
  if (own.size === 0 && ownWords.size === 0) return [];
  const ownName = key(exercise.name);
  const ownEquipment = key(exercise.equipment);

  const seen = new Set<string>();
  const scored: { name: string; shared: number; overlap: number; sameEquipment: boolean; niche: boolean }[] = [];
  for (const e of library) {
    const name = key(e.name);
    if (!name || name === ownName || e.id === exercise.id || seen.has(name)) continue;
    let overlap = 0;
    for (const m of musclesOf(e, equipment)) if (own.has(m)) overlap++;
    let shared = 0;
    for (const w of movementWords(e.name, kit)) if (ownWords.has(w)) shared++;
    if (overlap === 0 && shared === 0) continue;
    seen.add(name);
    scored.push({
      name: e.name,
      shared,
      overlap,
      sameEquipment: !!ownEquipment && key(e.equipment) === ownEquipment,
      niche: !usesCommonEquipment(e),
    });
  }
  scored.sort(
    (a, b) =>
      b.shared - a.shared ||
      b.overlap - a.overlap ||
      Number(a.sameEquipment) - Number(b.sameEquipment) ||
      Number(a.niche) - Number(b.niche) ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name, 'en'),
  );
  return scored.slice(0, limit).map((s) => s.name);
}
