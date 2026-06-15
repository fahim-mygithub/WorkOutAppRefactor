import React, { ReactNode } from 'react';

interface BuildScreenLayoutProps {
  textInputSection: ReactNode;
  /** @deprecated configurator now lives in the Visual tab of the text section. */
  configurationSection?: ReactNode;
  /** @deprecated retained for API compatibility; no longer drives a 2-pane grid. */
  showConfiguration?: boolean;
  actionButtons?: ReactNode;
  className?: string;
}

export const BuildScreenLayout: React.FC<BuildScreenLayoutProps> = ({
  textInputSection,
  actionButtons,
  className = '',
}) => {
  return (
    <div className={`min-h-full bg-surface ${className}`}>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-display font-bold text-ink mb-2">Build Workout</h1>
          <p className="text-body text-ink-muted">
            Write your workout using natural language syntax, with built-in exercise search
          </p>
        </header>

        {/* Main Content (single column; the text section hosts its own
            text/visual/templates tabs). */}
        <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
          <div className="space-y-6 w-full">{textInputSection}</div>
        </div>

        {/* Parse Errors Section (only show parse errors at bottom) */}
        {actionButtons && (
          <div className="mt-8 max-w-4xl mx-auto">{actionButtons}</div>
        )}

        {/* Responsive Breakpoint Indicator (Development Helper) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 bg-ink/50 text-ink-inverse px-2 py-1 rounded text-caption">
            <span className="sm:hidden">XS</span>
            <span className="hidden sm:inline md:hidden">SM</span>
            <span className="hidden md:inline lg:hidden">MD</span>
            <span className="hidden lg:inline xl:hidden">LG</span>
            <span className="hidden xl:inline">XL</span>
          </div>
        )}
      </div>
    </div>
  );
};
