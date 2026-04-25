import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { SharedWorkoutLoader } from '../components/SharedWorkoutLoader';
import { SharedWorkoutStartPage } from '../components/SharedWorkoutStartPage';
import { incrementWorkoutUseCount } from '../store/slices/sharedWorkoutSlice';
import { loadWorkoutContext, loadPreviousPerformance } from '../store/slices/exerciseHistorySlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import {
  startWorkout,
  endWorkout,
  nextExercise,
  previousExercise,
  completeSet,
  uncompleteSet,
  addSet,
  jumpToSet,
  startRestTimer,
  stopRestTimer,
  updateWorkoutDuration,
  nextSupersetExercise,
  completeSuperset,
  advanceToNextSupersetRound,
  updateExercise,
  updateExerciseNotesAndTitle,
  setShowCompletionModal,
  setExperienceLevel,
  setProgressionTracking,
  recordProgressionOutcome
} from '../store/slices/workoutSlice';
import { RestTimer } from '../components/RestTimer';
import { ExerciseVideo } from '../components/ExerciseVideo';
import { DualViewVideo } from '../components/DualViewVideo';
import { SupersetExerciseCard } from '../components/SupersetExerciseCard';
import { SetInput } from '../components/SetInput';
import { ExerciseEditModal } from '../components/ExerciseEditModal';
import { PreviousPerformance } from '../components/workout/PreviousPerformance';
import { ExerciseNotesEditor } from '../components/workout/ExerciseNotesEditor';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { WeightProgressionSlider } from '../components/workout/WeightProgressionSlider';
import { DeloadSuggestion } from '../components/workout/DeloadSuggestion';
import { FatigueCheck } from '../components/workout/FatigueCheck';
import { useProgressionRecommendation } from '../hooks/useProgressionRecommendation';
import { Play, Pause, SkipForward, SkipBack, Plus, Check, X, Edit } from 'lucide-react';
import { WorkoutExercise, WorkoutSet } from '../types/exercise';

// Helper interface for grouped exercise display
interface ExerciseDisplayGroup {
  id: string;
  name: string;
  isSuperset: boolean;
  exercises: WorkoutExercise[];
  totalSets: number;
  completedSets: number;
  isActive: boolean;
}

// Helper function to group exercises for display purposes
const getGroupedExercisesForDisplay = (exercises: WorkoutExercise[], currentExerciseIndex: number): ExerciseDisplayGroup[] => {
  const groups: ExerciseDisplayGroup[] = [];
  const processedExerciseIds = new Set<string>();

  exercises.forEach((exercise, index) => {
    // Skip if already processed as part of a superset
    if (processedExerciseIds.has(exercise.id)) return;

    if (exercise.isSuperset && exercise.supersetId) {
      // Find all exercises in this superset
      const supersetExercises = exercises.filter(ex =>
        ex.supersetId === exercise.supersetId
      );

      // Mark all superset exercises as processed
      supersetExercises.forEach(ex => processedExerciseIds.add(ex.id));

      // Calculate totals for the superset
      const totalSets = supersetExercises.reduce((total, ex) => total + ex.sets.length, 0);
      const completedSets = supersetExercises.reduce((total, ex) =>
        total + ex.sets.filter(set => set.completed).length, 0);

      // Check if any exercise in the superset is currently active
      const isActive = supersetExercises.some(ex =>
        exercises.findIndex(e => e.id === ex.id) === currentExerciseIndex
      );

      groups.push({
        id: exercise.supersetId,
        name: supersetExercises.map(ex => ex.customTitle || ex.exercise.name).join(' + '),
        isSuperset: true,
        exercises: supersetExercises,
        totalSets,
        completedSets,
        isActive
      });
    } else {
      // Regular exercise
      processedExerciseIds.add(exercise.id);

      groups.push({
        id: exercise.id,
        name: exercise.customTitle || exercise.exercise.name,
        isSuperset: false,
        exercises: [exercise],
        totalSets: exercise.sets.length,
        completedSets: exercise.sets.filter(set => set.completed).length,
        isActive: index === currentExerciseIndex
      });
    }
  });

  return groups;
};

export default function WorkoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { activeWorkout, restTimer, showCompletionModal, experienceLevel: globalExperienceLevel } = useAppSelector((state) => state.workout);
  const { preferences } = useAppSelector((state) => state.user);
  const { user } = useAuth(); // Get Firebase user from auth context
  const { previousPerformances, isLoadingPrevious } = useAppSelector((state) => state.exerciseHistory);
  const { currentSharedWorkout, isAnonymousSession } = useAppSelector((state) => state.sharedWorkout);
  const [workoutStartTime] = useState(Date.now());

  // Check if we're viewing a shared workout
  const { shareId } = useParams<{ shareId?: string }>() || {};
  const isViewingSharedWorkout = !!shareId;

  // Check for stored shared context as fallback
  const storedContext = useMemo(() => {
    try {
      const stored = sessionStorage.getItem('sharedWorkoutContext');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Lock in shared session status to prevent state changes during workout
  const [isSharedSession] = useState(!!shareId || !!storedContext?.isSharedSession);
  const isAnonymousUser = (isViewingSharedWorkout || isSharedSession) && !user;

  console.log('💪 WorkoutPage rendering:', {
    shareId,
    isViewingSharedWorkout,
    isSharedSession,
    isAnonymousUser,
    hasActiveWorkout: !!activeWorkout,
    user: user?.uid || 'anonymous',
    currentSharedWorkout: !!currentSharedWorkout,
    path: window.location.pathname
  });
  const [editingExercise, setEditingExercise] = useState<WorkoutExercise | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeloadModal, setShowDeloadModal] = useState(false);
  const [showFatigueModal, setShowFatigueModal] = useState(false);
  const [fatigueSetInfo, setFatigueSetInfo] = useState<{ weight: number; setNumber: number } | null>(null);
  const [failedSetsCount, setFailedSetsCount] = useState(0);
  const [showEndWorkoutModal, setShowEndWorkoutModal] = useState(false);

  // Track if workout context has been loaded to prevent duplicate calls
  const contextLoadedRef = useRef<string | null>(null);

  // Reset failed sets count when exercise changes
  useEffect(() => {
    setFailedSetsCount(0);
  }, [activeWorkout?.currentExerciseIndex]);

  // Memoize exercise IDs to prevent unnecessary re-calculations
  // Use workout ID as dependency instead of the entire exercises array
  const exerciseIdsForContext = useMemo(() => {
    if (!activeWorkout) return [];

    return activeWorkout.exercises
      .map(ex => ex.exercise.id)
      .filter(id => !id.startsWith('fallback-')); // Skip fallback exercises
  }, [activeWorkout?.id]); // Only depend on workout ID, not the entire exercises array

  // Effect for initial workout setup and context loading
  useEffect(() => {
    if (!activeWorkout) {
      // Don't redirect if we're on a shared workout route or in a shared session
      if (!isViewingSharedWorkout && !isSharedSession) {
        console.log('🔄 WorkoutPage: No active workout, redirecting to build (not a shared session)');
        navigate('/build');
      } else {
        console.log('🔗 WorkoutPage: No active workout, but staying on shared route for anonymous access');
      }
      return;
    }

    console.log('🏋️ WorkoutPage: Active workout detected, setting up context');

    // Load workout context only once per workout (when workout ID changes)
    // Only for authenticated users - anonymous users can workout without context
    if (user?.uid && exerciseIdsForContext.length > 0 && contextLoadedRef.current !== activeWorkout.id) {
      contextLoadedRef.current = activeWorkout.id;
      dispatch(loadWorkoutContext({ userId: user.uid, exerciseIds: exerciseIdsForContext }));
      console.log('📊 WorkoutPage: Loading workout context for authenticated user');
    } else if (isAnonymousUser) {
      console.log('👤 WorkoutPage: Anonymous user - skipping context loading');
    }
  }, [activeWorkout?.id, navigate, dispatch, user?.uid, exerciseIdsForContext, isViewingSharedWorkout, isSharedSession, isAnonymousUser]);


  // Separate effect for duration updates
  useEffect(() => {
    if (!activeWorkout) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(activeWorkout.startTime).getTime()) / 1000);
      dispatch(updateWorkoutDuration(elapsed));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkout?.id, dispatch]); // Only depend on workout ID and dispatch

  // Move all variable declarations and hooks before early return to prevent hook count mismatch
  const currentExercise = activeWorkout?.exercises[activeWorkout.currentExerciseIndex];
  const currentSet = currentExercise?.sets[activeWorkout?.currentSetIndex || 0];
  const isInSuperset = activeWorkout?.isInSuperset;
  const currentSupersetIndex = activeWorkout?.currentSupersetIndex || 0;

  // Initialize progression recommendation hook for current exercise (always call this hook)
  const progressionHook = useProgressionRecommendation({
    exercise: currentExercise?.exercise,
    currentSets: currentExercise?.sets.length || 0,
    userId: user?.uid,
    configuredReps: currentExercise?.sets?.[0]?.reps // Pass configured reps from first set
  });

  // Effect to check for deload when recommendation loads
  useEffect(() => {
    if (activeWorkout && progressionHook.recommendation?.deloadApplied &&
        progressionHook.recommendation.daysSinceLastWorkout &&
        progressionHook.recommendation.daysSinceLastWorkout >= 14) {
      setShowDeloadModal(true);
    }
  }, [progressionHook.recommendation, activeWorkout]);

  if (!activeWorkout) {
    console.log('❌ WorkoutPage: No active workout detected');

    // If we're viewing a shared workout, wrap with SharedWorkoutLoader
    if (isViewingSharedWorkout) {
      console.log('🔗 WorkoutPage: Rendering SharedWorkoutLoader for shareId:', shareId);
      return (
        <SharedWorkoutLoader
          onWorkoutNotFound={() => navigate('/build')}
        >
          {(sharedWorkout) => (
            <SharedWorkoutStartPage
              sharedWorkout={sharedWorkout}
              onStartWorkout={(workout) => {
                console.log('▶️ WorkoutPage: Starting shared workout:', workout.workoutData.name);
                // Start the shared workout
                dispatch(startWorkout({
                  name: workout.workoutData.name,
                  exercises: workout.workoutData.exercises
                }));
                // Track usage
                if (shareId) {
                  dispatch(incrementWorkoutUseCount(shareId));
                }
              }}
            />
          )}
        </SharedWorkoutLoader>
      );
    }

    // Regular no workout page for authenticated users
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No Active Workout</h1>
          <p className="text-gray-400 mb-6">Start a workout from the Build page</p>
          <button
            onClick={() => navigate('/build')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Go to Build Page
          </button>
        </div>
      </div>
    );
  }

  // Get superset exercises if we're in one
  const supersetExercises = currentExercise?.isSuperset && currentExercise.supersetId
    ? activeWorkout.exercises.filter(ex => ex.supersetId === currentExercise.supersetId)
    : [];

  const handleCompleteSet = (reps: number, weight: number) => {
    dispatch(completeSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex: activeWorkout.currentSetIndex,
      setData: { reps, weight }
    }));

    // Check for failed set (if reps are significantly less than target)
    if (currentSet) {
      const targetReps = currentSet.reps || 8; // Default target
      const setFailed = reps < targetReps * 0.8;

      if (setFailed) {
        const newFailedCount = failedSetsCount + 1;
        setFailedSetsCount(newFailedCount);

        // Determine threshold based on whether we have previous data
        const hasPreviousData = currentExercise?.exercise?.id && previousPerformances[currentExercise.exercise.id] != null;
        const requiredFailedSets = hasPreviousData ? 2 : 3; // More conservative for first-time exercises

        // Only trigger fatigue check after multiple consecutive failed sets
        if (newFailedCount >= requiredFailedSets) {
          setFatigueSetInfo({ weight, setNumber: activeWorkout.currentSetIndex + 1 });
          setShowFatigueModal(true);
          progressionHook.checkForFailedSet(currentSet, activeWorkout.currentSetIndex);
        }
      }
    }

    // Check if current exercise is part of a superset
    const isCurrentExerciseInSuperset = currentExercise?.isSuperset && currentExercise.supersetId;

    if (isCurrentExerciseInSuperset) {
      // Find all exercises in this superset
      const allSupersetExercises = activeWorkout.exercises.filter(ex =>
        ex.supersetId === currentExercise.supersetId
      );

      if (allSupersetExercises.length > 1) {
        const currentIndexInSuperset = allSupersetExercises.findIndex(ex => ex.id === currentExercise?.id);
        const isLastExerciseInSuperset = currentIndexInSuperset === allSupersetExercises.length - 1;
        const isLastSet = activeWorkout.currentSetIndex === (currentExercise?.sets.length || 0) - 1;

        if (isLastExerciseInSuperset && isLastSet) {
          // Completed all sets of superset - start rest timer and move to next exercise group
          dispatch(startRestTimer({ duration: currentExercise?.restTime || 120 }));
          dispatch(completeSuperset());
        } else if (isLastExerciseInSuperset && !isLastSet) {
          // Completed a round of the superset (last exercise of current set) - start rest timer
          dispatch(startRestTimer({ duration: currentExercise?.restTime || 120 }));
        } else {
          // Move to next exercise in superset (within the same set)
          dispatch(nextSupersetExercise());
        }
      } else {
        // Single exercise marked as superset, treat as regular exercise
        if (currentExercise?.restTime) {
          dispatch(startRestTimer({ duration: currentExercise.restTime }));
        }
      }
    } else {
      // Regular exercise: start rest timer
      if (currentExercise?.restTime) {
        dispatch(startRestTimer({ duration: currentExercise.restTime }));
      }
    }
  };

  const handleUncompleteSet = () => {
    dispatch(uncompleteSet({ 
      exerciseIndex: activeWorkout.currentExerciseIndex, 
      setIndex: activeWorkout.currentSetIndex 
    }));
  };

  const handleAddSet = () => {
    dispatch(addSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setData: {
        reps: currentSet?.reps || 0,
        weight: currentSet?.weight || 0
      }
    }));
  };

  const handleJumpToSet = (setIndex: number) => {
    dispatch(jumpToSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex
    }));
  };

  const handleJumpToExercise = (exerciseIndex: number) => {
    dispatch(jumpToSet({
      exerciseIndex,
      setIndex: 0
    }));
  };

  const handleEditExercise = (exercise: WorkoutExercise) => {
    setEditingExercise(exercise);
    setShowEditModal(true);
  };

  const handleSaveExercise = (exerciseId: string, sets: WorkoutSet[], restTime: number) => {
    dispatch(updateExercise({ exerciseId, sets, restTime }));
    setShowEditModal(false);
    setEditingExercise(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingExercise(null);
  };

  const handleEndWorkoutClick = () => {
    setShowEndWorkoutModal(true);
  };

  const handleEndWithoutSaving = () => {
    dispatch(endWorkout());
    setShowEndWorkoutModal(false);
    // Navigate appropriately based on user type
    if (isAnonymousUser) {
      console.log('👤 Anonymous user ended workout without saving - staying on current route');
      // Stay on current shared route
    } else {
      navigate('/');
    }
  };

  const handleSaveAndEnd = async () => {
    try {
      // Save completed workout to Firebase
      if (user?.uid) {
        await WorkoutStorageService.saveCompletedWorkout(user.uid, activeWorkout);
        console.log('✅ Workout saved successfully');
      }

      dispatch(endWorkout());
      setShowEndWorkoutModal(false);
      // Navigate appropriately based on user type
      if (isAnonymousUser) {
        // For anonymous users, stay on the current page or go to build
        console.log('👤 Workout completed by anonymous user - staying on current route');
        // We could show a completion modal here instead of navigating
      } else {
        navigate('/profile', { state: { showWorkoutComplete: true } });
      }
    } catch (error) {
      console.error('❌ Error saving workout:', error);
      // Show user-friendly error message
      alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');
      // Still end workout even if save fails
      dispatch(endWorkout());
      setShowEndWorkoutModal(false);
      // Navigate appropriately based on user type
      if (isAnonymousUser) {
        console.log('👤 Anonymous user workout ended after error - staying on current route');
      } else {
        navigate('/');
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate accurate progress based on completed sets
  const calculateWorkoutProgress = () => {
    if (!activeWorkout) return { completedSets: 0, totalSets: 0, percentage: 0 };

    const totalSets = activeWorkout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    const completedSets = activeWorkout.exercises.reduce((total, ex) =>
      total + ex.sets.filter(set => set.completed).length, 0
    );

    const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    return { completedSets, totalSets, percentage };
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if disabled or user is typing in an input
      if (!preferences.keyboardShortcuts.enabled) {
        return;
      }

      // More comprehensive check for input elements
      const target = event.target as Element;
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true' ||
        target.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'enter':
          event.preventDefault();
          if (currentSet && !currentSet.completed) {
            const reps = currentSet.reps || 0;
            const weight = currentSet.weight || 0;
            handleCompleteSet(reps, weight);
          }
          break;
        case 'n':
          event.preventDefault();
          if (currentExercise && activeWorkout.currentSetIndex < currentExercise.sets.length - 1) {
            handleJumpToSet(activeWorkout.currentSetIndex + 1);
          }
          break;
        case 'p':
          event.preventDefault();
          if (activeWorkout.currentSetIndex > 0) {
            handleJumpToSet(activeWorkout.currentSetIndex - 1);
          }
          break;
        case 'r':
          event.preventDefault();
          if (restTimer.isActive) {
            dispatch(stopRestTimer());
          } else {
            dispatch(startRestTimer({ duration: currentExercise?.restTime || 120 }));
          }
          break;
        case 'u':
          event.preventDefault();
          if (currentSet && currentSet.completed) {
            handleUncompleteSet();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentSet, currentExercise, activeWorkout, restTimer, dispatch, handleCompleteSet, handleUncompleteSet, handleJumpToSet]);

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">{activeWorkout.name}</h1>
              <p className="text-gray-400">Duration: {formatTime(activeWorkout.duration)}</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleEndWorkoutClick}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                End Workout
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            {/* Overall workout progress */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Overall Progress</span>
                <span>{calculateWorkoutProgress().percentage}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                  style={{
                    width: `${calculateWorkoutProgress().percentage}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{calculateWorkoutProgress().completedSets} sets completed</span>
                <span>{calculateWorkoutProgress().totalSets} total sets</span>
              </div>
            </div>

            {/* Current exercise progress */}
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Exercise {activeWorkout.currentExerciseIndex + 1} of {activeWorkout.exercises.length}</span>
              <span>{currentExercise?.sets.filter(set => set.completed).length || 0} / {currentExercise?.sets.length || 0} sets completed</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(currentExercise?.sets.length || 0) > 0 ? ((currentExercise?.sets.filter(set => set.completed).length || 0) / (currentExercise?.sets.length || 1)) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Exercise Panel */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Superset or Regular Exercise */}
            {currentExercise?.isSuperset && currentExercise.supersetId && supersetExercises.length > 1 ? (
              <div className="order-1">
                <SupersetExerciseCard
                  exercises={supersetExercises}
                  currentSupersetIndex={currentSupersetIndex}
                  currentSetIndex={activeWorkout.currentSetIndex}
                  onCompleteSet={handleCompleteSet}
                  onUncompleteSet={handleUncompleteSet}
                  onJumpToSet={handleJumpToSet}
                  onAddSet={handleAddSet}
                  previousPerformances={previousPerformances}
                />
              </div>
            ) : (
              /* Current Exercise */
              <div className="bg-gray-800 rounded-lg p-6 order-1">
              <div className="flex justify-between items-center mb-4">
                <div className="flex-1">
                  <ExerciseNotesEditor
                    exercise={currentExercise}
                    onUpdateTitle={(title) => dispatch(updateExerciseNotesAndTitle({
                      exerciseId: currentExercise.id,
                      customTitle: title
                    }))}
                    onUpdateNotes={(notes) => dispatch(updateExerciseNotesAndTitle({
                      exerciseId: currentExercise.id,
                      notes: notes
                    }))}
                  />
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEditExercise(currentExercise)}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    title="Edit sets"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => dispatch(previousExercise())}
                    disabled={activeWorkout.currentExerciseIndex === 0}
                    className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => dispatch(nextExercise())}
                    disabled={activeWorkout.currentExerciseIndex === activeWorkout.exercises.length - 1}
                    className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Exercise Video */}
              {currentExercise?.exercise.videoLinks.length > 0 && (
                <div className="mb-6">
                  {(currentExercise?.exercise.videoLinks.length || 0) >= 2 ? (
                    <DualViewVideo
                      key={`workout-dual-${currentExercise?.exercise.id}-${activeWorkout.currentExerciseIndex}`}
                      videoUrls={currentExercise?.exercise.videoLinks || []}
                      exerciseName={currentExercise?.customTitle || currentExercise?.exercise.name || ''}
                      autoPlay={true}
                      muted={true}
                      compact={true}
                      instructions={currentExercise?.exercise.instructions || []}
                    />
                  ) : (
                    <ExerciseVideo
                      key={`workout-single-${currentExercise?.exercise.id}-${activeWorkout.currentExerciseIndex}`}
                      videoUrl={currentExercise?.exercise.videoLinks?.[0] || ''}
                      exerciseName={currentExercise?.customTitle || currentExercise?.exercise.name || ''}
                      autoPlay={true}
                      muted={true}
                      compact={true}
                      fallbackVideoUrls={currentExercise?.exercise.videoLinks?.slice(1) || []}
                      instructions={currentExercise?.exercise.instructions || []}
                    />
                  )}
                </div>
              )}

              {/* Previous Performance Display - Only for authenticated users */}
              {!isAnonymousUser && (
                <PreviousPerformance
                  currentExercise={currentExercise}
                  previousPerformance={
                    currentExercise?.exercise.id?.startsWith('fallback-')
                      ? null // Don't show previous performance for fallback exercises
                      : (currentExercise?.exercise.id ? previousPerformances[currentExercise.exercise.id] || null : null)
                  }
                  isLoading={isLoadingPrevious && !currentExercise?.exercise.id?.startsWith('fallback-')}
                />
              )}

              {/* Rest Timer - Mobile only */}
              <div className="lg:hidden">
                <RestTimer />
              </div>

              {/* Weight Progression Slider - Only for authenticated users */}
              {!isAnonymousUser && progressionHook.recommendation &&
               !progressionHook.isLoading &&
               progressionHook.recommendation.previousWeight &&
               progressionHook.recommendation.previousWeight > 0 && (
                <div className="mb-4">
                  <WeightProgressionSlider
                    previousWeight={progressionHook.recommendation.previousWeight}
                    currentWeight={progressionHook.recommendation.recommendedWeight || progressionHook.recommendation.previousWeight}
                    onWeightChange={(weight) => {
                      // Auto-apply weight change
                      progressionHook.modifyRecommendation(weight, progressionHook.recommendation?.recommendedReps);
                      progressionHook.acceptRecommendation();
                    }}
                    minIncrease={2.5}
                    maxIncrease={10}
                    action={progressionHook.recommendation.action}
                    reasoning={progressionHook.recommendation.reasoning}
                    deloadApplied={progressionHook.recommendation.deloadApplied}
                  />
                </div>
              )}

              {/* Next Action Indicator */}
              {restTimer.isActive ? (
                <div className="mb-4 p-3 bg-orange-600 bg-opacity-20 border border-orange-500 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <p className="text-orange-300 font-medium">
                      Rest in progress - {Math.floor(restTimer.timeRemaining / 60)}:{(restTimer.timeRemaining % 60).toString().padStart(2, '0')} remaining
                    </p>
                  </div>
                </div>
              ) : !currentSet?.completed ? (
                <div className="mb-4 p-3 bg-green-600 bg-opacity-20 border border-green-500 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-green-300 font-medium">
                      Ready to perform set {activeWorkout.currentSetIndex + 1}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <p className="text-blue-300 font-medium">
                      Set completed! {activeWorkout.currentSetIndex < (currentExercise?.sets.length || 0) - 1 ? 'Ready for next set' : 'Ready for next exercise'}
                    </p>
                  </div>
                </div>
              )}

              {/* Current Set */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    Current Set: {activeWorkout.currentSetIndex + 1} / {currentExercise?.sets.length || 0}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleJumpToSet(Math.max(0, activeWorkout.currentSetIndex - 1))}
                      disabled={activeWorkout.currentSetIndex === 0}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      title="Previous Set"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleJumpToSet(Math.min(currentExercise.sets.length - 1, activeWorkout.currentSetIndex + 1))}
                      disabled={activeWorkout.currentSetIndex === (currentExercise?.sets.length || 0) - 1}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      title="Next Set"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <SetInput
                  set={currentSet}
                  onComplete={handleCompleteSet}
                  onUncomplete={handleUncompleteSet}
                  previousSet={activeWorkout.currentSetIndex > 0 ? currentExercise?.sets?.[activeWorkout.currentSetIndex - 1] || null : null}
                  allSets={currentExercise?.sets || []}
                  recommendedWeight={progressionHook.acceptedRecommendation ? progressionHook.recommendation?.recommendedWeight : undefined}
                  recommendedReps={progressionHook.acceptedRecommendation ? progressionHook.recommendation?.recommendedReps : undefined}
                />
              </div>

              {/* All Sets Overview */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-white">All Sets</h4>
                  <button
                    onClick={handleAddSet}
                    className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Add Set</span>
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 font-medium">
                  <span>Set</span>
                  <span>Previous</span>
                  <span>Reps</span>
                  <span>Weight</span>
                </div>
                {(currentExercise?.sets || []).map((set, index) => {
                  // Get previous performance data for this exercise
                  const previousPerformance = currentExercise?.exercise.id ? previousPerformances[currentExercise.exercise.id] : null;
                  const previousSet = previousPerformance?.sets?.[index];

                  // Format previous set display
                  const previousDisplay = previousSet
                    ? `${previousSet.actualReps}×${previousSet.weight}`
                    : '-';

                  return (
                    <div
                      key={set.id}
                      onClick={() => handleJumpToSet(index)}
                      className={`grid grid-cols-4 gap-2 p-2 rounded text-sm cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-blue-400 ${
                        index === activeWorkout.currentSetIndex
                          ? 'bg-blue-600 text-white shadow-lg'
                          : set.completed
                          ? 'bg-green-600 text-white hover:bg-green-500'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span className="font-medium">{index + 1}</span>
                      <span className="text-xs">{previousDisplay}</span>
                      <span>{set.reps || '-'}</span>
                      <span>{set.weight ? `${set.weight} lbs` : '-'}</span>
                      {index === activeWorkout.currentSetIndex && (
                        <div className="col-span-4 text-xs opacity-75 text-center mt-1">
                          Current Set
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Exercise Instructions */}
              {(currentExercise?.exercise.instructions?.length || 0) > 0 && (
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Instructions</h3>
                  <ol className="space-y-2">
                    {(currentExercise?.exercise.instructions || []).map((instruction, index) => (
                      <li key={index} className="text-gray-300 text-sm">
                        <span className="text-blue-400 font-medium">{index + 1}.</span> {instruction}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Rest Timer - Desktop only */}
            <RestTimer className="hidden lg:block" />


            {/* Exercise List */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Exercises</h3>
              <div className="space-y-2">
                {getGroupedExercisesForDisplay(activeWorkout.exercises, activeWorkout.currentExerciseIndex).map((group) => {
                  // Find the exercise index for navigation
                  const exerciseIndex = group.isSuperset
                    ? activeWorkout.exercises.findIndex(ex => ex.supersetId === group.id)
                    : activeWorkout.exercises.findIndex(ex => ex.id === group.id);

                  return (
                    <div
                      key={group.id}
                      className={`rounded-lg text-sm transition-all duration-200 ${
                        group.isActive
                          ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      <div className="flex">
                        <button
                          onClick={() => exerciseIndex !== -1 && handleJumpToExercise(exerciseIndex)}
                          className="flex-1 p-3 text-left hover:bg-opacity-80 transition-all duration-200"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{group.name}</p>
                              <p className="text-xs opacity-75">
                                {group.completedSets} / {group.totalSets} sets
                              </p>
                              {group.isSuperset && (
                                <p className="text-xs opacity-60 mt-1">
                                  Superset ({group.exercises.length} exercises)
                                </p>
                              )}
                            </div>
                            {group.isActive && (
                              <div className="flex-shrink-0 ml-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // For supersets, edit the first exercise in the group
                            const exerciseToEdit = group.isSuperset
                              ? group.exercises[0]
                              : group.exercises[0];
                            handleEditExercise(exerciseToEdit);
                          }}
                          className={`p-3 border-l transition-colors ${
                            group.isActive
                              ? 'border-blue-500 hover:bg-blue-700'
                              : 'border-gray-600 hover:bg-gray-600'
                          }`}
                          title="Edit exercise"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Edit Modal */}
      <ExerciseEditModal
        isOpen={showEditModal}
        exercise={editingExercise}
        onClose={handleCloseEditModal}
        onSave={handleSaveExercise}
      />

      {/* Workout Completion Modal */}
      <WorkoutCompletionModal
        isOpen={showCompletionModal}
        onClose={() => dispatch(setShowCompletionModal(false))}
      />

      {/* End Workout Modal */}
      <EndWorkoutModal
        isOpen={showEndWorkoutModal}
        activeWorkout={activeWorkout}
        onClose={() => setShowEndWorkoutModal(false)}
        onEndWithoutSaving={handleEndWithoutSaving}
        onSaveAndEnd={handleSaveAndEnd}
        isAnonymousUser={isAnonymousUser}
        isSharedWorkout={isViewingSharedWorkout}
      />

      {/* Deload Suggestion Slide-out - Only for authenticated users */}
      {!isAnonymousUser && progressionHook.showDeloadSuggestion && progressionHook.recommendation && (
        <DeloadSuggestion
          weeksSinceLastWorkout={Math.ceil((progressionHook.recommendation.daysSinceLastWorkout || 14) / 7)}
          suggestedDeloadPercentage={15}
          previousWeight={progressionHook.recommendation.previousWeight || 0}
          suggestedWeight={progressionHook.recommendation.recommendedWeight || 0}
          exerciseName={currentExercise?.exercise.name || ''}
          onAccept={progressionHook.applyDeload}
          onDecline={progressionHook.declineDeload}
          onClose={() => setShowDeloadModal(false)}
        />
      )}

      {/* Fatigue Check Slide-out - Only for authenticated users */}
      {!isAnonymousUser && showFatigueModal && fatigueSetInfo && (
        <FatigueCheck
          exerciseName={currentExercise?.exercise.name || ''}
          currentWeight={fatigueSetInfo.weight}
          setNumber={fatigueSetInfo.setNumber}
          onFatigued={() => {
            progressionHook.applyFatigue();
            setShowFatigueModal(false);
            // Record fatigue in Redux
            dispatch(recordProgressionOutcome({
              exerciseId: currentExercise?.exercise.id || '',
              outcome: 'failed',
              failureReason: 'fatigue'
            }));
          }}
          onNotFatigued={() => {
            progressionHook.continuePlan();
            setShowFatigueModal(false);
          }}
          onClose={() => setShowFatigueModal(false)}
        />
      )}
    </div>
  );
}

