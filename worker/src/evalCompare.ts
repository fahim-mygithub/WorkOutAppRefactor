/**
 * Pure comparison helpers for the manual evals in `worker/evals/` (run with
 * `npm run eval`). Kept in src/ so the normal test suite covers them.
 */

/** A readLift expectation: only the listed fields are checked. `question: true`
 *  means a non-empty question; `question: false` means none. */
export type LiftExpectation = Record<string, string | number | boolean>;

const show = (v: unknown): string => (v === undefined ? 'missing' : JSON.stringify(v));

/** Differences between an expectation and a readLift result; empty = pass.
 *  Numbers must match exactly, strings case-insensitively (trimmed). */
export function compareLift(expect: LiftExpectation, actual: Record<string, unknown>): string[] {
  const diffs: string[] = [];
  for (const [key, want] of Object.entries(expect)) {
    const got = actual[key];
    if (key === 'question' && typeof want === 'boolean') {
      const asked = typeof got === 'string' && got.trim().length > 0;
      if (asked !== want) diffs.push(`question: want ${want ? 'a question' : 'none'}, got ${show(got)}`);
      continue;
    }
    const ok =
      typeof want === 'string'
        ? typeof got === 'string' && got.trim().toLowerCase() === want.trim().toLowerCase()
        : got === want;
    if (!ok) diffs.push(`${key}: want ${show(want)}, got ${show(got)}`);
  }
  return diffs;
}

export interface ToolExpectation {
  /** Every one of these must be called. */
  expectTools?: readonly string[];
  /** At least one of these must be called (when non-empty). */
  expectAnyTools?: readonly string[];
  /** None of these may be called. */
  forbidTools?: readonly string[];
}

/** Differences for a chat case; empty = pass. */
export function compareTools(called: readonly string[], expect: ToolExpectation): string[] {
  const { expectTools = [], expectAnyTools = [], forbidTools = [] } = expect;
  const diffs: string[] = [];
  for (const name of expectTools) if (!called.includes(name)) diffs.push(`missing ${name}`);
  if (expectAnyTools.length && !expectAnyTools.some((name) => called.includes(name))) {
    diffs.push(`missing any of ${expectAnyTools.join('|')}`);
  }
  for (const name of forbidTools) if (called.includes(name)) diffs.push(`forbidden ${name}`);
  return diffs;
}
