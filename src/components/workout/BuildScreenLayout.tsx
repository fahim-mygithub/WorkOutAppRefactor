import React, { ReactNode } from 'react';

interface BuildScreenLayoutProps {
  textInputSection: ReactNode;
  configurationSection?: ReactNode;
  showConfiguration?: boolean;
  actionButtons?: ReactNode;
  className?: string;
}

export const BuildScreenLayout: React.FC<BuildScreenLayoutProps> = ({
  textInputSection,
  configurationSection,
  showConfiguration = false,
  actionButtons,
  className = '',
}) => {
  return (
    <div className={`min-h-full bg-gray-900 ${className}`}>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Build Workout</h1>
          <p className="text-gray-400">
            Write your workout using natural language syntax, with built-in exercise search
          </p>
        </div>

        {/* Main Content Layout */}
        <div className={`grid gap-6 transition-all duration-300 ${
          showConfiguration 
            ? 'grid-cols-1 lg:grid-cols-2' 
            : 'grid-cols-1 max-w-4xl mx-auto'
        }`}>
          {/* Text Input Section */}
          <div className={`space-y-6 ${showConfiguration ? '' : 'w-full'}`}>
            {textInputSection}
          </div>

          {/* Configuration Section */}
          {showConfiguration && configurationSection && (
            <div className="space-y-6 lg:sticky lg:top-4 lg:h-fit relative z-0">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">
                    Configure Workout
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Workout parsed successfully
                  </div>
                </div>
                {configurationSection}
              </div>
            </div>
          )}
        </div>

        {/* Parse Errors Section (only show parse errors at bottom) */}
        {actionButtons && (
          <div className="mt-8 max-w-4xl mx-auto">
            {actionButtons}
          </div>
        )}

        {/* Responsive Breakpoint Indicator (Development Helper) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
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