import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { startWorkout } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';

// Debug: Verify WorkoutStorageService is properly imported
console.log('WorkoutStorageService import check:', {
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
import {
  AlertTriangle,
  Loader2,
  Redo2,
  Save,
  Share2,
  Trash2,
  Undo2,
  Play,
  LayoutGrid,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Stack } from '@/components/ui/stack';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  parseErrorsSection
}) => {
  console.log('SharedWorkoutBuildView rendering:', {
    shareId: sharedWorkout.shareId,
    workoutName: sharedWorkout.workoutData.name,
    hasWorkoutText: !!sharedWorkout.workoutData.workoutText,
    currentWorkoutName: workoutName,
    currentPath: window.location.pathname
  });

  // Populate workout data from shared workout when loaded
  useEffect(() => {
    console.log('BuildPage: SharedWorkout data population effect triggered:', {
      workoutName: sharedWorkout.workoutData.name,
      hasWorkoutText: !!sharedWorkout.workoutData.workoutText,
      workoutTextLength: sharedWorkout.workoutData.workoutText?.length || 0,
      exerciseDbLength: exerciseDatabase.length,
      currentWorkoutName: workoutName,
      currentWorkoutTextLength: workoutText.length
    });

    // Set the workout name if not already set
    if (!workoutName && sharedWorkout.workoutData.name) {
      console.log('BuildPage: Setting workout name from shared data:', sharedWorkout.workoutData.name);
      setWorkoutName(sharedWorkout.workoutData.name);
    }

    // Set the workout text if available and not already set
    if (!workoutText.trim() && sharedWorkout.workoutData.workoutText) {
      console.log('BuildPage: Setting workout text from shared data, length:', sharedWorkout.workoutData.workoutText.length);
      setWorkoutText(sharedWorkout.workoutData.workoutText);

      // Also trigger a parse if we have the text and exercises are loaded
      if (exerciseDatabase.length > 0) {
        console.log('BuildPage: Auto-parsing shared workout text after 500ms delay');
        setTimeout(() => {
          debouncedAutoParse(sharedWorkout.workoutData.workoutText);
        }, 500);
      } else {
        console.log('BuildPage: Exercise database not loaded yet, skipping auto-parse');
      }
    }
  }, [sharedWorkout, workoutName, workoutText, exerciseDatabase.length, setWorkoutName, setWorkoutText, debouncedAutoParse]);

  // Shared-workout context: a quiet subtle card under the page heading, not an
  // amber banner (amber is reserved for the page's one forward action).
  const sharedIntro = (
    <div className="rounded-[20px] bg-surface-subtle p-4">
      <p className="text-body-sm text-ink-muted">Shared by {sharedWorkout.creatorName}</p>
      <h2 className="mt-1 break-words font-display text-title text-ink">
        {sharedWorkout.workoutData.name}
      </h2>
      <p className="mt-2 text-body-sm text-accent-2">
        <span className="font-tabular">{sharedWorkout.metadata.viewCount}</span> views
        {' · '}
        <span className="font-tabular">{sharedWorkout.metadata.useCount}</span> uses
      </p>
      <p className="mt-2 text-body-sm text-ink-muted">
        Change anything you like, then start the workout.
      </p>
    </div>
  );

  return (
    <BuildScreenLayout
      intro={sharedIntro}
      textInputSection={textInputSection}
      actionButtons={parseErrorsSection}
    />
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
  // Text / Visual / Templates. A successful manual parse moves the user on to
  // Visual, where the next decision (review, then start) lives.
  const [activeTab, setActiveTab] = useState('text');

  // Get Firebase user from auth context - MUST be at top level
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Check if we're viewing a shared workout
  const { shareId } = useParams<{ shareId?: string }>() || {};
  const isViewingSharedWorkout = !!shareId;

  console.log('BuildPage rendering:', {
    shareId,
    isViewingSharedWorkout,
    hasUser: !!user,
    path: window.location.pathname
  });

  // Log exercise database loading status
  React.useEffect(() => {
    console.log('Exercise database status:', {
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
      console.log('Auto-parse skipped:', { 
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
        console.log('Auto-parse successful, updating state');
        setParseResult(result);
        // Always update editedWorkout from auto-parse to avoid stale state issues
        setEditedWorkout(prepareWorkoutForConfigurator(result.workout));
      } else {
        console.log('Auto-parse failed, keeping existing state');
      }
    } catch (error) {
      // Silently handle parse errors for auto-parsing
      console.warn('Auto-parse failed:', error);
    }
  }, [parser, exerciseDatabase, autoParseEnabled, isCurrentlyParsing]);

  // Handle text changes with debounced auto-parsing
  const handleTextChange = useCallback((text: string) => {
    console.log('Text changed, length:', text.trim().length);
    setWorkoutText(text);
    
    // Clear timeout if it exists
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Reset parse state for significant changes
    const significantChange = Math.abs(text.trim().length - workoutText.trim().length) > 10;
    if (significantChange) {
      console.log('Significant text change detected, resetting parse state');
      setParseResult(null);
      setEditedWorkout(null);
    }
    
    // Set up debounced auto-parse (2 second delay)
    if (autoParseEnabled && text.trim().length > 10 && !isCurrentlyParsing) {
      console.log('Setting up auto-parse timer (2s delay)');
      debounceTimeoutRef.current = setTimeout(() => {
        console.log('Auto-parse timer triggered');
        debouncedAutoParse(text);
      }, 2000);
    } else if (isCurrentlyParsing) {
      console.log('Skipping auto-parse setup (currently parsing)');
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
      console.log(`Exercise "${exercise.name}": ${found ? `Found as "${found.name}"` : 'Not found'}`);
      if (!found) {
        notFound.push(exercise.name);
      }
    });
    return notFound;
  }, [findExerciseInDatabase]);

  // Handle explicit parse request
  const handleParseWorkout = useCallback(async () => {
    if (!workoutText.trim() || isCurrentlyParsing) return;
    
    console.log('Manual parse triggered');
    setIsCurrentlyParsing(true);
    
    try {
      // Cancel any pending auto-parse
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
        console.log('Cancelled pending auto-parse');
      }
      
      // Clear previous parse result to ensure fresh state
      setParseResult(null);
      setEditedWorkout(null);
      
      console.log('Cleared previous parse state');
      
      const result = parser.parse(workoutText);
    
    // Only validate against database if exercises are loaded and parsing was successful
    if (result.success && result.workout && exerciseDatabase && exerciseDatabase.length > 0) {
      // Get all exercises from workout
      const allExercises = [
        ...result.workout.exercises,
        ...result.workout.supersets.flat()
      ];
      
      console.log('Validating exercises:', allExercises.map(ex => ex.name));
      
      // Instead of failing, just add warnings for exercises not found
      const suggestions = parser.validateExerciseNames(allExercises, exerciseDatabase);
      result.warnings = [...result.warnings, ...suggestions];
      
      // Log which exercises were not found for debugging
      const notFoundExercises = validateAllExercisesExist(allExercises);
      if (notFoundExercises.length > 0) {
        console.log('Some exercises not found in database:', notFoundExercises);
        console.log('This is OK - they will be created as custom exercises');
      }
    }
    
    console.log('Setting parse result:', { success: result.success, hasWorkout: !!result.workout, errors: result.errors.length });
    
    setParseResult(result);
    if (result.success && result.workout) {
      setEditedWorkout(prepareWorkoutForConfigurator(result.workout));
      setActiveTab('visual');
      console.log('Manual parse completed successfully');
    } else {
      console.log('Manual parse failed');
    }
    } catch (error) {
      console.error('Error during manual parse:', error);
    } finally {
      setIsCurrentlyParsing(false);
    }
  }, [workoutText, exerciseDatabase, parser, validateAllExercisesExist, isCurrentlyParsing]);

  // Handle clear and restart
  const handleClearWorkout = () => {
    console.log('Clearing workout and resetting state');
    
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
    
    console.log('Workout cleared successfully');
  };

  // Handle share workout
  const handleShareWorkout = () => {
    if (!workoutName.trim()) {
      setWorkoutNameError('Name your workout first.');
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
    console.log('BuildPage: Starting workout from build page:', {
      isViewingSharedWorkout,
      shareId,
      workoutName,
      hasUser: !!user,
      currentPath: window.location.pathname
    });

    if (!workoutName.trim()) {
      setWorkoutNameError('Name your workout first.');
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
      console.log('BuildPage: Stored shared workout context in sessionStorage');
    }

    // Navigate to appropriate route based on shared status
    if (isViewingSharedWorkout && shareId) {
      const targetRoute = `/workout/shared/${shareId}`;
      console.log('BuildPage: Starting shared workout, navigating to:', targetRoute);
      navigate(targetRoute);
    } else {
      console.log('BuildPage: Starting regular workout, navigating to:', '/workout');
      navigate('/workout');
    }
  };

  const handleSaveWorkout = async () => {
    console.log('handleSaveWorkout called, checking service availability...');

    // Debug: Check service availability at runtime
    if (!WorkoutStorageService) {
      console.error('WorkoutStorageService is undefined!');
      setSaveError('WorkoutStorageService is not available. Please refresh the page.');
      return;
    }

    if (typeof WorkoutStorageService.saveWorkout !== 'function') {
      console.error('WorkoutStorageService.saveWorkout is not a function!', {
        service: WorkoutStorageService,
        saveWorkout: WorkoutStorageService.saveWorkout,
        typeof: typeof WorkoutStorageService.saveWorkout
      });
      setSaveError('Save function is not available. Please refresh the page.');
      return;
    }

    console.log('WorkoutStorageService is available, proceeding with save...');

    if (!workoutName.trim()) {
      setWorkoutNameError('Name your workout first.');
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

      console.log('About to call WorkoutStorageService.saveWorkout with:', {
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

      console.log('Workout saved successfully:', workoutId);

      // Show success message and optionally navigate
      alert(`Saved "${workoutName}". You can find it in your profile.`);

      // Optionally reset the form or navigate to profile
      // navigate('/profile');
    } catch (error: any) {
      console.error('Error saving workout:', error);
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
    console.log('Workout updated from configurator');
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
    console.log('Loading example workout text');
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
  // Render the configuration section with action buttons. Declared before the
  // mode-selector tabs because the Visual tab renders it.
  const configurationSection = showConfiguration ? (
    <div className="space-y-5">
      <ParsedWorkoutConfigurator
        workout={editedWorkout || (parseResult?.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null)}
        onUpdate={handleWorkoutUpdate}
        compactMode={true}
        showActionButtons={false}
      />

      {/* One amber action (start), the rest secondary or ghost */}
      <Stack gap={2}>
        {workoutNameError && (
          <Stack direction="row" align="center" gap={2} className="text-body-sm text-danger" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{workoutNameError}</span>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('text')}>
              Add a name
            </Button>
          </Stack>
        )}

        <Button variant="primary" size="xl" onClick={handleStartWorkout}>
          <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" />
          Start workout
        </Button>

        <div className={isViewingSharedWorkout ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-2'}>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleSaveWorkout}
            disabled={isSaving || !user?.uid}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Saving
              </>
            ) : (
              <>
                <Save className="h-5 w-5" aria-hidden="true" />
                {user?.uid ? 'Save routine' : 'Sign in to save'}
              </>
            )}
          </Button>

          {!isViewingSharedWorkout && (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleShareWorkout}
              disabled={!user?.uid}
            >
              <Share2 className="h-5 w-5" aria-hidden="true" />
              {user?.uid ? 'Share' : 'Sign in to share'}
            </Button>
          )}
        </div>

        {saveError && (
          <Stack direction="row" align="center" gap={2} className="text-body-sm text-danger" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {saveError}
          </Stack>
        )}

        <Button variant="ghost" onClick={handleClearWorkout}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear and start over
        </Button>
      </Stack>
    </div>
  ) : null;

  // History (undo/redo) controls: a quiet row under the text editor.
  const historyControls = (
    <Stack direction="row" align="center" justify="end" gap={1}>
      <Button
        variant="ghost"
        onClick={undoWorkoutText}
        disabled={!canUndoWorkoutText}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        Undo
      </Button>
      <Button
        variant="ghost"
        onClick={redoWorkoutText}
        disabled={!canRedoWorkoutText}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="h-4 w-4" aria-hidden="true" />
        Redo
      </Button>
    </Stack>
  );

  // Mode selector: Text (natural-language editor) / Visual (parsed
  // configurator) / Templates. Built on the Tabs primitive.
  const textInputSection = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="flex w-full">
        <TabsTrigger value="text" className="min-h-[44px] flex-1 gap-1.5">
          <FileText className="h-4 w-4" aria-hidden="true" />
          Text
        </TabsTrigger>
        <TabsTrigger value="visual" className="min-h-[44px] flex-1 gap-1.5">
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          Visual
        </TabsTrigger>
        <TabsTrigger value="templates" className="min-h-[44px] flex-1 gap-1.5">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Templates
        </TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="space-y-4">
        {historyControls}

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
      </TabsContent>

      <TabsContent value="visual" className="space-y-4">
        {showConfiguration ? (
          configurationSection
        ) : (
          <Card>
            <CardBody className="p-5 pt-5">
              <p className="text-body font-semibold text-ink">Nothing to arrange yet</p>
              <p className="mt-1 text-body-sm text-ink-muted">
                Write your workout in Text and parse it. The exercises land here to
                reorder, pair and tune.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => setActiveTab('text')}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Go to Text
              </Button>
            </CardBody>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="templates" className="space-y-4">
        <Card>
          <CardBody className="p-5 pt-5">
            <p className="text-body font-semibold text-ink">Templates</p>
            <p className="mt-1 text-body-sm text-ink-muted">
              Saved and starter templates will appear here.
            </p>
            <Button variant="secondary" className="mt-4" onClick={handleLoadExample}>
              Load example workout
            </Button>
          </CardBody>
        </Card>
      </TabsContent>
    </Tabs>
  );

  // Render parse errors at bottom (only when there are errors)
  const parseErrorsSection = parseResult && !parseResult.success ? (
    <Card>
      <CardBody className="p-4 pt-4" role="alert">
        <Stack direction="row" align="center" gap={2} className="mb-1">
          <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
          <h3 className="text-body font-semibold text-ink">
            Couldn&rsquo;t read <span className="font-tabular">{parseResult.errors.length}</span> line{parseResult.errors.length !== 1 ? 's' : ''}
          </h3>
        </Stack>

        <ul className="divide-y divide-hairline">
          {parseResult.errors.map((error, index) => (
            <li key={index} className="py-3 text-body-sm">
              <div className="flex gap-3">
                <span className="shrink-0 font-tabular text-ink-muted">Line {error.line}</span>
                <span className="min-w-0 text-danger">{error.message}</span>
              </div>
              {error.suggestion && (
                <p className="mt-1 text-ink-muted">Try: {error.suggestion}</p>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
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