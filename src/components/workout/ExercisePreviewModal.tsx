import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, VideoOff, X } from 'lucide-react';
import { Exercise } from '../../types/exercise';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { IconButton } from '../ui/icon-button';
import { Button } from '../ui/button';
import { ExerciseHueDot } from '../ExerciseThumbnail';
import { cn } from '../../lib/utils';

interface ExercisePreviewModalProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Exercise detail sheet (Tempo): name, a muted muscles line with the hue dot,
 * the clip with view pills when there are several, then numbered steps and a
 * few quiet facts. Read-only, so there is no primary action.
 */
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

  const muscles =
    exercise.muscleGroups && exercise.muscleGroups.length > 1
      ? exercise.muscleGroups.join(', ')
      : exercise.muscleGroup;

  const facts = [
    { label: 'Equipment', value: exercise.equipment },
    { label: 'Difficulty', value: exercise.difficulty },
    { label: 'Mechanic', value: exercise.mechanic },
    { label: 'Force', value: exercise.force },
    { label: 'Grip', value: exercise.grips },
  ].filter((f): f is { label: string; value: string } => typeof f.value === 'string' && f.value.length > 0);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="break-words text-title">{exercise.name}</SheetTitle>
            <SheetDescription className="mt-2 flex items-center gap-2">
              <ExerciseHueDot muscleGroup={exercise.muscleGroup} />
              <span className="min-w-0">{muscles}</span>
            </SheetDescription>
          </div>
          <IconButton variant="ghost" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>

        {/* Video */}
        {exercise.videoLinks && exercise.videoLinks.length > 0 && (
          <div className="mt-5">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-raised">
              {videoLoading && !videoError && (
                <div className="absolute inset-0 animate-pulse bg-surface-raised" aria-hidden="true" />
              )}

              {videoError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <VideoOff size={28} className="text-ink-subtle" aria-hidden="true" />
                  <p className="text-body-sm text-ink-muted">This clip didn't load.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenExternalVideo(exercise.videoLinks[activeVideoIndex])}
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    Open in a new tab
                  </Button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  className="relative h-full w-full object-cover"
                  onLoadedData={handleVideoLoad}
                  onError={handleVideoError}
                  key={exercise.videoLinks[activeVideoIndex]}
                >
                  <source src={exercise.videoLinks[activeVideoIndex]} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>

            {exercise.videoLinks.length > 1 && (
              <div role="group" aria-label="Video view" className="mt-3 flex gap-2 overflow-x-auto">
                {exercise.videoLinks.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={index === activeVideoIndex}
                    onClick={() => handleVideoSelect(index)}
                    className={cn(
                      'min-h-touch-min shrink-0 rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      index === activeVideoIndex
                        ? 'bg-accent-2 text-accent-2-fg'
                        : 'bg-surface-raised text-ink-muted hover:text-ink',
                    )}
                  >
                    View {index + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <section aria-labelledby="preview-instructions-heading" className="mt-6">
          <h3 id="preview-instructions-heading" className="mb-3 text-body font-semibold text-ink">
            How to do it
          </h3>
          {exercise.instructions && exercise.instructions.length > 0 ? (
            <ol className="space-y-3">
              {exercise.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3 text-body text-ink-muted">
                  <span aria-hidden="true" className="w-5 shrink-0 text-right font-num font-tabular font-bold text-ink">
                    {index + 1}
                  </span>
                  <span className="min-w-0">{instruction}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-body-sm text-ink-muted">No instructions for this exercise yet.</p>
          )}
        </section>

        {/* Quiet facts */}
        {facts.length > 0 && (
          <dl className="mt-6 overflow-hidden rounded-[20px] bg-surface-raised/50">
            {facts.map((fact, i) => (
              <div
                key={fact.label}
                className={cn('flex items-center justify-between gap-4 px-4 py-3', i > 0 && 'border-t border-hairline')}
              >
                <dt className="text-body-sm text-ink-muted">{fact.label}</dt>
                <dd className="text-right text-body-sm font-semibold text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  );
};
