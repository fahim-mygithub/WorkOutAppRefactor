import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallPrompt } from '@/components/InstallPrompt';
import type { UseInstallPromptResult } from '@/hooks/useInstallPrompt';

// We mock the hook so the component test stays focused on rendering/interaction
// (the hook has its own platform-detection suite).
const mockHook = vi.fn<() => UseInstallPromptResult>();
vi.mock('@/hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => mockHook(),
}));

function baseState(
  overrides: Partial<UseInstallPromptResult> = {},
): UseInstallPromptResult {
  return {
    canInstall: false,
    isIOS: false,
    isStandalone: false,
    isDismissed: false,
    showIOSInstructions: false,
    promptInstall: vi.fn().mockResolvedValue('accepted'),
    dismiss: vi.fn(),
    ...overrides,
  };
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    mockHook.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when there is nothing to offer', () => {
    mockHook.mockReturnValue(baseState());
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when already installed (standalone)', () => {
    mockHook.mockReturnValue(baseState({ isStandalone: true }));
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('Android / Chromium banner', () => {
    it('shows an install banner with an Install action when canInstall', () => {
      mockHook.mockReturnValue(baseState({ canInstall: true }));
      render(<InstallPrompt />);
      expect(
        screen.getByRole('button', { name: /install/i }),
      ).toBeInTheDocument();
    });

    it('calls promptInstall when the Install button is clicked', async () => {
      const promptInstall = vi.fn().mockResolvedValue('accepted');
      mockHook.mockReturnValue(baseState({ canInstall: true, promptInstall }));
      const user = userEvent.setup();
      render(<InstallPrompt />);
      await user.click(screen.getByRole('button', { name: /install/i }));
      expect(promptInstall).toHaveBeenCalledTimes(1);
    });

    it('calls dismiss when the close button is clicked', async () => {
      const dismiss = vi.fn();
      mockHook.mockReturnValue(baseState({ canInstall: true, dismiss }));
      const user = userEvent.setup();
      render(<InstallPrompt />);
      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(dismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('iOS manual instructions', () => {
    it('opens a sheet with Share -> Add to Home Screen guidance', async () => {
      mockHook.mockReturnValue(baseState({ isIOS: true, showIOSInstructions: true }));
      render(<InstallPrompt />);
      // The instructions live in a Sheet/dialog; assert the guidance text.
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
    });

    it('calls dismiss when the iOS sheet is dismissed', async () => {
      const dismiss = vi.fn();
      mockHook.mockReturnValue(
        baseState({ isIOS: true, showIOSInstructions: true, dismiss }),
      );
      const user = userEvent.setup();
      render(<InstallPrompt />);
      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 500));
      });
      expect(dismiss).toHaveBeenCalled();
    });

    it('does not show iOS instructions when showIOSInstructions is false', () => {
      mockHook.mockReturnValue(baseState({ isIOS: true, showIOSInstructions: false }));
      const { container } = render(<InstallPrompt />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
