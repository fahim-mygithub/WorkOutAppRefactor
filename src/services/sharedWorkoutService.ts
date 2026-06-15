import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  Timestamp,
  increment
} from 'firebase/firestore';
import { fromFirestore, toFirestore, timestampToISOString } from '../firestore/serde';
import { db } from '../firebase/config';
import { generateShareId, isValidShareId } from '../utils/shareIdGenerator';
import { ParsedWorkout } from '../parser/types';
import { WorkoutExercise } from '../types/exercise';

export interface SharedWorkout {
  id: string;
  shareId: string;
  creatorId: string;
  creatorName: string;
  workoutData: {
    name: string;
    description?: string;
    workoutText: string;
    parsedWorkout: ParsedWorkout;
    exercises: WorkoutExercise[];
  };
  metadata: {
    createdAt: string;
    viewCount: number;
    useCount: number;
    lastAccessed: string;
  };
  settings: {
    allowAnonymous: boolean;
  };
}

export interface CreateSharedWorkoutData {
  name: string;
  description?: string;
  workoutText: string;
  parsedWorkout: ParsedWorkout;
  exercises: WorkoutExercise[];
  allowAnonymous?: boolean;
}

export interface SharedWorkoutStats {
  shareId: string;
  viewCount: number;
  useCount: number;
  createdAt: Date;
  lastAccessed: Date;
}

export class SharedWorkoutService {
  private static readonly COLLECTION_NAME = 'sharedWorkouts';
  private static readonly MAX_RETRIES = 3;

  /**
   * Create a new shared workout
   */
  static async createSharedWorkout(
    creatorId: string,
    creatorName: string,
    workoutData: CreateSharedWorkoutData
  ): Promise<string> {
    if (!db) {
      throw new Error('Database not available. Please refresh the page and try again.');
    }

    let shareId: string;
    let retryCount = 0;

    // Try to find a unique share ID
    do {
      shareId = generateShareId();
      const existing = await this.getSharedWorkoutByShareId(shareId);

      if (!existing) {
        break;
      }

      retryCount++;
      if (retryCount >= this.MAX_RETRIES) {
        throw new Error('Unable to generate unique share ID. Please try again.');
      }
    } while (retryCount < this.MAX_RETRIES);

    const now = new Date();
    // Write-side shape uses Date for metadata timestamps; these are coerced to
    // Firestore Timestamps below. The SharedWorkout (read) type stores ISO strings.
    const sharedWorkout: Omit<SharedWorkout, 'id' | 'metadata'> & {
      metadata: {
        createdAt: Date;
        viewCount: number;
        useCount: number;
        lastAccessed: Date;
      };
    } = {
      shareId,
      creatorId,
      creatorName,
      workoutData: {
        name: workoutData.name.trim(),
        description: workoutData.description?.trim() || '',
        workoutText: workoutData.workoutText || '',
        parsedWorkout: workoutData.parsedWorkout || { exercises: [], supersets: [] },
        exercises: workoutData.exercises || []
      },
      metadata: {
        createdAt: now,
        viewCount: 0,
        useCount: 0,
        lastAccessed: now
      },
      settings: {
        allowAnonymous: workoutData.allowAnonymous ?? true
      }
    };

    const docRef = doc(collection(db, this.COLLECTION_NAME));

    // Clean the data to remove any undefined values before saving to Firestore
    const dataToSave = toFirestore({
      ...sharedWorkout,
      metadata: {
        ...sharedWorkout.metadata,
        createdAt: Timestamp.fromDate(sharedWorkout.metadata.createdAt),
        lastAccessed: Timestamp.fromDate(sharedWorkout.metadata.lastAccessed)
      },
      settings: sharedWorkout.settings
    });

    await setDoc(docRef, dataToSave);

    console.log('✅ Shared workout created successfully:', {
      shareId,
      docId: docRef.id,
      workoutName: workoutData.name
    });

    return shareId;
  }

  /**
   * Get shared workout by share ID
   */
  static async getSharedWorkoutByShareId(shareId: string): Promise<SharedWorkout | null> {
    console.log('🔍 SharedWorkoutService: Attempting to fetch shared workout:', {
      shareId,
      isValidShareId: isValidShareId(shareId),
      hasDatabase: !!db
    });

    if (!isValidShareId(shareId)) {
      console.error('❌ SharedWorkoutService: Invalid share ID format:', shareId);
      throw new Error('Invalid share ID format');
    }

    if (!db) {
      console.error('❌ SharedWorkoutService: Database not available');
      throw new Error('Database not available');
    }

    try {
      console.log('🔥 SharedWorkoutService: Querying Firestore for shareId:', shareId);
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('shareId', '==', shareId),
        firestoreLimit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn('⚠️ SharedWorkoutService: No shared workout found for shareId:', shareId);
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      console.log('✅ SharedWorkoutService: Found shared workout:', {
        id: doc.id,
        workoutName: data.workoutData?.name,
        creatorName: data.creatorName,
        viewCount: data.metadata?.viewCount,
        hasWorkoutText: !!data.workoutData?.workoutText,
        workoutTextLength: data.workoutData?.workoutText?.length || 0,
        exerciseCount: data.workoutData?.exercises?.length || 0
      });

      const sharedWorkout = {
        id: doc.id,
        shareId: data.shareId,
        creatorId: data.creatorId,
        creatorName: data.creatorName,
        workoutData: data.workoutData,
        metadata: {
          createdAt: timestampToISOString(data.metadata?.createdAt),
          viewCount: data.metadata?.viewCount || 0,
          useCount: data.metadata?.useCount || 0,
          lastAccessed: timestampToISOString(data.metadata?.lastAccessed)
        },
        settings: {
          allowAnonymous: data.settings?.allowAnonymous ?? true
        }
      };

      // Increment view count asynchronously (don't block the main flow)
      this.incrementViewCount(shareId).catch(error => {
        console.warn('Failed to increment view count:', error);
      });

      // Update the view count in the returned object
      sharedWorkout.metadata.viewCount += 1;

      return sharedWorkout;
    } catch (error) {
      console.error('💥 SharedWorkoutService: Error fetching shared workout:', {
        shareId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        fullError: error
      });
      throw error;
    }
  }

  /**
   * Increment view count for a shared workout
   */
  private static async incrementViewCount(shareId: string): Promise<void> {
    if (!db) return;

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('shareId', '==', shareId),
        firestoreLimit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          'metadata.viewCount': increment(1),
          'metadata.lastAccessed': Timestamp.fromDate(new Date())
        });
      }
    } catch (error) {
      console.warn('Failed to increment view count:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Increment use count when someone starts a shared workout
   */
  static async incrementUseCount(shareId: string): Promise<void> {
    if (!isValidShareId(shareId) || !db) return;

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('shareId', '==', shareId),
        firestoreLimit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          'metadata.useCount': increment(1),
          'metadata.lastAccessed': Timestamp.fromDate(new Date())
        });
      }
    } catch (error) {
      console.warn('Failed to increment use count:', error);
    }
  }

  /**
   * Get all shared workouts created by a user
   */
  static async getUserSharedWorkouts(userId: string): Promise<SharedWorkout[]> {
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('creatorId', '==', userId),
        orderBy('metadata.createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const workouts: SharedWorkout[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        workouts.push({
          id: doc.id,
          shareId: data.shareId,
          creatorId: data.creatorId,
          creatorName: data.creatorName,
          workoutData: data.workoutData,
          metadata: {
            createdAt: timestampToISOString(data.metadata?.createdAt),
            viewCount: data.metadata.viewCount,
            useCount: data.metadata.useCount,
            lastAccessed: timestampToISOString(data.metadata?.lastAccessed)
          },
          settings: {
            allowAnonymous: data.settings.allowAnonymous
          }
        });
      });

      return workouts;
    } catch (error) {
      console.error('Error fetching user shared workouts:', error);
      throw error;
    }
  }

  /**
   * Delete a shared workout
   */
  static async deleteSharedWorkout(shareId: string, userId: string): Promise<void> {
    if (!isValidShareId(shareId) || !db) {
      throw new Error('Invalid parameters');
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('shareId', '==', shareId),
        where('creatorId', '==', userId),
        firestoreLimit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Shared workout not found or not owned by user');
      }

      const docRef = querySnapshot.docs[0].ref;
      await deleteDoc(docRef);

      console.log('✅ Shared workout deleted successfully:', shareId);
    } catch (error) {
      console.error('Error deleting shared workout:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a shared workout
   */
  static async getSharedWorkoutStats(shareId: string): Promise<SharedWorkoutStats | null> {
    if (!isValidShareId(shareId) || !db) {
      return null;
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('shareId', '==', shareId),
        firestoreLimit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const data = querySnapshot.docs[0].data();

      return {
        shareId,
        viewCount: data.metadata.viewCount,
        useCount: data.metadata.useCount,
        createdAt: data.metadata.createdAt.toDate(),
        lastAccessed: data.metadata.lastAccessed.toDate()
      };
    } catch (error) {
      console.error('Error fetching shared workout stats:', error);
      return null;
    }
  }

  /**
   * Check if a shared workout exists and is valid
   */
  static async isSharedWorkoutValid(shareId: string): Promise<boolean> {
    try {
      const workout = await this.getSharedWorkoutByShareId(shareId);
      return !!workout;
    } catch {
      return false;
    }
  }

  /**
   * Update shared workout settings (for creator only)
   */
  static async updateSharedWorkoutSettings(
    shareId: string,
    userId: string,
    settings: Partial<SharedWorkout['settings']>
  ): Promise<void> {
    if (!isValidShareId(shareId) || !db) {
      throw new Error('Invalid parameters');
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('shareId', '==', shareId),
        where('creatorId', '==', userId),
        firestoreLimit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Shared workout not found or not owned by user');
      }

      const docRef = querySnapshot.docs[0].ref;
      const updateData: any = {};

      if (settings.allowAnonymous !== undefined) {
        updateData['settings.allowAnonymous'] = settings.allowAnonymous;
      }

      await updateDoc(docRef, updateData);

      console.log('✅ Shared workout settings updated:', shareId);
    } catch (error) {
      console.error('Error updating shared workout settings:', error);
      throw error;
    }
  }
}