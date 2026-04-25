import { useState, useEffect, useCallback } from 'react';

interface IOSKeyboardState {
  isKeyboardVisible: boolean;
  isIOSSafari: boolean;
  shouldUseAbsolutePositioning: boolean;
  calculatedBottom: number;
}

export const useIOSKeyboardFix = (): IOSKeyboardState => {
  const [keyboardState, setKeyboardState] = useState<IOSKeyboardState>({
    isKeyboardVisible: false,
    isIOSSafari: false,
    shouldUseAbsolutePositioning: false,
    calculatedBottom: 0,
  });

  // Detect iOS Safari specifically (not Chrome on iOS)
  const detectIOSSafari = useCallback(() => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isSafari = userAgent.indexOf('Chrome') === -1 && userAgent.indexOf('Safari') > -1;
    return isIOS && isSafari;
  }, []);

  // Calculate bottom position using Visual Viewport API
  const calculateBottomPosition = useCallback(() => {
    if (!window.visualViewport) return 0;

    // Get the current scroll position and viewport height
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportHeight = window.visualViewport.height;
    const layoutHeight = window.innerHeight;

    // If keyboard is open, calculate position relative to visual viewport
    if (viewportHeight < layoutHeight) {
      return scrollY + viewportHeight;
    }

    return 0; // Use fixed positioning when keyboard is closed
  }, []);

  // Handle input focus events
  const handleInputFocus = useCallback(() => {
    if (!keyboardState.isIOSSafari) return;

    setKeyboardState(prev => ({
      ...prev,
      isKeyboardVisible: true,
      shouldUseAbsolutePositioning: true,
      calculatedBottom: calculateBottomPosition(),
    }));
  }, [keyboardState.isIOSSafari, calculateBottomPosition]);

  // Handle input blur events
  const handleInputBlur = useCallback(() => {
    if (!keyboardState.isIOSSafari) return;

    // Small delay to allow keyboard to close
    setTimeout(() => {
      setKeyboardState(prev => ({
        ...prev,
        isKeyboardVisible: false,
        shouldUseAbsolutePositioning: false,
        calculatedBottom: 0,
      }));
    }, 150);
  }, [keyboardState.isIOSSafari]);

  // Handle visual viewport changes
  const handleVisualViewportChange = useCallback(() => {
    if (!keyboardState.isIOSSafari || !keyboardState.shouldUseAbsolutePositioning) return;

    setKeyboardState(prev => ({
      ...prev,
      calculatedBottom: calculateBottomPosition(),
    }));
  }, [keyboardState.isIOSSafari, keyboardState.shouldUseAbsolutePositioning, calculateBottomPosition]);

  useEffect(() => {
    const isIOSSafari = detectIOSSafari();

    setKeyboardState(prev => ({
      ...prev,
      isIOSSafari,
    }));

    if (!isIOSSafari) return;

    // Get all input elements that could trigger the keyboard
    const inputSelectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'input[type="search"]',
      'input[type="number"]',
      'input[type="tel"]',
      'input[type="url"]',
      'textarea',
      '[contenteditable="true"]'
    ];

    const inputs = document.querySelectorAll(inputSelectors.join(', '));

    // Add event listeners to all inputs
    inputs.forEach(input => {
      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);
    });

    // Add visual viewport listener if available
    let visualViewportListener: (() => void) | null = null;
    if (window.visualViewport) {
      visualViewportListener = handleVisualViewportChange;
      window.visualViewport.addEventListener('resize', visualViewportListener);
    }

    // Observer for dynamically added inputs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            // Check if the added element is an input or contains inputs
            const newInputs = element.matches?.(inputSelectors.join(', '))
              ? [element]
              : element.querySelectorAll?.(inputSelectors.join(', ')) || [];

            newInputs.forEach(input => {
              input.addEventListener('focus', handleInputFocus);
              input.addEventListener('blur', handleInputBlur);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cleanup
    return () => {
      inputs.forEach(input => {
        input.removeEventListener('focus', handleInputFocus);
        input.removeEventListener('blur', handleInputBlur);
      });

      if (visualViewportListener && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', visualViewportListener);
      }

      observer.disconnect();
    };
  }, [detectIOSSafari, handleInputFocus, handleInputBlur, handleVisualViewportChange]);

  return keyboardState;
};