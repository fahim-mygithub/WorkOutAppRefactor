import type { ComponentType } from 'react';

import { CardioIcon } from './Cardio';
import { CoreIcon } from './Core';
import { FullBodyIcon } from './FullBody';
import { LegsIcon } from './Legs';
import { MobilityIcon } from './Mobility';
import { PullIcon } from './Pull';
import { PushIcon } from './Push';
import type { MuscleGroup, MuscleIconProps } from './types';

const MAP = {
  push: PushIcon,
  pull: PullIcon,
  legs: LegsIcon,
  core: CoreIcon,
  cardio: CardioIcon,
  'full-body': FullBodyIcon,
  mobility: MobilityIcon,
} as const satisfies Record<MuscleGroup, ComponentType<MuscleIconProps>>;

export interface MuscleGroupIconProps extends MuscleIconProps {
  /** Which muscle group to render. */
  group: MuscleGroup;
}

/**
 * Routes to the per-group SVG component. Pass `aria-label` for meaningful
 * icons; omit it for decorative usage (the icon will be `aria-hidden`).
 */
export function MuscleGroupIcon({ group, ...rest }: MuscleGroupIconProps) {
  const Icon = MAP[group];
  return <Icon {...rest} />;
}
