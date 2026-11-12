/**
 * The Build screen's draft as the assistant reads and edits it.
 *
 * Build is text-driven: the lifter types (or the assistant loads) parser-format
 * lines like "3x8 Bench Press @135lbs", and the existing parser turns them into
 * the preview. So an assistant edit is a TEXT edit of one line, which the page
 * then re-parses; nothing here touches the page's state. Pure functions only.
 *
 * Lines are read one at a time, so an edit changes exactly one line and leaves
 * the rest of what the lifter typed as it was. Exercises inside a superset
 * line ("A ss B") are listed but not editable here.
 */
import { WorkoutParser } from '../parser/workoutParser';
import type { ParsedExercise, ParsedSet } from '../parser/types';
import { exerciseLine } from './workoutText';

/** Most characters of the draft text the assistant is shown. */
export const DRAFT_TEXT_CAP = 2_000;
const MAX_ISSUES = 5;

/** What the assistant may ask to change on one exercise line. */
export interface DraftChange {
  sets?: number;
  reps?: number;
  /** Top of a rep range (reps is the bottom). */
  repsMax?: number;
  /** Load per set; 0 clears it. */
  weight?: number;
  unit?: 'lbs' | 'kg';
}

/** One exercise as the assistant sees it. */
export interface DraftExercise {
  name: string;
  sets: number;
  /** "8" or "8-12". */
  reps: string;
  weight?: number;
  unit?: 'lbs' | 'kg';
  /** Part of a superset line: listed, not editable by the Build tools. */
  superset?: boolean;
}

export interface DraftReading {
  exercises: DraftExercise[];
  /** Lines the parser could not read as sets x reps (at most 5). */
  issues: string[];
}

interface DraftLine {
  /** Index in the text's line array. */
  at: number;
  raw: string;
  exercises: ParsedExercise[];
  superset: boolean;
  /** The parser had to fall back to "name only, 10 reps". */
  guessed: boolean;
}

/** Lower-case words with punctuation dropped: "Pull-Up " → "pull up". */
export const normalName = (s: string): string =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const parser = new WorkoutParser();

function readLines(text: string): DraftLine[] {
  const out: DraftLine[] = [];
  text.split('\n').forEach((raw, at) => {
    const line = raw.trim();
    if (!line) return;
    const result = parser.parse(line);
    if (!result.success || !result.workout) return;
    const { exercises, supersets } = result.workout;
    const group = supersets[0];
    out.push({
      at,
      raw,
      exercises: group ?? exercises,
      superset: !!group,
      guessed: result.warnings.some((w) => w.includes('Treating')),
    });
  });
  return out;
}

const repsText = (set?: ParsedSet): string => {
  if (!set) return '10';
  return typeof set.reps === 'number' ? `${set.reps}` : `${set.reps.min}-${set.reps.max}`;
};

/** The exercises on the draft's lines, in line order, and the lines that read as guesses. */
export function readDraft(text: string): DraftReading {
  const exercises: DraftExercise[] = [];
  const issues: string[] = [];
  for (const line of readLines(text)) {
    if (line.guessed && issues.length < MAX_ISSUES) {
      issues.push(`"${line.raw.trim().slice(0, 60)}" has no sets x reps; read as 10 reps`);
    }
    for (const e of line.exercises) {
      const first = e.sets[0];
      exercises.push({
        name: e.name,
        sets: e.sets.length,
        reps: repsText(first),
        ...(first?.weight ? { weight: first.weight, unit: first.unit ?? 'lbs' } : {}),
        ...(line.superset ? { superset: true } : {}),
      });
    }
  }
  return { exercises, issues };
}

/** The draft text the assistant is shown: the first `DRAFT_TEXT_CAP` characters. */
export const draftTextForAi = (text: string): string => text.slice(0, DRAFT_TEXT_CAP);

/** The new text, the exercise it is about and its line (the removed one, for a removal). */
export type DraftEdit = { ok: true; text: string; name: string; line: string } | { ok: false; reason: string };

const fail = (reason: string): DraftEdit => ({ ok: false, reason });

/** An exercise's line from its first set's values, `sets` times. */
function lineFor(name: string, sets: number, set: ParsedSet): string {
  return exerciseLine({ name, sets: Array.from({ length: sets }, () => ({ ...set })) });
}

/** The set a change describes, starting from `base` (the line's first set). */
function changedSet(base: ParsedSet | undefined, change: DraftChange, defaultUnit: 'lbs' | 'kg'): ParsedSet {
  const set: ParsedSet = { reps: base?.reps ?? 10 };
  if (change.reps !== undefined) {
    set.reps = change.repsMax !== undefined ? { min: change.reps, max: change.repsMax } : change.reps;
  }
  const weight = change.weight !== undefined ? change.weight : base?.weight;
  if (weight && weight > 0) {
    set.weight = weight;
    set.unit = change.unit ?? base?.unit ?? defaultUnit;
  }
  return set;
}

/**
 * The one straight (non-superset) line an exercise name means: its name
 * equals `asked` once spelling is normalised (or `same` says they are the same
 * library exercise), else the only line containing every word of it.
 */
function findLine(
  lines: DraftLine[],
  asked: string,
  same: (a: string, b: string) => boolean,
): DraftLine | string {
  const key = normalName(asked);
  if (!key) return 'No exercise was named.';
  const nameOf = (l: DraftLine) => l.exercises[0].name;
  const matches = (pick: (l: DraftLine) => boolean): DraftLine[] => lines.filter(pick);
  const exact = matches((l) => l.exercises.some((e) => normalName(e.name) === key || same(e.name, asked)));
  const words = key.split(' ').filter(Boolean);
  const loose = exact.length
    ? exact
    : matches((l) => {
        const own = new Set(l.exercises.flatMap((e) => normalName(e.name).split(' ')));
        return words.every((w) => own.has(w));
      });
  if (loose.length === 0) return `"${asked}" is not in the Build draft.`;
  if (loose.length > 1) return `"${asked}" matches more than one exercise in the Build draft.`;
  const line = loose[0];
  if (line.superset) {
    return `"${nameOf(line)}" is in a superset line; change it in the Visual tab.`;
  }
  return line;
}

const splitLines = (text: string): string[] => text.split('\n');

/**
 * Changes sets / reps / weight / unit of one exercise's line. `same` tells
 * whether two names are the same library exercise (so "Bench Press" finds
 * "Barbell Bench Press"); `defaultUnit` is the lifter's unit for a first weight.
 */
export function editDraftExercise(
  text: string,
  asked: string,
  change: DraftChange,
  opts: { same?: (a: string, b: string) => boolean; defaultUnit?: 'lbs' | 'kg' } = {},
): DraftEdit {
  const lines = readLines(text);
  const found = findLine(lines, asked, opts.same ?? (() => false));
  if (typeof found === 'string') return fail(found);
  const exercise = found.exercises[0];
  const first = exercise.sets[0];
  const next = lineFor(
    exercise.name,
    change.sets ?? exercise.sets.length,
    changedSet(first, change, opts.defaultUnit ?? 'lbs'),
  );
  if (next === exerciseLine(exercise)) return fail(`${exercise.name} is already like that.`);
  const all = splitLines(text);
  all[found.at] = next;
  return { ok: true, text: all.join('\n'), name: exercise.name, line: next };
}

/** Appends one exercise line (the name is the library's). Refuses a name already in the draft. */
export function addDraftExercise(
  text: string,
  name: string,
  change: DraftChange,
  opts: { same?: (a: string, b: string) => boolean; defaultUnit?: 'lbs' | 'kg' } = {},
): DraftEdit {
  const same = opts.same ?? (() => false);
  const key = normalName(name);
  const present = readLines(text).some((l) =>
    l.exercises.some((e) => normalName(e.name) === key || same(e.name, name)),
  );
  if (present) return fail(`${name} is already in the Build draft; change it instead.`);
  const line = lineFor(
    name,
    change.sets ?? 3,
    changedSet(undefined, { ...change, reps: change.reps ?? 10 }, opts.defaultUnit ?? 'lbs'),
  );
  const body = text.replace(/\s+$/, '');
  return { ok: true, text: body ? `${body}\n${line}` : line, name, line };
}

/** Drops one exercise's line. */
export function removeDraftExercise(
  text: string,
  asked: string,
  opts: { same?: (a: string, b: string) => boolean } = {},
): DraftEdit {
  const found = findLine(readLines(text), asked, opts.same ?? (() => false));
  if (typeof found === 'string') return fail(found);
  const all = splitLines(text);
  all.splice(found.at, 1);
  return { ok: true, text: all.join('\n'), name: found.exercises[0].name, line: found.raw.trim() };
}
