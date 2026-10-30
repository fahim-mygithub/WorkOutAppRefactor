/**
 * The `readMachine` action: a photo of a gym machine -> an exercise draft
 * ({name, muscleGroups, equipment, setupCues, defaultSets}) the client shows in
 * an editable card. SMART_MODEL (vision), forced submitMachine tool so the
 * shape is fixed; the system prompt sits behind cache_control.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { AiError } from './errors';
import { imageBlock, withoutNulls } from './handlers';
import { SMART_MODEL } from './models';
import { READ_MACHINE_SYSTEM_PROMPT } from './prompts';
import { readMachineResultSchema, type ImageInput, type ReadMachineResult } from './schemas';
import { toToolDef } from './tools';

/** The single tool readMachine must answer with; its input is the exercise. */
export const submitMachineTool: Anthropic.Tool = toToolDef('submitMachine', readMachineResultSchema);

export async function readMachine(client: Anthropic, image: ImageInput): Promise<ReadMachineResult> {
  const response = await client.messages.create({
    model: SMART_MODEL,
    max_tokens: 1024,
    system: [{ type: 'text', text: READ_MACHINE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [submitMachineTool],
    tool_choice: { type: 'tool', name: submitMachineTool.name },
    messages: [
      {
        role: 'user',
        content: [imageBlock(image), { type: 'text', text: 'What exercise is this machine for?' }],
      },
    ],
  });
  const block = response.content.find((b) => b.type === 'tool_use' && b.name === submitMachineTool.name);
  if (!block || block.type !== 'tool_use') throw new AiError('internal', 'No exercise in the reply.');
  // Zod drops keys outside the shape, so the client gets exactly the draft.
  const result = readMachineResultSchema.safeParse(withoutNulls(block.input));
  if (!result.success) {
    console.warn('readMachine output failed schema validation', JSON.stringify(result.error.issues));
    throw new AiError('internal', 'Reply did not match the exercise schema.');
  }
  return result.data;
}
