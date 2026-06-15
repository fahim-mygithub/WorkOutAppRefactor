import React, { useState, useRef, useEffect } from 'react';
import { Exercise } from '../../types/exercise';
import { APP_SCROLL_ID } from '../../lib/scroll';

interface ExercisePreviewModalProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExercisePreviewModal: React.FC<ExercisePreviewModalProps> = ({
  exercise,
  isOpen,
  onClose,
}) => {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset video states when exercise changes
  useEffect(() => {
    if (exercise?.videoLinks && exercise.videoLinks.length > 0) {
      setActiveVideoIndex(0);
      setVideoError(false);
      setVideoLoading(true);
    }
  }, [exercise?.id]);

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // The shell already sets body overflow:hidden, so lock the canonical
    // scroll container (#app-scroll) instead of fighting the shell on body.
    const scrollEl = document.getElementById(APP_SCROLL_ID);
    const previousOverflow = scrollEl?.style.overflow ?? '';

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      if (scrollEl) {
        scrollEl.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      if (scrollEl) {
        scrollEl.style.overflow = previousOverflow;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !exercise) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-green-900 text-green-300 border-green-700';
      case 'intermediate':
        return 'bg-yellow-900 text-yellow-300 border-yellow-700';
      case 'advanced':
        return 'bg-red-900 text-red-300 border-red-700';
      default:
        return 'bg-gray-900 text-gray-300 border-gray-700';
    }
  };

  const getMuscleGroupIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );

  const handleVideoSelect = (index: number) => {
    if (index !== activeVideoIndex) {
      setActiveVideoIndex(index);
      setVideoError(false);
      setVideoLoading(true);
      
      if (videoRef.current) {
        videoRef.current.load();
      }
    }
  };

  const handleVideoLoad = () => {
    setVideoLoading(false);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setVideoLoading(false);
    setVideoError(true);
  };

  const handleOpenExternalVideo = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          <div className="flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-700">
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {exercise.name}
                </h3>
                
                {/* Exercise Metadata */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 text-sm text-gray-300">
                    {getMuscleGroupIcon()}
                    <span>
                      {exercise.muscleGroups && exercise.muscleGroups.length > 1 
                        ? exercise.muscleGroups.join(', ')
                        : exercise.muscleGroup
                      }
                    </span>
                  </div>
                  
                  <span className="text-gray-500">•</span>
                  
                  <div className="flex items-center gap-1 text-sm text-gray-300">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    <span>{exercise.equipment}</span>
                  </div>
                  
                  <span className="text-gray-500">•</span>
                  
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                    {exercise.difficulty}
                  </span>
                  
                  {exercise.mechanic && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="text-sm text-gray-400">{exercise.mechanic}</span>
                    </>
                  )}
                </div>

                {/* Multiple Muscle Groups Display */}
                {exercise.muscleGroups && exercise.muscleGroups.length > 1 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-2">Muscle Groups Targeted:</div>
                    <div className="flex flex-wrap gap-1">
                      {exercise.muscleGroups.map((muscleGroup, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs border border-gray-600"
                        >
                          {muscleGroup}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video Section */}
                {exercise.videoLinks && exercise.videoLinks.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white">Exercise Video</h4>
                    
                    {/* Video Player */}
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                      {videoLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                        </div>
                      )}
                      
                      {videoError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <p>Video could not be loaded</p>
                          <button
                            onClick={() => handleOpenExternalVideo(exercise.videoLinks[activeVideoIndex])}
                            className="mt-2 text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open in new tab
                          </button>
                        </div>
                      ) : (
                        <video
                          ref={videoRef}
                          controls
                          className="w-full h-full object-cover"
                          onLoadedData={handleVideoLoad}
                          onError={handleVideoError}
                          key={exercise.videoLinks[activeVideoIndex]}
                        >
                          <source src={exercise.videoLinks[activeVideoIndex]} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                    
                    {/* Video Selection */}
                    {exercise.videoLinks.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {exercise.videoLinks.map((link, index) => (
                          <button
                            key={index}
                            onClick={() => handleVideoSelect(index)}
                            className={`flex-shrink-0 px-3 py-2 rounded text-sm font-medium transition-colors ${
                              index === activeVideoIndex
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            Video {index + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Instructions Section */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-white">Instructions</h4>
                  
                  {exercise.instructions && exercise.instructions.length > 0 ? (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        {exercise.instructions.map((instruction, index) => (
                          <li key={index} className="leading-relaxed">
                            {instruction}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="bg-gray-700 rounded-lg p-4 text-gray-400 text-center">
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No instructions available for this exercise.</p>
                    </div>
                  )}
                  
                  {/* Additional Details */}
                  {(exercise.force || exercise.grips) && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-white">Additional Details</h5>
                      <div className="bg-gray-700 rounded-lg p-4 space-y-2">
                        {exercise.force && (
                          <div className="flex items-center gap-2 text-gray-300">
                            <span className="font-medium">Force:</span>
                            <span>{exercise.force}</span>
                          </div>
                        )}
                        {exercise.grips && (
                          <div className="flex items-center gap-2 text-gray-300">
                            <span className="font-medium">Grip:</span>
                            <span>{exercise.grips}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t border-gray-700 px-6 py-4">
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};