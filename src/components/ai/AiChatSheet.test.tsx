import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AiChatSheet,
  type AiChatClient,
  type AiAssistantTurn,
} from '@/components/ai/AiChatSheet';
import type { ParsedWorkout } from '@/parser/types';

function makeClient(turn: AiAssistantTurn): AiChatClient {
  return {
    sendMessage: vi.fn(async () => turn),
  };
}

describe('AiChatSheet — unavailable / fallback mode', () => {
  it('shows the graceful unavailable state with the deploy hint when no client', async () => {
    render(<AiChatSheet open onOpenChange={() => {}} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('AI assistant unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(
        /AI assistant needs the \/ai function deployed \+ ANTHROPIC_API_KEY/i,
      ),
    ).toBeInTheDocument();
  });

  it('labels the submit button "Parse to sets" when unavailable', async () => {
    render(<AiChatSheet open onOpenChange={() => {}} />);
    await screen.findByRole('dialog');
    expect(
      screen.getByRole('button', { name: /parse to sets/i }),
    ).toBeInTheDocument();
  });

  it('runs the deterministic parse fallback and emits the parsed workout', async () => {
    const user = userEvent.setup();
    const onFallbackParse = vi.fn();
    render(
      <AiChatSheet open onOpenChange={() => {}} onFallbackParse={onFallbackParse} />,
    );
    await screen.findByRole('dialog');
    await user.type(
      screen.getByLabelText('Message'),
      '3x10 Bench Press @135',
    );
    await user.click(screen.getByRole('button', { name: /parse to sets/i }));

    await waitFor(() => expect(onFallbackParse).toHaveBeenCalledTimes(1));
    const [workout, rawText] = onFallbackParse.mock.calls[0] as [
      ParsedWorkout,
      string,
    ];
    expect(rawText).toBe('3x10 Bench Press @135');
    expect(workout.exercises.length).toBeGreaterThan(0);
    expect(workout.exercises[0].name.toLowerCase()).toContain('bench');
  });

  it('forces fallback mode even with a client when available={false}', async () => {
    const client = makeClient({ text: 'hi' });
    render(
      <AiChatSheet open onOpenChange={() => {}} client={client} available={false} />,
    );
    await screen.findByRole('dialog');
    expect(screen.getByText('AI assistant unavailable')).toBeInTheDocument();
    expect(client.sendMessage).not.toHaveBeenCalled();
  });
});

describe('AiChatSheet — available / backend mode', () => {
  it('sends the user message to the client and renders the assistant text', async () => {
    const user = userEvent.setup();
    const client = makeClient({ text: 'Nice progress this week!' });
    render(<AiChatSheet open onOpenChange={() => {}} client={client} />);
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText('Message'), 'how am I doing?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Nice progress this week!')).toBeInTheDocument();
    expect(screen.getByText('how am I doing?')).toBeInTheDocument();
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('renders mutation tool-calls as Apply/Reject cards and wires Apply', async () => {
    const user = userEvent.setup();
    const client = makeClient({
      text: 'I can add that.',
      proposals: [
        {
          id: 'tc-1',
          tool: 'add_exercise',
          summary: 'Add Squat 5x5',
          input: { name: 'Squat' },
        },
      ],
    });
    const onApplyProposal = vi.fn();
    render(
      <AiChatSheet
        open
        onOpenChange={() => {}}
        client={client}
        onApplyProposal={onApplyProposal}
      />,
    );
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Message'), 'add squat');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Add Squat 5x5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApplyProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tc-1', tool: 'add_exercise' }),
    );
    // Card locks after applying.
    expect(await screen.findByText('Applied')).toBeInTheDocument();
  });

  it('renders visualization tool-calls read-only (no Apply/Reject buttons)', async () => {
    const user = userEvent.setup();
    const client = makeClient({
      text: 'Here is your volume trend.',
      visualizations: [
        { id: 'v-1', kind: 'line', title: 'Weekly volume', spec: {} },
      ],
    });
    render(<AiChatSheet open onOpenChange={() => {}} client={client} />);
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Message'), 'show my volume');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const viz = await screen.findByTestId('ai-visualization');
    expect(viz).toHaveAttribute('data-viz-kind', 'line');
    expect(screen.getByText('Weekly volume')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('uses a custom visualization renderer when provided', async () => {
    const user = userEvent.setup();
    const client = makeClient({
      text: '',
      visualizations: [
        { id: 'v-1', kind: 'bar', title: 'PRs', spec: { foo: 1 } },
      ],
    });
    render(
      <AiChatSheet
        open
        onOpenChange={() => {}}
        client={client}
        renderVisualization={(viz) => (
          <div data-testid="custom-viz">custom:{viz.kind}</div>
        )}
      />,
    );
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Message'), 'prs');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByTestId('custom-viz')).toHaveTextContent(
      'custom:bar',
    );
  });

  it('shows an error alert when the client rejects', async () => {
    const user = userEvent.setup();
    const client: AiChatClient = {
      sendMessage: vi.fn(async () => {
        throw new Error('network down');
      }),
    };
    render(<AiChatSheet open onOpenChange={() => {}} client={client} />);
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Message'), 'hi');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('network down');
  });

  it('does not render when closed', () => {
    render(<AiChatSheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
