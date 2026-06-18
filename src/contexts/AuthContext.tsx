import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { authService, type AuthResult } from '../firebase/auth';
import { UserProfileService } from '../services/userProfileService';
import { DEMO_MODE, DEMO_USER } from '../demo/demo';

// Serializable user data interface
interface SerializableUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: SerializableUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<SerializableUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to convert Firebase User to serializable format
  const createSerializableUser = (firebaseUser: User): SerializableUser => ({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL
  });

  useEffect(() => {
    // Demo build: inject the fake user immediately and never touch Firebase auth,
    // so the published demo needs no login and hits no backend.
    if (DEMO_MODE) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    console.log('🔐 AuthContext: Setting up auth state listener');

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const newUser = firebaseUser ? createSerializableUser(firebaseUser) : null;

      console.log('🔐 AuthContext: Auth state changed:', {
        newUser: newUser?.uid || 'anonymous',
        currentPath: window.location.pathname,
        isSharedRoute: window.location.pathname.includes('/shared/')
      });

      setUser(newUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []); // Remove user dependency to prevent infinite loop

  const clearError = () => setError(null);

  const handleAuthResult = (result: AuthResult): AuthResult => {
    if (result.success) {
      setError(null);
    } else {
      setError(result.error || 'An error occurred');
    }
    return result;
  };

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.signUpWithEmail(email, password);

      // If signup successful and we have a user, create their profile
      if (result.success && result.user) {
        try {
          await UserProfileService.createUserProfile(result.user);
          console.log('✅ User profile created successfully during signup');
        } catch (profileError) {
          console.error('❌ Error creating user profile during signup:', profileError);
          // Don't fail the entire signup process if profile creation fails
          // The useAuthSync hook will handle creating the profile later
        }
      }

      return handleAuthResult(result);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.signInWithEmail(email, password);
      return handleAuthResult(result);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.signInWithGoogle();
      return handleAuthResult(result);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.signOut();
      return handleAuthResult(result);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.resetPassword(email);
      return handleAuthResult(result);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    error,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};