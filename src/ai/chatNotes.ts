/**
 * Factual notes for the model about what happened to its proposal cards
 * (applied, rejected, undone, undo failed). The model never sees the app's
 * state changes otherwise, so without these it can contradict the data.
 *
 * Notes travel inside the next user turn sent to the Worker, as a clearly
 * marked prefix. They are never added to the visible transcript, and the
 * Worker schema is unchanged.
 */
/** Most notes sent with one request; older ones are dropped. */
export const MAX_NOTES = 8;

export type ProposalOutcome =
  | { kind: 'applied'; at: Date }
  | { kind: 'rejected' }
  | { kind: 'undone' }
  | { kind: 'undo-failed'; reason: string };

export interface ProposalNoteInput {
  tool: string;
  summary: string;
}

const NOTE_OPEN = '[App note, not written by the user: ';
const NOTE_CLOSE = ']';

function formatTime(at: Date): string {
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function describeOutcome(outcome: ProposalOutcome): string {
  switch (outcome.kind) {
    case 'applied':
      return `applied at ${formatTime(outcome.at)}`;
    case 'rejected':
      return 'rejected';
    case 'undone':
      return 'undone, the data was removed';
    case 'undo-failed':
      return `undo failed: ${outcome.reason}`;
  }
}

/** One factual line about a proposal and its outcome. */
export function formatNote(proposal: ProposalNoteInput, outcome: ProposalOutcome): string {
  return `${proposal.summary} (${proposal.tool}): ${describeOutcome(outcome)}.`;
}

/** Keeps only the newest `max` notes, in their original order. */
export function capNotes(notes: readonly string[], max: number = MAX_NOTES): string[] {
  return notes.length > max ? notes.slice(notes.length - max) : [...notes];
}

/**
 * Returns a copy of `messages` whose last user turn starts with the notes.
 * The input array and its messages are not mutated, so the visible transcript
 * is unaffected. With no notes, the messages are returned unchanged.
 */
export function attachNotes<T extends { role: string; text: string }>(
  messages: T[],
  notes: readonly string[],
): T[] {
  const capped = capNotes(notes);
  if (capped.length === 0) return messages;
  let last = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      last = i;
      break;
    }
  }
  if (last < 0) return messages;
  const body = capped.map((n) => `- ${n}`).join('\n');
  const note = `${NOTE_OPEN}\n${body}${NOTE_CLOSE}\n\n`;
  return messages.map((m, i) => (i === last ? { ...m, text: note + m.text } : m));
}
