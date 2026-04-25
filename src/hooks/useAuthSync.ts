import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAppDispatch } from '../store/hooks';
import { setProfile, setPreferences, updateStats, resetUser } from '../store/slices/userSlice';
import { auth } from '../firebase/config';
import { UserProfileService } from '../services/userProfileService';

/**
 * Hook that syncs Firebase Auth state with Redux state
 * Automatically manages user profile loading and real-time sync
 */
export const useAuthSync = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile subscription
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        console.log('🔄 User authenticated:', firebaseUser.uid);


        try {
          // Check if user profile exists, create if not
          const profileExists = await UserProfileService.userProfileExists(firebaseUser.uid);

          if (!profileExists) {
            console.log('📝 Creating new user profile...');
            const newProfile = await UserProfileService.createUserProfile(firebaseUser);
            dispatch(setProfile(newProfile));
          }

          // Set up real-time subscription to user profile
          unsubscribeProfile = UserProfileService.subscribeToUserProfile(
            firebaseUser.uid,
            ({ profile, preferences, stats }) => {
              console.log('🔄 User profile updated from Firestore');
              dispatch(setProfile(profile));
              dispatch(setPreferences(preferences));
              dispatch(updateStats(stats));
            }
          );

        } catch (error) {
          console.error('❌ Error setting up user profile:', error);

          // If profile setup fails, still keep the Firebase user but with defaults
          const fallbackProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          };

          dispatch(setProfile(fallbackProfile));
        }

      } else {
        console.log('🚪 User signed out');
        // User signed out - reset all user state
        dispatch(resetUser());
      }
    });

    // Cleanup function
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [dispatch]);
};

export default useAuthSync;