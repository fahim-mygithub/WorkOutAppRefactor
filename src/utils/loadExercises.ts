import { Exercise } from '../types/exercise';

/**
 * Loads the consolidated exercise database from the build-time generated
 * `public/exercises.json` (produced by `scripts/build-exercises.mjs`).
 *
 * The JSON already IS the exact `Exercise[]` shape, so there is no transform and
 * no papaparse in the client path. On failure we return an empty array to
 * preserve the previous fallback behavior of `loadExercisesFromCSV`.
 */
export const loadExercises = async (): Promise<Exercise[]> => {
  try {
    // Base-relative so it resolves under the deploy base (e.g. the GitHub Pages
    // /WorkOutAppRefactor/ project path); BASE_URL is '/' for a root deploy.
    const response = await fetch(`${import.meta.env.BASE_URL}exercises.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch exercises.json: ${response.status}`);
    }
    return (await response.json()) as Exercise[];
  } catch (error) {
    console.error('Failed to load exercises:', error);
    return [];
  }
};
