import React, { useState, useEffect } from 'react';
import { Copy, Check, Share, ExternalLink } from 'lucide-react';
import { generateShareUrl } from '../utils/shareIdGenerator';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { createSharedWorkout, clearShareError, clearLastCreatedShareId } from '../store/slices/sharedWorkoutSlice';
import { useAuth } from '../contexts/AuthContext';
import { CreateSharedWorkoutData } from '../services/sharedWorkoutService';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Stack } from '@/components/ui/stack';

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
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <SheetContent>
        <Stack direction="row" align="center" gap={3} className="mb-1">
          <Share aria-hidden="true" className="h-6 w-6 text-accent" />
          <SheetTitle className="text-title">Share Workout</SheetTitle>
        </Stack>

        {!shareUrl ? (
          // Share creation form
          <div className="space-y-4">
            <div>
              <h3 className="text-body font-semibold text-ink mb-1">
                {workoutData.name}
              </h3>
              <SheetDescription className="mt-0">
                Create a shareable link that allows others to view and perform
                your workout.
              </SheetDescription>
            </div>

            {/* Share Settings */}
            <Stack
              direction="row"
              align="center"
              justify="between"
              gap={3}
              className="rounded-lg bg-surface-subtle p-3"
            >
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink">
                  Allow Anonymous Access
                </p>
                <p className="text-caption text-ink-muted">
                  Anyone with the link can access this workout
                </p>
              </div>
              <Switch
                checked={allowAnonymous}
                onCheckedChange={setAllowAnonymous}
                aria-label="Allow anonymous access"
              />
            </Stack>

            {/* Error Display */}
            {shareError && (
              <div className="rounded-lg border border-danger bg-danger/10 p-3">
                <p className="text-body-sm text-danger">{shareError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <Stack direction="row" gap={3}>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateShare}
                disabled={isCreating}
              >
                {isCreating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-fg border-t-transparent" />
                ) : (
                  <Share className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isCreating ? 'Creating...' : 'Create Share Link'}</span>
              </Button>
            </Stack>
          </div>
        ) : (
          // Share URL display
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success">
                <Check className="h-8 w-8 text-ink-inverse" aria-hidden="true" />
              </div>
              <h3 className="text-body font-semibold text-ink mb-1">
                Share Link Created!
              </h3>
              <p className="text-body-sm text-ink-muted">
                Your workout is now shareable. Anyone with this link can access
                it.
              </p>
            </div>

            {/* Share URL Input */}
            <div className="space-y-3">
              <Label htmlFor="share-url-input">Share URL</Label>
              <Stack direction="row" gap={2}>
                <Input
                  id="share-url-input"
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1"
                />
                <IconButton
                  aria-label={copySuccess ? 'Copied' : 'Copy share URL'}
                  variant={copySuccess ? 'primary' : 'secondary'}
                  onClick={handleCopyUrl}
                >
                  {copySuccess ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </IconButton>
              </Stack>
              {copySuccess && (
                <p className="text-caption text-success">Copied to clipboard!</p>
              )}
            </div>

            {/* Social Share Buttons */}
            <div className="space-y-2">
              <p className="text-body-sm font-medium text-ink-muted">
                Share to:
              </p>
              <Stack direction="row" gap={2}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleShareToSocial('twitter')}
                >
                  Twitter
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleShareToSocial('facebook')}
                >
                  Facebook
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleShareToSocial('whatsapp')}
                >
                  WhatsApp
                </Button>
              </Stack>
            </div>

            {/* Quick Actions */}
            <Stack direction="row" gap={3}>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => window.open(shareUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>Preview</span>
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Done
              </Button>
            </Stack>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
