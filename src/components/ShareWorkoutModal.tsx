import React, { useState, useEffect } from 'react';
import { Copy, Check, Share, ExternalLink, Loader2 } from 'lucide-react';
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
      <SheetContent className="mx-auto max-w-lg">
        <p className="text-body-sm text-ink-muted">{workoutData.name}</p>
        <SheetTitle className="mt-1 font-display text-title">Share workout</SheetTitle>

        {!shareUrl ? (
          // Share creation form
          <div className="mt-2 space-y-5">
            <SheetDescription className="mt-0">
              Make a link anyone can open to view and do this workout.
            </SheetDescription>

            {/* Share Settings */}
            <Stack
              direction="row"
              align="center"
              justify="between"
              gap={3}
              className="rounded-2xl bg-surface-raised px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-ink">
                  Open without an account
                </p>
                <p className="text-caption text-ink-muted">
                  People who aren&rsquo;t signed in can still use the link
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
              <p role="alert" className="text-body-sm text-danger">{shareError}</p>
            )}

            {/* Action Buttons */}
            <Stack gap={2}>
              <Button
                size="xl"
                onClick={handleCreateShare}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Share className="h-5 w-5" aria-hidden="true" />
                )}
                <span>{isCreating ? 'Creating link' : 'Create share link'}</span>
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </Stack>
          </div>
        ) : (
          // Share URL display
          <div className="mt-2 space-y-5">
            <p className="flex items-center gap-2 text-body-sm text-success" role="status">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              Link ready. Anyone with it can open this workout.
            </p>

            {/* Share URL Input */}
            <div className="space-y-1.5">
              <Label htmlFor="share-url-input" className="text-ink-muted">Share link</Label>
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
                  variant="secondary"
                  onClick={handleCopyUrl}
                >
                  {copySuccess ? (
                    <Check className="h-4 w-4 text-accent-2" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </IconButton>
              </Stack>
              {copySuccess && (
                <p className="text-caption text-accent-2" role="status">Copied</p>
              )}
            </div>

            {/* Social Share Buttons */}
            <div className="space-y-2">
              <p className="text-body-sm text-ink-muted">Send it with</p>
              <Stack direction="row" gap={2}>
                <Button
                  variant="secondary"
                  className="flex-1 px-3"
                  onClick={() => handleShareToSocial('twitter')}
                >
                  Twitter
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 px-3"
                  onClick={() => handleShareToSocial('facebook')}
                >
                  Facebook
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 px-3"
                  onClick={() => handleShareToSocial('whatsapp')}
                >
                  WhatsApp
                </Button>
              </Stack>
            </div>

            {/* Quick Actions */}
            <Stack gap={2}>
              <Button size="xl" onClick={handleClose}>
                Done
              </Button>
              <Button
                variant="ghost"
                onClick={() => window.open(shareUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>Preview link</span>
              </Button>
            </Stack>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
