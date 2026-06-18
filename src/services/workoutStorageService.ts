import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit as firestoreLimit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { isDemo } from '../demo/demo';

// Debug: Verify Firebase db is properly initialized
console.log('🔍 WorkoutStorageService Firebase db check:', {
  db,
  dbApp: db?.app,
  typeof: typeof db
});
import { ParsedWorkout } from '../parser/types';
import { CustomExercise } from './customExerciseService';
import { ActiveWorkout } from '../types/exercise';
import { ExerciseHistoryService } from './exerciseHistoryService';

export interface SavedWorkout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  workoutText: string;
  parsedWorkout: ParsedWorkout;
  customExercises: CustomExercise[];
  tags: string[];
  category?: 'Strength' | 'Cardio' | 'Flexibility' | 'Sports' | 'Other';
  isPublic: boolean;
  shareableId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastPerformedAt?: Date;
  performanceCount: number;
  estimatedDuration?: number; // in minutes
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface WorkoutSummary {
  totalExercises: number;
  totalSets: number;
  customExerciseCount: number;
  muscleGroups: string[];
  estimatedDuration: number;
}

export class WorkoutStorageService {
  private static readonly COLLECTION_NAME = 'savedWorkouts';

  // Serialize workout data for Firestore (flatten nested arrays)
  private static serializeWorkoutForFirestore(parsedWorkout: ParsedWorkout): any {
    return {
      exercises: parsedWorkout.exercises,
      // Convert nested supersets array to JSON string to avoid Firestore nested array limitation
      supersets_serialized: JSON.stringify(parsedWorkout.supersets),
      // Keep track of the original structure type for deserialization
      _dataFormat: 'serialized_v1'
    };
  }

  // Deserialize workout data from Firestore (restore nested arrays)
  private static deserializeWorkoutFromFirestore(serializedWorkout: any): ParsedWorkout {
    // Handle both old and new data formats
    if (serializedWorkout._dataFormat === 'serialized_v1') {
      return {
        exercises: serializedWorkout.exercises || [],
        supersets: serializedWorkout.supersets_serialized ?
          JSON.parse(serializedWorkout.supersets_serialized) : []
      };
    } else {
      // Legacy format - assume it's the original structure
      return {
        exercises: serializedWorkout.exercises || [],
        supersets: Array.isArray(serializedWorkout.supersets) ? serializedWorkout.supersets : []
      };
    }
  }

  // Save a workout to Firebase
  static async saveWorkout(
    userId: string,
    workoutData: {
      name: string;
      description?: string;
      workoutText: string;
      parsedWorkout: ParsedWorkout;
      customExercises: CustomExercise[];
      tags?: string[];
      category?: SavedWorkout['category'];
      difficulty?: SavedWorkout['difficulty'];
    }
  ): Promise<string> {
    if (isDemo(userId)) return 'demo-saved-workout';
    console.log('🎯 WorkoutStorageService.saveWorkout called with:', { userId, workoutName: workoutData.name });

    // Safety check: ensure Firebase db is available
    if (!db) {
      console.error('❌ Firebase db is not initialized!');
      throw new Error('Database not available. Please refresh the page and try again.');
    }

    console.log('✅ Firebase db is available, proceeding with save...');

    try {
      const summary = this.generateWorkoutSummary(workoutData.parsedWorkout, workoutData.customExercises);

      // Serialize the parsedWorkout to handle nested arrays
      const serializedParsedWorkout = this.serializeWorkoutForFirestore(workoutData.parsedWorkout);
      console.log('🔄 Serialized parsedWorkout for Firestore:', {
        original: workoutData.parsedWorkout,
        serialized: serializedParsedWorkout
      });

      const savedWorkout: Omit<SavedWorkout, 'id'> = {
        userId,
        name: workoutData.name.trim(),
        description: workoutData.description?.trim(),
        workoutText: workoutData.workoutText,
        parsedWorkout: serializedParsedWorkout, // Use serialized version
        customExercises: workoutData.customExercises,
        tags: workoutData.tags || [],
        category: workoutData.category || 'Strength',
        difficulty: workoutData.difficulty || 'Intermediate',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        performanceCount: 0,
        estimatedDuration: summary.estimatedDuration
      };

      const dataToSave = {
        ...savedWorkout,
        createdAt: Timestamp.fromDate(savedWorkout.createdAt),
        updatedAt: Timestamp.fromDate(savedWorkout.updatedAt),
        lastPerformedAt: savedWorkout.lastPerformedAt ? Timestamp.fromDate(savedWorkout.lastPerformedAt) : null
      };

      console.log('🔍 Data being saved to Firestore:', {
        userId,
        collectionPath: `users/${userId}/${this.COLLECTION_NAME}`,
        dataStructure: JSON.stringify(dataToSave, null, 2)
      });

      const docRef = await addDoc(
        collection(db, 'users', userId, this.COLLECTION_NAME),
        dataToSave
      );

      console.log('💾 Workout saved to Firebase:', { id: docRef.id, name: workoutData.name });
      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving workout:', error);
      console.error('❌ Full error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        name: error?.name,
        error
      });
      // Re-throw the original error to preserve the Firebase error message
      throw error;
    }
  }

  // Get all saved workouts for a user
  static async getUserWorkouts(
    userId: string,
    limitCount: number = 50
  ): Promise<SavedWorkout[]> {
    if (isDemo(userId)) return [];
    try {
      const q = query(
        collection(db, 'users', userId, this.COLLECTION_NAME),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const workouts: SavedWorkout[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        workouts.push({
          id: doc.id,
          ...data,
          // Deserialize the parsedWorkout to restore nested arrays
          parsedWorkout: this.deserializeWorkoutFromFirestore(data.parsedWorkout),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastPerformedAt: data.lastPerformedAt?.toDate(),
        } as SavedWorkout);
      });

      console.log('📚 Retrieved saved workouts:', workouts.length);
      return workouts;
    } catch (error) {
      console.error('❌ Error getting workouts:', error);
      return [];
    }
  }

  // Get a specific workout by ID
  static async getWorkoutById(userId: string, workoutId: string): Promise<SavedWorkout | null> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, workoutId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // Deserialize the parsedWorkout to restore nested arrays
          parsedWorkout: this.deserializeWorkoutFromFirestore(data.parsedWorkout),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastPerformedAt: data.lastPerformedAt?.toDate(),
        } as SavedWorkout;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting workout:', error);
      return null;
    }
  }

  // Update a saved workout
  static async updateWorkout(
    userId: string,
    workoutId: string,
    updates: Partial<Omit<SavedWorkout, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, workoutId);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      // Handle date fields
      if (updates.lastPerformedAt) {
        updateData.lastPerformedAt = Timestamp.fromDate(updates.lastPerformedAt);
      }

      await updateDoc(docRef, updateData);
      console.log('✏️ Updated workout:', workoutId);
    } catch (error) {
      console.error('❌ Error updating workout:', error);
      throw new Error('Failed to update workout');
    }
  }

  // Delete a saved workout
  static async deleteWorkout(userId: string, workoutId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, workoutId);
      await deleteDoc(docRef);
      console.log('🗑️ Deleted workout:', workoutId);
    } catch (error) {
      console.error('❌ Error deleting workout:', error);
      throw new Error('Failed to delete workout');
    }
  }

  // Mark workout as performed (increment performance count and update last performed date)
  static async markWorkoutPerformed(userId: string, workoutId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, workoutId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentCount = docSnap.data().performanceCount || 0;
        await updateDoc(docRef, {
          performanceCount: currentCount + 1,
          lastPerformedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        console.log('📈 Marked workout as performed:', workoutId);
      }
    } catch (error) {
      console.error('❌ Error marking workout as performed:', error);
    }
  }

  // Search workouts by name or tags
  static async searchWorkouts(
    userId: string,
    searchTerm: string,
    limitCount: number = 20
  ): Promise<SavedWorkout[]> {
    try {
      // Firestore doesn't support full-text search, so we'll do client-side filtering
      // In a production app, you'd want to use a search service like Algolia
      const allWorkouts = await this.getUserWorkouts(userId, 100);
      
      const term = searchTerm.toLowerCase();
      const filtered = allWorkouts
        .filter(workout => 
          workout.name.toLowerCase().includes(term) ||
          workout.description?.toLowerCase().includes(term) ||
          workout.tags.some(tag => tag.toLowerCase().includes(term)) ||
          workout.workoutText.toLowerCase().includes(term)
        )
        .slice(0, limitCount);

      console.log('🔍 Search results:', filtered.length);
      return filtered;
    } catch (error) {
      console.error('❌ Error searching workouts:', error);
      return [];
    }
  }

  // Get workouts by category
  static async getWorkoutsByCategory(
    userId: string,
    category: SavedWorkout['category'],
    limitCount: number = 20
  ): Promise<SavedWorkout[]> {
    try {
      const q = query(
        collection(db, 'users', userId, this.COLLECTION_NAME),
        where('category', '==', category),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const workouts: SavedWorkout[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        workouts.push({
          id: doc.id,
          ...data,
          // Deserialize the parsedWorkout to restore nested arrays
          parsedWorkout: this.deserializeWorkoutFromFirestore(data.parsedWorkout),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastPerformedAt: data.lastPerformedAt?.toDate(),
        } as SavedWorkout);
      });

      console.log(`📂 Retrieved ${category} workouts:`, workouts.length);
      return workouts;
    } catch (error) {
      console.error('❌ Error getting workouts by category:', error);
      return [];
    }
  }

  // Generate workout summary for analytics
  static generateWorkoutSummary(
    parsedWorkout: ParsedWorkout,
    customExercises: CustomExercise[]
  ): WorkoutSummary {
    const allExercises = [
      ...parsedWorkout.exercises,
      ...parsedWorkout.supersets.flat()
    ];

    const totalSets = allExercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    const muscleGroups = [...new Set(
      customExercises.map(ex => ex.muscleGroup)
    )];

    // Estimate duration: 2 minutes per set + 1 minute per exercise transition
    const estimatedDuration = Math.round((totalSets * 2) + (allExercises.length * 1));

    return {
      totalExercises: allExercises.length,
      totalSets,
      customExerciseCount: customExercises.length,
      muscleGroups,
      estimatedDuration: Math.max(estimatedDuration, 15) // Minimum 15 minutes
    };
  }

  // Duplicate a workout (useful for templates)
  static async duplicateWorkout(
    userId: string,
    workoutId: string,
    newName?: string
  ): Promise<string> {
    try {
      const originalWorkout = await this.getWorkoutById(userId, workoutId);
      
      if (!originalWorkout) {
        throw new Error('Workout not found');
      }

      const duplicatedWorkout = {
        name: newName || `${originalWorkout.name} (Copy)`,
        description: originalWorkout.description,
        workoutText: originalWorkout.workoutText,
        parsedWorkout: originalWorkout.parsedWorkout,
        customExercises: originalWorkout.customExercises,
        tags: originalWorkout.tags,
        category: originalWorkout.category,
        difficulty: originalWorkout.difficulty
      };

      const newWorkoutId = await this.saveWorkout(userId, duplicatedWorkout);
      console.log('📋 Duplicated workout:', { original: workoutId, new: newWorkoutId });
      
      return newWorkoutId;
    } catch (error) {
      console.error('❌ Error duplicating workout:', error);
      throw new Error('Failed to duplicate workout');
    }
  }

  // Get workout statistics for user dashboard
  static async getWorkoutStats(userId: string): Promise<{
    totalWorkouts: number;
    totalPerformances: number;
    mostUsedTags: string[];
    favoriteCategory: string;
    avgWorkoutDuration: number;
  }> {
    try {
      const workouts = await this.getUserWorkouts(userId, 100);
      
      const totalPerformances = workouts.reduce((sum, workout) => sum + workout.performanceCount, 0);
      
      const tagCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      let totalDuration = 0;

      workouts.forEach(workout => {
        workout.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
        
        if (workout.category) {
          categoryCounts[workout.category] = (categoryCounts[workout.category] || 0) + 1;
        }
        
        totalDuration += workout.estimatedDuration || 0;
      });

      const mostUsedTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);

      const favoriteCategory = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Strength';

      return {
        totalWorkouts: workouts.length,
        totalPerformances,
        mostUsedTags,
        favoriteCategory,
        avgWorkoutDuration: workouts.length > 0 ? Math.round(totalDuration / workouts.length) : 0
      };
    } catch (error) {
      console.error('❌ Error getting workout stats:', error);
      return {
        totalWorkouts: 0,
        totalPerformances: 0,
        mostUsedTags: [],
        favoriteCategory: 'Strength',
        avgWorkoutDuration: 0
      };
    }
  }

  // Save completed workout and exercise history
  static async saveCompletedWorkout(
    userId: string,
    activeWorkout: ActiveWorkout,
    templateId?: string
  ): Promise<string> {
    if (isDemo(userId)) return 'demo-completed-workout';
    try {
      const endTime = new Date();

      // Save individual exercise performances
      const exerciseHistoryPromises = activeWorkout.exercises.map(async (exercise) => {
        const completedSets = exercise.sets.filter(set => set.completed);

        if (completedSets.length > 0) {
          return ExerciseHistoryService.saveExercisePerformance(userId, {
            exerciseId: exercise.exercise.id,
            exerciseName: exercise.exercise.name,
            workoutId: activeWorkout.id,
            workoutName: activeWorkout.name,
            sets: completedSets.map((set, index) => ({
              setNumber: index + 1,
              targetReps: set.reps || 0,
              actualReps: set.reps || 0,
              weight: set.weight || 0,
              unit: set.unit || 'lbs',
              completed: set.completed || false,
              ...(set.rpe !== undefined && { rpe: set.rpe }),
              notes: set.notes || ''
            })),
            muscleGroups: exercise.exercise.muscleGroups || [],
            equipment: exercise.exercise.equipment || '',
            ...(exercise.notes && { notes: exercise.notes }),
            ...(exercise.customTitle && { customTitle: exercise.customTitle })
          });
        }
        return null;
      });

      await Promise.all(exerciseHistoryPromises);

      // Save workout summary
      const workoutSummaryId = await ExerciseHistoryService.saveWorkoutSummary(
        userId,
        activeWorkout,
        endTime
      );

      // Update saved workout template if it exists
      if (templateId) {
        await this.markWorkoutPerformed(userId, templateId);
      }

      console.log('✅ Completed workout saved successfully:', {
        workoutId: activeWorkout.id,
        summaryId: workoutSummaryId,
        exercises: activeWorkout.exercises.length
      });

      return workoutSummaryId;
    } catch (error) {
      console.error('❌ Error saving completed workout:', error);
      throw new Error('Failed to save completed workout');
    }
  }
}