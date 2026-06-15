import React, { useEffect, useState } from 'react';
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
import { History, Trophy, Calendar, TrendingUp, Play, Dumbbell } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'workouts' | 'history' | 'exercises' | 'settings'>('overview');
  const [isManualLoggerOpen, setIsManualLoggerOpen] = useState(false);
  const [isHistoryManagerOpen, setIsHistoryManagerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleWeightUnitChange = (unit: 'lbs' | 'kg') => {
    dispatch(setWeightUnit(unit));
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    dispatch(setTheme(theme));
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

  const TabButton: React.FC<{
    tab: typeof activeTab;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void
  }> = ({ icon, label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  // Guard against a null auth user (e.g. sign-out while the profile is mounted).
  // Everything below dereferences `user.uid`, so narrow it here.
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-full bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Profile & Dashboard</h1>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <TabButton
            tab="overview"
            icon={<TrendingUp className="h-4 w-4" />}
            label="Overview"
            isActive={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <TabButton
            tab="workouts"
            icon={<Play className="h-4 w-4" />}
            label="Saved Workouts"
            isActive={activeTab === 'workouts'}
            onClick={() => setActiveTab('workouts')}
          />
          <TabButton
            tab="history"
            icon={<History className="h-4 w-4" />}
            label="Workout History"
            isActive={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
          <TabButton
            tab="exercises"
            icon={<Dumbbell className="h-4 w-4" />}
            label="Custom Exercises"
            isActive={activeTab === 'exercises'}
            onClick={() => setActiveTab('exercises')}
          />
          <TabButton
            tab="settings"
            icon={<Trophy className="h-4 w-4" />}
            label="Settings"
            isActive={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* User Info Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">User Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">{profile?.displayName || 'User'}</p>
                    <p className="text-gray-400 text-sm">{profile?.email || 'No email'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats.totalWorkouts}</div>
                  <div className="text-gray-400 text-sm">Total Workouts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.currentStreak}</div>
                  <div className="text-gray-400 text-sm">Current Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.totalSets}</div>
                  <div className="text-gray-400 text-sm">Total Sets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">{Math.round(stats.totalWorkoutTime / 60)}m</div>
                  <div className="text-gray-400 text-sm">Total Time</div>
                </div>
              </div>
            </div>

            {/* Recent Workouts */}
            <div className="bg-gray-800 rounded-lg p-6 md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Recent Workout Sessions</h2>
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-700 h-16 rounded"></div>
                  ))}
                </div>
              ) : workoutHistory.length > 0 ? (
                <div className="space-y-3">
                  {workoutHistory.slice(0, 5).map((workout) => (
                    <div key={workout.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{workout.name}</h3>
                          <p className="text-sm text-gray-400">
                            {workout.totalExercises} exercises • {workout.totalSets} sets • {workout.duration}min
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm text-gray-400">{formatDate(workout.endTime)}</p>
                            <p className="text-xs text-green-400">{workout.totalVolume.toLocaleString()} total volume</p>
                          </div>
                          <button
                            onClick={() => handleStartWorkoutFromHistory(workout)}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            title="Start this workout again"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No workout sessions yet. Complete a workout to see your history!</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'workouts' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Saved Workout Templates</h2>
                <span className="text-sm text-gray-400">{savedWorkouts.length} saved workouts</span>
              </div>

              {isLoadingSavedWorkouts ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-700 h-20 rounded"></div>
                  ))}
                </div>
              ) : savedWorkouts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {savedWorkouts.map((workout) => (
                    <div key={workout.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-white">{workout.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          workout.difficulty === 'Beginner' ? 'bg-green-600' :
                          workout.difficulty === 'Intermediate' ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}>
                          {workout.difficulty}
                        </span>
                      </div>

                      {workout.description && (
                        <p className="text-sm text-gray-400 mb-3">{workout.description}</p>
                      )}

                      <div className="text-xs text-gray-400 space-y-1">
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
                            <span key={tag} className="px-2 py-1 bg-gray-600 rounded text-xs text-gray-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Start Workout Button */}
                      <button
                        onClick={() => handleStartWorkout(workout)}
                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Workout
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Play className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No Saved Workouts</h3>
                  <p className="text-gray-400">Build and save your first workout to see it here!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Completed Workouts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Completed Workouts</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">
                    {completedWorkouts.length} workout{completedWorkouts.length !== 1 ? 's' : ''} completed
                  </span>
                  {completedWorkouts.length > 0 && (
                    <button
                      onClick={() => setIsHistoryManagerOpen(true)}
                      className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      <History className="h-4 w-4" />
                      Manage History
                    </button>
                  )}
                </div>
              </div>

              {isLoadingCompletedWorkouts ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-700 h-32 rounded-lg"></div>
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
                <div className="bg-gray-800 rounded-lg p-12 text-center">
                  <History className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No Completed Workouts</h3>
                  <p className="text-gray-400 mb-4">Complete your first workout to see your history here!</p>
                  <button
                    onClick={() => navigate('/build')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Start a Workout
                  </button>
                </div>
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
        )}

        {activeTab === 'exercises' && (
          <div className="space-y-6">
            <CustomExerciseList />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Workout Preferences */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Workout Preferences</h2>
              <div className="space-y-4">
                {/* Weight Unit */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Weight Unit
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleWeightUnitChange('lbs')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.weightUnit === 'lbs'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      lbs
                    </button>
                    <button
                      onClick={() => handleWeightUnitChange('kg')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.weightUnit === 'kg'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      kg
                    </button>
                  </div>
                </div>

                {/* Default Rest Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Rest Time
                  </label>
                  <select
                    value={preferences.defaultRestTime}
                    onChange={(e) => handleRestTimeChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={90}>1.5 minutes</option>
                    <option value={120}>2 minutes</option>
                    <option value={180}>3 minutes</option>
                    <option value={240}>4 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>

                {/* Auto Start Timer */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">
                    Auto-start rest timer
                  </label>
                  <button
                    onClick={() => dispatch(toggleAutoStartTimer())}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.autoStartTimer ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.autoStartTimer ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Default Progression Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Progression Rate
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Your preferred workout intensity and progression speed
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProgressionRateChange('beginner')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.defaultProgressionRate === 'beginner'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Beginner
                    </button>
                    <button
                      onClick={() => handleProgressionRateChange('intermediate')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.defaultProgressionRate === 'intermediate'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Intermediate
                    </button>
                    <button
                      onClick={() => handleProgressionRateChange('advanced')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.defaultProgressionRate === 'advanced'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Advanced
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {preferences.defaultProgressionRate === 'beginner' && 'Slower progression with more conservative weight increases'}
                    {preferences.defaultProgressionRate === 'intermediate' && 'Balanced progression with moderate weight increases'}
                    {preferences.defaultProgressionRate === 'advanced' && 'Faster progression with more aggressive weight increases'}
                  </div>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h2>
              <div className="space-y-4">
                {/* Enable Keyboard Shortcuts */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-300">
                      Enable keyboard shortcuts
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Allow keyboard shortcuts during workouts
                    </p>
                  </div>
                  <button
                    onClick={() => dispatch(toggleKeyboardShortcuts())}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.keyboardShortcuts.enabled ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.keyboardShortcuts.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Shortcuts Panel */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-300">
                      Show shortcuts panel in workout
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Display the keyboard shortcuts panel by default during workouts
                    </p>
                  </div>
                  <button
                    onClick={() => dispatch(toggleKeyboardShortcutsDisplay())}
                    disabled={!preferences.keyboardShortcuts.enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.keyboardShortcuts.showInWorkout && preferences.keyboardShortcuts.enabled
                        ? 'bg-blue-600'
                        : 'bg-gray-600'
                    } ${!preferences.keyboardShortcuts.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.keyboardShortcuts.showInWorkout && preferences.keyboardShortcuts.enabled
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Keyboard Shortcuts Reference */}
                {preferences.keyboardShortcuts.enabled && (
                  <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-3">Available Shortcuts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Complete Set:</span>
                        <kbd className="bg-gray-600 px-2 py-1 rounded text-white text-xs">Space</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Next Set:</span>
                        <kbd className="bg-gray-600 px-2 py-1 rounded text-white text-xs">N</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Previous Set:</span>
                        <kbd className="bg-gray-600 px-2 py-1 rounded text-white text-xs">P</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Rest Timer:</span>
                        <kbd className="bg-gray-600 px-2 py-1 rounded text-white text-xs">R</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Uncomplete:</span>
                        <kbd className="bg-gray-600 px-2 py-1 rounded text-white text-xs">U</kbd>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* App Settings */}
            <div className="bg-gray-800 rounded-lg p-6 md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">App Settings</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Theme
                  </label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'system')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="system">System</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>

                {/* Unit System */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Unit System
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUnitSystemChange('imperial')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.unitSystem === 'imperial'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Imperial
                    </button>
                    <button
                      onClick={() => handleUnitSystemChange('metric')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        preferences.unitSystem === 'metric'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Metric
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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