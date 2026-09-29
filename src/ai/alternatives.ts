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

/** An exercise's muscle groups, lower-cased, minus equipment tags ("Barbell", "Cables"). */
function musclesOf(e: Exercise, equipment: ReadonlySet<string>): Set<string> {
  const groups = e.muscleGroups ?? (e.muscleGroup ?? '').split(',');
  return new Set(groups.map(key).filter((g) => g && !equipment.has(g)));
}

/**
 * Up to `limit` library names that share at least one muscle group with
 * `exercise` and are not the exercise itself. Order: most shared muscles
 * first, then other equipment before the same equipment, then common
 * equipment before niche kit, then shorter names, then by name.
 */
export function swapAlternatives(
  exercise: Exercise,
  library: readonly Exercise[],
  limit = ALTERNATIVES_LIMIT,
): string[] {
  const equipment = new Set<string>([key(exercise.equipment)]);
  for (const e of library) if (e.equipment) equipment.add(key(e.equipment));
  equipment.delete('');

  const own = musclesOf(exercise, equipment);
  if (own.size === 0) return [];
  const ownName = key(exercise.name);
  const ownEquipment = key(exercise.equipment);

  const seen = new Set<string>();
  const scored: { name: string; overlap: number; sameEquipment: boolean; niche: boolean }[] = [];
  for (const e of library) {
    const name = key(e.name);
    if (!name || name === ownName || e.id === exercise.id || seen.has(name)) continue;
    let overlap = 0;
    for (const m of musclesOf(e, equipment)) if (own.has(m)) overlap++;
    if (overlap === 0) continue;
    seen.add(name);
    scored.push({
      name: e.name,
      overlap,
      sameEquipment: !!ownEquipment && key(e.equipment) === ownEquipment,
      niche: !usesCommonEquipment(e),
    });
  }
  scored.sort(
    (a, b) =>
      b.overlap - a.overlap ||
      Number(a.sameEquipment) - Number(b.sameEquipment) ||
      Number(a.niche) - Number(b.niche) ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name, 'en'),
  );
  return scored.slice(0, limit).map((s) => s.name);
}
