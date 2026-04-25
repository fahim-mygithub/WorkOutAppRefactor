import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Calendar, TrendingDown } from 'lucide-react';

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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const handleAccept = () => {
    onAccept();
    handleClose();
  };

  const handleDecline = () => {
    onDecline();
    handleClose();
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

  const getDeloadColor = () => {
    if (suggestedDeloadPercentage >= 30) return 'border-red-700 bg-gray-800';
    if (suggestedDeloadPercentage >= 20) return 'border-orange-700 bg-gray-800';
    return 'border-yellow-700 bg-gray-800';
  };

  return (
    <div
      className={`fixed bottom-20 right-4 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className={`w-80 rounded-lg shadow-lg border ${getDeloadColor()} p-4`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <h3 className="font-semibold text-white">Deload Recommended</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{getTimeAwayMessage()}</span>
          </div>

          <div className="bg-gray-900 rounded-lg p-3 space-y-2">
            <div className="text-sm text-gray-400">
              To prevent injury and help you readjust, consider starting with:
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Previous:</span>
                  <span className="font-semibold text-white">{previousWeight} lbs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-400">Suggested:</span>
                  <span className="font-semibold text-yellow-400">{suggestedWeight} lbs</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-yellow-400">
                  -{suggestedDeloadPercentage}%
                </div>
                <div className="text-xs text-gray-500">reduction</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium text-sm"
            >
              Apply Deload
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-medium text-sm"
            >
              Keep Original
            </button>
          </div>

          {/* Additional Info */}
          <p className="text-xs text-gray-500 text-center">
            You can always adjust the weight after your first set
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeloadSuggestion;