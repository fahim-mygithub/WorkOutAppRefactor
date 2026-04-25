import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  type User,
  type UserCredential
} from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  async signUpWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  async signInWithGoogle(): Promise<AuthResult> {
    try {
      const userCredential: UserCredential = await signInWithPopup(auth, googleProvider);
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  async resetPassword(email: string): Promise<AuthResult> {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  async signOut(): Promise<AuthResult> {
    try {
      await signOut(auth);
      return {
        success: true
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  getCurrentUser(): User | null {
    return auth.currentUser;
  }
};