import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy, Share2, ExternalLink } from 'lucide-react';
import type { HighlightData } from '../../utils/statsCalculator';

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
      <div className="bg-card rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-primary" size={20} />
          <h2 className="text-lg font-semibold">Highlights & Achievements</h2>
        </div>
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-primary" size={20} />
          <h2 className="text-lg font-semibold">Highlights & Achievements</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="font-medium text-lg mb-2">Ready to create some highlights?</h3>
          <p className="text-muted-foreground">
            Complete a few workouts to start seeing your achievements and milestones here!
          </p>
        </div>
      </div>
    );
  }

  const currentHighlight = highlights[currentIndex];

  return (
    <div className="bg-card rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="text-primary" size={20} />
          <h2 className="text-lg font-semibold">Highlights & Achievements</h2>
        </div>

        {highlights.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevHighlight}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
              {currentIndex + 1} / {highlights.length}
            </span>
            <button
              onClick={nextHighlight}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <HighlightCard highlight={currentHighlight} />

      {/* Indicators */}
      {highlights.length > 1 && (
        <div className="flex justify-center mt-4 gap-2">
          {highlights.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      )}

      {/* All Highlights Preview (Mobile) */}
      {highlights.length > 1 && (
        <div className="mt-6 md:hidden">
          <div className="text-sm font-medium text-muted-foreground mb-3">All Highlights</div>
          <div className="space-y-2">
            {highlights.map((highlight, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  index === currentIndex ? 'bg-primary/10 border-primary/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{highlight.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{highlight.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {highlight.description}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-primary">
                    {highlight.value}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface HighlightCardProps {
  highlight: HighlightData;
}

function HighlightCard({ highlight }: HighlightCardProps) {
  const getHighlightGradient = (type: HighlightData['type']): string => {
    switch (type) {
      case 'progression': return 'from-green-500 to-emerald-600';
      case 'volume': return 'from-blue-500 to-cyan-600';
      case 'consistency': return 'from-purple-500 to-violet-600';
      case 'strength': return 'from-red-500 to-rose-600';
      case 'endurance': return 'from-orange-500 to-amber-600';
      case 'variety': return 'from-pink-500 to-fuchsia-600';
      default: return 'from-gray-500 to-slate-600';
    }
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
    <div className={`bg-gradient-to-r ${getHighlightGradient(highlight.type)} rounded-xl p-6 text-white relative overflow-hidden`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-4 text-6xl transform rotate-12 opacity-50">
          {highlight.icon}
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{highlight.icon}</div>
            <div>
              <h3 className="font-bold text-lg leading-tight">{highlight.title}</h3>
              {highlight.date && (
                <p className="text-white/80 text-sm">
                  {new Date(highlight.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleShare}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <Share2 size={16} />
          </button>
        </div>

        <p className="text-white/90 text-sm mb-4 leading-relaxed">
          {highlight.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="bg-white/20 rounded-full px-4 py-2 backdrop-blur-sm">
            <span className="font-bold text-lg">{highlight.value}</span>
          </div>

          {highlight.isAchievement && (
            <div className="flex items-center gap-2 text-white/80">
              <Trophy size={16} />
              <span className="text-sm font-medium">Achievement</span>
            </div>
          )}
        </div>

        {/* Achievement Badge */}
        {highlight.isAchievement && (
          <div className="absolute -top-2 -left-2 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold animate-pulse">
            ⭐
          </div>
        )}
      </div>
    </div>
  );
}