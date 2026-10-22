import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Stack } from '../ui/stack';
import { toDateKey, addDaysKey } from '../../lib/dateKey';

export interface PlanDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialDateKey?: string;
  confirmLabel?: string;
  onConfirm: (dateKey: string) => void;
}

export const PlanDateModal: React.FC<PlanDateModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  initialDateKey,
  confirmLabel = 'Save plan',
  onConfirm,
}) => {
  const today = toDateKey(new Date());
  const tomorrow = addDaysKey(today, 1);
  const initialKey = initialDateKey && initialDateKey >= today ? initialDateKey : tomorrow;

  const [dateKey, setDateKey] = useState<string>(initialKey);

  useEffect(() => {
    if (open) {
      setDateKey(initialKey);
    }
  }, [open, initialKey]);

  const isInvalid = !dateKey || dateKey < today;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid) return;
    onConfirm(dateKey);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="mx-auto max-w-lg">
        <div>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <Stack gap={2}>
            <label htmlFor="plan-date-input" className="text-body-sm font-medium text-ink">
              Choose date
            </label>
            <Input
              id="plan-date-input"
              type="date"
              min={today}
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="w-full"
              required
            />
          </Stack>

          <Stack direction="row" justify="end" gap={2} className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isInvalid}
            >
              {confirmLabel}
            </Button>
          </Stack>
        </form>
      </SheetContent>
    </Sheet>
  );
};
