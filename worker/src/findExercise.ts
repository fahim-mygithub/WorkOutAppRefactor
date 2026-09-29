/**
 * The `findExercise` action: look up an exercise missing from the library.
 * SMART_MODEL researches it with Anthropic's server-side web search and
 * answers through the `submitExercise` client tool; demo media candidates are
 * then verified here (verifyMedia) before any reach the app.
 *
 * Prompt-injection guard: only the `submitExercise` input is read; every
 * other block the model produces (text, searches, results) is ignored, and no
 * other client tool is offered.
 *
 * Subrequest budget (Workers free plan: 50 per request):
 *   model: at most 4 calls x 2 attempts (maxRetries 1)          =  8
 *   media: at most 8 candidates x 2 fetches (HEAD, ranged GET)  = 16
 * = 24 before redirects. Each followed redirect is another subrequest, so
 * there is room for ~26 hops across all media fetches; a pathological chain
 * of redirects could still exceed it (the fetch then fails and the check
 * counts as rejected, or the Worker errors).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { AiError } from './errors';
import { verifyMedia, type MediaCheck } from './media';
import { SMART_MODEL } from './models';
import { FIND_EXERCISE_SYSTEM_PROMPT } from './prompts';
import { exerciseLookupSchema, type ExerciseLookup } from './schemas';
import { toToolDef } from './tools';

export const submitExerciseTool: Anthropic.Tool = toToolDef('submitExercise', exerciseLookupSchema);
export const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 5,
};

/** Model calls with web search (first + pause_turn continuations). */
const MAX_SEARCH_ROUNDS = 3;
const MAX_CHECKED = 8;
const MAX_MEDIA = 3;
const CONCURRENCY = 4;
const MEDIA_PATH = /\.(mp4|webm|gif)$/i;
const NUDGE = 'Call submitExercise now with what you found.';
const NO_NUDGE = new Set<Anthropic.StopReason | null>(['pause_turn', 'refusal', 'max_tokens']);
const TOOLS: Anthropic.ToolUnion[] = [WEB_SEARCH_TOOL, submitExerciseTool];

export type FindExerciseResult = Omit<ExerciseLookup, 'mediaCandidates'> & {
  media: string[];
  rejectedMedia: number;
};

export interface FindExerciseDeps {
  client: Anthropic;
  /** Checks one media URL; defaults to verifyMedia with `referer`. */
  verify?: (url: string) => Promise<MediaCheck>;
  /** The app origin sent as Referer when verifying media (env.APP_ORIGIN). */
  referer?: string;
}

const lookupWithoutMedia = exerciseLookupSchema.omit({ mediaCandidates: true });

function isDirectMedia(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && MEDIA_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

/** Verifies candidates (deduped, direct https media only, at most 8 checked,
 *  4 at a time, stopping once 3 pass). Returns passing URLs in candidate
 *  order and the count rejected (filtered out, over the cap, or failed). */
async function pickMedia(raw: unknown, verify: (url: string) => Promise<MediaCheck>) {
  const candidates = Array.isArray(raw) ? raw : [];
  const distinct = [...new Set(candidates.filter((c): c is string => typeof c === 'string').map((c) => c.trim()))]
    .filter((c) => c.length > 0);
  const valid = distinct.filter(isDirectMedia);
  const toCheck = valid.slice(0, MAX_CHECKED);
  let rejected = distinct.length - toCheck.length;
  const passed: boolean[] = [];
  let passes = 0;
  let next = 0;
  const worker = async () => {
    while (passes < MAX_MEDIA && next < toCheck.length) {
      const i = next++;
      const check = await verify(toCheck[i]).catch((): MediaCheck => ({ ok: false, reason: 'error' }));
      if (check.ok) {
        passed[i] = true;
        passes++;
      } else {
        rejected++;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { media: toCheck.filter((_, i) => passed[i]).slice(0, MAX_MEDIA), rejectedMedia: rejected };
}

function submitted(response: Anthropic.Message): unknown {
  const block = response.content.find((b) => b.type === 'tool_use' && b.name === submitExerciseTool.name);
  return block && block.type === 'tool_use' ? block.input : undefined;
}

export async function findExercise(name: string, deps: FindExerciseDeps): Promise<FindExerciseResult> {
  const { client } = deps;
  const verify = deps.verify ?? ((url: string) => verifyMedia(url, deps.referer ?? ''));
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: name }];
  const ask = () =>
    client.messages.create({
      model: SMART_MODEL,
      max_tokens: 8000,
      system: [{ type: 'text', text: FIND_EXERCISE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      // Every request sends the same tools: changing the tools array would
      // invalidate earlier thinking blocks (a 400 on newer accounts).
      tools: TOOLS,
      // No tool_choice: Sonnet 5.5 rejects forced tool_choice ('tool' / 'any')
      // with a 400, so the nudge below steers with a user message instead.
      messages: [...messages],
    }, { maxRetries: 1 });

  let response = await ask();
  for (let round = 1; response.stop_reason === 'pause_turn' && round < MAX_SEARCH_ROUNDS; round++) {
    // Resume a paused server-side search: resend its content, no new user turn.
    messages.push({ role: 'assistant', content: response.content });
    response = await ask();
  }

  let input = submitted(response);
  // One nudge when the model finished without submitting. Not after a pause
  // (a user turn cannot follow an unfinished search), a refusal, or a
  // max_tokens cut-off (the turn is incomplete).
  if (input === undefined && !NO_NUDGE.has(response.stop_reason)) {
    if (response.content.length) messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: NUDGE });
    response = await ask();
    input = submitted(response);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AiError('not-found', "Couldn't identify that exercise.");
  }

  const raw = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null));
  const parsed = lookupWithoutMedia.safeParse(raw);
  if (!parsed.success) {
    console.warn('findExercise output failed schema validation', JSON.stringify(parsed.error.issues));
    throw new AiError('internal', 'Reply did not match the exercise schema.');
  }
  return { ...parsed.data, ...(await pickMedia(raw.mediaCandidates, verify)) };
}
