import React, { useCallback, useState } from 'react';
import { useStore } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { buildPresetSet } from '../../store/slices/aiSlice';
import type { PlannedWorkout } from '../../store/slices/plannedWorkoutsSlice';
import { planToBuildPreset } from '../../lib/planWorkout';
import { Modal, ModalContent, ModalDescription, ModalTitle } from '../ui/modal';
import { Button } from '../ui/button';

interface EditPlanOptions {
  onProceed?: () => void;
}

interface PendingEdit {
  plan: PlannedWorkout;
  onProceed?: () => void;
}

interface StoreWithOptionalAi {
  ai?: {
    buildHasDraft?: boolean;
  };
}

/**
 * Shared action for editing a PlannedWorkout in the Builder (`/build`).
 * Checks `ai.buildHasDraft` first and asks before replacing an unsaved Build draft.
 */
export function useEditPlannedWorkout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const store = useStore<StoreWithOptionalAi>();
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const openInBuilder = useCallback(
    (plan: PlannedWorkout, onProceed?: () => void) => {
      dispatch(buildPresetSet(planToBuildPreset(plan)));
      onProceed?.();
      navigate('/build');
    },
    [dispatch, navigate],
  );

  const requestEditPlan = useCallback(
    (plan: PlannedWorkout, opts?: EditPlanOptions) => {
      const hasDraft = Boolean(store.getState().ai?.buildHasDraft);
      if (hasDraft) {
        setPendingEdit({ plan, onProceed: opts?.onProceed });
        return;
      }
      openInBuilder(plan, opts?.onProceed);
    },
    [store, openInBuilder],
  );

  const handlePlanCardClick = useCallback(
    (e: React.MouseEvent, plan: PlannedWorkout, opts?: EditPlanOptions) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
        return;
      }
      requestEditPlan(plan, opts);
    },
    [requestEditPlan],
  );

  const confirmReplace = useCallback(() => {
    if (!pendingEdit) return;
    const { plan, onProceed } = pendingEdit;
    setPendingEdit(null);
    openInBuilder(plan, onProceed);
  }, [pendingEdit, openInBuilder]);

  const replaceDraftDialog = (
    <Modal open={pendingEdit !== null} onOpenChange={(open) => !open && setPendingEdit(null)}>
      <ModalContent className="p-5">
        <ModalTitle className="text-title">Replace Build draft?</ModalTitle>
        <ModalDescription>This replaces what is on the Build screen now.</ModalDescription>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setPendingEdit(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmReplace}>
            Replace draft
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );

  return {
    requestEditPlan,
    handlePlanCardClick,
    replaceDraftDialog,
  };
}
