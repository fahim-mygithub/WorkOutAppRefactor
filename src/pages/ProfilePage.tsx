import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { setWeightUnit, setTheme, setUnitSystem, setDefaultRestTime, toggleAutoStartTimer, setDefaultProgressionRate, toggleKeyboardShortcuts, toggleKeyboardShortcutsDisplay } from '../store/slices/userSlice';
import { loadWorkoutHistory } from '../store/slices/exerciseHistorySlice';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { startWorkout } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { AllExercisesHistory } from '../components/profile/AllExercisesHistory';
import { ManualExerciseLogger } from '../components/profile/ManualExerciseLogger';
import { WorkoutHistoryManager } from '../components/profile/WorkoutHistoryManager';
import { CompletedWorkoutCard } from '../components/profile/CompletedWorkoutCard';
import { CustomExerciseList } from '../components/profile/CustomExerciseList';
import { SavedWorkout } from '../services/workoutStorageService';
import { WorkoutSummary } from '../types/exerciseHistory';
import { convertSavedWorkoutToExercises, sanitizeWorkoutExercisesForRedux, convertWorkoutHistoryToExercises } from '../utils/workoutConversion';
import { useExercises } from '../hooks/useExercises';
import { History, Trophy, TrendingUp, Play, Dumbbell, Moon } from 'lucide-react';
import { Card, CardBody } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { IconButton } from '../components/ui/icon-button';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Stack } from '../components/ui/stack';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

type ProfileTab = 'overview' | 'workouts' | 'history' | 'exercises' | 'settings';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth(); // Get Firebase user from auth context
  const { profile, preferences, stats } = useAppSelector((state) => state.user); // Get profile data from Redux
  const { workoutHistory, isLoadingHistory } = useAppSelector((state) => state.exerciseHistory);
  const { exercises: exerciseDatabase, isLoading: isLoadingExercises, error: exerciseError } = useExercises(); // Get exercise database
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [isLoadingSavedWorkouts, setIsLoadingSavedWorkouts] = useState(true);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSummary[]>([]);
  const [isLoadingCompletedWorkouts, setIsLoadingCompletedWorkouts] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isManualLoggerOpen, setIsManualLoggerOpen] = useState(false);
  const [isHistoryManagerOpen, setIsHistoryManagerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // Theme toggle: dark-first. The Switch reflects whether the effective theme is
  // dark; flipping it dispatches setTheme, which ThemeProvider reads to toggle
  // the .dark class on <html>. 'system' is treated as dark for the toggle's
  // checked state (dark-first default).
  const isDarkTheme = preferences.theme !== 'light';
  const handleThemeToggle = (checked: boolean) => {
    dispatch(setTheme(checked ? 'dark' : 'light'));
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

  // Handle starting a workout from workout history
  const handleStartWorkoutFromHistory = async (workoutSummary: WorkoutSummary) => {
    if (!user?.uid) {
      alert('You must be logged in to start a workout.');
      return;
    }

    if (!exerciseDatabase.length) {
      alert('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      // Get the exercise history for this workout
      // Use the original workoutId if available, otherwise fall back to the document ID
      const workoutIdToQuery = workoutSummary.workoutId || workoutSummary.id;
      const exerciseHistories = await ExerciseHistoryService.getExerciseHistoryByWorkoutId(
        user.uid,
        workoutIdToQuery
      );

      if (!exerciseHistories.length) {
        alert('Unable to load workout details. The workout may not have detailed exercise information.');
        return;
      }

      // Convert to workout exercises
      const { exercises, workoutName } = convertWorkoutHistoryToExercises(
        exerciseHistories,
        exerciseDatabase,
        workoutSummary
      );

      if (exercises.length === 0) {
        alert('No valid exercises found in this workout.');
        return;
      }

      // Sanitize exercises for Redux
      const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);

      // Start the workout
      dispatch(startWorkout({
        name: workoutName,
        exercises: sanitizedExercises,
      }));

      // Navigate to workout page
      navigate('/workout');
    } catch (error) {
      console.error('Error starting workout from history:', error);
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

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  };

  // Guard against a null auth user (e.g. sign-out while the profile is mounted).
  // Everything below dereferences `user.uid`, so narrow it here.
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-full bg-surface text-ink p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-display font-bold mb-8">Profile & Dashboard</h1>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTab)}>
          {/* Tab Navigation */}
          <div className="overflow-x-auto mb-6">
            <TabsList>
              <TabsTrigger value="overview">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="workouts">
                <Play className="h-4 w-4" />
                Saved Workouts
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4" />
                Workout History
              </TabsTrigger>
              <TabsTrigger value="exercises">
                <Dumbbell className="h-4 w-4" />
                Custom Exercises
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Trophy className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              {/* User Info Section */}
              <Card elevation={1}>
                <CardBody className="p-6">
                  <h2 className="text-body font-semibold mb-4">User Information</h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-accent-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">{profile?.displayName || 'User'}</p>
                        <p className="text-ink-muted text-body-sm">{profile?.email || 'No email'}</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Quick Stats */}
              <Card elevation={1}>
                <CardBody className="p-6">
                  <h2 className="text-body font-semibold mb-4">Quick Stats</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-display font-bold text-accent">{stats.totalWorkouts}</div>
                      <div className="text-ink-muted text-body-sm">Total Workouts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-display font-bold text-success">{stats.currentStreak}</div>
                      <div className="text-ink-muted text-body-sm">Current Streak</div>
                    </div>
                    <div className="text-center">
                      <div className="text-display font-bold text-muscle-core">{stats.totalSets}</div>
                      <div className="text-ink-muted text-body-sm">Total Sets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-display font-bold text-muscle-legs">{Math.round(stats.totalWorkoutTime / 60)}m</div>
                      <div className="text-ink-muted text-body-sm">Total Time</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Recent Workouts */}
              <Card elevation={1} className="md:col-span-2">
                <CardBody className="p-6">
                  <h2 className="text-body font-semibold mb-4">Recent Workout Sessions</h2>
                  {isLoadingHistory ? (
                    <div className="space-y-3" aria-busy="true">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : workoutHistory.length > 0 ? (
                    <div className="space-y-3">
                      {workoutHistory.slice(0, 5).map((workout) => (
                        <div key={workout.id} className="bg-surface-subtle rounded-md p-4 hover:bg-surface-raised transition-colors duration-snap">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-ink">{workout.name}</h3>
                              <p className="text-body-sm text-ink-muted">
                                {workout.totalExercises} exercises • {workout.totalSets} sets • {workout.duration}min
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-body-sm text-ink-muted">{formatDate(workout.endTime)}</p>
                                <p className="text-caption text-success">{workout.totalVolume.toLocaleString()} total volume</p>
                              </div>
                              <IconButton
                                size="sm"
                                aria-label="Start this workout again"
                                onClick={() => handleStartWorkoutFromHistory(workout)}
                              >
                                <Play className="h-4 w-4" />
                              </IconButton>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-ink-muted">No workout sessions yet. Complete a workout to see your history!</p>
                  )}
                </CardBody>
              </Card>
            </div>
          </TabsContent>

          {/* Saved Workouts */}
          <TabsContent value="workouts">
            <div className="space-y-6">
              <Card elevation={1}>
                <CardBody className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-body font-semibold">Saved Workout Templates</h2>
                    <span className="text-body-sm text-ink-muted">{savedWorkouts.length} saved workouts</span>
                  </div>

                  {isLoadingSavedWorkouts ? (
                    <div className="space-y-3" aria-busy="true">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : savedWorkouts.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {savedWorkouts.map((workout) => (
                        <div key={workout.id} className="bg-surface-subtle rounded-md p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-ink">{workout.name}</h3>
                            <span className={`px-2 py-1 rounded text-caption text-ink-inverse ${
                              workout.difficulty === 'Beginner' ? 'bg-success' :
                              workout.difficulty === 'Intermediate' ? 'bg-warning' :
                              'bg-danger'
                            }`}>
                              {workout.difficulty}
                            </span>
                          </div>

                          {workout.description && (
                            <p className="text-body-sm text-ink-muted mb-3">{workout.description}</p>
                          )}

                          <div className="text-caption text-ink-muted space-y-1">
                            <p>Exercises: {workout.parsedWorkout.exercises.length + workout.parsedWorkout.supersets.flat().length}</p>
                            <p>Duration: ~{workout.estimatedDuration}min</p>
                            <p>Performed: {workout.performanceCount} times</p>
                            {workout.lastPerformedAt && (
                              <p>Last: {formatDate(workout.lastPerformedAt)}</p>
                            )}
                          </div>

                          {workout.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {workout.tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 bg-surface-raised rounded text-caption text-ink-muted">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Start Workout Button */}
                          <Button
                            onClick={() => handleStartWorkout(workout)}
                            className="w-full mt-4"
                          >
                            <Play className="h-4 w-4" />
                            Start Workout
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Play className="h-12 w-12 text-ink-subtle mx-auto mb-4" />
                      <h3 className="text-body font-medium text-ink mb-2">No Saved Workouts</h3>
                      <p className="text-ink-muted">Build and save your first workout to see it here!</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </TabsContent>

          {/* Workout History */}
          <TabsContent value="history">
            <div className="space-y-6">
              {/* Completed Workouts Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-body font-semibold">Completed Workouts</h2>
                  <div className="flex items-center gap-4">
                    <span className="text-body-sm text-ink-muted">
                      {completedWorkouts.length} workout{completedWorkouts.length !== 1 ? 's' : ''} completed
                    </span>
                    {completedWorkouts.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsHistoryManagerOpen(true)}
                      >
                        <History className="h-4 w-4" />
                        Manage History
                      </Button>
                    )}
                  </div>
                </div>

                {isLoadingCompletedWorkouts ? (
                  <div className="space-y-4" aria-busy="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-32" />
                    ))}
                  </div>
                ) : completedWorkouts.length > 0 ? (
                  <div className="space-y-4">
                    {completedWorkouts.map((workout) => (
                      <CompletedWorkoutCard
                        key={workout.id}
                        workout={workout}
                        userId={user.uid}
                        onWorkoutUpdated={() => {
                          // Reload completed workouts
                          const loadCompletedWorkouts = async () => {
                            try {
                              const updatedWorkouts = await ExerciseHistoryService.getWorkoutHistory(user.uid, 50);
                              setCompletedWorkouts(updatedWorkouts);
                            } catch (error) {
                              console.error('Error reloading completed workouts:', error);
                            }
                          };
                          loadCompletedWorkouts();
                        }}
                        onWorkoutDeleted={() => {
                          // Reload completed workouts
                          const loadCompletedWorkouts = async () => {
                            try {
                              const updatedWorkouts = await ExerciseHistoryService.getWorkoutHistory(user.uid, 50);
                              setCompletedWorkouts(updatedWorkouts);
                            } catch (error) {
                              console.error('Error reloading completed workouts:', error);
                            }
                          };
                          loadCompletedWorkouts();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Card elevation={1}>
                    <CardBody className="p-12 text-center">
                      <History className="h-16 w-16 text-ink-subtle mx-auto mb-4" />
                      <h3 className="text-title font-medium text-ink mb-2">No Completed Workouts</h3>
                      <p className="text-ink-muted mb-4">Complete your first workout to see your history here!</p>
                      <Button onClick={() => navigate('/build')}>
                        Start a Workout
                      </Button>
                    </CardBody>
                  </Card>
                )}
              </div>

              {/* Exercise History Section */}
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
            </div>
          </TabsContent>

          {/* Custom Exercises */}
          <TabsContent value="exercises">
            <div className="space-y-6">
              <CustomExerciseList />
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Workout Preferences */}
              <Card elevation={1}>
                <CardBody className="p-6">
                  <h2 className="text-body font-semibold mb-4">Workout Preferences</h2>
                  <div className="space-y-4">
                    {/* Weight Unit */}
                    <Stack gap={2}>
                      <Label>Weight Unit</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={preferences.weightUnit === 'lbs' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleWeightUnitChange('lbs')}
                        >
                          lbs
                        </Button>
                        <Button
                          variant={preferences.weightUnit === 'kg' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleWeightUnitChange('kg')}
                        >
                          kg
                        </Button>
                      </div>
                    </Stack>

                    {/* Default Rest Time */}
                    <Stack gap={2}>
                      <Label htmlFor="settings-rest-time">Default Rest Time</Label>
                      <Select
                        value={String(preferences.defaultRestTime)}
                        onValueChange={(value) => handleRestTimeChange(Number(value))}
                      >
                        <SelectTrigger id="settings-rest-time">
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
                    </Stack>

                    {/* Auto Start Timer */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="settings-auto-timer">Auto-start rest timer</Label>
                      <Switch
                        id="settings-auto-timer"
                        checked={preferences.autoStartTimer}
                        onCheckedChange={() => dispatch(toggleAutoStartTimer())}
                        aria-label="Auto-start rest timer"
                      />
                    </div>

                    {/* Default Progression Rate */}
                    <Stack gap={2}>
                      <Label>Default Progression Rate</Label>
                      <p className="text-caption text-ink-subtle">
                        Your preferred workout intensity and progression speed
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant={preferences.defaultProgressionRate === 'beginner' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleProgressionRateChange('beginner')}
                        >
                          Beginner
                        </Button>
                        <Button
                          variant={preferences.defaultProgressionRate === 'intermediate' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleProgressionRateChange('intermediate')}
                        >
                          Intermediate
                        </Button>
                        <Button
                          variant={preferences.defaultProgressionRate === 'advanced' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleProgressionRateChange('advanced')}
                        >
                          Advanced
                        </Button>
                      </div>
                      <div className="text-caption text-ink-subtle">
                        {preferences.defaultProgressionRate === 'beginner' && 'Slower progression with more conservative weight increases'}
                        {preferences.defaultProgressionRate === 'intermediate' && 'Balanced progression with moderate weight increases'}
                        {preferences.defaultProgressionRate === 'advanced' && 'Faster progression with more aggressive weight increases'}
                      </div>
                    </Stack>
                  </div>
                </CardBody>
              </Card>

              {/* Keyboard Shortcuts Settings */}
              <Card elevation={1}>
                <CardBody className="p-6">
                  <h2 className="text-body font-semibold mb-4">Keyboard Shortcuts</h2>
                  <div className="space-y-4">
                    {/* Enable Keyboard Shortcuts */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="settings-kbd-enabled">Enable keyboard shortcuts</Label>
                        <p className="text-caption text-ink-subtle mt-1">
                          Allow keyboard shortcuts during workouts
                        </p>
                      </div>
                      <Switch
                        id="settings-kbd-enabled"
                        checked={preferences.keyboardShortcuts.enabled}
                        onCheckedChange={() => dispatch(toggleKeyboardShortcuts())}
                        aria-label="Enable keyboard shortcuts"
                      />
                    </div>

                    {/* Show Shortcuts Panel */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="settings-kbd-display" disabled={!preferences.keyboardShortcuts.enabled}>
                          Show shortcuts panel in workout
                        </Label>
                        <p className="text-caption text-ink-subtle mt-1">
                          Display the keyboard shortcuts panel by default during workouts
                        </p>
                      </div>
                      <Switch
                        id="settings-kbd-display"
                        checked={preferences.keyboardShortcuts.showInWorkout && preferences.keyboardShortcuts.enabled}
                        onCheckedChange={() => dispatch(toggleKeyboardShortcutsDisplay())}
                        disabled={!preferences.keyboardShortcuts.enabled}
                        aria-label="Show shortcuts panel in workout"
                      />
                    </div>

                    {/* Keyboard Shortcuts Reference */}
                    {preferences.keyboardShortcuts.enabled && (
                      <div className="mt-4 p-4 bg-surface-subtle rounded-md">
                        <h3 className="text-body-sm font-medium text-ink mb-3">Available Shortcuts</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-body-sm">
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Complete Set:</span>
                            <kbd className="bg-surface-raised px-2 py-1 rounded text-ink text-caption">Space</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Next Set:</span>
                            <kbd className="bg-surface-raised px-2 py-1 rounded text-ink text-caption">N</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Previous Set:</span>
                            <kbd className="bg-surface-raised px-2 py-1 rounded text-ink text-caption">P</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Rest Timer:</span>
                            <kbd className="bg-surface-raised px-2 py-1 rounded text-ink text-caption">R</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-muted">Uncomplete:</span>
                            <kbd className="bg-surface-raised px-2 py-1 rounded text-ink text-caption">U</kbd>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* App Settings */}
              <Card elevation={1} className="md:col-span-2">
                <CardBody className="p-6">
                  <h2 className="text-body font-semibold mb-4">App Settings</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Theme Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="settings-theme-toggle" className="gap-2">
                          <Moon className="h-4 w-4" />
                          Dark Mode
                        </Label>
                        <p className="text-caption text-ink-subtle mt-1">
                          Toggle between dark and light appearance
                        </p>
                      </div>
                      <Switch
                        id="settings-theme-toggle"
                        checked={isDarkTheme}
                        onCheckedChange={handleThemeToggle}
                        aria-label="Toggle dark mode"
                      />
                    </div>

                    {/* Unit System */}
                    <Stack gap={2}>
                      <Label>Unit System</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={preferences.unitSystem === 'imperial' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleUnitSystemChange('imperial')}
                        >
                          Imperial
                        </Button>
                        <Button
                          variant={preferences.unitSystem === 'metric' ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleUnitSystemChange('metric')}
                        >
                          Metric
                        </Button>
                      </div>
                    </Stack>
                  </div>
                </CardBody>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

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
