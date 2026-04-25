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
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Exercise } from '../types/exercise';

export interface CustomExercise extends Omit<Exercise, 'id'> {
  id?: string;
  userId: string;
  isCustom: true;
  originalName: string; // What the user originally typed
  createdAt: Date;
  updatedAt: Date;
  usageCount: number; // Track how often it's used
  notes?: string; // Additional notes about the exercise
}

export interface SaveCustomExerciseData {
  originalName: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  instructions?: string[];
  notes?: string;
  videoLinks?: string[];
}

export class CustomExerciseService {
  private static readonly COLLECTION_NAME = 'customExercises';

  // Save a custom exercise for a user
  static async saveCustomExercise(
    userId: string, 
    exerciseData: SaveCustomExerciseData
  ): Promise<string> {
    try {
      const customExercise: Omit<CustomExercise, 'id'> = {
        ...exerciseData,
        userId,
        isCustom: true,
        id: '', // Will be set by Firestore
        videoLinks: exerciseData.videoLinks || [],
        force: null,
        grips: null,
        mechanic: null,
        instructions: exerciseData.instructions || [],
        searchKeywords: [
          exerciseData.name.toLowerCase(),
          exerciseData.originalName.toLowerCase(),
          exerciseData.muscleGroup.toLowerCase(),
          exerciseData.equipment.toLowerCase(),
          ...exerciseData.name.toLowerCase().split(' '),
        ].filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 1,
        notes: exerciseData.notes || ''
      };

      const docRef = await addDoc(
        collection(db, 'users', userId, this.COLLECTION_NAME), 
        {
          ...customExercise,
          createdAt: Timestamp.fromDate(customExercise.createdAt),
          updatedAt: Timestamp.fromDate(customExercise.updatedAt)
        }
      );

      console.log('✅ Custom exercise saved:', { id: docRef.id, name: exerciseData.name });
      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving custom exercise:', error);
      throw new Error('Failed to save custom exercise');
    }
  }

  // Get all custom exercises for a user
  static async getUserCustomExercises(userId: string): Promise<CustomExercise[]> {
    try {
      const q = query(
        collection(db, 'users', userId, this.COLLECTION_NAME),
        orderBy('usageCount', 'desc'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const customExercises: CustomExercise[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        customExercises.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as CustomExercise);
      });

      console.log('📚 Retrieved custom exercises:', customExercises.length);
      return customExercises;
    } catch (error) {
      console.error('❌ Error getting custom exercises:', error);
      return [];
    }
  }

  // Check if an exercise name exists as a custom exercise
  static async findCustomExerciseByName(
    userId: string, 
    exerciseName: string
  ): Promise<CustomExercise | null> {
    try {
      const q = query(
        collection(db, 'users', userId, this.COLLECTION_NAME),
        where('originalName', '==', exerciseName.trim())
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as CustomExercise;
      }

      return null;
    } catch (error) {
      console.error('❌ Error finding custom exercise:', error);
      return null;
    }
  }

  // Increment usage count for a custom exercise
  static async incrementUsage(userId: string, exerciseId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, exerciseId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentUsage = docSnap.data().usageCount || 0;
        await updateDoc(docRef, {
          usageCount: currentUsage + 1,
          updatedAt: Timestamp.now()
        });
        console.log('📈 Incremented usage for custom exercise:', exerciseId);
      }
    } catch (error) {
      console.error('❌ Error incrementing usage:', error);
    }
  }

  // Update a custom exercise
  static async updateCustomExercise(
    userId: string,
    exerciseId: string,
    updates: Partial<SaveCustomExerciseData>
  ): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, exerciseId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      console.log('✏️ Updated custom exercise:', exerciseId);
    } catch (error) {
      console.error('❌ Error updating custom exercise:', error);
      throw new Error('Failed to update custom exercise');
    }
  }

  // Delete a custom exercise
  static async deleteCustomExercise(userId: string, exerciseId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, this.COLLECTION_NAME, exerciseId);
      await deleteDoc(docRef);
      console.log('🗑️ Deleted custom exercise:', exerciseId);
    } catch (error) {
      console.error('❌ Error deleting custom exercise:', error);
      throw new Error('Failed to delete custom exercise');
    }
  }

  // Merge custom exercises with database exercises for search
  static mergeWithDatabaseExercises(
    databaseExercises: Exercise[], 
    customExercises: CustomExercise[]
  ): Exercise[] {
    // Convert custom exercises to Exercise format
    const convertedCustoms: Exercise[] = customExercises.map(custom => ({
      id: custom.id || `custom-${Date.now()}`,
      name: custom.name,
      muscleGroup: custom.muscleGroup,
      muscleGroups: [custom.muscleGroup],
      equipment: custom.equipment,
      videoLinks: custom.videoLinks,
      difficulty: custom.difficulty,
      force: custom.force,
      grips: custom.grips,
      mechanic: custom.mechanic,
      instructions: custom.instructions,
      searchKeywords: custom.searchKeywords,
      createdAt: custom.createdAt.toISOString(),
      updatedAt: custom.updatedAt.toISOString(),
    }));

    // Merge and sort - custom exercises first (by usage), then database exercises
    const sortedCustoms = convertedCustoms.sort((a, b) => {
      const aCustom = customExercises.find(c => c.name === a.name);
      const bCustom = customExercises.find(c => c.name === b.name);
      return (bCustom?.usageCount || 0) - (aCustom?.usageCount || 0);
    });

    return [...sortedCustoms, ...databaseExercises];
  }

  // Create a custom exercise from unrecognized text
  static createCustomExerciseFromText(
    originalName: string,
    userId: string
  ): SaveCustomExerciseData {
    // Smart defaults based on exercise name
    const name = originalName.trim();
    const lowerName = name.toLowerCase();
    
    // Guess muscle group from common patterns
    let muscleGroup = 'Unknown';
    let equipment = 'Unknown';

    // Muscle group detection
    if (lowerName.includes('chest') || lowerName.includes('bench') || lowerName.includes('press') && !lowerName.includes('shoulder')) {
      muscleGroup = 'Chest';
    } else if (lowerName.includes('back') || lowerName.includes('row') || lowerName.includes('pull')) {
      muscleGroup = 'Back';
    } else if (lowerName.includes('shoulder') || lowerName.includes('military') || lowerName.includes('overhead')) {
      muscleGroup = 'Shoulders';
    } else if (lowerName.includes('leg') || lowerName.includes('squat') || lowerName.includes('lunge')) {
      muscleGroup = 'Legs';
    } else if (lowerName.includes('bicep') || lowerName.includes('curl')) {
      muscleGroup = 'Arms';
    } else if (lowerName.includes('tricep') || lowerName.includes('extension')) {
      muscleGroup = 'Arms';
    } else if (lowerName.includes('core') || lowerName.includes('abs') || lowerName.includes('crunch')) {
      muscleGroup = 'Core';
    }

    // Equipment detection
    if (lowerName.includes('dumbbell') || lowerName.includes('db')) {
      equipment = 'Dumbbells';
    } else if (lowerName.includes('barbell') || lowerName.includes('bb')) {
      equipment = 'Barbell';
    } else if (lowerName.includes('machine')) {
      equipment = 'Machine';
    } else if (lowerName.includes('cable')) {
      equipment = 'Cable';
    } else if (lowerName.includes('kettlebell')) {
      equipment = 'Kettlebell';
    } else if (lowerName.includes('bodyweight') || lowerName.includes('push') || lowerName.includes('pull')) {
      equipment = 'Bodyweight';
    }

    return {
      originalName,
      name: this.formatExerciseName(name),
      muscleGroup,
      equipment,
      difficulty: 'Intermediate',
      instructions: [`Custom exercise: ${name}`],
      notes: 'User-created exercise from workout parsing'
    };
  }

  // Format exercise name to proper case
  private static formatExerciseName(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Batch save multiple custom exercises (useful for workout imports)
  static async batchSaveCustomExercises(
    userId: string,
    exercises: SaveCustomExerciseData[]
  ): Promise<string[]> {
    try {
      const batch = writeBatch(db);
      const docRefs: string[] = [];

      for (const exerciseData of exercises) {
        const customExercise: Omit<CustomExercise, 'id'> = {
          ...exerciseData,
          userId,
          isCustom: true,
          id: '',
          videoLinks: exerciseData.videoLinks || [],
          force: null,
          grips: null,
          mechanic: null,
          instructions: exerciseData.instructions || [],
          searchKeywords: [
            exerciseData.name.toLowerCase(),
            exerciseData.originalName.toLowerCase(),
            exerciseData.muscleGroup.toLowerCase(),
            exerciseData.equipment.toLowerCase(),
            ...exerciseData.name.toLowerCase().split(' '),
          ].filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 1,
          notes: exerciseData.notes || ''
        };

        const docRef = doc(collection(db, 'users', userId, this.COLLECTION_NAME));
        batch.set(docRef, {
          ...customExercise,
          createdAt: Timestamp.fromDate(customExercise.createdAt),
          updatedAt: Timestamp.fromDate(customExercise.updatedAt)
        });
        docRefs.push(docRef.id);
      }

      await batch.commit();
      console.log('✅ Batch saved custom exercises:', docRefs.length);
      return docRefs;
    } catch (error) {
      console.error('❌ Error batch saving custom exercises:', error);
      throw new Error('Failed to batch save custom exercises');
    }
  }
}