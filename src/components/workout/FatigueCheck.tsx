import React, { useEffect, useState } from 'react';
import { Battery, BatteryLow, X, TrendingDown, RefreshCw, Zap } from 'lucide-react';

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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const handleFatigued = () => {
    onFatigued();
    handleClose();
  };

  const handleNotFatigued = () => {
    onNotFatigued();
    handleClose();
  };

  const handleSwitchVariation = () => {
    if (onSwitchVariation) {
      onSwitchVariation();
    }
    handleClose();
  };

  const reducedWeight = Math.round(currentWeight * 0.9);

  return (
    <div
      className={`fixed bottom-20 right-4 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className="w-80 rounded-lg shadow-lg border border-gray-700 bg-gray-800 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <BatteryLow className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <h3 className="font-semibold text-white">Tough Set!</h3>
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
          <p className="text-sm text-gray-300">
            Set {setNumber} was challenging. How are you feeling?
          </p>

          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">Current: {currentWeight} lbs</p>
            <p className="text-xs text-gray-500">
              If fatigued, we'll reduce to {reducedWeight} lbs (-10%) for remaining sets
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <button
              onClick={handleFatigued}
              className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center justify-center space-x-2"
            >
              <Battery className="w-4 h-4" />
              <span className="font-medium">Fatigued - Reduce Weight</span>
            </button>

            <button
              onClick={handleNotFatigued}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span className="font-medium">Good - Continue As Planned</span>
            </button>

            {onSwitchVariation && (
              <button
                onClick={handleSwitchVariation}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="font-medium">Switch to Easier Variation</span>
              </button>
            )}
          </div>

          {/* Tips */}
          <div className="bg-gray-900 rounded-lg p-2">
            <p className="text-xs text-gray-400">
              <span className="font-semibold text-gray-300">Tip:</span> If this is set 1 or 2, consider reducing weight.
              If it's set 3+, you might just need longer rest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FatigueCheck;