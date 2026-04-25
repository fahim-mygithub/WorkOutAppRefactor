import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { startWorkout } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';

// Debug: Verify WorkoutStorageService is properly imported
console.log('🔍 WorkoutStorageService import check:', {
  service: WorkoutStorageService,
  saveWorkout: WorkoutStorageService?.saveWorkout,
  typeof: typeof WorkoutStorageService
});
import { WorkoutExercise, WorkoutSet, Exercise } from '../types/exercise';
import { WorkoutParser } from '../parser/workoutParser';
import { ParseResult } from '../parser/types';
import { BuildScreenLayout } from '../components/workout/BuildScreenLayout';
import { EnhancedTextInput } from '../components/workout/EnhancedTextInput';
import { ParsedWorkoutConfigurator } from '../components/workout/ParsedWorkoutConfigurator';
import { RealtimePreview } from '../components/workout/RealtimePreview';
import { useExercises } from '../hooks/useExercises';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { generateFallbackExerciseId, sanitizeWorkoutExercisesForRedux } from '../utils/workoutConversion';
import { SharedWorkoutLoader } from '../components/SharedWorkoutLoader';
import { ShareWorkoutModal } from '../components/ShareWorkoutModal';
import { useParams } from 'react-router-dom';
import { CreateSharedWorkoutData, SharedWorkout } from '../services/sharedWorkoutService';

// Component to handle shared workout build view with proper hooks
interface SharedWorkoutBuildViewProps {
  sharedWorkout: SharedWorkout;
  workoutName: string;
  setWorkoutName: (name: string) => void;
  workoutText: string;
  setWorkoutText: (text: string) => void;
  exerciseDatabase: Exercise[];
  debouncedAutoParse: (text: string) => void;
  textInputSection: React.ReactNode;
  configurationSection: React.ReactNode;
  showConfiguration: boolean;
  parseErrorsSection: React.ReactNode;
}

const SharedWorkoutBuildView: React.FC<SharedWorkoutBuildViewProps> = ({
  sharedWorkout,
  workoutName,
  setWorkoutName,
  workoutText,
  setWorkoutText,
  exerciseDatabase,
  debouncedAutoParse,
  textInputSection,
  configurationSection,
  showConfiguration,
  parseErrorsSection
}) => {
  console.log('🔗 SharedWorkoutBuildView rendering:', {
    shareId: sharedWorkout.shareId,
    workoutName: sharedWorkout.workoutData.name,
    hasWorkoutText: !!sharedWorkout.workoutData.workoutText,
    currentWorkoutName: workoutName,
    currentPath: window.location.pathname
  });

  // Populate workout data from shared workout when loaded
  useEffect(() => {
    console.log('📥 BuildPage: SharedWorkout data population effect triggered:', {
      workoutName: sharedWorkout.workoutData.name,
      hasWorkoutText: !!sharedWorkout.workoutData.workoutText,
      workoutTextLength: sharedWorkout.workoutData.workoutText?.length || 0,
      exerciseDbLength: exerciseDatabase.length,
      currentWorkoutName: workoutName,
      currentWorkoutTextLength: workoutText.length
    });

    // Set the workout name if not already set
    if (!workoutName && sharedWorkout.workoutData.name) {
      console.log('📝 BuildPage: Setting workout name from shared data:', sharedWorkout.workoutData.name);
      setWorkoutName(sharedWorkout.workoutData.name);
    }

    // Set the workout text if available and not already set
    if (!workoutText.trim() && sharedWorkout.workoutData.workoutText) {
      console.log('📝 BuildPage: Setting workout text from shared data, length:', sharedWorkout.workoutData.workoutText.length);
      setWorkoutText(sharedWorkout.workoutData.workoutText);

      // Also trigger a parse if we have the text and exercises are loaded
      if (exerciseDatabase.length > 0) {
        console.log('🔄 BuildPage: Auto-parsing shared workout text after 500ms delay');
        setTimeout(() => {
          debouncedAutoParse(sharedWorkout.workoutData.workoutText);
        }, 500);
      } else {
        console.log('⚠️ BuildPage: Exercise database not loaded yet, skipping auto-parse');
      }
    }
  }, [sharedWorkout, workoutName, workoutText, exerciseDatabase.length, setWorkoutName, setWorkoutText, debouncedAutoParse]);

  return (
    <div>
      {/* Show shared workout info banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 mb-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold mb-1">Viewing Shared Workout</h2>
          <p className="text-sm text-purple-100">
            "{sharedWorkout.workoutData.name}" by {sharedWorkout.creatorName}
          </p>
          <p className="text-xs text-purple-200 mt-1">
            {sharedWorkout.metadata.viewCount} views • {sharedWorkout.metadata.useCount} uses
          </p>
          <p className="text-xs text-purple-200 mt-1">
            Make changes and start your workout!
          </p>
        </div>
      </div>

      <BuildScreenLayout
        textInputSection={textInputSection}
        configurationSection={configurationSection}
        showConfiguration={showConfiguration}
        actionButtons={parseErrorsSection}
      />
    </div>
  );
};

export default function BuildPage() {
  const {
    value: workoutText,
    setValue: setWorkoutText,
    undo: undoWorkoutText,
    redo: redoWorkoutText,
    canUndo: canUndoWorkoutText,
    canRedo: canRedoWorkoutText,
    reset: resetWorkoutText,
  } = useUndoRedo<string>('', 50);

  const [workoutName, setWorkoutName] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsingEnabled, setIsParsingEnabled] = useState(true);
  const [autoParseEnabled, setAutoParseEnabled] = useState(true);
  const [isCurrentlyParsing, setIsCurrentlyParsing] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { exercises: exerciseDatabase } = useExercises(); // Ensure exercises are loaded
  const [editedWorkout, setEditedWorkout] = useState<any>(null);
  const [workoutNameError, setWorkoutNameError] = useState('');
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Get Firebase user from auth context - MUST be at top level
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Check if we're viewing a shared workout
  const { shareId } = useParams<{ shareId?: string }>() || {};
  const isViewingSharedWorkout = !!shareId;

  console.log('🏗️ BuildPage rendering:', {
    shareId,
    isViewingSharedWorkout,
    hasUser: !!user,
    path: window.location.pathname
  });

  // Log exercise database loading status
  React.useEffect(() => {
    console.log('💾 Exercise database status:', {
      loaded: exerciseDatabase.length > 0,
      count: exerciseDatabase.length
    });
  }, [exerciseDatabase.length]);
  const parser = useMemo(() => new WorkoutParser(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [shareData, setShareData] = useState<CreateSharedWorkoutData | null>(null);

  // Debounced auto-parse function
  const debouncedAutoParse = useCallback(async (text: string) => {
    if (!text.trim() || !autoParseEnabled || !exerciseDatabase.length || isCurrentlyParsing) {
      console.log('⏸️ Auto-parse skipped:', { 
        hasText: !!text.trim(), 
        autoEnabled: autoParseEnabled, 
        hasDB: exerciseDatabase.length > 0,
        isParsing: isCurrentlyParsing
      });
      return;
    }
    
    try {
      const result = parser.parse(text);
      if (result.success && exerciseDatabase.length > 0) {
        // Validate exercise names against database
        const allExercises = [
          ...result.workout!.exercises,
          ...result.workout!.supersets.flat()
        ];
        const suggestions = parser.validateExerciseNames(allExercises, exerciseDatabase);
        result.warnings = [...result.warnings, ...suggestions];
      }
      
      // Always update parseResult for successful parsing
      if (result.success && result.workout) {
        console.log('🔄 Auto-parse successful, updating state');
        setParseResult(result);
        // Always update editedWorkout from auto-parse to avoid stale state issues
        setEditedWorkout(prepareWorkoutForConfigurator(result.workout));
      } else {
        console.log('🔄 Auto-parse failed, keeping existing state');
      }
    } catch (error) {
      // Silently handle parse errors for auto-parsing
      console.warn('Auto-parse failed:', error);
    }
  }, [parser, exerciseDatabase, autoParseEnabled, isCurrentlyParsing]);

  // Handle text changes with debounced auto-parsing
  const handleTextChange = useCallback((text: string) => {
    console.log('📝 Text changed, length:', text.trim().length);
    setWorkoutText(text);
    
    // Clear timeout if it exists
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Reset parse state for significant changes
    const significantChange = Math.abs(text.trim().length - workoutText.trim().length) > 10;
    if (significantChange) {
      console.log('🔄 Significant text change detected, resetting parse state');
      setParseResult(null);
      setEditedWorkout(null);
    }
    
    // Set up debounced auto-parse (2 second delay)
    if (autoParseEnabled && text.trim().length > 10 && !isCurrentlyParsing) {
      console.log('⏱️ Setting up auto-parse timer (2s delay)');
      debounceTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Auto-parse timer triggered');
        debouncedAutoParse(text);
      }, 2000);
    } else if (isCurrentlyParsing) {
      console.log('⏸️ Skipping auto-parse setup (currently parsing)');
    }
  }, [workoutText, autoParseEnabled, debouncedAutoParse, isCurrentlyParsing]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to find exercise in database (improved matching)
  const findExerciseInDatabase = useCallback((exerciseName: string): Exercise | null => {
    const name = exerciseName.toLowerCase().trim();
    
    // First try exact match
    const exactMatch = exerciseDatabase.find(ex => 
      ex.name.toLowerCase() === name
    );
    if (exactMatch) return exactMatch;
    
    // Try partial match (database name contains search term or vice versa)
    const partialMatch = exerciseDatabase.find(ex => {
      const dbName = ex.name.toLowerCase();
      return dbName.includes(name) || name.includes(dbName);
    });
    if (partialMatch) return partialMatch;
    
    // Then try common variations (handle plurals, common abbreviations)
    const variations = [
      name,
      name.endsWith('s') ? name.slice(0, -1) : name + 's', // Handle plurals
      name.replace(/\bbarbell\b/g, 'bb').replace(/\bdumbbell\b/g, 'db'), // Common abbreviations
      name.replace(/\bbb\b/g, 'barbell').replace(/\bdb\b/g, 'dumbbell'), // Expand abbreviations
      name.replace(/\bpress\b/g, ''), // Try without "press"
      name + ' press', // Try adding "press"
    ];
    
    for (const variation of variations) {
      const match = exerciseDatabase.find(ex => {
        const dbName = ex.name.toLowerCase();
        return dbName === variation ||
               dbName.includes(variation) ||
               variation.includes(dbName) ||
               ex.searchKeywords.some(keyword => keyword.toLowerCase().includes(variation));
      });
      if (match) return match;
    }
    
    return null;
  }, [exerciseDatabase]);

  // Validate that all exercises exist in database
  const validateAllExercisesExist = useCallback((exercises: any[]): string[] => {
    const notFound: string[] = [];
    exercises.forEach(exercise => {
      const found = findExerciseInDatabase(exercise.name);
      console.log(`🔍 Exercise "${exercise.name}": ${found ? `✅ Found as "${found.name}"` : '❌ Not found'}`);
      if (!found) {
        notFound.push(exercise.name);
      }
    });
    return notFound;
  }, [findExerciseInDatabase]);

  // Handle explicit parse request
  const handleParseWorkout = useCallback(async () => {
    if (!workoutText.trim() || isCurrentlyParsing) return;
    
    console.log('🎯 Manual parse triggered');
    setIsCurrentlyParsing(true);
    
    try {
      // Cancel any pending auto-parse
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
        console.log('🚫 Cancelled pending auto-parse');
      }
      
      // Clear previous parse result to ensure fresh state
      setParseResult(null);
      setEditedWorkout(null);
      
      console.log('🧹 Cleared previous parse state');
      
      const result = parser.parse(workoutText);
    
    // Only validate against database if exercises are loaded and parsing was successful
    if (result.success && result.workout && exerciseDatabase && exerciseDatabase.length > 0) {
      // Get all exercises from workout
      const allExercises = [
        ...result.workout.exercises,
        ...result.workout.supersets.flat()
      ];
      
      console.log('🔍 Validating exercises:', allExercises.map(ex => ex.name));
      
      // Instead of failing, just add warnings for exercises not found
      const suggestions = parser.validateExerciseNames(allExercises, exerciseDatabase);
      result.warnings = [...result.warnings, ...suggestions];
      
      // Log which exercises were not found for debugging
      const notFoundExercises = validateAllExercisesExist(allExercises);
      if (notFoundExercises.length > 0) {
        console.log('⚠️ Some exercises not found in database:', notFoundExercises);
        console.log('This is OK - they will be created as custom exercises');
      }
    }
    
    console.log('📋 Setting parse result:', { success: result.success, hasWorkout: !!result.workout, errors: result.errors.length });
    
    setParseResult(result);
    if (result.success && result.workout) {
      setEditedWorkout(prepareWorkoutForConfigurator(result.workout));
      console.log('✅ Manual parse completed successfully');
    } else {
      console.log('❌ Manual parse failed');
    }
    } catch (error) {
      console.error('💥 Error during manual parse:', error);
    } finally {
      setIsCurrentlyParsing(false);
    }
  }, [workoutText, exerciseDatabase, parser, validateAllExercisesExist, isCurrentlyParsing]);

  // Handle clear and restart
  const handleClearWorkout = () => {
    console.log('🗑️ Clearing workout and resetting state');
    
    // Cancel any pending auto-parse
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    resetWorkoutText('');
    setWorkoutName('');
    setParseResult(null);
    setEditedWorkout(null);
    setWorkoutNameError('');
    
    console.log('✅ Workout cleared successfully');
  };

  // Handle share workout
  const handleShareWorkout = () => {
    if (!workoutName.trim()) {
      setWorkoutNameError('Please enter a workout name');
      return;
    }

    if (!user?.uid) {
      alert('You must be logged in to share workouts');
      return;
    }

    const workoutToUse = editedWorkout || (parseResult?.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null);
    if (!workoutToUse) {
      alert('No valid workout found to share');
      return;
    }

    const exercises = convertToWorkoutExercises(workoutToUse);
    if (exercises.length === 0) {
      alert('No valid exercises found to share');
      return;
    }

    // Sanitize exercises for sharing
    const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);

    const shareWorkoutData: CreateSharedWorkoutData = {
      name: workoutName.trim(),
      description: `Shared workout with ${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}`,
      workoutText: workoutText || '',
      parsedWorkout: parseResult?.workout || workoutToUse || { exercises: [], supersets: [] },
      exercises: sanitizedExercises,
      allowAnonymous: true
    };

    setShareData(shareWorkoutData);
    setShowShareModal(true);
  };

  // Handle close share modal
  const handleCloseShareModal = () => {
    setShowShareModal(false);
    setShareData(null);
  };

  // Handle keyboard shortcuts for undo/redo
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (canUndoWorkoutText) {
        e.preventDefault();
        undoWorkoutText();
      }
    }
    // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
    else if (
      ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
    ) {
      if (canRedoWorkoutText) {
        e.preventDefault();
        redoWorkoutText();
      }
    }
  }, [canUndoWorkoutText, canRedoWorkoutText, undoWorkoutText, redoWorkoutText]);

  // Add global keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const convertToWorkoutExercises = (workout: any): WorkoutExercise[] => {
    if (!workout) return [];

    const workoutExercises: WorkoutExercise[] = [];

    // Process exercises from the workout data
    workout.exercises.forEach((exercise: any, index: number) => {
      // Check if this is a superset exercise (from configurator prepared data)
      if (exercise.isSuperset && exercise.supersetExercises) {
        // Handle superset - create individual exercises for workout execution
        const supersetId = `superset-${Date.now()}-${exercise.supersetIndex}`;
        const supersetExercises: WorkoutExercise[] = [];

        exercise.supersetExercises.forEach((parsedExercise: any, exerciseIndex: number) => {
          const dbExercise = findExerciseInDatabase(parsedExercise.name);

          const workoutSets: WorkoutSet[] = parsedExercise.sets.map((set: any, setIndex: number) => ({
            id: `set-superset-${Date.now()}-${exercise.supersetIndex}-${exerciseIndex}-${setIndex}`,
            reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
            weight: set.weight,
            unit: set.unit,
            completed: false,
          }));

          const supersetExercise: WorkoutExercise = {
            id: `exercise-superset-${Date.now()}-${exercise.supersetIndex}-${exerciseIndex}`,
            exercise: dbExercise || createFallbackExercise(parsedExercise.name, workoutExercises.length + exerciseIndex),
            sets: workoutSets,
            restTime: parsedExercise.restTime || 90,
            isSuperset: true,
            supersetId,
            supersetIndex: exerciseIndex,
            notes: `Superset ${exercise.supersetIndex + 1}${exercise.supersetExercises.length > 1 ? ` (${exerciseIndex + 1}/${exercise.supersetExercises.length})` : ''}`,
          };

          supersetExercises.push(supersetExercise);
        });

        // Add superset exercise IDs to the first exercise for navigation
        if (supersetExercises.length > 0) {
          supersetExercises[0].supersetExerciseIds = supersetExercises.map(ex => ex.id);
        }

        // Add all superset exercises to the main workout
        workoutExercises.push(...supersetExercises);
      } else {
        // Handle regular exercise
        const dbExercise = findExerciseInDatabase(exercise.name);

        const workoutSets: WorkoutSet[] = exercise.sets.map((set: any, setIndex: number) => ({
          id: `set-${Date.now()}-${index}-${setIndex}`,
          reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
          weight: set.weight,
          unit: set.unit,
          completed: false,
        }));

        workoutExercises.push({
          id: `exercise-${Date.now()}-${index}`,
          exercise: dbExercise || createFallbackExercise(exercise.name, index),
          sets: workoutSets,
          restTime: exercise.restTime || 120,
        });
      }
    });

    return workoutExercises;
  };

  const createFallbackExercise = (exerciseName: string, index: number): Exercise => ({
    id: generateFallbackExerciseId(exerciseName),
    name: exerciseName.trim(),
    muscleGroup: 'Unknown',
    muscleGroups: ['Unknown'],
    equipment: 'Unknown',
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: [exerciseName.trim().toLowerCase()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const handleStartWorkout = () => {
    console.log('🏁 BuildPage: Starting workout from build page:', {
      isViewingSharedWorkout,
      shareId,
      workoutName,
      hasUser: !!user,
      currentPath: window.location.pathname
    });

    if (!workoutName.trim()) {
      setWorkoutNameError('Please enter a workout name');
      return;
    }

    // Clear any previous error
    setWorkoutNameError('');

    const workoutToUse = editedWorkout || (parseResult?.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null);
    if (!workoutToUse) {
      alert('No valid workout found');
      return;
    }

    const exercises = convertToWorkoutExercises(workoutToUse);
    if (exercises.length === 0) {
      alert('No valid exercises found');
      return;
    }

    // Sanitize exercises to ensure they're serializable for Redux
    const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);

    dispatch(startWorkout({
      name: workoutName,
      exercises: sanitizedExercises,
    }));

    // Store shared context in sessionStorage for persistence
    if (isViewingSharedWorkout && shareId) {
      sessionStorage.setItem('sharedWorkoutContext', JSON.stringify({
        shareId,
        isSharedSession: true,
        startedFromShared: true,
        originalPath: window.location.pathname
      }));
      console.log('💾 BuildPage: Stored shared workout context in sessionStorage');
    }

    // Navigate to appropriate route based on shared status
    if (isViewingSharedWorkout && shareId) {
      const targetRoute = `/workout/shared/${shareId}`;
      console.log('🔗 BuildPage: Starting shared workout, navigating to:', targetRoute);
      navigate(targetRoute);
    } else {
      console.log('🏋️ BuildPage: Starting regular workout, navigating to:', '/workout');
      navigate('/workout');
    }
  };

  const handleSaveWorkout = async () => {
    console.log('🎯 handleSaveWorkout called, checking service availability...');

    // Debug: Check service availability at runtime
    if (!WorkoutStorageService) {
      console.error('❌ WorkoutStorageService is undefined!');
      setSaveError('WorkoutStorageService is not available. Please refresh the page.');
      return;
    }

    if (typeof WorkoutStorageService.saveWorkout !== 'function') {
      console.error('❌ WorkoutStorageService.saveWorkout is not a function!', {
        service: WorkoutStorageService,
        saveWorkout: WorkoutStorageService.saveWorkout,
        typeof: typeof WorkoutStorageService.saveWorkout
      });
      setSaveError('Save function is not available. Please refresh the page.');
      return;
    }

    console.log('✅ WorkoutStorageService is available, proceeding with save...');

    if (!workoutName.trim()) {
      setWorkoutNameError('Please enter a workout name');
      return;
    }

    if (!user?.uid) {
      alert('You must be logged in to save workouts');
      return;
    }

    const workoutToUse = editedWorkout || (parseResult?.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null);
    if (!workoutToUse) {
      alert('No valid workout found. Please parse your workout first.');
      return;
    }

    // Clear any previous errors
    setWorkoutNameError('');
    setSaveError('');
    setIsSaving(true);

    try {
      // Get custom exercises from workout
      const customExercises = convertToWorkoutExercises(workoutToUse)
        .filter(exercise => exercise.exercise.id.startsWith('fallback-'))
        .map(exercise => ({
          id: exercise.exercise.id,
          name: exercise.exercise.name,
          muscleGroup: exercise.exercise.muscleGroup,
          equipment: exercise.exercise.equipment,
          instructions: exercise.exercise.instructions,
          difficulty: exercise.exercise.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
          isCustom: true,
          createdBy: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

      console.log('📝 About to call WorkoutStorageService.saveWorkout with:', {
        userId: user.uid,
        workoutName: workoutName.trim(),
        serviceCheck: !!WorkoutStorageService,
        saveWorkoutMethod: !!WorkoutStorageService.saveWorkout
      });

      const workoutId = await WorkoutStorageService.saveWorkout(user.uid, {
        name: workoutName.trim(),
        description: `Workout created from build page with ${workoutToUse.exercises.length + workoutToUse.supersets.length} exercises`,
        workoutText: workoutText.trim(),
        parsedWorkout: workoutToUse,
        customExercises,
        tags: ['Build Page'],
        category: 'Strength',
        difficulty: 'Intermediate'
      });

      console.log('✅ Workout saved successfully:', workoutId);

      // Show success message and optionally navigate
      alert(`Workout "${workoutName}" saved successfully! You can find it in your Profile.`);

      // Optionally reset the form or navigate to profile
      // navigate('/profile');
    } catch (error) {
      console.error('❌ Error saving workout:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error
      });

      // Provide more specific error messages
      if (error?.message?.includes('saveWorkout')) {
        setSaveError('Save function is not available. Please refresh the page and try again.');
      } else if (error?.message?.includes('Firebase') || error?.message?.includes('Firestore')) {
        setSaveError('Database connection error. Please check your internet connection and try again.');
      } else {
        setSaveError(`Failed to save workout: ${error?.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare workout data for configurator (merge supersets into exercises array)
  const prepareWorkoutForConfigurator = useCallback((workout: any) => {
    if (!workout) return workout;

    const preparedWorkout = { ...workout };
    const allExercises = [...workout.exercises];

    // Add supersets as grouped exercises to the exercises array
    workout.supersets.forEach((superset: any[], supersetIndex: number) => {
      // Create a combined superset exercise for display
      const supersetExercise = {
        name: superset.map(ex => ex.name).join(' + '),
        sets: superset[0].sets, // Use the first exercise's sets as reference
        restTime: superset[0].restTime || 90,
        isSuperset: true,
        supersetIndex,
        supersetExercises: superset,
        notes: `Superset (${superset.length} exercises)`,
      };

      allExercises.push(supersetExercise);
    });

    preparedWorkout.exercises = allExercises;
    return preparedWorkout;
  }, []);

  // Handle workout update from configurator
  const handleWorkoutUpdate = useCallback((updatedWorkout: any) => {
    console.log('🔧 Workout updated from configurator');
    setEditedWorkout(updatedWorkout);
  }, []);

  // Handle workout name change with error clearing
  const handleWorkoutNameChange = useCallback((name: string) => {
    setWorkoutName(name);
    if (workoutNameError && name.trim()) {
      setWorkoutNameError('');
    }
  }, [workoutNameError]);

  // Load example text
  const handleLoadExample = useCallback(() => {
    console.log('📖 Loading example workout text');
    const exampleText = `3x10 Squats @185lbs
3x8 Bench Press @155lbs
3x12 Barbell Bent Over Row @135lbs
4x15 Push Ups
3x8-12 Dumbbell Curl @30lbs ss 3x12 Dumbbell Overhead Tricep Extension @25lbs`;
    handleTextChange(exampleText);
  }, [handleTextChange]);

  // Check if workout has been successfully parsed
  const hasValidParsedWorkout = parseResult?.success && (editedWorkout || parseResult.workout);
  const showConfiguration = hasValidParsedWorkout;
  const isParseDisabled = !workoutText.trim() || !isParsingEnabled || isCurrentlyParsing;

  // Render the text input section
  const textInputSection = (
    <div className="space-y-6">
      <EnhancedTextInput
        workoutText={workoutText}
        workoutName={workoutName}
        onWorkoutTextChange={handleTextChange}
        onWorkoutNameChange={handleWorkoutNameChange}
        onParseWorkout={handleParseWorkout}
        onLoadExample={handleLoadExample}
        isParseDisabled={isParseDisabled}
      />

      {/* Real-time Preview */}
      <RealtimePreview
        workoutText={workoutText}
        isCollapsed={isPreviewCollapsed}
        onToggleCollapse={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
      />

      {/* Undo/Redo Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">History</span>
            <span className="text-xs text-gray-500">
              ({canUndoWorkoutText || canRedoWorkoutText ? 'Available' : 'No changes'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={undoWorkoutText}
              disabled={!canUndoWorkoutText}
              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors-smooth hover-lift btn-press focus-ring"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </button>

            <button
              onClick={redoWorkoutText}
              disabled={!canRedoWorkoutText}
              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors-smooth hover-lift btn-press focus-ring"
              title="Redo (Ctrl+Y)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
              Redo
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the configuration section with buttons
  const configurationSection = showConfiguration ? (
    <div className="space-y-4">
      <ParsedWorkoutConfigurator
        workout={editedWorkout || (parseResult?.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null)}
        onUpdate={handleWorkoutUpdate}
        compactMode={true}
        showActionButtons={false}
      />
      
      {/* Action Buttons directly under configurator */}
      <div className="space-y-2 pt-4 border-t border-gray-700">
        {/* Save Workout Button */}
        <button
          onClick={handleSaveWorkout}
          disabled={isSaving || !user?.uid}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {user?.uid ? 'Save Workout' : 'Login to Save'}
            </>
          )}
        </button>

        {/* Save Error Message */}
        {saveError && (
          <div className="text-red-400 text-sm mt-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {saveError}
          </div>
        )}

        {/* Share Workout Button */}
        {!isViewingSharedWorkout && (
          <button
            onClick={handleShareWorkout}
            disabled={!user?.uid}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            {user?.uid ? 'Share Workout' : 'Login to Share'}
          </button>
        )}

        {/* Start Workout Button */}
        <button
          onClick={handleStartWorkout}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
          </svg>
          Start Workout
        </button>

        {workoutNameError && (
          <div className="text-red-400 text-sm mt-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {workoutNameError}
          </div>
        )}
        
        <button
          onClick={handleClearWorkout}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Clear & Start Over
        </button>
      </div>
    </div>
  ) : null;

  // Render parse errors at bottom (only when there are errors)
  const parseErrorsSection = parseResult && !parseResult.success ? (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-lg font-medium text-white">
          Parse Errors
        </h3>
      </div>
      
      <div className="space-y-2">
        {parseResult.errors.map((error, index) => (
          <div key={index} className="bg-red-900/20 border border-red-700 rounded p-3">
            <div className="text-red-300 font-medium">
              Line {error.line}: {error.message}
            </div>
            {error.suggestion && (
              <div className="text-red-200 text-sm mt-1">
                Suggestion: {error.suggestion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // If viewing a shared workout, wrap with SharedWorkoutLoader
  if (isViewingSharedWorkout) {
    return (
      <SharedWorkoutLoader
        onWorkoutNotFound={() => navigate('/build')}
      >
        {(sharedWorkout) => (
          <SharedWorkoutBuildView
            sharedWorkout={sharedWorkout}
            workoutName={workoutName}
            setWorkoutName={setWorkoutName}
            workoutText={workoutText}
            setWorkoutText={setWorkoutText}
            exerciseDatabase={exerciseDatabase}
            debouncedAutoParse={debouncedAutoParse}
            textInputSection={textInputSection}
            configurationSection={configurationSection}
            showConfiguration={showConfiguration}
            parseErrorsSection={parseErrorsSection}
          />
        )}
      </SharedWorkoutLoader>
    );
  }

  // Regular build page for creating new workouts
  return (
    <>
      <BuildScreenLayout
        textInputSection={textInputSection}
        configurationSection={configurationSection}
        showConfiguration={showConfiguration}
        actionButtons={parseErrorsSection}
      />

      {/* Share Workout Modal */}
      {shareData && (
        <ShareWorkoutModal
          isOpen={showShareModal}
          onClose={handleCloseShareModal}
          workoutData={shareData}
        />
      )}
    </>
  );
}