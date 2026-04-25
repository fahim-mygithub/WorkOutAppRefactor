import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share, ExternalLink, Users } from 'lucide-react';
import { generateShareUrl } from '../utils/shareIdGenerator';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { createSharedWorkout, clearShareError, clearLastCreatedShareId } from '../store/slices/sharedWorkoutSlice';
import { useAuth } from '../contexts/AuthContext';
import { CreateSharedWorkoutData } from '../services/sharedWorkoutService';

interface ShareWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutData: CreateSharedWorkoutData;
}

export const ShareWorkoutModal: React.FC<ShareWorkoutModalProps> = ({
  isOpen,
  onClose,
  workoutData
}) => {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { isCreating, shareError, lastCreatedShareId } = useAppSelector(state => state.sharedWorkout);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(true);

  // Generate share URL when shareId is created
  useEffect(() => {
    if (lastCreatedShareId) {
      const url = generateShareUrl(lastCreatedShareId);
      setShareUrl(url);
    }
  }, [lastCreatedShareId]);

  // Clear share URL when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShareUrl('');
      setCopySuccess(false);
      dispatch(clearLastCreatedShareId());
    }
  }, [isOpen, dispatch]);

  // Clear errors when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch(clearShareError());
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const handleCreateShare = async () => {
    if (!user?.uid || !user?.displayName) return;

    const shareData: CreateSharedWorkoutData = {
      ...workoutData,
      allowAnonymous
    };

    dispatch(createSharedWorkout({
      creatorId: user.uid,
      creatorName: user.displayName || user.email || 'Anonymous',
      workoutData: shareData
    }));
  };

  const handleCopyUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback: select the text
      const urlInput = document.getElementById('share-url-input') as HTMLInputElement;
      if (urlInput) {
        urlInput.select();
        urlInput.setSelectionRange(0, 99999); // For mobile devices
      }
    }
  };

  const handleShareToSocial = (platform: string) => {
    if (!shareUrl) return;

    const text = `Check out this workout: ${workoutData.name}`;
    let url = '';

    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`;
        break;
      default:
        return;
    }

    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleClose = () => {
    dispatch(clearLastCreatedShareId());
    dispatch(clearShareError());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full mx-auto relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Share className="w-6 h-6" />
              <h2 className="text-xl font-bold">Share Workout</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!shareUrl ? (
            // Share creation form
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{workoutData.name}</h3>
                <p className="text-gray-400 text-sm">
                  Create a shareable link that allows others to view and perform your workout.
                </p>
              </div>

              {/* Share Settings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">Allow Anonymous Access</p>
                    <p className="text-gray-400 text-xs">Anyone with the link can access this workout</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowAnonymous}
                      onChange={(e) => setAllowAnonymous(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Error Display */}
              {shareError && (
                <div className="bg-red-900 border border-red-600 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{shareError}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateShare}
                  disabled={isCreating}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {isCreating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Share className="w-4 h-4" />
                  )}
                  <span>{isCreating ? 'Creating...' : 'Create Share Link'}</span>
                </button>
              </div>
            </div>
          ) : (
            // Share URL display
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Share Link Created!</h3>
                <p className="text-gray-400 text-sm">
                  Your workout is now shareable. Anyone with this link can access it.
                </p>
              </div>

              {/* Share URL Input */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Share URL
                </label>
                <div className="flex space-x-2">
                  <input
                    id="share-url-input"
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      copySuccess
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copySuccess ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {copySuccess && (
                  <p className="text-green-400 text-xs">Copied to clipboard!</p>
                )}
              </div>

              {/* Social Share Buttons */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300">Share to:</p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleShareToSocial('twitter')}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    Twitter
                  </button>
                  <button
                    onClick={() => handleShareToSocial('facebook')}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    Facebook
                  </button>
                  <button
                    onClick={() => handleShareToSocial('whatsapp')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    WhatsApp
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={() => window.open(shareUrl, '_blank')}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};