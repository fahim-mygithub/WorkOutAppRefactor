import React, { useState } from 'react';
import { BatteryLow, TrendingDown, RefreshCw, Zap, Battery } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface FatigueCheckProps {
  exerciseName: string;
  currentWeight: number;
  setNumber: number;
  onFatigued: () => void;
  onNotFatigued: () => void;
  onSwitchVariation?: () => void;
  onClose: () => void;
}

export const FatigueCheck: React.FC<FatigueCheckProps> = ({
  exerciseName,
  currentWeight,
  setNumber,
  onFatigued,
  onNotFatigued,
  onSwitchVariation,
  onClose
}) => {
  // Sheet drives enter/exit animation; mirror open state + fire onClose on close.
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      onClose();
    }
  };

  const handleFatigued = () => {
    onFatigued();
    handleOpenChange(false);
  };

  const handleNotFatigued = () => {
    onNotFatigued();
    handleOpenChange(false);
  };

  const handleSwitchVariation = () => {
    if (onSwitchVariation) {
      onSwitchVariation();
    }
    handleOpenChange(false);
  };

  const reducedWeight = Math.round(currentWeight * 0.9);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <BatteryLow className="w-5 h-5 text-warning flex-shrink-0" />
          <SheetTitle className="text-title font-marker"><span className="marker-underline">Tough Set!</span></SheetTitle>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <p className="text-body-sm text-ink-muted">
            Set <span className="font-num font-tabular">{setNumber}</span> of {exerciseName} was challenging. How are you feeling?
          </p>

          <div className="bg-surface-subtle rounded-md p-3">
            <p className="text-caption text-ink-subtle mb-2">Current: <span className="font-num font-tabular">{currentWeight}</span> lbs</p>
            <p className="text-caption text-ink-subtle">
              If fatigued, we'll reduce to <span className="font-num font-tabular">{reducedWeight}</span> lbs (<span className="font-num font-tabular">-10%</span>) for remaining sets
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Button variant="primary" onClick={handleFatigued} className="w-full" size="lg">
              <Battery className="w-4 h-4" />
              <span>Fatigued - Reduce Weight</span>
            </Button>

            <Button variant="secondary" onClick={handleNotFatigued} className="w-full" size="lg">
              <Zap className="w-4 h-4" />
              <span>Good - Continue As Planned</span>
            </Button>

            {onSwitchVariation && (
              <Button variant="ghost" onClick={handleSwitchVariation} className="w-full" size="lg">
                <RefreshCw className="w-4 h-4" />
                <span>Switch to Easier Variation</span>
              </Button>
            )}
          </div>

          {/* Tips */}
          <div className="bg-surface-subtle rounded-md p-2 flex items-start gap-2">
            <TrendingDown className="w-4 h-4 text-ink-subtle flex-shrink-0 mt-0.5" />
            <p className="text-caption text-ink-subtle">
              <span className="font-semibold text-ink-muted">Tip:</span> If this is set 1 or 2, consider reducing weight.
              If it's set 3+, you might just need longer rest.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FatigueCheck;
