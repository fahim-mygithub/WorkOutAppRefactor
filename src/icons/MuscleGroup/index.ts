export { MuscleGroupIcon } from './MuscleGroup';
export type { MuscleGroupIconProps } from './MuscleGroup';
export type { MuscleGroup, MuscleIconProps } from './types';

// Per-group exports for cases where the caller already knows the group at
// build time and wants to skip the router's lookup.
export { CardioIcon } from './Cardio';
export { CoreIcon } from './Core';
export { FullBodyIcon } from './FullBody';
export { LegsIcon } from './Legs';
export { MobilityIcon } from './Mobility';
export { PullIcon } from './Pull';
export { PushIcon } from './Push';
