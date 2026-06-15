import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Minimal harness mirroring the Build page text/visual/templates selector.
function BuildHarness({
  defaultValue = 'text',
}: {
  defaultValue?: string;
}) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList aria-label="Build mode">
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="visual">Visual</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>
      <TabsContent value="text">text panel</TabsContent>
      <TabsContent value="visual">visual panel</TabsContent>
      <TabsContent value="templates">templates panel</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('renders the default tab panel and hides the others', () => {
    render(<BuildHarness />);
    expect(screen.getByText('text panel')).toBeInTheDocument();
    expect(screen.queryByText('visual panel')).not.toBeInTheDocument();
    expect(screen.queryByText('templates panel')).not.toBeInTheDocument();
  });

  it('exposes correct a11y roles: tablist, tabs, and a tabpanel', () => {
    render(<BuildHarness />);
    expect(screen.getByRole('tablist', { name: /build mode/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('text panel');
  });

  it('marks the active trigger with aria-selected and data-state="active"', () => {
    render(<BuildHarness />);
    const active = screen.getByRole('tab', { name: 'Text' });
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).toHaveAttribute('data-state', 'active');
    const inactive = screen.getByRole('tab', { name: 'Visual' });
    expect(inactive).toHaveAttribute('aria-selected', 'false');
    expect(inactive).toHaveAttribute('data-state', 'inactive');
  });

  it('switches the visible panel when another tab is clicked', async () => {
    const user = userEvent.setup();
    render(<BuildHarness />);
    await user.click(screen.getByRole('tab', { name: 'Visual' }));
    expect(screen.getByText('visual panel')).toBeInTheDocument();
    expect(screen.queryByText('text panel')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visual' })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('supports controlled mode via value + onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Tabs value="text" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
        </TabsList>
        <TabsContent value="text">text panel</TabsContent>
        <TabsContent value="visual">visual panel</TabsContent>
      </Tabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'Visual' }));
    expect(onValueChange).toHaveBeenCalledWith('visual');
    // Controlled: value prop unchanged, so text panel stays visible.
    expect(screen.getByText('text panel')).toBeInTheDocument();
  });

  it('keyboard navigation: ArrowRight moves selection to the next tab', async () => {
    const user = userEvent.setup();
    render(<BuildHarness />);
    const first = screen.getByRole('tab', { name: 'Text' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Visual' })).toHaveFocus();
  });

  it('active trigger uses the accent token for styling', () => {
    render(<BuildHarness />);
    const active = screen.getByRole('tab', { name: 'Text' });
    // Active state classes reference the accent token (text + indicator).
    expect(active.className).toMatch(/data-\[state=active\]:.*accent/);
  });

  it('disabled trigger: has disabled attrs, disabled styling, and is not selectable', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="visual" disabled>
            Visual
          </TabsTrigger>
        </TabsList>
        <TabsContent value="text">text panel</TabsContent>
        <TabsContent value="visual">visual panel</TabsContent>
      </Tabs>,
    );
    const disabled = screen.getByRole('tab', { name: 'Visual' });
    expect(disabled).toBeDisabled();
    expect(disabled.className).toMatch(/disabled:opacity/);
    expect(disabled.className).toMatch(/disabled:pointer-events-none/);
    await user.click(disabled);
    // Click was a no-op: text panel still showing.
    expect(screen.getByText('text panel')).toBeInTheDocument();
    expect(screen.queryByText('visual panel')).not.toBeInTheDocument();
  });

  it('merges a consumer className on TabsList via tailwind-merge', () => {
    render(
      <Tabs defaultValue="text">
        <TabsList className="bg-blue-500" aria-label="m">
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>
        <TabsContent value="text">text panel</TabsContent>
      </Tabs>,
    );
    const list = screen.getByRole('tablist', { name: 'm' });
    expect(list.className).toMatch(/bg-blue-500/);
    expect(list.className.split(/\s+/)).not.toContain('bg-surface-subtle');
  });

  it('forwards refs to TabsList, TabsTrigger, and TabsContent', () => {
    const listRef = createRef<HTMLDivElement>();
    const triggerRef = createRef<HTMLButtonElement>();
    const contentRef = createRef<HTMLDivElement>();
    render(
      <Tabs defaultValue="text">
        <TabsList ref={listRef}>
          <TabsTrigger ref={triggerRef} value="text">
            Text
          </TabsTrigger>
        </TabsList>
        <TabsContent ref={contentRef} value="text">
          text panel
        </TabsContent>
      </Tabs>,
    );
    expect(listRef.current).toBeInstanceOf(HTMLDivElement);
    expect(listRef.current?.getAttribute('role')).toBe('tablist');
    expect(triggerRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(triggerRef.current?.getAttribute('role')).toBe('tab');
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement);
    expect(contentRef.current?.getAttribute('role')).toBe('tabpanel');
  });
});
