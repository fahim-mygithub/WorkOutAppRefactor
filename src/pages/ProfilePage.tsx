import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { setWeightUnit, setUnitSystem, setDefaultRestTime, toggleAutoStartTimer, setDefaultProgressionRate, toggleKeyboardShortcuts, toggleKeyboardShortcutsDisplay } from '../store/slices/userSlice';
import { loadWorkoutHistory } from '../store/slices/exerciseHistorySlice';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { startWorkout } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { AllExercisesHistory } from '../components/profile/AllExercisesHistory';
import { ManualExerciseLogger } from '../components/profile/ManualExerciseLogger';
import { WorkoutHistoryManager } from '../components/profile/WorkoutHistoryManager';
import { CompletedWorkoutCard } from '../components/profile/CompletedWorkoutCard';
import { CustomExerciseList } from '../components/profile/CustomExerciseList';
import { formatDuration, formatShortDate } from '../components/profile/historyFormat';
import { SavedWorkout } from '../services/workoutStorageService';
import { WorkoutSummary } from '../types/exerciseHistory';
import { convertSavedWorkoutToExercises, sanitizeWorkoutExercisesForRedux } from '../utils/workoutConversion';
import { useExercises } from '../hooks/useExercises';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';

type ProfileTab = 'history' | 'workouts' | 'exercises' | 'settings';

// --- small local pieces -------------------------------------------------------

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

/** Single-choice pill group (radiogroup semantics) — same idiom as the Build editors. */
function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-touch-min rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
              checked ? 'bg-ink text-ink-inverse' : 'bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A titled group of settings rows on one subtle card, hairlines between rows. */
function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 px-1 text-body-sm font-semibold text-ink-muted">{title}</h3>
      <ul className="overflow-hidden rounded-[20px] bg-surface-subtle [&>li+li]:border-t [&>li+li]:border-hairline">
        {children}
      </ul>
    </section>
  );
}

function SettingsRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cn('flex min-h-[60px] items-center justify-between gap-4 px-4 py-3', className)}>
      {children}
    </li>
  );
}

function SectionHeader({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-wide text-title font-bold text-ink">{title}</h2>
        {meta && <p className="text-body-sm text-ink-muted">{meta}</p>}
      </div>
      {action}
    </div>
  );
}

const SHORTCUTS: { label: string; key: string }[] = [
  { label: 'Complete set', key: 'Space' },
  { label: 'Next set', key: 'N' },
  { label: 'Previous set', key: 'P' },
  { label: 'Rest timer', key: 'R' },
  { label: 'Uncomplete', key: 'U' },
];

const PROGRESSION_HINT: Record<'beginner' | 'intermediate' | 'advanced', string> = {
  beginner: 'Slower progression with conservative weight increases.',
  intermediate: 'Balanced progression with moderate weight increases.',
  advanced: 'Faster progression with aggressive weight increases.',
};

/**
 * Profile (Tempo): who you are and your lifetime numbers up top, then four
 * segments: History (sessions + per-exercise history), Saved workouts, Custom
 * exercises, and Settings as grouped rows. Detail and actions for any one item
 * live in a sheet one tap away.
 */
export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth(); // Get Firebase user from auth context
  const { profile, preferences, stats } = useAppSelector((state) => state.user); // Get profile data from Redux
  const { exercises: exerciseDatabase, isLoading: isLoadingExercises, error: exerciseError } = useExercises(); // Get exercise database
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [isLoadingSavedWorkouts, setIsLoadingSavedWorkouts] = useState(true);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSummary[]>([]);
  const [isLoadingCompletedWorkouts, setIsLoadingCompletedWorkouts] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('history');
  const [isManualLoggerOpen, setIsManualLoggerOpen] = useState(false);
  const [isHistoryManagerOpen, setIsHistoryManagerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Saved workout shown in the detail sheet; kept after closing so the exit
  // animation doesn't flash empty.
  const [openSaved, setOpenSaved] = useState<SavedWorkout | null>(null);
  const [isSavedSheetOpen, setIsSavedSheetOpen] = useState(false);

  const handleWeightUnitChange = (unit: 'lbs' | 'kg') => {
    dispatch(setWeightUnit(unit));
  };

  const handleUnitSystemChange = (system: 'metric' | 'imperial') => {
    dispatch(setUnitSystem(system));
  };

  const handleRestTimeChange = (time: number) => {
    dispatch(setDefaultRestTime(time));
  };

  const handleProgressionRateChange = (rate: 'beginner' | 'intermediate' | 'advanced') => {
    dispatch(setDefaultProgressionRate(rate));
  };

  // Handle opening manual exercise logger
  const handleOpenManualLogger = () => {
    if (isLoadingExercises) {
      alert('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }
    if (exerciseError) {
      alert('Failed to load exercise database. Please refresh the page and try again.');
      return;
    }
    if (!exerciseDatabase || exerciseDatabase.length === 0) {
      alert('Exercise database is not available. Please refresh the page and try again.');
      return;
    }
    setIsManualLoggerOpen(true);
  };

  // Handle starting a workout from a saved workout template
  const handleStartWorkout = (savedWorkout: SavedWorkout) => {
    if (!user?.uid) {
      alert('You must be logged in to start a workout.');
      return;
    }

    if (!exerciseDatabase.length) {
      alert('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      const exercises = convertSavedWorkoutToExercises(savedWorkout, exerciseDatabase);
      if (exercises.length === 0) {
        alert('No valid exercises found in this workout template.');
        return;
      }

      // Sanitize exercises to ensure they're serializable for Redux
      const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);

      dispatch(startWorkout({
        name: savedWorkout.name,
        exercises: sanitizedExercises,
      }));

      // Mark workout as performed (increment performance count)
      if (user?.uid) {
        WorkoutStorageService.markWorkoutPerformed(user.uid, savedWorkout.id);
      }

      navigate('/workout');
    } catch (error) {
      console.error('Error starting workout:', error);
      alert('Failed to start workout. Please try again.');
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user?.uid) {
      // Load workout history
      dispatch(loadWorkoutHistory({ userId: user.uid }));

      // Load saved workouts
      const loadSavedWorkouts = async () => {
        try {
          const workouts = await WorkoutStorageService.getUserWorkouts(user.uid);
          setSavedWorkouts(workouts);
        } catch (error) {
          console.error('Error loading saved workouts:', error);
        } finally {
          setIsLoadingSavedWorkouts(false);
        }
      };

      // Load completed workouts
      const loadCompletedWorkouts = async () => {
        try {
          const completedWorkouts = await ExerciseHistoryService.getWorkoutHistory(user.uid, 50);
          setCompletedWorkouts(completedWorkouts);
        } catch (error) {
          console.error('Error loading completed workouts:', error);
        } finally {
          setIsLoadingCompletedWorkouts(false);
        }
      };

      loadSavedWorkouts();
      loadCompletedWorkouts();
    }
  }, [dispatch, user?.uid]);

  // Guard against a null auth user (e.g. sign-out while the profile is mounted).
  // Everything below dereferences `user.uid`, so narrow it here.
  if (!user) {
    return null;
  }

  const reloadCompletedWorkouts = async () => {
    try {
      const updatedWorkouts = await ExerciseHistoryService.getWorkoutHistory(user.uid, 50);
      setCompletedWorkouts(updatedWorkouts);
    } catch (error) {
      console.error('Error reloading completed workouts:', error);
    }
  };

  const displayName = profile?.displayName || 'Profile';
  const initial = (profile?.displayName?.[0] ?? profile?.email?.[0] ?? '?').toUpperCase();

  const lifetime: { label: string; value: ReactNode }[] = [
    { label: 'Workouts', value: stats.totalWorkouts.toLocaleString() },
    {
      label: 'Current streak',
      value: (
        <>
          {stats.currentStreak}
          <span className="ml-1.5 font-sans text-body font-semibold tracking-normal text-ink-muted [font-stretch:100%]">
            day{stats.currentStreak === 1 ? '' : 's'}
          </span>
        </>
      ),
    },
    { label: 'Sets', value: stats.totalSets.toLocaleString() },
    { label: 'Time trained', value: formatDuration(Math.round(stats.totalWorkoutTime / 60)) },
  ];

  const exerciseCount = (w: SavedWorkout) =>
    w.parsedWorkout.exercises.length + w.parsedWorkout.supersets.flat().length;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-10 pt-5">
      {/* Identity */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body-sm text-ink-muted">{profile?.email || 'No email'}</p>
          <h1 className="truncate font-display text-display text-ink">{displayName}</h1>
        </div>
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-raised font-display text-body text-ink"
        >
          {initial}
        </span>
      </header>

      {/* Lifetime numbers */}
      <section aria-label="Lifetime stats" className="rounded-[20px] bg-surface-subtle p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
          {lifetime.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse">
              <dt className="mt-1.5 text-caption text-ink-muted">{s.label}</dt>
              <dd className="truncate font-display font-tabular text-display leading-none text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTab)}>
        <TabsList className="flex w-full">
          <TabsTrigger value="history" className="flex-1 px-2">History</TabsTrigger>
          <TabsTrigger value="workouts" className="flex-1 px-2">Saved</TabsTrigger>
          <TabsTrigger value="exercises" className="flex-1 px-2">Exercises</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 px-2">Settings</TabsTrigger>
        </TabsList>

        {/* History */}
        <TabsContent value="history" className="mt-6 flex flex-col gap-8">
          <section aria-label="Sessions">
            <SectionHeader
              title="Sessions"
              meta={
                isLoadingCompletedWorkouts
                  ? undefined
                  : `${completedWorkouts.length} completed`
              }
              action={
                completedWorkouts.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setIsHistoryManagerOpen(true)}>
                    Manage
                  </Button>
                )
              }
            />

            {isLoadingCompletedWorkouts ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))}
              </div>
            ) : completedWorkouts.length > 0 ? (
              <ul className="overflow-hidden rounded-[20px] bg-surface-subtle [&>li+li]:border-t [&>li+li]:border-hairline">
                {completedWorkouts.map((workout) => (
                  <CompletedWorkoutCard
                    key={workout.id}
                    workout={workout}
                    userId={user.uid}
                    onWorkoutUpdated={reloadCompletedWorkouts}
                    onWorkoutDeleted={reloadCompletedWorkouts}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-[20px] bg-surface-subtle px-5 py-6">
                <p className="text-body font-semibold text-ink">No sessions yet</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Finish your first workout and it shows up here.
                </p>
                <Button className="mt-4" onClick={() => navigate('/build')}>
                  Start a workout
                </Button>
              </div>
            )}
          </section>

          {user?.uid && (
            <AllExercisesHistory
              userId={user.uid}
              limit={100}
              onManualAddClick={handleOpenManualLogger}
              exercises={exerciseDatabase}
              isLoadingExercises={isLoadingExercises}
              refreshTrigger={refreshTrigger}
            />
          )}
        </TabsContent>

        {/* Saved Workouts */}
        <TabsContent value="workouts" className="mt-6">
          <section aria-label="Saved workouts">
            <SectionHeader
              title="Saved workouts"
              meta={isLoadingSavedWorkouts ? undefined : `${savedWorkouts.length} saved`}
            />

            {isLoadingSavedWorkouts ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))}
              </div>
            ) : savedWorkouts.length > 0 ? (
              <ul className="overflow-hidden rounded-[20px] bg-surface-subtle [&>li+li]:border-t [&>li+li]:border-hairline">
                {savedWorkouts.map((workout) => (
                  <li key={workout.id}>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => {
                        setOpenSaved(workout);
                        setIsSavedSheetOpen(true);
                      }}
                      className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink">{workout.name}</span>
                        <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                          {exerciseCount(workout)} exercises
                          {workout.estimatedDuration ? ` · ~${workout.estimatedDuration} min` : ''} · {workout.difficulty}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-num font-tabular font-wide text-title font-bold text-ink">
                          {workout.performanceCount}
                        </span>
                        <span className="block text-caption text-ink-muted">
                          {workout.performanceCount === 1 ? 'run' : 'runs'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-[20px] bg-surface-subtle px-5 py-6">
                <p className="text-body font-semibold text-ink">No saved workouts</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Build and save a workout to reuse it here.
                </p>
              </div>
            )}
          </section>
        </TabsContent>

        {/* Custom Exercises */}
        <TabsContent value="exercises" className="mt-6">
          <CustomExerciseList />
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-6 flex flex-col gap-6">
          <SettingsGroup title="Workout">
            <SettingsRow>
              <span className="text-body font-medium text-ink">Weight unit</span>
              <Segmented<'lbs' | 'kg'>
                label="Weight unit"
                value={preferences.weightUnit}
                onChange={handleWeightUnitChange}
                options={[
                  { value: 'lbs', label: 'lbs' },
                  { value: 'kg', label: 'kg' },
                ]}
              />
            </SettingsRow>

            <SettingsRow>
              <Label htmlFor="settings-rest-time" className="text-body font-medium">
                Default rest
              </Label>
              <Select
                value={String(preferences.defaultRestTime)}
                onValueChange={(value) => handleRestTimeChange(Number(value))}
              >
                <SelectTrigger id="settings-rest-time" className="w-36 shrink-0 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="90">1.5 minutes</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="240">4 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow>
              <Label htmlFor="settings-auto-timer" className="text-body font-medium">
                Auto-start rest timer
              </Label>
              <Switch
                id="settings-auto-timer"
                checked={preferences.autoStartTimer}
                onCheckedChange={() => dispatch(toggleAutoStartTimer())}
                aria-label="Auto-start rest timer"
              />
            </SettingsRow>

            <SettingsRow className="flex-col items-stretch gap-3">
              <div>
                <p className="text-body font-medium text-ink">Progression</p>
                <p className="text-body-sm text-ink-muted">
                  {PROGRESSION_HINT[preferences.defaultProgressionRate] ??
                    'How quickly suggested weights climb.'}
                </p>
              </div>
              <Segmented<'beginner' | 'intermediate' | 'advanced'>
                label="Default progression rate"
                value={preferences.defaultProgressionRate}
                onChange={handleProgressionRateChange}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Keyboard">
            <SettingsRow>
              <div className="min-w-0">
                <Label htmlFor="settings-kbd-enabled" className="text-body font-medium">
                  Keyboard shortcuts
                </Label>
                <p className="text-body-sm text-ink-muted">Use shortcuts during workouts.</p>
              </div>
              <Switch
                id="settings-kbd-enabled"
                checked={preferences.keyboardShortcuts.enabled}
                onCheckedChange={() => dispatch(toggleKeyboardShortcuts())}
                aria-label="Enable keyboard shortcuts"
              />
            </SettingsRow>

            <SettingsRow>
              <div className="min-w-0">
                <Label
                  htmlFor="settings-kbd-display"
                  disabled={!preferences.keyboardShortcuts.enabled}
                  className="text-body font-medium"
                >
                  Show shortcuts panel
                </Label>
                <p className="text-body-sm text-ink-muted">Open the shortcut list by default in a workout.</p>
              </div>
              <Switch
                id="settings-kbd-display"
                checked={preferences.keyboardShortcuts.showInWorkout && preferences.keyboardShortcuts.enabled}
                onCheckedChange={() => dispatch(toggleKeyboardShortcutsDisplay())}
                disabled={!preferences.keyboardShortcuts.enabled}
                aria-label="Show shortcuts panel in workout"
              />
            </SettingsRow>

            {preferences.keyboardShortcuts.enabled && (
              <SettingsRow className="block">
                <p className="mb-2 text-body-sm font-semibold text-ink-muted">Shortcuts</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-3 text-body-sm">
                      <dt className="text-ink-muted">{s.label}</dt>
                      <dd>
                        <kbd className="rounded-full bg-surface-raised px-2.5 py-0.5 font-sans text-caption text-ink">
                          {s.key}
                        </kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </SettingsRow>
            )}
          </SettingsGroup>

          <SettingsGroup title="App">
            <SettingsRow>
              <span className="text-body font-medium text-ink">Unit system</span>
              <Segmented<'imperial' | 'metric'>
                label="Unit system"
                value={preferences.unitSystem}
                onChange={handleUnitSystemChange}
                options={[
                  { value: 'imperial', label: 'Imperial' },
                  { value: 'metric', label: 'Metric' },
                ]}
              />
            </SettingsRow>
          </SettingsGroup>
        </TabsContent>
      </Tabs>

      {/* Saved workout detail */}
      <Sheet open={isSavedSheetOpen} onOpenChange={setIsSavedSheetOpen}>
        <SheetContent className="mx-auto max-w-lg">
          {openSaved && (
            <>
              <SheetTitle className="text-title">{openSaved.name}</SheetTitle>
              <SheetDescription>
                {openSaved.description || `${openSaved.difficulty} workout`}
              </SheetDescription>

              <dl className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Exercises', value: exerciseCount(openSaved) },
                  { label: 'Minutes', value: openSaved.estimatedDuration ? `~${openSaved.estimatedDuration}` : '—' },
                  { label: 'Times done', value: openSaved.performanceCount },
                ].map((s) => (
                  <div key={s.label} className="flex min-w-0 flex-col-reverse">
                    <dt className="mt-1.5 text-caption text-ink-muted">{s.label}</dt>
                    <dd className="truncate font-display font-tabular text-display leading-none text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 text-body-sm text-ink-muted">
                {openSaved.difficulty}
                {openSaved.lastPerformedAt && ` · last done ${formatShortDate(openSaved.lastPerformedAt)}`}
              </p>

              {openSaved.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
                  {openSaved.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-surface-raised px-3 py-1 text-caption text-ink-muted">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}

              <Button size="xl" className="mt-6" onClick={() => handleStartWorkout(openSaved)}>
                Start workout
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual Exercise Logger Modal */}
      {user?.uid && (
        <ManualExerciseLogger
          isOpen={isManualLoggerOpen}
          onClose={() => setIsManualLoggerOpen(false)}
          onSuccess={() => {
            // Trigger refresh of exercise history
            setRefreshTrigger(prev => prev + 1);
            setIsManualLoggerOpen(false);
          }}
          userId={user.uid}
          exercises={exerciseDatabase}
          isLoadingExercises={isLoadingExercises}
          exerciseError={exerciseError}
        />
      )}

      {/* Workout History Manager Modal */}
      {user?.uid && (
        <WorkoutHistoryManager
          isOpen={isHistoryManagerOpen}
          onClose={() => setIsHistoryManagerOpen(false)}
          onHistoryUpdated={() => {
            // Reload completed workouts
            const loadCompletedWorkouts = async () => {
              try {
                setIsLoadingCompletedWorkouts(true);
                const updatedWorkouts = await ExerciseHistoryService.getWorkoutHistory(user.uid, 50);
                setCompletedWorkouts(updatedWorkouts);
              } catch (error) {
                console.error('Error reloading completed workouts:', error);
              } finally {
                setIsLoadingCompletedWorkouts(false);
              }
            };
            loadCompletedWorkouts();
          }}
          userId={user.uid}
          initialWorkouts={completedWorkouts}
        />
      )}
    </div>
  );
}
