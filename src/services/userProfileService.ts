import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile, UserPreferences, UserStats } from '../store/slices/userSlice';
import type { User } from 'firebase/auth';

export interface UserProfileData extends Omit<UserProfile, 'uid'> {
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export class UserProfileService {
  private static readonly USERS_COLLECTION = 'users';

  // Create a new user profile in Firestore when user signs up
  static async createUserProfile(user: User): Promise<UserProfile> {
    try {
      const now = new Date();

      const initialPreferences: UserPreferences = {
        theme: 'system',
        unitSystem: 'imperial',
        weightUnit: 'lbs',
        defaultRestTime: 120,
        autoStartTimer: true,
        keyboardShortcuts: {
          enabled: true,
          showInWorkout: true,
        },
        notifications: {
          workoutReminders: true,
          restTimerAlerts: true,
          achievements: true,
        },
      };

      const initialStats: UserStats = {
        totalWorkouts: 0,
        totalWorkoutTime: 0,
        totalSets: 0,
        totalReps: 0,
        totalWeightLifted: 0,
        currentStreak: 0,
        favoriteExercises: [],
      };

      const profileData: UserProfileData = {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        preferences: initialPreferences,
        stats: initialStats,
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      };

      // Save to Firestore
      await setDoc(doc(db, this.USERS_COLLECTION, user.uid), {
        ...profileData,
        createdAt: Timestamp.fromDate(profileData.createdAt),
        updatedAt: Timestamp.fromDate(profileData.updatedAt),
        lastActiveAt: Timestamp.fromDate(profileData.lastActiveAt),
      });

      const userProfile: UserProfile = {
        uid: user.uid,
        email: profileData.email,
        displayName: profileData.displayName,
        photoURL: profileData.photoURL,
        createdAt: profileData.createdAt.toISOString(),
        lastActiveAt: profileData.lastActiveAt.toISOString(),
      };

      console.log('✅ User profile created successfully:', user.uid);
      return userProfile;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  // Get user profile from Firestore
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        const profile: UserProfile = {
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL || '',
          createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
          lastActiveAt: data.lastActiveAt?.toDate()?.toISOString() || new Date().toISOString(),
        };

        console.log('✅ User profile retrieved:', uid);
        return profile;
      } else {
        console.log('❌ No user profile found for:', uid);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      return null;
    }
  }

  // Get complete user data including preferences and stats
  static async getCompleteUserData(uid: string): Promise<{
    profile: UserProfile | null;
    preferences: UserPreferences;
    stats: UserStats;
  }> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);

      const defaultPreferences: UserPreferences = {
        theme: 'system',
        unitSystem: 'imperial',
        weightUnit: 'lbs',
        defaultRestTime: 120,
        autoStartTimer: true,
        keyboardShortcuts: {
          enabled: true,
          showInWorkout: true,
        },
        notifications: {
          workoutReminders: true,
          restTimerAlerts: true,
          achievements: true,
        },
      };

      const defaultStats: UserStats = {
        totalWorkouts: 0,
        totalWorkoutTime: 0,
        totalSets: 0,
        totalReps: 0,
        totalWeightLifted: 0,
        currentStreak: 0,
        favoriteExercises: [],
      };

      if (docSnap.exists()) {
        const data = docSnap.data();

        const profile: UserProfile = {
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL || '',
          createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
          lastActiveAt: data.lastActiveAt?.toDate()?.toISOString() || new Date().toISOString(),
        };

        const preferences = { ...defaultPreferences, ...data.preferences };
        const stats = { ...defaultStats, ...data.stats };

        return { profile, preferences, stats };
      } else {
        return {
          profile: null,
          preferences: defaultPreferences,
          stats: defaultStats
        };
      }
    } catch (error) {
      console.error('❌ Error getting complete user data:', error);
      return {
        profile: null,
        preferences: {
          theme: 'system',
          unitSystem: 'imperial',
          weightUnit: 'lbs',
          defaultRestTime: 120,
          autoStartTimer: true,
          keyboardShortcuts: { enabled: true, showInWorkout: true },
          notifications: { workoutReminders: true, restTimerAlerts: true, achievements: true },
        },
        stats: {
          totalWorkouts: 0,
          totalWorkoutTime: 0,
          totalSets: 0,
          totalReps: 0,
          totalWeightLifted: 0,
          currentStreak: 0,
          favoriteExercises: [],
        }
      };
    }
  }

  // Update user profile
  static async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);

      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      };

      // Remove uid from updates if present (shouldn't be updated)
      delete updateData.uid;

      await updateDoc(docRef, updateData);
      console.log('✅ User profile updated:', uid);
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  // Update user preferences
  static async updateUserPreferences(uid: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);

      await updateDoc(docRef, {
        preferences,
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      console.log('✅ User preferences updated:', uid);
    } catch (error) {
      console.error('❌ Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  }

  // Update user stats
  static async updateUserStats(uid: string, stats: Partial<UserStats>): Promise<void> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);

      await updateDoc(docRef, {
        stats,
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      console.log('✅ User stats updated:', uid);
    } catch (error) {
      console.error('❌ Error updating user stats:', error);
      throw new Error('Failed to update user stats');
    }
  }

  // Update last active time
  private static async updateLastActiveTime(uid: string): Promise<void> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);
      await updateDoc(docRef, {
        lastActiveAt: serverTimestamp(),
      });
    } catch (error) {
      // Silently fail - this is not critical
      console.warn('Warning: Could not update last active time:', error);
    }
  }

  // Subscribe to user profile changes in real-time
  static subscribeToUserProfile(
    uid: string,
    callback: (data: {
      profile: UserProfile | null;
      preferences: UserPreferences;
      stats: UserStats;
    }) => void
  ): () => void {
    const docRef = doc(db, this.USERS_COLLECTION, uid);

    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();

        const profile: UserProfile = {
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL || '',
          createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
          lastActiveAt: data.lastActiveAt?.toDate()?.toISOString() || new Date().toISOString(),
        };

        const defaultPreferences: UserPreferences = {
          theme: 'system',
          unitSystem: 'imperial',
          weightUnit: 'lbs',
          defaultRestTime: 120,
          autoStartTimer: true,
          keyboardShortcuts: { enabled: true, showInWorkout: true },
          notifications: { workoutReminders: true, restTimerAlerts: true, achievements: true },
        };

        const defaultStats: UserStats = {
          totalWorkouts: 0,
          totalWorkoutTime: 0,
          totalSets: 0,
          totalReps: 0,
          totalWeightLifted: 0,
          currentStreak: 0,
          favoriteExercises: [],
        };

        const preferences = { ...defaultPreferences, ...data.preferences };
        const stats = { ...defaultStats, ...data.stats };

        callback({ profile, preferences, stats });
      } else {
        // User profile doesn't exist
        callback({
          profile: null,
          preferences: {
            theme: 'system',
            unitSystem: 'imperial',
            weightUnit: 'lbs',
            defaultRestTime: 120,
            autoStartTimer: true,
            keyboardShortcuts: { enabled: true, showInWorkout: true },
            notifications: { workoutReminders: true, restTimerAlerts: true, achievements: true },
          },
          stats: {
            totalWorkouts: 0,
            totalWorkoutTime: 0,
            totalSets: 0,
            totalReps: 0,
            totalWeightLifted: 0,
            currentStreak: 0,
            favoriteExercises: [],
          }
        });
      }
    }, (error) => {
      console.error('❌ Error in user profile subscription:', error);
    });

    return unsubscribe;
  }

  // Check if user profile exists
  static async userProfileExists(uid: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('❌ Error checking if user profile exists:', error);
      return false;
    }
  }

  // Delete user profile (for account deletion)
  static async deleteUserProfile(uid: string): Promise<void> {
    try {
      const docRef = doc(db, this.USERS_COLLECTION, uid);
      await updateDoc(docRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
      console.log('✅ User profile marked as deleted:', uid);
    } catch (error) {
      console.error('❌ Error deleting user profile:', error);
      throw new Error('Failed to delete user profile');
    }
  }
}