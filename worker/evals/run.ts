/**
 * Manual evals for the readLift and chat prompts. Calls the real handlers with
 * a real Anthropic client, so it costs a few cents per run. Never part of
 * `npm test` or CI.
 *
 *   ANTHROPIC_API_KEY=sk-... npm --prefix worker run eval
 *
 * Prints a pass/fail table and a summary; always exits 0 (informational).
 */
import { compareLift, compareTools, type LiftExpectation } from '../src/evalCompare';
import { handleChat, handleReadLift, makeClient } from '../src/handlers';
import { chatContextSchema } from '../src/schemas';
import liftEntries from './lift-entries.json';
import missedReps from './missed-reps.json';

interface LiftCase {
  text: string;
  expect: LiftExpectation;
}

interface ChatCase {
  name: string;
  /** Key into `contexts`. */
  context: string;
  message: string;
  expectTools?: string[];
  forbidTools?: string[];
}

interface Row {
  name: string;
  pass: boolean;
  diff: string;
}

const errorText = (err: unknown): string => `error: ${err instanceof Error ? err.message : String(err)}`;

async function runLiftCases(client: ReturnType<typeof makeClient>): Promise<Row[]> {
  const rows: Row[] = [];
  // JSON imports infer `undefined` for keys a case leaves out; the shape is ours.
  for (const c of liftEntries as unknown as LiftCase[]) {
    const name = `lift: ${c.text}`;
    try {
      const result = await handleReadLift(client, c.text);
      const diffs = compareLift(c.expect, result as Record<string, unknown>);
      rows.push({ name, pass: diffs.length === 0, diff: diffs.join('; ') });
    } catch (err) {
      rows.push({ name, pass: false, diff: errorText(err) });
    }
  }
  return rows;
}

async function runChatCases(client: ReturnType<typeof makeClient>): Promise<Row[]> {
  const { contexts, cases } = missedReps as unknown as { contexts: Record<string, unknown>; cases: ChatCase[] };
  const rows: Row[] = [];
  for (const c of cases) {
    const name = `chat: ${c.name}`;
    try {
      if (!(c.context in contexts)) throw new Error(`unknown context "${c.context}"`);
      const context = chatContextSchema.parse(contexts[c.context]);
      const result = await handleChat(client, [{ role: 'user', content: c.message }], context);
      const called = result.toolCalls.map((t) => t.name);
      const diffs = compareTools(called, c.expectTools, c.forbidTools);
      const tail = `called [${called.join(', ')}]`;
      rows.push({ name, pass: diffs.length === 0, diff: diffs.length ? `${diffs.join('; ')}; ${tail}` : tail });
    } catch (err) {
      rows.push({ name, pass: false, diff: errorText(err) });
    }
  }
  return rows;
}

function printTable(rows: Row[]): void {
  const width = Math.min(60, Math.max(4, ...rows.map((r) => r.name.length)));
  const cut = (s: string) => (s.length > width ? `${s.slice(0, width - 1)}…` : s.padEnd(width));
  console.log(`${'case'.padEnd(width)}  result  diff`);
  console.log(`${'-'.repeat(width)}  ------  ----`);
  for (const r of rows) console.log(`${cut(r.name)}  ${r.pass ? 'pass  ' : 'FAIL  '}  ${r.diff}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY is not set; skipping evals. Set it and run `npm --prefix worker run eval`.');
    return;
  }
  const client = makeClient(apiKey);
  const rows = [...(await runLiftCases(client)), ...(await runChatCases(client))];
  printTable(rows);
  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${passed}/${rows.length} passed (lift ${liftEntries.length}, chat ${missedReps.cases.length}).`);
}

main()
  .catch((err) => console.error(errorText(err)))
  .finally(() => {
    process.exitCode = 0;
  });
