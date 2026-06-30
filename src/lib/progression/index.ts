/**
 * Pure progression core — deterministic, dependency-free (only oneRepMax math
 * and shared types). No React, Firebase, or config imports. Callers pass numeric
 * increments in; nothing here reads the progression config.
 */
export { effortAdjustedE1RM } from './e1rm';
export { bestSetE1RM, smoothedSessionE1RM, smoothedSessions, median } from './sessionE1RM';
export { nextDoubleProgression } from './doubleProgression';
export { inSessionDecision } from './autoregulation';
export { decideInSession, inSessionSuggestion } from './inSession';
export { returnFromLayoffSuggestion } from './layoff';
export { welcomeBackSuggestion } from './welcomeBack';
export { round5 } from './round';
export { prescribedFloor, formatRepRange } from './setPrescription';

// Public contract types for downstream callers (e.g. the Phase 3 service adapter).
export type { LoggedSet } from './types';
export type { Prescription, LastSession, NextPrescription } from './doubleProgression';
export type { SetTarget } from './autoregulation';
export type { LayoffInput, LayoffSuggestion } from './layoff';
export type { WelcomeBackRecommendation, WelcomeBackView } from './welcomeBack';
export type { InSessionDecision } from '../../types/progression';
