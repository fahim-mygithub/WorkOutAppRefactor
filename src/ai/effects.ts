/**
 * Applying a confirmed AI plan, and taking it back.
 *
 * A confirm plan carries store actions (`apply`, with `undo` when it can be
 * taken back) and, for the build / plan / profile tools, `effects`: saves
 * outside the store (saved workouts, custom exercises, the profile document).
 * Effects are plain data so a late Apply can compare them with what the card
 * showed; running one returns its inverse, which is what Undo runs.
 */
import type { ParsedWorkout } from '../parser/types';
import type { SaveCustomExerciseData } from '../services/customExerciseService';
import type { AppDispatch, RootState } from '../store';
import { deleteCustomExercise, saveCustomExercise } from '../store/slices/customExerciseSlice';
import { setPreferences, updateProfile, type UserPreferences } from '../store/slices/userSlice';
import type { ToolPlan } from './applyTool';

/** A saved workout's editable content. */
export interface SavedWorkoutDraft {
  name: string;
  workoutText: string;
  parsedWorkout: ParsedWorkout;
}

/** Display and training fields only; never account data. */
export interface ProfileChanges {
  displayName?: string;
  preferences?: Partial<UserPreferences>;
}

export type AiEffect =
  | { type: 'createSavedWorkout'; workout: SavedWorkoutDraft }
  | { type: 'updateSavedWorkout'; id: string; workout: SavedWorkoutDraft; prior: SavedWorkoutDraft }
  | { type: 'deleteSavedWorkout'; id: string }
  | { type: 'addCustomExercise'; exercise: SaveCustomExerciseData }
  | { type: 'removeCustomExercise'; id: string }
  | { type: 'updateProfile'; changes: ProfileChanges };

/** The app's save paths, injected so tests run without Firestore. */
export interface EffectServices {
  /** Saves a new workout to the lifter's saved workouts; resolves with its id. */
  saveWorkout: (userId: string, workout: SavedWorkoutDraft) => Promise<string>;
  updateWorkout: (userId: string, id: string, workout: SavedWorkoutDraft) => Promise<void>;
  deleteWorkout: (userId: string, id: string) => Promise<void>;
  /** Writes the display name and/or the WHOLE preferences object. */
  saveProfile: (userId: string, changes: { displayName?: string; preferences?: UserPreferences }) => Promise<void>;
}

export interface EffectDeps {
  userId: string | null;
  dispatch: AppDispatch;
  getState: () => RootState;
  services: EffectServices;
}

function setProfileLocally(dispatch: AppDispatch, changes: ProfileChanges): void {
  if (changes.displayName !== undefined) dispatch(updateProfile({ displayName: changes.displayName }));
  if (changes.preferences) dispatch(setPreferences(changes.preferences));
}

/** Runs one effect; resolves with the effect that takes it back (none for deletes). */
async function runEffect(effect: AiEffect, deps: EffectDeps, userId: string): Promise<AiEffect | null> {
  const { dispatch, services } = deps;
  switch (effect.type) {
    case 'createSavedWorkout':
      return { type: 'deleteSavedWorkout', id: await services.saveWorkout(userId, effect.workout) };
    case 'updateSavedWorkout':
      await services.updateWorkout(userId, effect.id, effect.workout);
      return { type: 'updateSavedWorkout', id: effect.id, workout: effect.prior, prior: effect.workout };
    case 'deleteSavedWorkout':
      await services.deleteWorkout(userId, effect.id);
      return null;
    case 'addCustomExercise': {
      const saved = await dispatch(saveCustomExercise({ userId, exerciseData: effect.exercise })).unwrap();
      return saved.id ? { type: 'removeCustomExercise', id: saved.id } : null;
    }
    case 'removeCustomExercise':
      await dispatch(deleteCustomExercise({ userId, exerciseId: effect.id })).unwrap();
      return null;
    case 'updateProfile': {
      const before = deps.getState().user;
      const prior: ProfileChanges = {};
      if (effect.changes.displayName !== undefined) prior.displayName = before.profile?.displayName ?? '';
      if (effect.changes.preferences) {
        const keys = Object.keys(effect.changes.preferences) as (keyof UserPreferences)[];
        prior.preferences = Object.fromEntries(keys.map((k) => [k, before.preferences[k]]));
      }
      // The store first (the app reads it), then the profile document; a
      // failed write puts the store back.
      setProfileLocally(dispatch, effect.changes);
      try {
        await services.saveProfile(userId, {
          ...(effect.changes.displayName !== undefined ? { displayName: effect.changes.displayName } : {}),
          ...(effect.changes.preferences ? { preferences: deps.getState().user.preferences } : {}),
        });
      } catch (err) {
        setProfileLocally(dispatch, prior);
        throw err;
      }
      return { type: 'updateProfile', changes: prior };
    }
  }
}

/**
 * Runs effects in order; resolves with their inverses, latest first. When one
 * fails, those already done are taken back (best effort) and the error rethrown.
 */
export async function runEffects(effects: readonly AiEffect[], deps: EffectDeps): Promise<AiEffect[]> {
  if (effects.length === 0) return [];
  const userId = deps.userId;
  if (!userId) throw new Error('Sign in to save.');
  const inverses: AiEffect[] = [];
  try {
    for (const effect of effects) {
      const inverse = await runEffect(effect, deps, userId);
      if (inverse) inverses.unshift(inverse);
    }
  } catch (err) {
    await runEffects(inverses, deps).catch(() => undefined);
    throw err;
  }
  return inverses;
}

/**
 * Applies a confirmed plan: its actions, then its effects. Resolves with an
 * Undo for plans that support one (the build / plan / profile tools), else
 * undefined. Rejects, with the store put back, when a save fails.
 */
export async function applyPlan(plan: ToolPlan, deps: EffectDeps): Promise<(() => Promise<void>) | undefined> {
  if (plan.kind !== 'confirm') return undefined;
  const effects = plan.effects ?? [];
  if (effects.length && !deps.userId) throw new Error('Sign in to save.');
  plan.apply.forEach((a) => deps.dispatch(a));
  let inverses: AiEffect[];
  try {
    inverses = await runEffects(effects, deps);
  } catch (err) {
    plan.undo?.forEach((a) => deps.dispatch(a));
    throw err;
  }
  if (!plan.undo && effects.length === 0) return undefined;
  return async () => {
    plan.undo?.forEach((a) => deps.dispatch(a));
    await runEffects(inverses, deps);
  };
}
