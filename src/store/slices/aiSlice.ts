// Ask AI sheet state. AI hides unless invoked: the sheet starts closed and
// only opens on an explicit user action (never auto-popup).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AiState {
  open: boolean;
  /** A first message to send when the sheet opens (e.g. from Ask coach). */
  seed?: string;
  /** The exercise the conversation is about, when opened from the player. */
  focusExerciseId?: string;
  /** Set when the backend said no (not allowed / limit); hides AI entry points. */
  disabledReason?: 'not-allowed' | 'limit' | 'unconfigured';
}

const initialState: AiState = { open: false };

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    askAiOpened(
      state,
      action: PayloadAction<{ seed?: string; focusExerciseId?: string } | undefined>,
    ) {
      state.open = true;
      state.seed = action.payload?.seed;
      state.focusExerciseId = action.payload?.focusExerciseId;
    },
    askAiClosed(state) {
      state.open = false;
      state.seed = undefined;
      state.focusExerciseId = undefined;
    },
    aiDisabled(state, action: PayloadAction<NonNullable<AiState['disabledReason']>>) {
      state.disabledReason = action.payload;
    },
  },
});

export const { askAiOpened, askAiClosed, aiDisabled } = aiSlice.actions;
export default aiSlice.reducer;
