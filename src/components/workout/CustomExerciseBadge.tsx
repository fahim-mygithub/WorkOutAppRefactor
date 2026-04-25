import React from 'react';

interface CustomExerciseBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
  showText?: boolean;
}

export const CustomExerciseBadge: React.FC<CustomExerciseBadgeProps> = ({
  className = '',
  size = 'sm',
  showText = true
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2 py-1'
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className={`inline-flex items-center gap-1 bg-purple-900/50 text-purple-300 border border-purple-700 rounded-full ${sizeClasses[size]} ${className}`}>
      <svg className={`${iconSize}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      {showText && (
        <span className="font-medium">Custom</span>
      )}
    </div>
  );
};