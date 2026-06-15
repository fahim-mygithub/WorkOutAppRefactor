import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy, Share2 } from 'lucide-react';
import type { HighlightData } from '../../utils/statsCalculator';
import { Card, CardBody, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { IconButton } from '../ui/icon-button';
import { Stack } from '../ui/stack';
import { cn } from '../../lib/utils';

interface HighlightsCarouselProps {
  highlights: HighlightData[];
  isLoading: boolean;
}

export function HighlightsCarousel({ highlights, isLoading }: HighlightsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextHighlight = () => {
    setCurrentIndex((prev) => (prev + 1) % highlights.length);
  };

  const prevHighlight = () => {
    setCurrentIndex((prev) => (prev - 1 + highlights.length) % highlights.length);
  };

  if (isLoading) {
    return (
      <Card className="mb-6" aria-busy="true">
        <CardHeader>
          <Stack direction="row" gap={2} align="center">
            <Trophy className="text-accent" size={20} />
            <CardTitle className="text-title">Highlights &amp; Achievements</CardTitle>
          </Stack>
        </CardHeader>
        <CardBody>
          <Skeleton className="h-32 rounded-lg" />
        </CardBody>
      </Card>
    );
  }

  if (highlights.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <Stack direction="row" gap={2} align="center">
            <Trophy className="text-accent" size={20} />
            <CardTitle className="text-title">Highlights &amp; Achievements</CardTitle>
          </Stack>
        </CardHeader>
        <CardBody>
          <div className="py-8 text-center">
            <div className="mb-4 text-6xl">🎯</div>
            <h3 className="mb-2 text-title font-semibold text-ink">Ready to create some highlights?</h3>
            <p className="text-body-sm text-ink-muted">
              Complete a few workouts to start seeing your achievements and milestones here!
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const currentHighlight = highlights[currentIndex];

  return (
    <Card className="mb-6">
      <CardHeader className="flex items-center justify-between">
        <Stack direction="row" gap={2} align="center">
          <Trophy className="text-accent" size={20} />
          <CardTitle className="text-title">Highlights &amp; Achievements</CardTitle>
        </Stack>

        {highlights.length > 1 && (
          <Stack direction="row" gap={2} align="center">
            <IconButton variant="ghost" size="sm" aria-label="Previous highlight" onClick={prevHighlight}>
              <ChevronLeft size={16} />
            </IconButton>
            <span className="min-w-[3rem] text-center text-body-sm text-ink-muted font-tabular">
              {currentIndex + 1} / {highlights.length}
            </span>
            <IconButton variant="ghost" size="sm" aria-label="Next highlight" onClick={nextHighlight}>
              <ChevronRight size={16} />
            </IconButton>
          </Stack>
        )}
      </CardHeader>

      <CardBody>
        <HighlightCard highlight={currentHighlight} />

        {/* Indicators */}
        {highlights.length > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {highlights.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to highlight ${index + 1}`}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors duration-snap',
                  index === currentIndex ? 'bg-accent' : 'bg-surface-subtle',
                )}
              />
            ))}
          </div>
        )}

        {/* All Highlights Preview (Mobile) */}
        {highlights.length > 1 && (
          <div className="mt-6 md:hidden">
            <div className="mb-3 text-body-sm font-medium text-ink-muted">All Highlights</div>
            <Stack gap={2}>
              {highlights.map((highlight, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'w-full rounded-md p-3 text-left transition-colors duration-snap',
                    index === currentIndex
                      ? 'bg-accent/10 ring-1 ring-accent/20'
                      : 'bg-surface-subtle hover:bg-surface-subtle/80',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{highlight.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body-sm font-medium text-ink">{highlight.title}</div>
                      <div className="truncate text-caption text-ink-subtle">
                        {highlight.description}
                      </div>
                    </div>
                    <div className="text-body-sm font-medium text-accent">
                      {highlight.value}
                    </div>
                  </div>
                </button>
              ))}
            </Stack>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface HighlightCardProps {
  highlight: HighlightData;
}

// Map highlight type → a semantic / muscle-group hue accent (token-driven, no
// raw color scales). The card uses a tinted surface + colored left rail +
// accent value chip rather than a full saturated gradient.
const HIGHLIGHT_HUE: Record<HighlightData['type'], { bg: string; text: string; border: string }> = {
  progression: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  volume:      { bg: 'bg-muscle-pull/10', text: 'text-muscle-pull', border: 'border-muscle-pull/30' },
  consistency: { bg: 'bg-muscle-core/10', text: 'text-muscle-core', border: 'border-muscle-core/30' },
  strength:    { bg: 'bg-muscle-push/10', text: 'text-muscle-push', border: 'border-muscle-push/30' },
  endurance:   { bg: 'bg-muscle-legs/10', text: 'text-muscle-legs', border: 'border-muscle-legs/30' },
  variety:     { bg: 'bg-muscle-cardio/10', text: 'text-muscle-cardio', border: 'border-muscle-cardio/30' },
};

function HighlightCard({ highlight }: HighlightCardProps) {
  const hue = HIGHLIGHT_HUE[highlight.type] ?? {
    bg: 'bg-surface-subtle',
    text: 'text-ink',
    border: 'border-ink/10',
  };

  const handleShare = async () => {
    const text = `${highlight.title}\n${highlight.description}\n${highlight.value}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Workout Achievement',
          text: text,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(text);
        // You might want to show a toast here
      } catch (err) {
        console.error('Failed to copy to clipboard');
      }
    }
  };

  return (
    <div className={cn('relative overflow-hidden rounded-lg border p-6', hue.bg, hue.border)}>
      {/* Background glyph */}
      <div className="pointer-events-none absolute right-4 top-4 rotate-12 text-6xl opacity-10">
        {highlight.icon}
      </div>

      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{highlight.icon}</div>
            <div>
              <h3 className="text-title font-bold leading-tight text-ink">{highlight.title}</h3>
              {highlight.date && (
                <p className="text-body-sm text-ink-muted">
                  {new Date(highlight.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>
          </div>

          <IconButton variant="ghost" size="sm" aria-label="Share achievement" onClick={handleShare}>
            <Share2 size={16} />
          </IconButton>
        </div>

        <p className="mb-4 text-body-sm leading-relaxed text-ink-muted">
          {highlight.description}
        </p>

        <div className="flex items-center justify-between">
          <div className={cn('rounded-full bg-surface-raised px-4 py-2 shadow-e1', hue.text)}>
            <span className="text-title font-bold font-tabular">{highlight.value}</span>
          </div>

          {highlight.isAchievement && (
            <div className={cn('flex items-center gap-2', hue.text)}>
              <Trophy size={16} />
              <span className="text-body-sm font-medium">Achievement</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
