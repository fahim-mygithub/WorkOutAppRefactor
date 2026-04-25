# Firebase Security Rules for Shared Workouts

This document outlines the Firebase Firestore security rules that need to be implemented to support the shared workouts feature.

## Overview

The shared workouts feature introduces a new collection `sharedWorkouts` that requires public read access while maintaining secure write access.

## Required Security Rules

Add the following rules to your Firestore Security Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Existing rules for user documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Existing nested collections (savedWorkouts, etc.)
      match /{collection}/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // NEW: Shared workouts collection - PUBLIC READ, AUTHENTICATED WRITE
    match /sharedWorkouts/{docId} {
      // Allow anyone to read shared workouts (for anonymous access)
      allow read: if true;

      // Only allow authenticated users to create shared workouts
      allow create: if request.auth != null
        && request.auth.uid == resource.data.creatorId;

      // Only allow creators to update their own shared workouts
      allow update: if request.auth != null
        && request.auth.uid == resource.data.creatorId
        && request.auth.uid == request.resource.data.creatorId; // Prevent changing creatorId

      // Only allow creators to delete their own shared workouts
      allow delete: if request.auth != null
        && request.auth.uid == resource.data.creatorId;
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Security Rule Explanations

### Shared Workouts Collection Rules

1. **Public Read Access**
   ```javascript
   allow read: if true;
   ```
   - Allows anyone (including non-authenticated users) to read shared workouts
   - Enables anonymous users to access shared workout links
   - Required for the SharedWorkoutService.getSharedWorkoutByShareId() method

2. **Authenticated Creation**
   ```javascript
   allow create: if request.auth != null
     && request.auth.uid == resource.data.creatorId;
   ```
   - Only authenticated users can create shared workouts
   - The creatorId must match the authenticated user's UID
   - Prevents unauthorized workout sharing

3. **Creator-Only Updates**
   ```javascript
   allow update: if request.auth != null
     && request.auth.uid == resource.data.creatorId
     && request.auth.uid == request.resource.data.creatorId;
   ```
   - Only the creator can update their shared workouts
   - Prevents changing the creatorId field
   - Used for updating view counts, settings, etc.

4. **Creator-Only Deletion**
   ```javascript
   allow delete: if request.auth != null
     && request.auth.uid == resource.data.creatorId;
   ```
   - Only the creator can delete their shared workouts
   - Maintains data ownership

## Additional Security Considerations

### Rate Limiting
Consider implementing rate limiting for shared workout creation to prevent abuse:

```javascript
// Example: Limit to 10 shared workouts per user per day
allow create: if request.auth != null
  && request.auth.uid == resource.data.creatorId
  && (!exists(/databases/$(database)/documents/rateLimits/$(request.auth.uid))
    || get(/databases/$(database)/documents/rateLimits/$(request.auth.uid)).data.count < 10);
```

### Data Validation
Add validation rules to ensure data integrity:

```javascript
allow create: if request.auth != null
  && request.auth.uid == resource.data.creatorId
  && validateSharedWorkout(request.resource.data);

function validateSharedWorkout(workout) {
  return workout.keys().hasAll(['shareId', 'creatorId', 'creatorName', 'workoutData', 'metadata', 'settings'])
    && workout.shareId is string
    && workout.shareId.size() == 8  // Assuming 8-character share IDs
    && workout.creatorId is string
    && workout.creatorName is string
    && workout.workoutData is map
    && workout.metadata is map
    && workout.settings is map;
}
```

## Testing the Rules

Before deploying, test the rules with the Firebase Emulator:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Initialize Firebase in your project: `firebase init firestore`
3. Start the emulator: `firebase emulators:start --only firestore`
4. Run your application against the emulator to verify rules work correctly

## Deployment

Deploy the rules using Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## Monitoring

Monitor your Firestore usage to ensure the public read access doesn't result in unexpected costs:

1. Set up billing alerts in Firebase Console
2. Monitor read operations in Firebase Console Analytics
3. Consider implementing usage quotas if necessary

## Important Notes

- **Security First**: These rules allow public read access to shared workouts. Ensure no sensitive data is stored in shared workouts.
- **Cost Implications**: Public read access can increase Firestore read operations. Monitor usage carefully.
- **Data Privacy**: Only share workouts that are appropriate for public access.
- **Backup Strategy**: Ensure you have backups of your Firestore rules before making changes.

## Rule Testing Examples

Test these scenarios to ensure rules work correctly:

1. ✅ Anonymous user can read a shared workout
2. ✅ Authenticated user can create a shared workout
3. ❌ Anonymous user cannot create a shared workout
4. ✅ Creator can update their shared workout
5. ❌ Non-creator cannot update a shared workout
6. ✅ Creator can delete their shared workout
7. ❌ Non-creator cannot delete a shared workout
8. ❌ User cannot change creatorId on update