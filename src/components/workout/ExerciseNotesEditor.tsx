import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Save, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { WorkoutExercise } from '../../types/exercise';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { IconButton } from '../ui/icon-button';

interface ExerciseNotesEditorProps {
  exercise: WorkoutExercise;
  onUpdateTitle: (title: string) => void;
  onUpdateNotes: (notes: string) => void;
}

export const ExerciseNotesEditor: React.FC<ExerciseNotesEditorProps> = ({
  exercise,
  onUpdateTitle,
  onUpdateNotes
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState(exercise.customTitle || '');
  const [notes, setNotes] = useState(exercise.notes || '');
  const [showNotes, setShowNotes] = useState(!!exercise.notes);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (showNotes && !notes && notesTextareaRef.current) {
      notesTextareaRef.current.focus();
    }
  }, [showNotes, notes]);

  const handleSaveTitle = () => {
    const trimmedTitle = customTitle.trim();
    if (trimmedTitle && trimmedTitle !== exercise.exercise.name) {
      onUpdateTitle(trimmedTitle);
    } else if (!trimmedTitle) {
      // If empty, clear the custom title
      onUpdateTitle('');
      setCustomTitle('');
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setCustomTitle(exercise.customTitle || '');
    setIsEditingTitle(false);
  };

  const handleNotesBlur = () => {
    const trimmedNotes = notes.trim();
    if (trimmedNotes !== exercise.notes) {
      onUpdateNotes(trimmedNotes);
    }
    if (!trimmedNotes) {
      setShowNotes(false);
    }
  };

  const displayTitle = exercise.customTitle || exercise.exercise.name;
  const hasCustomTitle = !!exercise.customTitle && exercise.customTitle !== exercise.exercise.name;

  return (
    <div className="space-y-3">
      {/* Title Section */}
      <div>
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              ref={titleInputRef}
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelTitle();
              }}
              className="flex-1 text-title font-bold"
              placeholder={exercise.exercise.name}
              maxLength={100}
            />
            <IconButton
              variant="primary"
              size="sm"
              onClick={handleSaveTitle}
              aria-label="Save title"
              title="Save title"
            >
              <Save className="w-4 h-4" />
            </IconButton>
            <IconButton
              variant="danger"
              size="sm"
              onClick={handleCancelTitle}
              aria-label="Cancel"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-title font-bold text-ink">{displayTitle}</h2>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomTitle(exercise.customTitle || exercise.exercise.name);
                    setIsEditingTitle(true);
                  }}
                  aria-label="Edit title"
                  title="Edit title"
                  className="text-ink-subtle hover:text-ink"
                >
                  <Edit2 className="w-4 h-4" />
                </IconButton>
              </div>
              {hasCustomTitle && (
                <p className="text-caption text-ink-subtle mt-0.5">
                  Original: {exercise.exercise.name}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div>
        {showNotes ? (
          <div className="bg-surface-subtle rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-body-sm text-ink-muted">
                <FileText className="w-4 h-4" />
                <span>Notes</span>
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleNotesBlur();
                  setShowNotes(false);
                }}
                aria-label="Hide notes"
                title="Hide notes"
                className="text-ink-subtle hover:text-ink"
              >
                <ChevronUp className="w-4 h-4" />
              </IconButton>
            </div>
            <Textarea
              ref={notesTextareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes for this exercise (e.g., form cues, tempo, variations)..."
              className="resize-none"
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-end mt-1">
              <span className="text-caption text-ink-subtle">
                {notes.length}/500
              </span>
            </div>
          </div>
        ) : (
          <>
            {exercise.notes ? (
              <div className="bg-surface-subtle rounded-lg p-3 cursor-pointer hover:bg-surface-raised transition-colors duration-snap"
                   onClick={() => setShowNotes(true)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-body-sm text-ink-muted mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Notes</span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                    <p className="text-body-sm text-ink line-clamp-2">
                      {exercise.notes}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNotes(true)}
                className="flex items-center gap-2 text-body-sm text-ink-subtle hover:text-ink-muted transition-colors duration-snap"
              >
                <FileText className="w-4 h-4" />
                <span>Add notes</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
