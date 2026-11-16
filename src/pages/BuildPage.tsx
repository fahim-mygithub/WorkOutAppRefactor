import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { startWorkout } from '../store/slices/workoutSlice';
import {
  buildDraftChanged,
  buildDraftStashed,
  buildEditConsumed,
  buildPresetConsumed,
  type BuildPlanEditTarget,
} from '../store/slices/aiSlice';
import { usePublishScreen } from '../ai/useScreenSnapshot';
import { draftTextForAi, readDraft } from '../ai/buildDraft';
import { workoutText as aiWorkoutText } from '../ai/workoutText';
import { WorkoutStorageService } from '../services/workoutStorageService';

// Debug: Verify WorkoutStorageService is properly imported
console.log('WorkoutStorageService import check:', {
  service: WorkoutStorageService,
  saveWorkout: WorkoutStorageService?.saveWorkout,
  typeof: typeof WorkoutStorageService
});
import { syncExerciseEmphasis, WorkoutExercise, WorkoutSet, Exercise } from '../types/exercise';
import { WorkoutParser } from '../parser/workoutParser';
import { ParsedExercise, ParsedWorkout, ParseResult } from '../parser/types';
import { BuildScreenLayout } from '../components/workout/BuildScreenLayout';
import { EnhancedTextInput } from '../components/workout/EnhancedTextInput';
import { ParsedWorkoutConfigurator } from '../components/workout/ParsedWorkoutConfigurator';
import { RealtimePreview } from '../components/workout/RealtimePreview';
import { ExerciseQuickAdd, newBuilderExercise } from '../components/workout/ExerciseQuickAdd';
import { MachinePhotoAdd, type MachineDefaults } from '../components/ai/MachinePhotoAdd';
import { workoutNameForLifts } from '../lib/trackedLifts';
import { buildTrackedWorkout, type LiftGoals } from '../lib/trackedLiftProgression';
import { matchExercise } from '../lib/exerciseMatch';
import { orderForWorkout } from '../lib/builderSupersets';
import { dateKeyToDate } from '../lib/dateKey';
import type { SessionGoal, TrackedLift } from '../types/trackedLifts';
import { useExercises } from '../hooks/useExercises';
import { useUndoRedo } from '../hooks/useUndoRedo';
import {
  generateFallbackExerciseId,
  prepareWorkoutForConfigurator,
  sanitizeWorkoutExercisesForRedux,
} from '../utils/workoutConversion';
import { SharedWorkoutLoader } from '../components/SharedWorkoutLoader';
import { ShareWorkoutModal } from '../components/ShareWorkoutModal';
import { useParams } from 'react-router-dom';
import { CreateSharedWorkoutData, SharedWorkout } from '../services/sharedWorkoutService';
import type { CustomExercise } from '../services/customExerciseService';
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
  Calendar,
  X,
} from 'lucide-react';
import { planAdded, updatePlanned } from '../store/slices/plannedWorkoutsSlice';
import { PlanDateModal } from '../components/plan/PlanDateModal';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function formatPlanEditDate(dateKey: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(dateKeyToDate(dateKey));
  } catch {
    return dateKey;
  }
}

function toParsedWorkoutFromVisual(visual: any): ParsedWorkout {
  if (!visual) return { exercises: [], supersets: [] };
  const all: any[] = visual.exercises ?? [];
  const strip = ({ supersetGroup: _g, ...rest }: any): ParsedExercise => rest;
  const plain: ParsedExercise[] = [];
  const supersets: ParsedExercise[][] = all
    .filter((e) => e.isSuperset && Array.isArray(e.supersetExercises))
    .map((e) => e.supersetExercises.map(strip));
  orderForWorkout<any>(all.filter((e) => !e.isSuperset && Array.isArray(e.sets))).forEach((unit) => {
    if (Array.isArray(unit) && unit.length > 1) {
      supersets.push(unit.map(strip));
    } else {
      const single = Array.isArray(unit) ? unit[0] : unit;
      if (single) plain.push(strip(single));
    }
  });
  return { exercises: plain, supersets };
}

function mergePreservedMetadata(prev: any, nextPrepared: any): any {
  if (!prev?.exercises?.length || !nextPrepared?.exercises?.length) return nextPrepared;
  const used = new Set<number>();
  const norm = (s: string) => s.trim().toLowerCase();
  const mergedExercises = nextPrepared.exercises.map((nextEx: any) => {
    const idx = prev.exercises.findIndex(
      (p: any, i: number) => !used.has(i) && norm(String(p.name ?? '')) === norm(String(nextEx.name ?? '')),
    );
    if (idx === -1) return nextEx;
    used.add(idx);
    const prevEx = prev.exercises[idx];
    let tracked = nextEx.tracked ?? prevEx.tracked;
    if (tracked && tracked.goal !== 'checkpoint') {
      if (nextEx.emphasis) {
        tracked = { ...tracked, goal: nextEx.emphasis };
      } else if (prevEx.emphasis && !nextEx.emphasis) {
        tracked = undefined;
      }
    }
    return {
      ...nextEx,
      ...(nextEx.notes === undefined && prevEx.notes ? { notes: prevEx.notes } : {}),
      ...(nextEx.restTime === undefined && prevEx.restTime ? { restTime: prevEx.restTime } : {}),
      ...(tracked ? { tracked } : {}),
    };
  });
  return { ...nextPrepared, exercises: mergedExercises };
}

export default function BuildPage() {
  const { toasts, removeToast, showError } = useToast();
  const { shareId } = useParams<{ shareId?: string }>() || {};
  const isViewingSharedWorkout = !!shareId;
  const stashedBuildDraft = useAppSelector((s) => s.ai.stashedBuildDraft);
  const initialStashed = !isViewingSharedWorkout ? stashedBuildDraft : undefined;

  const {
    value: workoutText,
    setValue: setWorkoutText,
    undo: undoWorkoutText,
    redo: redoWorkoutText,
    canUndo: canUndoWorkoutText,
    canRedo: canRedoWorkoutText,
    reset: resetWorkoutText,
  } = useUndoRedo<string>(initialStashed?.workoutText ?? '', 50);

  const [workoutName, setWorkoutName] = useState(initialStashed?.workoutName ?? '');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsingEnabled, setIsParsingEnabled] = useState(true);
  const [autoParseEnabled, setAutoParseEnabled] = useState(true);
  const [isCurrentlyParsing, setIsCurrentlyParsing] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { exercises: exerciseDatabase } = useExercises(); // Ensure exercises are loaded
  const [editedWorkout, setEditedWorkout] = useState<any>(initialStashed?.editedWorkout ?? null);
  const preservedMetadataRef = useRef<any>(initialStashed?.editedWorkout ?? null);
  useEffect(() => {
    if (editedWorkout?.exercises?.length) {
      preservedMetadataRef.current = editedWorkout;
    }
  }, [editedWorkout]);
  const [editingPlan, setEditingPlan] = useState<BuildPlanEditTarget | null>(
    initialStashed?.editingPlan ?? null,
  );
  const [workoutNameError, setWorkoutNameError] = useState('');
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Text / Visual / Templates. A successful manual parse moves the user on to
  // Visual, where the next decision (review, then start) lives.
  const [activeTab, setActiveTab] = useState(initialStashed?.activeTab ?? 'text');

  // Get Firebase user from auth context - MUST be at top level
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  // Tracked lifts checked on the Build chooser arrive in router state with the
  // session goal: open on Visual with their sets worked out (progression lifts)
  // or copied (accessories). The state is cleared right away so a refresh or
  // back-navigation doesn't re-add them.
  useEffect(() => {
    const state = location.state as {
      trackedLifts?: TrackedLift[];
      goal?: SessionGoal;
      goals?: LiftGoals;
    } | null;
    const lifts = state?.trackedLifts;
    if (!lifts?.length) return;
    // `goals` is the per-lift map from the chooser; `goal` is one goal for all.
    const goal = state?.goal ?? state?.goals ?? null;
    const built = buildTrackedWorkout(lifts, goal);
    preservedMetadataRef.current = built;
    setEditingPlan(null);
    setEditedWorkout(built);
    resetWorkoutText(aiWorkoutText(toParsedWorkoutFromVisual(built)));
    setWorkoutName(
      (name) => name || (goal === 'checkpoint' ? 'Checkpoint day' : workoutNameForLifts(lifts)),
    );
    setActiveTab('visual');
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, resetWorkoutText]);

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
  const [isPlanDateModalOpen, setIsPlanDateModalOpen] = useState(false);
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
        const nextPrepared = prepareWorkoutForConfigurator(result.workout);
        setEditedWorkout((prev: any) =>
          mergePreservedMetadata(prev ?? preservedMetadataRef.current, nextPrepared),
        );
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

  // Typed name -> library exercise (ranked: "bench press" is the barbell bench
  // press, not the first entry that happens to contain the words).
  const findExerciseInDatabase = useCallback(
    (exerciseName: string): Exercise | null => matchExercise(exerciseName, exerciseDatabase),
    [exerciseDatabase],
  );

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
      const priorEdited = editedWorkout ?? preservedMetadataRef.current;
      setParseResult(null);
      
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
      setEditedWorkout(mergePreservedMetadata(priorEdited, prepareWorkoutForConfigurator(result.workout)));
      setActiveTab('visual');
      console.log('Manual parse completed successfully');
    } else {
      setEditedWorkout(null);
      console.log('Manual parse failed');
    }
    } catch (error) {
      console.error('Error during manual parse:', error);
    } finally {
      setIsCurrentlyParsing(false);
    }
  }, [workoutText, editedWorkout, exerciseDatabase, parser, validateAllExercisesExist, isCurrentlyParsing]);

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
    preservedMetadataRef.current = null;
    setEditedWorkout(null);
    setEditingPlan(null);
    setWorkoutNameError('');
    dispatch(buildDraftChanged(false));
    
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

    // One parsed exercise -> a player exercise (sets, rep ranges, time, notes,
    // tracked-lift origin, and Volume/Strength emphasis).
    const toWorkoutExercise = (exercise: any, index: number, id: string): WorkoutExercise => {
      const dbExercise = findExerciseInDatabase(exercise.name);
      const workoutSets: WorkoutSet[] = exercise.sets.map((set: any, setIndex: number) => ({
        id: `set-${id}-${setIndex}`,
        reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
        // A rep range (Volume 8-12) drives the player's double progression.
        ...(typeof set.reps === 'object' && { repMin: set.reps.min, repMax: set.reps.max }),
        weight: set.weight,
        unit: set.unit,
        ...(set.time && { time: set.time }),
        completed: false,
      }));
      const emphasis =
        exercise.emphasis ??
        (exercise.tracked?.goal === 'volume' || exercise.tracked?.goal === 'strength'
          ? exercise.tracked.goal
          : undefined);
      return syncExerciseEmphasis({
        id,
        exercise: dbExercise || createFallbackExercise(exercise.name, index),
        sets: workoutSets,
        restTime: exercise.restTime || 120,
        ...(exercise.notes && { notes: exercise.notes }),
        ...(exercise.tracked && { tracked: exercise.tracked }),
        ...(emphasis && { emphasis }),
      });
    };

    // Visual-tab supersets: partners pulled together, tagged so the player
    // alternates between them each round.
    const units = orderForWorkout<any>(workout.exercises);
    units.forEach((unit: any, index: number) => {
      if (Array.isArray(unit)) {
        const supersetId = `superset-${Date.now()}-v${index}`;
        const members = unit.map((ex: any, i: number) => ({
          ...toWorkoutExercise(ex, index + i, `exercise-${Date.now()}-${index}-${i}`),
          isSuperset: true,
          supersetId,
          supersetIndex: i,
          notes: [`Superset (${i + 1}/${unit.length})`, ex.notes].filter(Boolean).join(' · '),
        }));
        members[0].supersetExerciseIds = members.map((m: WorkoutExercise) => m.id);
        workoutExercises.push(...members);
        return;
      }
      const exercise = unit;
      // Check if this is a superset exercise (from configurator prepared data)
      if (exercise.isSuperset && exercise.supersetExercises) {
        // Handle superset - create individual exercises for workout execution
        const supersetId = `superset-${Date.now()}-${exercise.supersetIndex}`;
        const supersetExercises: WorkoutExercise[] = exercise.supersetExercises.map(
          (parsedExercise: any, exerciseIndex: number) => ({
            ...toWorkoutExercise(
              parsedExercise,
              workoutExercises.length + exerciseIndex,
              `exercise-superset-${Date.now()}-${exercise.supersetIndex}-${exerciseIndex}`,
            ),
            restTime: parsedExercise.restTime || 90,
            isSuperset: true,
            supersetId,
            supersetIndex: exerciseIndex,
            notes: [
              `Superset ${exercise.supersetIndex + 1}${exercise.supersetExercises.length > 1 ? ` (${exerciseIndex + 1}/${exercise.supersetExercises.length})` : ''}`,
              parsedExercise.notes,
            ]
              .filter(Boolean)
              .join(' · '),
          }),
        );

        // Add superset exercise IDs to the first exercise for navigation
        if (supersetExercises.length > 0) {
          supersetExercises[0].supersetExerciseIds = supersetExercises.map(ex => ex.id);
        }

        // Add all superset exercises to the main workout
        workoutExercises.push(...supersetExercises);
      } else {
        // Regular exercise (Visual-tab supersets were handled above)
        workoutExercises.push(toWorkoutExercise(exercise, index, `exercise-${Date.now()}-${index}`));
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
    dispatch(buildDraftChanged(false));

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

  const handleSaveForLater = (chosenDateKey: string) => {
    setWorkoutNameError('');
    const workoutToUse = editedWorkout || (parseResult?.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null);
    if (!workoutToUse) {
      showError('No valid workout found');
      return;
    }
    const exercises = convertToWorkoutExercises(workoutToUse);
    if (exercises.length === 0) {
      showError('No valid exercises found');
      return;
    }
    const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);
    dispatch(
      planAdded({
        name: workoutName.trim() || 'Custom Workout',
        dateKey: chosenDateKey,
        exercises: sanitizedExercises,
      }),
    );
    dispatch(buildDraftChanged(false));
    navigate('/');
  };

  const resolveCurrentVisualWorkout = () => {
    if (activeTab === 'text' && workoutText.trim()) {
      const parsed = parser.parse(workoutText);
      if (parsed.success && parsed.workout) {
        return mergePreservedMetadata(
          editedWorkout ?? preservedMetadataRef.current,
          prepareWorkoutForConfigurator(parsed.workout),
        );
      }
    }
    return (
      editedWorkout ||
      (parseResult?.workout
        ? mergePreservedMetadata(preservedMetadataRef.current, prepareWorkoutForConfigurator(parseResult.workout))
        : { exercises: [], supersets: [] })
    );
  };

  const handleSavePlan = () => {
    if (!editingPlan) return;
    if (!workoutName.trim()) {
      setWorkoutNameError('Name your workout first.');
      return;
    }
    setWorkoutNameError('');
    setSaveError('');
    const workoutToUse = resolveCurrentVisualWorkout();
    const exercises = convertToWorkoutExercises(workoutToUse);
    const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);
    dispatch(
      updatePlanned({
        id: editingPlan.planId,
        name: workoutName.trim(),
        exercises: sanitizedExercises,
      }),
    );
    resetWorkoutText('');
    setWorkoutName('');
    setParseResult(null);
    preservedMetadataRef.current = null;
    setEditedWorkout(null);
    setEditingPlan(null);
    dispatch(buildDraftChanged(false));
    navigate('/');
  };

  const handleCancelPlanEdit = () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    resetWorkoutText('');
    setWorkoutName('');
    setParseResult(null);
    preservedMetadataRef.current = null;
    setEditedWorkout(null);
    setEditingPlan(null);
    setWorkoutNameError('');
    setSaveError('');
    dispatch(buildDraftChanged(false));
    navigate('/');
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

    const resolvedWorkout = resolveCurrentVisualWorkout();
    const workoutToUse = resolvedWorkout?.exercises?.length ? resolvedWorkout : null;
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
      const customExercises: CustomExercise[] = convertToWorkoutExercises(workoutToUse)
        .filter(exercise => exercise.exercise.id.startsWith('fallback-'))
        .map(exercise => ({
          ...exercise.exercise,
          id: exercise.exercise.id,
          userId: user.uid,
          isCustom: true as const,
          originalName: exercise.exercise.name,
          usageCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

      console.log('About to call WorkoutStorageService.saveWorkout with:', {
        userId: user.uid,
        workoutName: workoutName.trim(),
        serviceCheck: !!WorkoutStorageService,
        saveWorkoutMethod: !!WorkoutStorageService.saveWorkout
      });

      const structuredParsed = toParsedWorkoutFromVisual(workoutToUse);
      const workoutId = await WorkoutStorageService.saveWorkout(user.uid, {
        name: workoutName.trim(),
        description: `Workout created from build page with ${structuredParsed.exercises.length + structuredParsed.supersets.length} exercises`,
        workoutText: workoutText.trim() || aiWorkoutText(structuredParsed),
        parsedWorkout: structuredParsed,
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

  // A workout the assistant loaded (loadIntoBuild) or a planned workout being edited:
  // it replaces what is here and opens on Visual for review; nothing is saved until the lifter does.
  const buildPreset = useAppSelector((s) => s.ai.buildPreset);
  useEffect(() => {
    if (!buildPreset || isViewingSharedWorkout) return;
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    const { workout, planEdit } = buildPreset;
    resetWorkoutText(workout.workoutText);
    setParseResult(null);
    setEditingPlan(
      planEdit ? { planId: planEdit.planId, dateKey: planEdit.dateKey } : null,
    );
    const nextEdited = planEdit?.exercises
      ? { exercises: planEdit.exercises, supersets: [] }
      : prepareWorkoutForConfigurator({
          exercises: workout.parsedWorkout.exercises ?? [],
          supersets: workout.parsedWorkout.supersets ?? [],
        });
    preservedMetadataRef.current = nextEdited;
    setEditedWorkout(nextEdited);
    setWorkoutName(buildPreset.name);
    setWorkoutNameError('');
    setActiveTab('visual');
    dispatch(buildPresetConsumed(buildPreset.id));
  }, [buildPreset, isViewingSharedWorkout, resetWorkoutText, dispatch]);

  // Tells the assistant (and plan Edit buttons) whether loading a workout here
  // would replace unsaved Builder content, keeping the draft across route switches.
  const hasDraft = !!(workoutText.trim() || workoutName.trim() || editedWorkout || editingPlan);
  useEffect(() => {
    if (isViewingSharedWorkout) return;
    if (hasDraft) {
      dispatch(
        buildDraftStashed({
          workoutName,
          workoutText,
          editedWorkout,
          activeTab,
          editingPlan,
        }),
      );
    } else {
      dispatch(buildDraftChanged(false));
    }
  }, [
    hasDraft,
    workoutName,
    workoutText,
    editedWorkout,
    activeTab,
    editingPlan,
    isViewingSharedWorkout,
    dispatch,
  ]);

  // Handle workout update from configurator (syncs text so switching tabs or re-parsing preserves pairings & emphasis)
  const handleWorkoutUpdate = useCallback((updatedWorkout: any) => {
    console.log('Workout updated from configurator');
    setEditedWorkout(updatedWorkout);
    setWorkoutText(aiWorkoutText(toParsedWorkoutFromVisual(updatedWorkout)));
  }, [setWorkoutText]);

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
  const visualWorkout =
    editedWorkout ||
    (parseResult?.success && parseResult.workout ? prepareWorkoutForConfigurator(parseResult.workout) : null);
  const showConfiguration = (visualWorkout?.exercises?.length ?? 0) > 0;

  // The assistant reads this screen: the draft as the lifter sees it (the
  // Visual list on Visual, else the typed text), as text the parser reads, and
  // its exercises. Published while Build is open, cleared when it closes.
  const draftText = useMemo(() => {
    const onVisual = activeTab === 'visual' || !workoutText.trim();
    if (!onVisual || !visualWorkout) return workoutText;
    return aiWorkoutText(toParsedWorkoutFromVisual(visualWorkout));
  }, [activeTab, workoutText, visualWorkout]);
  const draftReading = useMemo(() => readDraft(draftText), [draftText]);
  usePublishScreen(
    'build',
    isViewingSharedWorkout
      ? null
      : {
          tab: 'build',
          title: editingPlan ? 'Edit planned workout' : 'Build workout',
          summary: [
            editingPlan
              ? `Editing plan "${workoutName.trim().slice(0, 60) || 'Untitled'}" (${editingPlan.dateKey})`
              : workoutName.trim()
                ? `Draft "${workoutName.trim().slice(0, 60)}"`
                : 'Unnamed draft',
            draftReading.exercises.length
              ? `${draftReading.exercises.length} exercise${draftReading.exercises.length === 1 ? '' : 's'}`
              : 'empty',
            `${activeTab} tab`,
          ].join(', '),
          data: {
            name: workoutName,
            view: activeTab,
            text: draftTextForAi(draftText),
            exercises: draftReading.exercises.slice(0, 25),
            ...(editingPlan ? { editingPlan: { planId: editingPlan.planId, dateKey: editingPlan.dateKey } } : {}),
            ...(draftReading.issues.length ? { issues: draftReading.issues } : {}),
          },
          draft: { name: workoutName, text: draftText },
        },
  );

  // An edit the assistant made (setBuildName, editBuildExercise, setBuildEmphasis, ...): apply
  // it to this page's own state. The text goes through the same history as the
  // lifter's typing and is parsed at once, so the preview shows it.
  const buildEdit = useAppSelector((s) => s.ai.buildEdit);
  useEffect(() => {
    if (!buildEdit || isViewingSharedWorkout) return;
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (buildEdit.name !== undefined) {
      setWorkoutName(buildEdit.name);
      setWorkoutNameError('');
    }
    if (buildEdit.text !== undefined) {
      const text = buildEdit.text;
      setWorkoutText(text);
      const result = text.trim() ? parser.parse(text) : null;
      if (result?.success && result.workout) {
        if (exerciseDatabase.length > 0) {
          const all = [...result.workout.exercises, ...result.workout.supersets.flat()];
          result.warnings = [...result.warnings, ...parser.validateExerciseNames(all, exerciseDatabase)];
        }
        setParseResult(result);
        const nextPrepared = prepareWorkoutForConfigurator(result.workout);
        setEditedWorkout((prev: any) =>
          mergePreservedMetadata(prev ?? preservedMetadataRef.current, nextPrepared),
        );
      } else {
        setParseResult(null);
        setEditedWorkout(null);
      }
    }
    dispatch(buildEditConsumed(buildEdit.id));
  }, [buildEdit, isViewingSharedWorkout, parser, exerciseDatabase, setWorkoutText, dispatch]);

  // Visual's "Add an exercise": append to whatever is on the board (or start one).
  const handleVisualAdd = useCallback((exercise: Exercise) => {
    const base = visualWorkout ?? { exercises: [], supersets: [] };
    const next = { ...base, exercises: [...base.exercises, newBuilderExercise(exercise)] };
    setEditedWorkout(next);
    setWorkoutText(aiWorkoutText(toParsedWorkoutFromVisual(next)));
  }, [visualWorkout, setWorkoutText]);

  // Visual's "Add from a photo": the machine's exercise with the sets the card ended on.
  const handleMachineAdd = useCallback((exercise: Exercise, defaults: MachineDefaults) => {
    const base = visualWorkout ?? { exercises: [], supersets: [] };
    const sets = Array.from({ length: defaults.sets }, () => ({ reps: defaults.reps, rest: 120 }));
    const next = { ...base, exercises: [...base.exercises, { name: exercise.name, sets }] };
    setEditedWorkout(next);
    setWorkoutText(aiWorkoutText(toParsedWorkoutFromVisual(next)));
  }, [visualWorkout, setWorkoutText]);
  const isParseDisabled = !workoutText.trim() || !isParsingEnabled || isCurrentlyParsing;

  // Render the configuration section with action buttons. Declared before the
  // mode-selector tabs because the Visual tab renders it.
  const configurationSection = showConfiguration ? (
    <div className="space-y-5">
      <ParsedWorkoutConfigurator
        workout={visualWorkout}
        onUpdate={handleWorkoutUpdate}
        compactMode={true}
        showActionButtons={false}
      />

      {!editingPlan && (
        <Stack gap={2}>
          {workoutNameError && (
            <Stack direction="row" align="center" gap={2} className="text-body-sm text-danger" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{workoutNameError}</span>
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

          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIsPlanDateModalOpen(true)}
          >
            <Calendar className="h-5 w-5" aria-hidden="true" />
            Save for later
          </Button>

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
      )}
    </div>
  ) : null;

  const planEditIntro = editingPlan ? (
    <div
      data-testid="editing-plan-banner"
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-subtle px-4 py-3"
    >
      <p className="min-w-0 flex-1 break-words text-body-sm font-semibold text-ink">
        {`Editing plan: ${workoutName.trim() || 'Untitled'} · ${formatPlanEditDate(editingPlan.dateKey)}`}
      </p>
      <span className="font-tabular text-caption text-ink-muted">{editingPlan.dateKey}</span>
    </div>
  ) : undefined;

  const planEditActionsSection = editingPlan ? (
    <Stack gap={2} className="pt-2">
      {workoutNameError && (
        <Stack direction="row" align="center" gap={2} className="text-body-sm text-danger" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{workoutNameError}</span>
        </Stack>
      )}
      {saveError && (
        <Stack direction="row" align="center" gap={2} className="text-body-sm text-danger" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {saveError}
        </Stack>
      )}

      <Button variant="primary" size="xl" onClick={handleSavePlan}>
        <Save className="h-5 w-5" aria-hidden="true" />
        Save plan
      </Button>

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
            Save as new workout
          </>
        )}
      </Button>

      <Button variant="ghost" onClick={handleCancelPlanEdit}>
        <X className="h-4 w-4" aria-hidden="true" />
        Cancel
      </Button>
    </Stack>
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

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (activeTab === 'text' && nextTab === 'visual' && workoutText.trim()) {
        const canonical = editedWorkout ? aiWorkoutText(toParsedWorkoutFromVisual(editedWorkout)) : '';
        if (!editedWorkout || workoutText.trim() !== canonical.trim()) {
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
          }
          const result = parser.parse(workoutText);
          if (result.success && result.workout) {
            setParseResult(result);
            setEditedWorkout(
              mergePreservedMetadata(
                editedWorkout ?? preservedMetadataRef.current,
                prepareWorkoutForConfigurator(result.workout),
              ),
            );
          }
        }
      }
      setActiveTab(nextTab);
    },
    [activeTab, workoutText, editedWorkout, parser],
  );

  // Mode selector: Text (natural-language editor) / Visual (parsed
  // configurator) / Templates. Built on the Tabs primitive.
  const textInputSection = (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
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
        {/* Name + add, same as Text, so a workout can be built here alone. */}
        <Card className="space-y-5 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="visual-workout-name" className="text-ink-muted">
              Workout name
            </Label>
            <Input
              id="visual-workout-name"
              type="text"
              value={workoutName}
              onChange={(e) => handleWorkoutNameChange(e.target.value)}
              placeholder="Push day, pull day, legs"
            />
          </div>
          <ExerciseQuickAdd id="visual-exercise-search" label="Add an exercise" onAdd={handleVisualAdd} />
          <MachinePhotoAdd onAdd={handleMachineAdd} />
        </Card>

        {showConfiguration ? (
          configurationSection
        ) : (
          <div className="px-1">
            <p className="text-body font-semibold text-ink">No exercises yet</p>
            <p className="mt-1 text-body-sm text-ink-muted">
              Add one above, or write the workout in Text and it lands here to
              reorder, pair and tune.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => setActiveTab('text')}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Go to Text
            </Button>
          </div>
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

  // Regular build page for creating new workouts (or editing a planned workout)
  return (
    <>
      <BuildScreenLayout
        intro={planEditIntro}
        textInputSection={
          <>
            {textInputSection}
            {planEditActionsSection}
          </>
        }
        actionButtons={parseErrorsSection}
      />

      <PlanDateModal
        open={isPlanDateModalOpen}
        onOpenChange={setIsPlanDateModalOpen}
        title="Save for later"
        description="Pick a date to plan this workout."
        confirmLabel="Save plan"
        onConfirm={handleSaveForLater}
      />
      {/* Share Workout Modal */}
      {shareData && (
        <ShareWorkoutModal
          isOpen={showShareModal}
          onClose={handleCloseShareModal}
          workoutData={shareData}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}