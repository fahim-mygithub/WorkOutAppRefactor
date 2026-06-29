import { ExerciseHistoryService } from './exerciseHistoryService';
import type {
  ProgressionRecommendation,
  PerformanceAnalysis,
  ExperienceLevel,
  ProgressionAction,
  AlternativeProgression,
  BandColor
} from '../types/progression';
import type { ExerciseHistory, PerformedSet } from '../types/exerciseHistory';
import type { Exercise } from '../types/exercise';
import {
  equipmentIncrements,
  defaultDeloadFactors,
  bodyweightProgressions,
  timeBasedIncrements,
  getNextBandColor,
  getPreviousBandColor,
  getEquipmentType,
  isTimeBasedExercise,
  bandColorProgression
} from '../config/progressionConfig';

export class ProgressiveOverloadService {

  static async getRecommendation(
    userId: string,
    exercise: Exercise,
    currentSets: number,
    experienceLevel: ExperienceLevel = 'standard',
    configuredReps?: number,
    configuredWeight?: number
  ): Promise<ProgressionRecommendation> {

    try {
      // Step 1: Get last performance (minimum 1 session needed)
      const lastPerformance = await this.getLastPerformance(userId, exercise.id);

      if (!lastPerformance) {
        return this.getFirstTimeRecommendation(exercise, currentSets, experienceLevel, configuredReps, configuredWeight);
      }

      // Step 2: Calculate days since last workout and determine deload
      const daysSinceLastWorkout = this.calculateDaysSince(lastPerformance.workoutDate);
      const deloadFactor = this.getDeloadFactor(daysSinceLastWorkout);
      const needsDeload = deloadFactor < 1;

      // Step 3: Determine progression type (strength vs hypertrophy)
      const isStrength = currentSets < 5;

      // Step 4: Analyze last performance
      const analysis = this.analyzePerformance(lastPerformance);

      // Step 5: Calculate recommendation based on exercise type
      let recommendation: ProgressionRecommendation;

      if (isTimeBasedExercise(exercise.name)) {
        recommendation = this.calculateTimeBasedProgression(
          lastPerformance,
          analysis,
          experienceLevel,
          deloadFactor
        );
      } else if (exercise.equipment.toLowerCase() === 'bodyweight') {
        recommendation = this.calculateBodyweightProgression(
          exercise,
          lastPerformance,
          analysis,
          experienceLevel,
          deloadFactor
        );
      } else {
        recommendation = this.calculateWeightProgression(
          exercise,
          lastPerformance,
          analysis,
          isStrength,
          experienceLevel,
          deloadFactor
        );
      }

      // Step 6: Add context about days since last workout
      recommendation.daysSinceLastWorkout = daysSinceLastWorkout;

      // Step 7: Generate alternatives if needed
      if (recommendation.action === 'decrease' || needsDeload) {
        recommendation.alternatives = this.generateAlternatives(exercise, lastPerformance);
      }

      return recommendation;

    } catch (error) {
      console.error('Error generating progression recommendation:', error);
      return this.getFallbackRecommendation(exercise);
    }
  }

  private static async getLastPerformance(
    userId: string,
    exerciseId: string
  ): Promise<ExerciseHistory | null> {
    const history = await ExerciseHistoryService.getExerciseHistory(userId, {
      exerciseId,
      limit: 1
    });

    return history.length > 0 ? history[0] : null;
  }

  private static calculateDaysSince(workoutDate: Date | string): number {
    const lastDate = new Date(workoutDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private static getDeloadFactor(daysSince: number): number {
    if (daysSince >= 30) return defaultDeloadFactors.monthPlusGap;
    if (daysSince >= 21) return defaultDeloadFactors.threeWeekGap;
    if (daysSince >= 14) return defaultDeloadFactors.twoWeekGap;
    return 1.0; // No deload needed
  }

  private static analyzePerformance(history: ExerciseHistory): PerformanceAnalysis {
    const sets = history.sets;

    // Calculate total completion rate
    const totalTargetReps = sets.reduce((sum, s) => sum + s.targetReps, 0);
    const totalActualReps = sets.reduce((sum, s) => sum + s.actualReps, 0);
    const repCompletion = totalActualReps / totalTargetReps;

    // Check for dropping rep pattern (e.g., 12, 11, 10)
    const isDroppingReps = this.detectDroppingReps(sets);

    // Check if all sets were completed at target
    const allSetsCompleted = sets.every(s => s.actualReps >= s.targetReps && s.completed);

    // Check if last 2 sets hit upper range (strong finish)
    const lastSetsStrong = this.checkLastSetsStrong(sets);

    // Determine failure pattern if any
    const failurePattern = this.detectFailurePattern(sets);

    // Calculate average RPE if available
    const averageRPE = this.calculateAverageRPE(sets);

    return {
      success: allSetsCompleted && !isDroppingReps,
      repCompletion,
      shouldIncrease: allSetsCompleted && !isDroppingReps && lastSetsStrong,
      shouldMaintain: (allSetsCompleted && isDroppingReps) || (repCompletion >= 0.9 && repCompletion < 1),
      shouldDecrease: !allSetsCompleted && repCompletion < 0.85,
      isDroppingReps,
      averageRPE,
      failurePattern
    };
  }

  private static detectDroppingReps(sets: PerformedSet[]): boolean {
    if (sets.length < 2) return false;

    // Check if reps are consistently decreasing
    let droppingCount = 0;
    for (let i = 1; i < sets.length; i++) {
      if (sets[i].actualReps < sets[i - 1].actualReps) {
        droppingCount++;
      }
    }

    // If more than half the transitions show dropping, it's a dropping pattern
    return droppingCount > (sets.length - 1) / 2;
  }

  private static checkLastSetsStrong(sets: PerformedSet[]): boolean {
    if (sets.length < 2) return sets[0]?.actualReps >= sets[0]?.targetReps;

    const lastTwo = sets.slice(-2);
    return lastTwo.every(s => s.actualReps >= s.targetReps && s.completed);
  }

  private static detectFailurePattern(sets: PerformedSet[]): 'early' | 'late' | 'consistent' | undefined {
    const failedSets = sets.map((s, i) => ({ index: i, failed: s.actualReps < s.targetReps }));
    const failures = failedSets.filter(s => s.failed);

    if (failures.length === 0) return undefined;
    if (failures.length === sets.length) return 'consistent';

    const avgFailureIndex = failures.reduce((sum, f) => sum + f.index, 0) / failures.length;
    if (avgFailureIndex < sets.length / 3) return 'early';
    if (avgFailureIndex > (2 * sets.length) / 3) return 'late';
    return 'consistent';
  }

  private static calculateAverageRPE(sets: PerformedSet[]): number | undefined {
    const rpeValues = sets.filter(s => s.rpe).map(s => s.rpe!);
    if (rpeValues.length === 0) return undefined;
    return rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;
  }

  private static calculateWeightProgression(
    exercise: Exercise,
    lastPerformance: ExerciseHistory,
    analysis: PerformanceAnalysis,
    isStrength: boolean,
    experienceLevel: ExperienceLevel,
    deloadFactor: number
  ): ProgressionRecommendation {

    const equipmentType = getEquipmentType(exercise.equipment);
    const increments = equipmentIncrements[equipmentType];
    const incrementType = isStrength ? 'strength' : 'hypertrophy';
    const increment = increments[incrementType][experienceLevel];

    // Get last weight (assuming all sets had similar weight)
    const lastWeight = Math.max(...lastPerformance.sets.map(s => s.weight));
    const lastReps = lastPerformance.sets[0]?.targetReps || 8;

    let recommendedWeight = lastWeight;
    let action: ProgressionAction;
    let reasoning: string;

    if (analysis.shouldIncrease) {
      recommendedWeight = lastWeight + increment;
      action = 'increase';
      reasoning = `All sets completed successfully. Increasing by ${increment}lbs (${experienceLevel} progression).`;
    } else if (analysis.shouldMaintain) {
      action = 'maintain';
      if (analysis.isDroppingReps) {
        reasoning = 'Reps dropping across sets. Maintain weight to build consistency.';
      } else {
        reasoning = 'Good performance. Maintain weight for another session to solidify.';
      }
    } else if (analysis.shouldDecrease) {
      recommendedWeight = lastWeight * 0.9;
      action = 'decrease';
      if (analysis.failurePattern === 'early') {
        reasoning = 'Failed early sets. Weight too heavy. Reducing by 10%.';
      } else {
        reasoning = `Only completed ${Math.round(analysis.repCompletion * 100)}% of target reps. Reducing weight.`;
      }
    } else {
      action = 'maintain';
      reasoning = 'Performance analysis inconclusive. Maintain current weight.';
    }

    // Apply deload if needed
    let deloadApplied = false;
    if (deloadFactor < 1) {
      recommendedWeight = Math.round(recommendedWeight * deloadFactor);
      action = 'deload';
      deloadApplied = true;
      const deloadPercentage = Math.round((1 - deloadFactor) * 100);
      reasoning = `It's been ${lastPerformance.daysSinceLastWorkout || 14}+ days since last workout. Applied ${deloadPercentage}% deload for safety.`;
    }

    // Round to practical weight
    recommendedWeight = this.roundToAvailableWeight(recommendedWeight, equipmentType);

    return {
      action,
      recommendedWeight,
      recommendedReps: lastReps,
      previousWeight: lastWeight,
      previousReps: lastReps,
      reasoning,
      confidence: this.calculateConfidence(analysis, deloadApplied),
      deloadApplied,
      alternatives: []
    };
  }

  private static calculateBodyweightProgression(
    exercise: Exercise,
    lastPerformance: ExerciseHistory,
    analysis: PerformanceAnalysis,
    experienceLevel: ExperienceLevel,
    deloadFactor: number
  ): ProgressionRecommendation {

    const progression = bodyweightProgressions[exercise.name];
    let recommendedVariation = exercise.name;
    let reasoning: string;
    let action: ProgressionAction;

    // Check if using bands
    const lastNotes = lastPerformance.notes || '';
    const bandMatch = lastNotes.match(/band.*\((.*?)\)/i);
    const currentBand = bandMatch ? bandMatch[1].toLowerCase() as BandColor : null;

    if (currentBand && progression?.bandColors) {
      // Handle band-assisted progression
      if (analysis.shouldIncrease) {
        const nextBand = getNextBandColor(currentBand);
        if (nextBand) {
          recommendedVariation = `Band Assisted (${nextBand.charAt(0).toUpperCase() + nextBand.slice(1)})`;
          action = 'increase';
          reasoning = `Progressing to lighter band assistance (${currentBand} → ${nextBand}).`;
        } else {
          recommendedVariation = exercise.name;
          action = 'increase';
          reasoning = 'Ready to progress to unassisted!';
        }
      } else if (analysis.shouldDecrease) {
        const prevBand = getPreviousBandColor(currentBand);
        if (prevBand) {
          recommendedVariation = `Band Assisted (${prevBand.charAt(0).toUpperCase() + prevBand.slice(1)})`;
          action = 'decrease';
          reasoning = `Need more assistance. Moving to heavier band (${currentBand} → ${prevBand}).`;
        } else {
          action = 'maintain';
          reasoning = 'Continue with current band assistance.';
        }
      } else {
        action = 'maintain';
        reasoning = 'Continue with current band assistance to build consistency.';
      }
    } else if (progression) {
      // Handle standard bodyweight progression
      const currentIndex = this.findCurrentProgressionIndex(exercise.name, progression);

      if (analysis.shouldIncrease) {
        if (currentIndex < progression.progressions.length - 1) {
          recommendedVariation = progression.progressions[currentIndex + 1];
          action = 'increase';
          reasoning = `Ready for harder variation: ${recommendedVariation}`;
        } else {
          action = 'maintain';
          reasoning = 'At maximum progression. Consider adding weight or reps.';
        }
      } else if (analysis.shouldDecrease) {
        if (currentIndex > 0 || progression.regressions.length > 0) {
          recommendedVariation = currentIndex > 0
            ? progression.progressions[currentIndex - 1]
            : progression.regressions[progression.regressions.length - 1];
          action = 'decrease';
          reasoning = `Scaling back to easier variation: ${recommendedVariation}`;
        } else {
          action = 'maintain';
          reasoning = 'Continue with current variation.';
        }
      } else {
        action = 'maintain';
        reasoning = 'Continue with current variation to build consistency.';
      }
    } else {
      // No specific progression defined, use rep-based progression
      const lastReps = Math.max(...lastPerformance.sets.map(s => s.actualReps));
      const repIncrement = experienceLevel === 'aggressive' ? 2 : 1;

      if (analysis.shouldIncrease) {
        action = 'increase';
        reasoning = `Increase target reps by ${repIncrement} (${lastReps} → ${lastReps + repIncrement}).`;
      } else {
        action = 'maintain';
        reasoning = 'Continue with current rep target.';
      }
    }

    // Apply deload if needed
    if (deloadFactor < 1) {
      action = 'deload';
      reasoning = `It's been ${lastPerformance.daysSinceLastWorkout || 14}+ days. Consider easier variation or reduced reps.`;
    }

    return {
      action,
      recommendedVariation,
      recommendedReps: lastPerformance.sets[0]?.targetReps || 8,
      reasoning,
      confidence: this.calculateConfidence(analysis, deloadFactor < 1),
      deloadApplied: deloadFactor < 1,
      alternatives: []
    };
  }

  private static calculateTimeBasedProgression(
    lastPerformance: ExerciseHistory,
    analysis: PerformanceAnalysis,
    experienceLevel: ExperienceLevel,
    deloadFactor: number
  ): ProgressionRecommendation {

    // Extract time from last performance (assuming stored in notes or a custom field)
    const lastTime = this.extractTimeFromPerformance(lastPerformance);
    const timeIncrement = timeBasedIncrements[experienceLevel];

    let recommendedTime = lastTime;
    let action: ProgressionAction;
    let reasoning: string;

    if (analysis.success) {
      recommendedTime = lastTime + timeIncrement;
      action = 'increase';
      reasoning = `Great job! Increasing hold time by ${timeIncrement} seconds.`;
    } else if (analysis.repCompletion < 0.8) {
      recommendedTime = Math.max(lastTime - 5, 10); // Minimum 10 seconds
      action = 'decrease';
      reasoning = 'Reducing time to build better form and endurance.';
    } else {
      action = 'maintain';
      reasoning = 'Continue with current time to build consistency.';
    }

    // Apply deload if needed
    if (deloadFactor < 1) {
      recommendedTime = Math.round(recommendedTime * deloadFactor);
      action = 'deload';
      reasoning = `Been away for a while. Reduced time for re-adaptation.`;
    }

    return {
      action,
      recommendedTime,
      reasoning,
      confidence: this.calculateConfidence(analysis, deloadFactor < 1),
      deloadApplied: deloadFactor < 1,
      alternatives: []
    };
  }

  private static extractTimeFromPerformance(performance: ExerciseHistory): number {
    // Try to extract from notes or assume 30 seconds default
    const timeMatch = performance.notes?.match(/(\d+)\s*(?:seconds?|secs?|s)/i);
    return timeMatch ? parseInt(timeMatch[1]) : 30;
  }

  private static findCurrentProgressionIndex(
    exerciseName: string,
    progression: typeof bodyweightProgressions[string]
  ): number {
    const allProgressions = [
      ...progression.regressions,
      progression.standard,
      ...progression.progressions
    ];

    const currentIndex = allProgressions.findIndex(p =>
      p.toLowerCase() === exerciseName.toLowerCase()
    );

    return currentIndex !== -1 ? currentIndex - progression.regressions.length : 0;
  }

  private static roundToAvailableWeight(weight: number, equipmentType: string): number {
    // Round to nearest 5 for dumbbells and plates
    if (equipmentType === 'dumbbell' || equipmentType === 'plate') {
      return Math.round(weight / 5) * 5;
    }

    // Round to nearest 2.5 for barbells
    if (equipmentType === 'barbell') {
      return Math.round(weight / 2.5) * 2.5;
    }

    // Round to nearest 10 for machines
    if (equipmentType === 'machine') {
      return Math.round(weight / 10) * 10;
    }

    // Default to nearest 5
    return Math.round(weight / 5) * 5;
  }

  private static calculateConfidence(
    analysis: PerformanceAnalysis,
    deloadApplied: boolean
  ): 'high' | 'medium' | 'low' {
    if (deloadApplied) return 'medium';

    if (analysis.success && analysis.repCompletion === 1) return 'high';
    if (analysis.repCompletion >= 0.9) return 'medium';
    return 'low';
  }

  private static generateAlternatives(
    exercise: Exercise,
    lastPerformance: ExerciseHistory
  ): AlternativeProgression[] {
    const alternatives: AlternativeProgression[] = [];

    // Tempo alternative
    alternatives.push({
      type: 'tempo',
      description: 'Slow eccentric tempo',
      recommendation: 'Try 3-1-1 tempo (3 sec down, 1 sec pause, 1 sec up) with same weight'
    });

    // Pause alternative
    alternatives.push({
      type: 'pause',
      description: 'Add pause reps',
      recommendation: '1-2 second pause at bottom of each rep'
    });

    // Partial reps for failure recovery
    if (exercise.equipment !== 'Bodyweight') {
      alternatives.push({
        type: 'partial',
        description: 'Partial range of motion',
        recommendation: 'Focus on strongest part of range to rebuild confidence'
      });
    }

    return alternatives;
  }

  private static getFirstTimeRecommendation(
    exercise: Exercise,
    currentSets: number,
    experienceLevel: ExperienceLevel,
    configuredReps?: number,
    configuredWeight?: number
  ): ProgressionRecommendation {
    const isBodyweight = exercise.equipment.toLowerCase() === 'bodyweight';
    const isTimeBased = isTimeBasedExercise(exercise.name);

    if (isTimeBased) {
      return {
        action: 'maintain',
        recommendedTime: 30, // Start with 30 seconds
        reasoning: 'First time performing this exercise. Starting with 30 seconds.',
        confidence: 'low',
        deloadApplied: false,
        alternatives: []
      };
    }

    if (isBodyweight) {
      const progression = bodyweightProgressions[exercise.name];
      const startingVariation = progression?.regressions[progression.regressions.length - 1] || exercise.name;

      return {
        action: 'maintain',
        recommendedVariation: startingVariation,
        recommendedReps: configuredReps || 5,
        reasoning: `First time performing ${exercise.name}. Starting with easier variation.`,
        confidence: 'low',
        deloadApplied: false,
        alternatives: []
      };
    }

    // Weight-based exercise - conservative start
    const equipmentType = getEquipmentType(exercise.equipment);
    const isStrength = currentSets < 5;

    // Conservative starting weights by equipment
    const startingWeights: Record<string, number> = {
      barbell: 45,      // Empty bar
      dumbbell: 10,     // Light dumbbells
      machine: 20,      // Light stack
      cable: 20,        // Light stack
      plate: 10,        // Light plate
      kettlebell: 15,   // Light kettlebell
      'smith-machine': 45 // Empty bar
    };

    // Use configured reps if available, otherwise use heuristics
    let recommendedReps = configuredReps;
    if (!recommendedReps) {
      recommendedReps = isStrength ? 5 : 10;
    }

    // Prefer the weight prescribed by the workout (e.g. "12 × 60") over the generic
    // equipment default — the plan already knows the intended load for this session.
    const hasPrescribedWeight = configuredWeight !== undefined && configuredWeight > 0;
    const recommendedWeight = hasPrescribedWeight
      ? configuredWeight
      : startingWeights[equipmentType] || 10;

    return {
      action: 'maintain',
      recommendedWeight,
      recommendedReps,
      reasoning: hasPrescribedWeight
        ? 'First time performing this exercise. Starting with your planned weight.'
        : 'First time performing this exercise. Starting with conservative weight.',
      confidence: 'low',
      deloadApplied: false,
      alternatives: []
    };
  }

  private static getFallbackRecommendation(exercise: Exercise): ProgressionRecommendation {
    return {
      action: 'maintain',
      reasoning: 'Unable to generate recommendation. Continue with previous weight.',
      confidence: 'low',
      deloadApplied: false,
      alternatives: []
    };
  }

  // Apply fatigue adjustment (called when user indicates fatigue)
  static applyFatigueAdjustment(
    recommendation: ProgressionRecommendation
  ): ProgressionRecommendation {
    const fatigueMultiplier = defaultDeloadFactors.fatiguedToday;
    const adjustedRecommendation = { ...recommendation };

    if (adjustedRecommendation.recommendedWeight && adjustedRecommendation.previousWeight) {
      if (adjustedRecommendation.action === 'increase') {
        // If we were going to increase, maintain at previous weight instead (no increase)
        adjustedRecommendation.recommendedWeight = adjustedRecommendation.previousWeight;
        adjustedRecommendation.action = 'maintain';
        adjustedRecommendation.reasoning = 'Fatigue detected - maintaining at current weight instead of increasing.';
      } else if (adjustedRecommendation.action === 'maintain' || adjustedRecommendation.action === 'decrease') {
        // If we were maintaining or decreasing, apply 15% deload
        adjustedRecommendation.recommendedWeight = Math.round(
          adjustedRecommendation.previousWeight * fatigueMultiplier
        );
        adjustedRecommendation.action = 'decrease';
        adjustedRecommendation.reasoning = 'Fatigue detected - applying 15% weight reduction (deload) for recovery.';
      }
    } else if (adjustedRecommendation.recommendedWeight) {
      // Fallback for cases without previous weight data
      adjustedRecommendation.recommendedWeight = Math.round(
        adjustedRecommendation.recommendedWeight * fatigueMultiplier
      );
      adjustedRecommendation.action = 'decrease';
      adjustedRecommendation.reasoning = 'Fatigue detected - applying 15% weight reduction for recovery.';
    }

    // Don't modify reps/set structure when fatigued - only adjust weight
    // The user should maintain their planned set structure

    return adjustedRecommendation;
  }
}