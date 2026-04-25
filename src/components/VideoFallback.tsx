import React from 'react';
import { PlayCircle, ExternalLink, RotateCcw } from 'lucide-react';

interface VideoFallbackProps {
  exerciseName: string;
  instructions?: string[];
  errorMessage?: string;
  retryCount?: number;
  compact?: boolean;
  className?: string;
  onRetry?: () => void;
  onSearchYouTube?: () => void;
}

export const VideoFallback: React.FC<VideoFallbackProps> = ({
  exerciseName,
  instructions = [],
  errorMessage,
  retryCount = 0,
  compact = false,
  className = '',
  onRetry,
  onSearchYouTube,
}) => {
  const handleSearchYouTube = () => {
    const searchQuery = encodeURIComponent(`${exerciseName} exercise tutorial`);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
    window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
    onSearchYouTube?.();
  };

  const getPlaceholderIcon = () => {
    // Different icons based on muscle group if we can infer it
    const name = exerciseName.toLowerCase();
    if (name.includes('bicep') || name.includes('curl')) return '💪';
    if (name.includes('chest') || name.includes('bench') || name.includes('push')) return '🏋️';
    if (name.includes('leg') || name.includes('squat') || name.includes('lunge')) return '🦵';
    if (name.includes('back') || name.includes('row') || name.includes('pull')) return '🔙';
    if (name.includes('shoulder') || name.includes('press')) return '🤲';
    if (name.includes('tricep') || name.includes('dip')) return '💪';
    if (name.includes('core') || name.includes('plank') || name.includes('crunch')) return '🔥';
    if (name.includes('stretch') || name.includes('yoga')) return '🧘';
    return '🎯'; // Default exercise icon
  };

  return (
    <div className={`bg-gray-700 rounded-lg flex flex-col ${compact ? 'h-32 p-3' : 'h-64 p-6'} ${className}`}>
      {/* Header with icon and exercise name */}
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className={`${compact ? 'text-2xl mb-1' : 'text-4xl mb-3'}`}>
            {getPlaceholderIcon()}
          </div>
          
          <h3 className={`font-semibold text-white ${compact ? 'text-sm' : 'text-lg'} mb-2`}>
            {exerciseName}
          </h3>
          
          {errorMessage && (
            <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'} mb-2`}>
              {errorMessage}
            </p>
          )}

          {retryCount > 0 && (
            <p className="text-gray-500 text-xs mb-2">
              Tried {retryCount + 1} source{retryCount > 0 ? 's' : ''}
            </p>
          )}

          {/* Show first instruction if not compact */}
          {!compact && instructions.length > 0 && (
            <p className="text-gray-300 text-sm mb-3 line-clamp-2">
              {instructions[0]}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className={`flex ${compact ? 'space-x-2' : 'space-x-3'} justify-center mt-2`}>
        {onRetry && (
          <button
            onClick={onRetry}
            className={`flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors ${
              compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
            }`}
            title="Try loading video again"
          >
            <RotateCcw className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            <span>Retry</span>
          </button>
        )}
        
        <button
          onClick={handleSearchYouTube}
          className={`flex items-center space-x-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors ${
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
          }`}
          title="Search for exercise tutorial on YouTube"
        >
          <ExternalLink className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          <span>YouTube</span>
        </button>
      </div>

      {/* Additional instructions for non-compact view */}
      {!compact && instructions.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-300 transition-colors">
              View Instructions
            </summary>
            <ol className="mt-2 space-y-1 ml-3">
              {instructions.slice(0, 3).map((instruction, index) => (
                <li key={index} className="flex">
                  <span className="text-blue-400 mr-2">{index + 1}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
              {instructions.length > 3 && (
                <li className="text-gray-500 italic">
                  +{instructions.length - 3} more steps...
                </li>
              )}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
};