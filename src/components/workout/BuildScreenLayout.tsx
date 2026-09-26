import React, { ReactNode } from 'react';

interface BuildScreenLayoutProps {
  textInputSection: ReactNode;
  /** @deprecated configurator now lives in the Visual tab of the text section. */
  configurationSection?: ReactNode;
  /** @deprecated retained for API compatibility; no longer drives a 2-pane grid. */
  showConfiguration?: boolean;
  actionButtons?: ReactNode;
  /** Optional context shown under the page heading (e.g. the shared-workout card). */
  intro?: ReactNode;
  className?: string;
}

/**
 * Page frame for the custom (free-text) builder: a muted context line over a
 * display title, then one mobile-first column. The text section hosts its own
 * Text / Visual / Templates tabs; `actionButtons` carries parse errors.
 */
export const BuildScreenLayout: React.FC<BuildScreenLayoutProps> = ({
  textInputSection,
  actionButtons,
  intro,
  className = '',
}) => {
  return (
    <div className={`min-h-full bg-surface ${className}`}>
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-6">
        <header className="mb-5">
          <p className="text-body-sm text-ink-muted">Custom build</p>
          <h1 className="mt-1 font-display text-display text-ink">Write a workout</h1>
        </header>

        {intro && <div className="mb-4">{intro}</div>}

        <div className="space-y-4">{textInputSection}</div>

        {actionButtons && <div className="mt-4">{actionButtons}</div>}
      </div>
    </div>
  );
};
