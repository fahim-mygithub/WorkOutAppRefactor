/** One logged working set. Shared across the progression core (best-set e1RM
 *  selection and in-session autoregulation) so there is a single source of truth. */
export interface LoggedSet {
  weight: number;
  reps: number;
  rir?: number;
}
