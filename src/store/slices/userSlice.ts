import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  unitSystem: 'metric' | 'imperial';
  weightUnit: 'lbs' | 'kg';
  defaultRestTime: number;
  autoStartTimer: boolean;
  defaultProgressionRate: 'beginner' | 'intermediate' | 'advanced';
  keyboardShortcuts: {
    enabled: boolean;
    showInWorkout: boolean;
  };
  notifications: {
    workoutReminders: boolean;
    restTimerAlerts: boolean;
    achievements: boolean;
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface UserStats {
  totalWorkouts: number;
  totalWorkoutTime: number;
  totalSets: number;
  totalReps: number;
  totalWeightLifted: number;
  currentStreak: number;
  favoriteExercises: string[];
  lastWorkoutDate?: string;
}

export interface UserState {
  profile: UserProfile | null;
  preferences: UserPreferences;
  stats: UserStats;
  isLoading: boolean;
  error: string | null;
}

const initialPreferences: UserPreferences = {
  theme: 'system',
  unitSystem: 'imperial',
  weightUnit: 'lbs',
  defaultRestTime: 120,
  autoStartTimer: true,
  defaultProgressionRate: 'intermediate',
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

const initialState: UserState = {
  profile: null,
  preferences: initialPreferences,
  stats: initialStats,
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {

    setProfile: (state, action: PayloadAction<UserProfile | null>) => {
      state.profile = action.payload;
    },

    updateProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.profile) {
        Object.assign(state.profile, action.payload);
      }
    },

    setPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },

    setTheme: (state, action: PayloadAction<UserPreferences['theme']>) => {
      state.preferences.theme = action.payload;
    },

    setUnitSystem: (state, action: PayloadAction<UserPreferences['unitSystem']>) => {
      state.preferences.unitSystem = action.payload;
    },

    setWeightUnit: (state, action: PayloadAction<UserPreferences['weightUnit']>) => {
      state.preferences.weightUnit = action.payload;
    },

    setDefaultRestTime: (state, action: PayloadAction<number>) => {
      state.preferences.defaultRestTime = action.payload;
    },

    toggleAutoStartTimer: (state) => {
      state.preferences.autoStartTimer = !state.preferences.autoStartTimer;
    },

    setDefaultProgressionRate: (state, action: PayloadAction<UserPreferences['defaultProgressionRate']>) => {
      state.preferences.defaultProgressionRate = action.payload;
    },

    toggleKeyboardShortcuts: (state) => {
      state.preferences.keyboardShortcuts.enabled = !state.preferences.keyboardShortcuts.enabled;
    },

    toggleKeyboardShortcutsDisplay: (state) => {
      state.preferences.keyboardShortcuts.showInWorkout = !state.preferences.keyboardShortcuts.showInWorkout;
    },

    updateNotificationPreferences: (state, action: PayloadAction<Partial<UserPreferences['notifications']>>) => {
      state.preferences.notifications = { ...state.preferences.notifications, ...action.payload };
    },

    updateStats: (state, action: PayloadAction<Partial<UserStats>>) => {
      state.stats = { ...state.stats, ...action.payload };
    },

    incrementWorkoutStats: (state, action: PayloadAction<{ sets: number; reps: number; weightLifted: number; duration: number }>) => {
      const { sets, reps, weightLifted, duration } = action.payload;
      state.stats.totalWorkouts += 1;
      state.stats.totalSets += sets;
      state.stats.totalReps += reps;
      state.stats.totalWeightLifted += weightLifted;
      state.stats.totalWorkoutTime += duration;
      state.stats.lastWorkoutDate = new Date().toISOString();
    },

    updateStreak: (state, action: PayloadAction<number>) => {
      state.stats.currentStreak = action.payload;
    },

    addFavoriteExercise: (state, action: PayloadAction<string>) => {
      if (!state.stats.favoriteExercises.includes(action.payload)) {
        state.stats.favoriteExercises.push(action.payload);
      }
    },

    removeFavoriteExercise: (state, action: PayloadAction<string>) => {
      state.stats.favoriteExercises = state.stats.favoriteExercises.filter(id => id !== action.payload);
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },

    resetUser: (state) => {
      state.profile = null;
      state.preferences = initialPreferences;
      state.stats = initialStats;
      state.error = null;
    },
  },
});

export const {
  setProfile,
  updateProfile,
  setPreferences,
  setTheme,
  setUnitSystem,
  setWeightUnit,
  setDefaultRestTime,
  toggleAutoStartTimer,
  setDefaultProgressionRate,
  toggleKeyboardShortcuts,
  toggleKeyboardShortcutsDisplay,
  updateNotificationPreferences,
  updateStats,
  incrementWorkoutStats,
  updateStreak,
  addFavoriteExercise,
  removeFavoriteExercise,
  setLoading,
  setError,
  clearError,
  resetUser,
} = userSlice.actions;

export default userSlice.reducer;