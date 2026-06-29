/**
 * Pure progression core — deterministic, dependency-free (only oneRepMax math
 * and shared types). No React, Firebase, or config imports. Callers pass numeric
 * increments in; nothing here reads the progression config.
 */
export { effortAdjustedE1RM } from './e1rm';
export { bestSetE1RM, smoothedSessionE1RM } from './sessionE1RM';
export { nextDoubleProgression } from './doubleProgression';
export { inSessionDecision } from './autoregulation';
export { returnFromLayoffSuggestion } from './layoff';
export { round5 } from './round';
