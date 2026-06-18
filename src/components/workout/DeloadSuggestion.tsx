import React, { useState } from 'react';
import { AlertTriangle, Calendar, TrendingDown } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface DeloadSuggestionProps {
  weeksSinceLastWorkout: number;
  suggestedDeloadPercentage: number;
  previousWeight: number;
  suggestedWeight: number;
  exerciseName: string;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export const DeloadSuggestion: React.FC<DeloadSuggestionProps> = ({
  weeksSinceLastWorkout,
  suggestedDeloadPercentage,
  previousWeight,
  suggestedWeight,
  exerciseName,
  onAccept,
  onDecline,
  onClose
}) => {
  // Sheet handles enter/exit animation via AnimatePresence; we mirror open state
  // and fire onClose when the sheet finishes closing.
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      onClose();
    }
  };

  const handleAccept = () => {
    onAccept();
    handleOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    handleOpenChange(false);
  };

  const getTimeAwayMessage = () => {
    if (weeksSinceLastWorkout >= 4) {
      return `It's been over a month since your last ${exerciseName} workout`;
    } else if (weeksSinceLastWorkout >= 3) {
      return `It's been ${weeksSinceLastWorkout} weeks since your last ${exerciseName} workout`;
    } else {
      return `It's been ${weeksSinceLastWorkout} weeks since your last ${exerciseName} workout`;
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <SheetTitle className="text-title font-marker"><span className="marker-underline">Deload Recommended</span></SheetTitle>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-body-sm text-ink-muted">
            <Calendar className="w-4 h-4 text-ink-subtle" />
            <span>{getTimeAwayMessage()}</span>
          </div>

          <div className="bg-surface-subtle rounded-md p-3 space-y-2">
            <div className="text-body-sm text-ink-muted">
              To prevent injury and help you readjust, consider starting with:
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-ink-subtle font-marker">Previous:</span>
                  <span className="font-semibold text-ink font-num font-tabular">{previousWeight} lbs</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-warning" />
                  <span className="text-body-sm text-ink-subtle font-marker">Suggested:</span>
                  <span className="font-semibold text-warning font-num font-tabular">{suggestedWeight} lbs</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-display font-bold text-warning font-num font-tabular">
                  -{suggestedDeloadPercentage}%
                </div>
                <div className="text-caption text-ink-subtle font-marker">reduction</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleAccept} className="flex-1">
              Apply Deload
            </Button>
            <Button variant="secondary" onClick={handleDecline} className="flex-1">
              Keep Original
            </Button>
          </div>

          {/* Additional Info */}
          <p className="text-caption text-ink-subtle text-center">
            You can always adjust the weight after your first set
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DeloadSuggestion;
