/**
 * Documents in exactly the shape the app writes and reads, so the phone sees
 * agent-made data through its existing sync. Each builder names the app
 * function it mirrors; keep them in step when those change.
 *
 * Timestamps the app stores as Firestore Timestamps are `Date`s here (encoded
 * as timestampValue); ones it stores as ISO strings stay strings.
 */

// ---- App types (copied from src/parser/types.ts, src/types/exercise.ts, src/store/slices) ----

export type Unit = 'lbs' | 'kg';
export interface ParsedSet {
  reps: number | { min: number; max: number };
  weight?: number;
  unit?: Unit;
  rpe?: number;
  time?: number;
  distance?: number;
}
export interface ParsedExercise { name: string; sets: ParsedSet[]; notes?: string; restTime?: number }
export interface ParsedWorkout { exercises: ParsedExercise[]; supersets: ParsedExercise[][] }

export type Category = 'Strength' | 'Cardio' | 'Flexibility' | 'Sports' | 'Other';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface AppExercise {
  id: string;
  name: string;
  muscleGroup: string;
  muscleGroups: string[];
  equipment: string;
  videoLinks: string[];
  instructions: string[];
  difficulty: string;
  force: null;
  grips: null;
  mechanic: null;
  searchKeywords: string[];
  createdAt: string;
  updatedAt: string;
}
export interface AppWorkoutSet {
  id: string;
  reps: number;
  repMin?: number;
  repMax?: number;
  weight?: number;
  unit?: Unit;
  completed: boolean;
}
export interface AppWorkoutExercise {
  id: string;
  exercise: AppExercise;
  sets: AppWorkoutSet[];
  restTime?: number;
  notes?: string;
  isSuperset?: boolean;
  supersetId?: string;
  supersetIndex?: number;
  supersetExerciseIds?: string[];
}
export interface PlannedWorkout {
  id: string;
  dateKey: string;
  name: string;
  exercises: AppWorkoutExercise[];
  source?: { historyId?: string };
  status: 'planned' | 'done' | 'skipped';
  createdAt: string;
  updatedAt?: string;
}

// ---- Tool-level input (what a model sends) ----

export interface ExerciseInput {
  name: string;
  sets: number;
  reps: number;
  repsMax?: number;
  weight?: number;
  unit?: Unit;
  notes?: string;
  restSeconds?: number;
}
export interface WorkoutInput {
  name: string;
  description?: string;
  exercises: ExerciseInput[];
  supersets?: ExerciseInput[][];
  tags?: string[];
  category?: Category;
  difficulty?: Difficulty;
}

/** One line of workout text must stay one line. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function toParsedExercise(e: ExerciseInput): ParsedExercise {
  const reps: ParsedSet['reps'] =
    e.repsMax !== undefined && e.repsMax > e.reps ? { min: e.reps, max: e.repsMax } : e.reps;
  const set: ParsedSet = { reps };
  // WorkoutParser.createExerciseFromMatch: weight only when > 0, unit defaults to lbs.
  if (e.weight && e.weight > 0) {
    set.weight = e.weight;
    set.unit = e.unit ?? 'lbs';
  }
  const out: ParsedExercise = { name: oneLine(e.name), sets: Array.from({ length: e.sets }, () => ({ ...set })) };
  if (e.notes?.trim()) out.notes = e.notes.trim();
  if (e.restSeconds !== undefined) out.restTime = e.restSeconds;
  return out;
}

export function toParsedWorkout(input: Pick<WorkoutInput, 'exercises' | 'supersets'>): ParsedWorkout {
  return {
    exercises: input.exercises.map(toParsedExercise),
    supersets: (input.supersets ?? []).map((group) => group.map(toParsedExercise)),
  };
}

/** One exercise in the app parser's syntax: `3x8-12 Bench Press @135lbs`. */
function exerciseLine(e: ParsedExercise): string {
  const first = e.sets[0] ?? { reps: 10 };
  const reps = typeof first.reps === 'number' ? `${first.reps}` : `${first.reps.min}-${first.reps.max}`;
  const weight = first.weight ? ` @${first.weight}${first.unit ?? 'lbs'}` : '';
  return `${e.sets.length}x${reps} ${e.name}${weight}`;
}

/**
 * `workoutText` that the app's WorkoutParser turns back into the same
 * exercises (picking a saved workout re-parses this text). Supersets are one
 * line joined with ` ss `.
 */
export function formatWorkoutText(w: ParsedWorkout): string {
  return [...w.exercises.map(exerciseLine), ...w.supersets.map((g) => g.map(exerciseLine).join(' ss '))].join('\n');
}

/** WorkoutStorageService.generateWorkoutSummary().estimatedDuration */
export function estimateDuration(w: ParsedWorkout): number {
  const all = [...w.exercises, ...w.supersets.flat()];
  const totalSets = all.reduce((n, e) => n + e.sets.length, 0);
  return Math.max(Math.round(totalSets * 2 + all.length), 15);
}

/** WorkoutStorageService.serializeWorkoutForFirestore */
export function serializeParsedWorkout(w: ParsedWorkout) {
  return { exercises: w.exercises, supersets_serialized: JSON.stringify(w.supersets), _dataFormat: 'serialized_v1' };
}

/** WorkoutStorageService.deserializeWorkoutFromFirestore */
export function deserializeParsedWorkout(raw: unknown): ParsedWorkout {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawExercises = Array.isArray(r.exercises) ? (r.exercises as ParsedExercise[]) : [];
  let supersets: ParsedExercise[][] = [];
  if (r._dataFormat === 'serialized_v1') {
    try {
      supersets = typeof r.supersets_serialized === 'string' ? JSON.parse(r.supersets_serialized) : [];
    } catch {
      supersets = [];
    }
  } else if (Array.isArray(r.supersets)) {
    supersets = r.supersets as ParsedExercise[][];
  }

  // If supersets was empty, recover any superset groups embedded in exercises
  if (supersets.length === 0) {
    for (const ex of rawExercises) {
      const anyEx = ex as unknown as Record<string, unknown>;
      if (anyEx.isSuperset && Array.isArray(anyEx.supersetExercises) && anyEx.supersetExercises.length > 0) {
        supersets.push(anyEx.supersetExercises as ParsedExercise[]);
      }
    }
  }

  // Filter out any synthetic superset group entries from exercises:
  // 1. Objects marked isSuperset or with supersetExercises
  // 2. Objects whose name matches the combined superset name ("A + B")
  const supersetCombinedNames = new Set(supersets.map((group) => group.map((e) => e.name).join(' + ')));
  const exercises = rawExercises.filter((ex) => {
    const anyEx = ex as unknown as Record<string, unknown>;
    if (anyEx.isSuperset || Array.isArray(anyEx.supersetExercises)) return false;
    if (supersetCombinedNames.has(ex.name)) return false;
    return true;
  });

  return { exercises, supersets };
}

/** `users/{uid}/savedWorkouts/{id}` as WorkoutStorageService.saveWorkout writes it. */
export function buildSavedWorkoutDoc(uid: string, input: WorkoutInput, now: Date): Record<string, unknown> {
  const parsed = toParsedWorkout(input);
  return {
    userId: uid,
    name: input.name.trim(),
    description: input.description?.trim(),
    workoutText: formatWorkoutText(parsed),
    parsedWorkout: serializeParsedWorkout(parsed),
    customExercises: [],
    tags: input.tags ?? [],
    category: input.category ?? 'Strength',
    difficulty: input.difficulty ?? 'Intermediate',
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    performanceCount: 0,
    estimatedDuration: estimateDuration(parsed),
    lastPerformedAt: null,
  };
}

export type WorkoutPatch = Partial<WorkoutInput>;

/**
 * Field writes for updating a saved workout (WorkoutStorageService.updateWorkout
 * sets updatedAt). Changing exercises rewrites parsedWorkout, workoutText and
 * estimatedDuration together so they never disagree.
 */
export function buildWorkoutUpdate(
  patch: WorkoutPatch,
  current: ParsedWorkout,
  now: Date,
): { data: Record<string, unknown>; mask: string[] } {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description.trim();
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.difficulty !== undefined) data.difficulty = patch.difficulty;
  if (patch.exercises !== undefined || patch.supersets !== undefined) {
    const parsed: ParsedWorkout = {
      exercises: patch.exercises ? patch.exercises.map(toParsedExercise) : current.exercises,
      supersets: patch.supersets ? patch.supersets.map((g) => g.map(toParsedExercise)) : current.supersets,
    };
    data.parsedWorkout = serializeParsedWorkout(parsed);
    data.workoutText = formatWorkoutText(parsed);
    data.estimatedDuration = estimateDuration(parsed);
  }
  data.updatedAt = now;
  return { data, mask: Object.keys(data) };
}

export interface WorkoutView {
  id: string;
  name: string;
  description?: string;
  workoutText: string;
  exercises: ParsedExercise[];
  supersets: ParsedExercise[][];
  tags: string[];
  category?: string;
  difficulty?: string;
  estimatedDuration?: number;
  performanceCount: number;
  createdAt?: string;
  updatedAt?: string;
  lastPerformedAt?: string;
}

const str = (v: unknown): v is string => typeof v === 'string';

export function readSavedWorkout(id: string, d: Record<string, unknown>): WorkoutView {
  const parsed = deserializeParsedWorkout(d.parsedWorkout);
  return {
    id,
    name: String(d.name ?? ''),
    ...(str(d.description) && d.description ? { description: d.description } : {}),
    workoutText: String(d.workoutText ?? ''),
    exercises: parsed.exercises,
    supersets: parsed.supersets,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    ...(str(d.category) ? { category: d.category } : {}),
    ...(str(d.difficulty) ? { difficulty: d.difficulty } : {}),
    ...(typeof d.estimatedDuration === 'number' ? { estimatedDuration: d.estimatedDuration } : {}),
    performanceCount: typeof d.performanceCount === 'number' ? d.performanceCount : 0,
    ...(str(d.createdAt) ? { createdAt: d.createdAt } : {}),
    ...(str(d.updatedAt) ? { updatedAt: d.updatedAt } : {}),
    ...(str(d.lastPerformedAt) ? { lastPerformedAt: d.lastPerformedAt } : {}),
  };
}

// ---- Planned workouts: users/{uid}/schedule/plannedWorkouts ----

export const PLANS_SCHEMA_VERSION = 1;

/** workoutConversion.generateFallbackExerciseId — same name, same id as the app. */
export function fallbackExerciseId(name: string): string {
  let hash = 0;
  const n = name.trim().toLowerCase();
  for (let i = 0; i < n.length; i++) {
    hash = (hash << 5) - hash + n.charCodeAt(i);
    hash = hash & hash;
  }
  return `fallback-${Math.abs(hash).toString(36)}`;
}

/** workoutConversion.createFallbackExercise */
export function fallbackExercise(name: string, nowIso: string): AppExercise {
  return {
    id: fallbackExerciseId(name),
    name: name.trim(),
    muscleGroup: 'Unknown',
    muscleGroups: ['Unknown'],
    equipment: 'Unknown',
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: [name.trim().toLowerCase()],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function toWorkoutSets(e: ParsedExercise, prefix: string): AppWorkoutSet[] {
  return e.sets.map((s, i) => {
    const set: AppWorkoutSet = {
      id: `${prefix}-${i}`,
      reps: typeof s.reps === 'number' ? s.reps : s.reps.min,
      completed: false,
    };
    if (typeof s.reps !== 'number') {
      set.repMin = s.reps.min;
      set.repMax = s.reps.max;
    }
    if (s.weight !== undefined) set.weight = s.weight;
    if (s.unit !== undefined) set.unit = s.unit;
    return set;
  });
}

/** workoutConversion.convertSavedWorkoutToExercises (library matching aside: names become fallback exercises). */
export function toWorkoutExercises(w: ParsedWorkout, nowIso: string, stamp: string): AppWorkoutExercise[] {
  const out: AppWorkoutExercise[] = w.exercises.map((e, i) => ({
    id: `exercise-${stamp}-${i}`,
    exercise: fallbackExercise(e.name, nowIso),
    sets: toWorkoutSets(e, `set-${stamp}-${i}`),
    restTime: e.restTime || 120,
    ...(e.notes ? { notes: e.notes } : {}),
  }));
  w.supersets.forEach((group, si) => {
    const supersetId = `superset-${stamp}-${si}`;
    const members: AppWorkoutExercise[] = group.map((e, ei) => ({
      id: `exercise-superset-${stamp}-${si}-${ei}`,
      exercise: fallbackExercise(e.name, nowIso),
      sets: toWorkoutSets(e, `set-superset-${stamp}-${si}-${ei}`),
      restTime: e.restTime || 90,
      isSuperset: true,
      supersetId,
      supersetIndex: ei,
      notes: `Superset ${si + 1}${group.length > 1 ? ` (${ei + 1}/${group.length})` : ''}`,
    }));
    if (members.length > 0) members[0].supersetExerciseIds = members.map((m) => m.id);
    out.push(...members);
  });
  return out;
}

/** plannedWorkoutsSlice.planAdded's prepared payload. */
export function buildPlan(
  p: { id: string; dateKey: string; name: string; exercises: AppWorkoutExercise[]; createdAt?: string },
  nowIso: string,
): PlannedWorkout {
  return {
    id: p.id,
    dateKey: p.dateKey,
    name: p.name,
    exercises: p.exercises,
    status: 'planned',
    createdAt: p.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

/** Insert or replace one plan by id; every other plan is kept as it was. */
export function mergePlan(plans: PlannedWorkout[], plan: PlannedWorkout): PlannedWorkout[] {
  const i = plans.findIndex((p) => p.id === plan.id);
  if (i === -1) return [...plans, plan];
  const next = plans.slice();
  next[i] = plan;
  return next;
}

/** PlannedWorkoutsService.saveRemote payload. */
export function buildPlansDoc(plans: PlannedWorkout[], nowIso: string): Record<string, unknown> {
  return { plans, schemaVersion: PLANS_SCHEMA_VERSION, updatedAt: nowIso };
}

export function readPlans(d: Record<string, unknown> | null): PlannedWorkout[] {
  return d && Array.isArray(d.plans) ? (d.plans as PlannedWorkout[]) : [];
}

// ---- Custom exercises: users/{uid}/customExercises/{id} ----

export interface CustomExerciseInput {
  name: string;
  muscleGroups: string[];
  equipment: string;
  setupCues?: string[];
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  unit?: Unit;
  difficulty?: Difficulty;
  notes?: string;
}

/** "Default: 3 x 10 @ 50 lbs" — the app has no field for defaults, so they live in notes. */
function defaultsLine(e: CustomExerciseInput): string | undefined {
  if (e.defaultSets === undefined && e.defaultReps === undefined && e.defaultWeight === undefined) return undefined;
  const sets = e.defaultSets ?? 3;
  const reps = e.defaultReps ?? 10;
  const weight = e.defaultWeight ? ` @ ${e.defaultWeight} ${e.unit ?? 'lbs'}` : '';
  return `Default: ${sets} x ${reps}${weight}`;
}

/** CustomExerciseService.saveCustomExercise (originalName = name: nothing was typed into a parser). */
export function buildCustomExerciseDoc(uid: string, e: CustomExerciseInput, now: Date): Record<string, unknown> {
  const name = e.name.trim();
  const muscleGroup = e.muscleGroups.map((m) => m.trim()).filter(Boolean).join(', ');
  const equipment = e.equipment.trim();
  const notes = [e.notes?.trim(), defaultsLine(e)].filter(Boolean).join('\n');
  return {
    originalName: name,
    name,
    muscleGroup,
    equipment,
    difficulty: e.difficulty ?? 'Intermediate',
    instructions: e.setupCues ?? [],
    notes,
    videoLinks: [],
    userId: uid,
    isCustom: true,
    id: '',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: [
      name.toLowerCase(),
      name.toLowerCase(),
      muscleGroup.toLowerCase(),
      equipment.toLowerCase(),
      ...name.toLowerCase().split(' '),
    ].filter(Boolean),
    createdAt: now,
    updatedAt: now,
    usageCount: 1,
  };
}

// ---- Profile: users/{uid} ----

/** UserProfileService defaults, merged under the stored preferences like the app does. */
export const DEFAULT_PREFERENCES = {
  theme: 'system',
  unitSystem: 'imperial',
  weightUnit: 'lbs',
  defaultRestTime: 120,
  autoStartTimer: true,
  defaultProgressionRate: 'intermediate',
} as const;

/** Profile fields an agent may change. Never email, photo, stats or anything auth-related. */
export interface ProfilePatch {
  displayName?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    unitSystem?: 'metric' | 'imperial';
    weightUnit?: Unit;
    defaultRestTime?: number;
    autoStartTimer?: boolean;
    defaultProgressionRate?: 'beginner' | 'intermediate' | 'advanced';
  };
}

export function readProfile(d: Record<string, unknown> | null) {
  const prefs = (d?.preferences ?? {}) as Record<string, unknown>;
  return {
    exists: d !== null,
    displayName: str(d?.displayName) ? d.displayName : '',
    email: str(d?.email) ? d.email : '',
    preferences: { ...DEFAULT_PREFERENCES, ...prefs },
    stats: (d?.stats ?? {}) as Record<string, unknown>,
  };
}

/**
 * Field writes for UserProfileService.updateUserProfile / updateUserPreferences.
 * Nested preference paths (`preferences.weightUnit`) so untouched preferences survive.
 */
export function buildProfileUpdate(patch: ProfilePatch, now: Date): { data: Record<string, unknown>; mask: string[] } {
  const data: Record<string, unknown> = {};
  const mask: string[] = [];
  if (patch.displayName !== undefined) {
    data.displayName = patch.displayName.trim();
    mask.push('displayName');
  }
  const prefs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch.preferences ?? {})) {
    if (v === undefined) continue;
    prefs[k] = v;
    mask.push(`preferences.${k}`);
  }
  if (Object.keys(prefs).length) data.preferences = prefs;
  data.updatedAt = now;
  mask.push('updatedAt');
  return { data, mask };
}

// ---- History (read only) ----

export function readWorkoutSummary(id: string, d: Record<string, unknown>) {
  return {
    id,
    name: d.name,
    ...(d.workoutId ? { workoutId: d.workoutId } : {}),
    startTime: d.startTime,
    endTime: d.endTime,
    durationMinutes: d.duration,
    totalExercises: d.totalExercises,
    totalSets: d.totalSets,
    totalReps: d.totalReps,
    totalVolume: d.totalVolume,
    exercises: d.exercisesSummary ?? [],
    ...(d.notes ? { notes: d.notes } : {}),
  };
}

export function readExerciseHistory(id: string, d: Record<string, unknown>) {
  return {
    id,
    exerciseId: d.exerciseId,
    exerciseName: d.exerciseName,
    ...(d.customTitle ? { customTitle: d.customTitle } : {}),
    workoutDate: d.workoutDate,
    workoutName: d.workoutName,
    configuration: d.configuration,
    sets: d.sets ?? [],
    totalVolume: d.totalVolume,
    ...(d.personalRecords ? { personalRecords: d.personalRecords } : {}),
    ...(d.workoutId ? { workoutId: d.workoutId } : {}),
    ...(d.notes ? { notes: d.notes } : {}),
  };
}

// ---- Workout and Exercise History: users/{uid}/workout_history and users/{uid}/exercise_history ----

export interface PerformedSetInput {
  reps: number;
  weight?: number;
  unit?: Unit;
  rpe?: number;
  time?: number;
  rir?: number;
  completed?: boolean;
  notes?: string;
}

export interface ExerciseHistoryInput {
  id?: string;
  name: string;
  sets: PerformedSetInput[];
  notes?: string;
  customTitle?: string;
}

export interface LogWorkoutInput {
  date: string;
  name?: string;
  durationMinutes?: number;
  notes?: string;
  exercises: ExerciseHistoryInput[];
}

export interface StoredPerformedSet {
  setNumber: number;
  targetReps: number;
  actualReps: number;
  weight: number;
  unit: Unit;
  completed: boolean;
  rpe?: number;
  time?: number;
  rir?: number;
  notes?: string;
}

export interface PersonalRecordsMap {
  maxWeight?: boolean;
  maxReps?: boolean;
  maxVolume?: boolean;
}

/** ExerciseHistoryService.generateConfigurationString */
export function generateConfigurationString(sets: Array<{ targetReps?: number; actualReps: number }>): string {
  if (sets.length === 0) return '';
  const repGroups = sets.reduce((groups, set) => {
    const reps = set.targetReps ?? set.actualReps;
    groups[reps] = (groups[reps] ?? 0) + 1;
    return groups;
  }, {} as Record<number, number>);

  const entries = Object.entries(repGroups);
  if (entries.length === 1) {
    const [reps, count] = entries[0];
    return `${count}x${reps}`;
  }
  return entries.map(([reps, count]) => `${count}x${reps}`).join(', ');
}

/** ExerciseHistoryService.checkPersonalRecords */
export function checkPersonalRecords(
  currentStats: Record<string, unknown> | null,
  sets: StoredPerformedSet[],
  totalVolume: number,
): PersonalRecordsMap {
  const prs: PersonalRecordsMap = {};
  if (!sets.length) return prs;

  const maxWeightInSets = Math.max(...sets.map((s) => s.weight));
  const currentMaxWeight = typeof currentStats?.maxWeight === 'number' ? currentStats.maxWeight : 0;
  if (!currentStats || maxWeightInSets > currentMaxWeight) {
    prs.maxWeight = true;
  }

  const maxRepsInSets = Math.max(...sets.map((s) => s.actualReps));
  const currentMaxReps = typeof currentStats?.maxReps === 'number' ? currentStats.maxReps : 0;
  if (!currentStats || maxRepsInSets > currentMaxReps) {
    prs.maxReps = true;
  }

  const prObj = currentStats?.personalRecords as Record<string, unknown> | undefined;
  const maxVolObj = prObj?.maxVolume as Record<string, unknown> | undefined;
  const currentMaxVolume = typeof maxVolObj?.volume === 'number' ? maxVolObj.volume : 0;
  if (!currentStats || totalVolume > currentMaxVolume) {
    prs.maxVolume = true;
  }

  return prs;
}

/** ExerciseHistoryService.saveWorkoutSummary document shape */
export function buildWorkoutHistoryDoc(
  uid: string,
  workoutId: string,
  input: LogWorkoutInput,
  now: Date,
): Record<string, unknown> {
  const startDate = new Date(`${input.date}T12:00:00.000Z`);
  const duration = input.durationMinutes ?? 0;
  const endDate = duration > 0 ? new Date(startDate.getTime() + duration * 60000) : startDate;

  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  const exercisesSummary = input.exercises.map((e) => {
    const completedSets = e.sets.filter((s) => s.completed !== false);
    const sets = completedSets.length;
    const reps = completedSets.reduce((sum, s) => sum + s.reps, 0);
    const volume = completedSets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0);

    totalSets += sets;
    totalReps += reps;
    totalVolume += volume;

    return {
      exerciseId: fallbackExerciseId(e.name),
      exerciseName: e.name.trim(),
      sets,
      reps,
      volume,
    };
  });

  return {
    userId: uid,
    name: input.name?.trim() || 'Workout',
    workoutId,
    startTime: startDate,
    endTime: endDate,
    duration,
    totalExercises: exercisesSummary.length,
    totalSets,
    totalReps,
    totalVolume,
    exercisesSummary,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
}

/** ExerciseHistoryService.saveExercisePerformance document shape */
export function buildExerciseHistoryDoc(
  uid: string,
  workoutId: string,
  workoutName: string,
  workoutDate: Date,
  exercise: ExerciseHistoryInput,
  prs: PersonalRecordsMap,
  now: Date,
): Record<string, unknown> {
  const completedSets: StoredPerformedSet[] = exercise.sets
    .filter((s) => s.completed !== false)
    .map((s, idx) => ({
      setNumber: idx + 1,
      targetReps: s.reps,
      actualReps: s.reps,
      weight: s.weight ?? 0,
      unit: s.unit ?? 'lbs',
      completed: true,
      ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
      ...(s.time !== undefined ? { time: s.time } : {}),
      ...(s.rir !== undefined ? { rir: s.rir } : {}),
      ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
    }));

  const configuration = generateConfigurationString(completedSets);
  const totalVolume = completedSets.reduce((sum, s) => sum + s.weight * s.actualReps, 0);

  return {
    userId: uid,
    exerciseId: fallbackExerciseId(exercise.name),
    exerciseName: exercise.name.trim(),
    workoutDate,
    createdAt: now,
    sets: completedSets,
    configuration,
    muscleGroups: ['Unknown'],
    equipment: 'Unknown',
    totalVolume,
    personalRecords: prs,
    workoutId,
    workoutName: workoutName.trim(),
    ...(exercise.notes?.trim() ? { notes: exercise.notes.trim() } : {}),
    ...(exercise.customTitle?.trim() ? { customTitle: exercise.customTitle.trim() } : {}),
  };
}

export interface RawExerciseHistory {
  workoutDate: Date | string;
  sets: Array<{ actualReps: number; weight: number }>;
  totalVolume: number;
}

/** ExerciseHistoryService.updateExerciseStats full recomputation from history entries */
export function computeExerciseStats(
  exerciseId: string,
  exerciseName: string,
  histories: RawExerciseHistory[],
): Record<string, unknown> {
  if (histories.length === 0) return {};

  const toDateObj = (d: Date | string) => (d instanceof Date ? d : new Date(d));

  const sorted = histories.slice().sort((a, b) => {
    return toDateObj(a.workoutDate).getTime() - toDateObj(b.workoutDate).getTime();
  });

  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let maxWeight = 0;
  let maxReps = 0;

  let bestWeightSet = { weight: 0, reps: 0, date: toDateObj(sorted[0].workoutDate) };
  let bestRepsSet = { reps: 0, weight: 0, date: toDateObj(sorted[0].workoutDate) };
  let bestVolumeSession = { volume: 0, sets: 0, date: toDateObj(sorted[0].workoutDate) };

  for (const h of sorted) {
    const hDate = toDateObj(h.workoutDate);
    totalSets += h.sets.length;
    totalVolume += h.totalVolume;

    if (h.totalVolume >= bestVolumeSession.volume) {
      bestVolumeSession = { volume: h.totalVolume, sets: h.sets.length, date: hDate };
    }

    for (const s of h.sets) {
      totalReps += s.actualReps;
      if (s.weight >= maxWeight) {
        maxWeight = s.weight;
        bestWeightSet = { weight: s.weight, reps: s.actualReps, date: hDate };
      }
      if (s.actualReps >= maxReps) {
        maxReps = s.actualReps;
        bestRepsSet = { reps: s.actualReps, weight: s.weight, date: hDate };
      }
    }
  }

  const firstDate = toDateObj(sorted[0].workoutDate);
  const lastDate = toDateObj(sorted[sorted.length - 1].workoutDate);

  return {
    exerciseId,
    exerciseName,
    totalSessions: sorted.length,
    totalSets,
    totalReps,
    totalVolume,
    lastPerformed: lastDate,
    firstPerformed: firstDate,
    maxWeight,
    maxReps,
    avgWeight: totalReps > 0 ? Math.round(totalVolume / totalReps) : 0,
    avgReps: totalSets > 0 ? Math.round(totalReps / totalSets) : 0,
    frequency: 0,
    personalRecords: {
      maxWeight: {
        weight: bestWeightSet.weight,
        date: bestWeightSet.date,
        reps: bestWeightSet.reps,
      },
      maxReps: {
        reps: bestRepsSet.reps,
        date: bestRepsSet.date,
        weight: bestRepsSet.weight,
      },
      maxVolume: {
        volume: bestVolumeSession.volume,
        date: bestVolumeSession.date,
        sets: bestVolumeSession.sets,
      },
    },
  };
}

/** ExerciseHistoryService.updateExerciseStats incremental update */
export function updateExerciseStatsDoc(
  exerciseId: string,
  exerciseName: string,
  currentStats: Record<string, unknown> | null,
  completedSets: StoredPerformedSet[],
  totalVolume: number,
  prs: PersonalRecordsMap,
  workoutDate: Date,
): Record<string, unknown> {
  if (completedSets.length === 0) {
    return currentStats ?? {};
  }
  const maxWeight = Math.max(...completedSets.map((s) => s.weight));
  const maxReps = Math.max(...completedSets.map((s) => s.actualReps));
  const newReps = completedSets.reduce((sum, s) => sum + s.actualReps, 0);

  if (currentStats) {
    const prevSessions = typeof currentStats.totalSessions === 'number' ? currentStats.totalSessions : 0;
    const prevSets = typeof currentStats.totalSets === 'number' ? currentStats.totalSets : 0;
    const prevReps = typeof currentStats.totalReps === 'number' ? currentStats.totalReps : 0;
    const prevVolume = typeof currentStats.totalVolume === 'number' ? currentStats.totalVolume : 0;
    const prevMaxWeight = typeof currentStats.maxWeight === 'number' ? currentStats.maxWeight : 0;
    const prevMaxReps = typeof currentStats.maxReps === 'number' ? currentStats.maxReps : 0;

    const newTotalSessions = prevSessions + 1;
    const newTotalSets = prevSets + completedSets.length;
    const newTotalReps = prevReps + newReps;
    const newTotalVolume = prevVolume + totalVolume;

    const prevPRs = (currentStats.personalRecords ?? {}) as Record<string, unknown>;
    const prevMaxWeightPR = (prevPRs.maxWeight ?? {}) as Record<string, unknown>;
    const prevMaxRepsPR = (prevPRs.maxReps ?? {}) as Record<string, unknown>;
    const prevMaxVolPR = (prevPRs.maxVolume ?? {}) as Record<string, unknown>;

    const maxWeightSet = completedSets.find((s) => s.weight === maxWeight);
    const maxRepsSet = completedSets.find((s) => s.actualReps === maxReps);

    return {
      exerciseId,
      exerciseName,
      totalSessions: newTotalSessions,
      totalSets: newTotalSets,
      totalReps: newTotalReps,
      totalVolume: newTotalVolume,
      lastPerformed: workoutDate,
      firstPerformed: currentStats.firstPerformed ? new Date(currentStats.firstPerformed as string | Date) : workoutDate,
      maxWeight: Math.max(prevMaxWeight, maxWeight),
      maxReps: Math.max(prevMaxReps, maxReps),
      avgWeight: newTotalReps > 0 ? Math.round(newTotalVolume / newTotalReps) : 0,
      avgReps: newTotalSets > 0 ? Math.round(newTotalReps / newTotalSets) : 0,
      frequency: 0,
      personalRecords: {
        maxWeight: prs.maxWeight
          ? { weight: maxWeight, date: workoutDate, reps: maxWeightSet?.actualReps ?? 0 }
          : {
              weight: typeof prevMaxWeightPR.weight === 'number' ? prevMaxWeightPR.weight : prevMaxWeight,
              date: prevMaxWeightPR.date ? new Date(prevMaxWeightPR.date as string | Date) : workoutDate,
              reps: typeof prevMaxWeightPR.reps === 'number' ? prevMaxWeightPR.reps : 0,
            },
        maxReps: prs.maxReps
          ? { reps: maxReps, date: workoutDate, weight: maxRepsSet?.weight ?? 0 }
          : {
              reps: typeof prevMaxRepsPR.reps === 'number' ? prevMaxRepsPR.reps : prevMaxReps,
              date: prevMaxRepsPR.date ? new Date(prevMaxRepsPR.date as string | Date) : workoutDate,
              weight: typeof prevMaxRepsPR.weight === 'number' ? prevMaxRepsPR.weight : 0,
            },
        maxVolume: prs.maxVolume
          ? { volume: totalVolume, date: workoutDate, sets: completedSets.length }
          : {
              volume: typeof prevMaxVolPR.volume === 'number' ? prevMaxVolPR.volume : prevVolume,
              date: prevMaxVolPR.date ? new Date(prevMaxVolPR.date as string | Date) : workoutDate,
              sets: typeof prevMaxVolPR.sets === 'number' ? prevMaxVolPR.sets : 0,
            },
      },
    };
  }

  // Create new stats
  const maxWeightSet = completedSets.find((s) => s.weight === maxWeight);
  const maxRepsSet = completedSets.find((s) => s.actualReps === maxReps);

  return {
    exerciseId,
    exerciseName,
    totalSessions: 1,
    totalSets: completedSets.length,
    totalReps: newReps,
    totalVolume,
    lastPerformed: workoutDate,
    firstPerformed: workoutDate,
    maxWeight,
    maxReps,
    avgWeight: newReps > 0 ? Math.round(totalVolume / newReps) : 0,
    avgReps: completedSets.length > 0 ? Math.round(newReps / completedSets.length) : 0,
    frequency: 0,
    personalRecords: {
      maxWeight: { weight: maxWeight, date: workoutDate, reps: maxWeightSet?.actualReps ?? 0 },
      maxReps: { reps: maxReps, date: workoutDate, weight: maxRepsSet?.weight ?? 0 },
      maxVolume: { volume: totalVolume, date: workoutDate, sets: completedSets.length },
    },
  };
}

