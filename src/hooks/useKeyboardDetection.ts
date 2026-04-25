import { useState, useEffect } from 'react';

interface KeyboardInfo {
  isVisible: boolean;
  height: number;
}

export const useKeyboardDetection = (): KeyboardInfo => {
  const [keyboardInfo, setKeyboardInfo] = useState<KeyboardInfo>({
    isVisible: false,
    height: 0,
  });

  useEffect(() => {
    // Check if the browser supports Visual Viewport API
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const windowHeight = window.innerHeight;
        const visualHeight = window.visualViewport!.height;
        const keyboardHeight = windowHeight - visualHeight;

        // Consider keyboard visible if the difference is significant (> 100px)
        const isKeyboardVisible = keyboardHeight > 100;

        setKeyboardInfo({
          isVisible: isKeyboardVisible,
          height: isKeyboardVisible ? keyboardHeight : 0,
        });
      };

      // Listen to visualViewport resize events
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);

      // Initial check
      handleVisualViewportChange();

      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
      };
    } else {
      // Fallback for browsers without Visual Viewport API
      const handleWindowResize = () => {
        // This is a rough estimate - detect significant height changes
        const currentHeight = window.innerHeight;
        const screenHeight = window.screen.height;

        // On mobile, if the window height is significantly less than screen height,
        // assume keyboard is open
        const heightDifference = screenHeight - currentHeight;
        const isKeyboardVisible = heightDifference > 200; // Threshold for keyboard detection

        setKeyboardInfo({
          isVisible: isKeyboardVisible,
          height: isKeyboardVisible ? heightDifference : 0,
        });
      };

      // Listen to window resize events as fallback
      window.addEventListener('resize', handleWindowResize);

      // Initial check
      handleWindowResize();

      return () => {
        window.removeEventListener('resize', handleWindowResize);
      };
    }
  }, []);

  return keyboardInfo;
};