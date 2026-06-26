/**
 * Pure program-position math for the Charlie Split. A program is a sequence of
 * "slots" (0,1,2,…); the calendar maps undone slots to upcoming dates elsewhere.
 * Everything here is a pure function of (startRotation, slot) — no dates — so it's
 * trivially testable and DST-immune.
 */
import type { DayType } from './definition';
import { ROTATION, CYCLE_LEN } from './definition';

/** Day-type at a program slot, given the rotation index of slot 0 (0 = push). */
export function slotType(startRotation: number, slot: number): DayType {
  const idx = (((startRotation + slot) % 3) + 3) % 3;
  return ROTATION[idx];
}

/**
 * 0-indexed count of prior slots sharing this slot's day-type. Because ROTATION
 * has length 3 and each type appears once per rotation, this is simply
 * floor(slot/3) (independent of startRotation), plus any program start offset.
 */
export function cycleOrdinalForSlot(slot: number, startCycle = 0): number {
  return Math.floor(slot / 3) + startCycle;
}

/** Position within a day-type's cycle of length `len` (handles negatives). */
export function cycleIndex(ordinal: number, len: number): number {
  return ((ordinal % len) + len) % len;
}

/** The cycle index for a slot of a given day-type. */
export function cycleIndexForSlot(dayType: DayType, slot: number, startCycle = 0): number {
  return cycleIndex(cycleOrdinalForSlot(slot, startCycle), CYCLE_LEN[dayType]);
}
