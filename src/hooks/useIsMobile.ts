import { useState, useEffect } from 'react';

interface MobileInfo {
  isMobile: boolean;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

export const useIsMobile = (): MobileInfo => {
  const [mobileInfo, setMobileInfo] = useState<MobileInfo>(() => {
    // Initialize with current window size to prevent hydration mismatches
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const height = typeof window !== 'undefined' ? window.innerHeight : 768;

    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      screenWidth: width,
      screenHeight: height,
      orientation: width < height ? 'portrait' : 'landscape',
    };
  });

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setMobileInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        screenWidth: width,
        screenHeight: height,
        orientation: width < height ? 'portrait' : 'landscape',
      });
    };

    // Check on mount
    checkScreenSize();

    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);

    // Listen for orientation changes (mobile devices)
    window.addEventListener('orientationchange', () => {
      // Use setTimeout to ensure the new dimensions are available
      setTimeout(checkScreenSize, 100);
    });

    return () => {
      window.removeEventListener('resize', checkScreenSize);
      window.removeEventListener('orientationchange', checkScreenSize);
    };
  }, []);

  return mobileInfo;
};