import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Save, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { WorkoutExercise } from '../../types/exercise';

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
          <div className="flex items-center space-x-2">
            <input
              ref={titleInputRef}
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelTitle();
              }}
              className="flex-1 bg-gray-700 text-white px-3 py-1 rounded-lg text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={exercise.exercise.name}
              maxLength={100}
            />
            <button
              onClick={handleSaveTitle}
              className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              title="Save title"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelTitle}
              className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">{displayTitle}</h2>
                <button
                  onClick={() => {
                    setCustomTitle(exercise.customTitle || exercise.exercise.name);
                    setIsEditingTitle(true);
                  }}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Edit title"
                >
                  <Edit2 className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
              {hasCustomTitle && (
                <p className="text-xs text-gray-400 mt-0.5">
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
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <FileText className="w-4 h-4" />
                <span>Notes</span>
              </div>
              <button
                onClick={() => {
                  handleNotesBlur();
                  setShowNotes(false);
                }}
                className="p-1 hover:bg-gray-600 rounded transition-colors"
                title="Hide notes"
              >
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <textarea
              ref={notesTextareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes for this exercise (e.g., form cues, tempo, variations)..."
              className="w-full bg-gray-600 text-white px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-400">
                {notes.length}/500
              </span>
            </div>
          </div>
        ) : (
          <>
            {exercise.notes ? (
              <div className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                   onClick={() => setShowNotes(true)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 text-sm text-gray-300 mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Notes</span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-gray-200 line-clamp-2">
                      {exercise.notes}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNotes(true)}
                className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
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