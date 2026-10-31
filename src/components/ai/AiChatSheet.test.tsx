import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('shows the graceful unavailable state without leaking setup details', async () => {
    render(<AiChatSheet open onOpenChange={() => {}} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('AI assistant unavailable')).toBeInTheDocument();
    expect(screen.getByText("AI isn't available right now.")).toBeInTheDocument();
    expect(screen.queryByText(/ANTHROPIC_API_KEY/)).not.toBeInTheDocument();
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

  it('never sends an assistant turn with empty text back to the backend', async () => {
    const user = userEvent.setup();
    const sendMessage = vi
      .fn<AiChatClient['sendMessage']>()
      .mockResolvedValueOnce({
        text: '',
        proposals: [
          { id: 'tc-1', tool: 'add_exercise', summary: 'Add Squat 5x5', input: {} },
        ],
      })
      .mockResolvedValueOnce({ text: 'Ok.' });
    render(<AiChatSheet open onOpenChange={() => {}} client={{ sendMessage }} />);
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Message'), 'add squat');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('Add Squat 5x5');
    await user.type(screen.getByLabelText('Message'), 'thanks');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('Ok.');

    const sent = sendMessage.mock.calls[1][0].messages;
    expect(sent.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    for (const m of sent) expect(m.text.trim().length).toBeGreaterThan(0);
    expect(sent[1].text).toBe('Proposed: Add Squat 5x5');
  });

  it.each([
    [
      'proposals',
      {
        text: '',
        proposals: [
          { id: 'p1', tool: 'add_exercise', summary: 'Add Squat 5x5', input: {} },
          { id: 'p2', tool: 'add_exercise', summary: 'Add Row 3x8', input: {} },
        ],
      },
      'Proposed: Add Squat 5x5; Add Row 3x8',
    ],
    [
      'notices',
      {
        text: '',
        notices: [
          { id: 'a', text: 'Bench: remaining sets at 205 lb', tone: 'applied' as const },
          { id: 'b', text: 'Suggestion discarded: too far.', tone: 'discarded' as const },
        ],
      },
      'Bench: remaining sets at 205 lb; Suggestion discarded: too far.',
    ],
    [
      'charts',
      { text: '', visualizations: [{ id: 'v', kind: 'line', title: 'Volume', spec: {} }] },
      '(showed a chart)',
    ],
    ['nothing', { text: '' }, '(no reply)'],
  ])('describes an empty assistant turn with only %s', async (_label, firstTurn, expected) => {
    const user = userEvent.setup();
    const sendMessage = vi
      .fn<AiChatClient['sendMessage']>()
      .mockResolvedValueOnce(firstTurn as AiAssistantTurn)
      .mockResolvedValueOnce({ text: 'Ok.' });
    render(<AiChatSheet open onOpenChange={() => {}} client={{ sendMessage }} />);
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText('Message'), 'one');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.queryByTestId('ai-pending')).not.toBeInTheDocument());
    await user.type(screen.getByLabelText('Message'), 'two');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('Ok.');
    expect(sendMessage.mock.calls[1][0].messages[1].text).toBe(expected);
  });

  it('announces transcript updates politely', async () => {
    render(<AiChatSheet open onOpenChange={() => {}} client={makeClient({ text: 'hi' })} />);
    const log = await screen.findByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('data-testid', 'ai-chat-transcript');
  });
});

describe('AiChatSheet — seed message and notices', () => {
  it('sends the initial message once on open', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ text: 'Drop to 205.' });
    render(
      <React.StrictMode>
        <AiChatSheet
          open
          onOpenChange={() => {}}
          client={{ sendMessage }}
          initialMessage="I missed my last rep"
        />
      </React.StrictMode>,
    );
    expect(await screen.findByText('Drop to 205.')).toBeInTheDocument();
    expect(screen.getByText('I missed my last rep')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('waits until the sheet opens before sending the initial message', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ text: 'Drop to 205.' });
    const { rerender } = render(
      <AiChatSheet
        open={false}
        onOpenChange={() => {}}
        client={{ sendMessage }}
        initialMessage="I missed my last rep"
      />,
    );
    expect(sendMessage).not.toHaveBeenCalled();
    rerender(
      <AiChatSheet
        open
        onOpenChange={() => {}}
        client={{ sendMessage }}
        initialMessage="I missed my last rep"
      />,
    );
    expect(await screen.findByText('Drop to 205.')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('renders applied and discarded notices', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      text: 'Done.',
      notices: [
        { id: 'a', text: 'Bench: remaining sets at 205 lb', tone: 'applied' },
        { id: 'b', text: 'Suggestion discarded: 120 lb is too far from 225 lb.', tone: 'discarded' },
      ],
    });
    const u = userEvent.setup();
    render(<AiChatSheet open onOpenChange={() => {}} client={{ sendMessage }} />);
    await u.type(screen.getByLabelText('Message'), 'help');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/remaining sets at 205 lb/)).toBeInTheDocument();
    expect(screen.getByText(/Suggestion discarded/)).toBeInTheDocument();
  });
});

describe('AiChatSheet — photos', () => {
  const photo = { mediaType: 'image/jpeg' as const, data: 'AAAA' };
  const file = () => new File([new Uint8Array(4)], 'machine.jpg', { type: 'image/jpeg' });

  it('has no camera button when AI is unavailable', async () => {
    render(<AiChatSheet open onOpenChange={() => {}} />);
    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Add a photo' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-photo-input')).not.toBeInTheDocument();
  });

  it('offers a rear-camera photo input when available', async () => {
    render(<AiChatSheet open onOpenChange={() => {}} client={makeClient({ text: 'hi' })} />);
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeInTheDocument();
    const input = screen.getByTestId('ai-photo-input');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');
  });

  it('sends one shrunk photo with the next message, then clears it', async () => {
    const user = userEvent.setup();
    const client = makeClient({ text: 'That is a seated leg curl.' });
    const prepareImage = vi.fn().mockResolvedValue(photo);
    render(<AiChatSheet open onOpenChange={() => {}} client={client} prepareImage={prepareImage} />);
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByTestId('ai-photo-input'), { target: { files: [file()] } });
    expect(await screen.findByTestId('ai-photo-preview')).toBeInTheDocument();
    // A photo alone is enough to send.
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('That is a seated leg curl.');
    const sent = (client.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0].messages;
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ role: 'user', image: photo });
    expect(sent[0].text.length).toBeGreaterThan(0);
    expect(screen.queryByTestId('ai-photo-preview')).not.toBeInTheDocument();
  });

  it('says so when a photo is too large', async () => {
    const { ImageTooLargeError } = await import('@/ai/image');
    const prepareImage = vi.fn().mockRejectedValue(new ImageTooLargeError());
    render(<AiChatSheet open onOpenChange={() => {}} client={makeClient({ text: 'hi' })} prepareImage={prepareImage} />);
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByTestId('ai-photo-input'), { target: { files: [file()] } });
    expect(await screen.findByTestId('ai-error')).toHaveTextContent(/too large/i);
    expect(screen.queryByTestId('ai-photo-preview')).not.toBeInTheDocument();
  });
});

describe('AiChatSheet — async Apply', () => {
  const turn: AiAssistantTurn = {
    text: '',
    proposals: [{ id: 'p1', tool: 'createWorkout', summary: 'Save workout "Push" (1 exercise)' }],
  };

  it('marks the card applied once the apply resolves', async () => {
    const user = userEvent.setup();
    let finish: (v: void) => void = () => {};
    const onApplyProposal = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    render(<AiChatSheet open onOpenChange={() => {}} client={makeClient(turn)} onApplyProposal={onApplyProposal} />);
    await user.type(await screen.findByLabelText('Message'), 'make me a push day');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByTestId('apply-reject-card')).toHaveAttribute('data-decision', 'applied'));
  });

  it('keeps the card open with the message when the apply resolves to a problem', async () => {
    const user = userEvent.setup();
    const onApplyProposal = vi.fn(async () => "Couldn't save — try again.");
    render(<AiChatSheet open onOpenChange={() => {}} client={makeClient(turn)} onApplyProposal={onApplyProposal} />);
    await user.type(await screen.findByLabelText('Message'), 'make me a push day');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(await screen.findByTestId('ai-error')).toHaveTextContent("Couldn't save — try again.");
    expect(screen.getByTestId('apply-reject-card')).toHaveAttribute('data-decision', 'pending');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('renders markdown elements (bold, lists, tables) in assistant replies', async () => {
    const user = userEvent.setup();
    const markdownReply = 'Here is your summary:\n- **Bench Press**: 3x8 at 225 lbs\n- **Incline DB**: 3x10 at 75 lbs\n\n| Exercise | Weight |\n| --- | --- |\n| Bench Press | 225 lbs |';

    const client = makeClient({ text: markdownReply });
    const { container } = render(<AiChatSheet open onOpenChange={() => {}} client={client} />);
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText('Message'), 'show summary');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await screen.findByText('Here is your summary:');
    expect(document.body.querySelectorAll('strong')).toHaveLength(2);
    expect(document.body.querySelectorAll('li')).toHaveLength(2);
    expect(document.body.querySelector('table')).not.toBeNull();
  });
});
