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
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  ExerciseHistory,
  PerformedSet,
  ExerciseStats,
  WorkoutSummary,
  ExerciseHistoryFilter,
  ProgressMetrics
} from '../types/exerciseHistory';
import { WorkoutExercise, ActiveWorkout } from '../types/exercise';
import { serializeFirestoreData } from '../utils/firestoreHelpers';

export class ExerciseHistoryService {
  private static readonly EXERCISE_HISTORY_COLLECTION = 'exercise_history';
  private static readonly WORKOUT_HISTORY_COLLECTION = 'workout_history';
  private static readonly EXERCISE_STATS_COLLECTION = 'exercise_stats';

  // Save individual exercise performance after completing sets
  static async saveExercisePerformance(
    userId: string,
    exerciseData: {
      exerciseId: string;
      exerciseName: string;
      customTitle?: string;
      workoutId?: string;
      workoutName?: string;
      workoutDate?: string;
      sets: PerformedSet[];
      muscleGroups: string[];
      equipment: string;
      progressionData?: import('../types/progression').ProgressionTracking;
      daysSinceLastWorkout?: number;
      notes?: string;
    }
  ): Promise<string> {
    try {
      // Validate required fields
      if (!userId?.trim()) {
        throw new Error('User ID is required');
      }
      if (!exerciseData.exerciseId?.trim()) {
        throw new Error('Exercise ID is required');
      }
      if (!exerciseData.exerciseName?.trim()) {
        throw new Error('Exercise name is required');
      }
      if (!Array.isArray(exerciseData.sets) || exerciseData.sets.length === 0) {
        throw new Error('At least one set is required');
      }

      const { sets, ...exercise } = exerciseData;

      // Calculate configuration string (e.g., "5x5", "4x8-10")
      const configuration = this.generateConfigurationString(sets);

      // Calculate total volume
      const totalVolume = sets.reduce((total, set) =>
        total + (set.weight * set.actualReps), 0
      );

      // Check for personal records
      const personalRecords = await this.checkPersonalRecords(
        userId,
        exerciseData.exerciseId,
        sets,
        totalVolume
      );

      // Validate and clean muscle groups and equipment
      const muscleGroups = Array.isArray(exerciseData.muscleGroups)
        ? exerciseData.muscleGroups.filter(muscle => muscle && typeof muscle === 'string' && muscle.trim())
        : [];

      const equipment = exerciseData.equipment && typeof exerciseData.equipment === 'string'
        ? exerciseData.equipment.trim()
        : 'Unknown';

      // Filter out undefined values to prevent Firebase errors
      const cleanExerciseData = Object.fromEntries(
        Object.entries(exercise).filter(([_, value]) => value !== undefined)
      );

      // Use provided workout date or default to current date
      const workoutDate = exerciseData.workoutDate ? new Date(exerciseData.workoutDate) : new Date();

      const exerciseHistory: Omit<ExerciseHistory, 'id'> = {
        userId,
        exerciseId: exerciseData.exerciseId,
        exerciseName: exerciseData.exerciseName,
        workoutDate: workoutDate.toISOString(),
        sets: sets.filter(set => set.completed), // Only save completed sets
        configuration,
        muscleGroups: muscleGroups, // Use cleaned muscle groups
        equipment: equipment, // Use cleaned equipment
        totalVolume,
        personalRecords,
        // Only include optional fields if they have values
        ...(exerciseData.customTitle && { customTitle: exerciseData.customTitle }),
        ...(exerciseData.workoutId && { workoutId: exerciseData.workoutId }),
        ...(exerciseData.workoutName && { workoutName: exerciseData.workoutName }),
        ...(exerciseData.progressionData && { progressionData: exerciseData.progressionData }),
        ...(exerciseData.daysSinceLastWorkout && { daysSinceLastWorkout: exerciseData.daysSinceLastWorkout }),
        ...(exerciseData.notes && typeof exerciseData.notes === 'string' && exerciseData.notes.trim() && { notes: exerciseData.notes.trim() })
      };

      const docRef = await addDoc(
        collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION),
        {
          ...exerciseHistory,
          workoutDate: Timestamp.fromDate(workoutDate),
          createdAt: Timestamp.now()
        }
      );

      // Update exercise statistics
      await this.updateExerciseStats(userId, exerciseData.exerciseId, exerciseHistory);

      console.log('💪 Exercise performance saved:', {
        id: docRef.id,
        exercise: exerciseData.exerciseName,
        configuration
      });

      return docRef.id;
    } catch (error: any) {
      console.error('❌ Error saving exercise performance:', error);
      console.error('Exercise data:', exerciseData);
      console.error('User ID:', userId);

      // Provide more specific error messages
      if (error?.code === 'permission-denied') {
        throw new Error('Permission denied. Please check your authentication.');
      } else if (error?.code === 'unavailable') {
        throw new Error('Service temporarily unavailable. Please try again.');
      } else if (error?.message?.includes('network')) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error(`Failed to save exercise performance: ${error?.message || 'Unknown error'}`);
      }
    }
  }

  // Save complete workout summary
  static async saveWorkoutSummary(
    userId: string,
    activeWorkout: ActiveWorkout,
    endTime: Date
  ): Promise<string> {
    try {
      const startTime = new Date(activeWorkout.startTime);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes

      // Calculate totals
      let totalSets = 0;
      let totalReps = 0;
      let totalVolume = 0;

      const exercisesSummary = activeWorkout.exercises.map(exercise => {
        const completedSets = exercise.sets.filter(set => set.completed);
        const exerciseSets = completedSets.length;
        const exerciseReps = completedSets.reduce((sum, set) => sum + (set.reps || 0), 0);
        const exerciseVolume = completedSets.reduce((sum, set) =>
          sum + ((set.weight || 0) * (set.reps || 0)), 0
        );

        totalSets += exerciseSets;
        totalReps += exerciseReps;
        totalVolume += exerciseVolume;

        return {
          exerciseId: exercise.exercise.id,
          exerciseName: exercise.exercise.name,
          sets: exerciseSets,
          reps: exerciseReps,
          volume: exerciseVolume
        };
      });

      const workoutSummary: Omit<WorkoutSummary, 'id'> = {
        userId,
        name: activeWorkout.name,
        workoutId: activeWorkout.id, // Store original workout ID
        startTime,
        endTime,
        duration,
        totalExercises: activeWorkout.exercises.length,
        totalSets,
        totalReps,
        totalVolume,
        exercisesSummary
      };

      const docRef = await addDoc(
        collection(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION),
        {
          ...workoutSummary,
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime)
        }
      );

      console.log('🏋️ Workout summary saved:', {
        id: docRef.id,
        name: activeWorkout.name,
        duration: `${duration}min`
      });

      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving workout summary:', error);
      throw new Error('Failed to save workout summary');
    }
  }

  // Get all exercise history for a user (without filtering by specific exercise)
  static async getAllExerciseHistory(
    userId: string,
    limit: number = 100
  ): Promise<ExerciseHistory[]> {
    try {
      const q = collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION);
      const constraints = [
        orderBy('workoutDate', 'desc'),
        firestoreLimit(limit)
      ];

      const queryRef = query(q, ...constraints);
      const querySnapshot = await getDocs(queryRef);

      const history: ExerciseHistory[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          id: doc.id,
          ...data,
          workoutDate: data.workoutDate?.toDate().toISOString() || new Date().toISOString(),
        } as ExerciseHistory);
      });

      return history;
    } catch (error: any) {
      console.error('❌ Error getting all exercise history:', error);

      // If it's an index error, try a fallback query without orderBy
      // Check for various index-related error conditions
      const isIndexError = error?.code === 'failed-precondition' ||
                          (error?.message && (
                            error.message.includes('index') ||
                            error.message.includes('requires an index') ||
                            error.message.includes('composite index')
                          ));

      if (isIndexError) {
        console.warn('⚠️ Index not available, using fallback query for all exercises');
        try {
          return await this.getFallbackAllExerciseHistory(userId, limit);
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          return [];
        }
      }

      return [];
    }
  }

  // Get exercise history for a specific exercise
  static async getExerciseHistory(
    userId: string,
    filter: ExerciseHistoryFilter
  ): Promise<ExerciseHistory[]> {
    try {
      let q = collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION);
      const constraints: any[] = [];

      if (filter.exerciseId) {
        constraints.push(where('exerciseId', '==', filter.exerciseId));
      }
      if (filter.exerciseName) {
        constraints.push(where('exerciseName', '==', filter.exerciseName));
      }
      if (filter.configuration) {
        constraints.push(where('configuration', '==', filter.configuration));
      }

      constraints.push(orderBy('workoutDate', 'desc'));

      if (filter.limit) {
        constraints.push(firestoreLimit(filter.limit));
      }

      const queryRef = query(q, ...constraints);
      const querySnapshot = await getDocs(queryRef);

      const history: ExerciseHistory[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          id: doc.id,
          ...data,
          workoutDate: data.workoutDate?.toDate().toISOString() || new Date().toISOString(),
        } as ExerciseHistory);
      });

      return history;
    } catch (error: any) {
      console.error('❌ Error getting exercise history:', error);
      console.log('Error code:', error?.code);
      console.log('Error message:', error?.message);

      // If it's an index error, try a fallback query without orderBy
      // Check for various index-related error conditions
      const isIndexError = error?.code === 'failed-precondition' ||
                          (error?.message && (
                            error.message.includes('index') ||
                            error.message.includes('requires an index') ||
                            error.message.includes('composite index')
                          ));

      if (isIndexError) {
        console.warn('⚠️ Index not available, using fallback query without ordering');
        try {
          return await this.getFallbackExerciseHistory(userId, filter);
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          return [];
        }
      }

      return [];
    }
  }

  // Fallback method when index is not available
  private static async getFallbackExerciseHistory(
    userId: string,
    filter: ExerciseHistoryFilter
  ): Promise<ExerciseHistory[]> {
    const q = collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION);
    const constraints: any[] = [];

    // Only use WHERE clauses, no orderBy to avoid index requirement
    if (filter.exerciseId) {
      constraints.push(where('exerciseId', '==', filter.exerciseId));
    }
    if (filter.exerciseName) {
      constraints.push(where('exerciseName', '==', filter.exerciseName));
    }
    if (filter.configuration) {
      constraints.push(where('configuration', '==', filter.configuration));
    }

    const queryRef = query(q, ...constraints);
    const querySnapshot = await getDocs(queryRef);

    const history: ExerciseHistory[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const serializedData = serializeFirestoreData({
        id: doc.id,
        ...data,
        workoutDate: data.workoutDate?.toDate().toISOString() || new Date().toISOString(),
      });
      history.push(serializedData as ExerciseHistory);
    });

    // Sort manually by workoutDate descending (ISO strings sort correctly)
    history.sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));

    // Apply limit manually if specified
    if (filter.limit) {
      return history.slice(0, filter.limit);
    }

    return history;
  }

  // Fallback method for all exercise history when index is not available
  private static async getFallbackAllExerciseHistory(
    userId: string,
    limit: number
  ): Promise<ExerciseHistory[]> {
    const q = collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION);
    const queryRef = query(q);
    const querySnapshot = await getDocs(queryRef);

    const history: ExerciseHistory[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const serializedData = serializeFirestoreData({
        id: doc.id,
        ...data,
        workoutDate: data.workoutDate?.toDate().toISOString() || new Date().toISOString(),
      });
      history.push(serializedData as ExerciseHistory);
    });

    // Sort manually by workoutDate descending (ISO strings sort correctly)
    history.sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));

    // Apply limit manually
    return history.slice(0, limit);
  }

  // Get last performance for a specific exercise and configuration
  static async getLastPerformance(
    userId: string,
    exerciseId: string,
    configuration?: string
  ): Promise<ExerciseHistory | null> {
    try {
      const filter: ExerciseHistoryFilter = {
        exerciseId,
        limit: 1
      };

      if (configuration) {
        filter.configuration = configuration;
      }

      const history = await this.getExerciseHistory(userId, filter);
      return history.length > 0 ? history[0] : null;
    } catch (error) {
      console.error('❌ Error getting last performance:', error);
      return null;
    }
  }

  // Get exercise statistics
  static async getExerciseStats(
    userId: string,
    exerciseId: string
  ): Promise<ExerciseStats | null> {
    try {
      const docRef = doc(db, 'users', userId, this.EXERCISE_STATS_COLLECTION, exerciseId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const serializedData = serializeFirestoreData({
          ...data,
          lastPerformed: data.lastPerformed?.toDate().toISOString() || new Date().toISOString(),
          firstPerformed: data.firstPerformed?.toDate().toISOString() || new Date().toISOString(),
          personalRecords: {
            maxWeight: {
              ...data.personalRecords.maxWeight,
              date: data.personalRecords.maxWeight.date?.toDate().toISOString() || new Date().toISOString()
            },
            maxReps: {
              ...data.personalRecords.maxReps,
              date: data.personalRecords.maxReps.date?.toDate().toISOString() || new Date().toISOString()
            },
            maxVolume: {
              ...data.personalRecords.maxVolume,
              date: data.personalRecords.maxVolume.date?.toDate().toISOString() || new Date().toISOString()
            }
          }
        });
        return serializedData as ExerciseStats;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting exercise stats:', error);
      return null;
    }
  }

  // Get workout history
  static async getWorkoutHistory(
    userId: string,
    limit: number = 20
  ): Promise<WorkoutSummary[]> {
    try {
      const q = query(
        collection(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION),
        orderBy('endTime', 'desc'),
        firestoreLimit(limit)
      );

      const querySnapshot = await getDocs(q);
      const workouts: WorkoutSummary[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = serializeFirestoreData({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate().toISOString() || new Date().toISOString(),
          endTime: data.endTime?.toDate().toISOString() || new Date().toISOString(),
        });
        workouts.push(serializedData as WorkoutSummary);
      });

      return workouts;
    } catch (error) {
      console.error('❌ Error getting workout history:', error);
      return [];
    }
  }

  // Private helper methods

  private static generateConfigurationString(sets: PerformedSet[]): string {
    if (sets.length === 0) return '';

    // Group sets by target reps
    const repGroups = sets.reduce((groups, set) => {
      const reps = set.targetReps;
      if (!groups[reps]) groups[reps] = 0;
      groups[reps]++;
      return groups;
    }, {} as Record<number, number>);

    // Generate configuration string
    if (Object.keys(repGroups).length === 1) {
      const reps = Object.keys(repGroups)[0];
      return `${sets.length}x${reps}`;
    } else {
      // Multiple rep ranges
      const ranges = Object.entries(repGroups)
        .map(([reps, count]) => `${count}x${reps}`)
        .join(', ');
      return ranges;
    }
  }

  private static async checkPersonalRecords(
    userId: string,
    exerciseId: string,
    sets: PerformedSet[],
    totalVolume: number
  ): Promise<ExerciseHistory['personalRecords']> {
    try {
      const currentStats = await this.getExerciseStats(userId, exerciseId);
      const personalRecords: ExerciseHistory['personalRecords'] = {};

      // Check max weight
      const maxWeightInSets = Math.max(...sets.map(set => set.weight));
      if (!currentStats || maxWeightInSets > currentStats.maxWeight) {
        personalRecords.maxWeight = true;
      }

      // Check max reps at any weight
      const maxRepsInSets = Math.max(...sets.map(set => set.actualReps));
      if (!currentStats || maxRepsInSets > currentStats.maxReps) {
        personalRecords.maxReps = true;
      }

      // Check max volume
      if (!currentStats || totalVolume > currentStats.personalRecords.maxVolume.volume) {
        personalRecords.maxVolume = true;
      }

      return personalRecords;
    } catch (error) {
      console.error('❌ Error checking personal records:', error);
      return {};
    }
  }

  private static async updateExerciseStats(
    userId: string,
    exerciseId: string,
    exerciseHistory: Omit<ExerciseHistory, 'id'>
  ): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.EXERCISE_STATS_COLLECTION, exerciseId);
      const docSnap = await getDoc(docRef);

      const maxWeight = Math.max(...exerciseHistory.sets.map(set => set.weight));
      const maxReps = Math.max(...exerciseHistory.sets.map(set => set.actualReps));

      if (docSnap.exists()) {
        // Update existing stats
        const currentStats = docSnap.data() as ExerciseStats;
        const newTotalSessions = currentStats.totalSessions + 1;
        const newTotalSets = currentStats.totalSets + exerciseHistory.sets.length;
        const newTotalReps = currentStats.totalReps + exerciseHistory.sets.reduce((sum, set) => sum + set.actualReps, 0);
        const newTotalVolume = currentStats.totalVolume + exerciseHistory.totalVolume;

        const updateData: Partial<ExerciseStats> = {
          totalSessions: newTotalSessions,
          totalSets: newTotalSets,
          totalReps: newTotalReps,
          totalVolume: newTotalVolume,
          lastPerformed: exerciseHistory.workoutDate,
          maxWeight: Math.max(currentStats.maxWeight, maxWeight),
          maxReps: Math.max(currentStats.maxReps, maxReps),
          avgWeight: Math.round(newTotalVolume / newTotalReps),
          avgReps: Math.round(newTotalReps / newTotalSets)
        };

        // Update personal records if new ones were set
        if (exerciseHistory.personalRecords?.maxWeight) {
          updateData.personalRecords = {
            ...currentStats.personalRecords,
            maxWeight: {
              weight: maxWeight,
              date: exerciseHistory.workoutDate,
              reps: exerciseHistory.sets.find(set => set.weight === maxWeight)?.actualReps || 0
            }
          };
        }

        if (exerciseHistory.personalRecords?.maxReps) {
          updateData.personalRecords = {
            ...updateData.personalRecords || currentStats.personalRecords,
            maxReps: {
              reps: maxReps,
              date: exerciseHistory.workoutDate,
              weight: exerciseHistory.sets.find(set => set.actualReps === maxReps)?.weight || 0
            }
          };
        }

        if (exerciseHistory.personalRecords?.maxVolume) {
          updateData.personalRecords = {
            ...updateData.personalRecords || currentStats.personalRecords,
            maxVolume: {
              volume: exerciseHistory.totalVolume,
              date: exerciseHistory.workoutDate,
              sets: exerciseHistory.sets.length
            }
          };
        }

        await updateDoc(docRef, {
          ...updateData,
          lastPerformed: Timestamp.fromDate(new Date(exerciseHistory.workoutDate)),
          ...(updateData.personalRecords && {
            personalRecords: {
              ...updateData.personalRecords,
              maxWeight: {
                ...updateData.personalRecords.maxWeight,
                date: Timestamp.fromDate(new Date(updateData.personalRecords.maxWeight.date))
              },
              maxReps: {
                ...updateData.personalRecords.maxReps,
                date: Timestamp.fromDate(new Date(updateData.personalRecords.maxReps.date))
              },
              maxVolume: {
                ...updateData.personalRecords.maxVolume,
                date: Timestamp.fromDate(new Date(updateData.personalRecords.maxVolume.date))
              }
            }
          })
        });
      } else {
        // Create new stats
        const totalReps = exerciseHistory.sets.reduce((sum, set) => sum + set.actualReps, 0);
        const newStats: Omit<ExerciseStats, 'exerciseId'> = {
          exerciseName: exerciseHistory.exerciseName,
          totalSessions: 1,
          totalSets: exerciseHistory.sets.length,
          totalReps,
          totalVolume: exerciseHistory.totalVolume,
          lastPerformed: exerciseHistory.workoutDate,
          firstPerformed: exerciseHistory.workoutDate,
          maxWeight,
          maxReps,
          avgWeight: Math.round(exerciseHistory.totalVolume / totalReps),
          avgReps: Math.round(totalReps / exerciseHistory.sets.length),
          frequency: 0, // Will be calculated separately
          personalRecords: {
            maxWeight: {
              weight: maxWeight,
              date: exerciseHistory.workoutDate,
              reps: exerciseHistory.sets.find(set => set.weight === maxWeight)?.actualReps || 0
            },
            maxReps: {
              reps: maxReps,
              date: exerciseHistory.workoutDate,
              weight: exerciseHistory.sets.find(set => set.actualReps === maxReps)?.weight || 0
            },
            maxVolume: {
              volume: exerciseHistory.totalVolume,
              date: exerciseHistory.workoutDate,
              sets: exerciseHistory.sets.length
            }
          }
        };

        await updateDoc(docRef, {
          exerciseId,
          ...newStats,
          lastPerformed: Timestamp.fromDate(new Date(newStats.lastPerformed)),
          firstPerformed: Timestamp.fromDate(new Date(newStats.firstPerformed)),
          personalRecords: {
            maxWeight: {
              ...newStats.personalRecords.maxWeight,
              date: Timestamp.fromDate(new Date(newStats.personalRecords.maxWeight.date))
            },
            maxReps: {
              ...newStats.personalRecords.maxReps,
              date: Timestamp.fromDate(new Date(newStats.personalRecords.maxReps.date))
            },
            maxVolume: {
              ...newStats.personalRecords.maxVolume,
              date: Timestamp.fromDate(new Date(newStats.personalRecords.maxVolume.date))
            }
          }
        });
      }
    } catch (error) {
      console.error('❌ Error updating exercise stats:', error);
    }
  }

  // Delete an exercise history entry
  static async deleteExerciseHistory(userId: string, exerciseHistoryId: string): Promise<void> {
    try {
      const exerciseHistoryRef = doc(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION, exerciseHistoryId);
      await deleteDoc(exerciseHistoryRef);
      console.log('✅ Exercise history entry deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting exercise history:', error);
      throw error;
    }
  }

  // Update an existing exercise history entry
  static async updateExerciseHistory(
    userId: string,
    exerciseHistoryId: string,
    updateData: Partial<{
      exerciseName: string;
      sets: PerformedSet[];
      muscleGroups: string[];
      equipment: string;
      notes: string;
      workoutName: string;
      workoutDate: string;
    }>
  ): Promise<void> {
    try {
      const exerciseHistoryRef = doc(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION, exerciseHistoryId);

      // Prepare update data
      const updateFields: any = {};

      if (updateData.exerciseName) {
        updateFields.exerciseName = updateData.exerciseName;
      }

      if (updateData.sets) {
        // Recalculate derived fields when sets change
        const configuration = this.generateConfigurationString(updateData.sets);
        const totalVolume = updateData.sets.reduce((total, set) => total + (set.weight * set.actualReps), 0);

        updateFields.sets = updateData.sets;
        updateFields.configuration = configuration;
        updateFields.totalVolume = totalVolume;
      }

      if (updateData.muscleGroups) {
        updateFields.muscleGroups = updateData.muscleGroups;
      }

      if (updateData.equipment) {
        updateFields.equipment = updateData.equipment;
      }

      if (updateData.notes !== undefined) {
        updateFields.notes = updateData.notes;
      }

      if (updateData.workoutName) {
        updateFields.workoutName = updateData.workoutName;
      }

      if (updateData.workoutDate) {
        updateFields.workoutDate = Timestamp.fromDate(new Date(updateData.workoutDate));
      }

      updateFields.updatedAt = Timestamp.now();

      await updateDoc(exerciseHistoryRef, updateFields);
      console.log('✅ Exercise history updated successfully');
    } catch (error) {
      console.error('❌ Error updating exercise history:', error);
      throw error;
    }
  }

  // Delete a completed workout history entry
  static async deleteWorkoutHistory(userId: string, workoutId: string): Promise<void> {
    try {
      const workoutHistoryRef = doc(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION, workoutId);
      await deleteDoc(workoutHistoryRef);
      console.log('✅ Workout history entry deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting workout history:', error);
      throw error;
    }
  }

  // Update a completed workout history entry
  static async updateWorkoutHistory(
    userId: string,
    workoutId: string,
    updateData: Partial<{
      name: string;
      startTime: string;
      endTime: string;
      duration: number;
      notes: string;
    }>
  ): Promise<void> {
    try {
      const workoutHistoryRef = doc(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION, workoutId);

      // Prepare update data
      const updateFields: any = {};

      if (updateData.name) {
        updateFields.name = updateData.name;
      }

      if (updateData.startTime) {
        updateFields.startTime = Timestamp.fromDate(new Date(updateData.startTime));
      }

      if (updateData.endTime) {
        updateFields.endTime = Timestamp.fromDate(new Date(updateData.endTime));
      }

      if (updateData.duration !== undefined) {
        updateFields.duration = updateData.duration;
      }

      if (updateData.notes !== undefined) {
        updateFields.notes = updateData.notes;
      }

      updateFields.updatedAt = Timestamp.now();

      await updateDoc(workoutHistoryRef, updateFields);
      console.log('✅ Workout history updated successfully');
    } catch (error) {
      console.error('❌ Error updating workout history:', error);
      throw error;
    }
  }

  // Delete multiple workout history entries
  static async deleteMultipleWorkouts(userId: string, workoutIds: string[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      workoutIds.forEach((workoutId) => {
        const workoutRef = doc(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION, workoutId);
        batch.delete(workoutRef);
      });

      await batch.commit();
      console.log(`✅ ${workoutIds.length} workout history entries deleted successfully`);
    } catch (error) {
      console.error('❌ Error deleting multiple workout histories:', error);
      throw error;
    }
  }

  // Clear all workout history for a user
  static async clearAllWorkoutHistory(userId: string): Promise<void> {
    try {
      const workoutHistoryQuery = query(
        collection(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION)
      );
      const querySnapshot = await getDocs(workoutHistoryQuery);

      const batch = writeBatch(db);
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ All workout history cleared (${querySnapshot.docs.length} entries deleted)`);
    } catch (error) {
      console.error('❌ Error clearing all workout history:', error);
      throw error;
    }
  }

  // Clear workout history within a date range
  static async clearWorkoutHistoryByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      const workoutHistoryQuery = query(
        collection(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION),
        where('endTime', '>=', Timestamp.fromDate(startDate)),
        where('endTime', '<=', Timestamp.fromDate(endDate))
      );
      const querySnapshot = await getDocs(workoutHistoryQuery);

      const batch = writeBatch(db);
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Workout history cleared for date range (${querySnapshot.docs.length} entries deleted)`);
    } catch (error) {
      console.error('❌ Error clearing workout history by date range:', error);
      throw error;
    }
  }

  // Get all exercise history entries for a specific workout
  static async getExerciseHistoryByWorkoutId(
    userId: string,
    workoutId: string
  ): Promise<ExerciseHistory[]> {
    try {
      const q = query(
        collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION),
        where('workoutId', '==', workoutId),
        orderBy('workoutDate', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const exercises: ExerciseHistory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const serializedData = serializeFirestoreData({
          id: doc.id,
          ...data,
          workoutDate: data.workoutDate?.toDate().toISOString() || new Date().toISOString(),
        });
        exercises.push(serializedData as ExerciseHistory);
      });

      console.log(`📊 Retrieved ${exercises.length} exercises for workout ${workoutId}`);
      return exercises;
    } catch (error: any) {
      console.error('❌ Error getting exercise history by workout ID:', error);

      // Handle index errors with fallback query
      const isIndexError = error?.code === 'failed-precondition' ||
                          (error?.message && (
                            error.message.includes('index') ||
                            error.message.includes('requires an index') ||
                            error.message.includes('composite index')
                          ));

      if (isIndexError) {
        console.warn('⚠️ Index not available, using fallback query');
        try {
          const q = query(
            collection(db, 'users', userId, this.EXERCISE_HISTORY_COLLECTION),
            where('workoutId', '==', workoutId)
          );

          const querySnapshot = await getDocs(q);
          const exercises: ExerciseHistory[] = [];

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const serializedData = serializeFirestoreData({
              id: doc.id,
              ...data,
              workoutDate: data.workoutDate?.toDate().toISOString() || new Date().toISOString(),
            });
            exercises.push(serializedData as ExerciseHistory);
          });

          // Sort manually
          exercises.sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));

          console.log(`📊 Retrieved ${exercises.length} exercises for workout ${workoutId} (fallback)`);
          return exercises;
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          return [];
        }
      }

      return [];
    }
  }

  // Get a specific workout summary by ID
  static async getWorkoutSummaryById(
    userId: string,
    workoutId: string
  ): Promise<WorkoutSummary | null> {
    try {
      const docRef = doc(db, 'users', userId, this.WORKOUT_HISTORY_COLLECTION, workoutId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const serializedData = serializeFirestoreData({
          id: docSnap.id,
          ...data,
          startTime: data.startTime?.toDate().toISOString() || new Date().toISOString(),
          endTime: data.endTime?.toDate().toISOString() || new Date().toISOString(),
        });
        return serializedData as WorkoutSummary;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting workout summary by ID:', error);
      return null;
    }
  }
}