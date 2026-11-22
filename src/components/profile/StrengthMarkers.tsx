import React, { useEffect, useId, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { isBackendAvailable, isSignedIn } from '../../ai/aiClient';
import { reviewStrengthMarkersWithAi } from '../../ai/strengthMarkersAi';
import {
  applyMarkerOverrides,
  computeBaseStrengthMarkers,
  formatWeightRange,
  type StrengthMarker,
  type StrengthMarkerSource,
} from '../../lib/strengthMarkers';
import { cn } from '../../lib/utils';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  aiReviewsApplied,
  selectAiReviews,
  selectStatedMaxes,
  statedMaxCleared,
  statedMaxSet,
} from '../../store/slices/strengthMarkersSlice';
import type { ExerciseHistory } from '../../types/exerciseHistory';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Skeleton } from '../ui/skeleton';

export interface StrengthMarkersProps {
  userId: string;
  refreshTrigger?: number;
  historyLoader?: (userId: string) => Promise<ExerciseHistory[]>;
  aiAvailable?: boolean;
  aiReviewer?: typeof reviewStrengthMarkersWithAi;
}

const SOURCE_BADGE_CLASS: Record<StrengthMarkerSource, string> = {
  stated: 'bg-accent/15 text-accent',
  'Claude-reviewed': 'bg-accent-2/15 text-accent-2',
  estimate: 'bg-surface-raised text-ink-muted',
};

/**
 * Strength markers (Tempo): per-exercise best logged set, 3-session smoothed
 * e1RM (or stated / Claude-reviewed override), and heavy / moderate / volume
 * working weights. Tapping any lift opens a bottom sheet to set or clear a
 * stated max. Never auto-calls the AI on mount.
 */
export const StrengthMarkers: React.FC<StrengthMarkersProps> = ({
  userId,
  refreshTrigger = 0,
  historyLoader,
  aiAvailable,
  aiReviewer = reviewStrengthMarkersWithAi,
}) => {
  const dispatch = useAppDispatch();
  const statedMaxes = useAppSelector(selectStatedMaxes);
  const aiReviews = useAppSelector(selectAiReviews);

  const [history, setHistory] = useState<ExerciseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [statedInput, setStatedInput] = useState('');
  const [inputTouched, setInputTouched] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const headingId = useId();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    let active = true;
    if (!userId) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const loader = historyLoader ?? ((uid: string) => ExerciseHistoryService.getAllExerciseHistory(uid, 100));
        const rows = await loader(userId);
        if (active) setHistory(rows);
      } catch {
        if (active) setHistory([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [userId, refreshTrigger, historyLoader]);

  const baseMarkers = useMemo(() => computeBaseStrengthMarkers(history), [history]);
  const markers = useMemo(
    () => applyMarkerOverrides(baseMarkers, { statedMaxes, aiReviews }),
    [baseMarkers, statedMaxes, aiReviews],
  );

  const selectedMarker: StrengthMarker | null = useMemo(() => {
    if (!selectedKey) return null;
    return markers.find((m) => m.exerciseKey === selectedKey) ?? null;
  }, [markers, selectedKey]);

  const canUseAi = aiAvailable ?? (isBackendAvailable() && isSignedIn());

  const handleRefreshWithClaude = async () => {
    if (isRefreshingAi || baseMarkers.length === 0 || !canUseAi) return;
    setIsRefreshingAi(true);
    setAiStatus(null);
    try {
      const result = await aiReviewer(baseMarkers);
      const count = Object.keys(result.reviews).length;
      if (result.usedAi && count > 0) {
        dispatch(
          aiReviewsApplied({
            reviews: result.reviews,
            reviewedAt: new Date().toISOString(),
          }),
        );
        setAiStatus(`Reviewed ${count} lift${count === 1 ? '' : 's'} with Claude.`);
      } else {
        setAiStatus('Using formula estimates.');
      }
    } finally {
      setIsRefreshingAi(false);
    }
  };

  const openLiftSheet = (marker: StrengthMarker) => {
    setSelectedKey(marker.exerciseKey);
    const existing = statedMaxes[marker.exerciseKey];
    setStatedInput(existing ? String(existing.weight) : String(marker.e1RM));
    setInputTouched(false);
    setInputError(null);
    setIsSheetOpen(true);
  };

  const validateWeightInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const handleInputBlur = () => {
    setInputTouched(true);
    if (validateWeightInput(statedInput) === null) {
      setInputError('Enter a positive weight.');
    }
  };

  const handleSaveStatedMax = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMarker) return;
    setInputTouched(true);
    const parsed = validateWeightInput(statedInput);
    if (parsed === null) {
      setInputError('Enter a positive weight.');
      return;
    }
    dispatch(
      statedMaxSet({
        exerciseKey: selectedMarker.exerciseKey,
        exerciseName: selectedMarker.exerciseName,
        weight: parsed,
        unit: selectedMarker.unit,
      }),
    );
    setIsSheetOpen(false);
  };

  const handleClearStatedMax = () => {
    if (!selectedMarker) return;
    dispatch(statedMaxCleared(selectedMarker.exerciseKey));
    setIsSheetOpen(false);
  };

  const header = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 id={headingId} className="font-wide text-title font-bold text-ink">
          Strength markers
        </h2>
        {!isLoading && markers.length > 0 && (
          <p className="text-body-sm text-ink-muted">
            {markers.length} lift{markers.length === 1 ? '' : 's'}
          </p>
        )}
      </div>
      {canUseAi && markers.length > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleRefreshWithClaude()}
          disabled={isRefreshingAi}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {isRefreshingAi ? 'Refreshing…' : 'Refresh with Claude'}
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <section aria-labelledby={headingId} aria-busy="true">
        {header}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (markers.length === 0) {
    return (
      <section aria-labelledby={headingId}>
        {header}
        <div className="rounded-[20px] bg-surface-subtle px-5 py-6">
          <p className="text-body font-semibold text-ink">No logged sets yet</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            Log a weighted set in a workout to see estimated 1RMs and working weights.
          </p>
        </div>
      </section>
    );
  }

  const hasStatedOverride = selectedMarker ? Boolean(statedMaxes[selectedMarker.exerciseKey]) : false;
  const showInvalid = inputTouched && Boolean(inputError);

  return (
    <section aria-labelledby={headingId}>
      {header}

      {aiStatus && (
        <p className="mb-2 px-1 text-caption text-ink-muted" aria-live="polite">
          {aiStatus}
        </p>
      )}

      <ul className="overflow-hidden rounded-[20px] bg-surface-subtle">
        {markers.map((marker, i) => {
          const rirSuffix = marker.bestSet.rir !== undefined ? ` @ ${marker.bestSet.rir} RIR` : '';
          return (
            <li key={marker.exerciseKey} className={cn(i > 0 && 'border-t border-hairline')}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => openLiftSheet(marker)}
                className="flex min-h-[64px] w-full flex-col gap-3 px-4 py-3.5 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink">
                        {marker.exerciseName}
                      </span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-semibold',
                          SOURCE_BADGE_CLASS[marker.source],
                        )}
                      >
                        {marker.source}
                      </span>
                    </div>
                    <p className="mt-0.5 text-body-sm text-ink-muted">
                      Best set:{' '}
                      <span className="font-num font-tabular text-ink">
                        {marker.bestSet.weight} × {marker.bestSet.reps}
                      </span>{' '}
                      {marker.bestSet.unit}
                      {rirSuffix}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block font-num font-tabular font-wide text-title font-bold text-ink">
                      {marker.e1RM}
                    </span>
                    <span className="block text-caption text-ink-muted">
                      {marker.unit} e1RM
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-surface-raised/60 px-3 py-2">
                  {[
                    marker.workingWeights.heavy,
                    marker.workingWeights.moderate,
                    marker.workingWeights.volume,
                  ].map((zone) => (
                    <div key={zone.label} className="min-w-0">
                      <dt className="truncate text-caption text-ink-muted">
                        {zone.label} ({zone.repRange})
                      </dt>
                      <dd className="truncate font-num font-tabular text-body-sm font-semibold text-ink">
                        {formatWeightRange(zone)} {marker.unit}
                      </dd>
                    </div>
                  ))}
                </dl>

                {marker.source === 'Claude-reviewed' && marker.note && (
                  <p className="text-caption text-ink-muted">{marker.note}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="mx-auto max-w-lg">
          {selectedMarker && (
            <>
              <SheetTitle className="text-title">{selectedMarker.exerciseName}</SheetTitle>
              <SheetDescription>
                Formula estimate: {selectedMarker.formulaE1RM} {selectedMarker.unit} · Best set:{' '}
                {selectedMarker.bestSet.weight} × {selectedMarker.bestSet.reps} {selectedMarker.unit}
              </SheetDescription>

              <form onSubmit={handleSaveStatedMax} noValidate className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={inputId}>
                    Stated 1RM ({selectedMarker.unit})
                  </Label>
                  <p id={hintId} className="text-caption text-ink-muted">
                    Override the formula estimate with your true tested max.
                  </p>
                  <Input
                    id={inputId}
                    name="statedMax"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={statedInput}
                    aria-invalid={showInvalid || undefined}
                    aria-describedby={showInvalid ? `${hintId} ${errorId}` : hintId}
                    onChange={(e) => {
                      setStatedInput(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    onBlur={handleInputBlur}
                  />
                  {showInvalid && (
                    <p id={errorId} role="alert" className="text-caption text-danger">
                      {inputError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button type="submit" size="xl">
                    Save stated max
                  </Button>
                  {hasStatedOverride && (
                    <Button type="button" variant="secondary" onClick={handleClearStatedMax}>
                      Clear stated max
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
};
