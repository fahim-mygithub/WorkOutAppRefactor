# Progressive Overload System - Integration Guide

## Overview
This guide explains how to integrate the new Progressive Overload system into the existing WorkoutPage component.

## System Components

### 1. Core Files Created
- `src/types/progression.ts` - Type definitions
- `src/config/progressionConfig.ts` - Configuration and mappings
- `src/services/progressiveOverloadService.ts` - Recommendation engine
- `src/hooks/useProgressionRecommendation.ts` - React hook for managing state
- `src/components/workout/ProgressionRecommendation.tsx` - Main recommendation UI
- `src/components/workout/ExperienceSlider.tsx` - Experience level selector
- `src/components/workout/DeloadSuggestion.tsx` - Deload slide-out
- `src/components/workout/FatigueCheck.tsx` - Fatigue check slide-out
- `src/components/workout/ProgressionIntegration.tsx` - Example integration

### 2. Modified Files
- `src/store/slices/workoutSlice.ts` - Added progression state and actions
- `src/types/exerciseHistory.ts` - Added progression tracking fields
- `src/services/exerciseHistoryService.ts` - Updated to save progression data

## Integration Steps for WorkoutPage

### Step 1: Import Required Components
```tsx
// In WorkoutPage.tsx
import { ProgressionRecommendation } from '../components/workout/ProgressionRecommendation';
import { ExperienceSlider } from '../components/workout/ExperienceSlider';
import { DeloadSuggestion } from '../components/workout/DeloadSuggestion';
import { FatigueCheck } from '../components/workout/FatigueCheck';
import { useProgressionRecommendation } from '../hooks/useProgressionRecommendation';
import {
  setExperienceLevel,
  setProgressionTracking,
  recordProgressionOutcome
} from '../store/slices/workoutSlice';
```

### Step 2: Add State Management
```tsx
// Add to component state
const [showExperienceSlider, setShowExperienceSlider] = useState(true);

// Use the progression hook for each exercise
const progressionHook = useProgressionRecommendation({
  exercise: currentExercise.exercise,
  currentSets: currentExercise.sets.length,
  userId: user?.uid
});
```

### Step 3: Add UI Components

#### A. Add Experience Slider (once per workout, at the top)
```tsx
{showExperienceSlider && (
  <ExperienceSlider
    currentLevel={experienceLevel}
    onChange={(level) => {
      dispatch(setExperienceLevel(level));
      // Refresh all recommendations
    }}
  />
)}
```

#### B. Add Progression Recommendation (above each exercise)
```tsx
{progressionHook.recommendation && !progressionHook.isLoading && (
  <ProgressionRecommendation
    recommendation={progressionHook.recommendation}
    onAccept={() => {
      progressionHook.acceptRecommendation();
      // Update exercise weights/reps
      updateExerciseWeights(progressionHook.recommendation);
    }}
    onModify={(weight, reps) => {
      progressionHook.modifyRecommendation(weight, reps);
      updateExerciseWeights({ recommendedWeight: weight, recommendedReps: reps });
    }}
    onDismiss={progressionHook.dismissRecommendation}
  />
)}
```

#### C. Handle Deload Suggestions
```tsx
{progressionHook.showDeloadSuggestion && progressionHook.recommendation && (
  <DeloadSuggestion
    weeksSinceLastWorkout={Math.ceil((progressionHook.recommendation.daysSinceLastWorkout || 14) / 7)}
    suggestedDeloadPercentage={15}
    previousWeight={progressionHook.recommendation.previousWeight || 0}
    suggestedWeight={progressionHook.recommendation.recommendedWeight || 0}
    exerciseName={currentExercise.exercise.name}
    onAccept={progressionHook.applyDeload}
    onDecline={progressionHook.declineDeload}
    onClose={() => {/* handle close */}}
  />
)}
```

#### D. Handle Failed Sets (after set completion)
```tsx
// After a set is marked complete
const handleSetComplete = (set: WorkoutSet, setIndex: number) => {
  // Existing completion logic...

  // Check for failure
  if (!set.completed || set.failed || set.reps < targetReps) {
    progressionHook.checkForFailedSet(set, setIndex);
  }
};

// Show fatigue check when needed
{progressionHook.showFatigueCheck && (
  <FatigueCheck
    exerciseName={currentExercise.exercise.name}
    currentWeight={currentSet.weight || 0}
    setNumber={currentSetIndex + 1}
    onFatigued={() => {
      progressionHook.applyFatigue();
      // Reduce weight by 10% for remaining sets
      updateRemainingSetWeights(currentWeight * 0.9);
    }}
    onNotFatigued={progressionHook.continuePlan}
    onClose={() => {/* handle close */}}
  />
)}
```

### Step 4: Save Progression Data with Exercise History

```tsx
// When saving exercise performance
const saveExerciseData = async () => {
  const progressionTracking = store.getState().workout.progressionTracking[exerciseId];

  await ExerciseHistoryService.saveExercisePerformance(userId, {
    // ... existing data
    progressionData: progressionTracking,
    daysSinceLastWorkout: progressionHook.recommendation?.daysSinceLastWorkout,
  });
};
```

## Key Integration Points

### 1. On Exercise Start
- Load progression recommendation
- Show recommendation card
- Check for 2+ week gap (show deload if needed)

### 2. During Exercise
- Track set completion/failure
- Show fatigue check after failed sets
- Allow weight adjustments based on performance

### 3. After Exercise Complete
- Save progression tracking data with exercise history
- Record outcome (exceeded/met/failed)

### 4. User Preferences
- Experience slider persists across exercises
- User can override any recommendation

## Configuration

### Equipment Increments
The system automatically determines weight increments based on equipment type:
- **Barbell**: 2.5-10 lbs increments
- **Dumbbell**: 5-10 lbs increments (respects 5lb jumps)
- **Machine**: 10-20 lbs increments
- **Bodyweight**: Rep or variation progressions
- **Band**: Color progressions (yellow → red → blue → green → black)

### Experience Levels
- **Aggressive** (Beginners): Larger jumps, faster progression
- **Standard** (Intermediate): Moderate progression
- **Conservative** (Advanced): Smaller increments, undulating periodization

### Deload Triggers
- 14+ days: 15% reduction
- 21+ days: 20% reduction
- 30+ days: 30% reduction

## Testing Checklist

- [ ] Recommendation loads on exercise start
- [ ] Experience slider changes update recommendations
- [ ] Weight increases when all sets completed
- [ ] Weight maintains when reps drop (12,11,10 pattern)
- [ ] Weight decreases on significant failure
- [ ] Deload appears after 2+ weeks
- [ ] Fatigue check appears after failed set
- [ ] Bodyweight exercises show variation progressions
- [ ] Time-based exercises (planks) show time progressions
- [ ] Band exercises show color progressions
- [ ] Progression data saves with exercise history

## Troubleshooting

### No Recommendations Showing
- Check user is logged in
- Verify exercise has been performed at least once
- Check console for service errors

### Incorrect Weight Suggestions
- Verify equipment type mapping is correct
- Check if deload was applied unintentionally
- Ensure experience level is set appropriately

### Deload Not Appearing
- Check daysSinceLastWorkout calculation
- Verify last workout date is being saved

## Future Enhancements

1. **Plateau Detection**: Automatically suggest deload weeks or exercise variations after 3+ sessions at same weight
2. **Volume Tracking**: Track total weekly volume and suggest deloads based on accumulated fatigue
3. **Exercise Variations**: Suggest alternative exercises when plateaued
4. **Personal Records**: Highlight when user is approaching or exceeding PRs
5. **Analytics Dashboard**: Show progression trends over time

## Support

For issues or questions about the progression system:
1. Check the console for error messages
2. Verify all required services are imported
3. Ensure Redux store is properly configured
4. Check that exercise history is being saved correctly