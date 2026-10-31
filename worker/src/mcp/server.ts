/**
 * The MCP server: every agent tool, over stateless Streamable HTTP (one
 * server + transport per request, JSON responses, no session state, so no
 * Durable Object is needed). The caller has already authenticated the user.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';
import { agentTools, runAgentTool } from '../agentTools/registry';
import type { UserData } from '../data/userData';
import type { MediaQuota } from '../media/quota';

export const SERVER_INFO = { name: 'workout-app', version: '1.0.0' };

const INSTRUCTIONS =
  "Tools for the user's WorkoutApp account: their profile, saved workouts, planned calendar, finished-workout history and custom exercises. " +
  'Read before you write: list or get a workout before updating it. Writes show up in the app the next time it loads. ' +
  'Weights are in the unit the user uses (get_profile shows weightUnit). Dates are YYYY-MM-DD in the user\'s local calendar.';

export function buildMcpServer(data: UserData, mediaQuota?: MediaQuota): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: INSTRUCTIONS,
    // Workers forbid eval/new Function, which the default (Ajv) validator uses.
    jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
  });
  for (const tool of agentTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.readOnly,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (args: unknown) => {
        const r = await runAgentTool(tool.name, args, { data, mediaQuota });
        return r.ok
          ? { content: [{ type: 'text' as const, text: JSON.stringify(r.result, null, 2) }] }
          : { content: [{ type: 'text' as const, text: r.error }], isError: true };
      },
    );
  }
  return server;
}

export async function handleMcpRequest(request: Request, data: UserData, mediaQuota?: MediaQuota): Promise<Response> {
  const server = buildMcpServer(data, mediaQuota);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
