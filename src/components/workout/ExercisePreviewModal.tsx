import React, { useState, useRef, useEffect } from 'react';
import { Exercise } from '../../types/exercise';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { IconButton } from '../ui/icon-button';
import { Button } from '../ui/button';

interface ExercisePreviewModalProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExercisePreviewModal: React.FC<ExercisePreviewModalProps> = ({
  exercise,
  isOpen,
  onClose,
}) => {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset video states when exercise changes
  useEffect(() => {
    if (exercise?.videoLinks && exercise.videoLinks.length > 0) {
      setActiveVideoIndex(0);
      setVideoError(false);
      setVideoLoading(true);
    }
  }, [exercise?.id]);

  // Escape + scroll-lock are handled by the Sheet primitive (Radix Dialog).

  if (!exercise) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-success/15 text-success border-success/40';
      case 'intermediate':
        return 'bg-warning/15 text-warning border-warning/40';
      case 'advanced':
        return 'bg-danger/15 text-danger border-danger/40';
      default:
        return 'bg-surface-subtle text-ink-muted border-border';
    }
  };

  const getMuscleGroupIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );

  const handleVideoSelect = (index: number) => {
    if (index !== activeVideoIndex) {
      setActiveVideoIndex(index);
      setVideoError(false);
      setVideoLoading(true);

      if (videoRef.current) {
        videoRef.current.load();
      }
    }
  };

  const handleVideoLoad = () => {
    setVideoLoading(false);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setVideoLoading(false);
    setVideoError(true);
  };

  const handleOpenExternalVideo = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="max-w-4xl mx-auto flex max-h-[90vh] flex-col p-0 pt-3">
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-start justify-between p-6 pt-3 border-b border-border">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-display-lg mb-2">
                {exercise.name}
              </SheetTitle>

              {/* Exercise Metadata */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-1 text-body-sm text-ink-muted">
                  {getMuscleGroupIcon()}
                  <span>
                    {exercise.muscleGroups && exercise.muscleGroups.length > 1
                      ? exercise.muscleGroups.join(', ')
                      : exercise.muscleGroup
                    }
                  </span>
                </div>

                <span className="text-ink-subtle">•</span>

                <div className="flex items-center gap-1 text-body-sm text-ink-muted">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  <span>{exercise.equipment}</span>
                </div>

                <span className="text-ink-subtle">•</span>

                <span className={`px-2 py-1 rounded text-caption font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                  {exercise.difficulty}
                </span>

                {exercise.mechanic && (
                  <>
                    <span className="text-ink-subtle">•</span>
                    <span className="text-body-sm text-ink-subtle">{exercise.mechanic}</span>
                  </>
                )}
              </div>

              {/* Multiple Muscle Groups Display */}
              {exercise.muscleGroups && exercise.muscleGroups.length > 1 && (
                <div className="mb-3">
                  <div className="text-caption text-ink-subtle mb-2">Muscle Groups Targeted:</div>
                  <div className="flex flex-wrap gap-1">
                    {exercise.muscleGroups.map((muscleGroup, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-surface-subtle text-ink-muted rounded text-caption border border-border"
                      >
                        {muscleGroup}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <IconButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close"
              className="ml-4 text-ink-subtle hover:text-ink"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </IconButton>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Video Section */}
              {exercise.videoLinks && exercise.videoLinks.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-title font-semibold text-ink">Exercise Video</h4>

                  {/* Video Player */}
                  <div className="aspect-video bg-surface rounded-lg overflow-hidden relative">
                    {videoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                      </div>
                    )}

                    {videoError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-subtle">
                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p>Video could not be loaded</p>
                        <button
                          onClick={() => handleOpenExternalVideo(exercise.videoLinks[activeVideoIndex])}
                          className="mt-2 text-accent hover:text-accent/80 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open in new tab
                        </button>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        controls
                        className="w-full h-full object-cover"
                        onLoadedData={handleVideoLoad}
                        onError={handleVideoError}
                        key={exercise.videoLinks[activeVideoIndex]}
                      >
                        <source src={exercise.videoLinks[activeVideoIndex]} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>

                  {/* Video Selection */}
                  {exercise.videoLinks.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {exercise.videoLinks.map((link, index) => (
                        <button
                          key={index}
                          onClick={() => handleVideoSelect(index)}
                          className={`flex-shrink-0 px-3 py-2 rounded text-body-sm font-medium transition-colors duration-snap ${
                            index === activeVideoIndex
                              ? 'bg-accent text-accent-fg'
                              : 'bg-surface-subtle text-ink-muted hover:bg-surface-raised'
                          }`}
                        >
                          Video {index + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Instructions Section */}
              <div className="space-y-4">
                <h4 className="text-title font-semibold text-ink">Instructions</h4>

                {exercise.instructions && exercise.instructions.length > 0 ? (
                  <div className="bg-surface-subtle rounded-lg p-4">
                    <ol className="list-decimal list-inside space-y-2 text-ink-muted">
                      {exercise.instructions.map((instruction, index) => (
                        <li key={index} className="leading-relaxed">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="bg-surface-subtle rounded-lg p-4 text-ink-subtle text-center">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No instructions available for this exercise.</p>
                  </div>
                )}

                {/* Additional Details */}
                {(exercise.force || exercise.grips) && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-ink">Additional Details</h5>
                    <div className="bg-surface-subtle rounded-lg p-4 space-y-2">
                      {exercise.force && (
                        <div className="flex items-center gap-2 text-ink-muted">
                          <span className="font-medium">Force:</span>
                          <span>{exercise.force}</span>
                        </div>
                      )}
                      {exercise.grips && (
                        <div className="flex items-center gap-2 text-ink-muted">
                          <span className="font-medium">Grip:</span>
                          <span>{exercise.grips}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-4">
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
